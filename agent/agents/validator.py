"""Validator stub enforcing safeguard alignment for Gate G-A."""

from __future__ import annotations

from dataclasses import asdict
from typing import Any, AsyncGenerator, Dict, List, Optional

from google.adk.agents.base_agent import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events.event import Event
from google.genai import types

from pydantic import Field

from ..services import CopilotKitStreamer, SupabaseClient, TelemetryEmitter
from .state import (
    MissionContext,
    SafeguardHint,
    ValidationResult,
    MISSION_CONTEXT_KEY,
    SAFEGUARDS_KEY,
    LATEST_ARTIFACT_KEY,
    LATEST_VALIDATION_KEY,
)


class ValidatorAgent(BaseAgent):
    """Reads safeguards from session state and produces structured outcomes."""

    supabase: Optional[SupabaseClient] = Field(default=None, exclude=True)
    telemetry: Optional[TelemetryEmitter] = Field(default=None, exclude=True)
    streamer: Optional[CopilotKitStreamer] = Field(default=None, exclude=True)

    def __init__(
        self,
        *,
        name: str = "ValidatorAgent",
        supabase: Optional[SupabaseClient] = None,
        telemetry: Optional[TelemetryEmitter] = None,
        streamer: Optional[CopilotKitStreamer] = None,
    ) -> None:
        super().__init__(
            name=name,
            supabase=supabase,
            telemetry=telemetry,
            streamer=streamer,
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
        mission_context = self._mission_context(ctx)
        artifact = self._latest_artifact(ctx)
        safeguards = self._safeguards(ctx, mission_context)
        attempt = self._current_attempt(ctx)

        self._emit_stage_started(mission_context, attempt, len(safeguards))

        result = self._evaluate(artifact, safeguards)

        ctx.session.state[LATEST_VALIDATION_KEY] = asdict(result)
        self._persist_validation(mission_context, result, safeguards)

        self.telemetry.emit(
            "validator_stage_completed",
            tenant_id=mission_context.tenant_id,
            mission_id=mission_context.mission_id,
            payload={
                "status": result.status,
                "violations": result.violations,
            },
        )

        self._emit_feedback(
            mission_context,
            result,
            attempt,
        )

        summary = (
            f"Validator outcome: {result.status}. Violations: "
            f"{', '.join(result.violations) if result.violations else 'none'}"
        )
        content = types.Content(role="system", parts=[types.Part(text=summary)])
        yield Event(author=self.name, content=content)

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

    def _latest_artifact(self, ctx: InvocationContext) -> Dict[str, str]:
        artifact = ctx.session.state.get(LATEST_ARTIFACT_KEY)
        if isinstance(artifact, dict):
            return artifact
        return {
            "artifact_id": "unknown",
            "summary": "",
            "undo_plan": "",
        }

    def _safeguards(
        self, ctx: InvocationContext, mission_context: MissionContext
    ) -> List[SafeguardHint]:
        raw = ctx.session.state.get(SAFEGUARDS_KEY, [])
        hints: List[SafeguardHint] = []
        if isinstance(raw, list):
            for item in raw:
                if isinstance(item, dict):
                    hints.append(
                        SafeguardHint(
                            mission_id=item.get("mission_id", mission_context.mission_id),
                            hint_type=item.get("hint_type", "tone"),
                            suggested_value=item.get("suggested_value", ""),
                            status=item.get("status", "suggested"),
                            rationale=item.get("rationale", ""),
                            confidence=float(item.get("confidence", 0.6)),
                        )
                    )
        return hints

    def _evaluate(
        self, artifact: Dict[str, str], safeguards: List[SafeguardHint]
    ) -> ValidationResult:
        summary = artifact.get("summary", "").lower()
        violations: List[str] = []
        reviewer_required = False

        for hint in safeguards:
            hint_text = hint.suggested_value.lower()
            if "quiet" in hint_text and "quiet" not in summary:
                violations.append("quiet_window_missing")
            if "tone" in hint.hint_type and "tone" not in summary:
                violations.append("tone_not_referenced")
            if "undo" in hint_text and "undo" not in summary:
                violations.append("undo_plan_missing")

        if violations:
            status = "retry_later"
        else:
            status = "auto_fix"

        if any(hint.status == "escalate" for hint in safeguards):
            reviewer_required = True
            if status == "auto_fix":
                status = "ask_reviewer"

        notes = (
            "Validator performed Gate G-A safeguard checks."
            if not violations
            else f"Violations detected: {', '.join(violations)}"
        )
        return ValidationResult(
            status=status,
            notes=notes,
            violations=violations,
            reviewer_required=reviewer_required,
        )

    def _persist_validation(
        self,
        mission_context: MissionContext,
        result: ValidationResult,
        safeguards: List[SafeguardHint],
    ) -> None:
        event = {
            "mission_id": mission_context.mission_id,
            "tenant_id": mission_context.tenant_id,
            "event_type": result.status,
            "details": {
                "notes": result.notes,
                "violations": result.violations,
                "safeguards": [asdict(hint) for hint in safeguards],
            },
        }
        self.supabase.insert_safeguard_event(event)

    def _session_identifier(self, context: MissionContext) -> str:
        metadata = context.metadata or {}
        identifier = metadata.get("session_identifier") if isinstance(metadata, dict) else None
        return str(identifier) if identifier else context.mission_id

    def _current_attempt(self, ctx: InvocationContext) -> int:
        attempt_raw = ctx.session.state.get("validator_attempt")
        if isinstance(attempt_raw, int) and attempt_raw > 0:
            return attempt_raw
        execution_attempt = ctx.session.state.get("execution_attempt")
        if isinstance(execution_attempt, int) and execution_attempt > 0:
            return execution_attempt
        return 1

    def _emit_stage_started(
        self,
        context: MissionContext,
        attempt: int,
        safeguard_count: int,
    ) -> None:
        if not self.streamer:
            return
        self.streamer.emit_stage(
            tenant_id=context.tenant_id,
            session_identifier=self._session_identifier(context),
            stage="validator_stage_started",
            event="stage_started",
            content="Validator reviewing safeguards",
            mission_id=context.mission_id,
            mission_status="in_progress",
            metadata={
                "attempt": attempt,
                "safeguard_count": safeguard_count,
            },
        )

    def _emit_feedback(
        self,
        context: MissionContext,
        result: ValidationResult,
        attempt: int,
    ) -> None:
        if not self.streamer:
            return
        self.streamer.emit_stage(
            tenant_id=context.tenant_id,
            session_identifier=self._session_identifier(context),
            stage="validator_feedback",
            event="completion",
            content=(
                f"Validator outcome {result.status}; violations="
                f"{len(result.violations)}"
            ),
            mission_id=context.mission_id,
            mission_status="in_progress",
            metadata={
                "status": result.status,
                "attempt": attempt,
                "violations": result.violations,
                "reviewer_required": result.reviewer_required,
                "notes": result.notes,
            },
        )
