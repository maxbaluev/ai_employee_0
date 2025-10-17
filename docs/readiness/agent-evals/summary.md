# Agent Evaluation Readiness Summary

**Owner:** Platform Engineering
**Updated:** October 17, 2025

> **⚠️ Foundation Stage Status:** As of October 2025, the Gemini ADK backend (`agent/agent.py`) is **scaffolded with TODO markers only**. Real ADK agent implementations, Google GenAI API calls, and evaluation configs are **not yet wired up**. The evaluation framework described below documents the **planned testing infrastructure** for Core/Scale milestones when agents are implemented. See `docs/backlog.md` Theme 1 (TASK-ADK-*) for implementation roadmap.

Our release process will require the Gemini ADK backend to demonstrate stable mission behaviour before any production promotion. This document records the evaluation surfaces that must stay green and the artifacts we will attach for Gate reviews (currently aspirational).

## Planned Evaluation Cadence (Core/Scale Milestones)

**Current State:** No evaluation cadence is active. `mise run test-agent` is defined but has no real eval sets to execute.

**Planned (when agents are implemented):**

- **Per Pull Request:**
  - `mise run test-agent` (will wrap all ADK eval sets)
  - Upload JSON result bundle to the associated PR artifact bucket
- **Nightly:**
  - Scheduled `mise run test-agent -- --format html` with Supabase persistence of summaries
  - Failures create PagerDuty low-urgency incidents for the agent squad
- **Pre-Release (Gate G-B):**
  - Two consecutive green nightly runs
  - Manual spot-check on highest-risk mission playbooks

## Planned Required Eval Sets (Not Yet Implemented)

**Current State:** `agent/evals/` contains placeholder files only. No real `.evalset.json` test suites exist.

**Planned Eval Sets (for future implementation):**

| Eval Set | Purpose | Key Assertions | Artifact |
| --- | --- | --- | --- |
| `smoke_foundation.evalset.json` | Basic agent wiring | Inspector discovery and Executor tool call succeed | `smoke-foundation.json` |
| `discovery_coverage.evalset.json` | Toolkit breadth | Coverage score ≥ 0.75 for canonical missions | `discovery-coverage.json` |
| `ranking_quality.evalset.json` | Planner ordering | Top-ranked play matches golden judgement | `ranking-quality.json` |
| `execution_safety.evalset.json` | Safeguards | Validator blocks unsafe actions, undo plan recorded | `execution-safety.json` |
| `error_recovery.evalset.json` | Resilience | Rate limit + auth expiry paths recover without data loss | `error-recovery.json` |
| `mission_end_to_end.evalset.json` | Full lifecycle | All seven stages generate expected telemetry & evidence | `mission-end-to-end.html` |

**Planned Storage:** Generated artifacts will be stored under `docs/readiness/agent-evals/artifacts/<YYYY-MM-DD>/` and linked in the release readiness checklist.

## Planned Exit Criteria for Releases (Core/Scale Milestones)

**Current State:** No exit criteria are enforced for agent evaluations in Foundation stage. ADK backend is scaffolded only.

**Planned Exit Criteria (when agents are implemented):**

1. All eval sets above green on the branch to be deployed (PR + nightly).
2. Evidence artifacts attached in the readiness folder with matching commit hash.
3. Incident queue free of open agent evaluation regressions.
4. Product sign-off recorded in `docs/09_release_readiness.md` referencing the latest artifact hashes.

## Playbook Links

- `docs/04_implementation_guide.md` §ADK Evaluation Framework — how we structure eval sets.
- `docs/07_operations_playbook.md` — runbooks for evaluation failures (Runbook 4).
- `docs/09_release_readiness.md` — checklist items referencing this summary.
