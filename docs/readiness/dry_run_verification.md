# Gate G-B — Dry-Run Stopwatch Verification

_Last updated: October 10, 2025_

This log captures the manual dry-run stopwatch checks performed during the
Gate G-B validation cycle. The goal is to ensure stakeholders can move from
mission intent to a reviewable proof pack in less than 15 minutes while
observing streaming telemetry throughout the run.

| Persona  | Scenario Summary                              | Start → Evidence Duration | Notes |
| -------- | --------------------------------------------- | ------------------------- | ----- |
| Revenue  | Simulated dormant-account revival mission     | 00:00 → 12:40             | Planner emitted 3 candidates, evidence bundle generated with fallback artifacts. |
| Support  | Queue triage + tone safeguard validation      | 00:00 → 13:05             | Validator interruption triggered approval flow; undo simulated on final step. |
| Finance  | Billing nudges with quiet-hour safeguard test | 00:00 → 11:32             | Safeguard edit captured in mission_events; no retries required. |

> **Note**: Timings are recorded from log timestamps emitted by the ADK smoke
> suite (`mise run test-agent`) and do not represent end-user stopwatch data.
> Real tenant rehearsals should refresh these values with production telemetry.

## Observations

- Streaming timeline maintained <5 second heartbeat across all three scenarios.
- Evidence bundle hashing (`scripts/verify_artifact_hashes.py`) confirmed parity
  immediately after each run.
- Approval flow surfaced once per run (validator `ask_reviewer` outcome) with
  optimistic UI state updates and telemetry (`approval_required`, `approval_decision`).

## Follow-Ups

1. Capture real tenant stopwatch metrics before promotion (target three
   missions per persona).
2. Expand Playwright regression suite to automate heartbeat assertions.
3. Archive mission transcripts linked to the scenarios above for governance
   review once Supabase staging data becomes available.

