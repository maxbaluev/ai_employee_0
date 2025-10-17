"""Persona-agnostic IntakeAgent for Stage 1 mission briefs."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, Iterable, List, Tuple

from google.adk.agents import LlmAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai.types import Content, Part

from agent.services import SupabaseClientWrapper, TelemetryClient

DEFAULT_SAFEGUARDS: List[str] = [
    "Document key decisions and blockers",
    "Protect customer data according to policy",
    "Confirm rollback or mitigation steps before execution",
]


@dataclass(slots=True)
class BriefDefaults:
    """Fallback values for mission brief fields."""

    audience: str = "Primary stakeholders impacted by the mission"
    kpi: str = "Deliver measurable outcomes with clear guardrails"
    timeline: str = "Within the current sprint"
    summary_hint: str = "Clarify the intent, audience, and expected outcomes"


@dataclass(slots=True)
class MissionBrief:
    """Structured mission brief chips."""

    objective: str
    audience: str
    kpi: str
    timeline: str
    summary: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "objective": self.objective,
            "audience": self.audience,
            "kpi": self.kpi,
            "timeline": self.timeline,
            "summary": self.summary,
        }


@dataclass(slots=True)
class ChipConfidence:
    """Per-chip confidence scores (0.0 – 1.0)."""

    objective: float
    audience: float
    kpi: float
    timeline: float
    safeguards: float

    def to_dict(self) -> Dict[str, float]:
        return {
            "objective": self.objective,
            "audience": self.audience,
            "kpi": self.kpi,
            "timeline": self.timeline,
            "safeguards": self.safeguards,
        }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class IntakeAgent(LlmAgent):
    """Gemini ADK agent responsible for Stage 1 mission intake."""

    def __init__(
        self,
        *,
        name: str,
        supabase_client: SupabaseClientWrapper | None = None,
        telemetry: TelemetryClient | None = None,
        model: str | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(
            name=name,
            model=model or "models/gemini-1.5-pro",
            sub_agents=[],
            **kwargs,
        )
        object.__setattr__(self, "_supabase", supabase_client)
        object.__setattr__(self, "_telemetry", telemetry)
        object.__setattr__(self, "_defaults", BriefDefaults())

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------
    @property
    def supabase_client(self) -> SupabaseClientWrapper | None:
        return getattr(self, "_supabase", None)

    @property
    def telemetry(self) -> TelemetryClient | None:
        return getattr(self, "_telemetry", None)

    @property
    def defaults(self) -> BriefDefaults:
        return getattr(self, "_defaults")

    # ------------------------------------------------------------------
    # Core execution
    # ------------------------------------------------------------------
    async def _run_async_impl(
        self,
        ctx: InvocationContext,
    ) -> AsyncGenerator[Event, None]:
        if not self._ensure_mission_context(ctx):
            yield self._error_event(ctx, "Missing mission context identifiers")
            return

        mission_intent = (ctx.session.state.get("mission_intent") or "").strip()
        if not mission_intent:
            await self._emit_error(ctx, "missing_mission_intent")
            raise RuntimeError("Missing mission_intent in session state")

        existing_brief = self._normalise_brief(ctx.session.state.get("mission_brief") or {})
        incoming_hints = self._normalise_brief(ctx.session.state.get("mission_inputs") or {})
        existing_safeguards = ctx.session.state.get("safeguards")

        await self._emit_telemetry(
            "intent_submitted",
            ctx,
            {
                "intent_length": len(mission_intent),
                "hints_provided": sorted(incoming_hints.keys()),
                "template_id": ctx.session.state.get("mission_template_id"),
            },
        )

        yield self._info_event(ctx, "Parsing mission intent and drafting brief…")

        (
            mission_brief,
            confidences,
            safeguards,
            updated_fields,
            field_sources,
        ) = self._build_brief(
            mission_intent=mission_intent,
            defaults=self.defaults,
            existing=existing_brief,
            hints=incoming_hints,
            existing_safeguards=existing_safeguards,
        )

        ctx.session.state["mission_brief"] = mission_brief.to_dict()
        ctx.session.state["safeguards"] = safeguards
        ctx.session.state["confidence_scores"] = confidences.to_dict()
        ctx.session.state["mission_brief_last_updated"] = _now_iso()

        await self._persist_to_supabase(ctx, mission_brief, safeguards)

        await self._emit_telemetry(
            "brief_generated",
            ctx,
            {
                "chip_count": len(mission_brief.to_dict()),
                "objective": mission_brief.objective,
                "timeline": mission_brief.timeline,
                "confidence_scores": confidences.to_dict(),
                "updated_fields": sorted(updated_fields),
                "template_id": ctx.session.state.get("mission_template_id"),
            },
        )

        for field_name in sorted(updated_fields):
            await self._emit_telemetry(
                "brief_item_modified",
                ctx,
                {
                    "chip_type": field_name,
                    "edit_type": self._edit_type_from_source(field_sources.get(field_name)),
                    "token_diff": self._token_diff(existing_brief.get(field_name), mission_brief.to_dict()[field_name]),
                    "aliases": ["brief_field_edited"],
                },
            )

        for safeguard in safeguards:
            if safeguard.get("_new"):
                await self._emit_telemetry(
                    "safeguard_added",
                    ctx,
                    {
                        "category": safeguard.get("category"),
                        "description": safeguard.get("description"),
                    },
                )

        yield self._info_event(
            ctx,
            "Mission brief ready. Review chips and safeguards before locking.",
            metadata={
                "phase": "DEFINE",
                "updated_fields": sorted(updated_fields),
            },
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _ensure_mission_context(self, ctx: InvocationContext) -> bool:
        required = ("mission_id", "tenant_id", "user_id")
        return all(ctx.session.state.get(key) for key in required)

    def _normalise_brief(self, raw: Dict[str, Any]) -> Dict[str, str]:
        normalised: Dict[str, str] = {}
        for key in ("objective", "audience", "kpi", "timeline", "summary"):
            value = raw.get(key)
            if isinstance(value, str) and value.strip():
                normalised[key] = value.strip()
        return normalised

    def _build_brief(
        self,
        *,
        mission_intent: str,
        defaults: BriefDefaults,
        existing: Dict[str, str],
        hints: Dict[str, str],
        existing_safeguards: Iterable[Dict[str, Any]] | None,
    ) -> Tuple[MissionBrief, ChipConfidence, List[Dict[str, Any]], List[str], Dict[str, str]]:
        intent_summary = self._summarise_intent(mission_intent)

        objective, objective_source = self._resolve_chip(
            "objective",
            existing,
            hints,
            fallback=intent_summary,
        )
        audience, audience_source = self._resolve_chip(
            "audience",
            existing,
            hints,
            fallback=self._derive_audience(intent_summary, defaults.audience),
        )
        kpi, kpi_source = self._resolve_chip(
            "kpi",
            existing,
            hints,
            fallback=defaults.kpi,
        )
        timeline, timeline_source = self._resolve_chip(
            "timeline",
            existing,
            hints,
            fallback=defaults.timeline,
        )

        summary = existing.get(
            "summary",
            hints.get("summary", f"{defaults.summary_hint}. {objective}"),
        ).strip()

        field_sources: Dict[str, str] = {
            "objective": objective_source,
            "audience": audience_source,
            "kpi": kpi_source,
            "timeline": timeline_source,
        }

        safeguards_existing = list(existing_safeguards or [])
        safeguard_descriptions_existing = {
            (s.get("description") or "").strip().lower()
            for s in safeguards_existing
            if isinstance(s, dict)
        }

        generated_safeguards: List[Dict[str, Any]] = []
        for description in DEFAULT_SAFEGUARDS:
            key = description.strip().lower()
            if not key or key in safeguard_descriptions_existing:
                continue
            generated_safeguards.append(
                {
                    "category": "mission_intake",
                    "description": description,
                    "severity": "medium",
                    "metadata": {"source": "intake_default"},
                    "_new": True,
                },
            )

        safeguards: List[Dict[str, Any]] = []
        for item in safeguards_existing:
            if isinstance(item, dict):
                clean = dict(item)
                clean.pop("_new", None)
                safeguards.append(clean)

        for item in generated_safeguards:
            clone = dict(item)
            clone.pop("_new", None)
            safeguards.append(clone)

        confidences = ChipConfidence(
            objective=self._confidence_from_source(objective_source),
            audience=self._confidence_from_source(audience_source),
            kpi=self._confidence_from_source(kpi_source),
            timeline=self._confidence_from_source(timeline_source),
            safeguards=0.6 if generated_safeguards else 0.8,
        )

        mission_brief = MissionBrief(
            objective=objective,
            audience=audience,
            kpi=kpi,
            timeline=timeline,
            summary=summary,
        )

        updated_fields = self._detect_updates(existing, mission_brief)

        for safeguard in safeguards_existing:
            safeguard.pop("_new", None)

        all_safeguards = safeguards_existing + generated_safeguards

        return mission_brief, confidences, all_safeguards, updated_fields, field_sources

    def _resolve_chip(
        self,
        key: str,
        existing: Dict[str, str],
        hints: Dict[str, str],
        fallback: str,
    ) -> Tuple[str, str]:
        if key in existing:
            return existing[key], "existing"
        if key in hints and hints[key].strip():
            return hints[key].strip(), "hint"
        return fallback.strip(), "fallback"

    def _derive_audience(self, intent_summary: str, fallback: str) -> str:
        lowered = intent_summary.lower()
        for marker in ("for ", "toward ", "to "):
            if marker in lowered:
                segment = intent_summary[lowered.index(marker) + len(marker) :].strip()
                if segment:
                    return segment.rstrip(".,")
        return fallback

    def _confidence_from_source(self, source: str) -> float:
        return {
            "existing": 1.0,
            "hint": 0.85,
            "fallback": 0.65,
        }.get(source, 0.6)

    def _edit_type_from_source(self, source: str | None) -> str:
        mapping = {
            "existing": "unchanged",
            "hint": "hint_applied",
            "fallback": "auto_fill",
        }
        return mapping.get(source or "", "auto_fill")

    def _detect_updates(self, existing: Dict[str, str], brief: MissionBrief) -> List[str]:
        updates: List[str] = []
        for field_name, value in brief.to_dict().items():
            previous = existing.get(field_name)
            if previous is None:
                updates.append(field_name)
            elif previous.strip() != value.strip():
                updates.append(field_name)
        return updates

    def _summarise_intent(self, intent: str) -> str:
        cleaned = intent.strip()
        if not cleaned:
            return "Clarify mission objective"
        for delimiter in (".", "!", "?"):
            if delimiter in cleaned:
                cleaned = cleaned.split(delimiter)[0]
                break
        return cleaned[:140].strip()

    def _token_diff(self, previous: str | None, current: str) -> int:
        prev_tokens = (previous or "").split()
        curr_tokens = current.split()
        return len(curr_tokens) - len(prev_tokens)

    async def _persist_to_supabase(
        self,
        ctx: InvocationContext,
        brief: MissionBrief,
        safeguards: List[Dict[str, Any]],
    ) -> None:
        supabase = self.supabase_client
        if supabase is None:
            return

        try:
            await supabase.upsert_mission_metadata(
                mission_id=ctx.session.state["mission_id"],
                metadata_key="mission_brief",
                metadata_value=brief.to_dict(),
                source_stage="Define",
            )
        except Exception as exc:  # noqa: BLE001
            await self._emit_error(ctx, "metadata_persist_failed", details=str(exc))

        for safeguard in safeguards:
            if not safeguard.get("description"):
                continue
            try:
                await supabase.insert_mission_safeguard(
                    mission_id=ctx.session.state["mission_id"],
                    category=safeguard.get("category", "mission_intake"),
                    description=safeguard["description"],
                    severity=safeguard.get("severity", "medium"),
                    metadata=safeguard.get("metadata", {}),
                )
            except Exception as exc:  # noqa: BLE001
                await self._emit_error(ctx, "safeguard_persist_failed", details=str(exc))

    # ------------------------------------------------------------------
    # Telemetry & events
    # ------------------------------------------------------------------
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
            "stage": "Define",
            **{k: v for k, v in context.items() if v is not None},
        }
        self.telemetry.emit(event_name, payload)

    async def _emit_error(
        self,
        ctx: InvocationContext,
        reason: str,
        *,
        details: str | None = None,
    ) -> None:
        await self._emit_telemetry(
            "intake_error",
            ctx,
            {
                "reason": reason,
                "details": details,
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
    "IntakeAgent",
    "MissionBrief",
    "ChipConfidence",
    "DEFAULT_SAFEGUARDS",
]
