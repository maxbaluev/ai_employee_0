"""Evidence bundling for Gate G-B with proof pack generation."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict
from typing import Any, AsyncGenerator, Dict, List, Optional

from google.adk.agents.base_agent import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events.event import Event
from google.genai import types
from pydantic import Field

from ..services import CopilotKitStreamer, SupabaseClient, TelemetryEmitter
from ..services.evidence_service import EvidenceService
from .state import (
    EVIDENCE_BUNDLE_KEY,
    LATEST_ARTIFACT_KEY,
    LATEST_VALIDATION_KEY,
    MISSION_CONTEXT_KEY,
    SAFEGUARDS_KEY,
    SELECTED_PLAY_KEY,
    EvidenceBundle,
    MissionContext,
    SafeguardHint,
)


class EvidenceAgent(BaseAgent):
    """Packages artifacts, plays, and safeguards for Supabase storage."""

    supabase: Optional[SupabaseClient] = Field(default=None, exclude=True)
    telemetry: Optional[TelemetryEmitter] = Field(default=None, exclude=True)
    streamer: Optional[CopilotKitStreamer] = Field(default=None, exclude=True)
    evidence_service: Optional[EvidenceService] = Field(default=None, exclude=True)

    def __init__(
        self,
        *,
        name: str = "EvidenceAgent",
        supabase: Optional[SupabaseClient] = None,
        telemetry: Optional[TelemetryEmitter] = None,
        streamer: Optional[CopilotKitStreamer] = None,
        evidence_service: Optional[EvidenceService] = None,
    ) -> None:
        super().__init__(
            name=name,
            supabase=supabase,
            telemetry=telemetry,
            streamer=streamer,
            evidence_service=evidence_service,
        )
        if self.supabase is None:
            object.__setattr__(self, "supabase", SupabaseClient.from_env())
        if self.telemetry is None:
            object.__setattr__(self, "telemetry", TelemetryEmitter(self.supabase))
        if self.streamer is None:
            object.__setattr__(self, "streamer", CopilotKitStreamer())
        if self.evidence_service is None:
            object.__setattr__(self, "evidence_service", EvidenceService(self.supabase))

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        mission_context = self._mission_context(ctx)
        play = ctx.session.state.get(SELECTED_PLAY_KEY, {})
        artifact = ctx.session.state.get(LATEST_ARTIFACT_KEY, {})
        validation = ctx.session.state.get(LATEST_VALIDATION_KEY, {})
        safeguards = self._safeguards(ctx, mission_context)

        bundle = EvidenceBundle(
            mission_id=mission_context.mission_id,
            play_title=play.get("title", "Dry-run Play"),
            artifact_id=artifact.get("artifact_id", "artifact-unknown"),
            summary=artifact.get("summary", ""),
            undo_plan=artifact.get("undo_plan", "Document manual rollback"),
            safeguards=safeguards,
            telemetry={
                "validation": validation,
            },
        )

        ctx.session.state[EVIDENCE_BUNDLE_KEY] = asdict(bundle)
        self._persist_bundle(mission_context, bundle)

        self.telemetry.emit(
            "evidence_bundle_created",
            tenant_id=mission_context.tenant_id,
            mission_id=mission_context.mission_id,
            payload={
                "artifact_id": bundle.artifact_id,
                "play_title": bundle.play_title,
            },
        )

        self._emit_stream(
            mission_context,
            bundle,
        )

        text = (
            f"Evidence bundle captured for play '{bundle.play_title}' "
            f"(artifact={bundle.artifact_id})."
        )
        yield Event(
            author=self.name,
            content=types.Content(role="system", parts=[types.Part(text=text)]),
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _mission_context(self, ctx: InvocationContext) -> MissionContext:
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
            guardrails=[],
            mode=ctx.session.state.get("mission_mode", "dry_run"),
            metadata={},
        )

    def _safeguards(
        self, ctx: InvocationContext, mission_context: MissionContext
    ) -> List[SafeguardHint]:
        results: List[SafeguardHint] = []
        raw = ctx.session.state.get(SAFEGUARDS_KEY, [])
        if isinstance(raw, list):
            for item in raw:
                if isinstance(item, dict):
                    results.append(
                        SafeguardHint(
                            mission_id=item.get(
                                "mission_id", mission_context.mission_id
                            ),
                            hint_type=item.get("hint_type", "tone"),
                            suggested_value=item.get("suggested_value", ""),
                            status=item.get("status", "suggested"),
                            rationale=item.get("rationale", ""),
                            confidence=float(item.get("confidence", 0.7)),
                        )
                    )
        return results

    def _persist_bundle(
        self, mission_context: MissionContext, bundle: EvidenceBundle
    ) -> None:
        payload = asdict(bundle)
        checksum = hashlib.sha256(
            json.dumps(payload, sort_keys=True).encode("utf-8")
        ).hexdigest()
        record = {
            "tenant_id": mission_context.tenant_id,
            "play_id": None,
            "type": "evidence_bundle",
            "title": f"Evidence bundle for {bundle.play_title}",
            "content": payload,
            "status": "draft",
            "hash": checksum,
            "checksum": checksum,
        }
        self.supabase.insert_artifacts([record])

    def _session_identifier(self, context: MissionContext) -> str:
        metadata = context.metadata or {}
        identifier = metadata.get("session_identifier") if isinstance(metadata, dict) else None
        return str(identifier) if identifier else context.mission_id

    def _emit_stream(
        self,
        context: MissionContext,
        bundle: EvidenceBundle,
    ) -> None:
        if not self.streamer:
            return

        # Calculate bundle hash for metadata
        payload = asdict(bundle)
        bundle_hash = hashlib.sha256(
            json.dumps(payload, sort_keys=True).encode("utf-8")
        ).hexdigest()[:16]

        # Enrich metadata with artifact details, safeguard count, and undo plan status
        metadata: Dict[str, Any] = {
            "artifact_id": bundle.artifact_id,
            "play_title": bundle.play_title,
            "hash": bundle_hash,
            "safeguard_count": len(bundle.safeguards),
            "undo_plan_present": bool(bundle.undo_plan and bundle.undo_plan != "Document manual rollback"),
            "validation_status": bundle.telemetry.get("validation", {}).get("status") if bundle.telemetry else None,
        }

        message = f"Evidence bundle created for {bundle.play_title} (artifact={bundle.artifact_id}, safeguards={len(bundle.safeguards)})"

        self.streamer.emit_stage(
            tenant_id=context.tenant_id,
            session_identifier=self._session_identifier(context),
            stage="evidence_bundle_created",
            event="bundle_created",
            content=message,
            mission_id=context.mission_id,
            mission_status="completed",
            metadata=metadata,
        )
