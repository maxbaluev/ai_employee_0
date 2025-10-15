# AI Employee Control Plane: Operations Guide

**Version:** 3.0 (October 2025)
**Audience:** Business Operations, Customer Success, Revenue Operations, Support Leadership
**Status:** Active operational playbook for the five-stage mission journey

---

## Purpose

This guide documents how business operations teams coordinate, monitor, and continually improve missions across the five-stage journey — **Define, Prepare, Plan & Approve, Execute & Observe, Reflect & Improve**. It centralizes stage-aligned responsibilities, approval checkpoints, telemetry expectations, and readiness evidence so that operators, validators, and stakeholders stay synchronized.

---

## Operating Model Overview

- **Mission Owner (MO):** Initiates missions, curates context, owns Define → Reflect & Improve outcomes.
- **Governance Validator (GV):** Reviews safeguards, approvals, and rollback readiness before execution.
- **Operations Command (OC):** Monitors Execute & Observe, triages incidents, manages undo plans.
- **Telemetry Analyst (TA):** Audits stage rollups, dashboards, and KPI thresholds.
- **Knowledge Curator (KC):** Converts successful plays into reusable library assets.

Every release cycle the cross-functional "Mission Operations Council" reviews telemetry trends, readiness evidence, and backlog priorities derived from feedback captured in Stage 5.

---

## Stage-Aligned Responsibilities

| Stage | Operational Checklist | Owner(s) | Evidence Artifact |
|-------|-----------------------|----------|-------------------|
| **Define** | Validate mission intent, confirm safeguard defaults, log business objective | MO + GV | `docs/readiness/define_intake_validation.md` |
| **Prepare** | Approve toolkit scopes, document data coverage, attest to compliance requirements | MO + GV + TA | `docs/readiness/prepare_toolkit_attestation.md` |
| **Plan & Approve** | Review ranked plays, approve undo plans, capture risk notes, confirm SLA impact | GV + OC | `docs/readiness/plan_approval_packet.md` |
| **Execute & Observe** | Staff live monitoring window, run playbooks for alerts, document incident outcomes | OC + TA | `docs/readiness/execute_observe_runlog.md` |
| **Reflect & Improve** | Collect feedback, classify reuse opportunities, update training backlog | KC + MO + TA | `docs/readiness/reflect_improve_retro.md` |

> **Legacy Mapping:** Intake + Mission Brief → Define; Toolkits & Connect + Data Inspect → Prepare; Plan → Plan & Approve; Governed Execution + Evidence → Execute & Observe; Feedback → Reflect & Improve.

---

## Governance Checkpoints

1. **Intent Confirmation (Define):** GV confirms safeguards align with policy templates and that mission objective has measurable KPI.
2. **Toolkit Authorization (Prepare):** OC validates OAuth scopes, ensures read-only inspection path before activation, and records approvals in Supabase `mission_approvals` table.
3. **Approval Packet Review (Plan & Approve):** GV and OC co-sign the ranked play selection, undo plan, and risk matrix; TA verifies telemetry hooks present.
4. **Live Execution Oversight (Execute & Observe):** OC maintains staffed duty window, triggers `mise run governance-check` for active missions, and coordinates rollback if validator escalates.
5. **Retrospective Sign-Off (Reflect & Improve):** MO, KC, and TA sign summary noting feedback trends, library updates, and follow-up tasks.

All checkpoint confirmations should link to their evidence artifacts and release tracker entries.

---

## Telemetry & Dashboards

- **Stage Rollup Dashboard:** Aggregates mission count, dwell time, and success rate per stage using `mission_stage_rollup_vw`.
- **Safeguard Compliance Board:** Tracks validator alerts, auto-fix adoption, and override reasons.
- **Undo Readiness Monitor:** Displays undo coverage percent and execution vs. rollback ratios.
- **Feedback Insights Report:** Surfaces effort saved, satisfaction scores, and library contribution volumes.

Telemetry Analysts run a weekly audit:

```bash
pnpm ts-node scripts/audit_telemetry_events.py --mode check
mise run governance-check
```

Discrepancies trigger Jira issues tagged `telemetry-gap` and must be resolved before the next release checkpoint.

---

## Runbooks & Incident Response

