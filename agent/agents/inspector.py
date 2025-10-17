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
from datetime import datetime, timedelta
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


@dataclass(slots=True)
class ConnectionResult:
    """OAuth connection establishment result."""

    toolkit_slug: str
    connect_link_id: str
    granted_scopes: List[str]
    status: str
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

        # Phase 1: Discovery (if not already done)
        if "anticipated_connections" not in ctx.session.state:
            yield self._make_event(
                ctx,
                message="Starting toolkit discovery phase...",
                metadata={"phase": "discovery", "stage": "PREPARE"},
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

            yield self._make_event(
                ctx,
                message=f"Discovery complete: {len(discovery.toolkits)} toolkits, {discovery.coverage_estimate:.0%} coverage",
                metadata={
                    "phase": "discovery",
                    "toolkit_count": len(discovery.toolkits),
                    "coverage": discovery.coverage_estimate,
                    "readiness": discovery.readiness_status,
                },
            )

        # Phase 2: OAuth (if approval granted)
        connect_link_decision = ctx.session.state.get("connect_link_decision", {})
        if connect_link_decision.get("status") == "approved":
            if "granted_scopes" not in ctx.session.state:
                yield self._make_event(
                    ctx,
                    message="Starting OAuth authorization phase...",
                    metadata={"phase": "oauth", "stage": "PREPARE"},
                )

                connections = await self._initiate_oauth(ctx)

                all_scopes: List[str] = []
                for conn in connections:
                    all_scopes.extend(conn.granted_scopes)

                ctx.session.state["granted_scopes"] = list(dict.fromkeys(all_scopes))

                # Update readiness based on granted scopes
                coverage = len(all_scopes) / max(
                    len(ctx.session.state.get("anticipated_connections", [])), 1
                )
                ctx.session.state["coverage_estimate"] = coverage
                ctx.session.state["readiness_status"] = (
                    "ready" if coverage >= self.readiness_threshold else "insufficient_coverage"
                )

                yield self._make_event(
                    ctx,
                    message=f"OAuth complete: {len(connections)} connections, {len(all_scopes)} scopes granted",
                    metadata={
                        "phase": "oauth",
                        "connection_count": len(connections),
                        "scope_count": len(all_scopes),
                        "readiness": ctx.session.state["readiness_status"],
                    },
                )
        elif not connect_link_decision:
            yield self._make_event(
                ctx,
                message="Awaiting Connect Link approval before OAuth initiation",
                metadata={"phase": "pending_approval", "stage": "PREPARE"},
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
        )
        latency_ms = int((time.time() - start_time) * 1000)

        toolkits = self._parse_toolkit_metadata(toolkit_metadata)
        coverage = self._compute_coverage(toolkits, mission_brief)
        readiness = "ready" if coverage >= self.readiness_threshold else "insufficient_coverage"

        result = DiscoveryResult(
            toolkits=toolkits,
            coverage_estimate=coverage,
            readiness_status=readiness,
            cached_at=datetime.utcnow(),
            cache_key=cache_key,
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
            },
        )

        return result

    async def _initiate_oauth(
        self,
        ctx: InvocationContext,
    ) -> List[ConnectionResult]:
        """Phase 2: Initiate OAuth via toolkits.authorize() after approval."""

        if not self.composio_client or not self.supabase_client:
            raise RuntimeError("Composio and Supabase clients required for OAuth")

        user_id = ctx.session.state.get("user_id")
        tenant_id = ctx.session.state.get("tenant_id")
        mission_id = ctx.session.state.get("mission_id")

        if not user_id or not tenant_id or not mission_id:
            raise RuntimeError("Missing user_id, tenant_id, or mission_id in session state")

        anticipated_connections = ctx.session.state.get("anticipated_connections", [])
        connections: List[ConnectionResult] = []

        for anticipated in anticipated_connections:
            if not anticipated.get("connection_required"):
                continue

            toolkit_slug = anticipated["toolkit_slug"]

            # Emit authorization initiated telemetry
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
                # Generate Connect Link
                connect_link = await self.composio_client.toolkits_authorize(
                    toolkit_slug=toolkit_slug,
                    user_id=user_id,
                    tenant_id=tenant_id,
                    metadata={"mission_id": mission_id},
                )

                connect_link_id = connect_link.get("connect_link_id", "")

                # Wait for connection
                connection = await self.composio_client.wait_for_connection(
                    connect_link_id=connect_link_id,
                    timeout_seconds=900,
                )

                granted_scopes = connection.get("granted_scopes", [])

                # Log to Supabase
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
                    )
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
                await self._emit_telemetry(
                    "composio_auth_flow",
                    ctx,
                    {
                        "toolkit": toolkit_slug,
                        "status": "error",
                        "error": str(exc),
                    },
                )

        return connections

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

        age = (datetime.utcnow() - cached.cached_at).total_seconds()
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
]
