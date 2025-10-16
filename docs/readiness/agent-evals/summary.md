# Agent Evaluation Readiness Summary

**Owner:** Platform Engineering
**Updated:** October 16, 2025

Our release process requires the Gemini ADK backend to demonstrate stable mission behaviour before any production promotion. This document records the evaluation surfaces that must stay green and the artifacts we attach for Gate reviews.

## Evaluation Cadence

- **Per Pull Request:**
  - `mise run test-agent` (wraps all ADK eval sets)
  - Upload JSON result bundle to the associated PR artifact bucket
- **Nightly:**
  - Scheduled `mise run test-agent -- --format html` with Supabase persistence of summaries
  - Failures create PagerDuty low-urgency incidents for the agent squad
- **Pre-Release (Gate G-B):**
  - Two consecutive green nightly runs
  - Manual spot-check on highest-risk mission playbooks

## Required Eval Sets

| Eval Set | Purpose | Key Assertions | Artifact |
| --- | --- | --- | --- |
| `smoke_foundation.evalset.json` | Basic agent wiring | Inspector discovery and Executor tool call succeed | `smoke-foundation.json` |
| `discovery_coverage.evalset.json` | Toolkit breadth | Coverage score ≥ 0.75 for canonical missions | `discovery-coverage.json` |
| `ranking_quality.evalset.json` | Planner ordering | Top-ranked play matches golden judgement | `ranking-quality.json` |
| `execution_safety.evalset.json` | Safeguards | Validator blocks unsafe actions, undo plan recorded | `execution-safety.json` |
| `error_recovery.evalset.json` | Resilience | Rate limit + auth expiry paths recover without data loss | `error-recovery.json` |
| `mission_end_to_end.evalset.json` | Full lifecycle | All five stages generate expected telemetry & evidence | `mission-end-to-end.html` |

Store generated artifacts under `docs/readiness/agent-evals/artifacts/<YYYY-MM-DD>/` and link them in the release readiness checklist.

## Exit Criteria for Releases

1. All eval sets above green on the branch to be deployed (PR + nightly).
2. Evidence artifacts attached in the readiness folder with matching commit hash.
3. Incident queue free of open agent evaluation regressions.
4. Product sign-off recorded in `docs/09_release_readiness.md` referencing the latest artifact hashes.

## Playbook Links

- `docs/04_implementation_guide.md` §ADK Evaluation Framework — how we structure eval sets.
- `docs/07_operations_playbook.md` — runbooks for evaluation failures (Runbook 4).
- `docs/09_release_readiness.md` — checklist items referencing this summary.

