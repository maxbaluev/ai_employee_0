# AI Employee Control Plane: Operations Playbook

**Version:** 3.2 (October 16, 2025)
**Audience:** Operations Engineers, SRE, DevOps, On-Call Teams, Incident Responders
**Status:** Active operational doctrine for production and staging

---

## Purpose & Scope

This playbook describes how we operate, monitor, and restore the AI Employee Control Plane across environments. It aligns our deployment rhythm, observability, and incident practices with the bd issue tracker, Composio trust stages, and the single-migration Supabase schema. Use it as the high-signal reference during day-to-day operations and live incidents.

---

## Beads Issue Tracker: Operational Foundation

Our operational source of truth lives in Beads. Every deployment, incident, and maintenance window is represented in `bd` so responders can see dependencies, ready work, and audit trails in real time. Review `docs/11_issue_tracking.md` whenever you need deeper context or automation guidance.

### Quick Bootstrap

```bash
bd init                    # once per clone; seeds .beads/
bd list --status open      # confirm the backlog is visible
bd ready --limit 10
```

- Run `bd init` immediately after cloning or checking out a new worktree; automation assumes `.beads/` exists.
- If the command fails, follow the "Beads Database Corruption or Missing" runbook before proceeding.
- Use `bd --db <path>` only for sandbox testing—production operations must rely on the repo-local database so history stays in git.

### Core Operational Commands

Deployment tracker:

```bash
DEPLOY_VERSION="2025.10.16"
DEPLOY_ISSUE=$(bd create "Deploy ${DEPLOY_VERSION} to production" -p 1 -t task -l "ops,deployment" --json | jq -r '.id')
bd comment "$DEPLOY_ISSUE" "CI build: https://ci.example.com/runs/123"
```

Incident skeleton:

```bash
INCIDENT=$(bd create "SEV1: API outage" -p 0 -t incident -l "incident,sev1" --json | jq -r '.id')
bd update "$INCIDENT" --status in_progress --assignee "$ONCALL_EMAIL"
```

Maintenance planning:

```bash
MAINT=$(bd create "Q4 scheduled maintenance" -p 2 -t task -l "maintenance" --json | jq -r '.id')
bd dep add "$MAINT" "$DEPLOY_ISSUE" --type parent-child
bd dep tree "$MAINT"
```

Graph hygiene helpers:

```bash
bd dep add <blocked> <blocker> --type blocks
bd dep tree <issue-id>
bd dep cycles
bd ready --priority 0
bd list --status in_progress
bd close <issue-id> --reason "Mitigated"
```

### Beads Operational Checklist

- `bd init` (or verify `.beads/` exists) before any operational work.
- Ensure a deployment/incident/maintenance issue exists and is tagged appropriately.
- Record blockers with `bd dep add` so `bd ready` stays trustworthy.
- Update status with `bd update <ISSUE> --status in_progress` when hands are on the keyboard.
- Close issues with `bd close <ISSUE> --reason "..."` and attach evidence links or runbook references.
- Export dependency context to retrospectives with `bd dep tree <ISSUE>`.

---

## Operating Principles

- **Automate with evidence.** Every operational change is anchored to a bd issue, telemetry trace, or runbook artifact.
- **Trust staged access.** Inspector → Planner → Executor flows rely on Composio telemetry (`composio_discovery`, `composio_auth_flow`, `composio_tool_call`) and scoped credentials.
- **Single-source schema.** `supabase/migrations/0001_init.sql` is the only migration file; schema drift is treated as an incident.
- **Telemetry hygiene first.** Follow `docs/06_data_intelligence.md` and `src/lib/telemetry/redaction.ts` for PII scrubbing and signal validation.
- **Plan for undo.** Every mission and deployment includes an explicit rollback or undo path tied to Supabase audit logs and bd dependencies.

---

## Architecture At A Glance

| Surface                                           | Responsibility                                                | Primary Docs                                                      |
| ------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| Next.js Control Plane (`src/app/(control-plane)`) | Mission intake, gallery, operator console                     | `docs/02_system_overview.md`, `docs/03_user_experience.md`        |
| Gemini ADK FastAPI Agent (`agent/`)               | Inspector/Planner/Executor services, Composio SDK calls       | `docs/04_implementation_guide.md`, `docs/06_data_intelligence.md` |
| Supabase (`supabase/`)                            | Postgres, Storage, Edge Functions, typed clients              | `supabase/migrations/0001_init.sql`, `supabase/seed.sql`          |
| bd Issue Graph (`.beads/`)                        | Operational source of truth for work, dependencies, incidents | `docs/11_issue_tracking.md`                                       |
| Telemetry Stack                                   | Metrics, logs, traces, redaction filters                      | `docs/06_data_intelligence.md`                                    |

