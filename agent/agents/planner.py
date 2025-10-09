"""Planner agent responsible for ranking candidate plays."""

from __future__ import annotations

from dataclasses import asdict
from typing import Any, AsyncGenerator, Dict, List, Optional

from google.adk.agents import LlmAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events.event import Event
from google.genai import types

from pydantic import Field

from ..services import CopilotKitStreamer, SupabaseClient, TelemetryEmitter
from ..tools.composio_client import ComposioCatalogClient
from .state import (
    MissionContext,
    RankedPlay,
    MISSION_CONTEXT_KEY,
    RANKED_PLAYS_KEY,
    SELECTED_PLAY_KEY,
)


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
        ranked = self._rank_plays(mission_context, mission_mode)

        ctx.session.state[RANKED_PLAYS_KEY] = [asdict(play) for play in ranked]
        if ranked:
            ctx.session.state[SELECTED_PLAY_KEY] = asdict(ranked[0])

        self._persist_rankings(mission_context, ranked)
        self.telemetry.emit(
            "planner_rank_complete",
            tenant_id=mission_context.tenant_id,
            mission_id=mission_context.mission_id,
            payload={
                "mode": mission_mode,
                "candidate_count": len(ranked),
                "toolkits": self._toolkit_counts(ranked),
                "library_entries": [
                    play.telemetry.get("library_entry_id") for play in ranked
                ],
            },
        )

        self._emit_stream(
            mission_context,
            "planner_rank_complete",
            {
                "mode": mission_mode,
                "candidate_count": len(ranked),
                "toolkits": self._toolkit_counts(ranked),
            },
        )

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
    ) -> List[RankedPlay]:
        audience = mission_context.audience or "Pilot revenue team"
        library_rows = self.supabase.search_library_plays(
            tenant_id=mission_context.tenant_id,
            mission_id=mission_context.mission_id,
            objective=mission_context.objective,
            audience=audience,
            guardrails=mission_context.guardrails,
            limit=3,
        )

        toolkit_refs = self._toolkit_refs(audience)
        candidates: List[RankedPlay] = []

        for index, row in enumerate(library_rows):
            metadata = row.get("metadata", {}) or {}
            impact = metadata.get("impact") or self._impact_scale(index)
            risk = metadata.get("risk") or self._risk_scale(index)
            undo_plan = metadata.get("undo_plan") or "Document undo path via evidence service"
            similarity = float(row.get("_similarity", 0.6))
            confidence = self._confidence(similarity, mission_mode, index)
            toolkit_slice = toolkit_refs[index * 2 : index * 2 + 2] or toolkit_refs[:2]

            rationale = (
                f"Ranked #{index + 1} using library entry '{row.get('title', 'Unnamed play')}' "
                f"(similarity={similarity:.2f}) with {len(toolkit_slice)} toolkit refs"
            )

            candidates.append(
                RankedPlay(
                    title=row.get("title", f"Play {index + 1}"),
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
                    telemetry={
                        "library_entry_id": row.get("id"),
                        "similarity": similarity,
                        "success_score": row.get("success_score"),
                        "persona": row.get("persona"),
                    },
                )
            )

        if not candidates:
            fallback = RankedPlay(
                title=f"Dry-run scaffolding for {audience}",
                description=(
                    "Generate baseline artifact demonstrating guardrail adherence "
                    "while awaiting curated library plays."
                ),
                impact="Medium",
                risk="Low",
                undo_plan="Manual review only",
                toolkit_refs=toolkit_refs[:2],
                confidence=self._confidence(0.5, mission_mode, 0),
                mission_id=mission_context.mission_id,
                tenant_id=mission_context.tenant_id,
                mode=mission_mode,
                rationale="Fallback play generated due to missing library entries",
                telemetry={"fallback": True},
            )
            candidates.append(fallback)

        return candidates

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

    def _emit_stream(
        self,
        context: MissionContext,
        stage: str,
        metadata: Dict[str, Any],
    ) -> None:
        if not self.streamer:
            return
        message = (
            f"{stage.replace('_', ' ').title()}: {metadata.get('candidate_count', 0)} "
            f"candidate plays prepared."
        )
        self.streamer.emit_message(
            tenant_id=context.tenant_id,
            session_identifier=self._session_identifier(context),
            role="assistant",
            content=message,
            metadata={"stage": stage, **metadata},
        )

    def _toolkit_refs(self, audience: str) -> List[str]:
        tools = self.composio.get_tools(search=audience)[:6]
        refs = [tool.get("toolkit") or tool.get("slug", "") for tool in tools]
        cleaned = [ref for ref in refs if ref]
        if not cleaned:
            cleaned = ["google_docs", "sheets", "gmail"]
        return cleaned

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
