# AI Employee Control Plane — Agent Implementation Roadmap

**Version:** 1.1 (October 8, 2025)
**Audience:** Coding agents, runtime stewards, implementation squads
**Status:** Active gate-by-gate execution tracker

---

## Quick Navigation

| Gate    | Focus                  | Jump                                              |
| ------- | ---------------------- | ------------------------------------------------- |
| **G-A** | Foundation scaffolding | [→ Gate G-A](#gate-g-a--foundation-baseline)      |
| **G-B** | Dry-run proof loop     | [→ Gate G-B](#gate-g-b--dry-run-proof-loop)       |
| **G-C** | Governed activation    | [→ Gate G-C](#gate-g-c--governed-activation-core) |
| **G-D** | Analytics & library    | [→ Gate G-D](#gate-g-d--insight--library-fabric)  |
| **G-E** | Scale hardening        | [→ Gate G-E](#gate-g-e--scale-hardening)          |
| **G-F** | Stabilized operations  | [→ Gate G-F](#gate-g-f--stabilised-operations)    |

**Cross-references:**

- Architecture blueprint: [new_docs/architecture.md](./architecture.md)
- Business requirements: [new_docs/prd.md](./prd.md)
- UX blueprint: [new_docs/ux.md](./ux.md)

---

## Purpose & Execution Model

This roadmap governs all implementation work from zero-privilege proofs to governed activation. Each gate defines:

1. **Actionable checklists** — Discrete tasks with clear done states
2. **Acceptance criteria** — Instrumentation and verification steps
3. **Evidence artifacts** — Required outputs for gate promotion
4. **Cross-doc references** — Links to architecture, PRD, and UX specs

**Promotion rules:**

- All checklist items must be complete
- Evidence artifacts must be present in `docs/readiness/`
- Supabase migrations must be applied and logged
- Adaptive safeguards must be captured and logged per `architecture.md` and the PRD

---

## Roles & Ownership

| Role                    | Primary Responsibility                                  | Key Touchpoints                                        |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| **Runtime Steward**     | Gemini ADK orchestration, evaluation harnesses          | ADK eval suites, custom agent flows, error budgets     |
| **CopilotKit Squad**    | Mission intake UX, streaming status, approvals UI       | CopilotKit hooks, shared state, persistence            |
| **Data Engineer**       | Supabase schema, pgvector, Cron jobs, analytics         | `pg_cron`, PostgREST, Edge Functions, evidence exports |
| **Governance Sentinel** | Guardrails, reviewer SOPs, undo assurances              | Policy enforcement, audit trails, override workflows   |
| **GTM Enablement Lead** | Play library, evidence storytelling, customer readiness | Dry-run artifacts, ROI dashboards, enablement bundles  |

---

## Gate G-A — Foundation Baseline

**Mission Question:** Can we demonstrate objective → artifact loop without credentials while keeping governance instrumentation ready?

**Key References:**

- Architecture §2, §3.1–3.4: [architecture.md](./architecture.md#2-layered-architecture-overview)
- PRD value prop: [prd.md](./prd.md#value-proposition--differentiators)

### Checklist

#### Supabase Schema & Persistence

**Owner:** Data Engineer
**Reference:** [architecture.md §3.4](./architecture.md#34-supabase-data-plane)

- [x] Apply `supabase/migrations/0001_init.sql` with pgvector extension (see `supabase/migrations/0001_init.sql` and `docs/readiness/foundation_readiness.json`)
- [x] Enable Row Level Security on `objectives`, `mission_metadata`, `mission_safeguards`, `plays`, `tool_calls`, `approvals`, `artifacts` (policies codified in `supabase/migrations/0001_init.sql`)
- [x] Verify RLS policies allow tenant-scoped access only (policies restrict access via `auth.uid()` in `supabase/migrations/0001_init.sql`)
- [ ] Run `supabase db diff` and capture migration hash in `docs/readiness/migration_log_G-A.md` (file still marked TODO)
- [ ] Test persistence: create objective, reload session, confirm state restored (implementation ready via `src/app/(control-plane)/ControlPlaneWorkspace.tsx`; QA evidence pending)
- [ ] Export DB row checksums to `docs/readiness/db_checksum_G-A.csv` (CSV currently shows `pending_after_seed` placeholders)

#### CopilotKit Workspace Setup

**Owner:** CopilotKit Squad
**Reference:** [architecture.md §3.1](./architecture.md#31-presentation--control-plane-nextjs--copilotkit), [prd.md §5](./prd.md#copilotkit-experience), [ux.md §4–§6](./ux.md#4-mission-workspace-anatomy)

- [x] Implement `MissionIntake.tsx` with `useCopilotReadable` for mission objective (`src/components/MissionIntake.tsx`)
- [x] Wire `useCopilotAction` for `createMission` handler calling `/api/objectives` (`src/app/(control-plane)/ControlPlaneWorkspace.tsx`)
- [x] Reproduce mission sidebar, streaming status panel, safeguard drawer, and artifact card components per the UX blueprint (`src/app/(control-plane)/ControlPlaneWorkspace.tsx`)
- [ ] Store CopilotKit sessions and messages in Supabase tables (`copilot_sessions`, `copilot_messages`) (sessions persisted via `/api/copilotkit/session`; message persistence still TODO)
- [x] Implement retention policy (7-day default per PRD) (`SESSION_RETENTION_MINUTES` in `ControlPlaneWorkspace`)
- [ ] Test message management hooks: `copilotkit_emit_message`, `copilotkit_exit` (runtime wiring present via `/api/copilotkit`, QA evidence pending)
- [ ] Capture screenshots of workspace state restoration in `docs/readiness/copilotkit_qa_G-A/` (folder currently README placeholder only)

#### Generative Intake Service

**Owner:** Runtime Steward + Product Design
**Reference:** [architecture.md §3.1](./architecture.md#31-presentation--control-plane-nextjs--copilotkit), [prd.md §5](./prd.md#copilotkit-experience), [ux.md §5.1](./ux.md#51-generative-intake-panel)

- [x] Build `/api/intake/generate` and `/api/intake/regenerate` endpoints with redacted logging (`src/app/api/intake/*/route.ts`)
- [x] Implement `intakeService.generateBrief` to output objective, audience, KPIs, safeguard hints, tone guidance with confidence scores (`src/lib/intake/service.ts`)
- [x] Persist generated fields and edit metadata to `mission_metadata` table (`source=generated|edited`, `confidence`, `regeneration_count`) (`persistMissionMetadata` in `src/lib/intake/service.ts`)
- [x] Emit telemetry events `intent_submitted`, `brief_generated`, `brief_item_modified` (`emitTelemetry` + `logTelemetryEvent` in `src/lib/intake/service.ts`)
- [x] Provide UX hooks for "Accept", "Edit", "Regenerate", "Reset to previous" per component library (`src/components/MissionIntake.tsx` controls)
- [x] Document prompt templates, safety filters, and fallback behavior in `docs/readiness/generative_intake_playbook_G-A.md`

#### Gemini ADK Orchestration

**Owner:** Runtime Steward
**Reference:** [architecture.md §3.2](./architecture.md#32-orchestration-gemini-adk)

**Coordinator Agent (`SequentialAgent`):**
- [x] Introduce `agent/agents/coordinator.py` deriving from `SequentialAgent` that chains `IntakeAgent → PlannerAgent → ExecutionLoop` with `max_retries = 3` (baseline still single `LlmAgent`).
- [x] Build lightweight `IntakeAgent` helper to confirm accepted chips exist, hydrate safeguards from Supabase, and hydrate `ctx.session.state['mission_context']` for downstream agents.
- [x] Register the coordinator in `agent/agent.py` and ensure stage transitions emit telemetry (`planner_stage_started`, `validator_stage_started`, `evidence_stage_started`) via the ADK callback hooks.
- [x] Capture the first dry-run trace to `docs/readiness/coordinator_trace_G-A.log` (mission id, retries, safeguard summary) as evidence of sequential orchestration.

- [x] Implement `agent/agents/planner.py` overriding `_run_async_impl` to branch on `ctx.session.state['mission_mode']` (dry_run vs governed) per Gate G-A scope.
- [x] Query Supabase vector search (`plays` + embeddings) and `Composio.tools.get(search=…, auth="none")` to assemble candidate plays with impact, undo, and required toolkits.
- [x] Persist the top 3 ranked plays to Supabase `plays` (mode=`dry_run`, impact, risk, undo_plan, confidence) and cache them in `ctx.session.state['ranked_plays']` for the executor.
- [x] Emit planner telemetry (`planner_rank_complete`, `play_selected`) including latency, tool count, and similarity metrics before handing off to the execution loop.

- [x] Create `agent/agents/validator.py` that reads safeguards from `ctx.session.state['safeguards']` + Supabase, returning `auto_fix`, `ask_reviewer`, or `retry_later` outcomes with rationale.
- [x] Log validator decisions to `safeguard_events` and update session state so the execution loop can retry or halt based on the outcome.
- [x] Export stubbed validator output covering each outcome path to `docs/readiness/validator_stub_output_G-A.json` for Gate G-A evidence.

- [x] Add `agent/agents/evidence.py` that bundles mission brief, selected play, tool call summaries, undo plans, and safeguard feedback into a structured payload.
- [x] Hash tool arguments before appending to Supabase `tool_calls` and write artifact metadata (`play_id`, `type`, `content_ref`, `hash`) into `artifacts`.
- [x] Save a sample evidence bundle to `docs/readiness/evidence_stub_output_G-A.json` demonstrating storage schema and undo trace expectations.

- [x] Commit `agent/evals/smoke_g_a_v2.json` placeholder covering intake → planner → validator → evidence happy path.
- [x] Flesh out the smoke suite with at least three personas (marketing, ops, sales) and safeguard variations aligned with `architecture.md §3.3`.
- [x] Run `adk eval agent/evals/smoke_g_a_v2.json`; archive verbose output plus pass/fail summary in `docs/readiness/adk_eval_G-A.log`.
- [x] Wire `mise run test:agent` (or equivalent) to execute the ADK smoke suite in CI and fail builds on regressions.
- [x] Verify telemetry counters (`mission_created`, `play_selected`, validator outcomes, safeguard hint adoption) flow into Supabase and log the confirmation in `docs/readiness/status_beacon_A.json`.

#### Composio Catalog Integration

**Owner:** Runtime Steward
**Reference:** [architecture.md §3.3](./architecture.md#33-execution--composio-integration), [prd.md §5](./prd.md#tooling--integrations)

- [x] Implement `agent/tools/composio_client.py` with SDK-backed discovery helpers (`ComposioCatalogClient.get_summary/get_tools`)
- [x] Call `Composio.tools.get` with no-auth filter and log toolkit metadata (`ComposioCatalogClient.get_tools` and CLI status output)
- [x] Document the requirement for `COMPOSIO_API_KEY` in setup guides (see `AGENTS.md`, `README.md`, `new_docs/architecture.md`)
- [x] Export SDK status output (`python -m agent.tools.composio_client --status`) to `docs/readiness/composio_status_G-A.txt` (captured 5 toolkit snapshot on 2025-10-08)

#### Safeguard Hint Seeds

**Owner:** Product Design + Runtime Steward
**Reference:** [architecture.md §3.5](./architecture.md#35-supabase-data-plane), [ux.md §7](./ux.md#7-adaptive-safeguards-ux)

- [x] Populate `mission_safeguards` with starter hints (tone, quiet window, escalation contact) for three personas (runtime generation + fallback heuristics in `src/lib/intake/service.ts`)
- [x] Document prompt scaffolds and safety filters in `docs/readiness/generative_intake_playbook_G-A.md`
- [x] Validate hints can be accepted, edited, regenerated from the UI without manual DB edits (`MissionIntake` interactions + `/api/intake/accept`)
- [x] Log acceptance/rejection events to verify telemetry wiring (`acceptIntake` emits `brief_item_modified` with safeguard statuses)

### Acceptance Instrumentation

**Required Tests:**

1. **ADK smoke run:** `adk eval agent/evals/smoke_g_a_v2.json` produces pass/fail summary with timestamps
2. **CopilotKit persistence:** Create mission, refresh session, confirm state restored; log DB row hashes
3. **SDK connectivity:** Run `python -m agent.tools.composio_client --status`; record toolkit count and categories
4. **Generative intake QA:** Paste sample intent, verify generated objective/audience/safeguard sets include confidence scores and are editable/regenerable
5. **Safeguard telemetry sanity:** Accept, edit, and reject hints; confirm events land in `mission_safeguards` and telemetry tables

**Evidence Artifacts:**

- `docs/readiness/status_beacon_A.json` with readiness %, owners, blockers
- `docs/readiness/migration_log_G-A.md` with Supabase migration hash + command output
- `docs/readiness/composio_status_G-A.txt` with SDK status output
- `docs/readiness/copilotkit_qa_G-A/` (screenshots + console logs)
- `docs/readiness/generative_intake_samples_G-A.json` capturing input, generated fields, safeguard hints, confidence scores, and edit logs

### Exit Criteria

- [ ] Supabase schema + RLS validated, audit log captured in `docs/readiness/`
- [ ] CopilotKit persistence + reload verified with evidence screenshots
- [ ] Nightly Cron job scheduled and monitored
- [ ] Safeguard hints reviewed with governance stakeholders and documented as starter seeds

### Dependencies & Notes

- Requires `GOOGLE_API_KEY`, `COMPOSIO_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- No secrets in repo; use `.env.local` and `agent/.env`
- Validate environment: `mise run install` → `mise run dev`

---

## Gate G-B — Dry-Run Proof Loop

**Mission Question:** Can stakeholders receive high-quality drafts with full telemetry in <15 minutes and observe agent reasoning live?

**Key References:**

- Architecture §4.1 (Dry-Run Proof Sequence): [architecture.md](./architecture.md#41-dry-run-proof-sequence)
- PRD dry-run proof packs: [prd.md](./prd.md#product-scope--key-experiences-business-lens)
- Adaptive safeguards: [architecture.md §3.7](./architecture.md#37-adaptive-safeguards)

### Checklist

#### CopilotKit Streaming & Approvals

**Owner:** CopilotKit Squad
**Reference:** [architecture.md §3.1](./architecture.md#31-presentation--control-plane-nextjs--copilotkit), [ux.md §5–§8](./ux.md#5-interaction-patterns--ui-components)

- [ ] Implement streaming via `copilotkit_emit_message` in planner and executor agents
- [ ] Enforce `copilotkit_exit` at mission completion
- [ ] Create `ApprovalModal.tsx` component rendering safeguard hints, suggested fixes, undo plan, reviewer actions
- [ ] Confirm modal copy, remediation options, and accessibility behavior match the UX blueprint (safeguard feedback modal, keyboard navigation)
- [ ] Wire approval decisions to `/api/approvals` endpoint
- [ ] Enable reviewer annotations in CopilotKit workspace
- [ ] Record QA video showing interim status updates and reviewer edits
- [ ] Save video to `docs/readiness/copilotkit_session_G-B.mp4`

#### Planner Ranking Logic

**Owner:** Runtime Steward
**Reference:** [architecture.md §3.2](./architecture.md#32-orchestration-gemini-adk), [prd.md §5](./prd.md#plan-proposals)

- [ ] Implement planner ranking using PRD recipes + Composio search + Supabase embeddings
- [ ] Integrate `tools.get(search=…)` filters for persona-relevant no-auth toolkits
- [ ] Log tool selection rationale in planner output
- [ ] Store Top-3 plays in `plays` table with `mode=dry_run`, impact estimates, risk profiles
- [ ] Add planner telemetry (latency, tool count, embedding similarity) to `ctx.session.state`

#### Evidence Agent Implementation

**Owner:** Runtime Steward
**Reference:** [architecture.md §3.5](./architecture.md#35-evidence--analytics)

- [ ] Implement `agent/services/evidence_service.py` with artifact hashing
- [ ] Upload large outputs to Supabase Storage bucket `evidence-artifacts`
- [ ] Append undo plans to each tool call record
- [ ] Hash arguments before logging to `tool_calls` table
- [ ] Store artifact metadata in `artifacts` table with `play_id`, `type`, `title`, `content_ref`
- [ ] Verify Evidence agent output hashes match Supabase artifact storage records

#### Mission Transcript Persistence

**Owner:** Data Engineer
**Reference:** [architecture.md §3.4](./architecture.md#34-supabase-data-plane)

- [ ] Persist mission transcripts in `copilot_messages` with retention policy (7 days)
- [ ] Store artifact metadata in `artifacts` table with reviewer edit tracking
- [ ] Add telemetry to `plays` table: `latency_ms`, `success_score`, `tool_count`
- [ ] Verify retention: query messages older than 7 days, confirm auto-deletion

#### Generative Quality Review

**Owner:** Product Design + Runtime Steward
**Reference:** [ux.md §5.1](./ux.md#51-generative-intake-panel), [ux.md §10](./ux.md#10-instrumentation--telemetry-touchpoints)

- [ ] Analyze edit rates for generated brief fields; ensure ≥70% acceptance without regeneration for pilot tenants
- [ ] Capture qualitative feedback on generated recommendations (survey + session notes)
- [ ] Iterate prompt templates and safeguards based on edit telemetry
- [ ] Document findings in `docs/readiness/generative_quality_report_G-B.md`

#### Dry-Run Workflow Documentation

**Owner:** Governance Sentinel
**Reference:** [prd.md §5](./prd.md#evidence-analytics--governance)

- [ ] Document reviewer workflow for dry-run sign-off in `docs/readiness/reviewer_workflow_G-B.md`
- [ ] Include undo narrative requirements and approval SOP
- [ ] Obtain Governance Sentinel sign-off

### Acceptance Instrumentation

**Required Tests:**

1. **End-to-end dry-run timing:** Run 3 persona scenarios (GTM, support, finance); record start/end timestamps; confirm <15 min
2. **Evidence hashing:** Compare Evidence agent output hashes to Supabase `artifacts` table records
3. **Streaming UX QA:** Record video demonstrating interim status updates and reviewer edits
4. **Telemetry audit:** Verify CopilotKit events (`mission_created`, `play_selected`, `approval_required`, `approval_decision`) fire with payloads defined in `ux.md §10`

**Evidence Artifacts:**

- `docs/readiness/dry_run_verification.md` with timing table, artifact samples, planner telemetry
- `docs/readiness/copilotkit_session_G-B.mp4` (session recording + console logs)
- `docs/readiness/generative_quality_report_G-B.md` (edit rates, confidence calibration)
- `docs/readiness/status_beacon_B.json` with gate readiness score

### Exit Criteria

- [ ] Dry-run latency KPI met (<15 min) across 3 persona scenarios
- [ ] Streaming status + exit hooks validated with video evidence
- [ ] Mission transcript retention confirmed for 7-day window
- [ ] Reviewer workflow documented and approved by Governance Sentinel

### Dependencies & Notes

- Requires curated library seeds from [architecture.md §4.1](./architecture.md#41-dry-run-proof-sequence) + [prd.md play library](./prd.md#product-scope--key-experiences-business-lens)
- Library embeddings must be seeded before planner ranking can surface recommendations

---

## Gate G-C — Governed Activation Core

**Mission Question:** Can we execute OAuth-backed plays with adaptive safeguards, approvals, undo, and trigger lifecycle controls while preserving auditability?*

**Key References:**

- Architecture §4.2 (Governed Activation Sequence): [architecture.md](./architecture.md#42-governed-activation-sequence)
- Architecture §4.3 (Approval & Undo Loop): [architecture.md](./architecture.md#43-approval--undo-loop)
- Adaptive safeguards: [architecture.md §3.7](./architecture.md#37-adaptive-safeguards), [ux.md §7](./ux.md#7-adaptive-safeguards-ux)
- PRD governed activation: [prd.md §5](./prd.md#governed-activation)

### Checklist

#### OAuth Integration

**Owner:** Runtime Steward
**Reference:** [architecture.md §3.3](./architecture.md#33-execution--composio-integration)

- [ ] Implement OAuth handshake in `agent/tools/composio_client.py`: `toolkits.authorize`, `waitForConnection`
- [ ] Store `redirect_url`, `connection_id`, scopes in `oauth_tokens` table with encryption (`ENCRYPTION_KEY` env var)
- [ ] Log auth evidence (scopes, connection timestamps) to `docs/readiness/oauth_evidence_G-C.csv`
- [ ] Test OAuth flow end-to-end (connect, consent, token storage, revoke)
- [ ] Document OAuth rehearsal in `docs/readiness/oauth_rehearsal_G-C.md`

#### Generative Connection Planner

**Owner:** Runtime Steward + CopilotKit Squad
**Reference:** [architecture.md §3.4](./architecture.md#34-supabase-data-plane), [ux.md §3.2](./ux.md#32-journey-map-governed-activation-gate-g-c-focus)

- [ ] Generate recommended toolkit & scope plan automatically after mission brief acceptance (e.g., Zendesk triage + Slack digest)
- [ ] Surface hints in the Safeguard & Auth drawer with confidence and rationale chips
- [ ] Allow inline edit, removal, or regeneration of suggestions before activation
- [ ] Persist accepted/rejected hints to `mission_safeguards` (status: suggested/accepted/edited/rejected)
- [ ] Emit telemetry `toolkit_suggestion_applied` with outcome (accepted/edited/rejected)

#### Trigger Lifecycle Management

**Owner:** Runtime Steward
**Reference:** [architecture.md §3.3](./architecture.md#33-execution--composio-integration), [prd.md §5](./prd.md#trigger-ready-plays)

- [ ] Implement trigger CRUD: `create_trigger`, `list_triggers`, `get_trigger`, `subscribe_trigger`, `disable_trigger`
- [ ] Store trigger configs in `triggers` table with `user_id`, `slug`, `config`, `status`
- [ ] Test trigger subscription: create synthetic event, verify event logged in Supabase
- [ ] Export trigger event log to `docs/readiness/trigger_events_G-C.json`

#### Validator & Safeguard Feedback

**Owner:** Runtime Steward
**Reference:** [architecture.md §3.7](./architecture.md#37-adaptive-safeguards), [ux.md §7](./ux.md#7-adaptive-safeguards-ux)

- [ ] Implement validator helpers that consume accepted safeguard hints (tone, timing, escalation, budget)
- [ ] Return feedback tiers (auto-fix, ask reviewer, retry later) and log to `safeguard_events`
- [ ] Test negative cases: tone softening, quiet window breach, escalation required
- [ ] Capture evaluation logs in `agent/evals/validator_g_c.yaml` and store results in `docs/readiness/validator_eval_G-C.log`

#### Evidence & Undo

**Owner:** Runtime Steward
**Reference:** [architecture.md §3.5](./architecture.md#35-evidence--analytics)

- [ ] Store undo plans for every mutating tool call in `tool_calls.undo_plan`
- [ ] Implement `execute_undo(tool_call_id)` in `agent/services/evidence_service.py`
- [ ] Execute undo regression covering at least one governed toolkit and log outputs
- [ ] Document undo regression in `docs/readiness/undo_test_G-C.md`

#### Approval UX & Safeguard Feedback

**Owner:** CopilotKit Squad
**Reference:** [architecture.md §3.1](./architecture.md#31-presentation--control-plane-nextjs--copilotkit), [ux.md §7](./ux.md#7-adaptive-safeguards-ux)

- [ ] Update `ApprovalModal.tsx` to render safeguard hint, suggested fix, send-anyway justification, schedule-later option
- [ ] Ensure undo buttons call Evidence service and update safeguard feedback stream
- [ ] Log reviewer actions (`safeguard_hint_applied`, `safeguard_hint_rejected`) with notes
- [ ] Capture QA session showing safeguard feedback loop end-to-end

#### Supabase Policies

**Owner:** Data Engineer
**Reference:** [architecture.md §3.5](./architecture.md#35-supabase-data-plane)

- [ ] Add RLS policies for `mission_safeguards`, `safeguard_events`, `approvals`, `tool_calls`, `triggers`, `oauth_tokens`
- [ ] Create PostgREST policies for reviewer and admin personas
- [ ] Schedule `safeguard_feedback_rollup` cron job
- [ ] Test policy enforcement: attempt cross-tenant access to safeguarded missions and ensure rejection

#### Governance Enablement

**Owner:** Governance Sentinel

- [ ] Publish safeguard reviewer playbook in `docs/readiness/safeguard_reviewer_sop_G-C.md`
- [ ] Document escalation guidelines (when to pin hints vs. send anyway)
- [ ] Capture weekly summary template highlighting safeguard adoption trends
- [ ] Obtain Governance Sentinel sign-off

### Acceptance Instrumentation

**Required Tests:**

1. **OAuth connection rehearsal:** Record redirect URL, connection ID, scopes; verify token encryption
2. **Trigger subscription test:** Produce synthetic event; verify event logged in Supabase
3. **Validator feedback suite:** Trigger tone softening, quiet window breach, escalation hint; confirm interrupts and logged feedback
4. **Safeguard hint QA:** Accept/reject generated hints; confirm telemetry and persistence in `mission_safeguards`
5. **Undo regression:** Execute undo plan; confirm evidence update

**Evidence Artifacts:**

- `docs/readiness/governed_activation_report.csv` (connections, approvals, undo traces, safeguard feedback)
- `docs/readiness/approval_feed_export_G-C.json` showing reviewer decisions + hint outcomes
- `docs/readiness/status_beacon_C.json` with risk assessment
- `docs/readiness/oauth_evidence_G-C.csv`
- `docs/readiness/generative_connection_plan_G-C.json` (suggested vs. accepted scopes, edits)
- `docs/readiness/safeguard_feedback_samples_G-C.json`

### Exit Criteria

- [ ] At least two OAuth toolkits operational with approvals recorded
- [ ] Trigger lifecycle covered (list/get/create/subscribe/disable) with audit logs
- [ ] Validator feedback captured for tone/timing/escalation scenarios and surfaced in UI
- [ ] Undo buttons tested and evidence stored
- [ ] Governance playbook published and acknowledged

### Dependencies & Notes

- Coordinate with security for vaulting OAuth secrets
- Ensure scopes requested by connection planner align with customer contracts and are logged in safeguard hints

---

## Gate G-D — Insight & Library Fabric

**Mission Question:** Can we surface actionable analytics, recommendations, and reusable plays across tenants and personas?

**Key References:**

- Architecture §3.5 (Evidence & Analytics): [architecture.md](./architecture.md#35-evidence--analytics)
- PRD analytics requirements: [prd.md §5](./prd.md#evidence-analytics--governance)
- Safeguard telemetry: [architecture.md §7](./architecture.md#7-observability-metrics--alerts)

### Checklist

#### Dashboard Implementation

**Owner:** Data Engineer
**Reference:** [architecture.md §3.5](./architecture.md#35-evidence--analytics)

- [ ] Build Next.js server components backed by PostgREST for:
  - Adoption metrics (`analytics_weekly_approved_jobs`)
  - ROI estimates
  - Safeguard feedback (`analytics_safeguard_feedback`)
  - Latency percentiles
- [ ] Implement filters: tenant, persona, mission state
- [ ] Add dashboard QA checklist: p95 latency < target, filters functioning, data accurate vs sample queries
- [ ] Record dashboard QA in `docs/readiness/dashboard_qa_G-D.mp4`

#### Library Agent & Recommendation API

**Owner:** Runtime Steward
**Reference:** [architecture.md §3.2](./architecture.md#32-orchestration-gemini-adk), [prd.md §5](./prd.md#semantic-tool-search)

- [ ] Create `LibraryAgent` for curating embeddings, ROI, risk metadata
- [ ] Implement recommendation API (`/api/library/recommend`) consuming Supabase pgvector queries
- [ ] Integrate Planner to consume recommendation API for next-best-job prompts
- [ ] Curate at least 5 templates per persona (GTM, support, finance, technical)
- [ ] Store templates in `library_entries` table with embeddings
- [ ] Export recommendations to `docs/readiness/library_recommendations.json`

#### Trigger Warehouse

**Owner:** Data Engineer
**Reference:** [architecture.md §3.4](./architecture.md#34-supabase-data-plane)

- [ ] Create `trigger_warehouse` table: `trigger_id`, `event_type`, `payload_hash`, `tool_call_id`, `received_at`
- [ ] Tag tool usage with metadata: toolkit, scopes, success score
- [ ] Populate warehouse with trigger events from `triggers` and `tool_calls`
- [ ] Run consistency check: reconcile events vs tool calls
- [ ] Export consistency report to `docs/readiness/trigger_warehouse_consistency_G-D.json`

#### Analytics Access Control

**Owner:** Governance Sentinel
**Reference:** [prd.md §5](./prd.md#evidence-analytics--governance)

- [ ] Publish analytics access control policy in `docs/readiness/analytics_access_policy_G-D.md`
- [ ] Publish data retention policy
- [ ] Configure Supabase RLS for analytics views

#### Generative Analytics & Narratives

**Owner:** Product Design + Data Engineer
**Reference:** [ux.md §8.2](./ux.md#82-analytics-dashboard-executive-view), [ux.md §10](./ux.md#10-instrumentation--telemetry-touchpoints)

- [ ] Create views for generative acceptance metrics (`brief_accept_rate`, `connection_accept_rate`, `average_regenerations_per_field`)
- [ ] Populate narrative summaries using templated LLM prompts with edit/regenerate controls in dashboard
- [ ] Log narrative edits (accept vs regenerate) to telemetry for future tuning
- [ ] Document narrative prompt templates and safeguard guidance in `docs/readiness/generative_narratives_playbook_G-D.md`

#### Edge Functions Deployment

**Owner:** Data Engineer
**Reference:** [architecture.md §3.4](./architecture.md#34-supabase-data-plane)

- [ ] Deploy `supabase/functions/generate-embedding` for library entries
- [ ] Confirm Edge Functions for streaming evidence and ROI calculations are live
- [ ] Test Edge Function latency: verify <500ms p95

### Acceptance Instrumentation

**Required Tests:**

1. **Dashboard QA:** Test p95 latency, filters, data accuracy; record video
2. **Recommendation API integration:** Verify contextual suggestions returned by `/api/library/recommend`
3. **Trigger warehouse consistency:** Check events vs tool calls reconciliation
4. **Generative metrics validation:** Confirm `brief_accept_rate` and `connection_accept_rate` views align with telemetry samples; test narrative regenerate flow

**Evidence Artifacts:**

- `docs/readiness/insight_snapshot.parquet` (metrics extract)
- `docs/readiness/library_recommendations.json` (top plays, metadata, embeddings hashes)
- `docs/readiness/dashboard_qa_G-D.mp4`
- `docs/readiness/generative_narratives_playbook_G-D.md`
- `docs/readiness/status_beacon_D.json`

### Exit Criteria

- [ ] Dashboards validated with governance-approved metrics
- [ ] Recommendation service serving at least 5 curated templates per persona
- [ ] Trigger warehouse populated and reconciled with live events
- [ ] Analytics access control published and approved

### Dependencies & Notes

- Confirm Supabase Edge Functions deployed before gate promotion
- Library embeddings require OpenAI or Gemini API access

---

## Gate G-E — Scale Hardening

**Mission Question:** Is the platform ready for broader rollout with enforced security, performance, and adaptive safeguard discipline?

**Key References:**

- Architecture §5 (Deployment & Operations): [architecture.md](./architecture.md#5-deployment--operations)
- PRD non-functional requirements: [prd.md §5](./prd.md#non-functional-requirements)
- PRD GTM packaging: [prd.md §6](./prd.md#go-to-market--packaging-outline)

### Checklist

#### Security Hardening

**Owner:** Runtime Steward + Governance Sentinel
**Reference:** [architecture.md §3.7](./architecture.md#37-adaptive-safeguards)

- [ ] Implement token rotation for OAuth credentials in `oauth_tokens` table
- [ ] Build PII redaction pipeline: scan `artifacts` and `copilot_messages` for sensitive strings
- [ ] Audit trigger permissions: verify scopes match accepted safeguard hints and customer contracts
- [ ] Document SOC2-oriented controls in `docs/readiness/security_controls_G-E.md`
- [ ] Obtain security checklist sign-off with evidence (logs, policies, runbooks)
- [ ] Export security summary to `docs/readiness/trust_review.pdf`

#### Accessibility & UX Parity

**Owner:** CopilotKit Squad + Product Design
**Reference:** [ux.md §9–§10](./ux.md#9-accessibility--inclusive-design)

- [ ] Conduct WCAG 2.1 AA audit covering keyboard navigation, live regions, and contrast
- [ ] Verify global and component-level shortcuts operate as documented in the UX blueprint
- [ ] Validate telemetry events against `ux.md §10` catalog and archive audit in `docs/readiness/telemetry_audit_G-E.md`
- [ ] Capture accessibility audit findings in `docs/readiness/accessibility_audit_G-E.pdf`

#### Performance Load Testing

**Owner:** Runtime Steward + Data Engineer
**Reference:** [architecture.md §5](./architecture.md#5-deployment--operations), [prd.md §5](./prd.md#non-functional-requirements)

- [ ] Run load tests for Composio tool execution: 20 concurrent requests, measure success %, error classes, latency percentiles
- [ ] Run trigger throughput tests: measure event ingestion rate and processing latency
- [ ] Run Supabase query/embedding latency benchmarks: verify p95 <250ms
- [ ] Archive load test reports in `docs/readiness/load_test_results.json`
- [ ] If SLAs not met, draft mitigation plan and obtain approval

#### Enablement Bundle

**Owner:** GTM Enablement Lead
**Reference:** [prd.md §6](./prd.md#go-to-market--packaging-outline)

- [ ] Publish enablement bundle with:
  - Case studies (Assista AI, Fabrile examples)
  - ROI calculator
  - Trigger playbooks
  - Persona-specific templates
- [ ] Align bundle with PRD packaging models (Starter, Growth, Scale)
- [ ] Review enablement content with GTM/cross-functional stakeholders
- [ ] Export enablement bundle to `docs/readiness/enablement_bundle_G-E/`

#### Partner Roadmap Validation

**Owner:** GTM Enablement Lead
**Reference:** [prd.md §7](./prd.md#dependencies--partnerships)

- [ ] Schedule quarterly alignment with Composio, CopilotKit, ADK, Supabase teams
- [ ] Document roadmap dependencies and commitments
- [ ] Update tracker within 48h of each sync

### Acceptance Instrumentation

**Required Tests:**

1. **Load tests:** Archive reports with success %, error classes, latency percentiles
2. **Security checklist:** Sign-off with evidence (logs, policies, runbooks)
3. **Enablement content review:** GTM/cross-functional stakeholder approval

**Evidence Artifacts:**

- `docs/readiness/trust_review.pdf` (security/compliance summary)
- `docs/readiness/load_test_results.json` (latency + capacity data)
- `docs/readiness/enablement_bundle_G-E/` (case studies, ROI calculator, playbooks)
- `docs/readiness/status_beacon_E.json`

### Exit Criteria

- [ ] Security controls audited and signed
- [ ] Performance SLAs met or mitigation plan approved
- [ ] Enablement package distributed to stakeholders
- [ ] Partner roadmap validation complete

### Dependencies & Notes

- Coordinate with partner teams for roadmap validation per [prd.md §7](./prd.md#dependencies--partnerships)

---

## Gate G-F — Stabilised Operations

**Mission Question:** Can we sustain governed operations over multiple reporting windows with incident hygiene and future roadmap clarity?

**Key References:**

- Architecture §7 (Observability & Incident Response): [architecture.md](./architecture.md#7-observability-metrics--alerts)
- PRD metrics: [prd.md §6](./prd.md#metrics--success-criteria)

### Checklist

#### Operational Metrics Collection

**Owner:** Data Engineer + GTM Enablement Lead
**Reference:** [prd.md §6](./prd.md#metrics--success-criteria)

- [ ] Collect two reporting cycles of production KPIs:
  - Adoption (weekly approved jobs per account)
  - Approvals (throughput, override rate)
  - Safeguard feedback (auto-fix rate, send-anyway frequency)
  - ROI (estimated value per mission)
- [ ] Reconcile KPI exports with Supabase dashboard data
- [ ] Export KPI data to `docs/readiness/kpi_export_G-F.parquet`

#### Incident Hygiene

- [ ] Document all feedback events in `safeguard_events`
- [ ] Write postmortems for events flagged as `severity = 'blocking'`
- [ ] Review incident ledger with governance and runtime teams
- [ ] Store postmortems in `docs/readiness/safeguard_reports/`
- [ ] Verify all incidents resolved with documented learnings

#### Next-Phase Roadmap

**Owner:** All roles
**Reference:** [architecture.md §8](./architecture.md#8-reference-index)

- [ ] Compile backlog for next phase based on telemetry and GTM feedback
- [ ] Score and prioritize backlog items
- [ ] Obtain leadership approval for next-phase roadmap
- [ ] Document roadmap in `docs/readiness/roadmap_next_phase.md`

#### Evidence Archive

**Owner:** Data Engineer
**Reference:** [architecture.md §6](./architecture.md#6-capability-progression--evidence-requirements)

- [ ] Export all evidence artifacts to cold storage (Supabase Storage bucket `evidence-archives`)
- [ ] Refresh analytics baselines
- [ ] Adjust risk register based on operational learnings
- [ ] Verify `docs/readiness/` mirrors final state

### Acceptance Instrumentation

**Required Tests:**

1. **KPI reconciliation:** Compare KPI exports with Supabase dashboard data
2. **Incident ledger review:** Governance and runtime teams sign off
3. **Backlog scoring:** Leadership approval

**Evidence Artifacts:**

- `docs/readiness/stabilisation_digest.md` (KPIs, incidents, backlog summary)
- `docs/readiness/status_beacon_F.json` with final readiness score
- `docs/readiness/kpi_export_G-F.parquet`
- `docs/readiness/roadmap_next_phase.md`

### Exit Criteria

- [ ] Two consecutive reporting windows closed with compliant metrics
- [ ] All incidents resolved with documented learnings
- [ ] Next-phase roadmap approved by leadership
- [ ] Evidence archives mirror final state

### Dependencies & Notes

- Ensure cold storage bucket `evidence-archives` is configured before promotion

---

## Operational Cadence & Verification

**Weekly:**

- Review Cron health: `safeguard_feedback_rollup`
- Streaming UX QA status: confirm CopilotKit sessions loading without errors
- Open risks: update risk register in `docs/readiness/risk_register.md`
- Task progress: update status beacons with blockers and owners

**Bi-Weekly:**

- Run `adk eval` regression suites: `agent/evals/smoke_g_a_v2.json`, `agent/evals/validator_g_c.yaml`
- Validate Supabase diffs: `supabase db diff`, confirm no unexpected schema changes
- Confirm Composio tool coverage: run `python -m agent.tools.composio_client --status` and record toolkit count

**Pre-Gate Review:**

- Freeze feature work
- Re-run acceptance instrumentation for current gate
- Gather required evidence artifacts
- Update `docs/readiness/status_beacon_<letter>.json`
- Schedule gate promotion review with all role owners

**Post-Gate:**

- Export artifacts to cold storage (`evidence-archives` bucket)
- Refresh analytics baselines
- Adjust risk register based on gate learnings
- Update this roadmap with lessons learned

---

## Risk Watchlist & Mitigations

**Reference:** [prd.md §8](./prd.md#risks--mitigations)

| Risk                          | Trigger Condition                        | Mitigation                                                                         | Owner               |
| ----------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- | ------------------- |
| **Credential adoption lag**   | <50% tenants opt into OAuth by Gate G-C  | Escalate; amplify dry-run success stories                                          | GTM Enablement Lead |
| **Reviewer fatigue**          | Approvals per reviewer >threshold        | Design batching/autopilot windows                                                  | Governance Sentinel |
| **Integration drift**         | Partner SDK breaking changes             | Quarterly sync with Composio, CopilotKit, ADK, Supabase; update tracker within 48h | Runtime Steward     |
| **Data anomalies**            | Embeddings drift, missing trigger events | Automated QA on embeddings, trigger streams, dashboards; alert on drift            | Data Engineer       |
| **Latency/Throughput spikes** | p95 latency >250ms                       | Run load tests during each gate promotion rehearsal; enforce SLA before Gate G-E   | Runtime Steward     |

---

## Decision Log

Maintain dated decisions here during reviews. Include context, decision, owner, and follow-up tasks.

**Example:**

- **2025-10-08:** Approved LLM provider fallback (Gemini primary, OpenAI secondary). Owner: Runtime Steward. Follow-up: Update `agent/config.py` with fallback logic by G-C.

---

## Upcoming Reviews

- **Next checkpoint audit:** October 22, 2025 (target readiness review for Gate G-A → G-B promotion)
- Update this tracker immediately after every checkpoint or major decision

---

## Cross-Reference Quick Index

| Document                                               | Key Sections                                                             | Purpose                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------ |
| [architecture.md](./architecture.md)                   | §2 (Layered Architecture), §3 (Component Blueprints), §4 (Runtime Flows), §7 (Observability) | Technical implementation guidance          |
| [prd.md](./prd.md)                                     | §5 (Product Scope), §6 (Metrics), §7 (GTM Packaging)                     | Business requirements and success criteria |
| [ux.md](./ux.md)                                       | §4 (Workspace Anatomy), §5 (Interaction Patterns), §7 (Adaptive Safeguards) | Experience blueprint and interaction cues |

**End of Roadmap**
