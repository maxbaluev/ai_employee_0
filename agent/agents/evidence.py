"""EvidenceAgent packages artifacts and library contributions for Stage 6."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, Iterable, List, Sequence
from uuid import uuid4

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai.types import Content, Part

from agent.services import ComposioClientWrapper, SupabaseClientWrapper, TelemetryClient


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sha256(content: Any) -> str:
    if isinstance(content, bytes):
        payload = content
    elif isinstance(content, str):
        payload = content.encode("utf-8")
    else:
        payload = json.dumps(content, default=str, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _as_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return json.dumps(value, default=str)


@dataclass(slots=True)
class ArtifactMetadata:
    """Metadata describing an evidence artifact stored for a mission."""

    artifact_id: str
    artifact_type: str
    name: str
    hash: str
    redaction_state: str
    storage_path: str | None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "artifact_id": self.artifact_id,
            "artifact_type": self.artifact_type,
            "name": self.name,
            "hash": self.hash,
            "redaction_state": self.redaction_state,
            "storage_path": self.storage_path,
            "metadata": dict(self.metadata),
        }


@dataclass(slots=True)
class EvidenceBundle:
    """Aggregate evidence package generated for a mission execution."""

    bundle_id: str
    mission_id: str
    generated_at: str
    artifacts: List[ArtifactMetadata]
    roi_metrics: Dict[str, Any]
    safeguard_outcomes: List[Dict[str, Any]]
    undo_hints: List[Dict[str, Any]]
    manifest_hash: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "bundle_id": self.bundle_id,
            "mission_id": self.mission_id,
            "generated_at": self.generated_at,
            "artifacts": [artifact.to_dict() for artifact in self.artifacts],
            "roi_metrics": dict(self.roi_metrics),
            "safeguard_outcomes": list(self.safeguard_outcomes),
            "undo_hints": list(self.undo_hints),
            "manifest_hash": self.manifest_hash,
        }


@dataclass(slots=True)
class LibraryContribution:
    """Candidate library contribution recorded during Reflect stage."""

    title: str
    summary: str
    play_id: str | None
    rating: float | None
    reuse_potential_score: float
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "summary": self.summary,
            "play_id": self.play_id,
            "rating": self.rating,
            "reuse_potential_score": self.reuse_potential_score,
            "tags": list(self.tags),
        }


class EvidenceAgent(BaseAgent):
    """Gemini ADK agent producing evidence bundles for Stages 5-6."""

    def __init__(
        self,
        *,
        name: str,
        supabase_client: SupabaseClientWrapper | None = None,
        composio_client: ComposioClientWrapper | None = None,
        telemetry: TelemetryClient | None = None,
        library_rating_threshold: float = 4.0,
        **kwargs: Any,
    ) -> None:
        super().__init__(name=name, sub_agents=[], **kwargs)
        object.__setattr__(self, "_supabase", supabase_client)
        object.__setattr__(self, "_composio", composio_client)
        object.__setattr__(self, "_telemetry", telemetry)
        object.__setattr__(self, "_library_rating_threshold", max(0.0, library_rating_threshold))

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------
    @property
    def supabase(self) -> SupabaseClientWrapper | None:
        return getattr(self, "_supabase", None)

    @property
    def composio(self) -> ComposioClientWrapper | None:
        return getattr(self, "_composio", None)

    @property
    def telemetry(self) -> TelemetryClient | None:
        return getattr(self, "_telemetry", None)

    @property
    def library_rating_threshold(self) -> float:
        return getattr(self, "_library_rating_threshold", 4.0)

    # ------------------------------------------------------------------
    # Core execution
    # ------------------------------------------------------------------
    async def _run_async_impl(
        self,
        ctx: InvocationContext,
    ) -> AsyncGenerator[Event, None]:
        if not self._ensure_mission_context(ctx):
            yield self._error_event(ctx, "Missing mission context (mission_id, tenant_id, user_id).")
            return

        mission_id = ctx.session.state["mission_id"]
        tenant_id = ctx.session.state.get("tenant_id")
        user_id = ctx.session.state.get("user_id")

        execution_results = self._normalise_execution_results(
            ctx.session.state.get("execution_results", []),
        )
        undo_plans = self._normalise_undo_plans(ctx.session.state.get("undo_plans", []))
        safeguard_outcomes = self._collect_safeguard_outcomes(execution_results)

        audit_events = await self._fetch_audit_events(mission_id=mission_id, tenant_id=tenant_id)
        undo_hints = self._build_undo_hints(execution_results, undo_plans, audit_events)

        artifacts = await self._persist_artifacts(
            mission_id=mission_id,
            tenant_id=tenant_id,
            execution_results=execution_results,
        )

        roi_metrics = self._compute_roi(execution_results)
        manifest_hash = _sha256([artifact.hash for artifact in artifacts])

        bundle = EvidenceBundle(
            bundle_id=str(uuid4()),
            mission_id=mission_id,
            generated_at=_now_iso(),
            artifacts=artifacts,
            roi_metrics=roi_metrics,
            safeguard_outcomes=safeguard_outcomes,
            undo_hints=undo_hints,
            manifest_hash=manifest_hash,
        )

        await self._store_evidence_record(bundle=bundle)

        library_contributions = await self._maybe_generate_library_contributions(
            ctx=ctx,
            bundle=bundle,
        )

        ctx.session.state["evidence_bundles"] = [bundle.to_dict()]
        if undo_hints:
            ctx.session.state["rollback_instructions"] = list(undo_hints)
        if library_contributions:
            ctx.session.state["library_contributions"] = [item.to_dict() for item in library_contributions]

        self._emit_telemetry(
            "evidence_bundle_generated",
            {
                "mission_id": mission_id,
                "artifact_count": len(bundle.artifacts),
                "roi": roi_metrics,
            },
        )

        for contribution in library_contributions:
            self._emit_telemetry(
                "library_contribution",
                {
                    "mission_id": mission_id,
                    "title": contribution.title,
                    "score": contribution.reuse_potential_score,
                },
            )

        yield self._info_event(
            ctx,
            "Evidence bundle generated with %d artifacts." % len(bundle.artifacts),
            metadata={"type": "info", "stage": "REFLECT"},
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _ensure_mission_context(self, ctx: InvocationContext) -> bool:
        required = {"mission_id", "tenant_id", "user_id"}
        return required.issubset(ctx.session.state.keys())

    def _normalise_execution_results(self, results: Any) -> List[Dict[str, Any]]:
        normalised: List[Dict[str, Any]] = []
        if not results:
            return normalised
        if isinstance(results, dict):
            results = [results]
        for index, item in enumerate(results):
            if not isinstance(item, dict):
                continue
            payload = dict(item)
            payload.setdefault("action_id", payload.get("id") or f"action-{index}")
            payload.setdefault("artifact_type", payload.get("artifact_type") or "tool_output")
            payload.setdefault("name", payload.get("name") or payload.get("title") or payload["action_id"])
            normalised.append(payload)
        return normalised

    def _normalise_undo_plans(self, plans: Any) -> Dict[str, Dict[str, Any]]:
        if not plans:
            return {}
        mapping: Dict[str, Dict[str, Any]] = {}
        items: Sequence[Any]
        if isinstance(plans, dict):
            items = plans.values()
        else:
            items = plans
        for item in items:
            if not isinstance(item, dict):
                continue
            undo_id = _as_str(item.get("undo_id") or item.get("id") or item.get("label"))
            if not undo_id:
                continue
            mapping[undo_id] = dict(item)
        return mapping

    def _collect_safeguard_outcomes(self, execution_results: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
        outcomes: List[Dict[str, Any]] = []
        for item in execution_results:
            for safeguard in item.get("safeguard_results", []) or []:
                if isinstance(safeguard, dict):
                    outcomes.append(dict(safeguard))
        return outcomes

    async def _fetch_audit_events(
        self,
        *,
        mission_id: str,
        tenant_id: str | None,
    ) -> List[Dict[str, Any]]:
        if self.composio is None:
            return []
        try:
            events = await self.composio.audit_list_events(
                mission_id=mission_id,
                tenant_id=tenant_id,
            )
        except Exception:
            return []
        if not events:
            return []
        if isinstance(events, dict):
            return [events]
        return [dict(event) for event in events if isinstance(event, dict)]

    def _build_undo_hints(
        self,
        execution_results: Sequence[Dict[str, Any]],
        undo_plans: Dict[str, Dict[str, Any]],
        audit_events: Sequence[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        hints: List[Dict[str, Any]] = []
        audit_lookup: Dict[str, List[Dict[str, Any]]] = {}
        for event in audit_events:
            action_id = _as_str(event.get("action_id") or event.get("tool_call_id"))
            if not action_id:
                continue
            audit_lookup.setdefault(action_id, []).append(event)

        for item in execution_results:
            action_id = _as_str(item.get("action_id"))
            if not action_id:
                continue
            plan_ref = item.get("undo_plan_id") or item.get("undo_id")
            rollback = undo_plans.get(_as_str(plan_ref)) if plan_ref else None
            audit_hint = audit_lookup.get(action_id, [])
            if rollback or audit_hint:
                hints.append(
                    {
                        "action_id": action_id,
                        "undo_plan": rollback,
                        "audit_events": audit_hint,
                    }
                )
        return hints

    async def _persist_artifacts(
        self,
        *,
        mission_id: str,
        tenant_id: str | None,
        execution_results: Sequence[Dict[str, Any]],
    ) -> List[ArtifactMetadata]:
        artifacts: List[ArtifactMetadata] = []
        for index, item in enumerate(execution_results):
            content = item.get("artifact") or item.get("output") or item.get("result")
            resource_hash = _sha256(content or {"status": item.get("status")})
            storage_path = item.get("storage_path") or f"evidence/{mission_id}/{item['action_id']}.json"
            redaction_state = _as_str(
                item.get("redaction_state")
                or item.get("redaction", {}).get("status")
                or "pending_review"
            )

            payload = {
                "mission_id": mission_id,
                "artifact_type": item.get("artifact_type", "tool_output"),
                "name": item.get("name") or f"Artifact {index + 1}",
                "description": item.get("description"),
                "source_stage": "EXECUTE",
                "storage_path": storage_path,
                "storage_provider": item.get("storage_provider") or "supabase",
                "hash": resource_hash,
                "metadata": item.get("metadata") or {},
                "redaction_state": redaction_state,
                "tenant_id": tenant_id,
            }

            stored = await self._store_artifact(payload, content)
            artifacts.append(
                ArtifactMetadata(
                    artifact_id=stored.get("id", str(uuid4())),
                    artifact_type=stored.get("artifact_type", "tool_output"),
                    name=stored.get("name", payload["name"]),
                    hash=stored.get("hash", resource_hash),
                    redaction_state=stored.get("redaction_state", redaction_state),
                    storage_path=stored.get("storage_path"),
                    metadata=stored.get("metadata", payload["metadata"]),
                )
            )
        return artifacts

    async def _store_artifact(self, payload: Dict[str, Any], content: Any) -> Dict[str, Any]:
        if self.supabase is None:
            fallback = dict(payload)
            fallback.setdefault("id", str(uuid4()))
            return fallback
        try:
            return await self.supabase.store_artifact(payload=payload, raw_content=content)
        except Exception:
            fallback = dict(payload)
            fallback.setdefault("id", str(uuid4()))
            return fallback

    async def _store_evidence_record(self, bundle: EvidenceBundle) -> None:
        if self.supabase is None:
            return
        try:
            await self.supabase.store_evidence(bundle=bundle.to_dict())
        except Exception:
            return

    async def _maybe_generate_library_contributions(
        self,
        *,
        ctx: InvocationContext,
        bundle: EvidenceBundle,
    ) -> List[LibraryContribution]:
        rating = await self._fetch_feedback_rating(ctx)
        if rating is None or rating < self.library_rating_threshold:
            return []

        ranked_plays = ctx.session.state.get("ranked_plays") or []
        top_play = ranked_plays[0] if ranked_plays else {}
        contribution = LibraryContribution(
            title=top_play.get("title") or "Mission Play",
            summary=bundle.roi_metrics.get("summary")
            or top_play.get("summary")
            or "Mission generated high-quality artifacts and undo coverage.",
            play_id=top_play.get("id"),
            rating=rating,
            reuse_potential_score=min(1.0, max(0.0, rating / 5.0)),
            tags=["mission", "evidence", top_play.get("category", "automation")],
        )

        await self._store_library_contribution(contribution=contribution, mission_id=bundle.mission_id)
        return [contribution]

    async def _store_library_contribution(
        self,
        *,
        contribution: LibraryContribution,
        mission_id: str,
    ) -> None:
        if self.supabase is None:
            return
        try:
            await self.supabase.store_library_contribution(
                mission_id=mission_id,
                contribution=contribution.to_dict(),
            )
        except Exception:
            return

    async def _fetch_feedback_rating(self, ctx: InvocationContext) -> float | None:
        rating = ctx.session.state.get("feedback", {}).get("rating")
        if isinstance(rating, (int, float)):
            return float(rating)
        if self.supabase is None:
            return None
        try:
            return await self.supabase.fetch_feedback_rating(mission_id=ctx.session.state["mission_id"])
        except Exception:
            return None

    def _compute_roi(self, execution_results: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
        records_touched = 0
        time_saved_hours = 0.0
        automated_actions = 0
        total_actions = 0

        for item in execution_results:
            metrics = item.get("metrics") or {}
            records_touched += int(metrics.get("records_touched", 0))
            time_saved_hours += float(metrics.get("time_saved_hours", 0.0))
            automated_actions += int(metrics.get("automated_actions", metrics.get("actions", 0)))
            total_actions += int(metrics.get("total_actions", metrics.get("actions", 0)))

        automation_ratio = None
        if total_actions > 0:
            automation_ratio = min(1.0, automated_actions / max(1, total_actions))

        summary_parts = []
        if records_touched:
            summary_parts.append(f"Touched {records_touched} records")
        if time_saved_hours:
            summary_parts.append(f"Saved {time_saved_hours:.1f} hours")
        if automation_ratio is not None:
            summary_parts.append(f"Automation ratio {automation_ratio:.0%}")

        return {
            "records_touched": records_touched,
            "time_saved_hours": round(time_saved_hours, 3),
            "automation_ratio": automation_ratio,
            "summary": "; ".join(summary_parts) if summary_parts else "Mission completed successfully.",
        }

    def _emit_telemetry(self, event_name: str, payload: Dict[str, Any]) -> None:
        if self.telemetry is None:
            return
        try:
            self.telemetry.emit(event_name, payload)
        except Exception:
            return

    def _info_event(
        self,
        ctx: InvocationContext,
        message: str,
        metadata: Dict[str, Any],
    ) -> Event:
        return self._make_event(ctx, message=message, metadata=metadata)

    def _error_event(self, ctx: InvocationContext, message: str) -> Event:
        return self._make_event(ctx, message=message, metadata={"type": "error", "stage": "REFLECT"})

    def _make_event(
        self,
        ctx: InvocationContext,
        *,
        message: str,
        metadata: Dict[str, Any],
    ) -> Event:
        content = Content(role="assistant", parts=[Part(text=message)])
        return Event(
            author=self.name,
            invocationId=getattr(ctx, "invocation_id", ""),
            content=content,
            customMetadata=metadata,
        )


__all__ = [
    "EvidenceAgent",
    "EvidenceBundle",
    "ArtifactMetadata",
    "LibraryContribution",
]

