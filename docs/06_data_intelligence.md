# AI Employee Control Plane: Data Intelligence Playbook

**Version:** 3.0 (October 16, 2025)
**Audience:** Data Engineering, Analytics, Product Operations, Governance, Agent Platform Engineering
**Status:** Authoritative reference for telemetry, analytics, and learning loops

> **Foundation Stage Note (October 2025):** Telemetry flows involving Gemini ADK agents and Composio SDK are **design specifications**. The current backend is scaffolded with TODO markers, and no production event streams exist yet. Use this playbook to plan instrumentation once agents, Composio calls, and evals are wired up.
**Lifecycle Alignment:** Home → Define → Prepare → Plan → Approve → Execute → Reflect

---

## 1. Intelligence Philosophy

Data intelligence in the Control Plane turns every mission into evidence for the next one. The documentation suite builds a consistent story across `docs/00_README.md` (lifecycle), `docs/02_system_overview.md` (architecture), `docs/03_user_experience.md` (UX guardrails), and `docs/examples/*` (illustrative mission stories). This playbook codifies the analytics layer that powers trust and iteration.

- **Lifecycle telemetry as product surface.** Instrument each stage so operators, approvers, and governance see status in real time. Mission readiness badges, alert rails, and undo windows all rely on structured events.
- **Closed-loop learning.** Planner, Validator, and Library agents adapt prompts and retrieval based on telemetry and feedback. Loops in §5 tie to the Capability Roadmap (`docs/05_capability_roadmap.md`).
- **Privacy by design.** Redact before persistence (`src/lib/telemetry/redaction.ts`), apply sensible retention policies, and keep audit trails accessible for governance (`docs/07_operations_playbook.md`).
- **Role clarity.** Dashboards and metrics map to the audiences showcased in `docs/examples/*` so any operator—regardless of title—sees the signals that matter most.
- **Telemetry is contract, not afterthought.** Every UI wireframe and API TODO references events in this document (see comments in `src/app/api/**` and `agent/agent.py`).

---

## 2. Data Architecture Overview

### 2.1 End-to-End Mission Data Flow

```mermaid
flowchart LR
  subgraph Workspace
    Home[Home Overview]
    Define[Define Stage UI]
    Prepare[Prepare Stage UI]
    Plan[Plan Stage UI]
    Approve[Approve Stage UI]
    Execute[Execute Stage UI]
    Reflect[Reflect Stage UI]
  end

  subgraph Agents & Services
    ADKAgents[Gemini ADK Agents]
    Composio[Composio SDK]
    CopilotKit[CopilotKit Stream]
  end

  subgraph Telemetry Ingestion
    TelemetryClient[Telemetry Client]
    Redaction[Redaction Helpers]
    TelemetryAPI[/api/telemetry]
  end

  subgraph Storage & Processing
    TelemetryEvents[(telemetry_events)]
    MissionTables[(missions + metadata)]
    Connections[(mission_connections)]
    Sessions[(mission_sessions)]
    Undo[(undo_events)]
    Library[(library_entries + embeddings)]
    Views[(analytics views)]
  end

  subgraph Outputs
    Dashboards[Executive • Governance • Operations • Adoption • Agent Performance]
    Evidence[Evidence Bundles]
    Learning[Prompt Store • Library Boosts]
  end

  Home --> TelemetryClient
  Define --> TelemetryClient
  Prepare --> TelemetryClient
  Plan --> TelemetryClient
  Approve --> TelemetryClient
  Execute --> TelemetryClient
  Reflect --> TelemetryClient

  ADKAgents --> TelemetryAPI
  Composio --> TelemetryAPI
  CopilotKit --> TelemetryClient

  TelemetryClient --> Redaction
  Redaction --> TelemetryAPI
  TelemetryAPI --> TelemetryEvents
  TelemetryAPI --> MissionTables
  TelemetryAPI --> Connections
  TelemetryAPI --> Sessions
  TelemetryAPI --> Undo
  TelemetryAPI --> Library

  TelemetryEvents --> Views
  Views --> Dashboards
  TelemetryEvents --> Evidence
  Evidence --> Dashboards
  TelemetryEvents --> Learning
  Library --> Learning
  Learning --> Plan
```

### 2.2 Core Data Surfaces

