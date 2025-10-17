"""Unit tests for ValidatorAgent safeguard enforcement."""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

import pytest
import pytest_asyncio
from google.adk.agents.invocation_context import InvocationContext
from google.adk.sessions import InMemorySessionService

from agent.agents.validator import (
    Safeguard,
    ValidationSeverity,
    ValidationStatus,
    ValidatorAgent,
)


class TelemetryStub:
    def __init__(self) -> None:
        self.events: list[tuple[str, dict[str, Any]]] = []

    def emit(self, event: str, payload: dict[str, Any]) -> None:
        self.events.append((event, payload))


class ComposioStub:
    def __init__(self, scopes: dict[str, list[str]]) -> None:
        self.scopes = scopes
        self.calls: list[tuple[str, str]] = []

    async def connected_accounts_status(self, *, user_id: str, tenant_id: str) -> list[dict[str, Any]]:
        self.calls.append((user_id, tenant_id))
        return [
            {"toolkit": toolkit, "scopes": values, "status": "active"}
            for toolkit, values in self.scopes.items()
        ]


@pytest_asyncio.fixture()
async def session_service() -> InMemorySessionService:
    return InMemorySessionService()


@pytest_asyncio.fixture()
async def make_context(session_service: InMemorySessionService):
    async def _factory(agent: ValidatorAgent, *, state: dict[str, Any]) -> InvocationContext:
        session = await session_service.create_session(
            app_name="ai-employee-control-plane",
            user_id=state.get("user_id", "user-1"),
            state=state,
        )
        return InvocationContext(
            session_service=session_service,
            session=session,
            agent=agent,
            invocation_id="validator-test",
        )

    return _factory


@pytest.mark.asyncio
async def test_validate_scopes_uses_composio(make_context) -> None:
    telemetry = TelemetryStub()
    composio = ComposioStub({"hubspot": ["crm.read", "crm.write"]})
    validator = ValidatorAgent(name="validator", telemetry=telemetry, composio_client=composio)

    ctx = await make_context(
        validator,
        state={
            "mission_id": "mission-1",
            "tenant_id": "tenant-1",
            "user_id": "user-1",
        },
    )

    result = await validator.validate_scopes(ctx, ["crm.read", "crm.write"])

    assert result.alignment_status is ValidationStatus.PASSED
    assert composio.calls == [("user-1", "tenant-1")]
    assert any(event == "validator_scope_check" for event, _ in telemetry.events)
    assert ctx.session.state["validation_results"]


@pytest.mark.asyncio
async def test_validate_scopes_missing_scopes(make_context) -> None:
    telemetry = TelemetryStub()
    validator = ValidatorAgent(name="validator", telemetry=telemetry)

    ctx = await make_context(
        validator,
        state={
            "mission_id": "mission-2",
            "tenant_id": "tenant-2",
            "user_id": "user-2",
            "granted_scopes": ["crm.read"],
        },
    )

    result = await validator.validate_scopes(ctx, ["crm.read", "gmail.send"])

    assert result.alignment_status is ValidationStatus.FAILED
    assert result.missing_scopes == ["gmail.send"]
    assert any(event == "validator_override_requested" for event, _ in telemetry.events)


@pytest.mark.asyncio
async def test_preflight_rate_limit_autofix(make_context) -> None:
    telemetry = TelemetryStub()
    validator = ValidatorAgent(name="validator", telemetry=telemetry)

    ctx = await make_context(
        validator,
        state={
            "mission_id": "mission-3",
            "tenant_id": "tenant-3",
            "user_id": "user-3",
            "validator_recent_calls": {"hubspot": 10},
            "safeguards": [
                {
                    "id": "sg-rate",
                    "category": "rate_limits",
                    "rule": "Limit HubSpot calls",
                    "metadata": {"max_calls_per_minute": 5},
                }
            ],
        },
    )

    action = {"name": "create_contact", "toolkit": "hubspot"}
    results = await validator.preflight_check(ctx, action)

    assert results[0].status is ValidationStatus.AUTO_FIXED
    assert ctx.session.state["auto_fix_attempts"][0]["success"] is True
    assert any(event == "validator_auto_fix_applied" for event, _ in telemetry.events)


@pytest.mark.asyncio
async def test_preflight_failure_triggers_alert(make_context) -> None:
    telemetry = TelemetryStub()
    validator = ValidatorAgent(name="validator", telemetry=telemetry)

    safeguard = Safeguard(
        id="sg-critical",
        category="rate_limits",
        rule="Enforce hard rate limit",
        auto_fix_enabled=False,
        severity=ValidationSeverity.CRITICAL,
        metadata={"max_calls_per_minute": 1},
    )

    ctx = await make_context(
        validator,
        state={
            "mission_id": "mission-4",
            "tenant_id": "tenant-4",
            "user_id": "user-4",
            "validator_recent_calls": {"*": 5},
            "safeguards": [asdict(safeguard)],
        },
    )

    action = {"name": "bulk_send", "toolkit": "gmail"}
    results = await validator.preflight_check(ctx, action)

    assert results[0].status is ValidationStatus.FAILED
    events = [event for event, _ in telemetry.events]
    assert "validator_alert_raised" in events
    assert "validator_override_requested" in events


@pytest.mark.asyncio
async def test_run_async_emits_events(make_context) -> None:
    telemetry = TelemetryStub()
    validator = ValidatorAgent(name="validator", telemetry=telemetry)

    ctx = await make_context(
        validator,
        state={
            "mission_id": "mission-5",
            "tenant_id": "tenant-5",
            "user_id": "user-5",
            "granted_scopes": ["crm.read"],
            "required_scopes": ["crm.read"],
            "current_action": {"name": "noop", "toolkit": "hubspot"},
        },
    )

    events = []
    async for event in validator._run_async_impl(ctx):  # pylint: disable=protected-access
        events.append(event)

    assert events
    def metadata(event: Any) -> dict[str, Any]:
        data = getattr(event, "customMetadata", None)
        if data is None:
            data = getattr(event, "custom_metadata", {})
        return data or {}

    assert any(metadata(e).get("type") == "scope_validation" for e in events)
