# AI Employee Control Plane — Active Work Queue

**Last Updated:** October 17, 2025

This file spotlights the highest-leverage tasks for the current iteration. It is a thin veneer over the canonical backlog (`docs/backlog.md`) and the Beads tracker—update all three when priorities change.

---

## 🔴 Now — Keep Moving (P0 in flight)

- `TASK-ADK-003` / `code-claude-goal--populate-beads-3`
  - Ship the InspectorAgent discovery → OAuth hand-off.
  - Dependencies: CoordinatorAgent, chat rail, `/api/toolkits/*` endpoints.
  - Acceptance criteria: dual-phase flow, telemetry hooks, Supabase persistence.
- `TASK-UI-006` / `code-claude-goal--populate-beads-14`
  - Finish the Approve stage UI, wired to `/api/approvals`.
  - Ensure undo plan preview + scope validation callouts render correctly.
- `TASK-DATA-001` / `code-claude-goal--populate-beads-24`
  - Close out the telemetry audit automation; unblock readiness evidence.

**Daily rhythm:** stand up on these three items, run `bd ready --limit 5` for opportunistic pickups, and keep `docs/backlog.md` acceptance criteria in view while implementing.

---

## 🟠 Next — Ready to Start (unblocked P0)

- `TASK-ADK-004` / `code-claude-goal--populate-beads-4`: PlannerAgent core logic + hybrid ranking.
- `TASK-API-002` / `code-claude-goal--populate-beads-18`: Inspector toolkit discovery endpoint.
- `TASK-API-003` / `code-claude-goal--populate-beads-19`: OAuth initiation endpoint.
- `TASK-API-004` / `code-claude-goal--populate-beads-20`: Planner streaming API.
- `TASK-API-006` / `code-claude-goal--populate-beads-22`: Executor orchestration API.
- `TASK-UI-003` / `code-claude-goal--populate-beads-11`: Prepare stage UI with readiness meter.
- `TASK-UI-004` / `code-claude-goal--populate-beads-12`: CopilotKit chat rail + approval modal.
- `TASK-UI-005` / `code-claude-goal--populate-beads-13`: Plan stage UI with undo preview.
- `TASK-UI-007` / `code-claude-goal--populate-beads-15`: Execute stage UI with live checklist.
- `TASK-TEST-001` / `code-claude-goal--populate-beads-29`: ADK evaluation suites to cover Planner/Executor flows.

Pick from this pool once the “Now” column is cleared. Each item already has acceptance criteria and validation steps in `docs/backlog.md`.

---

## 🟡 Later — Prep & Enablement (P1–P3)

- `TASK-ADK-004` blockers: `TASK-DATA-002` / `code-claude-goal--populate-beads-25` (library embeddings) should start soon to support Planner ranking.
- Observability cluster: `TASK-OPS-001`..`003` (`code-claude-goal--populate-beads-32`..`34`) plus dashboards (`TASK-DATA-003`..`005`).
- Documentation hygiene: `TASK-DOC-001` / `code-claude-goal--populate-beads-35` and `TASK-DOC-002` / `code-claude-goal--populate-beads-36`.

Schedule these once the P0 stack is green and the primary mission loop is demoable end-to-end.

---

## Validation Checklist Before Push

1. `bd list --status in_progress` — confirm the items above are accurate.
2. `./scripts/validate_backlog_alignment.sh` — ensure docs ↔ tracker alignment.
3. `mise run lint` (dry-run) and targeted tests for any file you touched.

Keep this file concise—aim for a single screen of work so agents can claim tasks quickly.

