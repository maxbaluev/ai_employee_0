"""Planner agent responsible for ranking candidate plays."""

from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import asdict
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

from google.adk.agents import LlmAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events.event import Event
from google.genai import types

from pydantic import Field

from ..services import (
    CatalogUnavailableError,
    CopilotKitStreamer,
    SupabaseClient,
    TelemetryEmitter,
)
from ..tools.composio_client import ComposioCatalogClient
from .state import (
    InspectionPreview,
    MissionContext,
    RankedPlay,
    INSPECTION_PREVIEW_KEY,
    MISSION_CONTEXT_KEY,
    RANKED_PLAYS_KEY,
    SELECTED_PLAY_KEY,
)


class CatalogEmptyInterrupt(RuntimeError):
    """Raised when planner catalog discovery returns no viable candidates."""


class CatalogUnavailableInterrupt(RuntimeError):
    """Raised when planner cannot reach the Supabase catalog."""

LOGGER = logging.getLogger(__name__)


class PlannerAgent(LlmAgent):
    """Generates ranked plays using Supabase embeddings and Composio catalog."""

    supabase: Optional[SupabaseClient] = Field(default=None, exclude=True)
    telemetry: Optional[TelemetryEmitter] = Field(default=None, exclude=True)
    composio: Optional[ComposioCatalogClient] = Field(default=None, exclude=True)
    streamer: Optional[CopilotKitStreamer] = Field(default=None, exclude=True)

    def __init__(
        self,
        *,
        name: str = "PlannerAgent",
        model: str = "gemini-2.5-flash",
        supabase: Optional[SupabaseClient] = None,
        telemetry: Optional[TelemetryEmitter] = None,
        composio: Optional[ComposioCatalogClient] = None,
        streamer: Optional[CopilotKitStreamer] = None,
    ) -> None:
        super().__init__(
            name=name,
            model=model,
            instruction=(
                "Rank candidate AI Employee control-plane plays using Supabase "
                "embeddings, Composio catalogue context, and guardrail metadata."
            ),
            supabase=supabase,
            telemetry=telemetry,
            composio=composio,
            streamer=streamer,
        )
        if self.supabase is None:
            object.__setattr__(self, "supabase", SupabaseClient.from_env())
        if self.telemetry is None:
            object.__setattr__(self, "telemetry", TelemetryEmitter(self.supabase))
        if self.composio is None:
            object.__setattr__(self, "composio", ComposioCatalogClient.from_env())
        if self.streamer is None:
            object.__setattr__(self, "streamer", CopilotKitStreamer())

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        mission_context = self._load_context(ctx)
        mission_mode = ctx.session.state.get("mission_mode", mission_context.mode)

        # Emit planner_stage_started
        self._emit_stage_started(mission_context, mission_mode)

        self.telemetry.emit(
            "planner_run_started",
            tenant_id=mission_context.tenant_id,
            mission_id=mission_context.mission_id,
            payload={
                "mode": mission_mode,
                "objective_preview": mission_context.objective[:120],
                "audience": mission_context.audience,
                "guardrail_count": len(mission_context.guardrails or []),
            },
        )

        rank_started_at = time.perf_counter()

        ranked, rank_metrics = self._rank_plays(mission_context, mission_mode)
        latency_ms = int((time.perf_counter() - rank_started_at) * 1000)

        ctx.session.state[RANKED_PLAYS_KEY] = [asdict(play) for play in ranked]
        if ranked:
            ctx.session.state[SELECTED_PLAY_KEY] = asdict(ranked[0])

        self._persist_rankings(mission_context, ranked)

        toolkit_counts = self._toolkit_counts(ranked)
        similarities = [
            float(play.telemetry.get("similarity", 0.0) or 0.0)
            for play in ranked
            if isinstance(play.telemetry, dict)
        ]
        avg_similarity = sum(similarities) / max(len(similarities), 1)
        hybrid_score_avg = float(rank_metrics.get("hybrid_score_avg", 0.0))
        composio_score_avg = float(rank_metrics.get("composio_score_avg", 0.0))
        palette_catalog_size = int(rank_metrics.get("palette_catalog_size", 0))
        top_confidence = ranked[0].confidence if ranked else None
        top_reason = (
            ranked[0].reason_markdown[:200] if ranked and ranked[0].reason_markdown else ""
        )

        latency_breakdown = {
            "rank_total_ms": latency_ms,
            "library_query_ms": int(rank_metrics.get("library_latency_ms", 0)),
            "composio_discovery_ms": int(rank_metrics.get("composio_latency_ms", 0)),
        }

        self._record_planner_run(
            context=mission_context,
            mission_mode=mission_mode,
            ranked=ranked,
            latency_ms=latency_ms,
            avg_similarity=avg_similarity,
            toolkit_counts=toolkit_counts,
            library_latency_ms=latency_breakdown["library_query_ms"],
            composio_latency_ms=latency_breakdown["composio_discovery_ms"],
            hybrid_score_avg=hybrid_score_avg,
            composio_score_avg=composio_score_avg,
            palette_catalog_size=palette_catalog_size,
        )

        self.telemetry.emit(
            "planner_run_completed",
            tenant_id=mission_context.tenant_id,
            mission_id=mission_context.mission_id,
            payload={
                "mode": mission_mode,
                "candidate_count": len(ranked),
                "toolkits": toolkit_counts,
                "library_entries": [
                    play.telemetry.get("library_entry_id") for play in ranked
                ],
                "average_similarity": round(avg_similarity, 4),
                "top_confidence": top_confidence,
                "top_reason_preview": top_reason,
                "latency_ms": latency_ms,
                "latency_breakdown": latency_breakdown,
                "hybrid_score_avg": round(hybrid_score_avg, 4),
                "composio_score_avg": round(composio_score_avg, 4),
                "palette_catalog_size": palette_catalog_size,
            },
        )

        self._emit_rank_complete(
            mission_context,
            mission_mode,
            ranked,
            latency_ms=latency_ms,
            avg_similarity=avg_similarity,
            toolkit_counts=toolkit_counts,
            latency_breakdown=latency_breakdown,
            hybrid_score_avg=hybrid_score_avg,
            composio_score_avg=composio_score_avg,
        )

        self._emit_candidate_summary(
            mission_context,
            mission_mode,
            ranked,
        )

        self._emit_inspection_preview(ctx, mission_context, mission_mode)

        description = self._render_summary(mission_context, ranked)
        content = types.Content(role="system", parts=[types.Part(text=description)])
        yield Event(author=self.name, content=content)
        ctx.end_invocation = True

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _load_context(self, ctx: InvocationContext) -> MissionContext:
        raw = ctx.session.state.get(MISSION_CONTEXT_KEY, {})
        if isinstance(raw, dict):
            return MissionContext(
                mission_id=raw.get("mission_id", "mission-dry-run"),
                tenant_id=raw.get("tenant_id", "gate-ga-default"),
                objective=raw.get("objective", "Prove value in dry-run mode"),
                audience=raw.get("audience", "Pilot revenue team"),
                timeframe=raw.get("timeframe", "Next 14 days"),
                guardrails=raw.get("guardrails", []),
                mode=raw.get("mode", ctx.session.state.get("mission_mode", "dry_run")),
                metadata=raw.get("metadata", {}),
            )
        return MissionContext(
            mission_id="mission-dry-run",
            tenant_id="gate-ga-default",
            objective="Prove value in dry-run mode",
            audience="Pilot revenue team",
            timeframe="Next 14 days",
            guardrails=["Maintain professional tone"],
            mode=ctx.session.state.get("mission_mode", "dry_run"),
            metadata={},
        )

    def _rank_plays(
        self, mission_context: MissionContext, mission_mode: str
    ) -> Tuple[List[RankedPlay], Dict[str, Any]]:
        audience = mission_context.audience or "Pilot revenue team"

        metrics: Dict[str, Any] = {
            "library_latency_ms": 0,
            "composio_latency_ms": 0,
            "hybrid_score_avg": 0.0,
            "composio_score_avg": 0.0,
            "palette_catalog_size": 0,
        }

        library_started_at = time.perf_counter()
        try:
            library_rows = self.supabase.search_library_plays(
                tenant_id=mission_context.tenant_id,
                mission_id=mission_context.mission_id,
                objective=mission_context.objective,
                audience=audience,
                guardrails=mission_context.guardrails,
                limit=3,
            )
        except CatalogUnavailableError as exc:
            metadata = {
                "reason": str(exc) or "supabase_unavailable",
                "library_status": "unavailable",
                "candidate_count": 0,
            }
            self._emit_planner_status(
                mission_context,
                "catalog_unavailable",
                "Supabase library unavailable; planner halted",
                metadata,
            )
            raise CatalogUnavailableInterrupt(str(exc)) from exc
        metrics["library_latency_ms"] = int((time.perf_counter() - library_started_at) * 1000)

        self._emit_planner_status(
            mission_context,
            "library_query",
            f"Fetched {len(library_rows)} library plays for {audience} in {metrics['library_latency_ms']} ms",
            {
                "audience": audience,
                "objective": mission_context.objective[:80],
                "result_count": len(library_rows),
                "latency_ms": metrics["library_latency_ms"],
            },
        )

        composio_started_at = time.perf_counter()
        catalog = self.composio.get_tools(search=audience, limit=12) if self.composio else []
        metrics["composio_latency_ms"] = int((time.perf_counter() - composio_started_at) * 1000)
        ordered_toolkits, toolkit_catalog = self._prepare_toolkit_catalog(catalog)
        metrics["palette_catalog_size"] = len(toolkit_catalog)

        self._emit_planner_status(
            mission_context,
            "composio_discovery",
            (
                f"Discovered {len(ordered_toolkits)} toolkit references from Composio "
                f"in {metrics['composio_latency_ms']} ms"
            ),
            {
                "toolkit_count": len(ordered_toolkits),
                "toolkits": ordered_toolkits[:6],
                "latency_ms": metrics["composio_latency_ms"],
            },
        )

        all_scores_missing = (
            bool(toolkit_catalog)
            and all(not lookup.get("score_available", True) for lookup in toolkit_catalog.values())
        )
        if all_scores_missing:
            self._emit_planner_status(
                mission_context,
                "catalog_unavailable",
                "Composio toolkit catalog missing scores; planner halted",
                {
                    "reason": "composio_scores_missing",
                    "library_status": "available" if library_rows else "empty",
                    "composio_status": "score_missing",
                    "candidate_count": 0,
                    "toolkit_refs": [],
                },
            )
            raise CatalogUnavailableInterrupt(
                "Composio toolkit scores unavailable; cannot rank candidates"
            )

        if toolkit_catalog:
            if all(not lookup.get("score_available", True) for lookup in toolkit_catalog.values()):
                self._emit_planner_status(
                    mission_context,
                    "catalog_unavailable",
                    "Composio toolkit catalog missing scores; planner halted",
                    {
                        "reason": "composio_scores_missing",
                        "library_status": "available" if library_rows else "empty",
                        "composio_status": "score_missing",
                        "candidate_count": 0,
                        "toolkit_refs": [],
                    },
                )
                raise CatalogUnavailableInterrupt(
                    "Composio toolkit scores unavailable; cannot rank candidates"
                )

        candidates: List[RankedPlay] = []
        combined_scores: List[float] = []
        composio_scores: List[float] = []

        ranked_inputs: List[Dict[str, Any]] = []
        for index, row in enumerate(library_rows):
            metadata = row.get("metadata", {}) or {}
            similarity = float(row.get("_similarity", 0.6))
            toolkit_slice = self._select_toolkits(ordered_toolkits, index)
            palette = [
                toolkit_catalog[slug]["palette"]
                for slug in toolkit_slice
                if slug in toolkit_catalog and toolkit_catalog[slug].get("palette")
            ]
            composio_score = self._composio_score(toolkit_slice, toolkit_catalog)
            combined_score = self._hybrid_score(similarity, composio_score)

            ranked_inputs.append(
                {
                    "row": row,
                    "metadata": metadata,
                    "similarity": similarity,
                    "toolkits": toolkit_slice,
                    "palette": palette,
                    "composio_score": composio_score,
                    "combined_score": combined_score,
                    "seed_index": index,
                }
            )

        ranked_inputs.sort(
            key=lambda item: (
                -item["combined_score"],
                -item["similarity"],
                str(item["row"].get("title", "")),
                str(item["row"].get("id", "")),
                item.get("seed_index", 0),
            )
        )

        for position, item in enumerate(ranked_inputs):
            row = item["row"]
            metadata = item["metadata"]
            impact = metadata.get("impact") or self._impact_scale(position)
            risk = metadata.get("risk") or self._risk_scale(position)
            undo_plan = metadata.get("undo_plan") or "Document undo path via evidence service"
            similarity = item["similarity"]
            composio_score = item["composio_score"]
            combined_score = item["combined_score"]
            toolkit_slice = item["toolkits"] or self._select_toolkits(ordered_toolkits, position)
            palette = item["palette"]
            confidence = self._confidence(similarity, mission_mode, position)

            rationale = (
                f"Ranked #{position + 1} using library entry '{row.get('title', 'Unnamed play')}' "
                f"(hybrid_score={combined_score:.2f}, similarity={similarity:.2f})"
            )
            reason_markdown = self._build_reason_markdown(
                title=row.get("title"),
                similarity=similarity,
                toolkit_refs=toolkit_slice,
                impact=impact,
                risk=risk,
                undo_plan=undo_plan,
                guardrails=mission_context.guardrails,
                hybrid_score=combined_score,
                composio_score=composio_score,
            )

            toolkit_scores = {
                slug: round(float(toolkit_catalog.get(slug, {}).get("score", 0.0)), 4)
                for slug in toolkit_slice
                if slug
            }

            candidate = RankedPlay(
                title=row.get("title", f"Play {position + 1}"),
                description=row.get(
                    "description",
                    f"Tailor artifact for {audience} respecting mission guardrails",
                ),
                impact=impact,
                risk=risk,
                undo_plan=undo_plan,
                toolkit_refs=toolkit_slice,
                confidence=confidence,
                mission_id=mission_context.mission_id,
                tenant_id=mission_context.tenant_id,
                mode=mission_mode,
                play_id=str(row.get("id")) if row.get("id") else None,
                rationale=rationale,
                reason_markdown=reason_markdown,
                telemetry={
                    "library_entry_id": row.get("id"),
                    "similarity": similarity,
                    "combined_score": combined_score,
                    "composio_score": composio_score,
                    "success_score": row.get("success_score"),
                    "persona": row.get("persona"),
                    "reason_excerpt": reason_markdown[:200],
                    "toolkit_scores": toolkit_scores,
                    "palette": palette,
                },
            )

            candidates.append(candidate)
            combined_scores.append(combined_score)
            composio_scores.append(composio_score)

            self._emit_planner_status(
                mission_context,
                "candidate_ranked",
                f"Ranked candidate #{position + 1}: {row.get('title', 'Unnamed play')}",
                {
                    "position": position + 1,
                    "title": row.get("title"),
                    "similarity": similarity,
                    "combined_score": round(combined_score, 3),
                    "composio_score": round(composio_score, 3),
                    "confidence": confidence,
                    "toolkit_count": len(toolkit_slice),
                    "play_id": row.get("id"),
                    "palette_refs": [p.get("slug") for p in palette][:3],
                },
            )

        if not candidates:
            catalog_empty_metadata = {
                "reason": "library_and_composio_empty"
                if not ranked_inputs and not ordered_toolkits
                else "library_empty",
                "library_status": "empty" if not ranked_inputs else "partial",
                "composio_status": "empty" if not ordered_toolkits else "partial",
                "candidate_count": 0,
                "toolkit_refs": [],
            }

            self._emit_planner_status(
                mission_context,
                "catalog_empty",
                "Planner catalog empty: awaiting curated library or toolkit selection",
                catalog_empty_metadata,
            )

            raise CatalogEmptyInterrupt(
                (
                    "Planner catalog empty: no library plays or Composio toolkits available. "
                    "Ensure library entries exist or select toolkits before continuing."
                )
            )

        if combined_scores:
            metrics["hybrid_score_avg"] = sum(combined_scores) / len(combined_scores)
        if composio_scores:
            metrics["composio_score_avg"] = sum(composio_scores) / len(composio_scores)

        return candidates, metrics

    def _persist_rankings(
        self, mission_context: MissionContext, ranked: List[RankedPlay]
    ) -> None:
        payload: List[Dict[str, Optional[str]]] = []
        for position, play in enumerate(ranked, start=1):
            play_dict = asdict(play)
            payload.append(
                {
                    "objective_id": mission_context.mission_id,
                    "tenant_id": play.tenant_id,
                    "mode": play.mode,
                    "title": play.title,
                    "impact_estimate": play.impact,
                    "risk_profile": play.risk,
                    "undo_plan": play.undo_plan,
                    "confidence": play.confidence,
                    "plan_json": play_dict,
                    "telemetry": {
                        "position": position,
                        "tool_count": len(play.toolkit_refs),
                        **play.telemetry,
                    },
                }
            )

        self.supabase.upsert_plays(payload)

    def _session_identifier(self, context: MissionContext) -> str:
        metadata = context.metadata or {}
        session_identifier = (
            metadata.get("session_identifier") if isinstance(metadata, dict) else None
        )
        return str(session_identifier) if session_identifier else context.mission_id

    def _emit_stage_started(
        self,
        context: MissionContext,
        mission_mode: str,
    ) -> None:
        if not self.streamer:
            return
        self.streamer.emit_stage(
            tenant_id=context.tenant_id,
            session_identifier=self._session_identifier(context),
            stage="planner_stage_started",
            event="stage_started",
            content="Planner stage started: ranking candidate plays",
            mission_id=context.mission_id,
            mission_status="in_progress",
            metadata={
                "mode": mission_mode,
                "objective": context.objective[:100],
                "audience": context.audience,
            },
        )

    def _emit_planner_status(
        self,
        context: MissionContext,
        status_type: str,
        message: str,
        metadata: Dict[str, Any],
    ) -> None:
        if not self.streamer:
            return
        self.streamer.emit_stage(
            tenant_id=context.tenant_id,
            session_identifier=self._session_identifier(context),
            stage="planner_status",
            event="status_update",
            content=message,
            mission_id=context.mission_id,
            mission_status="in_progress",
            metadata={
                "status_type": status_type,
                **metadata,
            },
        )

    def _emit_rank_complete(
        self,
        context: MissionContext,
        mission_mode: str,
        ranked: List[RankedPlay],
        *,
        latency_ms: int,
        avg_similarity: float,
        toolkit_counts: Dict[str, int],
        latency_breakdown: Dict[str, int],
        hybrid_score_avg: float,
        composio_score_avg: float,
    ) -> None:
        if not self.streamer:
            return
        primary_toolkits = sorted(toolkit_counts.items(), key=lambda x: x[1], reverse=True)[:3]

        self.streamer.emit_stage(
            tenant_id=context.tenant_id,
            session_identifier=self._session_identifier(context),
            stage="planner_rank_complete",
            event="rank_complete",
            content=f"Ranking complete: {len(ranked)} candidate plays prepared",
            mission_id=context.mission_id,
            mission_status="in_progress",
            metadata={
                "mode": mission_mode,
                "candidate_count": len(ranked),
                "average_similarity": round(avg_similarity, 2),
                "primary_toolkits": [tk[0] for tk in primary_toolkits],
                "toolkit_counts": toolkit_counts,
                "latency_ms": latency_ms,
                "latency_breakdown": latency_breakdown,
                "hybrid_score_avg": round(hybrid_score_avg, 3),
                "composio_score_avg": round(composio_score_avg, 3),
            },
        )

    def _emit_candidate_summary(
        self,
        context: MissionContext,
        mission_mode: str,
        ranked: List[RankedPlay],
    ) -> None:
        if not self.streamer or not ranked:
            return

        top = ranked[0]
        self.streamer.emit_stage(
            tenant_id=context.tenant_id,
            session_identifier=self._session_identifier(context),
            stage="planner_candidate_summary",
            event="candidate_summary",
            content=f"Top candidate: {top.title} ({top.impact} impact)",
            mission_id=context.mission_id,
            mission_status="in_progress",
            metadata={
                "title": top.title,
                "impact": top.impact,
                "risk": top.risk,
                "confidence": top.confidence,
                "toolkits": top.toolkit_refs,
                "reason_markdown": top.reason_markdown,
                "mode": mission_mode,
            },
        )

    def _prepare_toolkit_catalog(
        self, catalog: List[Dict[str, Any]]
    ) -> Tuple[List[str], Dict[str, Dict[str, Any]]]:
        ordered: List[str] = []
        lookup: Dict[str, Dict[str, Any]] = {}

        for position, entry in enumerate(catalog):
            slug = entry.get("toolkit") or entry.get("slug")
            if not slug:
                continue
            if slug in lookup:
                continue

            score_available = bool(entry.get("score_available", True))
            score = entry.get("score")
            try:
                score_val = float(score) if score is not None else 0.0
            except (TypeError, ValueError):
                score_val = 0.0
            score_val = max(0.0, min(score_val, 1.0))

            palette = entry.get("palette") or {}
            if not isinstance(palette, dict):
                palette = {}
            palette.setdefault("slug", slug)
            palette.setdefault("toolkit", slug)
            palette.setdefault("name", entry.get("name", slug))

            lookup[slug] = {
                "score": score_val,
                "palette": palette,
                "position": position,
                "score_available": score_available,
            }
            ordered.append(slug)
        return ordered, lookup

    @staticmethod
    def _select_toolkits(toolkits: List[str], index: int, *, per_candidate: int = 2) -> List[str]:
        if not toolkits:
            return []
        start = index * per_candidate
        slice_refs = toolkits[start : start + per_candidate]
        if slice_refs:
            return slice_refs
        return toolkits[:per_candidate]

    @staticmethod
    def _composio_score(
        toolkit_refs: List[str], catalog: Dict[str, Dict[str, Any]]
    ) -> float:
        if not toolkit_refs:
            return 0.3
        scores = [float(catalog.get(ref, {}).get("score", 0.3)) for ref in toolkit_refs if ref]
        if not scores:
            return 0.3
        return sum(scores) / len(scores)

    @staticmethod
    def _hybrid_score(similarity: float, composio_score: float) -> float:
        similarity_clamped = max(0.0, min(float(similarity), 1.0))
        composio_clamped = max(0.0, min(float(composio_score), 1.0))
        return round((0.65 * similarity_clamped) + (0.35 * composio_clamped), 4)

    def _build_reason_markdown(
        self,
        *,
        title: Optional[str],
        similarity: float,
        toolkit_refs: List[str],
        impact: str,
        risk: str,
        undo_plan: str,
        guardrails: List[str],
        hybrid_score: Optional[float] = None,
        composio_score: Optional[float] = None,
    ) -> str:
        name = title or "Recommended play"
        toolkits = ", ".join(toolkit_refs) if toolkit_refs else "—"
        guardrail_summary = ", ".join(guardrails[:3]) if guardrails else "—"
        lines = [
            f"### Why “{name}”",
        ]

        if hybrid_score is not None:
            if composio_score is not None:
                lines.append(
                    f"- **Hybrid score**: {hybrid_score:.2f} (similarity={similarity:.2f}, composio={composio_score:.2f})"
                )
            else:
                lines.append(
                    f"- **Hybrid score**: {hybrid_score:.2f} (similarity={similarity:.2f})"
                )
        lines.append(f"- **Similarity**: {similarity:.2f} match to the mission objective")
        if composio_score is not None:
            lines.append(
                f"- **Composio discovery**: {composio_score:.2f} average toolkit score"
            )
        lines.extend(
            [
            f"- **Toolkits**: {toolkits}",
            f"- **Impact**: {impact}",
            f"- **Risk**: {risk}",
            f"- **Undo plan**: {undo_plan}",
            f"- **Guardrail focus**: {guardrail_summary}",
            ]
        )
        return "\n".join(lines)

    @staticmethod
    def _impact_scale(index: int) -> str:
        return ["High", "Medium", "Medium"][index % 3]

    @staticmethod
    def _risk_scale(index: int) -> str:
        return ["Low", "Moderate", "Low"][index % 3]

    @staticmethod
    def _confidence(similarity: float, mission_mode: str, index: int) -> float:
        base = 0.65 if mission_mode == "dry_run" else 0.55
        adjustment = min(max(similarity, 0.0), 1.0) * 0.25
        rank_penalty = 0.06 * index
        confidence = base + adjustment - rank_penalty
        return round(max(min(confidence, 0.95), 0.4), 2)

    @staticmethod
    def _toolkit_counts(ranked: List[RankedPlay]) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for play in ranked:
            for ref in play.toolkit_refs:
                if not ref:
                    continue
                counts[ref] = counts.get(ref, 0) + 1
        return counts

    def _record_planner_run(
        self,
        *,
        context: MissionContext,
        mission_mode: str,
        ranked: List[RankedPlay],
        latency_ms: int,
        avg_similarity: float,
        toolkit_counts: Dict[str, int],
        library_latency_ms: int,
        composio_latency_ms: int,
        hybrid_score_avg: float,
        composio_score_avg: float,
    ) -> None:
        if not self.supabase or not self.supabase.enabled:
            return

        primary_toolkits = [
            toolkit
            for toolkit, _ in sorted(
                toolkit_counts.items(), key=lambda item: item[1], reverse=True
            )[:3]
        ]

        try:
            self.supabase.insert_planner_run(
                {
                    "tenant_id": context.tenant_id,
                    "mission_id": context.mission_id,
                    "latency_ms": latency_ms,
                    "candidate_count": len(ranked),
                    "embedding_similarity_avg": round(avg_similarity, 4)
                    if ranked
                    else None,
                    "primary_toolkits": primary_toolkits or None,
                    "mode": mission_mode,
                    "metadata": {
                        "objective": context.objective[:120],
                        "audience": context.audience,
                        "guardrails": context.guardrails[:5],
                        "latency_breakdown": {
                            "library_query_ms": library_latency_ms,
                            "composio_discovery_ms": composio_latency_ms,
                        },
                        "hybrid_score_avg": round(hybrid_score_avg, 4)
                        if ranked
                        else None,
                        "composio_score_avg": round(composio_score_avg, 4)
                        if ranked
                        else None,
                    },
                }
            )
        except Exception:  # pragma: no cover - defensive in offline/dev mode
            LOGGER.debug("Skipping planner_runs insert due to Supabase error", exc_info=True)

    @staticmethod
    def _render_summary(
        mission_context: MissionContext, ranked: List[RankedPlay]
    ) -> str:
        if not ranked:
            return "Planner completed with no candidate plays"

        top = ranked[0]
        details = (
            f"Top play: {top.title} (impact={top.impact}, risk={top.risk}, "
            f"confidence={top.confidence}). Total candidates={len(ranked)}."
        )
        return (
            f"Planner completed for mission {mission_context.mission_id}. "
            f"{details}"
        )

    # ------------------------------------------------------------------
    # Inspection preview
    # ------------------------------------------------------------------
    def _emit_inspection_preview(
        self,
        ctx: InvocationContext,
        mission_context: MissionContext,
        mission_mode: str,
    ) -> None:
        previews = self._build_inspection_preview(mission_context)
        if not previews:
            return

        payload = [asdict(item) for item in previews]
        ctx.session.state[INSPECTION_PREVIEW_KEY] = {
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "toolkits": payload,
        }

        self.telemetry.emit(
            "inspection_preview_rendered",
            tenant_id=mission_context.tenant_id,
            mission_id=mission_context.mission_id,
            payload={
                "selected_count": len(previews),
                "toolkits": payload,
                "mode": mission_mode,
            },
        )

        self._stream_inspection_preview(mission_context, previews)

    def _build_inspection_preview(
        self, mission_context: MissionContext
    ) -> List[InspectionPreview]:
        rows = self.supabase.fetch_safeguards(
            mission_id=mission_context.mission_id,
            tenant_id=mission_context.tenant_id,
            limit=20,
        )

        previews: List[InspectionPreview] = []
        for row in rows:
            if row.get("hint_type") != "toolkit_recommendation":
                continue
            suggested = row.get("suggested_value")
            if not isinstance(suggested, dict):
                continue

            slug = str(suggested.get("slug") or "").strip()
            if not slug:
                continue

            name = str(suggested.get("name") or slug).strip()
            auth_type = str(suggested.get("authType") or "oauth").strip() or "oauth"
            category = str(suggested.get("category") or "general").strip() or "general"
            no_auth = bool(suggested.get("noAuth", auth_type == "none"))

            sample_count = self._sample_count(slug)
            sample_rows = [
                f"{name} sample #{index + 1} (draft preview)"
                for index in range(sample_count)
            ]

            previews.append(
                InspectionPreview(
                    slug=slug,
                    name=name,
                    auth_type="none" if no_auth else auth_type,
                    sample_rows=sample_rows,
                    sample_count=sample_count,
                    no_auth=no_auth,
                    category=category,
                )
            )

        return previews

    @staticmethod
    def _sample_count(slug: str) -> int:
        digest = hashlib.sha1(slug.encode("utf-8")).hexdigest()
        return 2 + (int(digest[:2], 16) % 3)

    def _stream_inspection_preview(
        self, context: MissionContext, previews: List[InspectionPreview]
    ) -> None:
        if not self.streamer:
            return

        summary = ", ".join(
            f"{preview.name} ({preview.sample_count} sample{'s' if preview.sample_count != 1 else ''})"
            for preview in previews
        )
        metadata = {
            "stage": "inspection_preview_rendered",
            "toolkits": [asdict(item) for item in previews],
        }
        message = f"Inspection preview ready: {summary}."
        self.streamer.emit_message(
            tenant_id=context.tenant_id,
            session_identifier=self._session_identifier(context),
            role="assistant",
            content=message,
            metadata=metadata,
        )
