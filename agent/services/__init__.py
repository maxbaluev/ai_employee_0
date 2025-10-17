"""Service layer placeholders for the AI Employee Control Plane.

Add typed wrappers for Composio, Supabase, and telemetry clients here. Follow
patterns described in docs/04_implementation_guide.md (sections 3.4–3.7).
"""

from dataclasses import dataclass
from datetime import datetime
from inspect import isawaitable
from typing import Any


@dataclass(slots=True)
class ComposioClientWrapper:
    """Typed facade around the native Composio SDK (placeholder)."""

    client: Any  # replace with composio.ComposioClient once available

    def require_connected_account(self, tenant_id: str, user_id: str) -> None:
        raise NotImplementedError("Implement Composio workspace lookups")

    async def connected_accounts_status(
        self, *, tenant_id: str, user_id: str
    ) -> list[dict[str, Any]]:
        """Return connected account metadata for scope validation."""

        if self.client is None:
            raise RuntimeError("Composio client not configured")

        candidate = getattr(self.client, "connected_accounts", None)
        method = None
        if candidate is not None:
            method = getattr(candidate, "status", None)
        if method is None:
            method = getattr(self.client, "connected_accounts_status", None)
        if method is None:
            raise AttributeError("Composio client missing connected account status method")

        result = method(user_id=user_id, tenant_id=tenant_id)
        if isawaitable(result):
            result = await result
        if result is None:
            return []
        return list(result)

    async def tools_search(
        self,
        query: str,
        *,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Search Composio toolkit catalog for mission-relevant tools.

        Used by InspectorAgent during discovery phase (Stage 2 — Prepare).
        Returns toolkit metadata without initiating OAuth.
        """
        if self.client is None:
            raise RuntimeError("Composio client not configured")

        tools_api = getattr(self.client, "tools", None)
        if tools_api is None:
            raise AttributeError("Composio client missing tools API")

        search_method = getattr(tools_api, "search", None)
        if search_method is None:
            raise AttributeError("Composio client missing tools.search method")

        result = search_method(query=query, limit=limit)
        if isawaitable(result):
            result = await result

        if result is None:
            return []
        return list(result) if isinstance(result, (list, tuple)) else [result]

    async def toolkits_authorize(
        self,
        toolkit_slug: str,
        *,
        user_id: str,
        tenant_id: str,
        redirect_url: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Generate Connect Link for OAuth authorization.

        Used by InspectorAgent after stakeholder approval (Stage 2 — Prepare).
        Returns Connect Link metadata including redirect URL.
        """
        if self.client is None:
            raise RuntimeError("Composio client not configured")

        toolkits_api = getattr(self.client, "toolkits", None)
        if toolkits_api is None:
            raise AttributeError("Composio client missing toolkits API")

        authorize_method = getattr(toolkits_api, "authorize", None)
        if authorize_method is None:
            raise AttributeError("Composio client missing toolkits.authorize method")

        result = authorize_method(
            toolkit=toolkit_slug,
            user_id=user_id,
            tenant_id=tenant_id,
            redirect_url=redirect_url,
            metadata=metadata or {},
        )
        if isawaitable(result):
            result = await result

        return result if isinstance(result, dict) else {"connect_link_id": str(result)}

    async def wait_for_connection(
        self,
        connect_link_id: str,
        *,
        timeout_seconds: int = 900,
        poll_interval_seconds: int = 5,
    ) -> dict[str, Any]:
        """Await OAuth connection completion.

        Used by InspectorAgent to wait for stakeholder to complete OAuth flow.
        Returns granted scopes and connection metadata.
        """
        if self.client is None:
            raise RuntimeError("Composio client not configured")

        wait_method = getattr(self.client, "wait_for_connection", None)
        if wait_method is None:
            raise AttributeError("Composio client missing wait_for_connection method")

        result = wait_method(
            connect_link_id=connect_link_id,
            timeout=timeout_seconds,
            poll_interval=poll_interval_seconds,
        )
        if isawaitable(result):
            result = await result

        return result if isinstance(result, dict) else {"status": "connected"}


@dataclass(slots=True)
class SupabaseClientWrapper:
    """Placeholder for Supabase reads/writes used by agents and API routes."""

    client: Any  # replace with supabase.Client when types are available

    def fetch_mission(self, mission_id: str) -> dict[str, Any]:
        raise NotImplementedError("Implement Supabase mission fetch")

    async def log_mission_connection(
        self,
        *,
        mission_id: str,
        toolkit_slug: str,
        connect_link_id: str,
        granted_scopes: list[str],
        user_id: str,
        tenant_id: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Log granted OAuth scopes to mission_connections table.

        Used by InspectorAgent after successful OAuth completion.
        Persists connection metadata for audit trail and scope validation.
        """
        if self.client is None:
            raise RuntimeError("Supabase client not configured")

        table = getattr(self.client, "table", None)
        if table is None:
            raise AttributeError("Supabase client missing table method")

        connections_table = table("mission_connections")
        insert_method = getattr(connections_table, "insert", None)
        if insert_method is None:
            raise AttributeError("Supabase table missing insert method")

        payload = {
            "mission_id": mission_id,
            "toolkit_slug": toolkit_slug,
            "connect_link_id": connect_link_id,
            "granted_scopes": granted_scopes,
            "user_id": user_id,
            "tenant_id": tenant_id,
            "created_at": datetime.utcnow().isoformat(),
            "metadata": metadata or {},
        }

        result = insert_method(payload)
        execute_method = getattr(result, "execute", None)
        if execute_method is not None:
            result = execute_method()
        if isawaitable(result):
            result = await result

        return payload


@dataclass(slots=True)
class TelemetryClient:
    """Placeholder for telemetry emission with redaction helpers."""

    destination: str = "todo"

    def emit(self, event_name: str, payload: dict[str, Any]) -> None:
        raise NotImplementedError("Wire structured telemetry per docs/06_data_intelligence.md")


__all__ = [
    "ComposioClientWrapper",
    "SupabaseClientWrapper",
    "TelemetryClient",
]
