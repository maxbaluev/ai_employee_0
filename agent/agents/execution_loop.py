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
        for play in ranked[: self.max_retries]:
            attempts += 1
            ctx.session.state[SELECTED_PLAY_KEY] = play
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
            self.telemetry.emit(
                "execution_loop_completed",
                tenant_id=ranked[0].get("tenant_id", "gate-ga-default"),
                mission_id=ranked[0].get("mission_id", "mission-dry-run"),
                payload={"attempts": attempts},
            )
            self._emit_stream(
                ranked[0],
                "execution_loop_completed",
                {"attempts": attempts},
            )
            yield self._text_event(
                f"Execution loop completed after {attempts} attempt(s)."
            )
        else:
            self.telemetry.emit(
                "execution_loop_exhausted",
                tenant_id=ranked[0].get("tenant_id", "gate-ga-default"),
                mission_id=ranked[0].get("mission_id", "mission-dry-run"),
                payload={"attempts": attempts},
            )
            self._emit_stream(
                ranked[0],
                "execution_loop_exhausted",
                {"attempts": attempts},
            )
            yield self._text_event(
                f"Execution loop ended without passing safeguards after {attempts} attempt(s)."
            )

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
        message = f"{stage.replace('_', ' ').title()} (attempt {metadata.get('attempt', 0)})"
        self.streamer.emit_message(
            tenant_id=tenant_id,
            session_identifier=mission_id,
            role="assistant",
            content=message,
            metadata={"stage": stage, **metadata},
        )