**Mission & Lifecycle Tables (Supabase `0001_init.sql`):**

- `missions`, `mission_metadata`, `mission_stage_status` — lifecycle status and timestamps.
- `mission_connections` — Inspector-approved Connect Link events with scopes and expiry (Stage 2).
- `mission_sessions` — ADK session snapshots keyed by agent type for lag and token analysis.
- `mission_approvals` — Approve stage decisions with approver role, rationale, and timestamps.
- `mission_artifacts`, `mission_evidence` — Evidence bundles referenced in Reflect stage.
- `mission_feedback` — Ratings, effort saved, blocker notes for learning loops.

**Telemetry & Audit Tables:**

- `telemetry_events` — Canonical event log (schema in §2.3).
- `workspace_stream_sessions` — CopilotKit SSE sessions with sampling mode and disconnect telemetry.
- `composio_audit_events` — Discovery, OAuth, tool execution, and error outcomes from the Composio SDK.
- `undo_events` — Planned and executed rollback steps, including validator context (Stage 5).

**Analytics & Library:**

- Materialized views defined in the analytics section of the consolidated migration: `executive_summary`, `governance_insights`, `operations_health`, `adoption_funnel`, `agent_performance`.
- `library_entries` + `library_embeddings` (pgvector) — curated plays and semantic search corpus powering Planner recommendations.

### 2.3 Telemetry Client & API Contracts

**Frontend Telemetry (Next.js):**

- `src/app/(control-plane)/workspace/**` pages call a shared telemetry hook (TODO in `docs/04_implementation_guide.md` §5) that batches up to 50 events per 5 seconds before posting to `/api/telemetry`.
- Redaction helpers live alongside the hook; they call `src/lib/telemetry/redaction.ts` (see UX TODOs) before payload submission.
- All UI components stamp `mission_id`, `tenantId`, and `stage` to keep analytics joinable.

**Backend Telemetry (Gemini ADK + FastAPI):**

- `agent/agent.py` and future `agent/services/*` modules funnel events through a `TelemetryClient.track(event, context)` helper that retries on Supabase rate limits.
- ADK agents emit structured events via streaming yields (`session_heartbeat`, `planner_candidate_generated`, etc.) as described in `docs/04_implementation_guide.md` §3.
- Composio SDK hooks (`client.tools.execute`, `client.toolkits.get`, `client.connected_accounts.initiate`) emit `composio_*` events prior to returning provider data.

**Canonical Schema (`telemetry_events`):**

```sql
CREATE TABLE telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  stage TEXT CHECK (stage IN (
    'Home',
    'Define',
    'Prepare',
    'Plan',
    'Approve',
    'Execute',
    'Reflect'
  )),
  status TEXT CHECK (status IN ('info', 'success', 'warning', 'error')),
  context JSONB NOT NULL,
  payload_sha TEXT,
  mission_id UUID REFERENCES missions(id),
  tenant_id UUID,
  user_id TEXT,
  agent_name TEXT,
  correlation_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_telemetry_mission ON telemetry_events (mission_id, created_at DESC);
CREATE INDEX idx_telemetry_stage ON telemetry_events (stage, event_type);
CREATE INDEX idx_telemetry_correlation ON telemetry_events (correlation_id);
```

Use `scripts/audit_telemetry_events.ts` (see §7) to keep the event catalog in sync with this schema.

---

## 3. Event Catalog by Mission Stage

All telemetry eventually lands in `telemetry_events`. Stage naming matches the lifecycle used across documentation and UI copy. When UI specs in `docs/03_user_experience.md` use variants (e.g., `brief_field_edited`), instrumenters should emit the canonical name listed below and record aliases in `context.aliases` if needed.

### 3.1 Stage 0: Home (Mission Launcher)

| Event | Triggered By | Context Fields | Analytics Use |
|-------|--------------|----------------|---------------|
| `home_tile_opened` | Workspace shell renders mission list | `missions_visible`, `filter_state` | Track entry points, mission load performance |
| `readiness_badge_rendered` | Mission tile shows readiness state | `mission_id`, `badge_state` (ready/needs-auth/needs-data/blocked), `blocking_reason` | Readiness trend, blocker backlog |
| `alert_rail_viewed` | Alert rail focus/scroll | `alert_count`, `alert_types`, `time_to_first_view` | Urgency accuracy, alert fatigue |
| `mission_list_action_taken` | User clicks mission, approvals, or library item | `action_type` (open/approve/library), `mission_stage`, `needs_attention` | Funnel from Home to downstream stages |

