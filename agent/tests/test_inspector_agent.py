"""Tests for InspectorAgent discovery and OAuth workflows."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, Mock

import pytest
import pytest_asyncio
from google.adk.agents.invocation_context import InvocationContext
from google.adk.sessions import InMemorySessionService

from agent.agents.inspector import DiscoveryResult, InspectorAgent


@pytest.fixture()
def composio_mock():
    """Mock Composio client wrapper."""
    mock = Mock()
    mock.tools_search = AsyncMock(return_value=[
        {
            "slug": "hubspot",
            "description": "HubSpot CRM integration",
            "scopes": ["crm.contacts.read", "crm.contacts.write"],
            "requires_auth": True,
        },
        {
            "slug": "salesforce",
            "description": "Salesforce CRM integration",
            "scopes": ["api", "refresh_token"],
            "requires_auth": True,
        },
    ])
    mock.toolkits_authorize = AsyncMock(return_value={
        "connect_link_id": "cl-12345",
        "redirect_url": "https://composio.dev/connect/cl-12345",
    })
    mock.wait_for_connection = AsyncMock(return_value={
        "status": "connected",
        "granted_scopes": ["crm.contacts.read", "crm.contacts.write"],
        "metadata": {"connected_at": datetime.now(timezone.utc).isoformat()},
    })
    return mock


@pytest.fixture()
def supabase_mock():
    """Mock Supabase client wrapper."""
    mock = Mock()
    mock.log_mission_connection = AsyncMock(return_value={
        "mission_id": "mission-1",
        "toolkit_slug": "hubspot",
        "connect_link_id": "cl-12345",
        "granted_scopes": ["crm.contacts.read", "crm.contacts.write"],
    })
    mock.log_data_inspection_check = AsyncMock(return_value={
        "mission_id": "mission-1",
        "toolkit_slug": "hubspot",
        "sample_count": 1,
    })
    mock.update_mission_stage_status = AsyncMock(return_value={
        "mission_id": "mission-1",
        "stage": "Prepare",
        "status": "in_progress",
    })
    return mock


@pytest.fixture()
def telemetry_mock():
    """Mock telemetry client."""

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
    async def _factory(agent: InspectorAgent, state: dict[str, Any]) -> InvocationContext:
        session = await session_service.create_session(
            app_name="ai-employee-control-plane",
            user_id=state.get("user_id", "user-1"),
            state=state,
        )
        return InvocationContext(
            session_service=session_service,
            session=session,
            agent=agent,
            invocation_id="test-inspector",
        )

    return _factory


async def _consume(agent: InspectorAgent, ctx: InvocationContext) -> list[Any]:
    return [event async for event in agent._run_async_impl(ctx)]


@pytest.mark.asyncio
async def test_discovery_phase_populates_session_state(
    make_context,
    composio_mock,
    supabase_mock,
    telemetry_mock,
):
    inspector = InspectorAgent(
        name="Inspector",
        composio_client=composio_mock,
        supabase_client=supabase_mock,
        telemetry=telemetry_mock,
    )

    ctx = await make_context(
        inspector,
        state={
            "mission_id": "mission-1",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
            "mission_brief": {"objective": "Sync HubSpot contacts"},
        },
    )

    events = await _consume(inspector, ctx)

    assert "anticipated_connections" in ctx.session.state
    assert ctx.session.state["coverage_estimate"] is not None
    assert ctx.session.state["readiness_status"] in {"ready", "insufficient_coverage"}
    assert "inspection_previews" in ctx.session.state

    previews = ctx.session.state["inspection_previews"]
    assert "hubspot" in previews
    assert previews["hubspot"]["sample_count"] == 1
    assert "sample_records" in previews["hubspot"]
    assert previews["hubspot"]["pii_flags"] == {
        "contains_email": False,
        "contains_phone": False,
        "contains_account_id": False,
    }

    # Telemetry & stage status
    event_names = [name for name, _payload in telemetry_mock.calls]
    assert "composio_discovery" in event_names
    assert "toolkit_recommended" in event_names
    assert "data_preview_generated" in event_names
    assert "readiness_status_changed" in event_names
    assert supabase_mock.update_mission_stage_status.called

    discovery_events = [event for event in events if event.custom_metadata.get("phase") == "discovery"]
    assert discovery_events


@pytest.mark.asyncio
async def test_discovery_uses_cache(make_context, composio_mock, supabase_mock, telemetry_mock):
    inspector = InspectorAgent(
        name="Inspector",
        composio_client=composio_mock,
        supabase_client=supabase_mock,
        telemetry=telemetry_mock,
        discovery_cache_ttl_seconds=3600,
    )

    ctx = await make_context(
        inspector,
        state={
            "mission_id": "mission-1",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
            "mission_brief": {"objective": "Sync HubSpot contacts"},
        },
    )

    await inspector._discover_toolkits(ctx, ctx.session.state["mission_brief"])
    await inspector._discover_toolkits(ctx, ctx.session.state["mission_brief"])

    assert composio_mock.tools_search.call_count == 1
    events = [payload for name, payload in telemetry_mock.calls if name == "composio_discovery"]
    assert events[-1]["cached"] is True


@pytest.mark.asyncio
async def test_oauth_waits_for_approval(make_context, composio_mock, supabase_mock, telemetry_mock):
    inspector = InspectorAgent(
        name="Inspector",
        composio_client=composio_mock,
        supabase_client=supabase_mock,
        telemetry=telemetry_mock,
    )

    ctx = await make_context(
        inspector,
        state={
            "mission_id": "mission-1",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
            "mission_brief": {"objective": "Sync contacts"},
            "anticipated_connections": [
                {
                    "toolkit_slug": "hubspot",
                    "anticipated_scopes": ["crm.read"],
                    "connection_required": True,
                }
            ],
        },
    )

    events = await _consume(inspector, ctx)

    composio_mock.toolkits_authorize.assert_not_called()
    pending_event = next(
        (event for event in events if event.custom_metadata.get("phase") == "pending_approval"),
        None,
    )
    assert pending_event is not None


@pytest.mark.asyncio
async def test_denied_connect_link_updates_stage(make_context, composio_mock, supabase_mock, telemetry_mock):
    inspector = InspectorAgent(
        name="Inspector",
        composio_client=composio_mock,
        supabase_client=supabase_mock,
        telemetry=telemetry_mock,
    )

    ctx = await make_context(
        inspector,
        state={
            "mission_id": "mission-1",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
            "mission_brief": {"objective": "Sync contacts"},
            "anticipated_connections": [
                {
                    "toolkit_slug": "hubspot",
                    "anticipated_scopes": ["crm.read"],
                    "connection_required": True,
                }
            ],
            "connect_link_decision": {"status": "denied"},
        },
    )

    await _consume(inspector, ctx)

    supabase_mock.update_mission_stage_status.assert_any_call(
        mission_id="mission-1",
        stage="Prepare",
        status="blocked",
        readiness_state="insufficient_coverage",
        blocking_reason="connect_link_denied",
    )


@pytest.mark.asyncio
async def test_oauth_initiates_after_approval(make_context, composio_mock, supabase_mock, telemetry_mock):
    inspector = InspectorAgent(
        name="Inspector",
        composio_client=composio_mock,
        supabase_client=supabase_mock,
        telemetry=telemetry_mock,
    )

    ctx = await make_context(
        inspector,
        state={
            "mission_id": "mission-1",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
            "mission_brief": {"objective": "Sync contacts"},
            "anticipated_connections": [
                {
                    "toolkit_slug": "hubspot",
                    "anticipated_scopes": ["crm.read"],
                    "connection_required": True,
                }
            ],
            "connect_link_decision": {"status": "approved"},
        },
    )

    await _consume(inspector, ctx)

    composio_mock.toolkits_authorize.assert_called_once()
    kwargs = composio_mock.toolkits_authorize.await_args.kwargs
    assert kwargs.get("scopes") == ["crm.read"]
    supabase_mock.log_mission_connection.assert_called_once()
    assert ctx.session.state["granted_scopes"]
    connect_links = ctx.session.state.get("connect_links", [])
    assert connect_links
    assert connect_links[0]["toolkit_slug"] == "hubspot"
    assert connect_links[0]["status"] == "connected"
    assert "redirect_url" in connect_links[0]


@pytest.mark.asyncio
async def test_readiness_thresholds(make_context, composio_mock, supabase_mock, telemetry_mock):
    inspector = InspectorAgent(
        name="Inspector",
        composio_client=composio_mock,
        supabase_client=supabase_mock,
        telemetry=telemetry_mock,
        readiness_threshold=0.85,
    )

    ctx = await make_context(
        inspector,
        state={
            "mission_id": "mission-1",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
            "mission_brief": {"objective": "Complex integration"},
        },
    )

    await _consume(inspector, ctx)

    readiness = ctx.session.state["readiness_status"]
    coverage = ctx.session.state["coverage_estimate"]
    if coverage >= 0.85:
        assert readiness == "ready"
    else:
        assert readiness == "insufficient_coverage"


@pytest.mark.asyncio
async def test_missing_mission_brief_raises_error(make_context, composio_mock, supabase_mock, telemetry_mock):
    inspector = InspectorAgent(
        name="Inspector",
        composio_client=composio_mock,
        supabase_client=supabase_mock,
        telemetry=telemetry_mock,
    )

    ctx = await make_context(
        inspector,
        state={
            "mission_id": "mission-1",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
        },
    )

    with pytest.raises(RuntimeError):
        await _consume(inspector, ctx)

    assert any(event == "inspector_error" for event, _payload in telemetry_mock.calls)


@pytest.mark.asyncio
async def test_oauth_error_handling(make_context, composio_mock, supabase_mock, telemetry_mock):
    composio_mock.toolkits_authorize = AsyncMock(side_effect=RuntimeError("OAuth timeout"))

    inspector = InspectorAgent(
        name="Inspector",
        composio_client=composio_mock,
        supabase_client=supabase_mock,
        telemetry=telemetry_mock,
    )

    ctx = await make_context(
        inspector,
        state={
            "mission_id": "mission-1",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
            "mission_brief": {"objective": "Sync contacts"},
            "anticipated_connections": [
                {
                    "toolkit_slug": "hubspot",
                    "anticipated_scopes": ["crm.read"],
                    "connection_required": True,
                }
            ],
            "connect_link_decision": {"status": "approved"},
        },
    )

    await _consume(inspector, ctx)

    error_events = [payload for event, payload in telemetry_mock.calls if event == "composio_auth_flow" and payload.get("status") == "error"]
    assert error_events


def test_cache_key_computation():
    inspector = InspectorAgent(name="Inspector")
    key1 = inspector._compute_cache_key("Sync HubSpot contacts")
    key2 = inspector._compute_cache_key("Sync HubSpot contacts")
    key3 = inspector._compute_cache_key("Different objective")

    assert key1 == key2
    assert key1 != key3
    assert len(key1) == 16


@pytest.mark.asyncio
async def test_cache_expiry():
    inspector = InspectorAgent(
        name="Inspector",
        discovery_cache_ttl_seconds=1,
    )

    cached = DiscoveryResult(
        toolkits=[],
        coverage_estimate=0.5,
        readiness_status="ready",
        cached_at=datetime.now(timezone.utc),
        cache_key="test-key",
        inspection_previews={},
    )

    assert inspector._is_cache_valid(cached) is True

    import time

    time.sleep(1.1)

    assert inspector._is_cache_valid(cached) is False


@pytest.mark.asyncio
async def test_data_preview_logging(make_context, composio_mock, supabase_mock, telemetry_mock):
    inspector = InspectorAgent(
        name="Inspector",
        composio_client=composio_mock,
        supabase_client=supabase_mock,
        telemetry=telemetry_mock,
    )

    ctx = await make_context(
        inspector,
        state={
            "mission_id": "mission-1",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
            "mission_brief": {"objective": "Sync HubSpot contacts"},
        },
    )

    await _consume(inspector, ctx)

    assert supabase_mock.log_data_inspection_check.called
    preview_events = [event for event, _payload in telemetry_mock.calls if event == "data_preview_generated"]
    assert preview_events


@pytest.mark.asyncio
async def test_stage_status_updates(make_context, composio_mock, supabase_mock, telemetry_mock):
    inspector = InspectorAgent(
        name="Inspector",
        composio_client=composio_mock,
        supabase_client=supabase_mock,
        telemetry=telemetry_mock,
    )

    ctx = await make_context(
        inspector,
        state={
            "mission_id": "mission-1",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
            "mission_brief": {"objective": "Sync HubSpot contacts"},
            "connect_link_decision": {"status": "approved"},
        },
    )

    await _consume(inspector, ctx)

    assert supabase_mock.update_mission_stage_status.call_count >= 2


@pytest.mark.asyncio
async def test_oauth_telemetry_lifecycle(make_context, composio_mock, supabase_mock, telemetry_mock):
    inspector = InspectorAgent(
        name="Inspector",
        composio_client=composio_mock,
        supabase_client=supabase_mock,
        telemetry=telemetry_mock,
    )

    ctx = await make_context(
        inspector,
        state={
            "mission_id": "mission-1",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
            "mission_brief": {"objective": "Sync contacts"},
            "anticipated_connections": [
                {
                    "toolkit_slug": "hubspot",
                    "anticipated_scopes": ["crm.read"],
                    "connection_required": True,
                }
            ],
            "connect_link_decision": {"status": "approved"},
        },
    )

    await _consume(inspector, ctx)

    auth_events = [payload for name, payload in telemetry_mock.calls if name == "composio_auth_flow"]
    statuses = {event["status"] for event in auth_events}
    assert {"initiated", "link_ready", "approved"}.issubset(statuses)


@pytest.mark.asyncio
async def test_toolkit_recommended_events(make_context, composio_mock, supabase_mock, telemetry_mock):
    inspector = InspectorAgent(
        name="Inspector",
        composio_client=composio_mock,
        supabase_client=supabase_mock,
        telemetry=telemetry_mock,
    )

    ctx = await make_context(
        inspector,
        state={
            "mission_id": "mission-1",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
            "mission_brief": {"objective": "Sync HubSpot contacts"},
        },
    )

    await _consume(inspector, ctx)

    recommended = [payload for name, payload in telemetry_mock.calls if name == "toolkit_recommended"]
    assert len(recommended) == 2
    assert recommended[0]["rank"] == 1
    assert recommended[1]["rank"] == 2


@pytest.mark.asyncio
async def test_readiness_coverage_threshold_integration(make_context, composio_mock, supabase_mock, telemetry_mock):
    inspector = InspectorAgent(
        name="Inspector",
        composio_client=composio_mock,
        supabase_client=supabase_mock,
        telemetry=telemetry_mock,
        readiness_threshold=0.85,
    )

    ctx = await make_context(
        inspector,
        state={
            "mission_id": "mission-1",
            "tenant_id": "tenant-42",
            "user_id": "user-99",
            "mission_brief": {"objective": "Sync HubSpot contacts"},
            "connect_link_decision": {"status": "approved"},
        },
    )

    await _consume(inspector, ctx)

    readiness = ctx.session.state["readiness_status"]
    coverage = ctx.session.state["coverage_estimate"]

    assert (readiness == "ready") == (coverage >= 0.85)
