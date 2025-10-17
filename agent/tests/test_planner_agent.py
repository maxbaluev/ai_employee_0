"""Unit tests for PlannerAgent play generation and persistence."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, Mock

import pytest
import pytest_asyncio
from google.adk.agents.invocation_context import InvocationContext
from google.adk.sessions import InMemorySessionService

from agent.agents.planner import PlannerAgent
from agent.agents.validator import ValidationStatus


@pytest.fixture()
def telemetry_stub():
    class _Telemetry:
        def __init__(self) -> None:
            self.events: list[tuple[str, dict[str, Any]]] = []

        def emit(self, event: str, payload: dict[str, Any]) -> None:
            self.events.append((event, payload))

    return _Telemetry()


@pytest.fixture()
def validator_stub():
    stub = Mock()
    stub.validate_scopes = AsyncMock(
        return_value=Mock(
            required_scopes=["crm.read", "crm.write"],
            granted_scopes=["crm.read", "crm.write"],
            missing_scopes=[],
            alignment_status=ValidationStatus.PASSED,
        ),
    )
    return stub


@pytest.fixture()
def supabase_stub():
    stub = Mock()
    stub.search_library_precedents = AsyncMock(
        return_value=[
            {
                "id": "lib-1",
                "title": "CRM contact sync",
                "similarity": 0.78,
                "summary": "RevOps outreach recipe",
            },
            {
                "id": "lib-2",
                "title": "Support escalation play",
                "similarity": 0.42,
                "summary": "Tiered response workflow",
            },
        ],
    )
    stub.insert_mission_undo_plan = AsyncMock(return_value={"id": "undo-1"})
    stub.upsert_mission_play = AsyncMock(return_value={"play_identifier": "play-primary"})
    stub.update_mission_stage_status = AsyncMock(return_value={"status": "in_progress"})
    return stub


@pytest_asyncio.fixture()
async def session_service() -> InMemorySessionService:
    return InMemorySessionService()


@pytest_asyncio.fixture()
async def make_context(session_service: InMemorySessionService):
    async def _factory(agent: PlannerAgent, state: dict[str, Any]) -> InvocationContext:
        session = await session_service.create_session(
            app_name="ai-employee-control-plane",
            user_id=state.get("user_id", "user-1"),
            state=state,
        )
        return InvocationContext(
            session_service=session_service,
            session=session,
            agent=agent,
            invocation_id="test-planner",
        )

    return _factory


async def _consume(agent: PlannerAgent, ctx: InvocationContext) -> list[Any]:
    return [event async for event in agent._run_async_impl(ctx)]


@pytest.mark.asyncio
async def test_planner_generates_ranked_plays(
    make_context,
    validator_stub,
    supabase_stub,
    telemetry_stub,
):
    planner = PlannerAgent(
        name="Planner",
        validator_agent=validator_stub,
        supabase_client=supabase_stub,
        telemetry=telemetry_stub,
        max_plays=3,
    )

    ctx = await make_context(
        planner,
        state={
            "mission_id": "mission-1",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
            "mission_brief": {
                "objective": "Sync HubSpot contacts to Salesforce",
                "audience": "RevOps team",
                "timeline": "this week",
            },
            "granted_scopes": ["crm.read", "crm.write"],
            "safeguards": [
                {"id": "sg-1", "description": "Respect opt-out"},
                {"id": "sg-2", "description": "Throttle bulk sends"},
            ],
            "anticipated_connections": [
                {
                    "toolkit_slug": "hubspot",
                    "anticipated_scopes": ["crm.read"],
                    "connection_required": True,
                },
                {
                    "toolkit_slug": "salesforce",
                    "anticipated_scopes": ["crm.write"],
                    "connection_required": True,
                },
            ],
        },
    )

    events = await _consume(planner, ctx)

    ranked = ctx.session.state["ranked_plays"]
    assert len(ranked) == 3
    assert ranked[0]["confidence"] >= ranked[-1]["confidence"]

    undo_plans = ctx.session.state["undo_plans"]
    assert len(undo_plans) == 3
    for plan in undo_plans:
        assert "label" in plan
        assert "impact_summary" in plan
        assert "steps" in plan

    supabase_stub.insert_mission_undo_plan.assert_called()
    supabase_stub.upsert_mission_play.assert_called()
    assert any(getattr(event, "custom_metadata", {}).get("stage") == "PLAN" for event in events)


@pytest.mark.asyncio
async def test_validator_failure_marks_degraded(
    make_context,
    validator_stub,
    supabase_stub,
    telemetry_stub,
):
    validator_stub.validate_scopes = AsyncMock(
        return_value=Mock(
            required_scopes=["crm.read", "crm.write"],
            granted_scopes=["crm.read"],
            missing_scopes=["crm.write"],
            alignment_status=ValidationStatus.FAILED,
        ),
    )

    planner = PlannerAgent(
        name="Planner",
        validator_agent=validator_stub,
        supabase_client=supabase_stub,
        telemetry=telemetry_stub,
        max_plays=2,
    )

    ctx = await make_context(
        planner,
        state={
            "mission_id": "mission-2",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
            "mission_brief": {"objective": "Automate renewal outreach"},
            "granted_scopes": ["crm.read"],
            "anticipated_connections": [
                {
                    "toolkit_slug": "hubspot",
                    "anticipated_scopes": ["crm.read", "crm.write"],
                    "connection_required": True,
                },
            ],
        },
    )

    await _consume(planner, ctx)

    assert ctx.session.state["planner_degraded"] is True
    assert ctx.session.state["planner_summary"]["validator_status"] == ValidationStatus.FAILED.value


@pytest.mark.asyncio
async def test_library_precedents_added_to_plays(
    make_context,
    validator_stub,
    supabase_stub,
    telemetry_stub,
):
    planner = PlannerAgent(
        name="Planner",
        validator_agent=validator_stub,
        supabase_client=supabase_stub,
        telemetry=telemetry_stub,
    )

    ctx = await make_context(
        planner,
        state={
            "mission_id": "mission-3",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
            "mission_brief": {"objective": "Improve onboarding journey"},
            "granted_scopes": [],
        },
    )

    await _consume(planner, ctx)

    supabase_stub.search_library_precedents.assert_called_once()
    plays = ctx.session.state["ranked_plays"]
    assert plays[0]["precedents"]


@pytest.mark.asyncio
async def test_telemetry_events_emitted(
    make_context,
    validator_stub,
    supabase_stub,
    telemetry_stub,
):
    planner = PlannerAgent(
        name="Planner",
        validator_agent=validator_stub,
        supabase_client=supabase_stub,
        telemetry=telemetry_stub,
    )

    ctx = await make_context(
        planner,
        state={
            "mission_id": "mission-4",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
            "mission_brief": {"objective": "Automate customer follow-ups"},
        },
    )

    await _consume(planner, ctx)

    event_names = [name for name, _ in telemetry_stub.events]
    assert "planner_candidate_generated" in event_names
    assert "plan_ranked" in event_names
    assert "plan_selected" in event_names


@pytest.mark.asyncio
async def test_missing_brief_raises_runtime_error(
    make_context,
    validator_stub,
    supabase_stub,
    telemetry_stub,
):
    planner = PlannerAgent(
        name="Planner",
        validator_agent=validator_stub,
        supabase_client=supabase_stub,
        telemetry=telemetry_stub,
    )

    ctx = await make_context(
        planner,
        state={
            "mission_id": "mission-5",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
        },
    )

    with pytest.raises(RuntimeError):
        await _consume(planner, ctx)
