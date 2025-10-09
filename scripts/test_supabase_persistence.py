#!/usr/bin/env python3
"""Offline verification helpers for Gate G-A Supabase schema."""

from __future__ import annotations

import csv
import hashlib
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable


ROOT = Path(__file__).resolve().parents[1]
MIGRATION_PATH = ROOT / "supabase" / "migrations" / "0001_init.sql"
CHECKSUM_PATH = ROOT / "docs" / "readiness" / "db_checksum_G-A.csv"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _extract_table_definitions(sql: str) -> Dict[str, str]:
    pattern = re.compile(r"create table public\.(\w+)\s*\((.*?)\);", re.IGNORECASE | re.DOTALL)
    tables: Dict[str, str] = {}
    for match in pattern.finditer(sql):
        table_name, body = match.groups()
        normalised = "\n".join(line.rstrip() for line in body.strip().splitlines())
        tables[table_name] = normalised
    return tables


def compute_checksums() -> Dict[str, str]:
    sql_text = MIGRATION_PATH.read_text(encoding="utf-8")
    definitions = _extract_table_definitions(sql_text)
    checksums: Dict[str, str] = {}
    for table, ddl in sorted(definitions.items()):
        digest = hashlib.sha256(ddl.encode("utf-8")).hexdigest()
        checksums[table] = digest
    return checksums


def write_checksum_csv(checksums: Dict[str, str]) -> None:
    CHECKSUM_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CHECKSUM_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["table", "checksum"])
        for table, digest in checksums.items():
            writer.writerow([table, digest])


def exercise_supabase_client() -> Dict[str, int]:
    """Simulate persistence using the project's Supabase client offline mode."""

    # Import lazily to avoid heavy dependencies during documentation builds
    from agent.services.supabase import SupabaseClient  # type: ignore

    os.environ.setdefault("SUPABASE_URL", "")
    os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "")
    os.environ.setdefault("SUPABASE_ALLOW_WRITES", "false")

    client = SupabaseClient.from_env()

    play_payload = {
        "tenant_id": "00000000-0000-0000-0000-000000000000",
        "objective_id": "00000000-0000-0000-0000-000000000001",
        "mode": "dry_run",
        "plan_json": {"title": "Gate G-A dry run"},
        "impact_estimate": "High",
        "risk_profile": "Low",
        "undo_plan": "Document manual rollback",
        "confidence": 0.9,
        "telemetry": {"tool_count": 2},
    }
    client.upsert_plays([play_payload])

    artifact_payload = {
        "tenant_id": play_payload["tenant_id"],
        "play_id": "00000000-0000-0000-0000-000000000010",
        "type": "dry_run_outline",
        "title": "Dry-run artifact",
        "content": {"summary": "Outline"},
        "status": "draft",
        "hash": hashlib.sha256(b"Outline").hexdigest(),
        "checksum": hashlib.md5(b"Outline").hexdigest(),
    }
    client.insert_artifacts([artifact_payload])

    client.insert_event(
        {
            "mission_id": play_payload["objective_id"],
            "tenant_id": play_payload["tenant_id"],
            "event_name": "planner_stage_started",
            "event_payload": {"attempt": 1},
        }
    )

    client.insert_safeguard_event(
        {
            "mission_id": play_payload["objective_id"],
            "tenant_id": play_payload["tenant_id"],
            "event_type": "auto_fix",
            "details": {"violations": []},
        }
    )

    return {table: len(rows) for table, rows in client._offline_buffer.items()}  # type: ignore[attr-defined]


def main() -> None:
    checksums = compute_checksums()
    write_checksum_csv(checksums)
    offline_counts = exercise_supabase_client()

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print("Gate G-A Supabase verification")
    print(f"Timestamp: {timestamp}")
    print("\nTable checksums written to docs/readiness/db_checksum_G-A.csv")
    for table, digest in checksums.items():
        print(f"  - {table}: {digest}")

    print("\nOffline buffer writes (expected when SUPABASE_ALLOW_WRITES=false):")
    for table, count in offline_counts.items():
        print(f"  - {table}: {count} record(s)")


if __name__ == "__main__":
    main()
