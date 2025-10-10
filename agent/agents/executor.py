"""Dry-run execution agent and shared tool functions for mission state."""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import asdict, dataclass
from typing import Any, AsyncGenerator, Dict, List, Optional

from google.adk.agents.base_agent import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events.event import Event
from google.adk.tools import ToolContext
from google.genai import types
from pydantic import BaseModel, Field

from ..services import CopilotKitStreamer, SupabaseClient, TelemetryEmitter
from .state import (
    Artifact,
    MissionContext,
    MISSION_CONTEXT_KEY,
    RANKED_PLAYS_KEY,
    SELECTED_PLAY_KEY,
    SAFEGUARDS_KEY,
    LATEST_ARTIFACT_KEY,
)


LOGGER = logging.getLogger(__name__)


MISSION_STATE_KEY = "mission_state"
ARTIFACT_STATE_KEY = "mission_artifacts"


# ---------------------------------------------------------------------------
# Mission state models reused by CopilotKit tool calls
# ---------------------------------------------------------------------------
@dataclass
class ArtifactPreview:
    """Simple artifact preview captured during dry-run workflows."""

    artifact_id: str
    title: str
    summary: str
    status: str = "draft"


class MissionState(BaseModel):
    """Shared state between ADK tools and the CopilotKit UI."""

    objective: str = Field(default="", description="Mission goal provided by the user")
    audience: str = Field(default="", description="Target persona or team")
    timeframe: str = Field(default="", description="Desired completion horizon")
    guardrails: str = Field(default="", description="Constraints, tone, or quiet hours")
    planner_notes: List[str] = Field(
        default_factory=list, description="Short bullet notes added by planners"
    )


def _ensure_mission_state(storage: Dict[str, Any]) -> MissionState:
    raw = storage.get(MISSION_STATE_KEY)
    if isinstance(raw, MissionState):
        return raw
    if isinstance(raw, dict):
        return MissionState(**raw)
    mission = MissionState()
    storage[MISSION_STATE_KEY] = mission
    return mission


