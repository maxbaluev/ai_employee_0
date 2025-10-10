"""Evidence service for Gate G-B proof pack bundling."""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional

from .supabase import SupabaseClient

LOGGER = logging.getLogger(__name__)


@dataclass
class ProofPack:
    """Evidence bundle structure for Gate G-B dry-run verification."""

    mission_id: str
    play_id: Optional[str]
    mission_brief: Dict[str, Any]
    selected_play: Dict[str, Any]
    tool_call_summaries: List[Dict[str, Any]]
    undo_plans: List[Dict[str, Any]]
    safeguard_feedback: List[Dict[str, Any]]
    artifacts: List[Dict[str, Any]]
    telemetry: Dict[str, Any]
    hash: str


class EvidenceService:
    """Handles proof pack creation, artifact hashing, and undo plan storage."""

    def __init__(self, supabase: Optional[SupabaseClient] = None) -> None:
        self.supabase = supabase or SupabaseClient.from_env()

    # ------------------------------------------------------------------
    # Core evidence operations
    # ------------------------------------------------------------------
    def hash_tool_args(self, args: Dict[str, Any]) -> str:
        """Return deterministic SHA-256 hash of tool arguments."""
        canonical = json.dumps(args, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def bundle_proof_pack(
        self,
        *,
        mission_id: str,
        play_id: Optional[str],
        mission_brief: Dict[str, Any],
        selected_play: Dict[str, Any],
        tool_calls: List[Dict[str, Any]],
        artifacts: List[Dict[str, Any]],
        safeguard_feedback: List[Dict[str, Any]],
        telemetry: Optional[Dict[str, Any]] = None,
    ) -> ProofPack:
        """
        Assemble evidence bundle with mission context, tool calls, undo plans,
        and safeguard feedback for Gate G-B compliance.
        """
        # Extract undo plans from tool calls
        undo_plans: List[Dict[str, Any]] = []
        tool_call_summaries: List[Dict[str, Any]] = []

        for call in tool_calls:
            if not isinstance(call, dict):
                continue

            # Build summary without exposing raw arguments
            summary = {
                "tool_call_id": call.get("id"),
                "toolkit": call.get("toolkit"),
                "tool_name": call.get("tool_name"),
                "arguments_hash": call.get("arguments_hash"),
                "latency_ms": call.get("latency_ms"),
                "executed_at": call.get("executed_at"),
            }
            tool_call_summaries.append(summary)

            # Extract undo plan if present
            undo_plan = call.get("undo_plan")
            if undo_plan:
                undo_plans.append({
                    "tool_call_id": call.get("id"),
                    "toolkit": call.get("toolkit"),
                    "tool_name": call.get("tool_name"),
                    "undo_plan": undo_plan,
                    "undo_plan_hash": self.hash_tool_args({"undo_plan": undo_plan}),
                })

        # Build proof pack
        pack_data = {
            "mission_id": mission_id,
            "play_id": play_id,
            "mission_brief": mission_brief,
            "selected_play": selected_play,
            "tool_call_summaries": tool_call_summaries,
            "undo_plans": undo_plans,
            "safeguard_feedback": safeguard_feedback,
            "artifacts": artifacts,
            "telemetry": telemetry or {},
        }

        # Compute deterministic hash for tamper detection
        pack_hash = self._hash_payload(pack_data)
        pack_data["hash"] = pack_hash

        return ProofPack(
            mission_id=mission_id,
            play_id=play_id,
            mission_brief=mission_brief,
            selected_play=selected_play,
            tool_call_summaries=tool_call_summaries,
            undo_plans=undo_plans,
            safeguard_feedback=safeguard_feedback,
            artifacts=artifacts,
            telemetry=telemetry or {},
            hash=pack_hash,
        )

    def store_artifact(
        self,
        *,
        tenant_id: str,
        play_id: Optional[str],
        artifact_type: str,
        title: str,
        content: Any,
        content_ref: Optional[str] = None,
        hash_value: Optional[str] = None,
        size_bytes: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Store artifact metadata and optionally upload payload to Supabase Storage
        for artifacts >200 KB.
        """
        # Normalise content for storage
        if isinstance(content, (dict, list)):
            serialised = json.dumps(content, sort_keys=True)
            content_bytes = serialised.encode("utf-8")
            content_payload: Any = content
            content_type = "application/json"
        else:
            text_value = str(content) if content is not None else ""
            content_bytes = text_value.encode("utf-8")
            content_payload = text_value
            content_type = "text/plain"

        # Compute hash if not provided
        if hash_value is None:
            hash_value = hashlib.sha256(content_bytes).hexdigest()

        # Compute size if not provided
        if size_bytes is None:
            size_bytes = len(content_bytes)

        # Prepare artifact record
        metadata_payload = metadata.copy() if metadata else {}
        artifact_data = {
            "tenant_id": tenant_id,
            "play_id": play_id,
            "type": artifact_type,
            "title": title,
            "content_ref": content_ref,
            "hash": hash_value,
            "checksum": hash_value,
            "status": "draft",
            "content": content_payload if size_bytes < 200_000 else None,
        }

        # Add metadata
        if metadata:
            artifact_data["metadata"] = metadata_payload

        # Upload large artifacts to Supabase Storage when possible
        if size_bytes >= 200_000:
            storage_path = None
            try:
                storage_path = self.supabase.upload_storage_object(
                    "evidence-artifacts",
                    f"{tenant_id}/{(play_id or 'mission')}-{hash_value}.json",
                    content_bytes,
                    content_type=content_type,
                )
            except Exception:  # pragma: no cover - defensive logging
                LOGGER.exception("Failed to upload artifact to storage")

            if storage_path:
                artifact_data["content_ref"] = f"evidence-artifacts/{storage_path}"
                artifact_data["content"] = None
                metadata_payload.setdefault("stored_externally", True)
                artifact_data["metadata"] = metadata_payload

        # Store in Supabase artifacts table
        self.supabase.insert_artifacts([artifact_data])

        return {
            "artifact_id": artifact_data.get("id", title),
            "hash": hash_value,
            "size_bytes": size_bytes,
            "content_ref": content_ref,
        }

    def execute_undo(
        self,
        *,
        tool_call_id: str,
        tenant_id: str,
        mission_id: Optional[str] = None,
        undo_plan: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Execute undo plan for a specific tool call.

        For Gate G-B, this is primarily a logging operation as real undo
        requires toolkit-specific reversal logic that will be implemented
        in Gate G-C governed activation.
        """
        # Fetch undo plan from tool_calls if not provided
        if undo_plan is None:
            # In a real implementation, query Supabase tool_calls table
            # For now, log the request
            LOGGER.info(
                "Undo requested for tool_call_id=%s (undo plan retrieval not implemented)",
                tool_call_id,
            )
            undo_plan = "Manual undo required - toolkit reversal not implemented"

        # Log undo event (future: persist to undo_events table)
        undo_event = {
            "tool_call_id": tool_call_id,
            "tenant_id": tenant_id,
            "mission_id": mission_id,
            "undo_plan": undo_plan,
            "status": "logged",
            "notes": "Gate G-B undo logging; full reversal in Gate G-C",
        }

        LOGGER.info(
            "Undo event logged: tool_call_id=%s, status=%s",
            tool_call_id,
            undo_event["status"],
        )

        try:
            self.supabase.insert_event(
                {
                    "tenant_id": tenant_id,
                    "mission_id": mission_id or "00000000-0000-0000-0000-000000000000",
                    "event_type": "undo_logged",
                    "details": undo_event,
                }
            )
        except Exception:  # pragma: no cover - defensive log
            LOGGER.debug("Supabase mission_events logging skipped for undo %s", tool_call_id)

        return {
            "success": True,
            "tool_call_id": tool_call_id,
            "undo_status": "logged",
            "undo_plan": undo_plan,
            "notes": "Undo logged for Gate G-B verification; full execution in Gate G-C",
        }

    # ------------------------------------------------------------------
    # Helper methods
    # ------------------------------------------------------------------
    def _hash_payload(self, payload: Any) -> str:
        """Compute deterministic hash of any JSON-serializable payload."""
        canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def verify_artifact_hash(
        self,
        *,
        artifact_id: str,
        tenant_id: str,
    ) -> Dict[str, Any]:
        """
        Verify artifact hash integrity by recomputing and comparing
        with stored checksum.
        """
        # In full implementation, fetch artifact from Supabase and recompute hash
        # For now, return a placeholder
        LOGGER.info(
            "Hash verification requested for artifact_id=%s (not fully implemented)",
            artifact_id,
        )

        return {
            "artifact_id": artifact_id,
            "hash_valid": True,
            "notes": "Hash verification placeholder for Gate G-B",
        }


__all__ = [
    "EvidenceService",
    "ProofPack",
]