### 3.2 Stage 1: Define

| Event | Triggered By | Context Fields | Analytics Use |
|-------|--------------|----------------|---------------|
| `intent_submitted` | Mission intent form submit | `intent_length`, `source` (template/freeform) | Demand volume, intent complexity |
| `brief_generated` | IntakeAgent chips produced | `chip_count`, `confidence_scores`, `generation_latency_ms`, `template_id` | Generative quality, token usage |
| `brief_item_modified` | Chip edit (UI) | `chip_type`, `edit_type`, `token_diff`, `aliases` (`brief_field_edited`) | Prompt tuning signals (Loop 1) |
| `mission_brief_locked` | Operator locks Define stage | `safeguard_count`, `time_to_lock_seconds`, `edits_before_lock` | Stage completion velocity |
| `safeguard_added` | Manual safeguard inserted | `category`, `reason_code` | Governance coverage, manual guardrails |

### 3.3 Stage 2: Prepare

| Event | Triggered By | Context Fields | Analytics Use |
|-------|--------------|----------------|---------------|
| `composio_discovery` | InspectorAgent search | `query`, `toolkit_count`, `latency_ms`, `coverage_estimate` | Catalog coverage, discovery latency |
| `toolkit_recommended` | Inspector ranking | `toolkit_slug`, `rank`, `precedent_count`, `auth_required` | Recommendation precision |
| `toolkit_connected` | Connect link success | `toolkit_slug`, `scopes_granted`, `connector_latency_ms` | OAuth conversion, auth friction |
| `composio_auth_flow` | OAuth request lifecycle | `toolkit`, `status` (initiated/approved/expired), `scopes_requested`, `connect_link_id` | Progressive trust (Plan readiness) |
| `data_preview_generated` | Inspection preview created | `toolkit`, `sample_count`, `pii_flags`, `duplicate_cluster_count` | Data cleanliness, coverage |
| `readiness_status_changed` | Readiness badge update | `status`, `coverage_percent`, `blocking_items` | Stage gate monitoring |
| `coverage_preview_opened` | User expands coverage pane | `toolkit`, `field_summary`, `time_to_view` | Engagement with inspection outputs |
| `governance_override_requested` | Governance toggles scope or policy | `override_type`, `requested_by`, `rationale` | Compliance review workload |

### 3.4 Stage 3: Plan

| Event | Triggered By | Context Fields | Analytics Use |
|-------|--------------|----------------|---------------|
| `planner_candidate_generated` | PlannerAgent yields play | `play_id`, `confidence`, `library_precedent_count`, `tool_usage_pattern`, `undo_plan_included` | Play diversity, retrieval balance |
| `plan_ranked` | Planner orders plays | `play_ids_ordered`, `ranking_method`, `validator_critique`, `aliases` (`planner_generated`) | Ranking quality (Loop 2) |
| `plan_adjusted` | Operator tweaks parameters | `adjustment_type`, `before_value`, `after_value`, `reason_note` | Adjustment hotspots, UI tuning |
| `plan_selected` | Operator chooses play for approval | `play_id`, `selection_method` (auto/manual), `reason_note`, `undo_plan_id` | Selection clarity, play win rates |
| `validator_scope_check` | Validator verifies scopes | `required_scopes`, `granted_scopes`, `alignment_status` | Inspector → Planner handshake quality |

### 3.5 Stage 4: Approve

| Event | Triggered By | Context Fields | Analytics Use |
|-------|--------------|----------------|---------------|
| `approval_requested` | Owner assigns approver | `approval_type` (plan/toolkit/safeguard), `approver_role`, `due_at`, `play_id` | Approval queue health |
| `approval_delegated` | Approval reassigned | `from_role`, `to_role`, `reason`, `delegated_by` | Workload balancing |
| `approval_granted` | Approver confirms play | `play_id`, `approver_role`, `approval_timestamp`, `undo_window_seconds` | Time-to-approve, trust signals |
| `approval_rejected` | Approver declines | `play_id`, `rejection_reason`, `feedback_note` | Negative signal for planner tuning |
| `audit_event_recorded` | Approval exported to audit | `mission_id`, `artifact_hash`, `export_format`, `approver_role` | Governance traceability |

