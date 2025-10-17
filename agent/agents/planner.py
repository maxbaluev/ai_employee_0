"""PlannerAgent assembles ranked mission plays for Stage 3 (Plan).

The agent consumes mission context produced by IntakeAgent and InspectorAgent,
retrieves relevant library precedents, coordinates with ValidatorAgent for
scope alignment, and emits ranked plays with undo plans for stakeholder
approval.
"""

from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, Iterable, List, Sequence

from google.adk.agents import LlmAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai.types import Content, Part

from agent.services import SupabaseClientWrapper, TelemetryClient

try:  # Optional import during static analysis
    from agent.agents.validator import (
        ScopeValidationResult,
        ValidationStatus,
        ValidatorAgent,
    )
except ImportError:  # pragma: no cover
    ValidatorAgent = None  # type: ignore
    ScopeValidationResult = None  # type: ignore
    ValidationStatus = None  # type: ignore


@dataclass(slots=True)
class LibraryPrecedent:
    """Precedent mission used to inform play ranking."""

    precedent_id: str
    title: str
    similarity: float
    summary: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "precedent_id": self.precedent_id,
            "title": self.title,
            "similarity": self.similarity,
            "summary": self.summary,
        }


@dataclass(slots=True)
class UndoPlan:
    """Undo plan describing rollback sequence for a mission play."""

    undo_id: str
    label: str
    impact_summary: str
    risk_assessment: str
    steps: List[str]
    window_minutes: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "undo_id": self.undo_id,
            "label": self.label,
            "impact_summary": self.impact_summary,
            "risk_assessment": self.risk_assessment,
            "steps": list(self.steps),
            "window_minutes": self.window_minutes,
        }


@dataclass(slots=True)
class MissionPlay:
    """Ranked mission play produced by PlannerAgent."""

    play_id: str
    title: str
    summary: str
    steps: List[str]
    tool_usage: List[Dict[str, Any]]
    confidence: float
    precedents: List[LibraryPrecedent] = field(default_factory=list)
    undo_plan: UndoPlan | None = None

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "id": self.play_id,
            "title": self.title,
            "summary": self.summary,
            "steps": list(self.steps),
            "tool_usage": list(self.tool_usage),
            "confidence": self.confidence,
            "precedents": [precedent.to_dict() for precedent in self.precedents],
        }
        if self.undo_plan:
            payload["undo_plan_id"] = self.undo_plan.undo_id
        return payload


