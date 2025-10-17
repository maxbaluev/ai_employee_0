"""Composio service wrapper scaffolding.

Provides a stable interface for ADK agents while real SDK wiring remains
pending. Follow up with composio==0.8.20 integration per
`docs/12_service_architecture.md`.
"""

from __future__ import annotations

from dataclasses import dataclass
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
        tenant_id: str | None = None,
        user_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Search Composio toolkit catalog for mission-relevant tools."""

        if self.client is None:
            raise RuntimeError("Composio client not configured")

        tools_api = getattr(self.client, "tools", None)
        if tools_api is None:
            raise AttributeError("Composio client missing tools API")

        search_method = getattr(tools_api, "search", None)
        if search_method is None:
            raise AttributeError("Composio client missing tools.search method")

        kwargs: dict[str, Any] = {"query": query, "limit": limit}
        if tenant_id is not None:
            kwargs["tenant_id"] = tenant_id
        if user_id is not None:
            kwargs["user_id"] = user_id

        result = search_method(**kwargs)
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
        scopes: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Generate Connect Link metadata for OAuth authorization."""

        if self.client is None:
            raise RuntimeError("Composio client not configured")

        toolkits_api = getattr(self.client, "toolkits", None)
        if toolkits_api is None:
            raise AttributeError("Composio client missing toolkits API")

        authorize_method = getattr(toolkits_api, "authorize", None)
        if authorize_method is None:
            raise AttributeError("Composio client missing toolkits.authorize method")

        kwargs: dict[str, Any] = {
            "toolkit": toolkit_slug,
            "user_id": user_id,
            "tenant_id": tenant_id,
            "redirect_url": redirect_url,
            "metadata": metadata or {},
        }
        if scopes is not None:
            kwargs["scopes"] = scopes

        result = authorize_method(**kwargs)
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
        """Await OAuth completion and return granted scope metadata."""

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

    async def audit_list_events(
        self,
        *,
        mission_id: str,
        tenant_id: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        """Fetch audit events for a mission from Composio."""

        if self.client is None:
            raise RuntimeError("Composio client not configured")

        audit_api = getattr(self.client, "audit", None)
        if audit_api is None:
            raise AttributeError("Composio client missing audit API")

        list_method = getattr(audit_api, "list_events", None)
        if list_method is None:
            raise AttributeError("Composio audit API missing list_events method")

        kwargs: dict[str, Any] = {"mission_id": mission_id}
        if tenant_id is not None:
            kwargs["tenant_id"] = tenant_id
        if limit is not None:
            kwargs["limit"] = limit

        result = list_method(**kwargs)
        if isawaitable(result):
            result = await result

        if result is None:
            return []
        if isinstance(result, dict):
            return [result]
        return list(result)

    async def execute_tool_call(
        self,
        *,
        action: dict[str, Any],
        user_id: str,
        tenant_id: str | None = None,
    ) -> dict[str, Any]:
        """Execute a tool call using the configured provider or tools API."""

        if self.client is None:
            raise RuntimeError("Composio client not configured")

        provider = getattr(self.client, "provider", None)
        if provider is not None:
            session_method = getattr(provider, "session", None)
            if session_method is not None:
                session = session_method(user_id=user_id, tenant_id=tenant_id)
                if isawaitable(session):
                    session = await session
                handler = getattr(session, "handle_tool_call", None)
                if handler is not None:
                    response = handler(action)
                    if isawaitable(response):
                        response = await response
                    if response is None:
                        return {}
                    return dict(response) if isinstance(response, dict) else {"result": response}

        tools_api = getattr(self.client, "tools", None)
        if tools_api is not None:
            execute_method = getattr(tools_api, "execute", None)
            if execute_method is not None:
                response = execute_method(action)
                if isawaitable(response):
                    response = await response
                if response is None:
                    return {}
                return dict(response) if isinstance(response, dict) else {"result": response}

        raise AttributeError("Composio client missing provider.session or tools.execute for execution")


__all__ = ["ComposioClientWrapper"]
