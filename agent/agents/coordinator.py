"""Coordinator agent chaining intake, planner, and execution loop."""

from __future__ import annotations

import json
import math
import pathlib
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Mapping, Optional

from google.adk.agents import SequentialAgent
from google.adk.agents.callback_context import CallbackContext
from pydantic import Field

from ..services import CopilotKitStreamer, SupabaseClient, TelemetryEmitter
from ..tools.composio_client import ComposioCatalogClient
from .evidence import EvidenceAgent
from .execution_loop import ExecutionLoopAgent
from .executor import DryRunExecutorAgent
from .inspection import InspectionAgent
from .intake import IntakeAgent
from .planner import PlannerAgent
from .state import MISSION_CONTEXT_KEY
from .validator import ValidatorAgent

TRACE_PATH = pathlib.Path("docs/readiness/coordinator_trace_G-A.log")
INSPECTION_GATE_THRESHOLD = 85.0


@dataclass
class _InspectionGateSnapshot:
    """Normalized inspection readiness snapshot for planner gating."""

    mission_id: str
    tenant_id: str
    readiness: float
    threshold: float
    override: bool
    can_proceed: bool
    categories: List[Dict[str, Any]] = field(default_factory=list)
    gate: Dict[str, Any] = field(default_factory=dict)
    finding_id: Optional[str] = None
    finding_created_at: Optional[str] = None
    source: str = "fallback"


def _safe_float(value: Any, default: float) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(numeric):
        return default
    return numeric


def _safe_percentage(value: Any, default: float = 0.0) -> float:
    numeric = _safe_float(value, default)
    return max(0.0, min(100.0, numeric))


def _coerce_bool(value: Any) -> Optional[bool]:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalised = value.strip().lower()
        if normalised in {"true", "1", "yes"}:
            return True
        if normalised in {"false", "0", "no"}:
            return False
    return None


def _normalise_categories(candidate: Any) -> List[Dict[str, Any]]:
    if not isinstance(candidate, list):
        return []
    categories: List[Dict[str, Any]] = []
    for item in candidate:
        if isinstance(item, dict):
            categories.append(dict(item))
    return categories


def _compute_override_flag(
    payload: Mapping[str, Any],
    gate: Mapping[str, Any],
    *,
    can_proceed: bool,
    readiness: float,
    threshold: float,
) -> bool:
    override_detected = False
    for value in (
        payload.get("override"),
        payload.get("override_granted"),
        payload.get("overrideGranted"),
        payload.get("overrideApproved"),
        gate.get("override"),
        gate.get("override_granted"),
        gate.get("overrideGranted"),
        gate.get("overrideApproved"),
    ):
        coerced = _coerce_bool(value)
        if coerced is True:
            override_detected = True
        elif coerced is False and override_detected is False:
            override_detected = False

    if not override_detected and can_proceed and readiness < threshold:
        override_detected = True

    return override_detected


def enforce_inspection_gate(
    *,
    readiness: float | int,
    threshold: float | int,
    override: bool,
    mission_id: str,
    tenant_id: str,
) -> None:
    """Raise when inspection readiness falls below the gating threshold."""

    if override or readiness >= threshold:
        # TODO(gate-gb): emit inspection gating telemetry once coordinator wiring lands.
        return

    raise RuntimeError(
        f"inspection readiness {readiness:.1f}% for mission {mission_id} (tenant {tenant_id}) "
        f"is below the required threshold {threshold:.1f}%"
    )


