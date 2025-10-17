"""Supabase service wrapper scaffolding.

This layer keeps the Supabase SDK surface isolated from agents so we can
iterate safely. Real integration will use `supabase==2.22.0`; see
`docs/12_service_architecture.md` for the migration plan.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from inspect import isawaitable
from typing import Any
from uuid import uuid4


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
        """Log granted OAuth scopes to mission_connections table."""

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
            "created_at": datetime.now(timezone.utc).isoformat(),
            "metadata": metadata or {},
        }

        result = insert_method(payload)
        execute_method = getattr(result, "execute", None)
        if execute_method is not None:
            result = execute_method()
        if isawaitable(result):
            result = await result

        return payload

    async def upsert_mission_metadata(
        self,
        *,
        mission_id: str,
        metadata_key: str,
        metadata_value: dict[str, Any],
        source_stage: str | None = None,
    ) -> dict[str, Any]:
        """Upsert mission metadata to mission_metadata table."""

        if self.client is None:
            raise RuntimeError("Supabase client not configured")

        table = getattr(self.client, "table", None)
        if table is None:
            raise AttributeError("Supabase client missing table method")

        metadata_table = table("mission_metadata")
        upsert_method = getattr(metadata_table, "upsert", None)
        if upsert_method is None:
            raise AttributeError("Supabase table missing upsert method")

        payload = {
            "mission_id": mission_id,
            "metadata_key": metadata_key,
            "metadata_value": metadata_value,
            "source_stage": source_stage,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        result = upsert_method(payload, on_conflict="mission_id,metadata_key")
        execute_method = getattr(result, "execute", None)
        if execute_method is not None:
            result = execute_method()
        if isawaitable(result):
            result = await result

        return payload

    async def insert_mission_safeguard(
        self,
        *,
        mission_id: str,
        category: str,
        description: str,
        severity: str = "medium",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Insert mission safeguard to mission_safeguards table."""

        if self.client is None:
            raise RuntimeError("Supabase client not configured")

        table = getattr(self.client, "table", None)
        if table is None:
            raise AttributeError("Supabase client missing table method")

        safeguards_table = table("mission_safeguards")
        insert_method = getattr(safeguards_table, "insert", None)
        if insert_method is None:
            raise AttributeError("Supabase table missing insert method")

        payload = {
            "mission_id": mission_id,
            "category": category,
            "description": description,
            "severity": severity,
            "enforced": False,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        result = insert_method(payload)
        execute_method = getattr(result, "execute", None)
        if execute_method is not None:
            result = execute_method()
        if isawaitable(result):
            result = await result

        return payload

    async def log_data_inspection_check(
        self,
        *,
        mission_id: str,
        toolkit_slug: str,
        coverage_percent: float | None = None,
        sample_count: int | None = None,
        pii_flags: dict[str, Any] | None = None,
        outcome: str = "pass",
        details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Persist inspection preview metadata to data_inspection_checks."""

        if self.client is None:
            raise RuntimeError("Supabase client not configured")

        table = getattr(self.client, "table", None)
        if table is None:
            raise AttributeError("Supabase client missing table method")

        inspection_table = table("data_inspection_checks")
        insert_method = getattr(inspection_table, "insert", None)
        if insert_method is None:
            raise AttributeError("Supabase table missing insert method")

        payload = {
            "mission_id": mission_id,
            "toolkit_slug": toolkit_slug,
            "coverage_percent": coverage_percent,
            "sample_count": sample_count,
            "pii_flags": pii_flags,
            "outcome": outcome,
            "details": details or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        result = insert_method(payload)
        execute_method = getattr(result, "execute", None)
        if execute_method is not None:
            result = execute_method()
        if isawaitable(result):
            result = await result

        return payload

    async def update_mission_stage_status(
        self,
        *,
        mission_id: str,
        stage: str,
        status: str = "in_progress",
        readiness_state: str | None = None,
        coverage_percent: float | None = None,
        blocking_reason: str | None = None,
        metrics: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Upsert mission stage status row for Coordinator visibility."""

        if self.client is None:
            raise RuntimeError("Supabase client not configured")

        table = getattr(self.client, "table", None)
        if table is None:
            raise AttributeError("Supabase client missing table method")

        stage_status_table = table("mission_stage_status")
        upsert_method = getattr(stage_status_table, "upsert", None)
        if upsert_method is None:
            raise AttributeError("Supabase table missing upsert method")

        payload: dict[str, Any] = {
            "mission_id": mission_id,
            "stage": stage,
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        if readiness_state is not None:
            payload["readiness_state"] = readiness_state
        if coverage_percent is not None:
            payload["coverage_percent"] = coverage_percent
        if blocking_reason is not None:
            payload["blocking_reason"] = blocking_reason
        if metrics is not None:
            payload["metrics"] = metrics

        result = upsert_method(payload)
        execute_method = getattr(result, "execute", None)
        if execute_method is not None:
            result = execute_method()
        if isawaitable(result):
            result = await result

        return payload

    async def search_library_precedents(
        self,
        *,
        mission_brief: dict[str, Any],
        limit: int = 5,
        similarity_threshold: float = 0.25,
    ) -> list[dict[str, Any]]:
        """Retrieve precedent missions ordered by relevance to the brief."""

        if self.client is None:
            raise RuntimeError("Supabase client not configured")

        objective = mission_brief.get("objective", "")

        rpc_method = getattr(self.client, "rpc", None)
        if callable(rpc_method):
            try:
                result = rpc_method(
                    "search_library_precedents",
                    {
                        "p_objective": objective,
                        "p_similarity_threshold": similarity_threshold,
                        "p_limit": limit,
                    },
                )
                execute_method = getattr(result, "execute", None)
                if execute_method:
                    result = execute_method()
                if isawaitable(result):
                    result = await result
                data = getattr(result, "data", result) if hasattr(result, "data") else result
                if isinstance(data, list):
                    return data
            except Exception:
                # Fall back to table scan below
                pass

        table_method = getattr(self.client, "table", None)
        if table_method is None:
            return []

        library_table = table_method("library_entries")
        select_method = getattr(library_table, "select", None)
        if select_method is None:
            return []

        query = select_method("*")
        order_method = getattr(query, "order", None)
        if order_method is not None:
            query = order_method("reuse_count", desc=True)
        limit_method = getattr(query, "limit", None)
        if limit_method is not None:
            query = limit_method(limit)

        execute_method = getattr(query, "execute", None)
        result = execute_method() if execute_method else query
        if isawaitable(result):
            result = await result

        data = getattr(result, "data", result) if hasattr(result, "data") else result
        return list(data) if isinstance(data, list) else []

    async def upsert_mission_play(
        self,
        *,
        mission_id: str,
        play_identifier: str,
        title: str,
        description: str | None = None,
        confidence: float | None = None,
        ranking: int | None = None,
        selected: bool = False,
        undo_plan_id: str | None = None,
        generated_by: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Upsert mission play to mission_plays table."""

        if self.client is None:
            raise RuntimeError("Supabase client not configured")

        table = getattr(self.client, "table", None)
        if table is None:
            raise AttributeError("Supabase client missing table method")

        plays_table = table("mission_plays")
        upsert_method = getattr(plays_table, "upsert", None)
        if upsert_method is None:
            raise AttributeError("Supabase table missing upsert method")

        payload: dict[str, Any] = {
            "mission_id": mission_id,
            "play_identifier": play_identifier,
            "title": title,
            "description": description,
            "confidence": confidence,
            "ranking": ranking,
            "selected": selected,
            "undo_plan_id": undo_plan_id,
            "generated_by": generated_by,
            "metadata": metadata or {},
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        result = upsert_method(payload, on_conflict="mission_id,play_identifier")
        execute_method = getattr(result, "execute", None)
        if execute_method is not None:
            result = execute_method()
        if isawaitable(result):
            result = await result

        return payload

    async def insert_mission_undo_plan(
        self,
        *,
        mission_id: str,
        plan_label: str,
        impact_summary: str | None = None,
        risk_assessment: str | None = None,
        steps: list[dict[str, Any]] | None = None,
        status: str = "draft",
    ) -> dict[str, Any]:
        """Insert undo plan to mission_undo_plans table."""

        if self.client is None:
            raise RuntimeError("Supabase client not configured")

        table = getattr(self.client, "table", None)
        if table is None:
            raise AttributeError("Supabase client missing table method")

        undo_plans_table = table("mission_undo_plans")
        insert_method = getattr(undo_plans_table, "insert", None)
        if insert_method is None:
            raise AttributeError("Supabase table missing insert method")

        payload = {
            "mission_id": mission_id,
            "plan_label": plan_label,
            "impact_summary": impact_summary,
            "risk_assessment": risk_assessment,
            "steps": steps or [],
            "status": status,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        result = insert_method(payload)
        execute_method = getattr(result, "execute", None)
        if execute_method is not None:
            result = execute_method()
        if isawaitable(result):
            result = await result

        data = getattr(result, "data", result) if hasattr(result, "data") else result
        if data and isinstance(data, list) and len(data) > 0:
            return data[0]
        return payload

    async def store_artifact(
        self,
        *,
        payload: dict[str, Any],
        raw_content: Any | None = None,
    ) -> dict[str, Any]:
        """Insert artifact metadata into mission_artifacts table."""

        if self.client is None:
            raise RuntimeError("Supabase client not configured")

        table = getattr(self.client, "table", None)
        if table is None:
            raise AttributeError("Supabase client missing table method")

        artifacts_table = table("mission_artifacts")
        insert_method = getattr(artifacts_table, "insert", None)
        if insert_method is None:
            raise AttributeError("Supabase table missing insert method")

        payload = dict(payload)
        payload.setdefault("id", str(uuid4()))
        metadata = payload.setdefault("metadata", {})
        if raw_content is not None and isinstance(metadata, dict):
            metadata.setdefault("preview_available", True)

        result = insert_method(payload)
        execute_method = getattr(result, "execute", None)
        if execute_method is not None:
            result = execute_method()
        if isawaitable(result):
            result = await result

        data = getattr(result, "data", result) if hasattr(result, "data") else result
        if isinstance(data, list) and data:
            return data[0]
        return payload

    async def store_evidence(self, *, bundle: dict[str, Any]) -> dict[str, Any]:
        """Insert evidence bundle metadata into mission_evidence table."""

        if self.client is None:
            raise RuntimeError("Supabase client not configured")

        table = getattr(self.client, "table", None)
        if table is None:
            raise AttributeError("Supabase client missing table method")

        evidence_table = table("mission_evidence")
        insert_method = getattr(evidence_table, "insert", None)
        if insert_method is None:
            raise AttributeError("Supabase table missing insert method")

        payload = dict(bundle)
        payload.setdefault("id", str(uuid4()))
        payload.setdefault("source_stage", payload.get("source_stage", "EXECUTE"))

        result = insert_method(payload)
        execute_method = getattr(result, "execute", None)
        if execute_method is not None:
            result = execute_method()
        if isawaitable(result):
            result = await result

        data = getattr(result, "data", result) if hasattr(result, "data") else result
        if isinstance(data, list) and data:
            return data[0]
        return payload

    async def fetch_feedback_rating(self, *, mission_id: str) -> float | None:
        """Return latest feedback rating for a mission."""

        if self.client is None:
            raise RuntimeError("Supabase client not configured")

        table = getattr(self.client, "table", None)
        if table is None:
            raise AttributeError("Supabase client missing table method")

        feedback_table = table("mission_feedback")
        select_method = getattr(feedback_table, "select", None)
        if select_method is None:
            raise AttributeError("Supabase table missing select method")

        query = select_method("rating")
        eq_method = getattr(query, "eq", None)
        if eq_method is not None:
            query = eq_method("mission_id", mission_id)
        order_method = getattr(query, "order", None)
        if order_method is not None:
            query = order_method("submitted_at", desc=True)
        limit_method = getattr(query, "limit", None)
        if limit_method is not None:
            query = limit_method(1)

        execute_method = getattr(query, "execute", None)
        result = execute_method() if execute_method else query
        if isawaitable(result):
            result = await result

        data = getattr(result, "data", result) if hasattr(result, "data") else result
        if isinstance(data, list) and data:
            rating = data[0].get("rating")
            return float(rating) if rating is not None else None
        return None

    async def store_library_contribution(
        self,
        *,
        mission_id: str,
        contribution: dict[str, Any],
    ) -> dict[str, Any]:
        """Insert contribution suggestion into library_entries table."""

        if self.client is None:
            raise RuntimeError("Supabase client not configured")

        table = getattr(self.client, "table", None)
        if table is None:
            raise AttributeError("Supabase client missing table method")

        library_table = table("library_entries")
        insert_method = getattr(library_table, "insert", None)
        if insert_method is None:
            raise AttributeError("Supabase table missing insert method")

        payload = dict(contribution)
        payload.setdefault("id", str(uuid4()))
        payload.setdefault("mission_id", mission_id)
        payload.setdefault("created_at", datetime.now(timezone.utc).isoformat())

        result = insert_method(payload)
        execute_method = getattr(result, "execute", None)
        if execute_method is not None:
            result = execute_method()
        if isawaitable(result):
            result = await result

        data = getattr(result, "data", result) if hasattr(result, "data") else result
        if isinstance(data, list) and data:
            return data[0]
        return payload


__all__ = ["SupabaseClientWrapper"]
