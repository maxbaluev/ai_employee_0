"""Placeholder Gemini ADK agents for the mission lifecycle.

Implement the Coordinator, Intake, Inspector, Planner, Validator, Executor, and
Evidence agents in this package following the architecture described in:

* docs/02_system_overview.md — section "Backend Agents (Gemini ADK)"
* docs/04_implementation_guide.md — section 3
* docs/10_composio.md — Composio trust model & OAuth flows

Until those modules exist, imports from ``agent.agents`` should be treated as
stubs. Each file should expose a class with the same name as the agent (for
example ``CoordinatorAgent``) inheriting from the appropriate ADK base class.
"""

__all__ = [
    "CoordinatorAgent",
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


CoordinatorAgent = _NotImplementedStub
IntakeAgent = _NotImplementedStub
InspectorAgent = _NotImplementedStub
PlannerAgent = _NotImplementedStub
ValidatorAgent = _NotImplementedStub
ExecutorAgent = _NotImplementedStub
EvidenceAgent = _NotImplementedStub