### 3.6 Stage 5: Execute

| Event | Triggered By | Context Fields | Analytics Use |
|-------|--------------|----------------|---------------|
| `execution_started` | ExecutorAgent begins mission | `play_id`, `action_count`, `estimated_duration_seconds` | Stage start tracking |
| `execution_step_completed` | Action finished | `action_id`, `toolkit`, `action_name`, `duration_ms`, `status`, `aliases` (`execution_step_updated`) | Step latency, bottlenecks |
| `composio_tool_call` | Tool call succeeded | `toolkit`, `action`, `duration_ms`, `outcome`, `token_usage` | Provider health, rate limit trends |
| `composio_tool_call_error` | Tool call failed | `toolkit`, `action`, `error_code`, `retry_after_seconds`, `recovery_action` | Error triage, resilience |
| `validator_alert_raised` | Safeguard check triggered | `severity`, `safeguard_id`, `auto_fix_attempted`, `auto_fix_status` | Safeguard effectiveness |
| `validator_override_requested` | Human override | `safeguard_id`, `override_reason`, `approver_role` | Manual governance load |
| `undo_available` | Undo window announced | `undo_plan_id`, `time_remaining_seconds`, `impact_summary` | Undo readiness, operator confidence |
| `undo_requested` | Operator triggers rollback | `undo_plan_id`, `reason`, `initiated_by` | Undo usage analytics |
| `undo_completed` | Rollback executed | `undo_plan_id`, `actions_reversed`, `duration_ms`, `outcome` | Undo efficacy (target ≥95%) |
| `session_heartbeat` | ADK Runner heartbeat | `agent_name`, `lag_ms`, `token_usage`, `session_state_size_bytes` | Agent performance (Agent dashboard) |

### 3.7 Stage 6: Reflect

| Event | Triggered By | Context Fields | Analytics Use |
|-------|--------------|----------------|---------------|
| `mission_completed` | Mission marked done | `total_duration_seconds`, `stage_durations`, `outcome_summary` | End-to-end throughput |
| `evidence_opened` | Evidence gallery item opened | `artifact_id`, `artifact_type`, `redaction_applied` | Evidence consumption |
| `feedback_submitted` | Feedback drawer submit | `rating`, `effort_saved_hours`, `blockers`, `qualitative_notes` | Satisfaction, theme clustering |
| `followup_scheduled` | Follow-up checklist item created | `task_type`, `due_at`, `owner_role`, `bd_issue` (optional) | Follow-up accountability; link to `bd` issue for operational tracking |
| `library_contribution` | Artifact promoted to library | `artifact_id`, `library_category`, `reuse_potential_score` | Library growth (Loop 4) |
| `mission_retrospective_logged` | Retrospective summary generated | `impact_metrics`, `safeguard_compliance`, `next_actions` | Governance reporting, play refinement |

**Beads Integration Note:** Follow-up actions can be captured as `bd` issues and tracked operationally. When operators create follow-ups using `bd create`, they can link the mission using `bd dep add` for audit trails. See `docs/11_issue_tracking.md` §2 (Core Workflow) and `docs/07_operations_playbook.md` for deployment and incident tracking patterns.

### 3.8 Cross-Stage & Platform Events

| Event | Triggered By | Context Fields | Analytics Use |
|-------|--------------|----------------|---------------|
| `workspace_stream_open` | CopilotKit SSE connection | `session_id`, `stage`, `telemetry_disabled`, `sampling_mode` | Streaming health, sampling adjustments |
| `inspection_viewed` | Inspection panel opened | `toolkit`, `stage`, `has_preview`, `time_on_panel` | Engagement with investigative context |
| `approval_exported` | Approval summary exported | `format`, `mission_id`, `requested_by` | Audit fulfillment |
| `incident_opened` | Incident created | `severity`, `component`, `initiator`, `mission_ids`, `bd_issue` (recommended) | Incident correlation; link to operational `bd` issue |
| `incident_resolved` | Incident closed | `resolution_time_minutes`, `root_cause`, `follow_up_actions`, `bd_issue` | MTTR tracking |

