#!/usr/bin/env python3
"""Exercise CopilotKit persistence hooks for Gate G-A in offline mode."""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


from agent.services.supabase import SupabaseClient  # type: ignore  # pylint: disable=wrong-import-position


def main() -> None:
    os.environ.setdefault("SUPABASE_URL", "")
    os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "")
    os.environ.setdefault("SUPABASE_ALLOW_WRITES", "false")

    client = SupabaseClient.from_env()

    session_id = "11111111-1111-1111-1111-111111111111"
    tenant_id = "00000000-0000-0000-0000-000000000000"

    client.upsert_copilot_session(
        {
            "id": session_id,
            "tenant_id": tenant_id,
            "agent_id": "control_plane_foundation",
            "session_identifier": "qa-session-001",
            "state": {"mission": {"objective": "Dry-run acceptance"}},
            "expires_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    client.insert_copilot_messages(
        [
            {
                "id": "22222222-2222-2222-2222-222222222222",
                "tenant_id": tenant_id,
                "session_id": session_id,
                "role": "assistant",
                "content": {"text": "Brief generated for marketing dry run."},
                "metadata": {"source": "copilotkit_emit_message"},
            }
        ]
    )

    client.insert_event(
        {
            "mission_id": "00000000-0000-0000-0000-000000000001",
            "tenant_id": tenant_id,
            "event_name": "copilotkit_exit",
            "event_payload": {"reason": "mission_complete"},
        }
    )

    snapshot = {
        table: [row for row in rows]
        for table, rows in client._offline_buffer.items()  # type: ignore[attr-defined]
    }

    print("Gate G-A CopilotKit persistence QA")
    print(f"Timestamp: {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}")
    print(json.dumps(snapshot, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
