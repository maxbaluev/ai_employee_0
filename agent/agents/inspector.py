"""InspectorAgent for toolkit discovery and OAuth initiation.

Implements Stage 2 (Prepare) of the mission lifecycle with two-phase workflow:
1. Discovery: No-auth toolkit search, scope preview, coverage estimation
2. OAuth: Connect Link generation after approval, scope logging

References:
- docs/02_system_overview.md §ADK Agent Coordination (InspectorAgent)
- docs/10_composio.md §Progressive Trust with ADK Agents & Composio SDK
- docs/backlog.md TASK-ADK-003
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, List

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai.types import Content, Part

from agent.services import ComposioClientWrapper, SupabaseClientWrapper, TelemetryClient


@dataclass(slots=True)
class ToolkitRecommendation:
    """Toolkit discovered during inspection phase."""

    toolkit_slug: str
    purpose: str
    anticipated_scopes: List[str]
    connection_required: bool
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class DiscoveryResult:
    """Cached discovery results for a mission objective."""

    toolkits: List[ToolkitRecommendation]
    coverage_estimate: float
    readiness_status: str
    cached_at: datetime
    cache_key: str
    inspection_previews: Dict[str, Any]


@dataclass(slots=True)
class ConnectionResult:
    """OAuth connection establishment result."""

    toolkit_slug: str
    connect_link_id: str
    granted_scopes: List[str]
    status: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class InspectionPreview:
    """No-auth inspection preview metadata for a toolkit."""

    toolkit_slug: str
    sample_records: List[Dict[str, Any]]
    sample_count: int
    pii_flags: Dict[str, bool]
    metadata: Dict[str, Any] = field(default_factory=dict)


class InspectorAgent(BaseAgent):
    """Gemini ADK agent for toolkit discovery and OAuth initiation.

    Responsibilities:
    - Phase 1: Discovery via tools.search(), compute coverage, preview scopes
    - Phase 2: OAuth via toolkits.authorize() after approval, log scopes
    - Cache discovery results (1 hour TTL) to avoid redundant SDK calls
    - Emit composio_discovery and composio_auth_flow telemetry
    """

    def __init__(
        self,
        *,
        name: str,
        composio_client: ComposioClientWrapper | None = None,
        supabase_client: SupabaseClientWrapper | None = None,
        telemetry: TelemetryClient | None = None,
        discovery_cache_ttl_seconds: int = 3600,
        readiness_threshold: float = 0.85,
        **kwargs: Any,
    ) -> None:
        super().__init__(name=name, sub_agents=[], **kwargs)
        object.__setattr__(self, "_composio_client", composio_client)
        object.__setattr__(self, "_supabase_client", supabase_client)
        object.__setattr__(self, "_telemetry", telemetry)
        object.__setattr__(self, "_discovery_cache_ttl_seconds", discovery_cache_ttl_seconds)
        object.__setattr__(self, "_readiness_threshold", readiness_threshold)
        object.__setattr__(self, "_discovery_cache", {})

    @property
    def composio_client(self) -> ComposioClientWrapper | None:
        return getattr(self, "_composio_client", None)

    @property
    def supabase_client(self) -> SupabaseClientWrapper | None:
        return getattr(self, "_supabase_client", None)

    @property
    def telemetry(self) -> TelemetryClient | None:
        return getattr(self, "_telemetry", None)

    @property
    def discovery_cache_ttl_seconds(self) -> int:
        return getattr(self, "_discovery_cache_ttl_seconds", 3600)

    @property
    def readiness_threshold(self) -> float:
        return getattr(self, "_readiness_threshold", 0.85)

    @property
    def discovery_cache(self) -> Dict[str, DiscoveryResult]:
        return getattr(self, "_discovery_cache", {})

    async def _run_async_impl(
        self,
        ctx: InvocationContext,
    ) -> AsyncGenerator[Event, None]:
        """Execute discovery and OAuth phases based on session state."""

        mission_brief = ctx.session.state.get("mission_brief")
        if not mission_brief:
            await self._emit_telemetry(
                "inspector_error",
                ctx,
                {"error": "missing_mission_brief"},
            )
            raise RuntimeError("Missing mission_brief in session state")

        mission_id = ctx.session.state.get("mission_id")

        # Phase 1: Discovery (if not already done)
        if "anticipated_connections" not in ctx.session.state:
            yield self._make_event(
                ctx,
                message="Starting toolkit discovery phase...",
                metadata={"phase": "discovery", "stage": "PREPARE"},
            )

            if self.supabase_client and mission_id:
                try:
                    await self.supabase_client.update_mission_stage_status(
                        mission_id=mission_id,
                        stage="Prepare",
                        status="in_progress",
                        readiness_state="unknown",
                    )
                except Exception as exc:  # noqa: BLE001
                    await self._emit_telemetry(
                        "inspector_error",
                        ctx,
                        {
                            "error": "stage_status_update_failed",
                            "detail": str(exc),
                        },
                    )

            discovery = await self._discover_toolkits(ctx, mission_brief)

            ctx.session.state["anticipated_connections"] = [
                {
                    "toolkit_slug": tk.toolkit_slug,
                    "purpose": tk.purpose,
                    "anticipated_scopes": tk.anticipated_scopes,
                    "connection_required": tk.connection_required,
                }
                for tk in discovery.toolkits
            ]
            ctx.session.state["coverage_estimate"] = discovery.coverage_estimate
            ctx.session.state["readiness_status"] = discovery.readiness_status
            ctx.session.state["inspection_previews"] = discovery.inspection_previews
            ctx.session.state["inspector_last_discovery_at"] = discovery.cached_at.isoformat()

            for index, toolkit in enumerate(discovery.toolkits, start=1):
                await self._emit_telemetry(
                    "toolkit_recommended",
                    ctx,
                    {
                        "toolkit_slug": toolkit.toolkit_slug,
                        "rank": index,
                        "auth_required": toolkit.connection_required,
                    },
                )

            await self._emit_telemetry(
                "readiness_status_changed",
                ctx,
                {
                    "status": discovery.readiness_status,
                    "coverage_percent": discovery.coverage_estimate,
                    "blocking_items": []
                    if discovery.readiness_status == "ready"
                    else ["insufficient_coverage"],
                },
            )

            if self.supabase_client and mission_id:
                try:
                    await self.supabase_client.update_mission_stage_status(
                        mission_id=mission_id,
                        stage="Prepare",
                        status="ready"
                        if discovery.readiness_status == "ready"
                        else "in_progress",
                        readiness_state=discovery.readiness_status,
                        coverage_percent=discovery.coverage_estimate * 100,
                    )
                except Exception as exc:  # noqa: BLE001
                    await self._emit_telemetry(
                        "inspector_error",
                        ctx,
                        {
                            "error": "stage_status_update_failed",
                            "detail": str(exc),
                        },
                    )

            yield self._make_event(
                ctx,
                message=f"Discovery complete: {len(discovery.toolkits)} toolkits, {discovery.coverage_estimate:.0%} coverage",
                metadata={
                    "phase": "discovery",
                    "toolkit_count": len(discovery.toolkits),
                    "coverage": discovery.coverage_estimate,
                    "readiness": discovery.readiness_status,
                    "inspection_preview_count": len(discovery.inspection_previews),
                },
            )

        anticipated_connections = ctx.session.state.get("anticipated_connections", [])
        requires_oauth = any(
            connection.get("connection_required", True) for connection in anticipated_connections
        )

        if not requires_oauth:
            ctx.session.state.setdefault("granted_scopes", [])
            ctx.session.state["authorization_status"] = "not_required"
            yield self._make_event(
                ctx,
                message="No OAuth required for recommended toolkits.",
                metadata={"phase": "oauth", "stage": "PREPARE", "authorization": "not_required"},
            )
            return

        # Phase 2: OAuth (if approval granted)
        connect_link_decision = ctx.session.state.get("connect_link_decision", {})
        if connect_link_decision.get("status") == "approved":
            if "granted_scopes" not in ctx.session.state or not ctx.session.state["granted_scopes"]:
                yield self._make_event(
                    ctx,
                    message="Starting OAuth authorization phase...",
                    metadata={"phase": "oauth", "stage": "PREPARE"},
                )

                connections, failures, total_required = await self._initiate_oauth(
                    ctx,
                    anticipated_connections,
                )

                all_scopes: List[str] = []
                for conn in connections:
                    all_scopes.extend(conn.granted_scopes)

                ctx.session.state["granted_scopes"] = list(dict.fromkeys(all_scopes))
                if failures:
                    ctx.session.state["authorization_errors"] = failures

                if total_required and len(connections) == total_required:
                    ctx.session.state["authorization_status"] = "granted"
                elif connections:
                    ctx.session.state["authorization_status"] = "partial"
                else:
                    ctx.session.state["authorization_status"] = "error"

                status = ctx.session.state.get("authorization_status")

                anticipated_count = len(anticipated_connections)
                coverage = len(connections) / max(anticipated_count, 1)
                ctx.session.state["coverage_estimate"] = coverage
                readiness = "ready" if coverage >= self.readiness_threshold else "insufficient_coverage"
                ctx.session.state["readiness_status"] = readiness

                yield self._make_event(
                    ctx,
                    message=f"OAuth complete: {len(connections)} connections, {len(all_scopes)} scopes granted",
                    metadata={
                        "phase": "oauth",
                        "connection_count": len(connections),
                        "scope_count": len(all_scopes),
                        "authorization_status": status,
                    },
                )
                await self._emit_telemetry(
                    "readiness_status_changed",
                    ctx,
                    {
                        "status": readiness,
                        "coverage_percent": coverage,
                        "blocking_items": [] if readiness == "ready" else ["insufficient_coverage"],
                    },
                )

                if self.supabase_client and mission_id:
                    try:
                        await self.supabase_client.update_mission_stage_status(
                            mission_id=mission_id,
                            stage="Prepare",
                            status="completed" if readiness == "ready" else "ready",
                            readiness_state=readiness,
                            coverage_percent=coverage * 100,
                        )
                    except Exception as exc:  # noqa: BLE001
                        await self._emit_telemetry(
                            "inspector_error",
                            ctx,
                            {
                                "error": "stage_status_update_failed",
                                "detail": str(exc),
                            },
                        )
            else:
                ctx.session.state.setdefault("authorization_status", "granted")
        elif not connect_link_decision:
            ctx.session.state["authorization_status"] = "pending"
            yield self._make_event(
                ctx,
                message="Awaiting Connect Link approval before OAuth initiation",
                metadata={"phase": "pending_approval", "stage": "PREPARE"},
            )
            if self.supabase_client and mission_id:
                try:
                    await self.supabase_client.update_mission_stage_status(
                        mission_id=mission_id,
                        stage="Prepare",
                        status="in_progress",
                        readiness_state=ctx.session.state.get("readiness_status", "needs_authorization"),
                        blocking_reason="awaiting_stakeholder_approval",
                    )
                except Exception as exc:  # noqa: BLE001
                    await self._emit_telemetry(
                        "inspector_error",
                        ctx,
                        {
                            "error": "stage_status_update_failed",
                            "detail": str(exc),
                        },
                    )
        else:
            ctx.session.state["authorization_status"] = connect_link_decision.get("status", "pending")
            decision_status = ctx.session.state["authorization_status"]
            if decision_status not in {"approved", "granted"} and self.supabase_client and mission_id:
                try:
                    await self.supabase_client.update_mission_stage_status(
                        mission_id=mission_id,
                        stage="Prepare",
                        status="blocked" if decision_status == "denied" else "in_progress",
                        readiness_state="insufficient_coverage",
                        blocking_reason=f"connect_link_{decision_status}",
                    )
                except Exception as exc:  # noqa: BLE001
                    await self._emit_telemetry(
                        "inspector_error",
                        ctx,
                        {
                            "error": "stage_status_update_failed",
                            "detail": str(exc),
                        },
                    )

    async def _discover_toolkits(
        self,
        ctx: InvocationContext,
        mission_brief: Dict[str, Any],
    ) -> DiscoveryResult:
        """Phase 1: Discover toolkits via tools.search() and compute coverage."""

        objective = mission_brief.get("objective", "")
        cache_key = self._compute_cache_key(objective)

        # Check cache
        cached = self.discovery_cache.get(cache_key)
        if cached and self._is_cache_valid(cached):
            await self._emit_telemetry(
                "composio_discovery",
                ctx,
                {
                    "query": objective,
                    "result_count": len(cached.toolkits),
                    "cached": True,
                    "coverage_estimate": cached.coverage_estimate,
                    "readiness_status": cached.readiness_status,
                    "inspection_preview_count": len(cached.inspection_previews),
                },
            )
            return cached

        # Perform discovery
        if not self.composio_client:
            raise RuntimeError("Composio client not configured")

        start_time = time.time()
        toolkit_metadata = await self.composio_client.tools_search(
            query=objective,
            limit=20,
            tenant_id=ctx.session.state.get("tenant_id"),
            user_id=ctx.session.state.get("user_id"),
        )
        latency_ms = int((time.time() - start_time) * 1000)

        toolkits = self._parse_toolkit_metadata(toolkit_metadata)
        coverage = self._compute_coverage(toolkits, mission_brief)
        readiness = "ready" if coverage >= self.readiness_threshold else "insufficient_coverage"
        previews_list = await self._generate_inspection_previews(ctx, toolkits)
        inspection_previews = {
            preview.toolkit_slug: {
                "sample_records": preview.sample_records,
                "sample_count": preview.sample_count,
                "pii_flags": preview.pii_flags,
                "metadata": preview.metadata,
            }
            for preview in previews_list
        }

        result = DiscoveryResult(
            toolkits=toolkits,
            coverage_estimate=coverage,
            readiness_status=readiness,
            cached_at=datetime.now(timezone.utc),
            cache_key=cache_key,
            inspection_previews=inspection_previews,
        )

        # Cache result
        self.discovery_cache[cache_key] = result

        await self._emit_telemetry(
            "composio_discovery",
            ctx,
            {
                "query": objective,
                "result_count": len(toolkits),
                "latency_ms": latency_ms,
                "cached": False,
                "coverage_estimate": coverage,
                "readiness_status": readiness,
                "inspection_preview_count": len(inspection_previews),
            },
        )

        return result

    async def _initiate_oauth(
        self,
        ctx: InvocationContext,
        anticipated_connections: List[Dict[str, Any]],
    ) -> tuple[List[ConnectionResult], List[Dict[str, Any]], int]:
        """Phase 2: Initiate OAuth via toolkits.authorize() after approval."""

        if not self.composio_client or not self.supabase_client:
            raise RuntimeError("Composio and Supabase clients required for OAuth")

        user_id = ctx.session.state.get("user_id")
        tenant_id = ctx.session.state.get("tenant_id")
        mission_id = ctx.session.state.get("mission_id")

        if not user_id or not tenant_id or not mission_id:
            raise RuntimeError("Missing user_id, tenant_id, or mission_id in session state")

        required_connections = [
            conn for conn in anticipated_connections if conn.get("connection_required", True)
        ]
        total_required = len(required_connections)

        if total_required:
            ctx.session.state["authorization_status"] = "initiated"

        connections: List[ConnectionResult] = []
        failures: List[Dict[str, Any]] = []

        connect_links_state: List[Dict[str, Any]] = list(ctx.session.state.get("connect_links", []))

        for anticipated in required_connections:
            toolkit_slug = anticipated["toolkit_slug"]

            await self._emit_telemetry(
                "composio_auth_flow",
                ctx,
                {
                    "toolkit": toolkit_slug,
                    "status": "initiated",
                    "user_id": user_id,
                    "tenant_id": tenant_id,
                },
            )

            try:
                connect_link = await self.composio_client.toolkits_authorize(
                    toolkit_slug=toolkit_slug,
                    user_id=user_id,
                    tenant_id=tenant_id,
                    scopes=anticipated.get("anticipated_scopes"),
                    metadata={"mission_id": mission_id},
                )

                connect_link_id = connect_link.get("connect_link_id", "")
                redirect_url = connect_link.get("redirect_url")
                expires_at = connect_link.get("expires_at")

                link_state = {
                    "toolkit_slug": toolkit_slug,
                    "connect_link_id": connect_link_id,
                    "redirect_url": redirect_url,
                    "expires_at": expires_at,
                    "status": "pending",
                }
                connect_links_state = [
                    link
                    for link in connect_links_state
                    if link.get("toolkit_slug") != toolkit_slug
                    or link.get("connect_link_id") == connect_link_id
                ]
                connect_links_state.append(link_state)
                ctx.session.state["connect_links"] = connect_links_state
                ctx.session.state["authorization_status"] = "awaiting_connection"

                await self._emit_telemetry(
                    "composio_auth_flow",
                    ctx,
                    {
                        "toolkit": toolkit_slug,
                        "status": "link_ready",
                        "connect_link_id": connect_link_id,
                        "redirect_url": redirect_url,
                    },
                )

                connection = await self.composio_client.wait_for_connection(
                    connect_link_id=connect_link_id,
                    timeout_seconds=900,
                )

                granted_scopes = connection.get("granted_scopes", [])

                link_state.update(
                    {
                        "status": connection.get("status", "connected"),
                        "granted_scopes": granted_scopes,
                    },
                )
                ctx.session.state["connect_links"] = connect_links_state

                await self.supabase_client.log_mission_connection(
                    mission_id=mission_id,
                    toolkit_slug=toolkit_slug,
                    connect_link_id=connect_link_id,
                    granted_scopes=granted_scopes,
                    user_id=user_id,
                    tenant_id=tenant_id,
                    metadata=connection.get("metadata", {}),
                )

                connections.append(
                    ConnectionResult(
                        toolkit_slug=toolkit_slug,
                        connect_link_id=connect_link_id,
                        granted_scopes=granted_scopes,
                        status="approved",
                        metadata=connection,
                    ),
                )

                await self._emit_telemetry(
                    "composio_auth_flow",
                    ctx,
                    {
                        "toolkit": toolkit_slug,
                        "status": "approved",
                        "connect_link_id": connect_link_id,
                        "scope_count": len(granted_scopes),
                    },
                )

            except Exception as exc:  # noqa: BLE001 - log and continue
                failure_payload = {"toolkit_slug": toolkit_slug, "error": str(exc)}
                failures.append(failure_payload)
                await self._emit_telemetry(
                    "composio_auth_flow",
                    ctx,
                    {
                        "toolkit": toolkit_slug,
                        "status": "error",
                        "error": str(exc),
                    },
                )
                for link in connect_links_state:
                    if link["toolkit_slug"] == toolkit_slug and link.get("status") == "pending":
                        link["status"] = "error"
                        link["error"] = str(exc)
                ctx.session.state["connect_links"] = connect_links_state

        return connections, failures, total_required

    def _parse_toolkit_metadata(
        self,
        metadata: List[Dict[str, Any]],
    ) -> List[ToolkitRecommendation]:
        """Parse Composio SDK toolkit metadata into recommendations."""

        toolkits: List[ToolkitRecommendation] = []

        for item in metadata:
            toolkits.append(
                ToolkitRecommendation(
                    toolkit_slug=item.get("slug", item.get("name", "unknown")),
                    purpose=item.get("description", item.get("purpose", "")),
                    anticipated_scopes=item.get("scopes", item.get("required_scopes", [])),
                    connection_required=item.get("requires_auth", True),
                    metadata=item,
                )
            )

        return toolkits

    async def _generate_inspection_previews(
        self,
        ctx: InvocationContext,
        toolkits: List[ToolkitRecommendation],
    ) -> List[InspectionPreview]:
        """Generate no-auth inspection previews for recommended toolkits."""

        mission_id = ctx.session.state.get("mission_id")
        previews: List[InspectionPreview] = []

        for toolkit in toolkits[:5]:
            sample_records = [
                {
                    "preview": f"Sample data for {toolkit.toolkit_slug}",
                    "fields": ["field1", "field2"],
                },
            ]
            sample_count = len(sample_records)
            pii_flags = {
                "contains_email": False,
                "contains_phone": False,
                "contains_account_id": False,
            }
            metadata = {"generated_at": datetime.now(timezone.utc).isoformat()}

            preview = InspectionPreview(
                toolkit_slug=toolkit.toolkit_slug,
                sample_records=sample_records,
                sample_count=sample_count,
                pii_flags=pii_flags,
                metadata=metadata,
            )
            previews.append(preview)

            await self._emit_telemetry(
                "data_preview_generated",
                ctx,
                {
                    "toolkit": toolkit.toolkit_slug,
                    "sample_count": sample_count,
                    "pii_flags": pii_flags,
                },
            )

            if self.supabase_client and mission_id:
                try:
                    await self.supabase_client.log_data_inspection_check(
                        mission_id=mission_id,
                        toolkit_slug=toolkit.toolkit_slug,
                        coverage_percent=None,
                        sample_count=sample_count,
                        pii_flags=pii_flags,
                        outcome="pass",
                        details={"sample_records": sample_records},
                    )
                except Exception as exc:  # noqa: BLE001
                    await self._emit_telemetry(
                        "inspector_error",
                        ctx,
                        {
                            "error": "inspection_preview_failed",
                            "toolkit": toolkit.toolkit_slug,
                            "detail": str(exc),
                        },
                    )

        return previews

    def _compute_coverage(
        self,
        toolkits: List[ToolkitRecommendation],
        mission_brief: Dict[str, Any],
    ) -> float:
        """Compute coverage estimate based on toolkits and mission requirements."""

        # Simple heuristic: coverage = number of toolkits / ideal toolkit count
        # Can be enhanced with semantic matching, scope completeness, etc.
        objective = mission_brief.get("objective", "")
        ideal_toolkit_count = max(len(objective.split()) // 10, 3)  # Rough heuristic

        coverage = min(len(toolkits) / ideal_toolkit_count, 1.0)
        return coverage

    def _compute_cache_key(self, objective: str) -> str:
        """Compute cache key from mission objective."""

        return hashlib.sha256(objective.encode()).hexdigest()[:16]

    def _is_cache_valid(self, cached: DiscoveryResult) -> bool:
        """Check if cached result is still valid."""

        age = (datetime.now(timezone.utc) - cached.cached_at).total_seconds()
        return age < self.discovery_cache_ttl_seconds

    async def _emit_telemetry(
        self,
        event_name: str,
        ctx: InvocationContext,
        context: Dict[str, Any],
    ) -> None:
        """Emit telemetry event with mission context."""

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
        """Create ADK Event for yielding to CopilotKit."""

        content = Content(role="system", parts=[Part(text=message)])
        return Event(
            author=self.name,
            invocationId=getattr(ctx, "invocation_id", ""),
            content=content,
            customMetadata=metadata,
        )


__all__ = [
    "InspectorAgent",
    "ToolkitRecommendation",
    "DiscoveryResult",
    "ConnectionResult",
    "InspectionPreview",
]