**Operational Workflow:** Incident events should include a `bd_issue` field linking to the operational tracker. Operators create incidents using `bd create "SEV1: <summary>" -p 0 -t incident` and update status throughout the lifecycle. See `docs/07_operations_playbook.md` §Incident Management and `docs/11_issue_tracking.md` for complete workflows.

### 3.9 Stage-to-Event Matrix

| Stage | Primary Events | Secondary & Alias Events |
|-------|----------------|--------------------------|
| **Stage 0 — Home** | `home_tile_opened`, `readiness_badge_rendered`, `alert_rail_viewed` | `mission_list_action_taken`, `approval_opened` |
| **Stage 1 — Define** | `intent_submitted`, `brief_generated`, `brief_item_modified`, `mission_brief_locked` | `safeguard_added`, alias `brief_field_edited` |
| **Stage 2 — Prepare** | `composio_discovery`, `toolkit_recommended`, `toolkit_connected`, `composio_auth_flow`, `data_preview_generated`, `readiness_status_changed` | `coverage_preview_opened`, `governance_override_requested` |
| **Stage 3 — Plan** | `planner_candidate_generated`, `plan_ranked`, `plan_selected` | `plan_adjusted`, `validator_scope_check` |
| **Stage 4 — Approve** | `approval_requested`, `approval_delegated`, `approval_granted`, `approval_rejected` | `audit_event_recorded`, `approval_exported` |
| **Stage 5 — Execute** | `execution_started`, `execution_step_completed`, `composio_tool_call`, `validator_alert_raised`, `undo_available`, `session_heartbeat` | `composio_tool_call_error`, `validator_override_requested`, `undo_requested`, `undo_completed` |
| **Stage 6 — Reflect** | `mission_completed`, `feedback_submitted`, `library_contribution` | `evidence_opened`, `mission_retrospective_logged`, `followup_scheduled` |

Maintain test fixtures for this catalog in `agent/evals/mission_end_to_end.evalset.json` and keep the release checklist items in `docs/09_release_readiness.md` synced.

---

## 4. Role-Specific Analytics Dashboards

Materialized views refresh via Supabase cron (nightly unless noted). Each dashboard references mission templates and workflows described in `docs/examples/*` and `docs/07_operations_playbook.md`.

### 4.1 Executive Dashboard — `views/executive_summary`

- **Audience:** Product leadership, GTM stakeholders.
- **Purpose:** Business impact and adoption trends across tenants and mission categories.
- **Key Metrics:** Weekly approved missions, intent → execution conversion, automation coverage (% missions with ≥3 toolkits), pipeline impact, time-to-value (Define → Execute duration).
- **Visuals:** Multi-line trend by mission category, conversion funnel, stacked bar for mission types, outcome tooltip linking to evidence bundles.
- **Cadence:** Nightly refresh.
- **Reference:** `docs/01_product_vision.md` (value narrative) and `docs/examples/revops.md` (sample success story).

### 4.2 Governance Dashboard — `views/governance_insights`

- **Audience:** Governance officers, compliance leads, trust engineering.
- **Purpose:** Safeguard adherence, undo efficacy, incident coverage.
- **Key Metrics:** Manual safeguard edit rate (target <20%), validator override rate, undo success (target ≥95%), incident count by severity, approval latency, scope compliance (Inspector vs Planner alignment).
- **Alerts:** Undo success <95% (7-day rolling), validator override >10% WoW, incident MTTR >30 minutes.
- **Visuals:** Timeline with safeguard interventions, heatmap of validator alerts by toolkit, incident cards linking to runbooks (`docs/07_operations_playbook.md`).
- **Cadence:** Hourly aggregates; real-time tiles for active missions.

### 4.3 Operations Dashboard — `views/operations_health`

- **Audience:** SRE, on-call ops, platform engineering.
- **Purpose:** System health across CopilotKit, ADK agents, Composio integrations, and Supabase infrastructure.
- **Key Metrics:** Stage transition latency percentiles, SSE heartbeat success rate, Composio rate-limit incidence, planner error rate, ADK lag (from `session_heartbeat`), Supabase connection pool utilization, incident backlog.
- **Integrations:** Datadog overlays for infrastructure metrics, PagerDuty events for incident correlation.
- **Cadence:** Real-time streaming (Supabase real-time) with 1-minute aggregation.
- **Reference:** `docs/07_operations_playbook.md` (Runbooks 2–5).