> For repo navigation start from `docs/00_README.md`; environment bootstrap instructions live in `docs/08_getting_started.md`.

---

## Pre-Deployment Control Loop

Complete the following loop before touching any environment.

> Before step 1, locate or create the deployment issue in Beads and capture the release identifier:
>
> ```bash
> DEPLOY_ISSUE=$(bd ready --tag ops --json | jq -r 'map(select(.title|test("Deploy"))) | .[0].id // empty')
> [[ -z "$DEPLOY_ISSUE" ]] && DEPLOY_ISSUE=$(bd create "Deploy ${RELEASE_TAG}" -p 1 -t task -l "ops,deployment" --json | jq -r '.id')
> bd update "$DEPLOY_ISSUE" --status in_progress
> ```
>
> Always attach validation evidence to this issue and keep it open until post-deploy verification passes.

### 1. Dependency Health (bd)

```bash
bd ready --status open --tag ops
bd dep cycles
bd dep tree <ISSUE_KEY>
```

- Confirm the deployment ticket is unblocked and linked to all upstream issues (`blocks`, `related`).
- Attach CI and monitoring evidence to the issue as you progress.

### 2. Environment Hygiene

```bash
mise doctor
mise run install
mise run agent-deps
mise run test-agent # optional for hotfixes, mandatory otherwise
pnpm run test:ui
pnpm tsc --noEmit
```

- Load secrets via `.env` or `mise exec --env-file .env <command>`.
- Verify Supabase types are current: `supabase gen types typescript --linked --schema public,storage,graphql_public > supabase/types.ts`.

### 3. Schema & Data Guardrails

```bash
supabase db diff
supabase db lint
```

- If `supabase db diff` produces changes, review `supabase/migrations/0001_init.sql` before deploying; no ad hoc migrations allowed.
- Ensure backup window succeeds (check Supabase dashboard).

### 4. Telemetry Sanity

- Run `pnpm ts-node scripts/audit_telemetry_events.py --mode check`.
- Spot check dashboards: System Health, Mission Lifecycle, Integration Health (see below).
- Confirm `composio_discovery` vs `composio_tool_call` ratios follow the baseline.

Document validations on the bd issue before promoting builds.

---

## Deployment Playbooks

### Standard Deployment (Tier 1 & 2 Change)

1. Create or locate the deployment issue and capture the release identifier.
   ```bash
   DEPLOY_VERSION="2025.10.16"
   DEPLOY_ISSUE=$(bd ready --tag ops --json | jq -r 'map(select(.title|test("Deploy"))) | .[0].id // empty')
   [[ -z "$DEPLOY_ISSUE" ]] && DEPLOY_ISSUE=$(bd create "Deploy ${DEPLOY_VERSION} to production" -p 1 -t task -l "ops,deployment" --json | jq -r '.id')
   bd update "$DEPLOY_ISSUE" --status in_progress --assignee "$ONCALL_EMAIL"
   ```
2. Ensure the issue references evidence folders under `docs/readiness/`, attach CI links, and confirm blockers are mapped.
   ```bash
   bd dep tree "$DEPLOY_ISSUE"
   bd ready --tag ops
   bd comment "$DEPLOY_ISSUE" "Evidence: docs/readiness/${DEPLOY_VERSION}/"
   ```
3. Merge via CI after all gates pass and record build metadata in the issue (`bd comment` → CI URL, commit SHA, artifact hashes).
4. **Frontend (Next.js)**
   ```bash
   vercel deploy --prod --confirm
   bd comment "$DEPLOY_ISSUE" "Vercel deploy $(date -Is)"
   ```
5. **Agent Service (FastAPI)**
   ```bash
   ./scripts/deploy-agent.sh production
   # or manual
   (cd agent && docker build -t ai-employee-agent:latest .)
   flyctl deploy --image registry/ai-employee-agent:latest
   curl https://agent.production.example.com/health
   bd comment "$DEPLOY_ISSUE" "Fly deploy $(date -Is)"
   ```
6. **Post-Deploy Verification**
   - `pnpm ts-node scripts/audit_telemetry_events.py --mode spot`
   - Manual mission smoke test (Create → Plan → Execute → Reflect)
   - Post metrics to `#releases` including bd issue link and snapshot `bd ready --tag ops` output.
7. Close the deployment issue once verification completes.
   ```bash
   bd close "$DEPLOY_ISSUE" --reason "${DEPLOY_VERSION} live; telemetry stable"
   ```

### Canary Deployment (Tier 2 Feature under Flag)

