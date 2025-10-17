"""Unit tests for persona-agnostic IntakeAgent mission brief generation."""

from __future__ import annotations

from typing import Any

import pytest
import pytest_asyncio
from google.adk.agents.invocation_context import InvocationContext
from google.adk.sessions import InMemorySessionService

from agent.agents import DEFAULT_SAFEGUARDS, IntakeAgent
from agent.services import SupabaseClientWrapper


class TelemetryStub:
    def __init__(self) -> None:
        self.events: list[tuple[str, dict[str, Any]]] = []

    def emit(self, event: str, payload: dict[str, Any]) -> None:  # pragma: no cover - tiny helper
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
                "mission_intent": "Re-engage high value manufacturing accounts with targeted outreach.",
            },
        ),
    )

    events = await _consume(agent, ctx)

    mission_brief = ctx.session.state["mission_brief"]
    assert mission_brief["objective"].startswith("Re-engage")
    assert "persona" not in mission_brief
    assert ctx.session.state["confidence_scores"]["objective"] >= 0.6

    safeguard_descriptions = {item["description"] for item in ctx.session.state["safeguards"]}
    assert safeguard_descriptions.issuperset(DEFAULT_SAFEGUARDS)

    assert supabase.metadata_payloads  # persisted brief
    assert supabase.safeguard_payloads

    assert events  # guardrail: narration emitted

    telemetry_events = {name for name, _payload in telemetry.events}
    assert telemetry_events.issuperset({"intent_submitted", "brief_generated"})
    for _event, payload in telemetry.events:
        assert "persona" not in payload


@pytest.mark.asyncio
async def test_applies_hints_over_defaults(make_context) -> None:
    telemetry = TelemetryStub()
    agent = IntakeAgent(name="Intake", telemetry=telemetry)

    ctx = await make_context(
        agent,
        state=_base_state(
            {
                "mission_intent": "Accelerate onboarding flow for beta customers.",
                "mission_inputs": {
                    "kpi": "Increase activation rate to 70%",
                    "timeline": "Within 14 days",
                },
            },
        ),
    )

    await _consume(agent, ctx)

    mission_brief = ctx.session.state["mission_brief"]
    assert mission_brief["kpi"] == "Increase activation rate to 70%"
    assert mission_brief["timeline"] == "Within 14 days"

    confidence_scores = ctx.session.state["confidence_scores"]
    assert confidence_scores["kpi"] >= 0.8
    assert confidence_scores["timeline"] >= 0.8


@pytest.mark.asyncio
async def test_preserves_existing_brief_fields(make_context) -> None:
    telemetry = TelemetryStub()
    agent = IntakeAgent(name="Intake", telemetry=telemetry)

    ctx = await make_context(
        agent,
        state=_base_state(
            {
                "mission_intent": "Draft new customer advocacy program.",
                "mission_brief": {
                    "objective": "Launch advocacy pilot",
                    "audience": "Top advocates",
                },
            },
        ),
    )

    await _consume(agent, ctx)

    mission_brief = ctx.session.state["mission_brief"]
    assert mission_brief["objective"] == "Launch advocacy pilot"
    assert mission_brief["audience"] == "Top advocates"

    confidence_scores = ctx.session.state["confidence_scores"]
    assert confidence_scores["objective"] == pytest.approx(1.0)
    assert confidence_scores["audience"] == pytest.approx(1.0)


@pytest.mark.asyncio
async def test_persist_failures_emit_error(make_context) -> None:
    telemetry = TelemetryStub()
    supabase = SupabaseWrapperStub(fail_metadata=True, fail_safeguard=True)
    agent = IntakeAgent(name="Intake", telemetry=telemetry, supabase_client=supabase)

    ctx = await make_context(
        agent,
        state=_base_state(
            {
                "mission_intent": "Compile compliance evidence pack.",
            },
        ),
    )

    await _consume(agent, ctx)

    error_events = [payload for event, payload in telemetry.events if event == "intake_error"]
    reasons = {payload["reason"] for payload in error_events}
    assert reasons == {"metadata_persist_failed", "safeguard_persist_failed"}