### 4.4 Adoption & Growth Dashboard — `views/adoption_funnel`

- **Audience:** Product ops, GTM enablement, customer success.
- **Purpose:** Funnel visibility from Home readiness to Reflect-stage outcomes.
- **Key Metrics:** Intent submissions, brief acceptance (% locked without edits), toolkit connection rate, activation approvals, mission completion, library reuse rate, template vs freeform starts.
- **Visuals:** Persona-segmented funnel, cohort retention curves, feature usage timelines (live checklist, undo interactions, library contributions).
- **Cadence:** Nightly refresh with week-over-week change indicators.
- **Reference:** Examples in `docs/examples/support_leader.md` and `docs/examples/compliance_audit.md` for adoption cues.

### 4.5 Agent Performance Dashboard — `views/agent_performance`

- **Audience:** Agent platform engineers, ML team.
- **Purpose:** Diagnose ADK agent coordination, token budgets, and session state growth.
- **Key Metrics:** Latency and token usage per agent (`session_heartbeat`), library retrieval latency, auto-fix success rate, tool execution outcome mix, session state size drift.
- **Visuals:** Box plots per agent, session state vs latency scatter, error outcome heatmap.
- **Cadence:** 15-minute refresh or on-demand during incident investigation.
- **Reference:** `docs/04_implementation_guide.md` §3 (agent responsibilities) and `docs/readiness/agent-evals/summary.md` (evaluation signals).

---

## 5. Learning Loops

Learning loops keep telemetry actionable. Each loop aligns with milestones in `docs/05_capability_roadmap.md` and evaluation gates in `docs/readiness/agent-evals/summary.md`.

### 5.1 Loop A — Generative Quality (Define)

- **Goal:** Reduce chip edits and accelerate brief lock.
- **Signals:** `brief_item_modified`, `mission_brief_locked`, feedback mentions of tone/clarity.
- **Actions:** Weekly review of chip edit deltas, prompt tuning for IntakeAgent (see `agent/agents/intake.py` once implemented), regression tests via `intake_quality` eval set.
- **Success Metrics:** ≥80% briefs locked without edits, <2 average chip edits, time-to-lock <2 minutes.

### 5.2 Loop B — Planner Excellence (Plan → Approve)

- **Goal:** Lift first-play selection through approval and tighten ranking confidence.
- **Signals:** `plan_ranked`, `plan_selected`, `approval_granted`, `approval_rejected`, validator critiques, library precedent counts, readiness coverage metrics from Stage 2.
- **Actions:** Analyze rejection and delegation reasons weekly, adjust hybrid weighting in PlannerAgent, compare coverage vs approval correlation using Supabase analytics views, validate with `ranking_quality` and `mission_end_to_end` eval sets.
- **Success Metrics:** ≥70% selected play approved without revision, rejection rate <15%, library reuse ≥40%, validator high-severity alerts <20%.

### 5.3 Loop C — Safeguard Reinforcement (Prepare → Execute)

- **Goal:** Minimize manual safeguard edits and overrides.
- **Signals:** `safeguard_added`, `validator_alert_raised`, `validator_override_requested`, governance feedback in `docs/examples/compliance_audit.md`.
- **Actions:** Cluster override reasons, update safeguard prompt templates, tune Validator auto-fix logic, run `execution_safety` eval set before deploy.
- **Success Metrics:** Manual safeguard edit rate <20%, auto-fix success ≥80%, overrides <10% of missions, high-severity alerts <5%.

### 5.4 Loop D — Library Growth (Execute → Reflect)

- **Goal:** Grow high-quality reusable plays and reinforce Planner retrieval.
- **Signals:** `library_contribution`, library reuse counts in `plan_ranked`, mission feedback ratings.
- **Actions:** Encourage operators to contribute after ≥4★ missions, embed context with pgvector, monitor reuse in adoption dashboard, prune low-performing entries quarterly.
- **Success Metrics:** Library reuse ≥40% of missions, contribution rate ≥25% for high-rated missions, reused play approval ≥80%.

---

## 6. Data Governance & Privacy

### 6.1 Redaction & Privacy Controls