| Scenario | Stage Trigger | Runbook | Notes |
|----------|---------------|---------|-------|
| Safeguard Violation Escalation | Execute & Observe | `docs/readiness/runbooks/safeguard_violation.md` | Initiate pause, involve GV, record incident id |
| Undo Plan Failure | Execute & Observe | `docs/readiness/runbooks/undo_failure.md` | Execute alternate rollback, notify stakeholders |
| Data Coverage Gap | Prepare | `docs/readiness/runbooks/data_gap.md` | Decide on override, adjust toolkit selection |
| KPI Miss Investigation | Reflect & Improve | `docs/readiness/runbooks/kpi_miss.md` | Analyze telemetry, plan remediation backlog |
| Toolkit OAuth Drift | Prepare → Execute & Observe | `docs/readiness/runbooks/oauth_drift.md` | Re-authorize scopes, audit audit logs |

Operations Command keeps on-call rotations documented in `docs/readiness/runbooks/on_call_schedule.md` and ensures warm handoffs between time zones.

---

## Business KPIs & Review Cadence

| KPI | Stage Alignment | Target | Review Frequency |
|-----|-----------------|--------|------------------|
| Mission throughput | Define → Reflect & Improve | ≥ 30 missions/week | Weekly ops sync |
| Approval latency | Plan & Approve | ≤ 4 hours P95 | Weekly ops sync |
| Validator escalation rate | Execute & Observe | ≤ 5% of missions | Governance council bi-weekly |
| Undo execution success | Execute & Observe | ≥ 98% successful rollbacks | Governance council bi-weekly |
| Feedback participation | Reflect & Improve | ≥ 80% missions with feedback | Monthly retrospective |
| Library contribution reuse | Reflect & Improve | ≥ 35% missions reuse assets | Monthly retrospective |

Monthly retrospectives review KPI deltas, backlog priority, and cross-functional initiatives. Outputs feed directly into the capability roadmap and readiness documentation.

---

## Operating Rhythm

1. **Daily Standup:** OC reviews active missions, validator alerts, and undo readiness at 9am local time.
2. **Weekly Ops Sync:** MO, GV, OC, TA, KC align on stage throughput, blockers, and runbook updates.
3. **Bi-Weekly Governance Council:** Deep dive into escalations, approval latency, safeguard policy updates.
4. **Monthly Retrospective:** Consolidate feedback insights, update library priorities, review KPI trends.
5. **Quarterly Planning:** Align operations initiatives with the capability roadmap and release calendar.

Meeting notes and decisions should be recorded in `docs/readiness/ops_meeting_notes/` with stage tags for searchability.

---

## Backlog & Continuous Improvement

- Maintain an "Operations Backlog" board with columns by stage to ensure balanced improvements.
- Prioritize items using impact vs. effort, referencing telemetry to validate hypotheses.
- For each backlog item, link the stage, associated KPI, and readiness artifact that will be updated post-delivery.

Suggested backlog categories:
- **Define:** Intake prompts, safeguard templates, persona-specific playbooks
- **Prepare:** OAuth automation, toolkit catalog refresh, data sampling improvements
- **Plan & Approve:** Approval UX polish, risk matrix automation, undo plan coverage
- **Execute & Observe:** Incident tooling, validator tuning, metric SLO refinement
- **Reflect & Improve:** Feedback classification automation, library tagging, training content

---

## Legacy Considerations

- Historical reporting still references the eight-stage dataset; analytics dashboards should use `stage_legacy` and `stage_v3` views until December 2025.
- Archive eight-stage runbooks in `docs/archive/operations/`; append cross-links pointing to their five-stage replacements.
- Communicate the five-stage terminology change to partner operations teams and update shared glossaries.

---

## Contacts & Escalation Paths

- **Mission Owner Lead:** `@mo-lead`
- **Governance Validator Lead:** `@governance`
- **Operations Command Lead:** `@ops-lead`
- **Telemetry Analyst Lead:** `@analytics`
- **Knowledge Curator Lead:** `@knowledge`
- Slack Channel: `#control-plane-ops`
- PagerDuty Schedule: `Mission Ops On-Call`

Escalations should follow the incident response runbook, with post-incident reviews scheduled within 48 hours.

---

## References

- `docs/02_system_overview.md` — Technical blueprint and migration appendix
- `docs/03_user_experience.md` — UX contracts and stage interaction patterns
- `docs/09_release_readiness.md` — Release criteria and sign-off workflows
- `docs/readiness/` — Evidence artifacts and runbooks
- `docs/05_capability_roadmap.md` — Capability milestones and dependencies

