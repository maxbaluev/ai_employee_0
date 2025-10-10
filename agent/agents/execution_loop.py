"""Execution loop orchestrating executor, validator, and evidence agents."""

from __future__ import annotations

from typing import Any, AsyncGenerator, Dict, List, Optional

from google.adk.agents.base_agent import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events.event import Event

from pydantic import Field

from ..services import CopilotKitStreamer, TelemetryEmitter
from .state import (
    LATEST_VALIDATION_KEY,
    RANKED_PLAYS_KEY,
    SELECTED_PLAY_KEY,
)


class ExecutionLoopAgent(BaseAgent):
    """Retries candidate plays until safeguards pass or retries exhaust."""

    executor: BaseAgent = Field(exclude=True)
    validator: BaseAgent = Field(exclude=True)
    evidence: BaseAgent = Field(exclude=True)
    telemetry: TelemetryEmitter = Field(exclude=True)
    streamer: Optional[CopilotKitStreamer] = Field(default=None, exclude=True)
    max_retries: int = 3

    def __init__(
        self,
        *,
        executor: BaseAgent,
        validator: BaseAgent,
        evidence: BaseAgent,
        telemetry: TelemetryEmitter,
        streamer: Optional[CopilotKitStreamer] = None,
        max_retries: int = 3,
        name: str = "ExecutionLoop",
    ) -> None:
        super().__init__(
            name=name,
            executor=executor,
            validator=validator,
            evidence=evidence,
            telemetry=telemetry,
            streamer=streamer,
            max_retries=max(1, max_retries),
        )
        if self.streamer is None:
            object.__setattr__(self, "streamer", CopilotKitStreamer())

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        ranked = self._ranked_plays(ctx)
        if not ranked:
            yield self._text_event("No ranked plays available for execution.")
            return

        attempts = 0
        success = False
        last_play = ranked[0]
        exit_status: Optional[str] = None
        exit_stage: Optional[str] = None
        exit_metadata: Dict[str, Any] = {}

        try:
            for play in ranked[: self.max_retries]:
                attempts += 1
                last_play = play
                ctx.session.state[SELECTED_PLAY_KEY] = play
                ctx.session.state["execution_attempt"] = attempts
                self.telemetry.emit(
                    "executor_stage_started",
                    tenant_id=play.get("tenant_id", "gate-ga-default"),
                    mission_id=play.get("mission_id", "mission-dry-run"),
                    payload={"attempt": attempts, "play_title": play.get("title")},
                )
                self._emit_stream(
                    play,
                    "executor_stage_started",
                    {"attempt": attempts, "play_title": play.get("title")},
                )

                async for event in self.executor.run_async(ctx):
                    yield event

                self.telemetry.emit(
                    "validator_stage_started",
                    tenant_id=play.get("tenant_id", "gate-ga-default"),
                    mission_id=play.get("mission_id", "mission-dry-run"),
                    payload={"attempt": attempts},
                )
                ctx.session.state["validator_attempt"] = attempts
                self._emit_stream(
                    play,
                    "validator_stage_started",
                    {"attempt": attempts},
                )
                async for event in self.validator.run_async(ctx):
                    yield event

                validation = ctx.session.state.get(LATEST_VALIDATION_KEY, {})
                status = validation.get("status", "auto_fix")

                if status == "retry_later":
                    self._emit_stream(
                        play,
                        "validator_retry",
                        {"attempt": attempts, "status": status},
                    )
                    continue
                if status == "ask_reviewer":
                    exit_status = "needs_reviewer"
                    exit_stage = "validator_reviewer_requested"
                    exit_metadata = {"attempts": attempts, "status": status}
                    yield self._text_event(
                        "Validator requested reviewer intervention; halting execution."
                    )
                    self._emit_stream(
                        play,
                        "validator_reviewer_requested",
                        {"attempt": attempts, "status": status},
                    )
                    break

                self.telemetry.emit(
                    "evidence_stage_started",
                    tenant_id=play.get("tenant_id", "gate-ga-default"),
                    mission_id=play.get("mission_id", "mission-dry-run"),
                    payload={"attempt": attempts},
                )
                self._emit_stream(
                    play,
                    "evidence_stage_started",
                    {"attempt": attempts},
                )
                async for event in self.evidence.run_async(ctx):
                    yield event
                success = True
                break

            if success:
                exit_status = "completed"
                exit_stage = "execution_loop_completed"
                exit_metadata = {"attempts": attempts, "status": "completed"}
                self.telemetry.emit(
                    "execution_loop_completed",
                    tenant_id=last_play.get("tenant_id", "gate-ga-default"),
                    mission_id=last_play.get("mission_id", "mission-dry-run"),
                    payload={"attempts": attempts},
                )
                self._emit_stream(
                    last_play,
                    "execution_loop_completed",
                    {"attempts": attempts, "status": "completed"},
                )
                yield self._text_event(
                    f"Execution loop completed after {attempts} attempt(s)."
                )
            elif exit_status == "needs_reviewer":
                # Stream already emitted reviewer request; surface friendly summary.
                yield self._text_event(
                    "Execution paused awaiting reviewer decision."
                )
            else:
                exit_status = exit_status or "exhausted"
                exit_stage = exit_stage or "execution_loop_exhausted"
                if not exit_metadata:
                    exit_metadata = {"attempts": attempts, "status": exit_status}
                self.telemetry.emit(
                    "execution_loop_exhausted",
                    tenant_id=last_play.get("tenant_id", "gate-ga-default"),
                    mission_id=last_play.get("mission_id", "mission-dry-run"),
                    payload={"attempts": attempts},
                )
                self._emit_stream(
                    last_play,
                    "execution_loop_exhausted",
                    {"attempts": attempts, "status": exit_status},
                )
                yield self._text_event(
                    f"Execution loop ended without passing safeguards after {attempts} attempt(s)."
                )
        except Exception as exc:
            exit_status = "error"
            exit_stage = "execution_loop_error"
            exit_metadata = {"attempts": attempts, "error": str(exc)[:160]}
            raise
        finally:
            if self.streamer and ranked:
                status = exit_status or ("completed" if success else "exhausted")
                stage = exit_stage or ("execution_loop_completed" if success else "execution_loop_exhausted")
                metadata = exit_metadata or {"attempts": attempts}
                self._emit_exit_event(last_play, status, stage, metadata)

    @staticmethod
    def _ranked_plays(ctx: InvocationContext) -> List[dict]:
        ranked = ctx.session.state.get(RANKED_PLAYS_KEY, [])
        return [play for play in ranked if isinstance(play, dict)]

    def _text_event(self, message: str) -> Event:
        from google.genai import types

        return Event(
            author=self.name,
            content=types.Content(role="system", parts=[types.Part(text=message)]),
        )

    def _emit_stream(
        self,
        play: dict,
        stage: str,
        metadata: Dict[str, Any],
    ) -> None:
        if not self.streamer:
            return
        mission_id = str(play.get("mission_id", "mission-dry-run"))
        tenant_id = play.get("tenant_id")
        stage_status_map = {
            "validator_reviewer_requested": "needs_reviewer",
            "execution_loop_completed": "completed",
            "execution_loop_exhausted": metadata.get("status", "exhausted"),
        }
        mission_status = stage_status_map.get(stage, "in_progress")
        attempt = metadata.get("attempt", 0)

        # Determine event type and content based on stage
        event_map = {
            "executor_stage_started": ("stage_started", f"Executor Stage Started (attempt {attempt})"),
            "validator_stage_started": ("stage_started", f"Validator Stage Started (attempt {attempt})"),
            "validator_retry": ("retry", f"Validator Retry (attempt {attempt})"),
            "validator_reviewer_requested": ("reviewer_requested", f"Validator Reviewer Requested (attempt {attempt})"),
            "evidence_stage_started": ("stage_started", f"Evidence Stage Started (attempt {attempt})"),
            "execution_loop_completed": ("completed", f"Execution Loop Completed (attempts: {attempt})"),
            "execution_loop_exhausted": ("exhausted", f"Execution Loop Exhausted (attempts: {attempt})"),
        }

        event, content = event_map.get(stage, ("status_update", stage.replace("_", " ").title()))

        # Enrich metadata with mission identifiers and play info
        enriched_metadata = {
            "play_id": play.get("play_id"),
            "play_title": play.get("title"),
            **metadata,
        }

        self.streamer.emit_stage(
            tenant_id=tenant_id,
            session_identifier=mission_id,
            stage=stage,
            event=event,
            content=content,
            mission_id=mission_id,
            mission_status=mission_status,
            metadata=enriched_metadata,
        )

    def _emit_exit_event(
        self,
        play: dict,
        mission_status: str,
        stage: str,
        metadata: Dict[str, Any],
    ) -> None:
        if not self.streamer:
            return
        mission_id = str(play.get("mission_id", "mission-dry-run"))
        tenant_id = play.get("tenant_id")
        self.streamer.emit_exit(
            tenant_id=tenant_id,
            session_identifier=mission_id,
            mission_status=mission_status,
            stage=stage,
            reason=mission_status,
            metadata=metadata,
        )
