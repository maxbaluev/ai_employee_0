#!/usr/bin/env python3
"""Verify Copilot message retention for Gate G-B."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from typing import Dict, List

from pathlib import Path
import importlib.util

# Load SupabaseClient without importing the entire agent package (avoids ADK FastAPI boot).
ROOT = Path(__file__).resolve().parents[1]
SUPABASE_MODULE_PATH = ROOT / "agent" / "services" / "supabase.py"
SPEC = importlib.util.spec_from_file_location("gate_supabase_client", SUPABASE_MODULE_PATH)
if SPEC is None or SPEC.loader is None:  # pragma: no cover - defensive
    raise RuntimeError("Unable to load Supabase client module")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)  # type: ignore[call-arg]
SupabaseClient = MODULE.SupabaseClient  # type: ignore[attr-defined]


def _build_params(
    *,
    table: str,
    cutoff: dt.datetime,
    tenant_id: str | None,
    limit: int,
) -> Dict[str, str]:
    params: Dict[str, str] = {
        "select": "id,created_at,soft_deleted_at,tenant_id",
        "created_at": f"lt.{cutoff.isoformat()}Z",
        "soft_deleted_at": "is.null",
        "order": "created_at.asc",
        "limit": str(limit),
    }
    if tenant_id:
        params["tenant_id"] = f"eq.{tenant_id}"
    return params


def _fetch_stale_rows(
    supabase: SupabaseClient,
    *,
    table: str,
    cutoff: dt.datetime,
    tenant_id: str | None,
    limit: int,
) -> List[Dict[str, object]]:
    params = _build_params(table=table, cutoff=cutoff, tenant_id=tenant_id, limit=limit)
    rows = supabase._request("GET", f"/{table}", params=params)  # type: ignore[attr-defined]
    if isinstance(rows, list):
        return rows
    return []


def _run_cleanup(supabase: SupabaseClient, ttl_days: int) -> None:
    payload = {"retention_days": ttl_days}
    response = supabase._request("POST", "/rpc/cleanup_copilot_messages", body=payload)  # type: ignore[attr-defined]
    if isinstance(response, dict) and "message" in response:
        print(response["message"])  # type: ignore[index]


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Check copilot message retention policy compliance.",
    )
    parser.add_argument(
        "--table",
        default="copilot_messages",
        help="Table to audit (defaults to copilot_messages)",
    )
    parser.add_argument(
        "--ttl-days",
        type=int,
        default=7,
        help="Retention window in days before soft delete should trigger",
    )
    parser.add_argument(
        "--tenant-id",
        help="Optional tenant UUID filter to scope the audit",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        help="Maximum number of stale rows to fetch for inspection",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit with non-zero status when stale rows are detected",
    )
    parser.add_argument(
        "--run-cleanup",
        action="store_true",
        help="Invoke cleanup_copilot_messages RPC after auditing",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print the raw rows returned for manual inspection",
    )
    args = parser.parse_args(argv)

    supabase = SupabaseClient.from_env()
    if not supabase.enabled:
        print(
            "Supabase credentials not detected. Skipping retention audit. "
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable checks."
        )
        return 0

    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=max(args.ttl_days, 1))
    stale_rows = _fetch_stale_rows(
        supabase,
        table=args.table,
        cutoff=cutoff,
        tenant_id=args.tenant_id,
        limit=args.limit,
    )

    if stale_rows:
        print(
            f"Found {len(stale_rows)} rows in {args.table} older than {args.ttl_days} days "
            "without soft_delete applied."
        )
        if args.verbose:
            print(json.dumps(stale_rows, indent=2, default=str))
        if args.strict:
            result = 1
        else:
            result = 0
    else:
        print(
            f"No stale rows detected in {args.table} (older than {args.ttl_days} days without soft delete)."
        )
        result = 0

    if args.run_cleanup:
        if args.table != "copilot_messages":
            print("cleanup_copilot_messages RPC only supports copilot_messages table; skipping cleanup call.")
        else:
            _run_cleanup(supabase, args.ttl_days)

    return result


if __name__ == "__main__":
    sys.exit(main())
