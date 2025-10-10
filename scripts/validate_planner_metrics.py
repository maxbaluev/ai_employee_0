#!/usr/bin/env python3
"""Validate planner telemetry against Gate G-B thresholds."""

from __future__ import annotations

import argparse
import json
import logging
import os
import statistics
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
LOGGER = logging.getLogger(__name__)

LATENCY_P95_THRESHOLD_MS = 2_500
SIMILARITY_AVG_THRESHOLD = 0.62
MIN_CANDIDATE_COUNT = 1


class SupabaseClient:
    """Minimal REST wrapper for planner_runs validation."""

    def __init__(self, url: str, api_key: str) -> None:
        self._rest_url = f"{url.rstrip('/')}/rest/v1"
        self._api_key = api_key

    @classmethod
    def from_env(cls) -> "SupabaseClient":
        url = (
            os.getenv("SUPABASE_URL")
            or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
            or os.getenv("SUPABASE_PROJECT_URL")
        )
        key = (
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            or os.getenv("SUPABASE_SERVICE_KEY")
            or os.getenv("SUPABASE_ANON_KEY")
        )
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured")
        return cls(url, key)

    def fetch_planner_runs(self, *, limit: int = 100) -> List[Dict[str, Any]]:
        params = urllib.parse.urlencode({"order": "created_at.desc", "limit": str(limit)})
        request = urllib.request.Request(
            f"{self._rest_url}/planner_runs?{params}",
            method="GET",
            headers={
                "apikey": self._api_key,
                "Authorization": f"Bearer {self._api_key}",
                "Cache-Control": "no-cache",
            },  q 
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                payload = response.read().decode("utf-8")
                rows = json.loads(payload) if payload else []
                LOGGER.info("Fetched %d planner_runs rows", len(rows))
                return rows if isinstance(rows, list) else []
        except urllib.error.HTTPError as exc:  # pragma: no cover - network path
            detail = exc.read().decode("utf-8") if exc.fp else exc.reason
            LOGGER.error("Supabase HTTP %s: %s", exc.code, detail)
        except Exception as exc:  # pragma: no cover - defensive
            LOGGER.error("Supabase request failed: %s", exc)
        return []


def compute_p95(values: List[float]) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return float(values[0])
    try:
        return statistics.quantiles(values, n=100, method="inclusive")[94]
    except Exception:  # pragma: no cover - statistics fallback
        sorted_values = sorted(values)
        index = int(0.95 * (len(sorted_values) - 1))
        return float(sorted_values[index])


def compute_p95(values: List[float]) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return float(values[0])
    try:
        return statistics.quantiles(values, n=100, method="inclusive")[94]
    except Exception:  # pragma: no cover - statistics fallback
        sorted_values = sorted(values)
        index = int(0.95 * (len(sorted_values) - 1))
        return float(sorted_values[index])
