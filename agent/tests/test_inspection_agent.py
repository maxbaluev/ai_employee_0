"""Unit tests for the inspection readiness agent."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import pytest

from agent.agents.inspection import InspectionAgent
from agent.agents.state import (
    EVIDENCE_BUNDLE_KEY,
    INSPECTION_PREVIEW_KEY,
    MISSION_CONTEXT_KEY,
    SAFEGUARDS_KEY,
)
import types

from agent.services import (
    CatalogUnavailableError,
    CopilotKitStreamer,
    SupabaseClient,
    TelemetryEmitter,
)


class _DummySession:
    def __init__(self) -> None:
        self.state: Dict[str, Any] = {}


class _InvocationContext:
    def __init__(self) -> None:
        self.session = _DummySession()


class _TelemetryRecorder(TelemetryEmitter):
    def __init__(self) -> None:  # type: ignore[override]
        super().__init__(supabase=SupabaseClient(url=None, api_key=None))
        self.events: List[Dict[str, Any]] = []

    def emit(  # type: ignore[override]
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
    def __init__(self) -> None:
        super().__init__(base_url="http://localhost:9999")
        self.stage_events: List[Dict[str, Any]] = []

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


def _supabase_with(
    toolkit_rows: List[Dict[str, Any]],
    *,
    created_at: str = "2025-10-12T00:00:00Z",
) -> SupabaseClient:
    client = SupabaseClient(url="https://example.test", api_key="test")
    inserted: List[Dict[str, Any]] = []

    def fetch_toolkit_selections(  # type: ignore[override]
        self: SupabaseClient,
        *,
        mission_id: str,
        tenant_id: str,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        return list(toolkit_rows)

    def insert_inspection_finding(  # type: ignore[override]
        self: SupabaseClient,
        finding: Dict[str, Any],
    ) -> Dict[str, Any]:
        record = dict(finding)
        record.setdefault("id", f"finding-{len(inserted) + 1}")
        record.setdefault("created_at", created_at)
        inserted.append(record)
        return record

    client.fetch_toolkit_selections = types.MethodType(fetch_toolkit_selections, client)
    client.insert_inspection_finding = types.MethodType(insert_inspection_finding, client)
    setattr(client, "_inserted", inserted)
    return client


def _offline_supabase() -> SupabaseClient:
    client = SupabaseClient(url="https://example.test", api_key="test")
    inserted: List[Dict[str, Any]] = []

    def fetch_toolkit_selections(*_, **__):  # type: ignore[override]
        raise CatalogUnavailableError("offline")

    def insert_inspection_finding(self: SupabaseClient, finding: Dict[str, Any]) -> Dict[str, Any]:  # type: ignore[override]
        inserted.append(finding)
        return finding

    client.fetch_toolkit_selections = types.MethodType(fetch_toolkit_selections, client)
    client.insert_inspection_finding = types.MethodType(insert_inspection_finding, client)
    setattr(client, "_inserted", inserted)
    return client


def _mission_state() -> Dict[str, Any]:
    return {
        "mission_id": "11111111-1111-1111-1111-111111111111",
        "tenant_id": "22222222-2222-2222-2222-222222222222",
        "objective": "Launch revenue accelerator",
        "audience": "Revenue operations",
        "timeframe": "Next 30 days",
        "guardrails": ["Respect quiet hours", "Document undo plan"],
        "mode": "dry_run",
    }


@pytest.mark.asyncio
async def test_inspection_agent_emits_readiness_and_persists_finding() -> None:
    toolkit_rows = [
        {
            "toolkit_id": "github",
            "metadata": {"name": "GitHub", "category": "devops", "authType": "oauth"},
            "auth_mode": "oauth",
            "connection_status": "linked",
        },
        {
            "toolkit_id": "slack",
            "metadata": {"name": "Slack", "category": "comms", "authType": "oauth"},
            "auth_mode": "oauth",
            "connection_status": "linked",
        },
        {
            "toolkit_id": "notion",
            "metadata": {"name": "Notion", "category": "knowledge", "authType": "oauth"},
            "auth_mode": "oauth",
            "connection_status": "linked",
        },
    ]

    supabase = _supabase_with(toolkit_rows=toolkit_rows)
    telemetry = _TelemetryRecorder()
    streamer = _StreamerRecorder()

    agent = InspectionAgent(
        supabase=supabase,
        telemetry=telemetry,
        streamer=streamer,
    )

    ctx = _InvocationContext()
    ctx.session.state[MISSION_CONTEXT_KEY] = _mission_state()
    ctx.session.state[SAFEGUARDS_KEY] = [
        {"hint_type": "tone", "suggested_value": "Keep tone warm"},
        {"hint_type": "undo", "suggested_value": "Provide undo plan"},
    ]
    ctx.session.state[EVIDENCE_BUNDLE_KEY] = {
        "artifact_id": "artifact-001",
        "summary": "Dry-run deliverable",
    }

    events = [
        event async for event in agent._run_async_impl(ctx)  # pylint: disable=protected-access
    ]

    assert events, "inspection agent should emit a status event"
    preview = ctx.session.state[INSPECTION_PREVIEW_KEY]
    assert preview["canProceed"] is True
    assert preview["readiness"] >= 85
    assert getattr(supabase, "_inserted"), "inspection finding should be persisted"

    assert any(entry["event"] == "inspection_stage_completed" for entry in telemetry.events)
    assert streamer.stage_events, "streamer should capture a stage update"


@pytest.mark.asyncio
async def test_inspection_agent_marks_blocked_when_readiness_low() -> None:
    supabase = _supabase_with(toolkit_rows=[])
    telemetry = _TelemetryRecorder()

    agent = InspectionAgent(
        supabase=supabase,
        telemetry=telemetry,
        streamer=_StreamerRecorder(),
    )

    ctx = _InvocationContext()
    ctx.session.state[MISSION_CONTEXT_KEY] = _mission_state()

    await anext(agent._run_async_impl(ctx))  # type: ignore[stop-iteration]  # pylint: disable=protected-access

    gate = ctx.session.state["inspection_gate"]
    assert gate["canProceed"] is False
    assert gate["readiness"] < agent.readiness_threshold
    assert any(not event["payload"].get("canProceed") for event in telemetry.events)


@pytest.mark.asyncio
async def test_inspection_agent_falls_back_to_session_toolkits_when_offline() -> None:
    supabase = _offline_supabase()
    telemetry = _TelemetryRecorder()

    agent = InspectionAgent(
        supabase=supabase,
        telemetry=telemetry,
        streamer=_StreamerRecorder(),
    )

    ctx = _InvocationContext()
    ctx.session.state[MISSION_CONTEXT_KEY] = _mission_state()
    ctx.session.state["toolkit_selections"] = [
        {"toolkit_id": "jira", "metadata": {"name": "Jira", "category": "tracking", "authType": "oauth"}, "auth_mode": "oauth", "connection_status": "linked"}
    ]

    await anext(agent._run_async_impl(ctx))  # type: ignore[stop-iteration]  # pylint: disable=protected-access

    preview = ctx.session.state[INSPECTION_PREVIEW_KEY]
    assert preview["toolkits"], "fallback toolkits should populate preview"
    assert preview["summary"].startswith("1 toolkit")
