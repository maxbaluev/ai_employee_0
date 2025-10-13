"""TDD guardrails for inspection gating before planner stage."""

from __future__ import annotations

from typing import Any, Dict, Optional

import pytest

from agent.agents import coordinator as coordinator_module
from agent.agents.state import MISSION_CONTEXT_KEY
from agent.services import CopilotKitStreamer, SupabaseClient, TelemetryEmitter
from agent.tools.composio_client import ComposioCatalogClient


class _StubSupabase(SupabaseClient):
    """Supabase stub returning a preconfigured inspection finding."""

    def __init__(self, *, finding: Optional[Dict[str, Any]]) -> None:  # type: ignore[override]
        super().__init__(url="https://example.test", api_key="test")
        self._finding = finding

    def fetch_latest_inspection_finding(  # type: ignore[override]
        self,
        *,
        mission_id: str,
        tenant_id: str,
    ) -> Optional[Dict[str, Any]]:
        if not self._finding:
            return None
        if (
            self._finding.get("mission_id") == mission_id
            and self._finding.get("tenant_id") == tenant_id
        ):
            return dict(self._finding)
        return None

    def fetch_safeguards(  # type: ignore[override]
        self,
        *,
        mission_id: str,
        tenant_id: str,
        limit: int = 10,
    ) -> list[Dict[str, Any]]:
        return []

    def fetch_toolkit_selections(  # type: ignore[override]
        self,
        *,
        mission_id: str,
        tenant_id: str,
        limit: int = 20,
    ) -> list[Dict[str, Any]]:
        return []


class _TelemetryRecorder(TelemetryEmitter):
    """Telemetry stub storing emitted events for assertions."""

    def __init__(self) -> None:
        super().__init__(supabase=SupabaseClient(url=None, api_key=None))
        self.events: list[Dict[str, Any]] = []

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


class _StubComposio(ComposioCatalogClient):
    def __init__(self) -> None:
        super().__init__(api_key=None)


MISSION_ID = "11111111-1111-1111-1111-111111111111"
TENANT_ID = "22222222-2222-2222-2222-222222222222"


def _get_gate_fn():
    try:
        return getattr(coordinator_module, "enforce_inspection_gate")
    except AttributeError as error:  # pragma: no cover - ensures test fails until implemented
        raise AssertionError("enforce_inspection_gate helper must be implemented") from error


def test_inspection_gate_blocks_plan_stage_below_threshold():
    gate_fn = _get_gate_fn()

    with pytest.raises(RuntimeError, match=r"inspection readiness"):
        gate_fn(
            readiness=72,
            threshold=85,
            override=False,
            mission_id="mission-low-readiness",
            tenant_id="tenant-low-readiness",
        )


def test_inspection_gate_allows_override_even_below_threshold():
    gate_fn = _get_gate_fn()

    try:
        gate_fn(
            readiness=72,
            threshold=85,
            override=True,
            mission_id="mission-low-readiness",
            tenant_id="tenant-low-readiness",
        )
    except RuntimeError as exc:  # pragma: no cover - we expect no exception once implemented
        raise AssertionError("Override flag should allow planner progression") from exc


def _make_coordinator(
    *,
    finding: Dict[str, Any],
) -> tuple[coordinator_module.CoordinatorAgent, _TelemetryRecorder]:
    supabase = _StubSupabase(finding=finding)
    telemetry = _TelemetryRecorder()
    coordinator = coordinator_module.CoordinatorAgent(
        supabase=supabase,
        telemetry=telemetry,
        composio=_StubComposio(),
        streamer=CopilotKitStreamer(),
    )
    return coordinator, telemetry


def test_planner_gate_blocks_stage_without_override():
    finding = {
        "id": "finding-low",
        "mission_id": MISSION_ID,
        "tenant_id": TENANT_ID,
        "readiness": 72,
        "created_at": "2025-01-01T00:00:00Z",
        "payload": {
            "gate": {"threshold": 85, "canProceed": False},
            "categories": [
                {"id": "toolkits", "label": "Toolkit coverage", "status": "warn"},
            ],
        },
    }

    coordinator, telemetry = _make_coordinator(finding=finding)
    state = {MISSION_CONTEXT_KEY: {"mission_id": MISSION_ID, "tenant_id": TENANT_ID}}

    with pytest.raises(RuntimeError):
        coordinator._enforce_planner_gate_from_state(state)

    blocked_events = [
        event for event in telemetry.events if event["event"] == "inspection_gate_blocked"
    ]
    assert blocked_events, "expected inspection_gate_blocked telemetry event"
    payload = blocked_events[-1]["payload"]
    assert payload["override"] is False
    assert payload["can_proceed"] is False
    assert payload["readiness"] == pytest.approx(72.0)
    assert payload["threshold"] == pytest.approx(85.0)


def test_planner_gate_allows_override_when_backend_permits():
    finding = {
        "id": "finding-override",
        "mission_id": MISSION_ID,
        "tenant_id": TENANT_ID,
        "readiness": 72,
        "created_at": "2025-01-01T01:00:00Z",
        "payload": {
            "gate": {"threshold": 85, "canProceed": True},
            "categories": [
                {"id": "toolkits", "label": "Toolkit coverage", "status": "warn"},
            ],
        },
    }

    coordinator, telemetry = _make_coordinator(finding=finding)
    state = {MISSION_CONTEXT_KEY: {"mission_id": MISSION_ID, "tenant_id": TENANT_ID}}

    coordinator._enforce_planner_gate_from_state(state)

    passed_events = [
        event for event in telemetry.events if event["event"] == "inspection_gate_passed"
    ]
    assert passed_events, "expected inspection_gate_passed telemetry event"
    payload = passed_events[-1]["payload"]
    assert payload["override"] is True
    assert payload["can_proceed"] is True
    assert payload["readiness"] == pytest.approx(72.0)
    assert payload["threshold"] == pytest.approx(85.0)
