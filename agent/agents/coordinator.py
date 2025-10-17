"""CoordinatorAgent orchestrates the seven-stage mission lifecycle.

The Coordinator is responsible for:
* Initialising mission session state (mission_id, tenant_id, user_id, stage)
* Enforcing the documented stage order (Define → Prepare → Plan → Approve → Execute → Reflect)
* Handing off control to downstream agents for each stage
* Emitting telemetry so governance can observe stage progression
* Rolling back the current stage when a downstream agent fails

References
---------
- docs/02_system_overview.md §ADK Agent Coordination & State Flow
- docs/04_implementation_guide.md §3 Backend Agents (Gemini ADK)
- docs/06_data_intelligence.md §3 Event Catalog by Mission Stage
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, AsyncGenerator, Dict, Iterable

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai.types import Content, Part

from agent.services import TelemetryClient


class MissionStage(str, Enum):
    """Canonical list of control plane mission stages."""

    HOME = "HOME"
    DEFINE = "DEFINE"
    PREPARE = "PREPARE"
    PLAN = "PLAN"
    APPROVE = "APPROVE"
    EXECUTE = "EXECUTE"
    REFLECT = "REFLECT"


# Ordered list (HOME included so we can validate transitions easily)
STAGE_SEQUENCE: tuple[MissionStage, ...] = (
    MissionStage.HOME,
    MissionStage.DEFINE,
    MissionStage.PREPARE,
    MissionStage.PLAN,
    MissionStage.APPROVE,
    MissionStage.EXECUTE,
    MissionStage.REFLECT,
)


@dataclass(frozen=True)
class StageSpec:
    """Metadata describing how Coordinator should process a stage."""

    stage: MissionStage
    agent_attr: str | None
    required_keys: tuple[str, ...] = ()
    description: str = ""


PIPELINE: tuple[StageSpec, ...] = (
    StageSpec(
        stage=MissionStage.DEFINE,
        agent_attr="intake_agent",
        required_keys=("mission_brief",),
        description="Generate and lock the mission brief.",
    ),
    StageSpec(
        stage=MissionStage.PREPARE,
        agent_attr="inspector_agent",
        required_keys=("granted_scopes",),
        description="Audit tools and request scopes.",
    ),
    StageSpec(
        stage=MissionStage.PLAN,
        agent_attr="planner_agent",
        required_keys=("ranked_plays",),
        description="Rank mission plays for approval.",
    ),
    StageSpec(
        stage=MissionStage.APPROVE,
        agent_attr=None,
        required_keys=(),
        description="Stakeholder approval checkpoint.",
    ),
    StageSpec(
        stage=MissionStage.EXECUTE,
        agent_attr="executor_agent",
        required_keys=("execution_results",),
        description="Run governed execution of the approved play.",
    ),
    StageSpec(
        stage=MissionStage.REFLECT,
        agent_attr="evidence_agent",
        required_keys=("evidence_bundles",),
        description="Collect evidence and feedback for the library.",
    ),
)


def _stage_index(stage: MissionStage) -> int:
    return STAGE_SEQUENCE.index(stage)


class CoordinatorAgent(BaseAgent):
    """Gemini ADK agent coordinating the mission lifecycle stages."""

    def __init__(
        self,
        *,
        name: str,
        telemetry: TelemetryClient | None = None,
        intake_agent: BaseAgent | None = None,
        inspector_agent: BaseAgent | None = None,
        planner_agent: BaseAgent | None = None,
        validator_agent: BaseAgent | None = None,
        executor_agent: BaseAgent | None = None,
        evidence_agent: BaseAgent | None = None,
        **kwargs: Any,
    ) -> None:
        sub_agents: list[BaseAgent] = [
            agent
            for agent in (
                intake_agent,
                inspector_agent,
                planner_agent,
                validator_agent,
                executor_agent,
                evidence_agent,
            )
            if agent is not None
        ]

        super().__init__(name=name, sub_agents=sub_agents, **kwargs)

        # store references outside the Pydantic model namespace
        object.__setattr__(self, "_telemetry", telemetry)
        object.__setattr__(
            self,
            "_agents",
            {
                "intake_agent": intake_agent,
                "inspector_agent": inspector_agent,
                "planner_agent": planner_agent,
                "validator_agent": validator_agent,
                "executor_agent": executor_agent,
                "evidence_agent": evidence_agent,
            },
        )

    # ---------------------------------------------------------------------
    # Public helpers
    # ---------------------------------------------------------------------
    @property
    def telemetry(self) -> TelemetryClient | None:
        return getattr(self, "_telemetry", None)

    @property
    def validator_agent(self) -> BaseAgent | None:
        return self._agents.get("validator_agent")

    # ------------------------------------------------------------------
    # Core execution
    # ------------------------------------------------------------------
    async def _run_async_impl(
        self,
        ctx: InvocationContext,
    ) -> AsyncGenerator[Event, None]:
        if not self._ensure_mission_context(ctx):
            yield self._error_event(
                ctx,
                MissionStage.HOME,
                "Missing mission context (mission_id, tenant_id, user_id).",
            )
            return

        if "current_stage" not in ctx.session.state:
            ctx.session.state["current_stage"] = MissionStage.HOME.value

        current_stage = self._current_stage(ctx)
        stage_cursor = _stage_index(current_stage)

        for spec in PIPELINE:
            spec_index = _stage_index(spec.stage)

            # Skip stages that were previously completed (resume scenario)
            if spec_index <= stage_cursor:
                continue

            agent = self._agents.get(spec.agent_attr or "") if spec.agent_attr else None

            # If a downstream agent is not wired yet, stop progression until it exists
            if spec.agent_attr and agent is None:
                break

            previous_stage = self._current_stage(ctx)

            if not self._is_valid_transition(previous_stage, spec.stage):
                yield self._error_event(
                    ctx,
                    previous_stage,
                    f"Invalid stage transition {previous_stage.value} → {spec.stage.value}.",
                )
                return

            # Update stage + emit telemetry / event
            ctx.session.state["current_stage"] = spec.stage.value
            await self._emit_telemetry(
                "mission_stage_transition",
                ctx,
                {
                    "from_stage": previous_stage.value,
                    "to_stage": spec.stage.value,
                    "status": "entered",
                },
            )
            yield self._stage_event(ctx, previous_stage, spec)

            try:
                if spec.agent_attr and agent is not None:
                    await self._emit_handoff(ctx, spec.stage, agent.name)
                    yield self._handoff_event(ctx, spec.stage, agent.name)
                    async for event in agent.run_async(ctx):
                        yield event
                elif spec.stage is MissionStage.APPROVE:
                    await self._emit_handoff(ctx, spec.stage, "approval_workflow")
                    yield self._handoff_event(ctx, spec.stage, "approval_workflow")
                    approval = ctx.session.state.get("approval_decision")
                    if not approval or approval.get("status") != "approved":
                        yield self._info_event(
                            ctx,
                            spec.stage,
                            "Awaiting approval decision before execution.",
                        )
                        return

                self._validate_stage_outputs(ctx, spec)
            except Exception as exc:  # noqa: BLE001 - propagate as stage failure
                ctx.session.state["current_stage"] = previous_stage.value
                await self._emit_telemetry(
                    "coordinator_error",
                    ctx,
                    {
                        "stage": spec.stage.value,
                        "error": str(exc),
                    },
                )
                await self._emit_telemetry(
                    "mission_stage_transition",
                    ctx,
                    {
                        "from_stage": spec.stage.value,
                        "to_stage": previous_stage.value,
                        "status": "rolled_back",
                    },
                )
                yield self._error_event(
                    ctx,
                    spec.stage,
                    f"{spec.stage.value} stage failed: {exc}",
                )
                return

            stage_cursor = spec_index

        if self._current_stage(ctx) is MissionStage.REFLECT:
            await self._emit_telemetry(
                "mission_completed",
                ctx,
                {
                    "final_stage": MissionStage.REFLECT.value,
                },
            )
            yield self._info_event(
                ctx,
                MissionStage.REFLECT,
                "Mission lifecycle completed.",
            )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _current_stage(self, ctx: InvocationContext) -> MissionStage:
        try:
            return MissionStage(ctx.session.state.get("current_stage", MissionStage.HOME.value))
        except ValueError:
            return MissionStage.HOME

    def _ensure_mission_context(self, ctx: InvocationContext) -> bool:
        required = ("mission_id", "tenant_id", "user_id")
        return all(ctx.session.state.get(key) for key in required)

    def _is_valid_transition(
        self,
        current_stage: MissionStage,
        next_stage: MissionStage,
    ) -> bool:
        current_index = _stage_index(current_stage)
        next_index = _stage_index(next_stage)
        return next_index == current_index + 1

    def _validate_stage_outputs(self, ctx: InvocationContext, spec: StageSpec) -> None:
        if not spec.required_keys:
            return
        missing = [key for key in spec.required_keys if key not in ctx.session.state]
        if missing:
            raise ValueError(
                f"Missing required state after {spec.stage.value}: {', '.join(missing)}",
            )

    async def _emit_telemetry(
        self,
        event_name: str,
        ctx: InvocationContext,
        context: Dict[str, Any],
    ) -> None:
        if not self.telemetry:
            return
        payload = {
            "mission_id": ctx.session.state.get("mission_id"),
            "tenant_id": ctx.session.state.get("tenant_id"),
            "user_id": ctx.session.state.get("user_id"),
            "current_stage": ctx.session.state.get("current_stage"),
            **context,
        }
        self.telemetry.emit(event_name, payload)

    async def _emit_handoff(
        self,
        ctx: InvocationContext,
        stage: MissionStage,
        target: str,
    ) -> None:
        await self._emit_telemetry(
            "coordinator_handoff",
            ctx,
            {
                "stage": stage.value,
                "target": target,
            },
        )

    # ------------------------------------------------------------------
    # Event helpers
    # ------------------------------------------------------------------
    def _stage_event(
        self,
        ctx: InvocationContext,
        previous_stage: MissionStage,
        spec: StageSpec,
    ) -> Event:
        return self._make_event(
            ctx,
            message=(
                f"Entering {spec.stage.value} stage. {spec.description}".strip()
            ),
            metadata={
                "stage": spec.stage.value,
                "previous_stage": previous_stage.value,
            },
        )

    def _handoff_event(
        self,
        ctx: InvocationContext,
        stage: MissionStage,
        target: str,
    ) -> Event:
        return self._make_event(
            ctx,
            message=f"Handing off {stage.value} to {target}.",
            metadata={"stage": stage.value, "handoff_target": target},
        )

    def _info_event(
        self,
        ctx: InvocationContext,
        stage: MissionStage,
        message: str,
    ) -> Event:
        return self._make_event(
            ctx,
            message=message,
            metadata={"stage": stage.value, "type": "info"},
        )

    def _error_event(
        self,
        ctx: InvocationContext,
        stage: MissionStage,
        message: str,
    ) -> Event:
        return self._make_event(
            ctx,
            message=message,
            metadata={"stage": stage.value, "type": "error"},
        )

    def _make_event(
        self,
        ctx: InvocationContext,
        *,
        message: str,
        metadata: Dict[str, Any],
    ) -> Event:
        content = Content(role="system", parts=[Part(text=message)])
        return Event(
            author=self.name,
            invocationId=getattr(ctx, "invocation_id", ""),
            content=content,
            customMetadata=metadata,
        )


__all__ = ["CoordinatorAgent", "MissionStage", "STAGE_SEQUENCE"]
