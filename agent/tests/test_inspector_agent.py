"""Tests for InspectorAgent discovery and OAuth workflows."""

from __future__ import annotations

from datetime import datetime
from typing import Any, AsyncGenerator
from unittest.mock import AsyncMock, Mock

import pytest
import pytest_asyncio
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.adk.sessions import InMemorySessionService

from agent.agents.inspector import ConnectionResult, DiscoveryResult, InspectorAgent, ToolkitRecommendation


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
        "metadata": {"connected_at": datetime.utcnow().isoformat()},
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
            invocation_id="test-invocation",
        )

    return _factory


@pytest.mark.asyncio
async def test_discovery_phase_populates_anticipated_connections(
    make_context,
    composio_mock,
    supabase_mock,
    telemetry_mock,
):
    """Test Phase 1: Discovery populates anticipated_connections in session state."""
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
            "mission_brief": {
                "objective": "Sync HubSpot contacts with Salesforce",
                "audience": "Sales team",
            },
        },
    )

    events = [event async for event in inspector._run_async_impl(ctx)]

    # Assert discovery was called
    composio_mock.tools_search.assert_called_once()
    assert composio_mock.tools_search.call_args.kwargs["query"] == "Sync HubSpot contacts with Salesforce"

    # Assert session state populated
    assert "anticipated_connections" in ctx.session.state
    anticipated = ctx.session.state["anticipated_connections"]
    assert len(anticipated) == 2
    assert anticipated[0]["toolkit_slug"] == "hubspot"
    assert anticipated[0]["anticipated_scopes"] == ["crm.contacts.read", "crm.contacts.write"]
    assert anticipated[0]["connection_required"] is True

    # Assert coverage computed
    assert "coverage_estimate" in ctx.session.state
    assert "readiness_status" in ctx.session.state

    # Assert telemetry emitted
    discovery_events = [e for e, p in telemetry_mock.calls if e == "composio_discovery"]
    assert len(discovery_events) == 1

    # Assert event yielded
    discovery_phase_events = [e for e in events if e.custom_metadata.get("phase") == "discovery"]
    assert len(discovery_phase_events) >= 1


@pytest.mark.asyncio
async def test_discovery_uses_cache_on_second_call(
    make_context,
    composio_mock,
    supabase_mock,
    telemetry_mock,
):
    """Test that discovery results are cached for 1 hour."""
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
            "mission_brief": {
                "objective": "Sync HubSpot contacts",
            },
        },
    )

    # First discovery
    await inspector._discover_toolkits(ctx, ctx.session.state["mission_brief"])
    assert composio_mock.tools_search.call_count == 1

    # Second discovery with same objective should use cache
    await inspector._discover_toolkits(ctx, ctx.session.state["mission_brief"])
    assert composio_mock.tools_search.call_count == 1  # Still 1, not 2

    # Assert cached=True in telemetry
    discovery_events = [p for e, p in telemetry_mock.calls if e == "composio_discovery"]
    assert discovery_events[-1]["cached"] is True


@pytest.mark.asyncio
async def test_oauth_phase_waits_for_approval(
    make_context,
    composio_mock,
    supabase_mock,
    telemetry_mock,
):
    """Test Phase 2: OAuth waits for connect_link_decision.status == 'approved'."""
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
                    "purpose": "CRM integration",
                    "anticipated_scopes": ["crm.read"],
                    "connection_required": True,
                }
            ],
            # No connect_link_decision yet
        },
    )

    events = [event async for event in inspector._run_async_impl(ctx)]

    # OAuth should NOT be initiated
    composio_mock.toolkits_authorize.assert_not_called()
    assert "granted_scopes" not in ctx.session.state

    # Assert pending approval message
    pending_events = [e for e in events if e.custom_metadata.get("phase") == "pending_approval"]
    assert len(pending_events) == 1
    assert "Awaiting" in pending_events[0].content.parts[0].text


@pytest.mark.asyncio
async def test_oauth_phase_initiates_after_approval(
    make_context,
    composio_mock,
    supabase_mock,
    telemetry_mock,
):
    """Test Phase 2: OAuth initiates after approval and logs scopes."""
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
                    "purpose": "CRM integration",
                    "anticipated_scopes": ["crm.read"],
                    "connection_required": True,
                }
            ],
            "connect_link_decision": {"status": "approved"},
        },
    )

    events = [event async for event in inspector._run_async_impl(ctx)]

    # OAuth should be initiated
    composio_mock.toolkits_authorize.assert_called_once()
    assert composio_mock.toolkits_authorize.call_args.kwargs["toolkit_slug"] == "hubspot"
    assert composio_mock.toolkits_authorize.call_args.kwargs["user_id"] == "user-99"
    assert composio_mock.toolkits_authorize.call_args.kwargs["tenant_id"] == "tenant-42"

    # Wait for connection should be called
    composio_mock.wait_for_connection.assert_called_once()
    assert composio_mock.wait_for_connection.call_args.kwargs["connect_link_id"] == "cl-12345"

    # Supabase logging should be called
    supabase_mock.log_mission_connection.assert_called_once()
    log_args = supabase_mock.log_mission_connection.call_args.kwargs
    assert log_args["mission_id"] == "mission-1"
    assert log_args["toolkit_slug"] == "hubspot"
    assert log_args["granted_scopes"] == ["crm.contacts.read", "crm.contacts.write"]

    # Session state should have granted_scopes
    assert "granted_scopes" in ctx.session.state
    assert ctx.session.state["granted_scopes"] == ["crm.contacts.read", "crm.contacts.write"]

    # Readiness should be updated
    assert "readiness_status" in ctx.session.state

    # Telemetry should be emitted
    auth_events = [p for e, p in telemetry_mock.calls if e == "composio_auth_flow"]
    assert len(auth_events) >= 2  # initiated + approved
    assert auth_events[0]["status"] == "initiated"
    assert auth_events[-1]["status"] == "approved"

    # OAuth phase event should be yielded
    oauth_events = [e for e in events if e.custom_metadata.get("phase") == "oauth"]
    assert len(oauth_events) >= 1


