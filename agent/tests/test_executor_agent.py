"""Tests for ExecutorAgent governed execution logic."""

from __future__ import annotations

import pytest
import pytest_asyncio
from google.adk.agents.invocation_context import InvocationContext
from google.adk.sessions import InMemorySessionService

from agent.agents.executor import (
    AuthExpiredError,
    ExecutionAction,
    ExecutorAgent,
    RateLimitError,
)
from agent.services import TelemetryClient


class StubTelemetry(TelemetryClient):
    def __init__(self) -> None:
        super().__init__(destination="memory")
        self.events: list[tuple[str, dict[str, str | float | int | None]]] = []

    def emit(self, event_name: str, payload: dict[str, str | float | int | None]) -> None:  # type: ignore[override]
        self.events.append((event_name, dict(payload)))


class StubValidator:
    def __init__(self) -> None:
        self.preflight_calls: list[dict[str, str]] = []
        self.postflight_calls: list[dict[str, str]] = []

    async def preflight_check(self, ctx: InvocationContext, action: dict[str, str]) -> list[dict[str, str]]:
        self.preflight_calls.append(action)
        return [{"safeguard_id": "sg-pre", "status": "passed", "severity": "info"}]

    async def postflight_check(
        self,
        ctx: InvocationContext,
        action: dict[str, str],
        execution_result: dict[str, str],
    ) -> list[dict[str, str]]:
        self.postflight_calls.append(action)
        return [{"safeguard_id": "sg-post", "status": "passed", "severity": "info"}]


@pytest_asyncio.fixture()
async def session_service() -> InMemorySessionService:
    return InMemorySessionService()


@pytest_asyncio.fixture()
async def make_context(session_service: InMemorySessionService):
    async def _factory(agent: ExecutorAgent, state: dict[str, object]) -> InvocationContext:
        session = await session_service.create_session(
            app_name="ai-employee-control-plane",
            user_id=str(state.get("user_id", "user-1")),
            state=state,
        )
        return InvocationContext(
            session_service=session_service,
            session=session,
            agent=agent,
            invocation_id="executor-test",
        )

    return _factory


def _base_state() -> dict[str, object]:
    return {
        "mission_id": "00000000-0000-0000-0000-000000000001",
        "tenant_id": "tenant-1",
        "user_id": "user-1",
        "approval_decision": {"status": "approved", "play_id": "play-primary"},
        "ranked_plays": [
            {
                "id": "play-primary",
                "actions": [
                    {
                        "id": "action-1",
                        "toolkit": "hubspot",
                        "action": "send_email",
                        "arguments": {"subject": "Hello"},
                    }
                ],
            }
        ],
    }


@pytest.mark.asyncio
async def test_executor_runs_actions_successfully(make_context) -> None:
    telemetry = StubTelemetry()
    validator = StubValidator()

    async def action_executor(action: ExecutionAction, context: dict[str, object]) -> dict[str, object]:
        return {"ok": True, "toolkit": action.toolkit, "arguments": action.arguments}

    agent = ExecutorAgent(
        name="executor",
        validator_agent=validator,
        telemetry=telemetry,
        action_executor=action_executor,
        heartbeat_seconds=0.01,
    )

    ctx = await make_context(agent, _base_state())

    events = [event async for event in agent._run_async_impl(ctx)]

    assert ctx.session.state["execution_results"], "execution results should be recorded"
    result = ctx.session.state["execution_results"][0]
    assert result["status"] == "succeeded"
    assert result["toolkit"] == "hubspot"
    assert validator.preflight_calls and validator.postflight_calls
    assert ctx.session.state.get("execution_summary", {}).get("succeeded") == 1
    assert any(name == "execution_completed" for name, _ in telemetry.events)
    assert events[-1].custom_metadata.get("type") == "info"


@pytest.mark.asyncio
async def test_executor_rate_limit_retry(make_context) -> None:
    attempts = {"count": 0}

    async def action_executor(action: ExecutionAction, context: dict[str, object]) -> dict[str, object]:
        attempts["count"] += 1
        if attempts["count"] == 1:
            raise RateLimitError(retry_after=0.0)
        return {"ok": True}

    agent = ExecutorAgent(
        name="executor",
        telemetry=StubTelemetry(),
        action_executor=action_executor,
        heartbeat_seconds=0.01,
        max_retries=2,
    )

    ctx = await make_context(agent, _base_state())
    events = [event async for event in agent._run_async_impl(ctx)]

    assert attempts["count"] == 2
    assert ctx.session.state["execution_results"], "result expected after retry"
    assert events[-1].custom_metadata.get("type") == "info"


@pytest.mark.asyncio
async def test_executor_rate_limit_exhausts(make_context) -> None:
    async def action_executor(action: ExecutionAction, context: dict[str, object]) -> dict[str, object]:
        raise RateLimitError(retry_after=0.0)

    agent = ExecutorAgent(
        name="executor",
        telemetry=StubTelemetry(),
        action_executor=action_executor,
        heartbeat_seconds=0.01,
        max_retries=1,
    )

    ctx = await make_context(agent, _base_state())

    events = [event async for event in agent._run_async_impl(ctx)]

    assert not ctx.session.state.get("execution_results"), "no results on failure"
    assert events[-1].custom_metadata.get("type") == "error"


@pytest.mark.asyncio
async def test_executor_auth_expired(make_context) -> None:
    async def action_executor(action: ExecutionAction, context: dict[str, object]) -> dict[str, object]:
        raise AuthExpiredError("expired")

    agent = ExecutorAgent(
        name="executor",
        telemetry=StubTelemetry(),
        action_executor=action_executor,
        heartbeat_seconds=0.01,
    )

    ctx = await make_context(agent, _base_state())

    events = [event async for event in agent._run_async_impl(ctx)]

    assert ctx.session.state.get("execution_status") == "auth_expired"
    assert events[-1].custom_metadata.get("type") == "error"


@pytest.mark.asyncio
async def test_executor_missing_context(make_context) -> None:
    agent = ExecutorAgent(name="executor", telemetry=StubTelemetry())
    ctx = await make_context(agent, {})

    events = [event async for event in agent._run_async_impl(ctx)]

    assert events[0].custom_metadata.get("type") == "error"
