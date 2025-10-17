"""ExecutorAgent executes Stage 5 governed tool actions.

The agent is responsible for running approved play actions sequentially while
enforcing safeguards, emitting telemetry, and updating shared mission state.
It follows the execution patterns documented in:

* docs/02_system_overview.md — ADK Agent Coordination & Error Handling
* docs/04_implementation_guide.md — §3 Backend Agents (Executor), §5.2
* docs/06_data_intelligence.md — §3.6 Stage 5 telemetry catalogue
* docs/backlog.md — TASK-ADK-006 acceptance criteria
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Awaitable, Callable, Dict, Iterable, List, Optional, Sequence

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai.types import Content, Part

from agent.services import ComposioClientWrapper, TelemetryClient

try:  # pragma: no cover - optional import for type checking
    from typing import Protocol
except ImportError:  # pragma: no cover - Python <3.8 fallback (not expected)
    Protocol = object

try:  # pragma: no cover - avoid circular import cost at runtime
    from typing import TYPE_CHECKING
except ImportError:  # pragma: no cover
    TYPE_CHECKING = False

if TYPE_CHECKING:  # pragma: no cover
    from agent.agents.evidence import EvidenceAgent
    from agent.agents.validator import ValidationResult, ValidatorAgent
else:  # pragma: no cover - runtime fallback without importing heavy modules
    EvidenceAgent = Any  # type: ignore
    ValidatorAgent = Any  # type: ignore
    ValidationResult = Any  # type: ignore


# ---------------------------------------------------------------------------
# Data models ----------------------------------------------------------------
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class ExecutionAction:
    """Mission play action to be executed via Composio."""

    action_id: str
    toolkit: str
    name: str
    arguments: Dict[str, Any] = field(default_factory=dict)
    description: str | None = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, raw: Dict[str, Any], fallback_index: int) -> "ExecutionAction":
        action_id = str(raw.get("id") or raw.get("action_id") or f"action-{fallback_index}")
        toolkit = str(raw.get("toolkit") or raw.get("provider") or raw.get("integration") or "unknown")
        name = str(raw.get("action") or raw.get("name") or "execute")
        arguments = raw.get("arguments") or raw.get("input") or raw.get("payload") or {}
        if not isinstance(arguments, dict):
            arguments = {"value": arguments}
        description = raw.get("description") or raw.get("summary")
        metadata = raw.get("metadata") or {}
        if not isinstance(metadata, dict):
            metadata = {"note": metadata}
        return cls(
            action_id=action_id,
            toolkit=toolkit,
            name=name,
            arguments=arguments,
            description=str(description) if description is not None else None,
            metadata=metadata,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "action_id": self.action_id,
            "toolkit": self.toolkit,
            "action": self.name,
            "arguments": dict(self.arguments),
            "description": self.description,
            "metadata": dict(self.metadata),
        }


@dataclass(slots=True)
class ExecutionResult:
    """Result payload written to session state after each action."""

    action_id: str
    status: str
    output: Any = None
    error: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    toolkit: str | None = None
    action: str | None = None
    validator: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "action_id": self.action_id,
            "status": self.status,
            "output": self.output,
            "error": self.error,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "toolkit": self.toolkit,
            "action": self.action,
            "validator": list(self.validator),
            "metadata": dict(self.metadata),
        }
        return payload


@dataclass(slots=True)
class ExecutionSummary:
    """Aggregate execution metrics captured at the end of Stage 5."""

    mission_id: str
    total_actions: int
    succeeded: int
    failed: int
    started_at: str
    completed_at: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mission_id": self.mission_id,
            "total_actions": self.total_actions,
            "succeeded": self.succeeded,
            "failed": self.failed,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
        }


# ---------------------------------------------------------------------------
# Exceptions -----------------------------------------------------------------
# ---------------------------------------------------------------------------


class ExecutorError(Exception):
    """Base exception for executor failures."""


class RateLimitError(ExecutorError):
    """Raised when Composio reports a rate limit condition."""

    def __init__(self, retry_after: float | None = None, message: str | None = None) -> None:
        super().__init__(message or "Composio rate limit encountered")
        self.retry_after = retry_after


class AuthExpiredError(ExecutorError):
    """Raised when OAuth credentials or sessions have expired."""


class ToolExecutionError(ExecutorError):
    """Raised for non-recoverable tool execution failures."""


# ---------------------------------------------------------------------------
# Protocols ------------------------------------------------------------------
# ---------------------------------------------------------------------------


class ToolActionExecutor(Protocol):  # pragma: no cover - structural typing only
    async def __call__(
        self,
        action: ExecutionAction,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Execute a tool action and return provider response."""


# ---------------------------------------------------------------------------
# Executor agent --------------------------------------------------------------
# ---------------------------------------------------------------------------


