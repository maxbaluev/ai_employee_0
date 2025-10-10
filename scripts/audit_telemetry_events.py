#!/usr/bin/env python3
"""Audit Gate telemetry coverage against mission_events."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from collections import Counter
from typing import Dict, Iterable, List, Set

from pathlib import Path
import importlib.util

# Load SupabaseClient without importing the full agent package (avoids ADK side-effects).
ROOT = Path(__file__).resolve().parents[1]
SUPABASE_MODULE_PATH = ROOT / "agent" / "services" / "supabase.py"
SPEC = importlib.util.spec_from_file_location("gate_supabase_client", SUPABASE_MODULE_PATH)
if SPEC is None or SPEC.loader is None:  # pragma: no cover - defensive
    raise RuntimeError("Unable to load Supabase client module")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)  # type: ignore[call-arg]
SupabaseClient = MODULE.SupabaseClient  # type: ignore[attr-defined]


# Core UX/telemetry events expected for Gate G-B dry-run proof loop.
REQUIRED_EVENTS: Dict[str, str] = {
    "intent_submitted": "User submitted mission intake",
    "brief_generated": "Mission brief generated",
    "brief_item_modified": "User edited or regenerated a brief chip",
    "mission_created": "Mission persisted after intake acceptance",
    "planner_stage_started": "Planner stage kicked off",
    "planner_rank_complete": "Planner finished ranking candidates",
    "planner_status": "Planner emitted interim status",
    "dry_run_started": "Executor entered dry-run loop",
    "dry_run_completed": "Dry-run loop produced artifacts",
    "executor_status": "Executor streamed status update",
    "validator_stage_started": "Validator stage kicked off",
    "validator_feedback": "Validator produced feedback",
    "approval_required": "Validator requested human approval",
    "approval_decision": "Reviewer supplied a decision",
    "undo_requested": "Undo requested for a tool call",
    "undo_completed": "Undo completed successfully",
    "toolkit_suggestion_applied": "User accepted recommended toolkit",
    "safeguard_hint_applied": "Safeguard hint accepted",
    "safeguard_hint_rejected": "Safeguard hint rejected",
}


def _collect_events(
    supabase: SupabaseClient,
    *,
    lookback_hours: int,
    tenant_id: str | None,
    mission_id: str | None,
) -> List[Dict[str, object]]:
    """Fetch mission events within the lookback window."""

    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=max(lookback_hours, 1))
    params: Dict[str, str] = {
        "select": "id,mission_id,tenant_id,event_name,created_at",
        "created_at": f"gte.{cutoff.isoformat()}",
        "order": "created_at.asc",
        "limit": "1000",
    }
    if tenant_id:
        params["tenant_id"] = f"eq.{tenant_id}"
    if mission_id:
        params["mission_id"] = f"eq.{mission_id}"

    rows = supabase._request("GET", "/mission_events", params=params)  # type: ignore[attr-defined]
    if isinstance(rows, list):
        return rows
    return []


def _print_missing(missing: Set[str]) -> None:
    if not missing:
        return
    print("Missing required telemetry events:")
    for event in sorted(missing):
        description = REQUIRED_EVENTS.get(event, "")
        suffix = f" — {description}" if description else ""
        print(f"  - {event}{suffix}")


def _print_summary(rows: Iterable[Dict[str, object]], *, verbose: bool) -> None:
    counter = Counter(
        str(row.get("event_name"))
        for row in rows
        if row.get("event_name") is not None
    )
    print(f"Telemetry events analysed: {sum(counter.values())}")
    print("Top events (by count):")
    for name, count in counter.most_common():
        description = REQUIRED_EVENTS.get(name, "")
        suffix = f" — {description}" if description else ""
        print(f"  {name}: {count}{suffix}")
    if verbose:
        print("\nRaw events (JSON):")
        print(json.dumps(list(rows), indent=2, default=str))


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Audit mission_events against required Gate telemetry entries.",
    )
    parser.add_argument("--gate", default="G-B", help="Gate identifier for logging context")
    parser.add_argument("--tenant-id", help="Filter mission_events by tenant UUID")
    parser.add_argument("--mission-id", help="Filter mission_events by mission UUID")
    parser.add_argument(
        "--hours",
        type=int,
        default=24,
        help="Lookback window (hours) used when querying mission_events",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit with non-zero status if required events are missing",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print the raw mission_events payload retrieved",
    )
    args = parser.parse_args(argv)

    supabase = SupabaseClient.from_env()
    if not supabase.enabled:
        print(
            "Supabase credentials not detected. Skipping telemetry audit. "
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable checks."
        )
        return 0

    rows = _collect_events(
        supabase,
        lookback_hours=args.hours,
        tenant_id=args.tenant_id,
        mission_id=args.mission_id,
    )

    if not rows:
        print("No mission_events returned for the provided filters.")
        if args.strict:
            return 1
        return 0

    _print_summary(rows, verbose=args.verbose)
    observed = {str(row.get("event_name")) for row in rows if row.get("event_name")}
    missing = {event for event in REQUIRED_EVENTS if event not in observed}
    _print_missing(missing)

    if args.strict and missing:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
