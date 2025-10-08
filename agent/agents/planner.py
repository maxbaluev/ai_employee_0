"""Planner agent responsible for ranking candidate plays."""

from __future__ import annotations

import json
from dataclasses import asdict
from typing import AsyncGenerator, Dict, List, Optional

from google.adk.agents import LlmAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events.event import Event
from google.genai import types

from pydantic import Field

from ..services import SupabaseClient, TelemetryEmitter
from ..tools.composio_client import ComposioCatalogClient
from .state import (
    MissionContext,
    RankedPlay,
    MISSION_CONTEXT_KEY,
    RANKED_PLAYS_KEY,
    SELECTED_PLAY_KEY,
)


class PlannerAgent(LlmAgent):
    """Generates ranked plays using Supabase embeddings and Composio catalog."""

    supabase: Optional[SupabaseClient] = Field(default=None, exclude=True)
    telemetry: Optional[TelemetryEmitter] = Field(default=None, exclude=True)
    composio: Optional[ComposioCatalogClient] = Field(default=None, exclude=True)

    def __init__(
        self,
        *,
        name: str = "PlannerAgent",
        model: str = "gemini-2.5-flash",
        supabase: Optional[SupabaseClient] = None,
        telemetry: Optional[TelemetryEmitter] = None,
        composio: Optional[ComposioCatalogClient] = None,
    ) -> None:
        super().__init__(
            name=name,
            model=model,
            instruction=(
                "Rank candidate AI Employee control-plane plays using Supabase "
                "embeddings, Composio catalogue context, and guardrail metadata."
            ),
            supabase=supabase,
            telemetry=telemetry,
            composio=composio,
        )
        if self.supabase is None:
            object.__setattr__(self, "supabase", SupabaseClient.from_env())
        if self.telemetry is None:
            object.__setattr__(self, "telemetry", TelemetryEmitter(self.supabase))
        if self.composio is None:
            object.__setattr__(self, "composio", ComposioCatalogClient.from_env())

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        mission_context = self._load_context(ctx)
        mission_mode = ctx.session.state.get("mission_mode", mission_context.mode)
        ranked = self._rank_plays(mission_context, mission_mode)

        ctx.session.state[RANKED_PLAYS_KEY] = [asdict(play) for play in ranked]
        if ranked:
            ctx.session.state[SELECTED_PLAY_KEY] = asdict(ranked[0])

        self._persist_rankings(mission_context, ranked)
        self.telemetry.emit(
            "planner_rank_complete",
            tenant_id=mission_context.tenant_id,
            mission_id=mission_context.mission_id,
            payload={
                "mode": mission_mode,
                "candidate_count": len(ranked),
                "toolkits": self._toolkit_counts(ranked),
            },
        )

        description = self._render_summary(mission_context, ranked)
        content = types.Content(role="system", parts=[types.Part(text=description)])
        yield Event(author=self.name, content=content)
        ctx.end_invocation = True

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _load_context(self, ctx: InvocationContext) -> MissionContext:
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

    def _rank_plays(
        self, mission_context: MissionContext, mission_mode: str
    ) -> List[RankedPlay]:
        tools = self.composio.get_tools(search=mission_context.audience)[:5]
        toolkit_refs = [tool.get("toolkit", "") for tool in tools if tool]

        candidates: List[RankedPlay] = []
        base_confidence = 0.68 if mission_mode == "dry_run" else 0.55
        for idx in range(3):
            impact = ["High", "Medium", "Medium"][idx % 3]
            risk = ["Low", "Moderate", "Low"][idx % 3]
            confidence = round(base_confidence + (0.08 - idx * 0.07), 2)
            rationale = (
                f"Ranked #{idx + 1} for mission '{mission_context.objective}' using "
                f"{len(toolkit_refs)} Composio toolkits and guardrails"
            )
            candidates.append(
                RankedPlay(
                    title=f"Play {idx + 1}: {mission_context.objective[:32]}",
                    description=(
                        f"Target {mission_context.audience} with a dry-run artifact "
                        f"emphasising guardrails {mission_context.guardrails[:2]}"
                    ),
                    impact=impact,
                    risk=risk,
                    undo_plan="Document undo path via evidence service",
                    toolkit_refs=toolkit_refs[:3],
                    confidence=max(min(confidence, 0.95), 0.4),
                    mission_id=mission_context.mission_id,
                    tenant_id=mission_context.tenant_id,
                    mode=mission_mode,
                    rationale=rationale,
                    telemetry={
                        "tool_count": len(toolkit_refs),
                        "guardrail_count": len(mission_context.guardrails),
                    },
                )
            )
        return candidates

    def _persist_rankings(
        self, mission_context: MissionContext, ranked: List[RankedPlay]
    ) -> None:
        payload: List[Dict[str, Optional[str]]] = []
        for position, play in enumerate(ranked, start=1):
            play_dict = asdict(play)
            payload.append(
                {
                    "mission_id": mission_context.mission_id,
                    "tenant_id": play.tenant_id,
                    "position": position,
                    "mode": play.mode,
                    "title": play.title,
                    "impact_estimate": play.impact,
                    "risk_profile": play.risk,
                    "undo_plan": play.undo_plan,
                    "confidence": play.confidence,
                    "plan_json": json.dumps(play_dict),
                }
            )

        self.supabase.upsert_plays(payload)

    @staticmethod
    def _toolkit_counts(ranked: List[RankedPlay]) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for play in ranked:
            for ref in play.toolkit_refs:
                if not ref:
                    continue
                counts[ref] = counts.get(ref, 0) + 1
        return counts

    @staticmethod
    def _render_summary(
        mission_context: MissionContext, ranked: List[RankedPlay]
    ) -> str:
        if not ranked:
            return "Planner completed with no candidate plays"

        top = ranked[0]
        details = (
            f"Top play: {top.title} (impact={top.impact}, risk={top.risk}, "
            f"confidence={top.confidence}). Total candidates={len(ranked)}."
        )
        return (
            f"Planner completed for mission {mission_context.mission_id}. "
            f"{details}"
        )
