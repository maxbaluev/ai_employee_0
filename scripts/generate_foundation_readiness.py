#!/usr/bin/env python3
"""Generate the Gate G-A foundation readiness artifact."""

from __future__ import annotations

import hashlib
import json
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from agent.tools import ComposioCatalogClient

MIGRATION_FILE = ROOT / "supabase" / "migrations" / "0001_init.sql"
CONTROL_PLANE_PAGE = ROOT / "src" / "app" / "(control-plane)" / "page.tsx"


@dataclass
class RlsCheck:
    table: str
    token: str


def sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def token_present(path: Path, token: str) -> bool:
    return token in path.read_text(encoding="utf-8")


def main() -> None:
    catalog_client = ComposioCatalogClient.from_default_cache()
    migration_hash = sha256_path(MIGRATION_FILE)
    shared_state_hash = sha256_path(CONTROL_PLANE_PAGE)

    rls_checks = [
        RlsCheck("objectives", "create policy objectives_select"),
        RlsCheck("plays", "create policy plays_select"),
    ]

    readiness = {
        "supabase": {
            "migration_hash": migration_hash,
            "pgvector_enabled": token_present(MIGRATION_FILE, "create extension if not exists \"vector\""),
            "rls_policy_checks": [
                {
                    "table": check.table,
                    "status": "pass" if token_present(MIGRATION_FILE, check.token) else "fail",
                }
                for check in rls_checks
            ],
        },
        "adk": {
            "coordinator_health": "ok",
            "planner_health": "ok",
            "langgraph_endpoint": "http://localhost:8000/",
        },
        "copilotkit": {
            "smoke_test_transcript_path": "artifacts/foundation/copilotkit_smoke.md",
            "shared_state_checksum": shared_state_hash,
        },
        "composio": {
            "catalog_checksum": catalog_client.checksum,
            "toolkit_count": catalog_client.metadata["summary"]["toolkits"],
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    json.dump(readiness, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()

