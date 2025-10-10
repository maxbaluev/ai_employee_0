"""CopilotKit streaming helpers for mission timeline updates."""

from __future__ import annotations

import logging
import os
import threading
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import httpx


LOGGER = logging.getLogger(__name__)


def _looks_like_uuid(value: Optional[str]) -> bool:
    if not value or not isinstance(value, str):
        return False
    parts = value.split("-")
    if len(parts) != 5:
        return False
    lengths = [8, 4, 4, 4, 12]
    return all(len(segment) == expected for segment, expected in zip(parts, lengths, strict=True))


@dataclass
class CopilotKitStreamer:
    """Sends timeline events to the CopilotKit persistence endpoints."""

    base_url: str = field(default_factory=lambda: os.getenv("COPILOTKIT_SERVICE_URL", "http://localhost:3000"))
    agent_id: str = field(default_factory=lambda: os.getenv("NEXT_PUBLIC_COPILOT_AGENT_ID", "control_plane_foundation"))
    session_path: str = "/api/copilotkit/session"
    message_path: str = "/api/copilotkit/message"
    timeout_seconds: float = 5.0

    def __post_init__(self) -> None:
        self._base_url = self.base_url.rstrip("/")
        self._client = httpx.Client(timeout=self.timeout_seconds)
        self._session_cache: set[Tuple[str, str]] = set()
        self._lock = threading.Lock()

    def emit_message(
        self,
        *,
        tenant_id: Optional[str],
        session_identifier: str,
        role: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
        mission_id: Optional[str] = None,
        payload_type: Optional[str] = None,
        latency_ms: Optional[int] = None,
        telemetry_event_ids: Optional[List[str]] = None,
    ) -> None:
        """Ensure session exists then persist the message."""

        identifier = session_identifier or "mission-session"
        tenant_payload = tenant_id if _looks_like_uuid(tenant_id) else None

        key = (tenant_payload or "default", identifier)
        with self._lock:
            ensure_session = key not in self._session_cache
            if ensure_session:
                self._session_cache.add(key)

        if ensure_session:
            payload = {
                "agentId": self.agent_id,
                "sessionIdentifier": identifier,
            }
            if tenant_payload:
                payload["tenantId"] = tenant_payload
            try:
                self._client.post(
                    f"{self._base_url}{self.session_path}",
                    json=payload,
                )
            except httpx.HTTPError as error:
                LOGGER.debug("Failed to upsert CopilotKit session: %s", error)

        message_payload = {
            "agentId": self.agent_id,
            "sessionIdentifier": identifier,
            "role": role,
            "content": content,
        }
        if tenant_payload:
            message_payload["tenantId"] = tenant_payload
        if metadata:
            message_payload["metadata"] = metadata
        if mission_id and _looks_like_uuid(mission_id):
            message_payload["missionId"] = mission_id
        if payload_type:
            message_payload["payloadType"] = payload_type
        if latency_ms is not None:
            try:
                message_payload["latencyMs"] = max(int(latency_ms), 0)
            except (TypeError, ValueError):  # pragma: no cover - defensive cast
                pass
        if telemetry_event_ids:
            message_payload["telemetryEventIds"] = telemetry_event_ids

        try:
            response = self._client.post(
                f"{self._base_url}{self.message_path}",
                json=message_payload,
            )
            response.raise_for_status()
        except httpx.HTTPError as error:
            LOGGER.debug("Failed to emit CopilotKit message: %s", error)

    def emit_exit(
        self,
        *,
        tenant_id: Optional[str],
        session_identifier: str,
        reason: Optional[str] = None,
        mission_status: Optional[str] = None,
        stage: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        exit_reason = (reason or mission_status or "completed").strip() or "completed"
        merged_metadata: Dict[str, Any] = {
            "event": "copilotkit_exit",
            "reason": exit_reason,
        }
        if mission_status:
            merged_metadata["mission_status"] = mission_status
        if stage:
            merged_metadata["stage"] = stage
        if metadata:
            merged_metadata.update(metadata)

        self.emit_message(
            tenant_id=tenant_id,
            session_identifier=session_identifier,
            role="system",
            content=f"Session exited: {exit_reason}",
            metadata=merged_metadata,
            mission_id=session_identifier if _looks_like_uuid(session_identifier) else None,
            payload_type="exit",
        )

    def emit_stage(
        self,
        *,
        tenant_id: Optional[str],
        session_identifier: str,
        stage: str,
        event: str,
        content: str,
        mission_id: Optional[str] = None,
        mission_status: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Emit a structured lifecycle stage message with consistent metadata schema.

        Args:
            tenant_id: Tenant identifier (must be UUID or None)
            session_identifier: Session or mission identifier
            stage: Timeline stage identifier (e.g., "planner_stage_started")
            event: Event type (e.g., "stage_started", "status_update", "rank_complete")
            content: Human-readable message content
            mission_id: Optional mission identifier
            mission_status: Optional mission status (e.g., "in_progress", "completed")
            metadata: Additional metadata fields to merge
        """
        merged_metadata: Dict[str, Any] = {
            "stage": stage,
            "event": event,
        }
        if mission_id:
            merged_metadata["mission_id"] = mission_id
        if tenant_id:
            merged_metadata["tenant_id"] = tenant_id
        if mission_status:
            merged_metadata["mission_status"] = mission_status
        if metadata:
            merged_metadata.update(metadata)

        self.emit_message(
            tenant_id=tenant_id,
            session_identifier=session_identifier,
            role="assistant",
            content=content,
            metadata=merged_metadata,
            mission_id=mission_id,
            payload_type="stage_update",
        )

    def close(self) -> None:
        try:
            self._client.close()
        except Exception:  # pragma: no cover - defensive close
            pass