class ExecutorAgent(BaseAgent):
    """Gemini ADK agent coordinating governed mission execution (Stage 5)."""

    def __init__(
        self,
        *,
        name: str,
        validator_agent: ValidatorAgent | None = None,
        evidence_agent: EvidenceAgent | None = None,
        composio_client: ComposioClientWrapper | None = None,
        telemetry: TelemetryClient | None = None,
        action_executor: ToolActionExecutor | None = None,
        heartbeat_seconds: float = 30.0,
        max_retries: int = 3,
        backoff_seconds: float = 0.5,
        backoff_multiplier: float = 2.0,
        backoff_ceiling_seconds: float = 8.0,
        **kwargs: Any,
    ) -> None:
        sub_agents: List[BaseAgent] = []
        if isinstance(validator_agent, BaseAgent):
            sub_agents.append(validator_agent)
        if isinstance(evidence_agent, BaseAgent):
            sub_agents.append(evidence_agent)

        super().__init__(name=name, sub_agents=sub_agents, **kwargs)

        object.__setattr__(self, "_validator", validator_agent)
        object.__setattr__(self, "_evidence", evidence_agent)
        object.__setattr__(self, "_composio", composio_client)
        object.__setattr__(self, "_telemetry", telemetry)
        object.__setattr__(self, "_action_executor", action_executor)
        object.__setattr__(self, "_heartbeat_seconds", max(1.0, heartbeat_seconds))
        object.__setattr__(self, "_max_retries", max(0, max_retries))
        object.__setattr__(self, "_backoff_seconds", max(0.1, backoff_seconds))
        object.__setattr__(self, "_backoff_multiplier", max(1.0, backoff_multiplier))
        object.__setattr__(self, "_backoff_ceiling_seconds", max(backoff_seconds, backoff_ceiling_seconds))

    # ------------------------------------------------------------------
    # Properties --------------------------------------------------------
    # ------------------------------------------------------------------
    @property
    def validator_agent(self) -> ValidatorAgent | None:
        return getattr(self, "_validator", None)

    @property
    def evidence_agent(self) -> EvidenceAgent | None:
        return getattr(self, "_evidence", None)

    @property
    def composio_client(self) -> ComposioClientWrapper | None:
        return getattr(self, "_composio", None)

    @property
    def telemetry(self) -> TelemetryClient | None:
        return getattr(self, "_telemetry", None)

    @property
    def action_executor(self) -> ToolActionExecutor | None:
        return getattr(self, "_action_executor", None)

    @property
    def heartbeat_seconds(self) -> float:
        return getattr(self, "_heartbeat_seconds", 30.0)

    @property
    def max_retries(self) -> int:
        return getattr(self, "_max_retries", 3)

    @property
    def backoff_seconds(self) -> float:
        return getattr(self, "_backoff_seconds", 0.5)

    @property
    def backoff_multiplier(self) -> float:
        return getattr(self, "_backoff_multiplier", 2.0)

    @property
    def backoff_ceiling_seconds(self) -> float:
        return getattr(self, "_backoff_ceiling_seconds", 8.0)

    # ------------------------------------------------------------------
    # BaseAgent implementation -----------------------------------------
    # ------------------------------------------------------------------
    async def _run_async_impl(
        self,
        ctx: InvocationContext,
    ) -> AsyncGenerator[Event, None]:
        if not self._ensure_context(ctx):
            yield self._error_event(ctx, "Missing mission context (mission_id, tenant_id, user_id).")
            return

        mission_id = str(ctx.session.state["mission_id"])
        tenant_id = str(ctx.session.state.get("tenant_id"))
        user_id = str(ctx.session.state.get("user_id"))

        play = self._select_play(ctx)
        if play is None:
            yield self._error_event(ctx, "No approved play available for execution.")
            return

        actions = self._extract_actions(play)
        if not actions:
            yield self._error_event(ctx, "Selected play has no executable actions.")
            return

        started_at = _now_iso()
        ctx.session.state["execution_results"] = []
        ctx.session.state["execution_summary"] = {}
        await self._emit_telemetry(
            "execution_started",
            {
                "mission_id": mission_id,
                "play_id": play.get("id") or play.get("play_id"),
                "action_count": len(actions),
                "estimated_duration_seconds": float(len(actions) * self.heartbeat_seconds),
            },
        )
        yield self._info_event(
            ctx,
            f"Starting execution of {len(actions)} actions.",
        )

        successes = 0
        failures = 0

        for index, action in enumerate(actions, start=1):
            await self._update_heartbeat(ctx)
            try:
                result = await self._execute_action(
                    ctx,
                    action,
                    mission_id=mission_id,
                    tenant_id=tenant_id,
                    user_id=user_id,
                    position=index,
                    total=len(actions),
                )
                successes += 1 if result.status == "succeeded" else 0
                failures += 1 if result.status != "succeeded" else 0
            except AuthExpiredError as exc:
                ctx.session.state["execution_status"] = "auth_expired"
                await self._emit_telemetry(
                    "execution_failed",
                    {
                        "mission_id": mission_id,
                        "reason": "auth_expired",
                        "message": str(exc),
                    },
                )
                yield self._error_event(ctx, "OAuth credentials expired during execution.")
                return
            except ExecutorError as exc:
                failures += 1
                await self._emit_telemetry(
                    "execution_failed",
                    {
                        "mission_id": mission_id,
                        "reason": exc.__class__.__name__,
                        "message": str(exc),
                    },
                )
                yield self._error_event(ctx, f"Execution halted: {exc}")
                return

        completed_at = _now_iso()
        summary = ExecutionSummary(
            mission_id=mission_id,
            total_actions=len(actions),
            succeeded=successes,
            failed=failures,
            started_at=started_at,
            completed_at=completed_at,
        )
        ctx.session.state["execution_summary"] = summary.to_dict()
        await self._emit_telemetry(
            "execution_completed",
            {
                "mission_id": mission_id,
                "total_actions": len(actions),
                "succeeded": successes,
                "failed": failures,
            },
        )
        yield self._info_event(ctx, "Execution completed.")

    # ------------------------------------------------------------------
    # Execution helpers -------------------------------------------------
    # ------------------------------------------------------------------
    async def _execute_action(
        self,
        ctx: InvocationContext,
        action: ExecutionAction,
        *,
        mission_id: str,
        tenant_id: str,
        user_id: str,
        position: int,
        total: int,
    ) -> ExecutionResult:
        validator_results: List[Dict[str, Any]] = []
        started_at = _now_iso()

        if self.validator_agent is not None and hasattr(self.validator_agent, "preflight_check"):
            try:
                checks = await self.validator_agent.preflight_check(ctx, action.to_dict())  # type: ignore[attr-defined]
                validator_results.extend(self._serialise_validator_results(checks))
            except Exception as exc:  # pragma: no cover - defensive
                await self._emit_telemetry(
                    "validator_error",
                    {
                        "mission_id": mission_id,
                        "stage": "preflight",
                        "error": str(exc),
                    },
                )

        output = await self._perform_with_retries(
            action,
            context={
                "mission_id": mission_id,
                "tenant_id": tenant_id,
                "user_id": user_id,
            },
        )

        if self.validator_agent is not None and hasattr(self.validator_agent, "postflight_check"):
            try:
                checks = await self.validator_agent.postflight_check(ctx, action.to_dict(), output)  # type: ignore[attr-defined]
                validator_results.extend(self._serialise_validator_results(checks))
            except Exception as exc:  # pragma: no cover - defensive
                await self._emit_telemetry(
                    "validator_error",
                    {
                        "mission_id": mission_id,
                        "stage": "postflight",
                        "error": str(exc),
                    },
                )

        completed_at = _now_iso()
        execution_result = ExecutionResult(
            action_id=action.action_id,
            status="succeeded",
            output=output,
            started_at=started_at,
            completed_at=completed_at,
            toolkit=action.toolkit,
            action=action.name,
            validator=validator_results,
            metadata={"position": position, "total": total},
        )

        ctx.session.state.setdefault("execution_results", []).append(execution_result.to_dict())
        await self._emit_telemetry(
            "execution_step_completed",
            {
                "mission_id": mission_id,
                "action_id": action.action_id,
                "position": position,
                "total": total,
            },
        )
        await self._emit_telemetry(
            "composio_tool_call",
            {
                "mission_id": mission_id,
                "toolkit": action.toolkit,
                "action": action.name,
                "status": "succeeded",
            },
        )

        return execution_result

    async def _perform_with_retries(
        self,
        action: ExecutionAction,
        *,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        attempts = 0
        delay = self.backoff_seconds

        while True:
            try:
                executor = self.action_executor or self._default_executor()
                result = executor(action, context)
                if asyncio.iscoroutine(result):
                    result = await result
                if isinstance(result, dict):
                    return result
                return {"result": result}
            except RateLimitError as exc:
                attempts += 1
                if attempts > self.max_retries:
                    raise RateLimitError(
                        retry_after=exc.retry_after,
                        message="Rate limit retries exhausted",
                    ) from exc
                await asyncio.sleep(exc.retry_after or min(delay, self.backoff_ceiling_seconds))
                delay = min(delay * self.backoff_multiplier, self.backoff_ceiling_seconds)
            except AuthExpiredError:
                raise
            except ExecutorError:
                raise
            except Exception as exc:  # pragma: no cover - defensive catch
                raise ToolExecutionError(str(exc)) from exc

    def _default_executor(self) -> ToolActionExecutor:
        if self.composio_client is None:
            raise ToolExecutionError("No Composio client configured for execution")

        async def _executor(action: ExecutionAction, context: Dict[str, Any]) -> Dict[str, Any]:
            try:
                result = await self.composio_client.execute_tool_call(
                    action=action.to_dict(),
                    user_id=context.get("user_id"),
                    tenant_id=context.get("tenant_id"),
                )
                return result
            except AttributeError as exc:  # pragma: no cover - fallback
                raise ToolExecutionError(str(exc)) from exc

        return _executor

    def _select_play(self, ctx: InvocationContext) -> Dict[str, Any] | None:
        plays = ctx.session.state.get("ranked_plays") or []
        if not isinstance(plays, list) or not plays:
            return None

        play_id = (
            ctx.session.state.get("approval_decision", {}).get("play_id")
            if isinstance(ctx.session.state.get("approval_decision"), dict)
            else None
        )

        if play_id:
            for play in plays:
                if isinstance(play, dict) and play.get("id") == play_id:
                    return play
                if isinstance(play, dict) and play.get("play_id") == play_id:
                    return play

        return plays[0] if isinstance(plays[0], dict) else None

    def _extract_actions(self, play: Dict[str, Any]) -> List[ExecutionAction]:
        raw_actions: Iterable[Any] = play.get("actions") or play.get("tool_calls") or []
        actions: List[ExecutionAction] = []

        for index, raw in enumerate(raw_actions, start=1):
            if isinstance(raw, dict):
                actions.append(ExecutionAction.from_dict(raw, index))

        if actions:
            return actions

        # Fallback: synthesise actions from tool_usage metadata.
        fallback_source = play.get("tool_usage") or []
        for index, raw in enumerate(fallback_source, start=1):
            if not isinstance(raw, dict):
                continue
            synthetic = {
                "id": raw.get("scope") or raw.get("toolkit") or f"action-{index}",
                "toolkit": raw.get("toolkit") or raw.get("scope", "unknown"),
                "action": raw.get("action") or "execute",
                "arguments": raw.get("arguments") or {},
                "metadata": raw,
            }
            actions.append(ExecutionAction.from_dict(synthetic, index))

        return actions

    async def _update_heartbeat(self, ctx: InvocationContext) -> None:
        timestamp = _now_iso()
        ctx.session.state["heartbeat_timestamp"] = timestamp
        await self._emit_telemetry(
            "session_heartbeat",
            {"timestamp": timestamp, "stage": "EXECUTE"},
        )

    def _serialise_validator_results(self, results: Sequence[ValidationResult] | None) -> List[Dict[str, Any]]:
        payload: List[Dict[str, Any]] = []
        if not results:
            return payload
        for result in results:
            if isinstance(result, dict):
                payload.append(dict(result))
                continue
            mapping = {
                "safeguard_id": getattr(result, "safeguard_id", None),
                "status": getattr(result, "status", None).value if getattr(result, "status", None) else None,
                "severity": getattr(result, "severity", None).value if getattr(result, "severity", None) else None,
                "message": getattr(result, "message", None),
                "auto_fix_attempted": getattr(result, "auto_fix_attempted", None),
                "auto_fix_success": getattr(result, "auto_fix_success", None),
                "details": getattr(result, "details", {}) or {},
            }
            payload.append(mapping)
        return payload

    # ------------------------------------------------------------------
    # Utility helpers ---------------------------------------------------
    # ------------------------------------------------------------------
    def _ensure_context(self, ctx: InvocationContext) -> bool:
        required = ("mission_id", "tenant_id", "user_id")
        return all(ctx.session.state.get(key) for key in required)

    async def _emit_telemetry(self, event_name: str, payload: Dict[str, Any]) -> None:
        if self.telemetry is None:
            return
        try:
            self.telemetry.emit(event_name, payload)
        except Exception:  # pragma: no cover - telemetry should not break execution
            return

    def _info_event(self, ctx: InvocationContext, message: str) -> Event:
        return self._make_event(ctx, message=message, metadata={"type": "info", "stage": "EXECUTE"})

    def _error_event(self, ctx: InvocationContext, message: str) -> Event:
        return self._make_event(ctx, message=message, metadata={"type": "error", "stage": "EXECUTE"})

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


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


__all__ = [
    "ExecutorAgent",
    "ExecutionAction",
    "ExecutionResult",
    "ExecutionSummary",
    "ExecutorError",
    "RateLimitError",
    "AuthExpiredError",
    "ToolExecutionError",
]