def _get_artifact_bucket(storage: Dict[str, Any]) -> Dict[str, ArtifactPreview]:
    bucket = storage.get(ARTIFACT_STATE_KEY)
    if isinstance(bucket, dict) and all(
        isinstance(v, ArtifactPreview) for v in bucket.values()
    ):
        return bucket  # type: ignore[return-value]
    if isinstance(bucket, dict):
        revived: Dict[str, ArtifactPreview] = {}
        for key, value in bucket.items():
            if isinstance(value, ArtifactPreview):
                revived[key] = value
            elif isinstance(value, dict):
                revived[key] = ArtifactPreview(**value)
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
    artifacts[artifact_id] = ArtifactPreview(
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


# ---------------------------------------------------------------------------
# Executor agent
# ---------------------------------------------------------------------------
class DryRunExecutorAgent(BaseAgent):
    """Produces dry-run artifacts based on ranked plays and guardrails."""

    supabase: Optional[SupabaseClient] = Field(default=None, exclude=True)
    telemetry: Optional[TelemetryEmitter] = Field(default=None, exclude=True)
    streamer: Optional[CopilotKitStreamer] = Field(default=None, exclude=True)

    def __init__(
        self,
        *,
        name: str = "ExecutionAgent",
        supabase: Optional[SupabaseClient] = None,
        telemetry: Optional[TelemetryEmitter] = None,
        streamer: Optional[CopilotKitStreamer] = None,
    ) -> None:
        super().__init__(
            name=name,
            supabase=supabase,
            telemetry=telemetry,
            streamer=streamer,
        )
        if self.supabase is None:
            object.__setattr__(self, "supabase", SupabaseClient.from_env())
        if self.telemetry is None:
            object.__setattr__(self, "telemetry", TelemetryEmitter(self.supabase))
        if self.streamer is None:
            object.__setattr__(self, "streamer", CopilotKitStreamer())

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        mission_context = self._mission_context(ctx)
        selected_play = self._selected_play(ctx)
        safeguards = self._safeguards(ctx, mission_context)

        # Emit executor_stage_started
        attempt = self._current_attempt(ctx)
        self._emit_stage_started(mission_context, selected_play, attempt)

        artifact = self._generate_artifact(mission_context, selected_play, safeguards)

        # Emit toolkit simulation status for each toolkit
        self._emit_toolkit_simulations(mission_context, selected_play)

        artifacts_bucket = ctx.session.state.get(ARTIFACT_STATE_KEY, {})
        if not isinstance(artifacts_bucket, dict):
            artifacts_bucket = {}
        artifacts_bucket[artifact.artifact_id] = asdict(artifact)
        ctx.session.state[ARTIFACT_STATE_KEY] = artifacts_bucket
        ctx.session.state[LATEST_ARTIFACT_KEY] = asdict(artifact)

        self._persist_artifact(mission_context, selected_play, artifact)
        self.telemetry.emit(
            "executor_artifact_created",
            tenant_id=mission_context.tenant_id,
            mission_id=mission_context.mission_id,
            payload={
                "artifact_id": artifact.artifact_id,
                "play_title": selected_play.get("title"),
            },
        )

        self._emit_artifact_created(
            mission_context,
            artifact,
            selected_play,
        )

        message = (
            f"Generated artifact {artifact.artifact_id} for play "
            f"'{selected_play.get('title', 'unknown')}'."
        )
        content = types.Content(role="assistant", parts=[types.Part(text=message)])
        yield Event(author=self.name, content=content)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _mission_context(self, ctx: InvocationContext) -> MissionContext:
        raw = ctx.session.state.get(MISSION_CONTEXT_KEY, {})
        if isinstance(raw, dict):
            return MissionContext(
                mission_id=raw.get("mission_id", "mission-dry-run"),
                tenant_id=raw.get("tenant_id", "gate-ga-default"),
                objective=raw.get("objective", "Prove value in dry-run mode"),
                audience=raw.get("audience", "Pilot revenue team"),
                timeframe=raw.get("timeframe", "Next 14 days"),
                guardrails=raw.get("guardrails", []),
                mode=raw.get("mode", ctx.session.state.get("mission_mode", "dry_run")),
                metadata=raw.get("metadata", {}),
            )
        return MissionContext(
            mission_id="mission-dry-run",
            tenant_id="gate-ga-default",
            objective="Prove value in dry-run mode",
            audience="Pilot revenue team",
            timeframe="Next 14 days",
            guardrails=["Maintain professional tone"],
            mode=ctx.session.state.get("mission_mode", "dry_run"),
            metadata={},
        )

    def _selected_play(self, ctx: InvocationContext) -> Dict[str, Any]:
        play = ctx.session.state.get(SELECTED_PLAY_KEY)
        if isinstance(play, dict):
            return play
        ranked = ctx.session.state.get(RANKED_PLAYS_KEY)
        if isinstance(ranked, list) and ranked:
            first = ranked[0]
            if isinstance(first, dict):
                return first
        return {
            "title": "Dry-run discovery",
            "impact": "Medium",
            "risk": "Low",
            "undo_plan": "Manual review only",
            "toolkit_refs": [],
        }

    def _generate_artifact(
        self,
        mission_context: MissionContext,
        selected_play: Dict[str, Any],
        safeguards: List[Dict[str, Any]],
    ) -> Artifact:
        title = selected_play.get("title", "Dry-run Plan")
        artifact_id = self._slugify(
            f"{mission_context.mission_id}-{title}".replace(" ", "-")
        )
        guardrail_summary = ", ".join(mission_context.guardrails[:3]) or "None"
        def _render(value: Any) -> str:
            if isinstance(value, str):
                return value
            if isinstance(value, (list, tuple, set)):
                return ", ".join(str(v) for v in value if v)
            if isinstance(value, dict):
                return ", ".join(f"{k}: {v}" for k, v in value.items())
            return str(value)

        safeguard_summary = ", ".join(
            _render(hint.get("suggested_value") or hint.get("hint_type", ""))
            for hint in safeguards
            if isinstance(hint, dict)
        ).strip().strip(',')
        summary_parts = [
            f"Outline for {mission_context.objective} targeting {mission_context.audience}.",
            f"Impact: {selected_play.get('impact', 'Medium')}.",
            f"Guardrails: {guardrail_summary}.",
        ]
        if safeguard_summary:
            summary_parts.append(f"Safeguards: {safeguard_summary}.")
        summary = " ".join(summary_parts)
        return Artifact(
            artifact_id=artifact_id,
            title=f"Dry-run: {title}",
            summary=summary,
            status="draft",
            undo_plan=selected_play.get("undo_plan", "Document manual rollback"),
            mission_id=mission_context.mission_id,
        )

    def _safeguards(
        self, ctx: InvocationContext, mission_context: MissionContext
    ) -> List[Dict[str, Any]]:
        raw = ctx.session.state.get(SAFEGUARDS_KEY, [])
        results: List[Dict[str, Any]] = []
        if isinstance(raw, list):
            for item in raw:
                if isinstance(item, dict):
                    results.append(item)
        return results

    def _persist_artifact(
        self,
        mission_context: MissionContext,
        selected_play: Dict[str, Any],
        artifact: Artifact,
    ) -> None:
        artifact_payload = {
            "tenant_id": mission_context.tenant_id,
            "play_id": selected_play.get("play_id"),
            "type": "dry_run_outline",
            "title": artifact.title,
            "content": asdict(artifact),
            "status": artifact.status,
            "hash": hashlib.sha256(artifact.summary.encode("utf-8")).hexdigest(),
            "checksum": hashlib.sha256(
                json.dumps(asdict(artifact), sort_keys=True).encode("utf-8")
            ).hexdigest(),
        }
        self.supabase.insert_artifacts([artifact_payload])

        tool_calls = []
        for toolkit in selected_play.get("toolkit_refs", []):
            if not toolkit:
                continue
            arguments = {
                "artifact_id": artifact.artifact_id,
                "mission_id": mission_context.mission_id,
                "toolkit": toolkit,
            }
            tool_calls.append(
                {
                    "tenant_id": mission_context.tenant_id,
                    "play_id": selected_play.get("play_id"),
                    "toolkit": toolkit,
                    "tool_name": "dry_run_stub",
                    "arguments": arguments,
                    "arguments_hash": hashlib.sha256(
                        json.dumps(arguments, sort_keys=True).encode("utf-8")
                    ).hexdigest(),
                    "undo_plan": selected_play.get("undo_plan", ""),
                    "guardrail_snapshot": {
                        "guardrails": mission_context.guardrails,
                    },
                }
            )
        if tool_calls:
            self.supabase.insert_tool_calls(tool_calls)

    def _current_attempt(self, ctx: InvocationContext) -> int:
        attempt_raw = ctx.session.state.get("execution_attempt")
        if isinstance(attempt_raw, int) and attempt_raw > 0:
            return attempt_raw
        return 1

    def _session_identifier(self, context: MissionContext) -> str:
        metadata = context.metadata or {}
        candidate = metadata.get("session_identifier") if isinstance(metadata, dict) else None
        return str(candidate) if candidate else context.mission_id

    def _emit_stage_started(
        self,
        context: MissionContext,
        play: Dict[str, Any],
        attempt: int,
    ) -> None:
        if not self.streamer:
            return
        self.streamer.emit_stage(
            tenant_id=context.tenant_id,
            session_identifier=self._session_identifier(context),
            stage="executor_stage_started",
            event="stage_started",
            content=f"Execution attempt {attempt} started for {play.get('title', 'selected play')}",
            mission_id=context.mission_id,
            mission_status="in_progress",
            metadata={
                "attempt": attempt,
                "play_title": play.get("title"),
                "play_id": play.get("play_id"),
                "toolkit_count": len(play.get("toolkit_refs", [])),
            },
        )

    def _emit_toolkit_simulations(
        self,
        context: MissionContext,
        play: Dict[str, Any],
    ) -> None:
        if not self.streamer:
            return
        toolkits = [tk for tk in play.get("toolkit_refs", []) if tk]
        total = len(toolkits)
        if total == 0:
            return
        for index, toolkit in enumerate(toolkits, start=1):
            self.streamer.emit_stage(
                tenant_id=context.tenant_id,
                session_identifier=self._session_identifier(context),
                stage="executor_status",
                event="toolkit_simulation",
                content=f"Simulating toolkit {toolkit} ({index}/{total})",
                mission_id=context.mission_id,
                mission_status="in_progress",
                metadata={
                    "toolkit": toolkit,
                    "position": index,
                    "total": total,
                    "play_id": play.get("play_id"),
                    "artifact_preview": play.get("title"),
                },
            )

    def _emit_artifact_created(
        self,
        context: MissionContext,
        artifact: Artifact,
        play: Dict[str, Any],
    ) -> None:
        if not self.streamer:
            return
        message = (
            f"Draft artifact {artifact.artifact_id} ready for review "
            f"({play.get('title', 'unnamed play')})."
        )
        metadata = {
            "artifact_id": artifact.artifact_id,
            "play_title": play.get("title"),
            "status": artifact.status,
            "undo_plan": play.get("undo_plan"),
            "hash": hashlib.sha256(artifact.summary.encode("utf-8")).hexdigest(),
        }
        self.streamer.emit_stage(
            tenant_id=context.tenant_id,
            session_identifier=self._session_identifier(context),
            stage="executor_artifact_created",
            event="artifact_ready",
            content=message,
            mission_id=context.mission_id,
            mission_status="in_progress",
            metadata=metadata,
        )

    @staticmethod
    def _slugify(value: str) -> str:
        return "".join(ch if ch.isalnum() else "-" for ch in value).strip("-")[:64]


__all__ = [
    "DryRunExecutorAgent",
    "set_mission_details",
    "append_planner_note",
    "upsert_artifact",
    "MISSION_STATE_KEY",
    "ARTIFACT_STATE_KEY",
]
