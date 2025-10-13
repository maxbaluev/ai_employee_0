"""Intake agent responsible for preparing mission context and safeguards."""

from __future__ import annotations

import os
from dataclasses import asdict
from typing import Any, AsyncGenerator, Dict, List, Optional

from google.adk.agents.base_agent import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events.event import Event
from google.genai import types

from pydantic import Field

from ..services import CopilotKitStreamer, SupabaseClient, TelemetryEmitter
from .state import (
    MissionContext,
    SafeguardHint,
    MISSION_CONTEXT_KEY,
    SAFEGUARDS_KEY,
)


class IntakeAgent(BaseAgent):
    """Initialises mission context, safeguards, and telemetry anchors."""

    supabase: Optional[SupabaseClient] = Field(default=None, exclude=True)
    telemetry: Optional[TelemetryEmitter] = Field(default=None, exclude=True)
    streamer: Optional[CopilotKitStreamer] = Field(default=None, exclude=True)

    def __init__(
        self,
        *,
        name: str = "IntakeAgent",
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
        mission_context = self._ensure_context(ctx)
        safeguards = self._hydrate_safeguards(ctx, mission_context)

        ctx.session.state[SAFEGUARDS_KEY] = [asdict(hint) for hint in safeguards]
        ctx.session.state["mission_mode"] = mission_context.mode

        self.telemetry.emit(
            "intake_stage_completed",
            tenant_id=mission_context.tenant_id,
            mission_id=mission_context.mission_id,
            payload={
                "safeguards": [hint.hint_type for hint in safeguards],
                "objective": mission_context.objective,
            },
        )

        self._emit_stream(
            mission_context,
            "intake_stage_completed",
            {
                "safeguards": [hint.hint_type for hint in safeguards],
                "objective": mission_context.objective,
            },
        )

        summary = (
            f"Mission {mission_context.mission_id} ready for planning. "
            f"Collected {len(safeguards)} safeguards and guardrails: "
            f"{'; '.join(mission_context.guardrails) or 'none'}"
        )
        content = types.Content(
            role="system",
            parts=[types.Part(text=summary)],
        )
        yield Event(author=self.name, content=content)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _ensure_context(self, ctx: InvocationContext) -> MissionContext:
        state = ctx.session.state or {}
        raw: Dict[str, str] = {}
        existing = state.get(MISSION_CONTEXT_KEY)
        if isinstance(existing, dict):
            raw = existing

        mission_id = raw.get("mission_id") or getattr(ctx.session, "id", "mission-dry-run")
        tenant_id = raw.get("tenant_id")
        if not tenant_id:
            raise ValueError(
                "tenant_id is required in mission context. "
                "Ensure the session state includes explicit tenant_id."
            )
        objective = raw.get("objective") or "Prove value in dry-run mode"
        audience = raw.get("audience") or "Pilot revenue team"
        timeframe = raw.get("timeframe") or "Next 14 days"
        guardrails: List[str] = raw.get("guardrails", []) or [
            "Maintain professional tone",
            "Respect quiet window 20:00-07:00 tenant local",
            "Document undo plan for each action",
        ]
        mode = raw.get("mode") or state.get("mission_mode", "dry_run")

        context = MissionContext(
            mission_id=mission_id,
            tenant_id=tenant_id,
            objective=objective,
            audience=audience,
            timeframe=timeframe,
            guardrails=guardrails,
            mode=mode,
            metadata=raw.get("metadata", {}),
        )

        state[MISSION_CONTEXT_KEY] = asdict(context)
        ctx.session.state = state
        return context

    def _session_identifier(self, context: MissionContext) -> str:
        metadata = context.metadata or {}
        candidate = metadata.get("session_identifier") if isinstance(metadata, dict) else None
        return str(candidate) if candidate else context.mission_id

    def _emit_stream(
        self,
        context: MissionContext,
        stage: str,
        metadata: Dict[str, Any],
    ) -> None:
        if not self.streamer:
            return
        self.streamer.emit_message(
            tenant_id=context.tenant_id,
            session_identifier=self._session_identifier(context),
            role="assistant",
            content=f"{stage}: {metadata.get('objective', context.objective)}",
            metadata={"stage": stage, **metadata},
            mission_id=context.mission_id,
            payload_type="intake_update",
        )

    def _hydrate_safeguards(
        self, ctx: InvocationContext, mission_context: MissionContext
    ) -> List[SafeguardHint]:
        rows = self.supabase.fetch_safeguards(
            mission_id=mission_context.mission_id,
            tenant_id=mission_context.tenant_id,
        )
        hints: List[SafeguardHint] = []
        for row in rows:
            hints.append(
                SafeguardHint(
                    mission_id=row.get("mission_id", mission_context.mission_id),
                    hint_type=row.get("hint_type", "tone"),
                    suggested_value=row.get(
                        "suggested_value", "Maintain professional tone"
                    ),
                    status=row.get("status", "suggested"),
                    rationale=row.get("rationale", "Baseline safeguard import"),
                    confidence=float(row.get("confidence", 0.75)),
                )
            )

        if not hints:
            hints = [
                SafeguardHint(
                    mission_id=mission_context.mission_id,
                    hint_type="tone",
                    suggested_value="Maintain professional tone",
                    status="suggested",
                    rationale="Default Gate G-A safeguard",
                    confidence=0.7,
                )
            ]

        return hints
