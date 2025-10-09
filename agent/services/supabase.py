"""Thin Supabase REST helper for the Gate G-A control plane."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import random
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from typing import Any, Dict, Iterable, List, Optional, Sequence


LOGGER = logging.getLogger(__name__)


class SupabaseClient:
    """Minimal REST wrapper with graceful degradation when unset."""

    def __init__(self, url: Optional[str], api_key: Optional[str]) -> None:
        self.url = url.rstrip("/") if url else None
        self.api_key = api_key
        self.enabled = bool(self.url and self.api_key)
        self._rest_url = f"{self.url}/rest/v1" if self.enabled else None
        self._offline_buffer: Dict[str, List[Dict[str, Any]]] = {}
        self._degraded = False
        self.allow_writes = (
            os.getenv("SUPABASE_ALLOW_WRITES", "false").lower() in {"1", "true", "yes"}
        )

        if not self.enabled:
            LOGGER.info("SupabaseClient initialised in offline mode")
        elif not self.allow_writes:
            LOGGER.info("SupabaseClient writes disabled; operating in read-only mode")

    # ------------------------------------------------------------------
    # Constructors
    # ------------------------------------------------------------------
    @classmethod
    def from_env(cls) -> "SupabaseClient":
        url = (
            os.getenv("SUPABASE_URL")
            or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
            or os.getenv("SUPABASE_PROJECT_URL")
        )
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv(
            "SUPABASE_SERVICE_KEY"
        ) or os.getenv("SUPABASE_ANON_KEY")
        return cls(url, key)

    # ------------------------------------------------------------------
    # Public helpers
    # ------------------------------------------------------------------
    def fetch_safeguards(
        self,
        *,
        mission_id: str,
        tenant_id: str,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        if not self.enabled or not self._is_uuid(mission_id) or not self._is_uuid(tenant_id):
            return self._fallback_safeguards(mission_id)

        params = {
            "mission_id": f"eq.{mission_id}",
            "order": "updated_at.desc",
            "limit": str(limit),
        }
        rows = self._request("GET", "/mission_safeguards", params=params)
        if isinstance(rows, list):
            return rows
        return self._fallback_safeguards(mission_id)

    def search_library_plays(
        self,
        *,
        tenant_id: str,
        mission_id: str,
        objective: str,
        audience: str,
        guardrails: Sequence[str],
        limit: int = 3,
    ) -> List[Dict[str, Any]]:
        """Return candidate library plays ranked by similarity to the mission."""

        persona_hint = audience.lower()
        if not self.enabled or not self._is_uuid(tenant_id) or not self._is_uuid(mission_id):
            return self._fallback_library_plays(persona_hint, limit)

        embedding = self._fake_embedding(" ".join([objective, audience] + list(guardrails)))
        payload = {
            "query_embedding": embedding,
            "match_count": limit,
        }
        rows = self._request("POST", "/rpc/match_library_entries", body=payload)
        if not isinstance(rows, list):
            return self._fallback_library_plays(persona_hint, limit)

        identifiers = [row.get("id") for row in rows if row.get("id")]
        if not identifiers:
            return self._fallback_library_plays(persona_hint, limit)

        similarity = {
            str(row.get("id")): float(row.get("similarity", 0.0))
            for row in rows
            if row.get("id") is not None
        }

        quoted_ids = ",".join(f"\"{identifier}\"" for identifier in identifiers)
        params = {
            "id": f"in.({quoted_ids})",
            "order": "created_at.desc",
            "limit": str(limit),
        }
        if tenant_id:
            params["tenant_id"] = f"eq.{tenant_id}"

        plays = self._request("GET", "/library_entries", params=params)
        if not isinstance(plays, list) or not plays:
            return self._fallback_library_plays(persona_hint, limit)

        ranked = sorted(
            plays,
            key=lambda row: similarity.get(str(row.get("id")), 0.0),
            reverse=True,
        )
        for row in ranked:
            row.setdefault("metadata", {})
            row["_similarity"] = similarity.get(str(row.get("id")), 0.0)
        return ranked[:limit]

    def fetch_plays_by_mission(
        self,
        *,
        mission_id: str,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        if not self.enabled or not self._is_uuid(mission_id):
            return []

        params = {
            "objective_id": f"eq.{mission_id}",
            "order": "created_at.desc",
            "limit": str(limit),
        }
        rows = self._request("GET", "/plays", params=params)
        if isinstance(rows, list):
            return rows
        return []

    def upsert_plays(self, plays: Iterable[Dict[str, Any]]) -> None:
        payload = [row for row in plays if row]
        if not payload:
            return
        if not all(
            self._is_uuid(row.get("tenant_id")) and self._is_uuid(row.get("objective_id"))
            for row in payload
        ):
            self._buffer_offline("plays", payload)
            return
        self._write("plays", payload, prefer="resolution=merge-duplicates")

    def insert_safeguard_event(self, event: Dict[str, Any]) -> None:
        tenant_id = event.get("tenant_id")
        mission_id = event.get("mission_id")
        if not self._is_uuid(tenant_id) or not self._is_uuid(mission_id):
            self._buffer_offline("safeguard_events", [event])
            return
        self._write("safeguard_events", [event])

    def insert_artifacts(self, artifacts: Iterable[Dict[str, Any]]) -> None:
        payload = [row for row in artifacts if row]
        if not payload:
            return
        if not all(self._is_uuid(row.get("tenant_id")) for row in payload):
            self._buffer_offline("artifacts", payload)
            return
        if any(row.get("play_id") and not self._is_uuid(row.get("play_id")) for row in payload):
            self._buffer_offline("artifacts", payload)
            return
        self._write("artifacts", payload)

    def insert_tool_calls(self, calls: Iterable[Dict[str, Any]]) -> None:
        payload = [row for row in calls if row]
        if not payload:
            return
        if not all(self._is_uuid(row.get("tenant_id")) for row in payload):
            self._buffer_offline("tool_calls", payload)
            return
        if any(row.get("play_id") and not self._is_uuid(row.get("play_id")) for row in payload):
            self._buffer_offline("tool_calls", payload)
            return
        self._write("tool_calls", payload)

    def insert_event(self, event: Dict[str, Any]) -> None:
        tenant_id = event.get("tenant_id")
        mission_id = event.get("mission_id")
        if not self._is_uuid(tenant_id) or not self._is_uuid(mission_id):
            self._buffer_offline("mission_events", [event])
            return
        self._write("mission_events", [event])

    def upsert_copilot_session(self, session: Dict[str, Any]) -> None:
        payload = {key: value for key, value in session.items() if value is not None}
        if not payload:
            return
        tenant_id = payload.get("tenant_id")
        agent_id = payload.get("agent_id")
        session_identifier = payload.get("session_identifier")
        if not (self._is_uuid(tenant_id) and agent_id and session_identifier):
            self._buffer_offline("copilot_sessions", [payload])
            return
        self._write(
            "copilot_sessions",
            [payload],
            prefer="resolution=merge-duplicates",
        )

    def insert_copilot_messages(self, messages: Iterable[Dict[str, Any]]) -> None:
        payload = [row for row in messages if row]
        if not payload:
            return
        if not all(self._is_uuid(row.get("tenant_id")) for row in payload):
            self._buffer_offline("copilot_messages", payload)
            return
        if not all(self._is_uuid(row.get("session_id")) for row in payload):
            self._buffer_offline("copilot_messages", payload)
            return
        self._write("copilot_messages", payload)

    def last_offline_payload(self, table: str) -> List[Dict[str, Any]]:
        return self._offline_buffer.get(table, [])

    # ------------------------------------------------------------------
    # Internal I/O
    # ------------------------------------------------------------------
    def _write(
        self,
        table: str,
        payload: List[Dict[str, Any]],
        *,
        prefer: str = "return=minimal",
    ) -> None:
        if not payload:
            return
        if not self.enabled or self._degraded or not self.allow_writes:
            self._buffer_offline(table, payload)
            return

        headers = {"Prefer": prefer}
        self._request("POST", f"/{table}", body=payload, headers=headers)

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, str]] = None,
        body: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Any:
        if not self.enabled or not self._rest_url:
            return None

        url = f"{self._rest_url}{path}"
        if params:
            query = urllib.parse.urlencode(params, doseq=True)
            url = f"{url}?{query}"

        data: Optional[bytes] = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")

        request = urllib.request.Request(url, data=data, method=method)
        request.add_header("apikey", self.api_key)
        request.add_header("Authorization", f"Bearer {self.api_key}")
        request.add_header("Cache-Control", "no-cache")
        if data is not None:
            request.add_header("Content-Type", "application/json")
        if headers:
            for key, value in headers.items():
                request.add_header(key, value)

        try:
            with urllib.request.urlopen(request, timeout=6) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as exc:  # pragma: no cover - network
            detail = exc.read().decode("utf-8") if exc.fp else exc.reason
            LOGGER.warning("Supabase HTTP %s (%s): %s", exc.code, path, detail)
            self._degraded = True
        except Exception as exc:  # pragma: no cover - defensive
            LOGGER.debug("Supabase request error (%s): %s", path, exc)
            self._degraded = True
        return None

    def _buffer_offline(self, table: str, payload: List[Dict[str, Any]]) -> None:
        if not payload:
            return
        self._offline_buffer.setdefault(table, []).extend(payload)
        LOGGER.debug("Supabase offline buffer: table=%s rows=%d", table, len(payload))

    @staticmethod
    def _is_uuid(value: Any) -> bool:
        if value is None:
            return False
        try:
            uuid.UUID(str(value))
        except (ValueError, TypeError, AttributeError):
            return False
        return True

    @staticmethod
    def _fake_embedding(text: str, dimensions: int = 1536) -> List[float]:
        """Deterministic pseudo-embedding used when real models are unavailable."""

        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        seed = int(digest[:8], 16)
        rng = random.Random(seed)
        return [rng.uniform(-1.0, 1.0) for _ in range(dimensions)]

    @staticmethod
    def _fallback_library_plays(persona_hint: str, limit: int) -> List[Dict[str, Any]]:
        persona = persona_hint.lower()
        catalog = {
            "marketing": [
                {
                    "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "fallback-marketing-1")),
                    "title": "Campaign ROI Readout",
                    "description": "Summarise paid campaign performance and outline next experiments.",
                    "persona": "marketing",
                    "success_score": 0.82,
                    "metadata": {
                        "impact": "High",
                        "risk": "Low",
                        "undo_plan": "Rollback to previous campaign messaging",
                    },
                },
                {
                    "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "fallback-marketing-2")),
                    "title": "Launch Warmup Sequence",
                    "description": "Prep nurture emails and social cues for upcoming launch window.",
                    "persona": "marketing",
                    "success_score": 0.78,
                    "metadata": {
                        "impact": "Medium",
                        "risk": "Low",
                        "undo_plan": "Pause nurture flow and notify stakeholders",
                    },
                },
            ],
            "ops": [
                {
                    "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "fallback-ops-1")),
                    "title": "Revenue Ops Diagnostics",
                    "description": "Assess pipeline hygiene and Salesforce hygiene alerts.",
                    "persona": "revenue-ops",
                    "success_score": 0.8,
                    "metadata": {
                        "impact": "High",
                        "risk": "Moderate",
                        "undo_plan": "Restore previous field mappings",
                    },
                },
                {
                    "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "fallback-ops-2")),
                    "title": "Quarter Close Checklist",
                    "description": "Dry-run close plan covering approvals, discounting exceptions, and billing.",
                    "persona": "revenue-ops",
                    "success_score": 0.76,
                    "metadata": {
                        "impact": "Medium",
                        "risk": "Low",
                        "undo_plan": "Reinstate prior approval routing",
                    },
                },
            ],
            "sales": [
                {
                    "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "fallback-sales-1")),
                    "title": "Sales Play Calibration",
                    "description": "Draft outreach template and meeting agenda for warm enterprise prospects.",
                    "persona": "sales",
                    "success_score": 0.81,
                    "metadata": {
                        "impact": "High",
                        "risk": "Low",
                        "undo_plan": "Revert to previous messaging variant",
                    },
                },
                {
                    "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "fallback-sales-2")),
                    "title": "Executive Brief Prep",
                    "description": "Compile win themes, blockers, and ask ladder for exec sponsor sync.",
                    "persona": "sales",
                    "success_score": 0.73,
                    "metadata": {
                        "impact": "Medium",
                        "risk": "Moderate",
                        "undo_plan": "Share prior QBR deck instead",
                    },
                },
            ],
        }
        if "sales" in persona:
            bucket = catalog["sales"]
        elif "ops" in persona or "rev" in persona:
            bucket = catalog["ops"]
        elif "marketing" in persona:
            bucket = catalog["marketing"]
        else:
            bucket = catalog["marketing"] + catalog["ops"] + catalog["sales"]

        enriched: List[Dict[str, Any]] = []
        for index, item in enumerate(bucket[:limit]):
            clone = dict(item)
            clone.setdefault("metadata", {})
            clone.setdefault("_similarity", 0.65 - 0.05 * index)
            enriched.append(clone)
        return enriched

    @staticmethod
    def _fallback_safeguards(mission_id: str) -> List[Dict[str, Any]]:
        timestamp = int(time.time())
        return [
            {
                "mission_id": mission_id,
                "hint_type": "tone",
                "suggested_value": "Keep tone warm-professional",
                "status": "suggested",
                "confidence": 0.82,
                "updated_at": timestamp,
            },
            {
                "mission_id": mission_id,
                "hint_type": "quiet_window",
                "suggested_value": "Respect quiet hours 20:00-07:00 tenant local",
                "status": "suggested",
                "confidence": 0.74,
                "updated_at": timestamp,
            },
        ]
