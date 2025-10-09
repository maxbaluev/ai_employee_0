"""Coordinator agent chaining intake, planner, and execution loop."""

from __future__ import annotations

import json
import pathlib
import time
from typing import Optional

from google.adk.agents import SequentialAgent
from google.adk.agents.callback_context import CallbackContext
from pydantic import Field

from ..services import CopilotKitStreamer, SupabaseClient, TelemetryEmitter
from ..tools.composio_client import ComposioCatalogClient
from .evidence import EvidenceAgent
from .execution_loop import ExecutionLoopAgent
from .executor import DryRunExecutorAgent
from .intake import IntakeAgent
from .planner import PlannerAgent
from .state import MISSION_CONTEXT_KEY
from .validator import ValidatorAgent

TRACE_PATH = pathlib.Path("docs/readiness/coordinator_trace_G-A.log")


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
        planner.before_agent_callback = self._stage_callback("planner_stage_started")
        execution_loop.before_agent_callback = self._stage_callback(
            "execution_loop_started"
        )

        super().__init__(
            name="CoordinatorAgent",
            supabase=shared_supabase,
            telemetry=shared_telemetry,
            max_retries=max_retries,
            sub_agents=[intake, planner, execution_loop],
        )

        object.__setattr__(self, "supabase", shared_supabase)
        object.__setattr__(self, "telemetry", shared_telemetry)
        object.__setattr__(self, "streamer", shared_streamer)
        object.__setattr__(self, "max_retries", max(1, max_retries))

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
