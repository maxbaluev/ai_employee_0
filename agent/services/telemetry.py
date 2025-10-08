"""Telemetry helpers used across Gate G-A orchestration agents."""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from .supabase import SupabaseClient


LOGGER = logging.getLogger(__name__)


@dataclass
class TelemetryEmitter:
    """Dispatches mission telemetry to Supabase or falls back to logging."""

    supabase: SupabaseClient
    offline_events: list[Dict[str, Any]] = field(default_factory=list)

    @classmethod
    def from_env(cls) -> "TelemetryEmitter":
        return cls(SupabaseClient.from_env())

    def emit(
        self,
        event_name: str,
        *,
        tenant_id: str,
        mission_id: str,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        event = {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "mission_id": mission_id,
            "event_name": event_name,
            "event_payload": payload or {},
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

        if self.supabase.enabled:
            self.supabase.insert_event(event)
        else:
            self.offline_events.append(event)
            LOGGER.info("[telemetry] %s %s", event_name, payload)

