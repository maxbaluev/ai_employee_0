# AI Employee Control Plane — Active Work Queue

**Last Updated:** October 17, 2025 (integration foundation reprioritisation)

This file spotlights the highest-leverage tasks for the current iteration. It is a thin veneer over the canonical backlog (`docs/backlog.md`) and the Beads tracker—update all three when priorities change.

---

## 🔥 Critical Foundation (P0 active)

- `ai_eployee_0-10` — Implement AG-UI ↔ ADK bridge in CopilotKit route
  - Replace the placeholder `HttpAgent` target with a FastAPI endpoint that wraps `ag_ui_adk.ADKAgent`.
  - Validate with `pnpm run test:ui` smoke + manual chat session to confirm AG-UI events stream.
- `ai_eployee_0-11` — Wire real Composio SDK client in executor runtime
  - Initialise `ComposioClientWrapper` with a live client, handling EVAL_MODE fallbacks and retries.
  - Exercise `client.tools.search()`/`client.tools.execute()` via `mise run agent` sandbox mission.
- `ai_eployee_0-12` — Implement Supabase token validation in FastAPI
  - Centralise JWT verification, inject `tenant_id`/`user_id` into ADK session state, and reuse across endpoints.
  - Confirm RLS access using `supabase gen types` + `pnpm tsc --noEmit` after wiring auth context.
- `ai_eployee_0-13` — Replace placeholder mission data in workspace UI
  - Remove fixtures from `src/lib/data/home-dashboard.ts` and query Supabase views for Home dashboard + stage pages.
  - Ensure loading/empty states and telemetry hooks survive real data.

**Daily rhythm:** unblock AG-UI streaming and Composio wiring in parallel; pair backend/frontend once Supabase auth lands.

---

## 🟠 Next — Ready to Start (P1 queue)

- `ai_eployee_0-14` — Consolidate execution streaming on AG-UI protocol
  - After the bridge ships, retire bespoke SSE mapping in `/api/execution/run` and FastAPI runner.
  - Add regression coverage ensuring CopilotKit and FastAPI emit identical event envelopes.

Open question: surface telemetry dashboards once unified streaming is stable (depends on `ai_eployee_0-14`).

---

## 🟡 Later — Prep & Enablement

- Reintroduce AG-UI telemetry/test work (former `ai_eployee_0-5`..`0-9`) once foundation tasks land.
- Scope Supabase retention/backfill after live event logging exists.
- Draft Playwright mission replay once translator fixtures are defined.
- Revisit documentation checklist quarterly (next review January 2026).

---

## Validation Checklist Before Push

1. `bd list --status open` — confirm AG-UI backlog remains accurate.
2. `./scripts/validate_backlog_alignment.sh` — ensure docs ↔ tracker alignment.
3. `mise run lint` (dry-run) and targeted tests for any file you touched.

Keep this file concise—aim for a single screen of work so agents can claim tasks quickly.
