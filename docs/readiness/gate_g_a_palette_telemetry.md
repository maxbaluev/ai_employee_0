# Gate G-A Palette Telemetry & Inspection Preview

**Updated:** October 9, 2025  
**Owners:** Runtime Steward, CopilotKit Squad

This note documents the telemetry and inspection preview changes implemented for the Gate G-A tool palette experience. Use it as a reference when validating analytics, reproducing dry-run traces, or extending the workflow in Gate G-B.

---

## Summary

| Capability | Description | Primary Source |
| --- | --- | --- |
| Palette view telemetry | Logs when a recommended toolkit carousel is rendered | `src/app/api/toolkits/route.ts:46-215` |
| Selection telemetry | Captures toolkit acceptance, diffs, and auth breakdown | `src/app/api/safeguards/toolkits/route.ts:32-203` |
| Inspection preview | Planner emits MCP sample data preview post-selection | `agent/agents/planner.py:65-420` |
| Session state | Stores preview payload (`InspectionPreview`) for downstream agents & UI | `agent/agents/state.py:12-115` |

All events persist to `mission_events` with RLS enforced per tenant (see `supabase/migrations/0001_init.sql:202-246`). The Supabase client gracefully buffers events offline when UUID context is unavailable.

---

## Telemetry Events

### 1. `toolkit_recommendation_viewed`
- **Purpose:** Palette impression (which toolkits were shown, whether any were already selected)
- **Emitter:** `GET /api/toolkits`
- **Payload:**

```json
{
  "request_id": "7d707b7d0d45a9eaddfbf34a4c3f0d133a5cfb31",
  "total_toolkits": 8,
  "auth_breakdown": { "no_auth": 5, "oauth": 3 },
  "selected_count": 2,
  "selected_slugs": ["slack", "hubspot"],
  "palette": [
    {
      "slug": "slack",
      "name": "Slack",
      "category": "communications",
      "auth_type": "oauth",
      "no_auth": false,
      "position": 1
    }
  ],
  "source": "planner"
}
```

### 2. `toolkit_selected`
- **Purpose:** Records the active selection set after a user saves the palette
- **Emitter:** `POST /api/safeguards/toolkits`
- **Payload Highlights:**
  - `selections`: canonical list of selected toolkits (`slug`, `name`, `auth_type`, `category`, `no_auth`)
  - `added` / `removed`: diffs versus previous accepted selections
  - `auth_breakdown`: no-auth vs OAuth counts for analytics
  - `timestamp`: ISO8601 of the save operation

### 3. `toolkit_suggestion_applied`
- **Purpose:** Legacy compatibility; mirrors `toolkit_selected` payload for downstream consumers until Gate G-B deprecates the old schema.
- **Emitter:** `POST /api/safeguards/toolkits`
- **Payload:** identical to `toolkit_selected` minus the timestamp.

### 4. `inspection_preview_rendered`
- **Purpose:** Confirms MCP inspection results before execution
- **Emitter:** `PlannerAgent._emit_inspection_preview`
- **Payload:**

```json
{
  "selected_count": 2,
  "mode": "dry_run",
  "toolkits": [
    {
      "slug": "slack",
      "name": "Slack",
      "auth_type": "oauth",
      "sample_rows": [
        "Slack sample #1 (draft preview)",
        "Slack sample #2 (draft preview)"
      ],
      "sample_count": 2,
      "no_auth": false,
      "category": "communications"
    }
  ]
}
```

Planner telemetry also writes the preview to the ADK session state under `inspection_preview`, enabling CopilotKit to surface the inspection card without recalculating stubs.

---

## Inspection Preview Stream

When the planner finishes ranking, it now emits an assistant message via `CopilotKitStreamer`:

```json
{
  "role": "assistant",
  "content": "Inspection preview ready: Slack (2 samples), HubSpot (3 samples).",
  "metadata": {
    "stage": "inspection_preview_rendered",
    "toolkits": [/* matches telemetry payload */]
  }
}
```

This message is stored in `copilot_messages` and drives the Gate G-A validation checklist. If selections are empty or Supabase is offline, the preview step is skipped gracefully.

---

## Usage Instructions

### Palette API
- **Fetch recommendations:** `GET /api/toolkits?tenantId=<uuid>&missionId=<uuid>`
- **Persist selections:** `POST /api/safeguards/toolkits` with body:

```json
{
  "tenantId": "00000000-0000-0000-0000-000000000000",
  "missionId": "11111111-1111-1111-1111-111111111111",
  "selections": [
    { "slug": "slack", "name": "Slack", "authType": "oauth", "category": "communications", "noAuth": false }
  ]
}
```

Responses return `success` and `count`. Palette events emit automatically when the API succeeds.

### Planner Preview
- Run the Gate G-A coordinator (`mise run agent`) or `adk eval agent/evals/smoke_g_a_v2.json`.
- After ranking completes, inspect `ctx.session.state['inspection_preview']` or query `mission_events` for `inspection_preview_rendered`.
- CopilotKit streaming endpoint (`/api/copilotkit`) will surface the assistant message with stage `inspection_preview_rendered`.

### Linting
- Run `pnpm lint` (dry-run is not supported by Next.js). This command should pass without warnings after telemetry updates.

---

## Analytics Alignment

The payloads enable Gate G-A dashboards to report:

- Palette impression counts (`total_toolkits`, `auth_breakdown.no_auth` vs `oauth`).
- Selection conversion (`selected_count`, `added`, `removed`).
- Latency & confirmation rate (combine with existing `planner_rank_complete` metrics).
- Inspection readiness (count missions where `selected_count > 0`).

Upcoming Gate G-B work will extend these metrics with streaming lifecycle events (`planner_stage_started`, `validator_feedback`), but the current schema is already wired for ingestion.

---

## Verification Checklist

1. Call `GET /api/toolkits?tenantId=<uuid>&missionId=<uuid>` and confirm `mission_events` receives `toolkit_recommendation_viewed`.
2. Save selections via the Copilot UI (or `POST /api/safeguards/toolkits`) and verify paired `toolkit_selected` + `toolkit_suggestion_applied` events.
3. Trigger the planner (Gemini ADK run) and check for `inspection_preview_rendered` telemetry, CopilotKit timeline entry, and session state saved under `inspection_preview`.
4. Run `pnpm lint` to ensure TypeScript lint rules remain satisfied after telemetry changes.

---

## Cross References

- Architecture: `new_docs/architecture.md §3.1–3.4`, `§4.0`
- UX: `new_docs/ux.md §5.2`, `§5.3`
- Workflow: `new_docs/workflow.md §4`
- Supabase schema: `supabase/migrations/0001_init.sql`
- Mission analytics: `docs/readiness/status_beacon_A.json`

---

## Next Steps (Gate G-B)

- Stream planner / executor lifecycle updates to CopilotKit (`planner_stage_started`, `executor_status`, `validator_feedback`).
- Wire `/api/approvals` mutations with optimistic UI updates.
- Capture evidence artifacts for palette validation in `docs/readiness/copilotkit_session_G-B.mp4`.
