# AI Employee Control Plane — Active Work Queue

**Last Updated:** October 17, 2025 (post AG-UI protocol refresh)

This file spotlights the highest-leverage tasks for the current iteration. It is a thin veneer over the canonical backlog (`docs/backlog.md`) and the Beads tracker—update all three when priorities change.

---

## 🔴 Now — Keep Moving (P1 in flight)

- `ai_eployee_0-5` — Implement AG-UI → ADK translator test suite
  - Add pytest coverage for every event type listed in `docs/04a_copilot_protocol.md` §4/§8.
  - Blocked on: confirming fixture schemas from `@ag-ui/core` exports.
- `ai_eployee_0-6` — Persist AG-UI event logs to Supabase
  - Extend `agent/services/telemetry.py` with structured inserts + redaction parity.
  - Requires Supabase migration + retention policy alignment with `docs/06_data_intelligence.md`.
- `ai_eployee_0-8` — Instrument AG-UI heartbeat telemetry
  - Emit `workspace_stream_open/closed` and correlate `tool_execution_id` to Composio events.
  - Wire dashboards per `docs/04a_copilot_protocol.md` §7.
- `ai_eployee_0-9` — Wire CopilotKit ACK responses for AG-UI custom events
  - Ensure Connect Link and undo countdown cards send acknowledgements back through `useCopilotAction`.
  - Coordinate with frontend owners of Prepare/Execute surfaces.

**Daily rhythm:** start with translator tests + telemetry persistence; pair on ACK wiring before instrumenting dashboards.

---

## 🟠 Next — Ready to Start (unblocked P2)

- `ai_eployee_0-7` — Add optional AG-UI protobuf transport
  - Negotiate `AGUI_MEDIA_TYPE` in `/api/copilotkit` with feature flag + fallback.
  - Confirm payload compression ≥50% before enabling by default.

Open question: scope a follow-on task for Supabase retention automation once `ai_eployee_0-6` lands.

---

## 🟡 Later — Prep & Enablement

- Scope Supabase retention/backfill once event logging is live.
- Draft Playwright mission replay once translator tests define fixtures.
- Revisit documentation checklist quarterly (next review January 2026).

---

## Validation Checklist Before Push

1. `bd list --status open` — confirm AG-UI backlog remains accurate.
2. `./scripts/validate_backlog_alignment.sh` — ensure docs ↔ tracker alignment.
3. `mise run lint` (dry-run) and targeted tests for any file you touched.

Keep this file concise—aim for a single screen of work so agents can claim tasks quickly.