@dataclass(slots=True)
class PlannerSummary:
    """Aggregated summary of planner outputs for observability."""

    generated_at: str
    total_plays: int
    top_confidence: float
    average_confidence: float
    library_precedents_used: int
    validator_status: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class PlannerAgent(LlmAgent):
    """Gemini ADK agent responsible for mission play assembly (Stage 3)."""

    def __init__(
        self,
        *,
        name: str,
        validator_agent: ValidatorAgent | None = None,
        supabase_client: SupabaseClientWrapper | None = None,
        telemetry: TelemetryClient | None = None,
        model: str | None = None,
        max_plays: int = 3,
        library_limit: int = 5,
        **kwargs: Any,
    ) -> None:
        super().__init__(
            name=name,
            model=model or "models/gemini-1.5-pro",
            sub_agents=[],
            **kwargs,
        )
        object.__setattr__(self, "_validator", validator_agent)
        object.__setattr__(self, "_supabase", supabase_client)
        object.__setattr__(self, "_telemetry", telemetry)
        object.__setattr__(self, "_max_plays", max(1, max_plays))
        object.__setattr__(self, "_library_limit", max(1, library_limit))

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------
    @property
    def validator_agent(self) -> ValidatorAgent | None:
        return getattr(self, "_validator", None)

    @property
    def supabase_client(self) -> SupabaseClientWrapper | None:
        return getattr(self, "_supabase", None)

    @property
    def telemetry(self) -> TelemetryClient | None:
        return getattr(self, "_telemetry", None)

    @property
    def max_plays(self) -> int:
        return getattr(self, "_max_plays", 3)

    @property
    def library_limit(self) -> int:
        return getattr(self, "_library_limit", 5)

    # ------------------------------------------------------------------
    # Core execution
    # ------------------------------------------------------------------
    async def _run_async_impl(
        self,
        ctx: InvocationContext,
    ) -> AsyncGenerator[Event, None]:
        if not self._ensure_mission_context(ctx):
            yield self._error_event(ctx, "Missing mission context (mission_id, tenant_id, user_id).")
            return

        try:
            mission_brief = ctx.session.state["mission_brief"]
        except KeyError as exc:
            await self._emit_error(ctx, "missing_mission_brief", detail=str(exc))
            raise RuntimeError("Missing mission_brief in session state") from exc

        mission_id = ctx.session.state.get("mission_id")
        granted_scopes: list[str] = ctx.session.state.get("granted_scopes", [])
        anticipated = ctx.session.state.get("anticipated_connections", [])
        safeguards = ctx.session.state.get("safeguards", [])

        yield self._info_event(ctx, "PlannerAgent starting library retrieval and play generation...")

        await self._update_stage_status(
            ctx,
            mission_id,
            stage="Plan",
            status="in_progress",
            readiness_state="unknown",
        )

        validation_result = await self._validate_scopes(ctx, anticipated)
        degraded = bool(
            validation_result
            and ValidationStatus is not None
            and validation_result.alignment_status == ValidationStatus.FAILED
        )
        if validation_result:
            ctx.session.state["planner_validation"] = {
                "required_scopes": validation_result.required_scopes,
                "granted_scopes": validation_result.granted_scopes,
                "missing_scopes": validation_result.missing_scopes,
                "status": validation_result.alignment_status.value,
            }
            await self._emit_telemetry(
                "planner_scope_validation",
                ctx,
                {
                    "required_scopes": validation_result.required_scopes,
                    "missing_scopes": validation_result.missing_scopes,
                    "status": validation_result.alignment_status.value,
                },
            )

        library_precedents = await self._fetch_library_precedents(ctx, mission_brief)
        plays = self._generate_candidate_plays(
            mission_brief=mission_brief,
            safeguards=safeguards,
            granted_scopes=granted_scopes,
            library_precedents=library_precedents,
            degraded=degraded,
        )

        ranked_plays = sorted(plays, key=lambda play: play.confidence, reverse=True)[: self.max_plays]
        await self._emit_candidate_telemetry(ctx, ranked_plays)

        ctx.session.state["ranked_plays"] = [play.to_dict() for play in ranked_plays]
        ctx.session.state["undo_plans"] = [play.undo_plan.to_dict() for play in ranked_plays if play.undo_plan]
        ctx.session.state["tool_usage_patterns"] = [play.tool_usage for play in ranked_plays]
        ctx.session.state["planner_summary"] = self._summarise(ranked_plays, validation_result).to_dict()
        ctx.session.state["planner_degraded"] = degraded

        await self._persist_outputs(ctx, ranked_plays)

        await self._emit_telemetry(
            "plan_ranked",
            ctx,
            {
                "play_order": [play.play_id for play in ranked_plays],
                "method": "confidence_desc",
            },
        )
        if ranked_plays:
            await self._emit_telemetry(
                "plan_selected",
                ctx,
                {
                    "play_id": ranked_plays[0].play_id,
                    "confidence": ranked_plays[0].confidence,
                },
            )

        await self._update_stage_status(
            ctx,
            mission_id,
            stage="Plan",
            status="completed",
            readiness_state="ready" if not degraded else "blocked",
            metrics={
                "top_confidence": ranked_plays[0].confidence if ranked_plays else 0.0,
                "play_count": len(ranked_plays),
            },
        )

        summary = ctx.session.state["planner_summary"]
        top_title = ranked_plays[0].title if ranked_plays else "no plays generated"
        yield self._info_event(
            ctx,
            f"PlannerAgent generated {summary['total_plays']} plays; top candidate: {top_title}.",
            metadata={
                "stage": "PLAN",
                "top_confidence": summary["top_confidence"],
                "average_confidence": summary["average_confidence"],
            },
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _ensure_mission_context(self, ctx: InvocationContext) -> bool:
        required = ("mission_id", "tenant_id", "user_id")
        return all(ctx.session.state.get(key) for key in required)

    async def _validate_scopes(
        self,
        ctx: InvocationContext,
        anticipated_connections: Sequence[dict[str, Any]],
    ) -> ScopeValidationResult | None:
        validator = self.validator_agent
        if validator is None or ScopeValidationResult is None:
            return None

        required_scopes: list[str] = []
        for connection in anticipated_connections:
            if not connection.get("connection_required", True):
                continue
            required_scopes.extend(connection.get("anticipated_scopes", []))
        required_scopes = list(dict.fromkeys(scope for scope in required_scopes if scope))
        if not required_scopes:
            return None

        return await validator.validate_scopes(ctx, required_scopes)

    async def _fetch_library_precedents(
        self,
        ctx: InvocationContext,
        mission_brief: dict[str, Any],
    ) -> List[LibraryPrecedent]:
        if not self.supabase_client:
            return []
        try:
            raw = await self.supabase_client.search_library_precedents(
                mission_brief=mission_brief,
                limit=self.library_limit,
            )
        except Exception as exc:  # noqa: BLE001
            await self._emit_error(ctx, "library_precedent_lookup_failed", detail=str(exc))
            return []

        precedents: List[LibraryPrecedent] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            precedent_id = str(item.get("id") or item.get("precedent_id") or uuid.uuid4())
            precedents.append(
                LibraryPrecedent(
                    precedent_id=precedent_id,
                    title=str(item.get("title") or item.get("name") or "Previous mission"),
                    similarity=float(item.get("similarity", 0.0)),
                    summary=str(item.get("summary") or ""),
                ),
            )
        return precedents

    def _generate_candidate_plays(
        self,
        *,
        mission_brief: dict[str, Any],
        safeguards: Iterable[dict[str, Any]],
        granted_scopes: Sequence[str],
        library_precedents: Sequence[LibraryPrecedent],
        degraded: bool,
    ) -> List[MissionPlay]:
        objective = mission_brief.get("objective", "Drive impact")
        audience = mission_brief.get("audience", "Stakeholders")
        timeline = mission_brief.get("timeline", "this sprint")

        safeguard_descriptions = [s.get("description", "") for s in safeguards if isinstance(s, dict)]
        safeguard_summary = ", ".join(desc for desc in safeguard_descriptions if desc)

        base_tool_usage = self._tool_usage_from_scopes(granted_scopes)
        precedents = list(library_precedents)

        plays: List[MissionPlay] = []

        primary_play = MissionPlay(
            play_id="play-primary",
            title=f"Primary plan: {objective}",
            summary=f"Execute comprehensive mission to {objective.lower()} for {audience.lower()} within {timeline}.",
            steps=[
                "Confirm safeguards and stage readiness",
                "Execute recommended toolkit actions in agreed order",
                "Consolidate outputs and prepare for approval",
            ],
            tool_usage=base_tool_usage,
            confidence=0.85 if not degraded else 0.6,
            precedents=precedents[:2],
        )
        primary_play.undo_plan = self._build_undo_plan(primary_play, risk="medium")
        plays.append(primary_play)

        if self.max_plays > 1:
            fast_play = MissionPlay(
                play_id="play-fast-track",
                title="Fast-track option",
                summary="Focus on highest-impact toolkits to deliver incremental wins quickly.",
                steps=[
                    "Prioritise toolkits with existing auth",
                    "Draft outputs for stakeholder preview",
                    "Schedule follow-up for full execution",
                ],
                tool_usage=base_tool_usage[:2] or base_tool_usage,
                confidence=0.75 if not degraded else 0.55,
                precedents=precedents[:1],
            )
            fast_play.undo_plan = self._build_undo_plan(fast_play, risk="low")
            plays.append(fast_play)

        if self.max_plays > 2:
            deep_play = MissionPlay(
                play_id="play-deep-dive",
                title="Deep dive alternative",
                summary="Extend mission sequence to capture comprehensive insights and artifacts.",
                steps=[
                    "Incorporate additional data inspections",
                    "Run extended automation for enrichment",
                    "Aggregate results and flag governance review",
                ],
                tool_usage=base_tool_usage + [{"toolkit": "analysis", "action": "deep_insight"}],
                confidence=0.7 if not degraded else 0.5,
                precedents=precedents[:3],
            )
            deep_play.undo_plan = self._build_undo_plan(deep_play, risk="high")
            plays.append(deep_play)

        for play in plays:
            play.tool_usage.append({"note": "Safeguards", "summary": safeguard_summary or "No additional safeguards"})

        return plays

    def _tool_usage_from_scopes(self, scopes: Sequence[str]) -> List[Dict[str, Any]]:
        usage: List[Dict[str, Any]] = []
        for scope in scopes:
            parts = scope.split(".")
            toolkit = parts[0] if parts else scope
            usage.append({"toolkit": toolkit, "scope": scope})
        return usage

    def _build_undo_plan(self, play: MissionPlay, *, risk: str) -> UndoPlan:
        undo_id = f"undo-{play.play_id}"
        steps = [
            "Revert automation outputs and notify stakeholders",
            "Restore baseline configuration or data snapshot",
            "Log corrective action in mission audit",
        ]
        if risk == "high":
            steps.insert(0, "Engage incident commander for oversight")
        window = 30 if risk == "high" else 15
        return UndoPlan(
            undo_id=undo_id,
            label=f"Undo plan for {play.title}",
            impact_summary="Reverses mission actions while preserving audit trail.",
            risk_assessment=risk,
            steps=steps,
            window_minutes=window,
        )

    def _summarise(
        self,
        plays: Sequence[MissionPlay],
        validation_result: ScopeValidationResult | None,
    ) -> PlannerSummary:
        generated_at = datetime.now(timezone.utc).isoformat()
        total = len(plays)
        top_confidence = plays[0].confidence if plays else 0.0
        average_confidence = sum(play.confidence for play in plays) / total if total else 0.0
        precedent_set = {
            precedent.precedent_id
            for play in plays
            for precedent in play.precedents
        }
        if validation_result is None:
            validator_status = "skipped"
        else:
            validator_status = validation_result.alignment_status.value

        return PlannerSummary(
            generated_at=generated_at,
            total_plays=total,
            top_confidence=round(top_confidence, 3),
            average_confidence=round(average_confidence, 3),
            library_precedents_used=len(precedent_set),
            validator_status=validator_status,
        )

    async def _persist_outputs(
        self,
        ctx: InvocationContext,
        plays: Sequence[MissionPlay],
    ) -> None:
        supabase = self.supabase_client
        mission_id = ctx.session.state.get("mission_id")
        if not supabase or not mission_id:
            return

        for index, play in enumerate(plays, start=1):
            undo_id = None
            if play.undo_plan:
                try:
                    undo_record = await supabase.insert_mission_undo_plan(
                        mission_id=mission_id,
                        plan_label=play.undo_plan.label,
                        impact_summary=play.undo_plan.impact_summary,
                        risk_assessment=play.undo_plan.risk_assessment,
                        steps=[{"description": step} for step in play.undo_plan.steps],
                        status="ready",
                    )
                    undo_id = str(undo_record.get("id") or undo_record.get("undo_identifier") or play.undo_plan.undo_id)
                    play.undo_plan.undo_id = undo_id
                except Exception as exc:  # noqa: BLE001
                    await self._emit_error(ctx, "undo_plan_persist_failed", detail=str(exc))

            try:
                await supabase.upsert_mission_play(
                    mission_id=mission_id,
                    play_identifier=play.play_id,
                    title=play.title,
                    description=play.summary,
                    confidence=play.confidence,
                    ranking=index,
                    selected=(index == 1),
                    undo_plan_id=undo_id,
                    generated_by=self.name,
                    metadata={
                        "steps": play.steps,
                        "tool_usage": play.tool_usage,
                        "precedents": [precedent.to_dict() for precedent in play.precedents],
                    },
                )
            except Exception as exc:  # noqa: BLE001
                await self._emit_error(ctx, "mission_play_persist_failed", detail=str(exc))

    async def _update_stage_status(
        self,
        ctx: InvocationContext,
        mission_id: str | None,
        *,
        stage: str,
        status: str,
        readiness_state: str | None = None,
        coverage_percent: float | None = None,
        metrics: dict[str, Any] | None = None,
    ) -> None:
        if not mission_id or not self.supabase_client:
            return
        try:
            await self.supabase_client.update_mission_stage_status(
                mission_id=mission_id,
                stage=stage,
                status=status,
                readiness_state=readiness_state,
                coverage_percent=coverage_percent,
                metrics=metrics,
            )
        except Exception as exc:  # noqa: BLE001
            await self._emit_error(ctx, "stage_status_update_failed", detail=str(exc))

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
            "stage": "Plan",
            **context,
        }
        self.telemetry.emit(event_name, payload)

    async def _emit_error(
        self,
        ctx: InvocationContext | None,
        reason: str,
        *,
        detail: str | None = None,
    ) -> None:
        if ctx is None:
            return
        await self._emit_telemetry(
            "planner_error",
            ctx,
            {
                "reason": reason,
                "detail": detail,
            },
        )

    async def _emit_candidate_telemetry(
        self,
        ctx: InvocationContext,
        plays: Sequence[MissionPlay],
    ) -> None:
        for play in plays:
            await self._emit_telemetry(
                "planner_candidate_generated",
                ctx,
                {
                    "play_id": play.play_id,
                    "confidence": play.confidence,
                    "library_precedent_count": len(play.precedents),
                    "undo_plan_included": play.undo_plan is not None,
                },
            )

    def _info_event(
        self,
        ctx: InvocationContext,
        message: str,
        metadata: Dict[str, Any] | None = None,
    ) -> Event:
        return self._make_event(ctx, message=message, metadata=metadata or {"type": "info"})

    def _error_event(self, ctx: InvocationContext, message: str) -> Event:
        return self._make_event(ctx, message=message, metadata={"type": "error"})

    def _make_event(
        self,
        ctx: InvocationContext,
        *,
        message: str,
        metadata: Dict[str, Any],
    ) -> Event:
        content = Content(role="assistant", parts=[Part(text=message)])
        return Event(
            author=self.name,
            invocationId=getattr(ctx, "invocation_id", ""),
            content=content,
            customMetadata=metadata,
        )


__all__ = [
    "PlannerAgent",
    "MissionPlay",
    "UndoPlan",
    "LibraryPrecedent",
]
