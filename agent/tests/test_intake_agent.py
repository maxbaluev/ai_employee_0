"""Unit tests for IntakeAgent mission brief generation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest
import pytest_asyncio
from google.adk.agents.invocation_context import InvocationContext
from google.adk.sessions import InMemorySessionService

from agent.agents import IntakeAgent, PersonaType
from agent.services import SupabaseClientWrapper


class TelemetryStub:
    def __init__(self) -> None:
        self.events: list[tuple[str, dict[str, Any]]] = []

    def emit(self, event: str, payload: dict[str, Any]) -> None:
        self.events.append((event, payload))


class SupabaseWrapperStub(SupabaseClientWrapper):
    """Stub wrapper to capture metadata and safeguard writes."""

    def __init__(self, *, fail_metadata: bool = False, fail_safeguard: bool = False) -> None:
        super().__init__(client=object())
        self.fail_metadata = fail_metadata
        self.fail_safeguard = fail_safeguard
        self.metadata_payloads: list[dict[str, Any]] = []
        self.safeguard_payloads: list[dict[str, Any]] = []

    async def upsert_mission_metadata(
        self,
        *,
        mission_id: str,
        metadata_key: str,
        metadata_value: dict[str, Any],
        source_stage: str | None = None,
    ) -> dict[str, Any]:
        if self.fail_metadata:
            raise RuntimeError("metadata failure")
        payload = {
            "mission_id": mission_id,
            "metadata_key": metadata_key,
            "metadata_value": metadata_value,
            "source_stage": source_stage,
        }
        self.metadata_payloads.append(payload)
        return payload

    async def insert_mission_safeguard(
        self,
        *,
        mission_id: str,
        category: str,
        description: str,
        severity: str = "medium",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if self.fail_safeguard:
            raise RuntimeError("safeguard failure")
        payload = {
            "mission_id": mission_id,
            "category": category,
            "description": description,
            "severity": severity,
            "metadata": metadata or {},
        }
        self.safeguard_payloads.append(payload)
        return payload


@pytest_asyncio.fixture()
async def session_service() -> InMemorySessionService:
    return InMemorySessionService()


@pytest_asyncio.fixture()
async def make_context(session_service: InMemorySessionService):
    async def _factory(agent: IntakeAgent, state: dict[str, Any]) -> InvocationContext:
        session = await session_service.create_session(
            app_name="ai-employee-control-plane",
            user_id=state.get("user_id", "user-1"),
            state=state,
        )
        return InvocationContext(
            session_service=session_service,
            session=session,
            agent=agent,
            invocation_id="intake-test",
        )

    return _factory


def _base_state(overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    state = {
        "mission_id": "mission-123",
        "tenant_id": "tenant-abc",
        "user_id": "user-xyz",
    }
    if overrides:
        state.update(overrides)
    return state


async def _consume(agent: IntakeAgent, ctx: InvocationContext) -> list[Any]:
    return [event async for event in agent._run_async_impl(ctx)]


@pytest.mark.asyncio
async def test_generates_brief_and_safeguards(make_context) -> None:
    telemetry = TelemetryStub()
    supabase = SupabaseWrapperStub()
    agent = IntakeAgent(name="Intake", telemetry=telemetry, supabase_client=supabase)

    ctx = await make_context(
        agent,
        state=_base_state(
            {
                "mission_intent": "Re-engage high value manufacturing accounts with targeted outreach",
                "mission_persona": "revops",
            },
        ),
    )

    events = [event async for event in agent._run_async_impl(ctx)]

    mission_brief = ctx.session.state["mission_brief"]
    assert mission_brief["objective"].startswith("Re-engage")
    assert mission_brief["persona"] == PersonaType.REVOPS.value
    assert ctx.session.state["safeguards"]
    assert ctx.session.state["confidence_scores"]["objective"] >= 0.6
    assert len(supabase.metadata_payloads) == 1
    assert supabase.metadata_payloads[0]["metadata_key"] == "mission_brief"
    assert supabase.safeguard_payloads

    assert events  # guardrail: events were emitted

    telemetry_events = {name for name, _payload in telemetry.events}
    assert "intent_submitted" in telemetry_events
    assert "brief_generated" in telemetry_events


@pytest.mark.asyncio
async def test_respects_existing_brief(make_context) -> None:
    telemetry = TelemetryStub()
    supabase = SupabaseWrapperStub()
    agent = IntakeAgent(name="Intake", telemetry=telemetry, supabase_client=supabase)

    existing_brief = {
        "objective": "Keep the original objective",
        "audience": "Existing customers",
    }

    ctx = await make_context(
        agent,
        state=_base_state(
            {
                "mission_intent": "Update onboarding playbook",
                "mission_persona": "support",
                "mission_brief": existing_brief,
            },
        ),
    )

    await _consume(agent, ctx)
    mission_brief = ctx.session.state["mission_brief"]

    assert mission_brief["objective"] == "Keep the original objective"
    assert mission_brief["audience"] == "Existing customers"
    assert mission_brief["timeline"]


@pytest.mark.asyncio
async def test_missing_intent_raises(make_context) -> None:
    telemetry = TelemetryStub()
    agent = IntakeAgent(name="Intake", telemetry=telemetry)

    ctx = await make_context(agent, state=_base_state())

    with pytest.raises(RuntimeError):
        async for _event in agent._run_async_impl(ctx):
            pass

    assert any(event == "intake_error" for event, _payload in telemetry.events)


@pytest.mark.asyncio
async def test_governance_safeguards(make_context) -> None:
    telemetry = TelemetryStub()
    agent = IntakeAgent(name="Intake", telemetry=telemetry)

    ctx = await make_context(
        agent,
        state=_base_state(
            {
                "mission_intent": "Compile evidence pack for Q4 compliance audit",
                "mission_persona": "governance",
            },
        ),
    )

    await _consume(agent, ctx)

    safeguards = ctx.session.state["safeguards"]
    descriptions = {s.get("description") for s in safeguards}
    assert any("audit" in (desc or "").lower() for desc in descriptions)


@pytest.mark.asyncio
async def test_confidence_scores_within_range(make_context) -> None:
    telemetry = TelemetryStub()
    agent = IntakeAgent(name="Intake", telemetry=telemetry)

    ctx = await make_context(
        agent,
        state=_base_state(
            {
                "mission_intent": "Ship new billing automation without disrupting invoices",
            },
        ),
    )

    await _consume(agent, ctx)

    scores = ctx.session.state["confidence_scores"]
    for value in scores.values():
        assert 0.0 <= value <= 1.0


@pytest.mark.asyncio
async def test_supabase_failure_emits_error(make_context) -> None:
    telemetry = TelemetryStub()
    supabase = SupabaseWrapperStub(fail_metadata=True, fail_safeguard=True)
    agent = IntakeAgent(name="Intake", telemetry=telemetry, supabase_client=supabase)

    ctx = await make_context(
        agent,
        state=_base_state(
            {
                "mission_intent": "Launch quickstart mission for beta customers",
            },
        ),
    )

    events = [event async for event in agent._run_async_impl(ctx)]

    assert any(event == "intake_error" for event, _payload in telemetry.events)
    assert events  # still emits progress events despite failures
