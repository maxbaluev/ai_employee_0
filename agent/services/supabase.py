"""Thin Supabase REST helper for the Gate G-A control plane."""

from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Iterable, List, Optional


LOGGER = logging.getLogger(__name__)


class SupabaseClient:
    """Minimal REST wrapper with graceful degradation when unset."""

    def __init__(self, url: Optional[str], api_key: Optional[str]) -> None:
        self.url = url.rstrip("/") if url else None
        self.api_key = api_key
        self.enabled = bool(self.url and self.api_key)
        self._rest_url = f"{self.url}/rest/v1" if self.enabled else None
        self._offline_buffer: Dict[str, List[Dict[str, Any]]] = {}

        if not self.enabled:
            LOGGER.info("SupabaseClient initialised in offline mode")

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
        if not self.enabled:
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

    def upsert_plays(self, plays: Iterable[Dict[str, Any]]) -> None:
        payload = [row for row in plays if row]
        if not payload:
            return
        self._write("plays", payload, prefer="resolution=merge-duplicates")

    def insert_safeguard_event(self, event: Dict[str, Any]) -> None:
        self._write("safeguard_events", [event])

    def insert_artifacts(self, artifacts: Iterable[Dict[str, Any]]) -> None:
        payload = [row for row in artifacts if row]
        if not payload:
            return
        self._write("artifacts", payload)

    def insert_tool_calls(self, calls: Iterable[Dict[str, Any]]) -> None:
        payload = [row for row in calls if row]
        if not payload:
            return
        self._write("tool_calls", payload)

    def insert_event(self, event: Dict[str, Any]) -> None:
        self._write("mission_events", [event])

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
        if not self.enabled:
            # Offline fallback: buffer the payload for inspection.
            self._offline_buffer.setdefault(table, []).extend(payload)
            LOGGER.debug("Supabase offline write: table=%s rows=%d", table, len(payload))
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
        except Exception as exc:  # pragma: no cover - defensive
            LOGGER.debug("Supabase request error (%s): %s", path, exc)
        return None

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

