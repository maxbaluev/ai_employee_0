from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any, AsyncGenerator, Dict, List, Optional

import pytest

from agent.agents.execution_loop import ExecutionLoopAgent
from agent.services.telemetry import TelemetryEmitter
from agent.services.copilotkit import CopilotKitStreamer
from google.adk.agents.base_agent import BaseAgent
from agent.agents.state import (
    LATEST_VALIDATION_KEY,
    RANKED_PLAYS_KEY,
    SELECTED_PLAY_KEY,
)


class _NoOpAgent(BaseAgent):
    """Stub ADK agent that yields no events."""

    def __init__(self, *, name: str = "StubAgent") -> None:
        super().__init__(name=name)

    async def _run_async_impl(self, _ctx: Any) -> AsyncGenerator[Event, None]:  # type: ignore[override]
        if False:  # pragma: no cover - keeps generator structure
            yield None


class _ReviewerValidator(BaseAgent):
    """Validator stub that flags reviewer requirement on first attempt."""

    def __init__(self, status: str = "ask_reviewer") -> None:
        super().__init__(name="StubValidator")
        self._status = status

    async def _run_async_impl(self, ctx: Any) -> AsyncGenerator[Event, None]:  # type: ignore[override]
        ctx.session.state[LATEST_VALIDATION_KEY] = {
            "status": self._status,
            "violations": ["tone_too_casual"],
        }
        if False:  # pragma: no cover
            yield None


class _TelemetryRecorder(TelemetryEmitter):
    def __init__(self) -> None:
        supabase_stub = SimpleNamespace(
            enabled=False,
            _is_uuid=lambda _value: True,
            _degraded=True,
            insert_event=lambda _event: None,
        )
        super().__init__(supabase=supabase_stub)
        self.events: List[Dict[str, Any]] = []

    def emit(
        self,
        event_name: str,
        *,
        tenant_id: str,
        mission_id: str,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.events.append(
            {
                "event": event_name,
                "tenant_id": tenant_id,
                "mission_id": mission_id,
                "payload": payload or {},
            }
        )


class _StreamerRecorder(CopilotKitStreamer):
    def __post_init__(self) -> None:  # type: ignore[override]
        self.stage_events: List[Dict[str, Any]] = []
        self.exit_events: List[Dict[str, Any]] = []

    def emit_stage(  # type: ignore[override]
        self,
        *,
        tenant_id: Optional[str],
        session_identifier: str,
        stage: str,
        event: str,
        content: str,
        mission_id: Optional[str] = None,
        mission_status: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.stage_events.append(
            {
                "tenant_id": tenant_id,
                "session_identifier": session_identifier,
                "stage": stage,
                "event": event,
                "content": content,
                "mission_id": mission_id,
                "mission_status": mission_status,
                "metadata": metadata or {},
            }
        )

    def emit_exit(  # type: ignore[override]
        self,
        *,
        tenant_id: Optional[str],
        session_identifier: str,
        reason: Optional[str] = None,
        mission_status: Optional[str] = None,
        stage: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.exit_events.append(
            {
                "tenant_id": tenant_id,
                "session_identifier": session_identifier,
                "mission_status": mission_status,
                "stage": stage,
                "reason": reason,
                "metadata": metadata or {},
            }
        )


class _DummySession:
    def __init__(self) -> None:
        self.state: Dict[str, Any] = {}


class _DummyInvocationContext:
    def __init__(self) -> None:
        self.session = _DummySession()


@pytest.mark.asyncio
async def test_execution_loop_emits_reviewer_signal_and_invokes_handler() -> None:
    telemetry = _TelemetryRecorder()
    reviewer_calls: List[Dict[str, Any]] = []

    def reviewer_handler(*, play: Dict[str, Any], validation: Dict[str, Any]) -> None:
        reviewer_calls.append({"play": play, "validation": validation})

    streamer = _StreamerRecorder()

    execution_loop = ExecutionLoopAgent(
        executor=_NoOpAgent(),
        validator=_ReviewerValidator(),
        evidence=_NoOpAgent(),
        telemetry=telemetry,
        streamer=streamer,
        max_retries=1,
        reviewer_handler=reviewer_handler,
    )

    ctx = _DummyInvocationContext()
    ctx.session.state[RANKED_PLAYS_KEY] = [
        {
            "play_id": "play-001",
            "mission_id": "mission-001",
            "tenant_id": "tenant-001",
            "title": "Dry-run proof sketch",
        }
    ]

    events = [
        event
        async for event in execution_loop._run_async_impl(ctx)  # pylint: disable=protected-access
    ]

    # Validator escalation should halt the loop with a reviewer notice event.
    assert events, "execution loop should yield a reviewer notice event"
    assert any(
        "reviewer" in getattr(getattr(event, "content", None), "parts", [{}])[0].text.lower()
        for event in events
        if getattr(getattr(event, "content", None), "parts", None)
    ), "reviewer interruption message expected"

    # Telemetry must record the reviewer escalation for analytics.
    assert any(
        entry["event"] == "execution_loop_needs_reviewer"
        for entry in telemetry.events
    ), "telemetry missing execution_loop_needs_reviewer event"

    # Reviewer handler should receive the selected play & validation details.
    assert reviewer_calls, "reviewer handler was not invoked"
    assert reviewer_calls[0]["validation"]["status"] == "ask_reviewer"

    # Exit metadata should reflect reviewer status for downstream observers.
    assert streamer.exit_events, "streamer exit event missing"
    exit_payload = streamer.exit_events[0]
    assert exit_payload["mission_status"] == "needs_reviewer"
    assert exit_payload["metadata"]["attempts"] == 1