1. Deploy fully with flag disabled and note the baseline in the deployment issue (`bd comment`).
2. Promote flag cohorts (10% → 50% → 100%) using Supabase console or feature admin API; track each cohort as a sub-task (`bd dep add <cohort-issue> <root-issue> --type parent-child`).
3. After each promotion, record a metrics snapshot in the bd issue: error rate, latency p95, safeguard violations, `bd ready --tag ops` output.
4. If metrics regress, pause and open a blocking issue via `bd create` + `bd dep add <deployment> <blocker> --type blocks`.
5. Roll back by disabling the flag or invoking `vercel rollback <deployment>`, then close or comment on the blocking issues accordingly.

### Emergency Hotfix

1. Spin a hotfix branch from `main`; create or update the SEV issue in `bd` with `priority=0` and `--tag hotfix`.
2. Set status to `in_progress` (`bd update <ISSUE> --status in_progress`) and document the reduced validation scope (`bd comment`).
3. Deploy directly to production; capture timestamps and commands inside the issue so the audit log stays complete.
4. Immediately after mitigation, run `bd ready --tag ops` to identify follow-up tasks and link them via `bd dep add`.
5. Within 24 hours, backfill missing evidence, schedule a post-incident review, and close the hotfix issue with a clear reason and timeline summary.

---

## Observability & Telemetry

### Dashboards

| Dashboard          | URL                                                           | What to Watch                                            | bd Integration                                         |
| ------------------ | ------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| System Health      | `https://monitoring.example.com/dashboards/system-health`     | Uptime ≥99.9%, error rate <1%, latency p95 <200ms        | Critical alert auto-opens `priority=0` issue           |
| Mission Lifecycle  | `https://monitoring.example.com/dashboards/mission-lifecycle` | Stage duration, completion %, safeguard adherence        | Stage regression posts comment to active release issue |
| Agent Performance  | `https://monitoring.example.com/dashboards/agent-performance` | Inspector/Planner/Executor success & latency             | Executor error >3% opens `toolkit`-tagged issue        |
| Integration Health | `https://monitoring.example.com/dashboards/integrations`      | Composio Connect Links, Supabase storage, CopilotKit SSE | OAuth failures >10% triggers governance escalation     |

### Logging & Redaction

- Centralised JSON logs with `bd_issue`, `tenantId`, `mission_id`, and `correlation_id` fields.
- Leverage helpers in `src/lib/telemetry/redaction.ts`; extend when new fields emerge.
- Ship logs to the aggregator with environment tags (`env=prod|staging|dev`).

```json
{
  "timestamp": "2025-10-16T14:32:18.457Z",
  "level": "ERROR",
  "service": "agent",
  "bd_issue": "BD-4521",
  "correlation_id": "req_abc123xyz",
  "event": "composio_tool_call",
  "toolkit": "gmail",
  "message": "RATE_LIMIT_EXCEEDED",
  "context": { "retry_after_seconds": 60 }
}
```

### Alerting Matrix

| Severity      | Trigger                                            | Action                                                                | bd Hook                                                |
| ------------- | -------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------ |
| Critical      | Service down >2m, Supabase outage, security breach | Page primary on-call, escalate to Engineering Lead, consider rollback | `bd create "SEV1: <summary>" -p 0 -t incident`         |
| Warning       | p95 latency >2× baseline, integration error >10%   | Investigate within 1 hour, scale or circuit-breaker as needed         | `bd update <ISSUE> --status in_progress --tag warning` |
| Informational | Feature flag change, traffic spike                 | Monitor dashboards, share in `#ai-control-plane`                      | Auto-comment on release issue via telemetry webhook    |

---

## Incident Management

### Severity Ladder

| Level | Definition                              | Response Goal              | Escalation                                          |
| ----- | --------------------------------------- | -------------------------- | --------------------------------------------------- |
| SEV-1 | Full outage, data loss, security event  | Mitigate within 5 minutes  | Primary on-call → Engineering Lead → VP Engineering |
| SEV-2 | Major feature down, ≥25% users impacted | Mitigate within 15 minutes | Primary on-call → Engineering Lead                  |
| SEV-3 | Degradation with workaround             | Restore within 1 hour      | On-call as lead, optional SME                       |
| SEV-4 | Cosmetic or low-risk                    | Resolve within 4 hours     | Async follow-up                                     |

### Lifecycle

1. **Detect & Triage (0-5 min)**

   ```bash
   INCIDENT=$(bd create "SEV1: <summary>" -p 0 -t incident -l "incident,sev1" --json | jq -r '.id')
   bd update "$INCIDENT" --status in_progress --assignee "$ONCALL_EMAIL"
   bd comment "$INCIDENT" "Symptoms, start time, affected tenants"
   ```

   - Announce in `#incidents` with the bd link and pager context.

