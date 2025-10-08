"""Control plane agent used for Gate G-A foundation readiness.

The agent keeps mission planning state synchronised with the CopilotKit UI
and exposes ADK tools for structured updates. The real orchestration logic
will grow in later gates; this foundation focuses on predictable state
management, guardrail-aware instruction scaffolding, and catalog awareness.
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from ag_ui_adk import ADKAgent
from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmRequest, LlmResponse
from google.adk.sessions import InMemorySessionService
from google.adk.tools import ToolContext
from google.genai import types
from pydantic import BaseModel, Field

from ..tools.composio_client import ComposioCatalogClient

load_dotenv()


MISSION_STATE_KEY = "mission_state"
ARTIFACT_STATE_KEY = "mission_artifacts"


@dataclass
class Artifact:
    """Simple artifact preview captured during dry-run workflows."""

    artifact_id: str
    title: str
    summary: str
    status: str = "draft"


class MissionState(BaseModel):
    """Shared state between the ADK agent and the CopilotKit UI."""

    objective: str = Field(default="", description="Mission goal provided by the user")
    audience: str = Field(default="", description="Target persona or team")
    timeframe: str = Field(default="", description="Desired completion horizon")
    guardrails: str = Field(default="", description="Constraints, tone, or quiet hours")
    planner_notes: List[str] = Field(default_factory=list, description="Short bullet notes added by planners")


def _ensure_mission_state(storage: Dict[str, Any]) -> MissionState:
    raw = storage.get(MISSION_STATE_KEY)
    if isinstance(raw, MissionState):
        return raw
    if isinstance(raw, dict):
        return MissionState(**raw)
    mission = MissionState()
    storage[MISSION_STATE_KEY] = mission
    return mission


def _get_artifact_bucket(storage: Dict[str, Any]) -> Dict[str, Artifact]:
    bucket = storage.get(ARTIFACT_STATE_KEY)
    if isinstance(bucket, dict) and all(isinstance(v, Artifact) for v in bucket.values()):
        return bucket  # type: ignore[return-value]
    if isinstance(bucket, dict):
        revived: Dict[str, Artifact] = {}
        for key, value in bucket.items():
            if isinstance(value, Artifact):
                revived[key] = value
            elif isinstance(value, dict):
                revived[key] = Artifact(**value)
        storage[ARTIFACT_STATE_KEY] = revived
        return revived
    revived = {}
    storage[ARTIFACT_STATE_KEY] = revived
    return revived


def set_mission_details(
    tool_context: ToolContext,
    objective: str,
    audience: str,
    timeframe: str,
    guardrails: str,
) -> Dict[str, str]:
    """Update the core mission brief shared between planner and UI."""

    mission = _ensure_mission_state(tool_context.state)
    mission.objective = objective.strip()
    mission.audience = audience.strip()
    mission.timeframe = timeframe.strip()
    mission.guardrails = guardrails.strip()
    tool_context.state[MISSION_STATE_KEY] = mission
    return {"status": "success"}


def append_planner_note(tool_context: ToolContext, note: str) -> Dict[str, str]:
    """Attach a short planner note to the shared mission state."""

    mission = _ensure_mission_state(tool_context.state)
    if note:
        mission.planner_notes.append(note.strip())
    tool_context.state[MISSION_STATE_KEY] = mission
    return {"status": "success", "notes": mission.planner_notes}


def upsert_artifact(
    tool_context: ToolContext,
    artifact_id: str,
    title: str,
    summary: str,
    status: str = "draft",
) -> Dict[str, Any]:
    """Create or update a mission artifact preview."""

    artifacts = _get_artifact_bucket(tool_context.state)
    artifacts[artifact_id] = Artifact(
        artifact_id=artifact_id,
        title=title.strip(),
        summary=summary.strip(),
        status=status.strip() or "draft",
    )
    tool_context.state[ARTIFACT_STATE_KEY] = artifacts
    return {
        "status": "success",
        "artifact": asdict(artifacts[artifact_id]),
    }


def on_before_agent(callback_context: CallbackContext) -> None:
    """Initialise mission state and expose catalog metadata."""

    state = callback_context.state
    mission = _ensure_mission_state(state)
    artifacts = _get_artifact_bucket(state)

    if not artifacts:
        artifacts["dry-run-outline"] = Artifact(
            artifact_id="dry-run-outline",
            title="Dry-run Planning Outline",
            summary="Sequenced steps for zero-privilege proof pack generation.",
            status="draft",
        )
        state[ARTIFACT_STATE_KEY] = artifacts

    client = ComposioCatalogClient.from_default_cache()
    state.setdefault("composio_catalog", client.metadata)

    if not mission.planner_notes:
        summary = client.metadata.get("summary", {})
        mission.planner_notes.extend(
            [
                "Gate G-A baseline initialised",
                f"Catalog cached toolkits: {summary.get('toolkits', 0)}",
            ]
        )
        state[MISSION_STATE_KEY] = mission

    if not mission.objective:
        mission.objective = "Prove value in dry-run mode"
        mission.audience = "Pilot revenue team"
        mission.timeframe = "Next 14 days"
        mission.guardrails = "Follow quiet hours, tone policy, undo-first mindset"
        state[MISSION_STATE_KEY] = mission


def before_model_modifier(
    callback_context: CallbackContext, llm_request: LlmRequest
) -> Optional[LlmResponse]:
    """Inject mission state and catalog awareness into the prompt."""

    mission = _ensure_mission_state(callback_context.state)
    artifacts = _get_artifact_bucket(callback_context.state)

    catalog_meta = callback_context.state.get("composio_catalog", {})

    mission_json = mission.model_dump()
    artifact_json = {key: asdict(value) for key, value in artifacts.items()}
    catalog_json = json.dumps(catalog_meta, indent=2)

    instruction_header = (
        "You are the foundation control-plane orchestrator. Maintain mission briefs,"
        " reference guardrail policy packs, and suggest dry-run proof artifacts that"
        " build trust before OAuth activation."
    )

    context_block = json.dumps(
        {
            "mission": mission_json,
            "artifacts": artifact_json,
            "composio_catalog": catalog_meta,
        },
        indent=2,
    )

    original_instruction: types.Content
    if isinstance(llm_request.config.system_instruction, types.Content):
        original_instruction = llm_request.config.system_instruction
    else:
        original_instruction = types.Content(role="system", parts=[])

    if not original_instruction.parts:
        original_instruction.parts.append(types.Part(text=""))

    original_instruction.parts[0].text = (
        f"{instruction_header}\n\n"
        f"Current mission context (Gate G-A baseline):\n{context_block}\n\n"
        "Use the available tools to keep mission state in sync."
    )

    llm_request.config.system_instruction = original_instruction
    return None


def after_model_modifier(
    callback_context: CallbackContext, llm_response: LlmResponse
) -> Optional[LlmResponse]:
    """Stop looping when the agent provides a textual reply."""

    if llm_response.content and llm_response.content.parts:
        callback_context._invocation_context.end_invocation = True
    return None


def build_control_plane_agent() -> ADKAgent:
    """Return an ADK agent configured for the foundation control plane."""

    mission_agent = LlmAgent(
        name="ControlPlaneAgent",
        model=os.getenv("CONTROL_PLANE_MODEL", "gemini-2.5-flash"),
        instruction=(
            "You coordinate the AI Employee control plane foundation. "
            "Focus on capturing mission objectives, referencing guardrail policies, "
            "and preparing evidence artifacts aligned with the PRD and Execution Tracker."
        ),
        tools=[set_mission_details, append_planner_note, upsert_artifact],
        before_agent_callback=on_before_agent,
        before_model_callback=before_model_modifier,
        after_model_callback=after_model_modifier,
    )

    return ADKAgent(
        adk_agent=mission_agent,
        app_name="control_plane_foundation",
        user_id="foundation_user",
        session_timeout_seconds=3600,
        use_in_memory_services=True,
        session_service=InMemorySessionService(),
    )
