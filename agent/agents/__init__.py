"""Gemini ADK agents for the mission lifecycle.

This package implements the seven-stage mission journey agents following the
architecture described in:

* docs/02_system_overview.md — section "Backend Agents (Gemini ADK)"
* docs/04_implementation_guide.md — section 3
* docs/10_composio.md — Composio trust model & OAuth flows

Implemented Agents:
- CoordinatorAgent: Orchestrates seven-stage mission lifecycle (TASK-ADK-001)
- IntakeAgent: Stage 1 (Define) brief generation (TASK-ADK-002)
- InspectorAgent: Stage 2 (Prepare) toolkit discovery and OAuth (TASK-ADK-003)
- PlannerAgent: Stage 3 (Plan) play ranking and library retrieval (TASK-ADK-004)
- ValidatorAgent: Safeguard enforcement across stages (TASK-ADK-005)
- ExecutorAgent: Stage 5 governed execution via Composio (TASK-ADK-006)
- EvidenceAgent: Stages 5-6 artifact packaging (TASK-ADK-007)

Planned Agents (stubs):
-
"""

from agent.agents.coordinator import CoordinatorAgent, MissionStage
from agent.agents.inspector import (
    ConnectionResult,
    DiscoveryResult,
    InspectionPreview,
    InspectorAgent,
    ToolkitRecommendation,
)
from agent.agents.intake import (
    ChipConfidence,
    IntakeAgent,
    MissionBrief,
    PersonaType,
)
from agent.agents.evidence import (
    ArtifactMetadata,
    EvidenceAgent,
    EvidenceBundle,
    LibraryContribution,
)
from agent.agents.executor import (
    AuthExpiredError,
    ExecutionAction,
    ExecutionResult,
    ExecutionSummary,
    ExecutorAgent,
    ExecutorError,
    RateLimitError,
    ToolExecutionError,
)
from agent.agents.planner import (
    LibraryPrecedent,
    MissionPlay,
    PlannerAgent,
    PlannerSummary,
    UndoPlan,
)
from agent.agents.validator import (
    ScopeValidationResult,
    Safeguard,
    ValidationResult,
    ValidationSeverity,
    ValidationStatus,
    ValidatorAgent,
)

__all__ = [
    "CoordinatorAgent",
    "MissionStage",
    "IntakeAgent",
    "PersonaType",
    "MissionBrief",
    "ChipConfidence",
    "InspectorAgent",
    "ToolkitRecommendation",
    "DiscoveryResult",
    "ConnectionResult",
    "InspectionPreview",
    "PlannerAgent",
    "MissionPlay",
    "UndoPlan",
    "LibraryPrecedent",
    "PlannerSummary",
    "ValidatorAgent",
    "ValidationResult",
    "ValidationSeverity",
    "ValidationStatus",
    "ScopeValidationResult",
    "Safeguard",
    "ExecutorAgent",
    "ExecutionAction",
    "ExecutionResult",
    "ExecutionSummary",
    "ExecutorError",
    "RateLimitError",
    "AuthExpiredError",
    "ToolExecutionError",
    "EvidenceAgent",
    "EvidenceBundle",
    "ArtifactMetadata",
    "LibraryContribution",
]


class _NotImplementedStub:
    def __init__(self, *args, **kwargs) -> None:  # noqa: D401 - simple stub
        raise NotImplementedError(
            "Agent scaffolding placeholder. Implement per docs before use.",
        )


# Stubs for not-yet-implemented agents
