"""Execution API request/response schemas for FastAPI validation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict
from uuid import UUID


@dataclass(slots=True)
class ExecutionRequest:
    """Execution request from frontend route."""

    mission_id: str
    play_id: str
    auth_context: Dict[str, str]

    def __post_init__(self) -> None:
        # Validate UUIDs
        try:
            UUID(self.mission_id)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"mission_id must be a valid UUID: {self.mission_id}") from exc

        try:
            UUID(self.play_id)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"play_id must be a valid UUID: {self.play_id}") from exc

        # Validate auth_context
        if not isinstance(self.auth_context, dict):
            raise ValueError("auth_context must be a dict")

        required_keys = {"user_id", "tenant_id"}
        missing = required_keys - set(self.auth_context.keys())
        if missing:
            raise ValueError(f"auth_context missing required keys: {missing}")

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "ExecutionRequest":
        """Create ExecutionRequest from API payload."""
        return cls(
            mission_id=str(payload["mission_id"]),
            play_id=str(payload["play_id"]),
            auth_context=dict(payload.get("auth_context", {})),
        )


__all__ = ["ExecutionRequest"]