- Use `src/lib/telemetry/redaction.ts` for client-side scrubbing (emails, phone numbers, account IDs) before events leave the workspace.
- Record `context.redaction_applied = true` for events that touch sensitive payloads (evidence previews, tool outputs).
- Maintain allowlist of non-redacted identifiers (mission IDs, hashed user references) per `docs/10_composio.md`.

### 6.2 Retention & Purge Schedule

- Raw telemetry: 180 days (configurable per tenant).
- Evidence bundles: 365 days (SOC2 requirement).
- Mission sessions: 90 days.
- Aggregated analytics views and library embeddings: indefinite (no PII).
- Weekly Supabase cron purges expired telemetry and session records; log summary via `metrics_refresh_completed` event.

### 6.3 Access & RLS Policies

- Apply role-based filters in Supabase: operators see missions they own, governance roles see cross-tenant telemetry, analytics roles have read-only telemetry access.
- Approval exports, incident logs, and undo events remain accessible to governance even when telemetry sampling is reduced.
- Reference RLS patterns in `docs/02_system_overview.md` §Security and `docs/09_release_readiness.md` §Governance Checklist.

### 6.4 Compliance Hooks

- Approvals emit `audit_event_recorded`; ensure evidence bundles include approval notes and undo plans (`docs/examples/compliance_audit.md`).
- Incident response follows `docs/07_operations_playbook.md` Runbook — include telemetry snapshots and redaction audits.
- GDPR/CCPA requests rely on aggregated telemetry export scripts (planned under `/scripts`) and manual confirmation of purged records.

---

## 7. Tooling & Automation

Even before scripts ship, track the placeholders so automation lands in the right place.

### 7.1 Telemetry Audits (CI Gate)

- **Command:** `pnpm run audit:telemetry`
- **Purpose:** Ensure all catalogued events exist in the codebase, stages align, and required context fields are present.
- **Report Mode:** `--mode report --output docs/readiness/telemetry_coverage.md`
- **CI Integration:** Required on PRs touching telemetry, UI workflows, or ADK agents (`docs/09_release_readiness.md`).

### 7.2 Redaction Spot Checks

- **Command:** `pnpm ts-node scripts/audit_redaction.py --sample-size 1000`
- **Purpose:** Sample recent telemetry to confirm no PII leaks (emails, phone numbers, customer IDs).
- **Outputs:** Summary appended to `docs/readiness/agent-evals/summary.md` for Gate sign-off.

### 7.3 Analytics View Refresh

- **Command:** `pnpm ts-node scripts/run_metrics_refresh.py --view <name>` (defaults to all views).
- **Purpose:** Refresh materialized views, verify completion within SLA (Exec ≤5 min, others ≤10 min), emit `metrics_refresh_completed` event on success.
- **Scheduling:** Nightly Supabase cron at 02:00 UTC.

### 7.4 Evidence Bundle Export

- **Command:** `pnpm ts-node scripts/export_evidence_bundle.py --mission-id <uuid> --output <file>`
- **Purpose:** Package mission metadata, telemetry slice, validator notes, and artifacts for governance reviewers or customers.
- **Compliance:** Always include redaction manifest and undo plan summary.

### 7.5 Evaluation Gates

- `mise run test-agent` (per PR + nightly) keeps `mission_end_to_end` telemetry expectations green.
- `uv run ruff check agent` (from `docs/04_implementation_guide.md`) ensures Python telemetry instrumentation stays typed and linted.
- `pnpm run test:ui` verifies mission stage components still emit required events (hooks referenced in TODOs).

---

## 8. Reporting Cadence

- **Daily (Ops):** SSE latency (p95 <500 ms), telemetry ingestion volume vs baseline, Composio error spikes, agent lag anomalies. Share in `#ai-control-plane-health` (per `docs/07_operations_playbook.md`).
- **Weekly (Product Ops):** Executive summary with adoption funnel, top mission types, safeguard hotspots, feedback themes. Archive in internal workspace and link evidence bundles.
- **Monthly (Analytics):** Persona deep dive (RevOps, Support, Governance, Engineering) including toolkit coverage, stage velocity, satisfaction distribution. Align with examples in `docs/examples/*`.
- **Quarterly (Governance):** Undo efficacy, validator overrides, incident retrospectives, compliance export confirmation. Feed outputs into `docs/09_release_readiness.md` checklist.
- **Ad-hoc:** Incident retrospectives, experiment readouts (planner weighting, safeguard prompts), partner integration reviews. Telemetry snapshots accompany each runbook entry.

