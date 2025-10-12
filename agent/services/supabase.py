"""Thin Supabase REST helper for the Gate G-B control plane."""

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


class CatalogUnavailableError(RuntimeError):
    """Raised when Supabase catalog data cannot be retrieved."""


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
            raise CatalogUnavailableError("Supabase client unavailable for safeguards fetch")

        params = {
            "mission_id": f"eq.{mission_id}",
            "order": "updated_at.desc",
            "limit": str(limit),
        }
        rows = self._request("GET", "/mission_safeguards", params=params)
        if isinstance(rows, list) and rows:
            return rows
        raise CatalogUnavailableError("No safeguards available for mission")

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
            raise CatalogUnavailableError("Supabase client unavailable for library search")

        embedding = self._fake_embedding(" ".join([objective, audience] + list(guardrails)))
        payload = {
            "query_embedding": embedding,
            "match_count": limit,
        }
        rows = self._request("POST", "/rpc/match_library_entries", body=payload)
        if not isinstance(rows, list) or not rows:
            raise CatalogUnavailableError("No matching library embeddings returned")

        identifiers = [row.get("id") for row in rows if row.get("id")]
        if not identifiers:
            raise CatalogUnavailableError("Library embeddings returned without identifiers")

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
            raise CatalogUnavailableError("Library catalog returned no entries")

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

    def fetch_latest_inspection_finding(
        self,
        *,
        mission_id: str,
        tenant_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Return the most recent inspection finding for a mission."""

        if not self.enabled:
            return None
        if not self._is_uuid(mission_id) or not self._is_uuid(tenant_id):
            return None

        params = {
            "mission_id": f"eq.{mission_id}",
            "tenant_id": f"eq.{tenant_id}",
            "order": "created_at.desc",
            "limit": "1",
        }

        rows = self._request("GET", "/inspection_findings", params=params)
        if isinstance(rows, list) and rows:
            candidate = rows[0]
            if isinstance(candidate, dict):
                return candidate
        return None

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

    def upload_storage_object(
        self,
        bucket: str,
        path: str,
        data: bytes,
        *,
        content_type: str = "application/octet-stream",
    ) -> Optional[str]:
        """Upload raw bytes to Supabase Storage; returns object path when successful."""

        digest = hashlib.sha256(data).hexdigest()
        if not bucket or not path or not self.api_key:
            return None
        offline_record = {"bucket": bucket, "path": path, "digest": digest}

        if not self.enabled or not self.allow_writes:
            self._buffer_offline(f"storage:{bucket}", [offline_record])
            return None

        object_url = f"{self.url}/storage/v1/object/{bucket}/{urllib.parse.quote(path)}"
        request = urllib.request.Request(object_url, method="PUT", data=data)
        request.add_header("Authorization", f"Bearer {self.api_key}")
        request.add_header("apikey", self.api_key)
        request.add_header("Content-Type", content_type)
        request.add_header("x-upsert", "true")

        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                if response.status not in (200, 201, 204):
                    raise urllib.error.HTTPError(
                        object_url,
                        response.status,
                        response.read(),
                        response.headers,
                        None,
                    )
            return path
        except urllib.error.HTTPError as error:
            LOGGER.warning(
                "Supabase storage upload failed (%s): %s",
                error.code,
                error.read().decode("utf-8", errors="ignore") if error.fp else error.reason,
            )
        except Exception as exc:  # pragma: no cover - defensive fallback
            LOGGER.warning("Supabase storage upload error: %s", exc)

        self._buffer_offline(f"storage:{bucket}", [offline_record])
        return None

    def insert_event(self, event: Dict[str, Any]) -> None:
        tenant_id = event.get("tenant_id")
        mission_id = event.get("mission_id")
        if not self._is_uuid(tenant_id) or not self._is_uuid(mission_id):
            self._buffer_offline("mission_events", [event])
            return
        self._write("mission_events", [event])

    def insert_planner_run(self, run: Dict[str, Any]) -> None:
        payload = {key: value for key, value in (run or {}).items() if value is not None}
        if not payload:
            return

        tenant_id = payload.get("tenant_id")
        mission_id = payload.get("mission_id")
        if not self._is_uuid(tenant_id) or not self._is_uuid(mission_id):
            self._buffer_offline("planner_runs", [payload])
            return

        metadata = dict(payload.get("metadata") or {})
        for key in (
            "latency_breakdown",
            "hybrid_score_avg",
            "composio_score_avg",
            "palette_catalog_size",
        ):
            if key in payload:
                metadata[key] = payload.pop(key)

        if metadata:
            payload["metadata"] = metadata

        self._write("planner_runs", [payload])

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
        raise CatalogUnavailableError("Supabase library fallback is not supported")

    @staticmethod
    def _fallback_safeguards(mission_id: str) -> List[Dict[str, Any]]:
        raise CatalogUnavailableError("Supabase safeguard fallback is not supported")
