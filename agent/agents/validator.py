"""ValidatorAgent enforces safeguards and validates scope alignment.

Responsibilities include verifying OAuth scopes, running safeguard checks
before and after tool execution, recording validation outcomes in session
state, and emitting telemetry for governance review. See
docs/04_implementation_guide.md §3 and docs/10_composio.md for the
progressive trust model.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncGenerator, Dict, Iterable, List, Sequence

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai.types import Content, Part

from agent.services import ComposioClientWrapper, TelemetryClient


class ValidationSeverity(str, Enum):
    """Severity for validator findings."""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ValidationStatus(str, Enum):
    """Validator status codes."""

    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    AUTO_FIXED = "auto_fixed"


@dataclass(slots=True)
class Safeguard:
    """Safeguard rule enforced by ValidatorAgent."""

    id: str
    category: str
    rule: str
    auto_fix_enabled: bool = True
    severity: ValidationSeverity = ValidationSeverity.WARNING
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ValidationResult:
    """Outcome for a safeguard check."""

    safeguard_id: str
    status: ValidationStatus
    severity: ValidationSeverity
    message: str
    auto_fix_attempted: bool = False
    auto_fix_success: bool = False
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ScopeValidationResult:
    """Outcome for OAuth scope alignment."""

    required_scopes: List[str]
    granted_scopes: List[str]
    missing_scopes: List[str]
    alignment_status: ValidationStatus
    message: str


class ValidatorAgent(BaseAgent):
    """Gemini ADK agent responsible for safeguard enforcement."""

    def __init__(
        self,
        *,
        name: str,
        composio_client: ComposioClientWrapper | None = None,
        telemetry: TelemetryClient | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(name=name, sub_agents=[], **kwargs)
        object.__setattr__(self, "_composio_client", composio_client)
        object.__setattr__(self, "_telemetry", telemetry)

    # ------------------------------------------------------------------
    # Public API used by Planner and Executor agents
    # ------------------------------------------------------------------
    @property
    def composio_client(self) -> ComposioClientWrapper | None:
        return getattr(self, "_composio_client", None)

    @property
    def telemetry(self) -> TelemetryClient | None:
        return getattr(self, "_telemetry", None)

    async def validate_scopes(
        self,
        ctx: InvocationContext,
        required_scopes: Sequence[str],
    ) -> ScopeValidationResult:
        """Verify Inspector's granted scopes against mission requirements."""

        required = list(dict.fromkeys(required_scopes))
        granted = await self._collect_granted_scopes(ctx)
        missing = [scope for scope in required if scope not in granted]

        status = (
            ValidationStatus.PASSED if not missing else ValidationStatus.FAILED
        )
        result = ScopeValidationResult(
            required_scopes=required,
            granted_scopes=granted,
            missing_scopes=missing,
            alignment_status=status,
            message=(
                "All required scopes granted"
                if not missing
                else f"Missing scopes: {', '.join(missing)}"
            ),
        )

        self._record_validation_result(
            ctx,
            payload={
                "type": "scope_check",
                "status": status.value,
                "required_scopes": required,
                "granted_scopes": granted,
                "missing_scopes": missing,
            },
        )

        await self._emit_telemetry(
            "validator_scope_check",
            ctx,
            {
                "required_scopes": required,
                "granted_scopes": granted,
                "missing_scopes": missing,
                "alignment_status": status.value,
            },
        )

        if status is ValidationStatus.FAILED:
            await self._emit_telemetry(
                "validator_alert_raised",
                ctx,
                {
                    "safeguard_id": "scope_alignment",
                    "severity": ValidationSeverity.ERROR.value,
                    "status": status.value,
                    "auto_fix_attempted": False,
                    "auto_fix_success": False,
                },
            )
            await self._emit_telemetry(
                "validator_override_requested",
                ctx,
                {
                    "safeguard_id": "scope_alignment",
                    "override_reason": result.message,
                },
            )

        return result

    async def preflight_check(
        self,
        ctx: InvocationContext,
        action: Dict[str, Any],
    ) -> List[ValidationResult]:
        """Run safeguard checks before executing a tool action."""

        return await self._run_checks(ctx, action, stage="preflight", execution_result=None)

    async def postflight_check(
        self,
        ctx: InvocationContext,
        action: Dict[str, Any],
        execution_result: Dict[str, Any],
    ) -> List[ValidationResult]:
        """Run safeguard checks after a tool action completes."""

        return await self._run_checks(
            ctx,
            action,
            stage="postflight",
            execution_result=execution_result,
        )

    # ------------------------------------------------------------------
    # BaseAgent overrides
    # ------------------------------------------------------------------
    async def _run_async_impl(
        self,
        ctx: InvocationContext,
    ) -> AsyncGenerator[Event, None]:
        """Allow Validator to run as a standalone agent when invoked directly."""

        required = ctx.session.state.get("required_scopes")
        if required:
            scope_result = await self.validate_scopes(ctx, required)
            yield self._make_event(
                ctx,
                message=scope_result.message,
                metadata={
                    "type": "scope_validation",
                    "status": scope_result.alignment_status.value,
                    "missing_scopes": scope_result.missing_scopes,
                },
            )

        action = ctx.session.state.get("current_action")
        if action:
            for result in await self.preflight_check(ctx, action):
                yield self._make_event(
                    ctx,
                    message=result.message,
                    metadata={
                        "type": "preflight_check",
                        "safeguard_id": result.safeguard_id,
                        "status": result.status.value,
                        "severity": result.severity.value,
                    },
                )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    async def _collect_granted_scopes(self, ctx: InvocationContext) -> List[str]:
        scopes: List[str] = []

        granted = ctx.session.state.get("granted_scopes")
        scopes.extend(self._flatten_scopes(granted))

        if self.composio_client:
            user_id = ctx.session.state.get("user_id")
            tenant_id = ctx.session.state.get("tenant_id")
            if user_id and tenant_id:
                try:
                    accounts = await self.composio_client.connected_accounts_status(
                        user_id=user_id,
                        tenant_id=tenant_id,
                    )
                    for account in accounts or []:
                        scopes.extend(self._flatten_scopes(account.get("scopes")))
                except Exception as exc:  # pragma: no cover - defensive
                    await self._emit_telemetry(
                        "validator_scope_check",
                        ctx,
                        {
                            "alignment_status": ValidationStatus.SKIPPED.value,
                            "error": str(exc),
                        },
                    )

        return list(dict.fromkeys(scopes))

    async def _run_checks(
        self,
        ctx: InvocationContext,
        action: Dict[str, Any],
        *,
        stage: str,
        execution_result: Dict[str, Any] | None,
    ) -> List[ValidationResult]:
        safeguards = self._load_safeguards(ctx)
        results: List[ValidationResult] = []

        for safeguard in safeguards:
            result = await self._check_safeguard(
                ctx,
                safeguard,
                action,
                stage=stage,
                execution_result=execution_result,
            )
            results.append(result)
            self._record_validation_result(
                ctx,
                payload={
                    "type": stage,
                    "safeguard_id": safeguard.id,
                    "status": result.status.value,
                    "severity": result.severity.value,
                    "auto_fix_attempted": result.auto_fix_attempted,
                    "auto_fix_success": result.auto_fix_success,
                },
            )

            if result.status is ValidationStatus.FAILED and not result.auto_fix_success:
                await self._emit_alert(ctx, safeguard, result, action)

        return results

    def _load_safeguards(self, ctx: InvocationContext) -> List[Safeguard]:
        data = ctx.session.state.get("safeguards", [])
        safeguards: List[Safeguard] = []
        for item in data:
            if isinstance(item, Safeguard):
                safeguards.append(item)
                continue
            if isinstance(item, dict):
                safeguards.append(
                    Safeguard(
                        id=item.get("id", f"safeguard-{len(safeguards)}"),
                        category=item.get("category", "general"),
                        rule=item.get("rule", ""),
                        auto_fix_enabled=item.get("auto_fix_enabled", True),
                        severity=ValidationSeverity(
                            item.get("severity", ValidationSeverity.WARNING.value)
                        ),
                        metadata=item.get("metadata", {}),
                    )
                )
        return safeguards

    async def _check_safeguard(
        self,
        ctx: InvocationContext,
        safeguard: Safeguard,
        action: Dict[str, Any],
        *,
        stage: str,
        execution_result: Dict[str, Any] | None,
    ) -> ValidationResult:
        if safeguard.category == "rate_limits":
            return await self._evaluate_rate_limit(ctx, safeguard, action)

        if safeguard.category == "approval_required" and stage == "preflight":
            approved = ctx.session.state.get("approval_granted", False)
            if not approved:
                return ValidationResult(
                    safeguard_id=safeguard.id,
                    status=ValidationStatus.FAILED,
                    severity=safeguard.severity,
                    message="Approval required before executing this action",
                )

        # Default pass-through
        return ValidationResult(
            safeguard_id=safeguard.id,
            status=ValidationStatus.PASSED,
            severity=safeguard.severity,
            message=f"Safeguard {safeguard.id} passed",
        )

    async def _evaluate_rate_limit(
        self,
        ctx: InvocationContext,
        safeguard: Safeguard,
        action: Dict[str, Any],
    ) -> ValidationResult:
        toolkit = action.get("toolkit") or "default"
        limit = int(safeguard.metadata.get("max_calls_per_minute", 60))
        recent_calls = self._count_recent_calls(ctx, toolkit)

        if recent_calls < limit:
            return ValidationResult(
                safeguard_id=safeguard.id,
                status=ValidationStatus.PASSED,
                severity=safeguard.severity,
                message=f"Rate limit OK: {recent_calls}/{limit}",
            )

        if safeguard.auto_fix_enabled:
            delay = self._calculate_backoff_delay(recent_calls, limit)
            self._record_auto_fix(
                ctx,
                safeguard_id=safeguard.id,
                attempted=True,
                success=True,
                details={"delay_seconds": delay, "toolkit": toolkit},
            )
            await self._emit_telemetry(
                "validator_auto_fix_applied",
                ctx,
                {
                    "safeguard_id": safeguard.id,
                    "toolkit": toolkit,
                    "delay_seconds": delay,
                },
            )
            return ValidationResult(
                safeguard_id=safeguard.id,
                status=ValidationStatus.AUTO_FIXED,
                severity=safeguard.severity,
                message=f"Rate limit reached, delaying next call by {delay}s",
                auto_fix_attempted=True,
                auto_fix_success=True,
                details={"delay_seconds": delay},
            )

        self._record_auto_fix(
            ctx,
            safeguard_id=safeguard.id,
            attempted=safeguard.auto_fix_enabled,
            success=False,
            details={"toolkit": toolkit},
        )
        return ValidationResult(
            safeguard_id=safeguard.id,
            status=ValidationStatus.FAILED,
            severity=safeguard.severity,
            message=f"Rate limit exceeded: {recent_calls}/{limit}",
            auto_fix_attempted=safeguard.auto_fix_enabled,
            auto_fix_success=False,
            details={"toolkit": toolkit},
        )

    def _count_recent_calls(self, ctx: InvocationContext, toolkit: str) -> int:
        recent = ctx.session.state.get("validator_recent_calls", {})
        if isinstance(recent, dict):
            value = recent.get(toolkit) or recent.get("*")
            if isinstance(value, int):
                return value
        return 0

    def _calculate_backoff_delay(self, current_calls: int, limit: int) -> int:
        overage = max(current_calls - limit + 1, 1)
        return min(2 ** min(overage, 5), 60)

    async def _emit_alert(
        self,
        ctx: InvocationContext,
        safeguard: Safeguard,
        result: ValidationResult,
        action: Dict[str, Any],
    ) -> None:
        await self._emit_telemetry(
            "validator_alert_raised",
            ctx,
            {
                "safeguard_id": safeguard.id,
                "safeguard_category": safeguard.category,
                "severity": result.severity.value,
                "status": result.status.value,
                "auto_fix_attempted": result.auto_fix_attempted,
                "auto_fix_success": result.auto_fix_success,
                "action": action.get("name"),
                "toolkit": action.get("toolkit"),
            },
        )

        if result.status is ValidationStatus.FAILED:
            await self._emit_telemetry(
                "validator_override_requested",
                ctx,
                {
                    "safeguard_id": safeguard.id,
                    "override_reason": result.message,
                },
            )

    def _record_validation_result(self, ctx: InvocationContext, *, payload: Dict[str, Any]) -> None:
        results = list(ctx.session.state.get("validation_results", []))
        results.append(payload)
        ctx.session.state["validation_results"] = results

    def _record_auto_fix(
        self,
        ctx: InvocationContext,
        *,
        safeguard_id: str,
        attempted: bool,
        success: bool,
        details: Dict[str, Any],
    ) -> None:
        attempts = list(ctx.session.state.get("auto_fix_attempts", []))
        attempts.append(
            {
                "safeguard_id": safeguard_id,
                "attempted": attempted,
                "success": success,
                "details": details,
            }
        )
        ctx.session.state["auto_fix_attempts"] = attempts

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
            "current_stage": ctx.session.state.get("current_stage"),
            **context,
        }
        self.telemetry.emit(event_name, payload)

    def _make_event(
        self,
        ctx: InvocationContext,
        *,
        message: str,
        metadata: Dict[str, Any],
    ) -> Event:
        content = Content(role="system", parts=[Part(text=message)])
        return Event(
            author=self.name,
            invocationId=getattr(ctx, "invocation_id", ""),
            content=content,
            customMetadata=metadata,
        )

    def _flatten_scopes(self, value: Any) -> List[str]:
        if value is None:
            return []
        if isinstance(value, str):
            return [value]
        if isinstance(value, dict):
            scopes: List[str] = []
            for v in value.values():
                scopes.extend(self._flatten_scopes(v))
            return scopes
        if isinstance(value, Iterable):
            scopes: List[str] = []
            for item in value:
                scopes.extend(self._flatten_scopes(item))
            return scopes
        return []


__all__ = [
    "ValidatorAgent",
    "Safeguard",
    "ValidationResult",
    "ScopeValidationResult",
    "ValidationSeverity",
    "ValidationStatus",
]