---

## 9. Future Investments

Roadmap items tracked in `docs/05_capability_roadmap.md` (§Learning & Intelligence) should reference this playbook when adding new telemetry.

1. **Predictive Confidence Scoring:** Train a model that estimates execution success prior to approval using coverage, precedent strength, and validator critiques. Display confidence badges in Plan stage and validate against historical `mission_completed` outcomes.
2. **Autonomous Prompt Patching:** Use clustered `brief_item_modified` and `validator_override_requested` signals to suggest prompt updates. Keep humans in the loop via governance review before deployment.
3. **Library Recommendation Marketplace:** Extend library reuse beyond single tenant while respecting privacy (share only redacted embeddings). Track cross-tenant reuse rate and governance review turnaround.
4. **Anomaly Detection:** Apply statistical baselines to telemetry streams (tool call spikes, edit bursts, incident clusters) and surface anomalies directly in Operations dashboard with runbook shortcuts.

---

## 10. Appendix — Reference Tables

### 10.1 Event Quick Reference

| Event | Stage | Notes |
|-------|-------|-------|
| `home_tile_opened` | Home | Entry to mission workspace from Home overview |
| `readiness_badge_rendered` | Home | Badge states: ready, needs-auth, needs-data, blocked |
| `intent_submitted` | Define | Capture template vs freeform intent |
| `brief_item_modified` | Define | Set `context.aliases = ['brief_field_edited']` when UI surfaces variant |
| `composio_discovery` | Prepare | Inspector no-auth tool search |
| `toolkit_connected` | Prepare | Inspector or operator completed OAuth |
| `plan_ranked` | Stage 3 — Plan | Include ranking method and validator critique summary |
| `approval_requested` | Stage 4 — Approve | Drives governance SLA metrics |
| `composio_tool_call` | Stage 5 — Execute | Include `outcome` (`success`, `rate_limit`, `auth_expired`, etc.) |
| `undo_available` | Stage 5 — Execute | Must fire before any irreversible action |
| `session_heartbeat` | Stage 5 — Execute | Lists agent lag and token usage every 30s |
| `feedback_submitted` | Stage 6 — Reflect | Contains quantitative (rating, effort saved) + qualitative fields |
| `library_contribution` | Stage 6 — Reflect | Add mission linkage for future retrieval |

### 10.2 Telemetry Hygiene Checklist

- Event emitted for each lifecycle transition (Home → Reflect).
- `mission_id`, `tenantId`, `stage`, and `correlation_id` present in context.
- PII redaction applied before persistence and logged via `context.redaction_applied`.
- Alias fields documented when UI uses legacy names (e.g., `brief_field_edited`).
- Supabase indices refreshed after schema change (run `scripts/run_metrics_refresh.py`).
- Eval sets updated when new events added (`mission_end_to_end` golden traces regenerated).

### 10.3 Related Documents

- `docs/00_README.md` — Lifecycle overview and reading paths.
- `docs/02_system_overview.md` — Architecture and mission data flow (mirrors §2).
- `docs/03_user_experience.md` & `docs/03a_chat_experience.md` — Stage-specific telemetry expectations.
- `docs/04_implementation_guide.md` — Telemetry hooks in Next.js and ADK agents.
- `docs/05_capability_roadmap.md` — Learning & Intelligence milestones.
- `docs/07_operations_playbook.md` — Monitoring, incident response, undo runbooks.
- `docs/09_release_readiness.md` — Telemetry coverage and governance checklists.
- `docs/examples/*` — Persona journeys with sample event streams.
- `docs/readiness/agent-evals/summary.md` — Evaluation cadence tied to telemetry.
- `libs_docs/composio/llms.txt`, `libs_docs/copilotkit/llms-full.txt`, `libs_docs/adk/llms-full.txt`, `libs_docs/supabase/llms_docs.txt` — Partner SDK references for telemetry semantics.

---

**Document Owner:** Data Intelligence Team  
**Next Review:** January 2026  
**Feedback:** Open an issue referencing this document or drop context in `docs/readiness/feedback/` when the folder lands.
