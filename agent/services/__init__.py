"""Service layer placeholders for the AI Employee Control Plane.

Add typed wrappers for Composio, Supabase, and telemetry clients here. Follow
patterns described in docs/04_implementation_guide.md (sections 3.4–3.7).
"""

from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class ComposioClientWrapper:
    """Typed facade around the native Composio SDK (placeholder)."""

    client: Any  # replace with composio.ComposioClient once available

    def require_connected_account(self, tenant_id: str, user_id: str) -> None:
        raise NotImplementedError("Implement Composio workspace lookups")


@dataclass(slots=True)
class SupabaseClientWrapper:
    """Placeholder for Supabase reads/writes used by agents and API routes."""

    client: Any  # replace with supabase.Client when types are available

    def fetch_mission(self, mission_id: str) -> dict[str, Any]:
        raise NotImplementedError("Implement Supabase mission fetch")


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
