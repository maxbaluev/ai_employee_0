"""IntakeAgent builds structured mission briefs for Stage 1 (Define).

The agent converts free-form mission intent into structured chips (objective,
audience, KPI, timeline, safeguards) and persists them to session state so the
Coordinator can advance to Stage 2 (Prepare). Persona defaults and safeguard
templates come from the product documentation (docs/03_user_experience.md and
docs/examples/).

Key responsibilities:
- Read mission intent/persona context from the shared session state
- Generate structured brief data with per-field confidence scores
- Persist mission brief and safeguards to Supabase for auditing
- Emit telemetry events (`intent_submitted`, `brief_generated`, `safeguard_added`)
- Yield ADK events so CopilotKit can present progress in chat

The current implementation relies on lightweight heuristics and persona
templates; future iterations can replace the heuristic step with Gemini prompts
without changing the public surface area.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, Iterable, List, Tuple

from google.adk.agents import LlmAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai.types import Content, Part

from agent.services import SupabaseClientWrapper, TelemetryClient


# Supported example personas (not exhaustive).
DEFAULT_PERSONA = "general"

EXAMPLE_PERSONAS: Dict[str, str] = {
    "revops": "revops",
    "support": "support",
    "engineering": "engineering",
    "governance": "governance",
    DEFAULT_PERSONA: DEFAULT_PERSONA,
}

_PERSONA_SYNONYMS: Dict[str, str] = {
    "rev ops": "revops",
    "revenue": "revops",
    "customer support": "support",
    "success": "support",
    "dev": "engineering",
    "compliance": "governance",
}


def normalize_persona(raw: str | None) -> str:
    """Normalize persona labels to a lowercase slug."""

    if not raw:
        return DEFAULT_PERSONA

    normalized = raw.strip().lower()
    if not normalized:
        return DEFAULT_PERSONA

    return _PERSONA_SYNONYMS.get(normalized, normalized)


@dataclass(slots=True)
class PersonaDefaults:
    """Default brief values for a persona."""

    audience: str
    kpi: str
    timeline: str
    safeguards: List[str]
    summary_hint: str


@dataclass(slots=True)
class MissionBrief:
    """Structured mission brief chips."""

    objective: str
    audience: str
    kpi: str
    timeline: str
    summary: str
    persona: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "objective": self.objective,
            "audience": self.audience,
            "kpi": self.kpi,
            "timeline": self.timeline,
            "summary": self.summary,
            "persona": self.persona,
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


PERSONA_LIBRARY: Dict[str, PersonaDefaults] = {
    "revops": PersonaDefaults(
        audience="Dormant revenue accounts with open renewal opportunity",
        kpi="≥3% reply rate and $500K qualified pipeline",
        timeline="3 business days",
        safeguards=[
            "Respect opt-out preferences and DNC lists",
            "Coordinate outreach with account ownership to prevent overlap",
            "Enrich contact data before messaging",
        ],
        summary_hint="Consultative win-back sprint for high-potential accounts",
    ),
    "support": PersonaDefaults(
        audience="Tier-1 support tickets with ageing SLA risk",
        kpi="Reduce backlog by 20% while maintaining CSAT ≥4.6",
        timeline="48 hours",
        safeguards=[
            "Do not expose customer PII in summaries",
            "Escalate security-related incidents to governance inbox",
            "Follow regional data retention rules",
        ],
        summary_hint="Stabilise queue health and protect SLA commitments",
    ),
    "engineering": PersonaDefaults(
        audience="Production rollout for latest service release",
        kpi="Zero sev-1 regressions; rollout completed in two windows",
        timeline="7 days",
        safeguards=[
            "Include rollback plan with success criteria",
            "Notify incident commander before deploy",
            "Log changes to deployment journal for audit",
        ],
        summary_hint="Controlled deployment with explicit safety rails",
    ),
    "governance": PersonaDefaults(
        audience="Cross-functional compliance steering group",
        kpi="Complete audit evidence package with zero gaps",
        timeline="10 business days",
        safeguards=[
            "Track approvals and decisions in immutable audit log",
            "Mask sensitive identifiers in shared artifacts",
            "Review actions against regulatory checklist",
        ],
        summary_hint="Prepare compliant evidence with clear audit trail",
    ),
    DEFAULT_PERSONA: PersonaDefaults(
        audience="Primary stakeholders impacted by the mission",
        kpi="Deliver agreed outcomes with measurable customer impact",
        timeline="Within the current sprint",
        safeguards=[
            "Document key decisions and blockers",
            "Protect customer data according to policy",
            "Confirm rollback or mitigation plan before execution",
        ],
        summary_hint="Clarify mission intent and align success signals",
    ),
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

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------
    @property
    def supabase_client(self) -> SupabaseClientWrapper | None:
        return getattr(self, "_supabase", None)

    @property
    def telemetry(self) -> TelemetryClient | None:
        return getattr(self, "_telemetry", None)

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

        persona_raw = ctx.session.state.get("mission_persona")
        persona_slug = normalize_persona(persona_raw)
        persona_defaults = PERSONA_LIBRARY.get(persona_slug, PERSONA_LIBRARY[DEFAULT_PERSONA])

        existing_brief = self._normalise_brief(ctx.session.state.get("mission_brief") or {})
        incoming_hints = self._normalise_brief(ctx.session.state.get("mission_inputs") or {})

        await self._emit_telemetry(
            "intent_submitted",
            ctx,
            {
                "persona": persona_slug,
                "intent_length": len(mission_intent),
                "hints_provided": list(incoming_hints.keys()),
            },
        )

        yield self._info_event(ctx, "Parsing mission intent and persona defaults...")

        (
            mission_brief,
            confidences,
            safeguards,
            updated_fields,
            field_sources,
        ) = self._build_brief(
            mission_intent=mission_intent,
            persona=persona_slug,
            defaults=persona_defaults,
            existing=existing_brief,
            hints=incoming_hints,
            existing_safeguards=ctx.session.state.get("safeguards"),
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
                "persona": persona_slug,
                "chip_count": len(mission_brief.to_dict()),
                "objective": mission_brief.objective,
                "timeline": mission_brief.timeline,
                "confidence_scores": confidences.to_dict(),
                "updated_fields": sorted(updated_fields),
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
            f"Mission brief ready for {persona_slug} persona (objective: {mission_brief.objective}).",
            metadata={
                "phase": "DEFINE",
                "updated_fields": sorted(updated_fields),
                "persona": persona_slug,
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
        persona: str,
        defaults: PersonaDefaults,
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
            fallback=defaults.audience,
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
            hints.get("summary", f"{defaults.summary_hint}. {objective}")
        ).strip()

        field_sources: Dict[str, str] = {
            "objective": objective_source,
            "audience": audience_source,
            "kpi": kpi_source,
            "timeline": timeline_source,
        }

        safeguards_existing = list(existing_safeguards or [])
        safeguard_descriptions_existing = {
            s.get("description", "").strip().lower()
            for s in safeguards_existing
            if isinstance(s, dict)
        }

        generated_safeguards: List[Dict[str, Any]] = []
        for description in defaults.safeguards:
            key = description.strip().lower()
            if not key or key in safeguard_descriptions_existing:
                continue
            generated_safeguards.append(
                {
                    "category": persona,
                    "description": description,
                    "severity": "medium",
                    "metadata": {"source": "persona_default"},
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
            persona=persona,
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
            if field_name in ("summary", "persona"):
                continue
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
                    category=safeguard.get("category", "general"),
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
            **context,
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
    "normalize_persona",
    "EXAMPLE_PERSONAS",
    "PERSONA_LIBRARY",
]
