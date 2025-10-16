"""Tests for CoordinatorAgent mission orchestration."""

from __future__ import annotations

from typing import Any, AsyncGenerator

import pytest
import pytest_asyncio
from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part

from agent.agents.coordinator import MissionStage, CoordinatorAgent


class StubAgent(BaseAgent):
    """Minimal downstream agent used for testing hand-offs."""

    def __init__(
        self,
        *,
        name: str,
        state_updates: dict[str, Any] | None = None,
        fail_with: Exception | None = None,
    ) -> None:
        super().__init__(name=name)
        self._state_updates = state_updates or {}
        self._fail_with = fail_with

    async def _run_async_impl(
        self,
        ctx: InvocationContext,
    ) -> AsyncGenerator[Event, None]:
        if self._fail_with:
            raise self._fail_with
        ctx.session.state.update(self._state_updates)
        content = Content(role="assistant", parts=[Part(text=f"{self.name} complete")])
        yield Event(
            author=self.name,
            invocationId=getattr(ctx, "invocation_id", ""),
            content=content,
            customMetadata={"stage": ctx.session.state.get("current_stage")},
        )


@pytest.fixture()
def telemetry_mock():
    class _Telemetry:
        def __init__(self) -> None:
            self.calls: list[tuple[str, dict[str, Any]]] = []

        def emit(self, event: str, payload: dict[str, Any]) -> None:
            self.calls.append((event, payload))

    return _Telemetry()


@pytest_asyncio.fixture()
async def session_service() -> InMemorySessionService:
    return InMemorySessionService()


@pytest_asyncio.fixture()
async def make_context(session_service: InMemorySessionService):
    async def _factory(agent: BaseAgent, state: dict[str, Any]) -> InvocationContext:
        session = await session_service.create_session(
            app_name="ai-employee-control-plane",
            user_id=state.get("user_id", "user-1"),
            state=state,
        )
        return InvocationContext(
            session_service=session_service,
            session=session,
            agent=agent,
            invocation_id="test-invocation",
        )

    return _factory


@pytest.mark.asyncio
async def test_missing_context_yields_error(make_context):
    coordinator = CoordinatorAgent(name="Coordinator")
    ctx = await make_context(coordinator, state={})

    events = [event async for event in coordinator._run_async_impl(ctx)]

    assert len(events) == 1
    assert events[0].custom_metadata["type"] == "error"
    assert events[0].custom_metadata["stage"] == MissionStage.HOME.value


@pytest.mark.asyncio
async def test_successful_flow_updates_stage_and_emits_telemetry(make_context, telemetry_mock):
    coordinator = CoordinatorAgent(
        name="Coordinator",
        telemetry=telemetry_mock,
        intake_agent=StubAgent(
            name="IntakeAgent",
            state_updates={"mission_brief": {"summary": "ok"}},
        ),
        inspector_agent=StubAgent(
            name="InspectorAgent",
            state_updates={"granted_scopes": ["hubspot.read"]},
        ),
        planner_agent=StubAgent(
            name="PlannerAgent",
            state_updates={"ranked_plays": ["play-a"]},
        ),
        executor_agent=StubAgent(
            name="ExecutorAgent",
            state_updates={"execution_results": {"status": "success"}},
        ),
        evidence_agent=StubAgent(
            name="EvidenceAgent",
            state_updates={"evidence_bundles": ["bundle-1"]},
        ),
    )

    ctx = await make_context(
        coordinator,
        state={
            "mission_id": "mission-1",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
            "approval_decision": {"status": "approved"},
        },
    )

    events = [event async for event in coordinator._run_async_impl(ctx)]

    assert ctx.session.state["current_stage"] == MissionStage.REFLECT.value
    stage_events = [e for e in events if e.custom_metadata.get("type") != "error"]
    stage_names = {e.custom_metadata.get("stage") for e in stage_events}
    assert MissionStage.DEFINE.value in stage_names
    assert MissionStage.REFLECT.value in stage_names

    transition_events = [event for event, _payload in telemetry_mock.calls if event == "mission_stage_transition"]
    assert len(transition_events) >= 5  # one per executed stage


@pytest.mark.asyncio
async def test_stage_failure_rolls_back(make_context, telemetry_mock):
    coordinator = CoordinatorAgent(
        name="Coordinator",
        telemetry=telemetry_mock,
        intake_agent=StubAgent(
            name="IntakeAgent",
            state_updates={"mission_brief": {"summary": "ok"}},
        ),
        inspector_agent=StubAgent(
            name="InspectorAgent",
            fail_with=RuntimeError("oauth failed"),
        ),
    )

    ctx = await make_context(
        coordinator,
        state={
            "mission_id": "mission-1",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
        },
    )

    events = [event async for event in coordinator._run_async_impl(ctx)]

    assert ctx.session.state["current_stage"] == MissionStage.DEFINE.value
    assert events[-1].custom_metadata["type"] == "error"
    assert any(event == "coordinator_error" for event, _payload in telemetry_mock.calls)


@pytest.mark.asyncio
async def test_waits_for_approval_when_decision_missing(make_context, telemetry_mock):
    coordinator = CoordinatorAgent(
        name="Coordinator",
        telemetry=telemetry_mock,
        intake_agent=StubAgent(
            name="IntakeAgent",
            state_updates={"mission_brief": {"summary": "ok"}},
        ),
        inspector_agent=StubAgent(
            name="InspectorAgent",
            state_updates={"granted_scopes": ["hubspot.read"]},
        ),
        planner_agent=StubAgent(
            name="PlannerAgent",
            state_updates={"ranked_plays": ["play-a"]},
        ),
    )

    ctx = await make_context(
        coordinator,
        state={
            "mission_id": "mission-77",
            "tenant_id": "tenant-77",
            "user_id": "user-77",
            # approval_decision intentionally omitted
        },
    )

    events = [event async for event in coordinator._run_async_impl(ctx)]

    assert ctx.session.state["current_stage"] == MissionStage.APPROVE.value
    assert events[-1].custom_metadata["type"] == "info"
    assert "Awaiting approval" in events[-1].content.parts[0].text
    assert any(event == "coordinator_handoff" for event, _payload in telemetry_mock.calls)
