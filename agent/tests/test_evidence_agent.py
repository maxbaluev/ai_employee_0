"""Tests for EvidenceAgent Stage 5-6 artifact packaging."""

from __future__ import annotations

from typing import Any

import pytest
import pytest_asyncio
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.adk.sessions import InMemorySessionService

from agent.agents.evidence import EvidenceAgent
from agent.services import ComposioClientWrapper, SupabaseClientWrapper, TelemetryClient


class StubTelemetry(TelemetryClient):
    def __init__(self) -> None:
        super().__init__(destination="memory")
        self.events: list[tuple[str, dict[str, Any]]] = []

    def emit(self, event_name: str, payload: dict[str, Any]) -> None:  # type: ignore[override]
        self.events.append((event_name, payload))


class FakeSupabase(SupabaseClientWrapper):
    def __init__(self) -> None:
        super().__init__(client=None)
        self.artifacts: list[dict[str, Any]] = []
        self.evidence: list[dict[str, Any]] = []
        self.contributions: list[dict[str, Any]] = []
        self.rating: float = 5.0

    async def store_artifact(self, *, payload: dict[str, Any], raw_content: Any | None = None) -> dict[str, Any]:  # type: ignore[override]
        entry = dict(payload)
        entry.setdefault("id", f"artifact-{len(self.artifacts)+1}")
        self.artifacts.append(entry)
        return entry

    async def store_evidence(self, *, bundle: dict[str, Any]) -> dict[str, Any]:  # type: ignore[override]
        entry = dict(bundle)
        self.evidence.append(entry)
        return entry

    async def fetch_feedback_rating(self, *, mission_id: str) -> float | None:  # type: ignore[override]
        return float(self.rating)

    async def store_library_contribution(  # type: ignore[override]
        self,
        *,
        mission_id: str,
        contribution: dict[str, Any],
    ) -> dict[str, Any]:
        entry = dict(contribution)
        entry["mission_id"] = mission_id
        self.contributions.append(entry)
        return entry


class FakeComposio(ComposioClientWrapper):
    def __init__(self, events: list[dict[str, Any]]) -> None:
        super().__init__(client=None)
        self._events = events

    async def audit_list_events(  # type: ignore[override]
        self,
        *,
        mission_id: str,
        tenant_id: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        return list(self._events)


@pytest_asyncio.fixture()
async def session_service() -> InMemorySessionService:
    return InMemorySessionService()


@pytest_asyncio.fixture()
async def make_context(session_service: InMemorySessionService):
    async def _factory(agent: EvidenceAgent, state: dict[str, Any]) -> InvocationContext:
        session = await session_service.create_session(
            app_name="ai-employee-control-plane",
            user_id=state.get("user_id", "tester"),
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
async def test_evidence_agent_generates_bundle(make_context) -> None:
    supabase = FakeSupabase()
    telemetry = StubTelemetry()
    composio = FakeComposio(events=[{"action_id": "action-1", "payload": {"undo_hint": "revert"}}])
    agent = EvidenceAgent(
        name="EvidenceAgent",
        supabase_client=supabase,
        telemetry=telemetry,
        composio_client=composio,
    )

    ctx = await make_context(
        agent,
        state={
            "mission_id": "00000000-0000-0000-0000-000000000001",
            "tenant_id": "tenant-1",
            "user_id": "user-1",
            "execution_results": [
                {
                    "action_id": "action-1",
                    "artifact_type": "email_draft",
                    "name": "Draft outreach",
                    "output": {"subject": "Hello"},
                    "metrics": {
                        "records_touched": 3,
                        "time_saved_hours": 1.5,
                        "total_actions": 3,
                        "automated_actions": 3,
                    },
                    "safeguard_results": [{"category": "privacy", "status": "enforced"}],
                    "undo_plan_id": "undo-1",
                    "redaction_state": "redacted",
                }
            ],
            "undo_plans": [
                {
                    "undo_id": "undo-1",
                    "steps": ["Delete drafts"],
                    "label": "Revert send",
                }
            ],
            "ranked_plays": [
                {
                    "id": "play-1",
                    "title": "Re-engage dormant accounts",
                    "summary": "Send personalised outreach",
                    "category": "revops",
                }
            ],
        },
    )

    events: list[Event] = [event async for event in agent._run_async_impl(ctx)]

    assert ctx.session.state["evidence_bundles"], "Evidence bundle should be stored in session state"
    bundle = ctx.session.state["evidence_bundles"][0]
    assert bundle["artifacts"][0]["hash"], "Artifact hash should be generated"
    assert ctx.session.state["rollback_instructions"], "Undo hints should be captured"
    assert ctx.session.state["library_contributions"], "Library contribution should be suggested for high rating"
    assert supabase.artifacts, "Artifacts should be persisted via Supabase wrapper"
    assert supabase.evidence, "Evidence bundles should be persisted"
    assert supabase.contributions, "Library contributions should be persisted"
    assert any(name == "evidence_bundle_generated" for name, _ in telemetry.events)
    assert events and events[0].custom_metadata.get("stage") == "REFLECT"


@pytest.mark.asyncio
async def test_evidence_agent_skips_library_when_rating_low(make_context) -> None:
    supabase = FakeSupabase()
    supabase.rating = 2.0
    agent = EvidenceAgent(
        name="EvidenceAgent",
        supabase_client=supabase,
        telemetry=StubTelemetry(),
        composio_client=FakeComposio(events=[]),
    )

    ctx = await make_context(
        agent,
        state={
            "mission_id": "00000000-0000-0000-0000-000000000002",
            "tenant_id": "tenant-1",
            "user_id": "user-1",
            "execution_results": [
                {
                    "action_id": "action-low",
                    "artifact_type": "summary",
                    "output": {"value": "ok"},
                    "metrics": {"records_touched": 1},
                }
            ],
        },
    )

    _ = [event async for event in agent._run_async_impl(ctx)]

    assert "library_contributions" not in ctx.session.state
    assert not supabase.contributions


@pytest.mark.asyncio
async def test_missing_context_emits_error(make_context) -> None:
    agent = EvidenceAgent(name="EvidenceAgent")
    ctx = await make_context(agent, state={})

    events = [event async for event in agent._run_async_impl(ctx)]

    assert events
    assert events[0].custom_metadata.get("type") == "error"
