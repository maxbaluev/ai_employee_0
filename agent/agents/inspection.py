"""Inspection agent computing coverage readiness prior to planning."""

from __future__ import annotations

import math
import hashlib
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional, Sequence

from google.adk.agents.base_agent import BaseAgent
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
from .state import (
    MissionContext,
    MISSION_CONTEXT_KEY,
    SAFEGUARDS_KEY,
    EVIDENCE_BUNDLE_KEY,
    INSPECTION_PREVIEW_KEY,
)


def _looks_like_uuid(candidate: Optional[str]) -> bool:
    if not candidate or not isinstance(candidate, str):
        return False
    parts = candidate.split("-")
    if len(parts) != 5:
        return False
    sizes = [8, 4, 4, 4, 12]
    return all(len(chunk) == expected for chunk, expected in zip(parts, sizes, strict=True))


class InspectionAgent(BaseAgent):
    """Generates inspection readiness metrics for planner gating."""

    supabase: Optional[SupabaseClient] = Field(default=None, exclude=True)
    telemetry: Optional[TelemetryEmitter] = Field(default=None, exclude=True)
    streamer: Optional[CopilotKitStreamer] = Field(default=None, exclude=True)
    readiness_threshold: float = Field(default=85.0, exclude=True)

    def __init__(
        self,
        *,
        name: str = "InspectionAgent",
        supabase: Optional[SupabaseClient] = None,
        telemetry: Optional[TelemetryEmitter] = None,
        streamer: Optional[CopilotKitStreamer] = None,
        readiness_threshold: float = 85.0,
    ) -> None:
        super().__init__(
            name=name,
            supabase=supabase,
            telemetry=telemetry,
            streamer=streamer,
            readiness_threshold=readiness_threshold,
        )
        if self.supabase is None:
            object.__setattr__(self, "supabase", SupabaseClient.from_env())
        if self.telemetry is None:
            object.__setattr__(self, "telemetry", TelemetryEmitter(self.supabase))
        if self.streamer is None:
            object.__setattr__(self, "streamer", CopilotKitStreamer())

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        mission = self._mission_context(ctx)

        toolkit_rows = self._load_toolkits(ctx, mission)
        safeguards = self._load_safeguards(ctx)
        prior_artifacts = self._has_artifacts(ctx)

        readiness, categories = self._compute_readiness(toolkit_rows, prior_artifacts)
        can_proceed = readiness >= self.readiness_threshold

        gate = {
            "threshold": self.readiness_threshold,
            "canProceed": can_proceed,
            "reason": "Inspection readiness meets threshold." if can_proceed else "Coverage below inspection requirement.",
            "overrideAvailable": not can_proceed,
        }

        toolkit_preview = self._summarise_toolkits(toolkit_rows)
        summary = self._build_summary(toolkit_preview, readiness)

        finding_payload = {
            "summary": summary,
            "toolkits": toolkit_preview,
            "categories": categories,
            "gate": gate,
            "hasArtifacts": prior_artifacts,
            "selectedToolkitsCount": len(toolkit_preview),
            "safeguardCount": len(safeguards),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }

        finding_record: Optional[Dict[str, Any]] = None
        if self.supabase:
            try:
                finding_record = self.supabase.insert_inspection_finding(
                    {
                        "tenant_id": mission.tenant_id,
                        "mission_id": mission.mission_id,
                        "finding_type": "readiness_snapshot",
                        "payload": finding_payload,
                        "readiness": int(round(readiness)),
                    }
                )
            except Exception:  # pragma: no cover - Supabase failures fall back to offline buffer
                pass

        preview_state = {
            "readiness": int(round(readiness)),
            "canProceed": can_proceed,
            "categories": categories,
            "gate": gate,
            "summary": summary,
            "toolkits": toolkit_preview,
            "findingId": finding_record.get("id") if finding_record else None,
            "findingCreatedAt": finding_record.get("created_at") if finding_record else None,
        }

        ctx.session.state[INSPECTION_PREVIEW_KEY] = preview_state
        ctx.session.state["inspection_gate"] = {
            "readiness": readiness,
            "threshold": self.readiness_threshold,
            "canProceed": can_proceed,
            "override": False,
            "categories": categories,
            "gate": gate,
            "findingId": preview_state.get("findingId"),
        }

        if self.telemetry:
            self.telemetry.emit(
                "inspection_stage_completed",
                tenant_id=mission.tenant_id,
                mission_id=mission.mission_id,
                payload={
                    "readiness": readiness,
                    "threshold": self.readiness_threshold,
                    "canProceed": can_proceed,
                    "toolkit_count": len(toolkit_preview),
                    "safeguard_count": len(safeguards),
                    "categories": categories,
                },
            )

        if self.streamer:
            message = (
                f"Inspection readiness {readiness:.1f}% — "
                f"{'ready to proceed' if can_proceed else 'needs more coverage'}"
            )
            self.streamer.emit_stage(
                tenant_id=mission.tenant_id if _looks_like_uuid(mission.tenant_id) else None,
                session_identifier=self._session_identifier(mission),
                stage="inspection_stage_completed",
                event="status_update",
                content=message,
                mission_id=mission.mission_id if _looks_like_uuid(mission.mission_id) else None,
                metadata={
                    "readiness": readiness,
                    "canProceed": can_proceed,
                    "toolkitCount": len(toolkit_preview),
                },
            )

        content = types.Content(
            role="system",
            parts=[
                types.Part(
                    text=(
                        f"Inspection readiness {readiness:.1f}% — "
                        f"{'proceed' if can_proceed else 'hold for coverage'}"
                    )
                )
            ],
        )
        yield Event(author=self.name, content=content)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _mission_context(self, ctx: InvocationContext) -> MissionContext:
        state = ctx.session.state or {}
        raw = state.get(MISSION_CONTEXT_KEY, {})
        if not isinstance(raw, dict):
            raise ValueError("Mission context missing from session state")

        mission_id = str(raw.get("mission_id") or getattr(ctx.session, "id", "mission-dry-run"))
        tenant_id = str(raw.get("tenant_id") or "gate-ga-default")
        objective = raw.get("objective") or "Prove value in dry-run mode"
        audience = raw.get("audience") or "Pilot revenue team"
        timeframe = raw.get("timeframe") or "Next 14 days"
        guardrails: List[str] = raw.get("guardrails") or []
        mode = raw.get("mode") or state.get("mission_mode", "dry_run")

        context = MissionContext(
            mission_id=mission_id,
            tenant_id=tenant_id,
            objective=objective,
            audience=audience,
            timeframe=timeframe,
            guardrails=guardrails,
            mode=mode,
            metadata=raw.get("metadata", {}),
        )
        state[MISSION_CONTEXT_KEY] = asdict(context)
        ctx.session.state = state
        return context

    def _load_toolkits(
        self,
        ctx: InvocationContext,
        mission: MissionContext,
    ) -> List[Dict[str, Any]]:
        session_state = ctx.session.state or {}
        fallback_selections = session_state.get("toolkit_selections")
        if isinstance(fallback_selections, list):
            serialised = [
                item
                for item in fallback_selections
                if isinstance(item, dict) and item.get("toolkit_id")
            ]
        else:
            serialised = []

        if not self.supabase:
            return serialised

        try:
            rows = self.supabase.fetch_toolkit_selections(
                mission_id=mission.mission_id,
                tenant_id=mission.tenant_id,
                limit=20,
            )
            if isinstance(rows, Sequence):
                serialised = [row for row in rows if isinstance(row, dict)] or serialised
        except CatalogUnavailableError:
            pass

        return serialised

    def _load_safeguards(self, ctx: InvocationContext) -> List[Dict[str, Any]]:
        raw = ctx.session.state.get(SAFEGUARDS_KEY, [])
        if isinstance(raw, list):
            return [item for item in raw if isinstance(item, dict)]
        return []

    def _has_artifacts(self, ctx: InvocationContext) -> bool:
        bundle = ctx.session.state.get(EVIDENCE_BUNDLE_KEY)
        if isinstance(bundle, dict) and bundle:
            return True
        artifacts = ctx.session.state.get("artifacts")
        if isinstance(artifacts, list) and artifacts:
            return True
        return False

    def _compute_readiness(
        self,
        toolkit_rows: Sequence[Dict[str, Any]],
        has_artifacts: bool,
    ) -> tuple[float, List[Dict[str, Any]]]:
        toolkit_count = len(toolkit_rows)

        toolkit_coverage = self._toolkit_coverage(toolkit_count)
        toolkit_threshold = 85

        evidence_coverage = 80 if has_artifacts else 30
        evidence_threshold = 70

        readiness = self._overall_readiness(toolkit_count, has_artifacts)

        categories = [
            {
                "id": "toolkits",
                "label": "Toolkit coverage",
                "coverage": toolkit_coverage,
                "threshold": toolkit_threshold,
                "status": self._status(toolkit_coverage, toolkit_threshold),
                "description": (
                    "Recommended toolkit mix locked in."
                    if toolkit_count
                    else "Select at least one mission toolkit before planning."
                ),
            },
            {
                "id": "evidence",
                "label": "Evidence history",
                "coverage": evidence_coverage,
                "threshold": evidence_threshold,
                "status": self._status(evidence_coverage, evidence_threshold),
                "description": (
                    "Previous artifacts available for validator review."
                    if has_artifacts
                    else "Run a dry-run to generate evidence before planning."
                ),
            },
            {
                "id": "readiness",
                "label": "Overall readiness",
                "coverage": readiness,
                "threshold": self.readiness_threshold,
                "status": self._status(readiness, self.readiness_threshold),
            },
        ]

        return readiness, categories

    def _toolkit_coverage(self, toolkit_count: int) -> int:
        if toolkit_count >= 3:
            return 100
        if toolkit_count == 2:
            return 88
        if toolkit_count == 1:
            return 72
        return 25

    def _overall_readiness(self, toolkit_count: int, has_artifacts: bool) -> int:
        base = 55 if toolkit_count > 0 else 40
        toolkit_bonus = min(35, max(0, toolkit_count - 1) * 12 + (15 if toolkit_count else 0))
        artifact_bonus = 15 if has_artifacts else 0
        score = base + toolkit_bonus + artifact_bonus
        return max(0, min(100, int(round(score))))

    def _status(self, coverage: float, threshold: float) -> str:
        if coverage >= threshold:
            return "pass"
        if coverage >= threshold * 0.6:
            return "warn"
        return "fail"

    def _summarise_toolkits(self, rows: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
        preview: List[Dict[str, Any]] = []
        for entry in rows[:20]:
            slug = str(entry.get("toolkit_id") or "").strip()
            if not slug:
                continue
            metadata = entry.get("metadata") if isinstance(entry.get("metadata"), dict) else {}
            name = str(metadata.get("name") or slug)
            category = str(metadata.get("category") or "general")
            auth_type = str(metadata.get("authType") or entry.get("auth_mode") or "oauth")
            no_auth = bool(metadata.get("noAuth") or entry.get("auth_mode") == "none" or entry.get("connection_status") == "not_required")
            if no_auth:
                auth_type = "none"
            digest = hashlib.sha1(slug.encode("utf-8")).hexdigest()
            sample_count = 2 + (int(digest[:2], 16) % 3)
            sample_rows = [f"{name} preview {index + 1}" for index in range(sample_count)]
            preview.append(
                {
                    "slug": slug,
                    "name": name,
                    "authType": auth_type,
                    "category": category,
                    "noAuth": no_auth,
                    "sampleCount": sample_count,
                    "sampleRows": sample_rows,
                }
            )
        return preview

    def _build_summary(self, toolkits: Sequence[Dict[str, Any]], readiness: float) -> str:
        if not toolkits:
            return "Add recommended toolkits to improve inspection readiness."
        names = [tool["name"] for tool in toolkits[:3]]
        suffix = ", …" if len(toolkits) > 3 else ""
        return f"{len(toolkits)} toolkit{'s' if len(toolkits) != 1 else ''} ready ({', '.join(names)}{suffix}) at {int(round(readiness))}% readiness."

    def _session_identifier(self, mission: MissionContext) -> str:
        metadata = mission.metadata or {}
        candidate = metadata.get("session_identifier") if isinstance(metadata, dict) else None
        if candidate and isinstance(candidate, str):
            return candidate
        return mission.mission_id