@pytest.mark.asyncio
async def test_readiness_threshold_insufficient_coverage(
    make_context,
    composio_mock,
    supabase_mock,
    telemetry_mock,
):
    """Test readiness_status is 'insufficient_coverage' when below threshold."""
    # Mock fewer toolkits for low coverage
    composio_mock.tools_search = AsyncMock(return_value=[
        {
            "slug": "hubspot",
            "description": "HubSpot CRM",
            "scopes": ["crm.read"],
            "requires_auth": True,
        },
    ])

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
            "mission_brief": {
                "objective": "Complex multi-system integration requiring many toolkits",
            },
        },
    )

    await inspector._run_async_impl(ctx).__anext__()

    # Coverage should be low
    assert ctx.session.state["readiness_status"] == "insufficient_coverage"


@pytest.mark.asyncio
async def test_readiness_threshold_ready(
    make_context,
    composio_mock,
    supabase_mock,
    telemetry_mock,
):
    """Test readiness_status is 'ready' when coverage >= threshold."""
    # Mock many toolkits for high coverage
    composio_mock.tools_search = AsyncMock(return_value=[
        {"slug": f"toolkit-{i}", "description": f"Toolkit {i}", "scopes": [f"scope-{i}"], "requires_auth": True}
        for i in range(10)
    ])

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
            "mission_brief": {
                "objective": "Sync contacts",
            },
        },
    )

    await inspector._run_async_impl(ctx).__anext__()

    # Coverage should be high enough
    assert ctx.session.state["coverage_estimate"] >= inspector.readiness_threshold
    assert ctx.session.state["readiness_status"] == "ready"


@pytest.mark.asyncio
async def test_missing_mission_brief_raises_error(
    make_context,
    composio_mock,
    supabase_mock,
    telemetry_mock,
):
    """Test that missing mission_brief raises RuntimeError."""
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
            # mission_brief missing
        },
    )

    with pytest.raises(RuntimeError, match="Missing mission_brief"):
        async for _ in inspector._run_async_impl(ctx):
            pass

    # Error telemetry should be emitted
    error_events = [e for e, p in telemetry_mock.calls if e == "inspector_error"]
    assert len(error_events) == 1
    assert error_events[0][1]["error"] == "missing_mission_brief"


@pytest.mark.asyncio
async def test_oauth_error_handling(
    make_context,
    composio_mock,
    supabase_mock,
    telemetry_mock,
):
    """Test OAuth error handling during authorization."""
    # Mock OAuth failure
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
                    "purpose": "CRM",
                    "anticipated_scopes": ["crm.read"],
                    "connection_required": True,
                }
            ],
            "connect_link_decision": {"status": "approved"},
        },
    )

    events = [event async for event in inspector._run_async_impl(ctx)]

    # Error telemetry should be emitted
    auth_events = [p for e, p in telemetry_mock.calls if e == "composio_auth_flow"]
    error_auth_events = [p for p in auth_events if p.get("status") == "error"]
    assert len(error_auth_events) >= 1
    assert "OAuth timeout" in error_auth_events[0]["error"]


@pytest.mark.asyncio
async def test_cache_key_computation():
    """Test cache key generation is deterministic."""
    inspector = InspectorAgent(name="Inspector")

    key1 = inspector._compute_cache_key("Sync HubSpot contacts")
    key2 = inspector._compute_cache_key("Sync HubSpot contacts")
    key3 = inspector._compute_cache_key("Different objective")

    assert key1 == key2
    assert key1 != key3
    assert len(key1) == 16  # SHA-256 truncated to 16 chars


@pytest.mark.asyncio
async def test_cache_expiry():
    """Test cache expiry after TTL."""
    inspector = InspectorAgent(
        name="Inspector",
        discovery_cache_ttl_seconds=1,  # 1 second TTL
    )

    cached = DiscoveryResult(
        toolkits=[],
        coverage_estimate=0.5,
        readiness_status="ready",
        cached_at=datetime.utcnow(),
        cache_key="test-key",
    )

    # Immediately valid
    assert inspector._is_cache_valid(cached) is True

    # Mock time passage (in real test, would use freezegun or similar)
    import time
    time.sleep(1.1)

    # Should be expired
    assert inspector._is_cache_valid(cached) is False
