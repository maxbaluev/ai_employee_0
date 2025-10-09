"""Shared state models and constants for control-plane agents."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Session keys
# ---------------------------------------------------------------------------
MISSION_CONTEXT_KEY = "mission_context"
SAFEGUARDS_KEY = "safeguards"
RANKED_PLAYS_KEY = "ranked_plays"
SELECTED_PLAY_KEY = "selected_play"
LATEST_ARTIFACT_KEY = "latest_artifact"
LATEST_VALIDATION_KEY = "latest_validation"
EVIDENCE_BUNDLE_KEY = "evidence_bundle"
INSPECTION_PREVIEW_KEY = "inspection_preview"


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------
@dataclass
class MissionContext:
    """Normalised mission context shared across agents."""

    mission_id: str
    tenant_id: str
    objective: str
    audience: str
    timeframe: str
    guardrails: List[str] = field(default_factory=list)
    mode: str = "dry_run"
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SafeguardHint:
    """Adaptive safeguard hint sourced from Supabase or fallbacks."""

    mission_id: str
    hint_type: str
    suggested_value: str
    status: str = "suggested"
    rationale: str = ""
    confidence: float = 0.7


@dataclass
class RankedPlay:
    """Planner-ranked candidate play prior to execution."""

    title: str
    description: str
    impact: str
    risk: str
    undo_plan: str
    toolkit_refs: List[str]
    confidence: float
    mission_id: str
    tenant_id: str
    mode: str = "dry_run"
    play_id: Optional[str] = None
    rationale: str = ""
    telemetry: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Artifact:
    """Artifact preview captured by the execution agent."""

    artifact_id: str
    title: str
    summary: str
    status: str = "draft"
    undo_plan: str = ""
    mission_id: str = ""


@dataclass
class ValidationResult:
    """Outcome returned by the validator stub."""

    status: str
    notes: str
    violations: List[str] = field(default_factory=list)
    reviewer_required: bool = False


@dataclass
class EvidenceBundle:
    """Structured evidence payload stored after execution."""

    mission_id: str
    play_title: str
    artifact_id: str
    summary: str
    undo_plan: str
    safeguards: List[SafeguardHint]
    telemetry: Dict[str, Any] = field(default_factory=dict)


@dataclass
class InspectionPreview:
    """Draft MCP inspection output shared with CopilotKit."""

    slug: str
    name: str
    auth_type: str
    sample_rows: List[str]
    sample_count: int
    no_auth: bool = False
    category: str = "general"
