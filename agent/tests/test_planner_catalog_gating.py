"""Planner catalog gating tests for empty and unavailable catalog scenarios.

These tests ensure the planner emits governed interrupts when Supabase
or Composio catalog data is missing:
- `catalog_empty` when both library plays and Composio toolkits are empty;
- `catalog_unavailable` when Composio toolkits lack score metadata.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import pytest

from agent.agents import planner as planner_module
from agent.agents.planner import PlannerAgent
from agent.agents.state import MissionContext
from agent.services import (
    CatalogUnavailableError,
    CopilotKitStreamer,
    SupabaseClient,
    TelemetryEmitter,
)
from agent.tools.composio_client import ComposioCatalogClient


# ---------------------------------------------------------------------------
# Stub infrastructure
# ---------------------------------------------------------------------------


class _StubSupabase(SupabaseClient):
    """Minimal Supabase stub that records planner interactions."""

    def __init__(
        self,
        *,
        library_rows: Optional[List[Dict[str, Any]]] = None,
        raise_catalog_error: bool = False,
    ) -> None:
        super().__init__(url="https://example.test", api_key="test")
        self.enabled = True
        self._library_rows = library_rows or []
        self._raise_catalog_error = raise_catalog_error
        self.search_calls: List[Dict[str, Any]] = []
        self.upsert_payloads: List[List[Dict[str, Any]]] = []

    def search_library_plays(
        self,
        *,
        tenant_id: str,
        mission_id: str,
        objective: str,
        audience: str,
        guardrails: List[str],
        limit: int,
    ) -> List[Dict[str, Any]]:
        self.search_calls.append(
            {
                "tenant_id": tenant_id,
                "mission_id": mission_id,
                "objective": objective,
                "audience": audience,
                "guardrails": list(guardrails),
                "limit": limit,
            }
        )
        if self._raise_catalog_error:
            raise CatalogUnavailableError("stubbed catalog unavailable")
        return list(self._library_rows)

    def upsert_plays(self, payload: List[Dict[str, Any]]) -> None:
        self.upsert_payloads.append(payload)


class _StubComposio(ComposioCatalogClient):
    def __init__(self, tools: Optional[List[Dict[str, Any]]] = None) -> None:
        # Initialize parent with no API key to disable real client functionality
        super().__init__(api_key=None)
        self.tools = tools or []
        self.get_calls: List[Dict[str, Any]] = []

    def get_tools(self, **kwargs: Any) -> List[Dict[str, Any]]:  # type: ignore[override]
        self.get_calls.append(kwargs)
        return list(self.tools)


@dataclass
class _StubTelemetry(TelemetryEmitter):
    def __init__(self) -> None:
        # Create a stub supabase client for the parent
        stub_supabase = SupabaseClient(url=None, api_key=None)
        super().__init__(supabase=stub_supabase)
        self.events: List[Dict[str, Any]] = []

    def emit(self, event_name: str, *, tenant_id: str, mission_id: str, payload: Optional[Dict[str, Any]] = None) -> None:
        self.events.append(
            {
                "event": event_name,
                "tenant_id": tenant_id,
                "mission_id": mission_id,
                "payload": payload or {},
            }
        )


@dataclass
class _StreamerEvent:
    stage: str
    event: str
    content: str
    metadata: Dict[str, Any]


class _StubStreamer(CopilotKitStreamer):
    def __init__(self) -> None:
        super().__init__()
        self.events: List[_StreamerEvent] = []

    def emit_stage(
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
    ) -> None:  # pragma: no cover - simple recorder
        self.events.append(
            _StreamerEvent(
                stage=stage,
                event=event,
                content=content,
                metadata=dict(metadata or {}),
            )
        )


def _make_mission_context() -> MissionContext:
    return MissionContext(
        mission_id="mission-empty-catalog",
        tenant_id="tenant-empty-catalog",
        objective="Increase qualified pipeline in Q4",
        audience="Revenue team",
        timeframe="Q4",
        guardrails=["Respect quiet hours", "Professional tone"],
        mode="dry_run",
    )


def _make_planner(*, library_rows=None, catalog=None, raise_catalog_error=False):
    supabase = _StubSupabase(library_rows=library_rows, raise_catalog_error=raise_catalog_error)
    telemetry = _StubTelemetry()
    streamer = _StubStreamer()
    composio = _StubComposio(catalog)
    agent = PlannerAgent(
        supabase=supabase,
        telemetry=telemetry,
        composio=composio,
        streamer=streamer,
    )
    return agent, supabase, telemetry, streamer, composio


CatalogEmptyInterrupt = getattr(planner_module, "CatalogEmptyInterrupt", RuntimeError)
CatalogUnavailableInterrupt = getattr(
    planner_module, "CatalogUnavailableInterrupt", RuntimeError
)


def test_planner_raises_interrupt_when_library_and_composio_empty():
    planner, supabase, telemetry, streamer, composio = _make_planner(
        library_rows=[],
        catalog=[],
    )

    mission = _make_mission_context()

    with pytest.raises(CatalogEmptyInterrupt):
        planner._rank_plays(mission, mission.mode)

    # Expect library+composio queried exactly once
    assert len(supabase.search_calls) == 1
    assert len(composio.get_calls) == 1

    # No fallback candidates persisted
    assert supabase.upsert_payloads == []

    # Telemetry should not include fallback-generated status
    status_types = [
        event.metadata.get("status_type")
        for event in streamer.events
        if event.stage == "planner_status"
    ]
    assert "fallback_generated" not in status_types


def test_planner_catalog_empty_telemetry_shape():
    planner, _, _, streamer, composio = _make_planner(library_rows=[], catalog=[])
    mission = _make_mission_context()

    with pytest.raises(CatalogEmptyInterrupt):
        planner._rank_plays(mission, mission.mode)

    catalog_events = [
        event
        for event in streamer.events
        if event.stage == "planner_status"
        and event.metadata.get("status_type") == "catalog_empty"
    ]
    assert catalog_events, "catalog_empty status event should be emitted"

    metadata = catalog_events[-1].metadata
    assert metadata.get("reason") == "library_and_composio_empty"
    assert metadata.get("library_status") == "empty"
    assert metadata.get("composio_status") == "empty"
    assert metadata.get("candidate_count") == 0
    assert metadata.get("toolkit_refs") == []

    # Ensure Composio discovery recorded exactly once for completeness
    assert len(composio.get_calls) == 1


def test_planner_catalog_unavailable_interrupt():
    planner, supabase, telemetry, streamer, _ = _make_planner(
        library_rows=[],
        catalog=[],
        raise_catalog_error=True,
    )

    mission = _make_mission_context()

    with pytest.raises(CatalogUnavailableInterrupt):
        planner._rank_plays(mission, mission.mode)

    catalog_events = [
        event
        for event in streamer.events
        if event.stage == "planner_status"
        and event.metadata.get("status_type") == "catalog_unavailable"
    ]
    assert catalog_events, "catalog_unavailable status should be emitted"
    metadata = catalog_events[-1].metadata
    assert metadata.get("library_status") == "unavailable"
    assert metadata.get("candidate_count") == 0

    # No plays persisted when catalog unavailable
    assert supabase.upsert_payloads == []


def test_planner_catalog_unavailable_when_scores_missing():
    library_row = {
        "id": "lib-1",
        "title": "Baseline play",
        "description": "Test play",
        "metadata": {},
        "_similarity": 0.72,
    }

    catalog_entries = [
        {
            "name": "Alpha",
            "slug": "alpha",
            "toolkit": "alpha",
            "score": None,
            "score_available": False,
            "palette": {"slug": "alpha", "toolkit": "alpha", "score_available": False},
        }
    ]

    planner, supabase, telemetry, streamer, composio = _make_planner(
        library_rows=[library_row],
        catalog=catalog_entries,
    )
    mission = _make_mission_context()

    with pytest.raises(CatalogUnavailableInterrupt):
        planner._rank_plays(mission, mission.mode)

    catalog_events = [
        event
        for event in streamer.events
        if event.stage == "planner_status"
        and event.metadata.get("status_type") == "catalog_unavailable"
    ]
    assert catalog_events, "catalog_unavailable status should be emitted when scores missing"
