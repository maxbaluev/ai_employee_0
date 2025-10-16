"""Gemini ADK agents for the mission lifecycle.

This package implements the seven-stage mission journey agents following the
architecture described in:

* docs/02_system_overview.md — section "Backend Agents (Gemini ADK)"
* docs/04_implementation_guide.md — section 3
* docs/10_composio.md — Composio trust model & OAuth flows

Implemented Agents:
- CoordinatorAgent: Orchestrates seven-stage mission lifecycle (TASK-ADK-001)

Planned Agents (stubs):
- IntakeAgent: Stage 1 (Define) brief generation
- InspectorAgent: Stage 2 (Prepare) toolkit discovery and OAuth
- PlannerAgent: Stage 3 (Plan) play ranking
- ValidatorAgent: Safeguard enforcement across stages
- ExecutorAgent: Stage 5 (Execute) governed tool execution
- EvidenceAgent: Stages 5-6 artifact packaging
"""

from agent.agents.coordinator import CoordinatorAgent, MissionStage

__all__ = [
    "CoordinatorAgent",
    "MissionStage",
    "IntakeAgent",
    "InspectorAgent",
    "PlannerAgent",
    "ValidatorAgent",
    "ExecutorAgent",
    "EvidenceAgent",
]


class _NotImplementedStub:
    def __init__(self, *args, **kwargs) -> None:  # noqa: D401 - simple stub
        raise NotImplementedError(
            "Agent scaffolding placeholder. Implement per docs before use.",
        )


# Stubs for not-yet-implemented agents
IntakeAgent = _NotImplementedStub
InspectorAgent = _NotImplementedStub
PlannerAgent = _NotImplementedStub
ValidatorAgent = _NotImplementedStub
ExecutorAgent = _NotImplementedStub
EvidenceAgent = _NotImplementedStub