class CoordinatorAgent(SequentialAgent):
    """Gate G-A coordinator implementing deterministic orchestration."""

    supabase: Optional[SupabaseClient] = Field(default=None, exclude=True)
    telemetry: Optional[TelemetryEmitter] = Field(default=None, exclude=True)
    streamer: CopilotKitStreamer = Field(default_factory=CopilotKitStreamer, exclude=True)
    max_retries: int = Field(default=3, exclude=True)

    def __init__(
        self,
        *,
        supabase: Optional[SupabaseClient] = None,
        telemetry: Optional[TelemetryEmitter] = None,
        composio: Optional[ComposioCatalogClient] = None,
        streamer: Optional[CopilotKitStreamer] = None,
        max_retries: int = 3,
    ) -> None:
        shared_supabase = supabase or SupabaseClient.from_env()
        shared_telemetry = telemetry or TelemetryEmitter(shared_supabase)
        composio_client = composio or ComposioCatalogClient.from_env()
        shared_streamer = streamer or CopilotKitStreamer()

        intake = IntakeAgent(
            supabase=shared_supabase,
            telemetry=shared_telemetry,
            streamer=shared_streamer,
        )
        inspection = InspectionAgent(
            supabase=shared_supabase,
            telemetry=shared_telemetry,
            streamer=shared_streamer,
        )
        planner = PlannerAgent(
            supabase=shared_supabase,
            telemetry=shared_telemetry,
            composio=composio_client,
            streamer=shared_streamer,
        )
        executor = DryRunExecutorAgent(
            supabase=shared_supabase,
            telemetry=shared_telemetry,
            streamer=shared_streamer,
        )
        validator = ValidatorAgent(
            supabase=shared_supabase,
            telemetry=shared_telemetry,
            streamer=shared_streamer,
        )
        evidence = EvidenceAgent(
            supabase=shared_supabase,
            telemetry=shared_telemetry,
            streamer=shared_streamer,
        )
        execution_loop = ExecutionLoopAgent(
            executor=executor,
            validator=validator,
            evidence=evidence,
            telemetry=shared_telemetry,
            streamer=shared_streamer,
            max_retries=max_retries,
        )

        intake.before_agent_callback = self._stage_callback("intake_stage_started")
        inspection.before_agent_callback = self._stage_callback("inspection_stage_started")
        planner.before_agent_callback = self._planner_gate_callback()
        execution_loop.before_agent_callback = self._stage_callback(
            "execution_loop_started"
        )

        super().__init__(
            name="CoordinatorAgent",
            supabase=shared_supabase,
            telemetry=shared_telemetry,
            max_retries=max_retries,
            sub_agents=[intake, inspection, planner, execution_loop],
        )

        object.__setattr__(self, "supabase", shared_supabase)
        object.__setattr__(self, "telemetry", shared_telemetry)
        object.__setattr__(self, "streamer", shared_streamer)
        object.__setattr__(self, "max_retries", max(1, max_retries))

    def _planner_gate_callback(self):
        stage_callback = self._stage_callback("planner_stage_started")

        def _callback(callback_context: CallbackContext) -> None:
            self._enforce_planner_gate(callback_context)
            stage_callback(callback_context)

        return _callback

    def _enforce_planner_gate(self, callback_context: CallbackContext) -> None:
        state_snapshot = self._state_to_dict(callback_context.state)
        snapshot = self._resolve_inspection_gate_snapshot(state_snapshot)

        try:
            self._enforce_planner_gate_from_snapshot(snapshot)
        except RuntimeError:
            callback_context.state["inspection_gate"] = self._serialize_gate_snapshot(
                snapshot,
                blocked=True,
            )
            raise

        callback_context.state["inspection_gate"] = self._serialize_gate_snapshot(
            snapshot,
            blocked=False,
        )

    def _enforce_planner_gate_from_state(self, state: Mapping[str, Any]) -> None:
        snapshot = self._resolve_inspection_gate_snapshot(state)
        self._enforce_planner_gate_from_snapshot(snapshot)

    def _enforce_planner_gate_from_snapshot(
        self, snapshot: _InspectionGateSnapshot
    ) -> None:
        try:
            enforce_inspection_gate(
                readiness=snapshot.readiness,
                threshold=snapshot.threshold,
                override=snapshot.override,
                mission_id=snapshot.mission_id,
                tenant_id=snapshot.tenant_id,
            )
        except RuntimeError as error:
            self._emit_inspection_gate_event(
                "inspection_gate_blocked",
                snapshot,
                error=str(error),
            )
            raise

        self._emit_inspection_gate_event("inspection_gate_passed", snapshot)

    def _emit_inspection_gate_event(
        self,
        event_name: str,
        snapshot: _InspectionGateSnapshot,
        *,
        error: Optional[str] = None,
    ) -> None:
        if not self.telemetry:
            return

        payload: Dict[str, Any] = {
            "readiness": round(snapshot.readiness, 2),
            "threshold": round(snapshot.threshold, 2),
            "override": snapshot.override,
            "can_proceed": snapshot.can_proceed,
            "finding_id": snapshot.finding_id,
            "finding_created_at": snapshot.finding_created_at,
            "source": snapshot.source,
        }

        if snapshot.categories:
            payload["categories"] = snapshot.categories
        if snapshot.gate:
            payload["gate"] = snapshot.gate
        if error:
            payload["error"] = error

        self.telemetry.emit(
            event_name,
            tenant_id=snapshot.tenant_id,
            mission_id=snapshot.mission_id,
            payload=payload,
        )

    @staticmethod
    def _serialize_gate_snapshot(
        snapshot: _InspectionGateSnapshot,
        *,
        blocked: bool,
    ) -> Dict[str, Any]:
        serialized: Dict[str, Any] = {
            "readiness": round(snapshot.readiness, 2),
            "threshold": round(snapshot.threshold, 2),
            "override": snapshot.override,
            "canProceed": snapshot.can_proceed,
            "blocked": blocked,
            "source": snapshot.source,
        }
        if snapshot.categories:
            serialized["categories"] = snapshot.categories
        if snapshot.gate:
            serialized["gate"] = snapshot.gate
        if snapshot.finding_id:
            serialized["findingId"] = snapshot.finding_id
        if snapshot.finding_created_at:
            serialized["findingCreatedAt"] = snapshot.finding_created_at
        return serialized

    @staticmethod
    def _state_to_dict(state: Any) -> Dict[str, Any]:
        if hasattr(state, "to_dict") and callable(getattr(state, "to_dict")):
            try:
                return dict(state.to_dict())
            except Exception:  # pragma: no cover - defensive fallback
                pass
        if isinstance(state, dict):
            return dict(state)
        return {}

    def _resolve_inspection_gate_snapshot(
        self,
        state: Mapping[str, Any],
    ) -> _InspectionGateSnapshot:
        mission_context = state.get(MISSION_CONTEXT_KEY)
        mission_data = mission_context if isinstance(mission_context, dict) else {}
        mission_id = str(mission_data.get("mission_id") or "mission-dry-run")
        tenant_id = str(mission_data.get("tenant_id") or "gate-ga-default")

        snapshot = _InspectionGateSnapshot(
            mission_id=mission_id,
            tenant_id=tenant_id,
            readiness=0.0,
            threshold=INSPECTION_GATE_THRESHOLD,
            override=False,
            can_proceed=False,
        )

        inline_gate = state.get("inspection_gate")
        if isinstance(inline_gate, dict):
            snapshot.source = "session"
            snapshot.readiness = _safe_percentage(
                inline_gate.get("readiness"),
                snapshot.readiness,
            )
            snapshot.threshold = _safe_float(
                inline_gate.get("threshold"),
                snapshot.threshold,
            )
            gate_candidate = inline_gate.get("gate")
            if isinstance(gate_candidate, dict):
                snapshot.gate = dict(gate_candidate)
                can_proceed_flag = _coerce_bool(gate_candidate.get("canProceed"))
                if can_proceed_flag is not None:
                    snapshot.can_proceed = can_proceed_flag
            explicit_can_proceed = _coerce_bool(inline_gate.get("canProceed"))
            if explicit_can_proceed is not None:
                snapshot.can_proceed = explicit_can_proceed
            categories_candidate = inline_gate.get("categories")
            if isinstance(categories_candidate, list):
                snapshot.categories = _normalise_categories(categories_candidate)
            override_candidate = _coerce_bool(inline_gate.get("override"))
            if override_candidate is not None:
                snapshot.override = override_candidate
            if not snapshot.override and "override" in snapshot.gate:
                gate_override = _coerce_bool(snapshot.gate.get("override"))
                if gate_override is not None:
                    snapshot.override = gate_override
            snapshot.finding_id = inline_gate.get("findingId") or inline_gate.get("finding_id")
            snapshot.finding_created_at = inline_gate.get("findingCreatedAt") or inline_gate.get(
                "finding_created_at"
            )

        if self.supabase:
            record = self.supabase.fetch_latest_inspection_finding(
                mission_id=mission_id,
                tenant_id=tenant_id,
            )
            if isinstance(record, dict):
                payload = record.get("payload")
                payload_dict = payload if isinstance(payload, dict) else {}
                gate_payload = payload_dict.get("gate")
                gate_dict = gate_payload if isinstance(gate_payload, dict) else {}

                readiness = _safe_percentage(
                    record.get("readiness"),
                    snapshot.readiness,
                )
                threshold = _safe_float(
                    gate_dict.get("threshold"),
                    snapshot.threshold,
                )
                can_proceed_flag = _coerce_bool(gate_dict.get("canProceed"))
                if can_proceed_flag is None:
                    can_proceed_flag = readiness >= threshold

                snapshot.source = "inspection_findings"
                snapshot.readiness = readiness
                snapshot.threshold = threshold
                snapshot.can_proceed = can_proceed_flag
                snapshot.override = _compute_override_flag(
                    payload_dict,
                    gate_dict,
                    can_proceed=can_proceed_flag,
                    readiness=readiness,
                    threshold=threshold,
                )
                categories = _normalise_categories(payload_dict.get("categories"))
                if categories:
                    snapshot.categories = categories
                if gate_dict:
                    snapshot.gate = dict(gate_dict)
                snapshot.finding_id = record.get("id") or snapshot.finding_id
                snapshot.finding_created_at = record.get("created_at") or snapshot.finding_created_at

        if not snapshot.can_proceed:
            snapshot.can_proceed = snapshot.readiness >= snapshot.threshold

        if not snapshot.override and snapshot.can_proceed and snapshot.readiness < snapshot.threshold:
            snapshot.override = True

        return snapshot

    def _stage_callback(self, stage_name: str):
        def _callback(callback_context: CallbackContext) -> None:
            state = callback_context.state or {}
            mission = state.get(MISSION_CONTEXT_KEY, {})
            mission_id = mission.get("mission_id", "mission-dry-run")
            tenant_id = mission.get("tenant_id", "gate-ga-default")
            payload = {
                "stage": stage_name,
                "mission": mission_id,
                "tenant": tenant_id,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            self.telemetry.emit(
                stage_name,
                tenant_id=tenant_id,
                mission_id=mission_id,
                payload=payload,
            )
            self._append_trace(payload)
            try:
                self.streamer.emit_message(
                    tenant_id=tenant_id,
                    session_identifier=mission_id,
                    role="assistant",
                    content=f"{stage_name.replace('_', ' ')}",
                    metadata=payload,
                )
            except Exception:  # pragma: no cover - streaming best effort
                pass

        return _callback

    def _append_trace(self, payload: dict) -> None:
        try:
            TRACE_PATH.parent.mkdir(parents=True, exist_ok=True)
            with TRACE_PATH.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(payload) + "\n")
        except OSError:
            # Non-fatal: tracing is an evidence aid, not a runtime requirement.
            pass


def build_coordinator_agent(max_retries: int = 3) -> CoordinatorAgent:
    """Factory for the Gate G-A coordinator."""

    return CoordinatorAgent(max_retries=max_retries)
