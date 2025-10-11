"""Control plane ADK agent assembly for Gate G-B."""

from __future__ import annotations

from ag_ui_adk import ADKAgent
from google.adk.sessions import InMemorySessionService

from .coordinator import build_coordinator_agent
from .executor import append_planner_note, set_mission_details, upsert_artifact

__all__ = [
    "build_control_plane_agent",
    "set_mission_details",
    "append_planner_note",
    "upsert_artifact",
]


def build_control_plane_agent() -> ADKAgent:
    """Return the fully wired Gate G-A coordinator wrapped as an ADKAgent."""

    coordinator = build_coordinator_agent(max_retries=3)

    return ADKAgent(
        adk_agent=coordinator,
        app_name="control_plane_foundation",
        user_id="foundation_user",
        session_timeout_seconds=3600,
        use_in_memory_services=True,
        session_service=InMemorySessionService(),
    )