2. **Mitigate & Contain (5-30 min)**
   - Roll back, toggle flags, scale resources, or enable circuit breaker.
   - Every 15 minutes run `bd comment "$INCIDENT" "Update…"` and attach Grafana screenshots, command logs, and `bd dep tree` output if new blockers appear.
   - Discover follow-up work with `bd create` and link via `bd dep add <follow-up> "$INCIDENT" --type discovered-from`.
3. **Resolve & Verify (30-120 min)**
   - Deploy fix/hotfix and validate mission flow, Composio trust signals, Supabase status.
   - Close the incident issue with a rich summary once impact is cleared:
     ```bash
     bd close "$INCIDENT" --reason "Mitigated at $(date -Is); root cause <summary>"
     ```
   - Create retrospective actions and chain them via `parent-child` dependencies before ending the call.
4. **Post-Incident (≤48 h)**
   - Schedule retro using template at `docs/readiness/runbooks/incident_template.md`.
   - Export `bd dep tree <ISSUE>` and attach to the write-up.

---

## Runbook Highlights

Runbooks are stored in `docs/readiness/runbooks/`. Keep the following memorised:

- **Frontend deployment failure** (`frontend_deploy.md`): rollback via Vercel, re-run `pnpm run test:ui`.
- **Agent outage** (`agent_health.md`): restart via Fly.io, capture `flyctl logs`, validate Composio tool success rate.
- **Supabase pool exhaustion** (`supabase_pool.md`): terminate long queries, ensure pgBouncer config matches limits.
- **Composio rate limit** (`composio_rate_limit.md`): throttle low-priority missions, check Connect Link completion funnel.
- **Evidence bundle failures** (`evidence_upload.md`): retry via admin endpoint, verify storage quota, review RLS policies.
- **Beads database corruption or missing** (`beads_db.md`): re-run `bd init`, restore `.beads/` from git, confirm `bd list` works before resuming operations.

When creating new runbooks, append them to `docs/readiness/runbooks/` and link from the related bd issue with `discovered-from` dependencies.

---

## Maintenance & Automation

- **Scheduled Maintenance** (quarterly, Sundays 02:00–06:00 UTC)
  - Announce via Status Page, Slack, and in-app banner.
  - Create a parent issue: `MAINT=$(bd create "Scheduled maintenance <date>" -p 2 -t task -l maintenance --json | jq -r '.id')`.
  - Break work into subtasks (`bd create ...`, `bd dep add <subtask> "$MAINT" --type parent-child`) and confirm the tree with `bd dep tree "$MAINT"`.
  - During execution, update each subtask with `bd update` status changes; capture evidence links via `bd comment`.
  - Monitor for 4 hours post-window and close all related issues with precise timestamps.
- **Emergency Maintenance**
  - Triggered by critical CVEs or partner-mandated upgrades.
  - Open a `priority=0` issue tagged `maintenance,hotfix` and assign the on-call engineer.
  - Document expedited approvals, mitigation steps, and follow-up actions directly in the issue thread.
  - Once stability returns, convert temporary work into sub-issues and link via `parent-child` or `discovered-from` dependencies.
- **Automation Hooks**
  - Slack bot posts bd-ready queue summary each morning.
  - GitHub Actions update bd issues with CI status.
  - Supabase backup job success/failure pings `#ai-control-plane`.

---

## Contacts & References

| Role              | Contact            | Notes                                          |
| ----------------- | ------------------ | ---------------------------------------------- |
| Primary On-Call   | PagerDuty rotation | Weekly rotation; acknowledges within 5 minutes |
| Secondary On-Call | PagerDuty backup   | Steps in if primary is unreachable             |
| Engineering Lead  | `@eng-lead`        | Approves hotfixes and SEV escalations          |
| Security Lead     | `@security-lead`   | Leads security incidents, audit log reviews    |
| Database Lead     | `@db-lead`         | Consulted for Supabase issues                  |
| Product Partner   | `@product-manager` | Coordinates customer comms                     |

**Document Links**

- `docs/11_issue_tracking.md` — Detailed bd usage and automation hooks
- `docs/09_release_readiness.md` — Evidence requirements and sign-offs
- `docs/06_data_intelligence.md` — Telemetry specs and alert thresholds
- `docs/04_implementation_guide.md` — Deployment architecture
- `docs/08_getting_started.md` — Environment setup for operators

---

**Document Owner:** Operations Team
**Last Updated:** October 16, 2025
**Next Review:** January 2026
**Feedback:** Submit PR tagged with `ops-playbook` or comment on the bd maintenance issue
