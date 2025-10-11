# AI Employee Control Plane — Agent Implementation Roadmap

**Version:** 1.2 (October 10, 2025)
**Audience:** Coding agents, runtime stewards, implementation squads
**Status:** Active gate-by-gate execution tracker
**Current Focus:** Gate G-B · Dry-Run Proof (Eight-Stage Flow)

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
- [x] Run `supabase db diff` and capture migration hash in `docs/readiness/migration_log_G-A.md` (file still marked TODO)
- [x] Test persistence: create objective, reload session, confirm state restored (implementation ready via `src/app/(control-plane)/ControlPlaneWorkspace.tsx`; QA evidence pending)
- [x] Export DB row checksums to `docs/readiness/db_checksum_G-A.csv` (CSV currently shows `pending_after_seed` placeholders)

#### CopilotKit Workspace Setup

**Owner:** CopilotKit Squad
**Reference:** [architecture.md §3.1](./architecture.md#31-presentation--control-plane-nextjs--copilotkit), [prd.md §5](./prd.md#copilotkit-experience), [ux.md §4–§6](./ux.md#4-mission-workspace-anatomy)

- [x] Implement `MissionIntake.tsx` with `useCopilotReadable` for mission objective (`src/components/MissionIntake.tsx`)
- [x] Wire `useCopilotAction` for `createMission` handler calling `/api/objectives` (`src/app/(control-plane)/ControlPlaneWorkspace.tsx`)
- [x] Reproduce mission sidebar, streaming status panel, safeguard drawer, and artifact card components per the UX blueprint (`src/app/(control-plane)/ControlPlaneWorkspace.tsx`)
- [ ] Introduce "Recommended tools" carousel that reads Composio metadata, highlights no-auth vs OAuth, and lets users multi-select toolkits before planner execution (store choices in `mission_safeguards`).
- [x] Store CopilotKit sessions and messages in Supabase tables (`copilot_sessions`, `copilot_messages`) (sessions persisted via `/api/copilotkit/session`; message persistence still TODO)
- [x] Implement retention policy (7-day default per PRD) (`SESSION_RETENTION_MINUTES` in `ControlPlaneWorkspace`)
- [x] Test message management hooks: `copilotkit_emit_message`, `copilotkit_exit` (runtime wiring present via `/api/copilotkit`, QA evidence pending)
- [x] Capture screenshots of workspace state restoration in `docs/readiness/copilotkit_qa_G-A/` (folder currently README placeholder only)

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
- [x] Wire planner telemetry to capture recommended palette impressions (`toolkit_recommendation_viewed`, `toolkit_selected`) and align payloads with analytics schema.
- [x] Add MCP inspection step post-selection that fetches sample data outputs in draft mode and streams summary back to CopilotKit for user validation.

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
6. **Tool palette validation:** Select mixed no-auth and OAuth toolkits, confirm selections persist, MCP inspection runs, and validation checklist renders before execution.

**Evidence Artifacts:**

- `docs/readiness/status_beacon_A.json` with readiness %, owners, blockers
- `docs/readiness/migration_log_G-A.md` with Supabase migration hash + command output
- `docs/readiness/composio_status_G-A.txt` with SDK status output
- `docs/readiness/copilotkit_qa_G-A/` (screenshots + console logs)
- `docs/readiness/generative_intake_samples_G-A.json` capturing input, generated fields, safeguard hints, confidence scores, and edit logs

### Exit Criteria

- [x] Supabase schema + RLS validated, audit log captured in `docs/readiness/`
- [x] CopilotKit persistence + reload verified with evidence screenshots
- [x] Nightly Cron job scheduled and monitored
- [x] Safeguard hints reviewed with governance stakeholders and documented as starter seeds

### Dependencies & Notes

- Requires `GOOGLE_API_KEY`, `COMPOSIO_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- No secrets in repo; use `.env.local` and `agent/.env`
- Validate environment: `mise run install` → `mise run dev`

---

## Gate G-B — Dry-Run Proof (Eight-Stage Flow)

**Mission Question:** Can stakeholders receive high-quality drafts with full telemetry in <15 minutes through a governed eight-stage workflow while observing agent reasoning live?

**Key References:**

- Architecture §3.1 (workspace), §3.2 (orchestration), §3.5 (evidence), §4.0-4.4 (eight-stage flows): [architecture.md](./architecture.md)
- PRD §5 (Dry-run proof packs), §6 (metrics), §7 (operational safety): [prd.md](./prd.md)
- UX blueprint §§4–8 (workspace anatomy, approvals, safeguards), §10 (telemetry): [ux.md](./ux.md)
- Workflow specification: [workflow.md](./workflow.md) §1 (Eight-Stage Flow), §3-8 (Stage-specific workflows)
- Partner packs: CopilotKit streaming + interrupt docs (`libs_docs/copilotkit/llms-full.txt`), Composio discovery guidance (`libs_docs/composio/llms.txt`), ADK evaluation patterns (`libs_docs/adk/llms-full.txt`), Supabase retention guidance (`libs_docs/supabase/llms_docs.txt`)

**Gate Barometer:** 0 → 1 for **zero-privilege mission proof of value** (drafts + telemetry) prior to Gate G-C activation work.

**Badge:** Gate G-B · Dry-Run Proof

### Eight-Stage Flow Summary

Gate G-B delivers a structured workflow from intake to feedback:

1. **Intake** – Single-input banner generates chips via Gemini (no fallback state)
   - Acceptance: Chips persisted to `mission_metadata` with confidence scores
   - No fallback UI; all content generated or user-edited
2. **Mission Brief** – Accepted chips persist in Supabase; brief card remains pinned
   - Acceptance: Brief locked in `objectives` table; safeguards generated
   - Mission context available to all downstream stages
3. **Toolkits & Connect** – User-curated Composio palette with inspection preview and Connect Link auth
   - Acceptance: Toolkit selections stored in `toolkit_selections` or `mission_safeguards`
   - OAuth tokens encrypted in `oauth_tokens` via Connect Link
4. **Data Inspect** – MCP draft calls validate coverage/freshness; coverage meter communicates readiness
   - Acceptance: Inspection findings stored in `inspection_findings`
   - Coverage meter shows ≥85% readiness threshold
5. **Plan** – Planner insight rail streams rationale; user selects ranked plays with impact/risk/undo
   - Acceptance: Plays persisted to `plays` with rationale and confidence
   - User selection logged with `play_selected` telemetry
6. **Dry-Run** – Streaming status panel narrates planner → executor → validator loop; heartbeat + logs
   - Acceptance: Completes in <15 min p95; streaming heartbeat <5s p95
   - Status updates via `copilotkit_emit_message`; exit via `copilotkit_exit`
7. **Evidence** – Artifact gallery surfaces proof pack, ROI, undo bar
   - Acceptance: Artifacts stored with SHA-256 hash verification
   - Undo plan validated; rollback UI available for 24 hours
8. **Feedback** – Per-artifact ratings, mission feedback, learning signals feeding next runs
   - Acceptance: Feedback persisted to `mission_feedback` and `artifacts`
   - Learning signals feed analytics and future planner ranking

### Checklist

#### CopilotKit Streaming & Approvals UX

**Owner:** CopilotKit Squad  
**References:** [architecture.md §3.1](./architecture.md#31-presentation--control-plane-nextjs--copilotkit), [ux.md §§5–7](./ux.md#5-interaction-patterns--ui-components), [libs_docs/copilotkit/llms-full.txt](../libs_docs/copilotkit/llms-full.txt)

- [x] Emit mission lifecycle updates (`planner_stage_started`, `planner_status`, `executor_status`, `validator_feedback`) via `copilotkit_emit_message` in `agent/agents/planner.py` and `agent/agents/executor.py` with payload contracts documented in `docs/readiness/copilotkit_stream_contract_G-B.md`.
- [x] Call `copilotkit_exit` from `agent/agents/coordinator.py` with final `mission_status` block so routers recover deterministically; verify exit always fires (including error paths) via integration test.
- [x] Ship `src/components/ApprovalModal.tsx` with safeguard chips, undo summary, impact/effort meter, reviewer annotation composer, and CTA hierarchy matching UX blueprint; implement focus trap, ARIA labelling, Esc/Enter shortcuts, and screen reader narration for undo plans.
- [x] Wire `/api/approvals` mutations (create/update) and optimistic UI state, including conflict handling when multiple reviewers act concurrently.
- [x] Surface streaming timeline in `ControlPlaneWorkspace` status rail with latency indicators (target p95 stream heartbeat <5s) and "Why waiting" copy for validator pauses.
- [x] Instrument telemetry events (`approval_required`, `approval_decision`, `reviewer_annotation_created`, `undo_requested`) using `emitTelemetry` helper and persist to Supabase `mission_events` table.

#### Planner Ranking & Library Intelligence

**Owner:** Runtime Steward  
**References:** [architecture.md §3.2](./architecture.md#32-orchestration-gemini-adk), [prd.md "Plan proposals"](./prd.md#plan-proposals), [libs_docs/composio/llms.txt](../libs_docs/composio/llms.txt), [libs_docs/adk/llms-full.txt](../libs_docs/adk/llms-full.txt)

- [x] Implement hybrid ranking pipeline combining Supabase pgvector similarity (`plays.embedding`) with Composio `tools.get(search=…, limit=5)` persona filters; enforce "no mixed filters" rule and capture raw tool metadata for rationale.
- [x] Seed library with at least 5 plays × 5 personas via `scripts/seed_library.py`; persist provenance to `library_entries` (`persona`, `source`, `success_score`) and archive command output in `docs/readiness/library_seed_log_G-B.md`.
- [x] Persist `PlannerCandidate` structures (reason, expected impact, required toolkits, undo plan sketch, similarity score, confidence) to Supabase `plays` table and `ctx.session.state['ranked_plays']`.
- [x] Emit "Why this" tooltips to UI by storing `reason_markdown` for each candidate; ensure markdown sanitized before render.
- [x] Add ADK eval `agent/evals/dry_run_ranking_G-B.json` covering GTM/support/ops personas; integrate into `mise run test-agent` and ensure pass/fail gating in CI.
- [x] Log planner telemetry (`planner_latency_ms`, `primary_toolkits`, `embedding_similarity_avg`, `candidate_count`) to Supabase via new `planner_runs` table; verify p95 latency ≤2.5s and top-3 similarity ≥0.62 using `scripts/validate_planner_metrics.py`.
- [x] Store evaluation results in `docs/readiness/planner_eval_G-B.json` including similarity histograms and failure cases with remediation notes.

#### Evidence Service & Proof Pack

**Owner:** Runtime Steward  
**References:** [architecture.md §3.5](./architecture.md#35-evidence--analytics), [prd.md "Evidence & coaching"](./prd.md#evidence-analytics--governance)

- [x] Stand up `agent/services/evidence_service.py` with `hash_tool_args`, `bundle_proof_pack`, and `store_artifact` helpers; hash inputs using SHA-256 with deterministic JSON canonicalization and redact PII fields before hashing.
- [x] Upload payloads >200 KB to Supabase Storage bucket `evidence-artifacts`; persist `content_ref`, `hash`, `size_bytes` to `artifacts` table and link to `tool_calls` via `tool_call_id`.
- [x] Append undo plans (`undo_plan_json`) to every `tool_calls` record and expose Undo CTA in UI; include validator-generated precautions when present.
- [x] Generate human-readable summary (`docs/readiness/evidence_bundle_sample_G-B.json`) combining mission brief, ranked plays, execution transcript, and safeguard feedback; confirm schema validated against TypeScript types.
- [x] Ship verification script `scripts/verify_artifact_hashes.py` and run after dry-run scenarios to ensure 100% hash parity between storage and DB.
- [x] Produce undo smoke log (`docs/readiness/undo_trace_G-B.md`) showing executed undo with timestamps, evidence updates, and telemetry alignment.

#### Mission Transcript Persistence & Telemetry Retention

**Owner:** Data Engineer  
**References:** [architecture.md §3.4](./architecture.md#34-supabase-data-plane), [ux.md §10](./ux.md#10-instrumentation--telemetry-touchpoints), [libs_docs/supabase/llms_docs.txt](../libs_docs/supabase/llms_docs.txt)

- [x] Persist streaming chat + annotation records to `copilot_messages` with `mission_id`, `payload_type`, `latency_ms`, `telemetry_event_ids`.
- [x] Add telemetry fields to `plays` (`latency_ms`, `success_score`, `tool_count`, `evidence_hash`) and backfill existing rows with defaults.
- [x] Implement 7-day retention via scheduled job (`supabase/functions/cron/copilot_message_cleanup.sql`) and confirm job registered in `supabase/config.toml`.
- [x] Build SQL audit (`scripts/sql/cp_messages_retention.sql`) to prove soft-deletions of >7 day records and log output to `docs/readiness/message_retention_G-B.csv`.
- [x] Ensure Supabase RLS allows owner + governance read-only access; add policy tests using `scripts/test_supabase_persistence.py --gate G-B` and archive results.

#### Generative Quality & Prompt Calibration

**Owner:** Product Design + Runtime Steward  
**References:** [ux.md §5.1](./ux.md#51-generative-intake-panel), [prd.md §6](./prd.md#metrics--success-criteria)

- [x] Create analytics job `scripts/analyze_edit_rates.py` that reads `mission_metadata` edits + confidence, outputs acceptance %, regeneration counts, guardrail adjustments segmented by persona.
- [x] Establish baseline with ≥3 pilot tenants (10 missions each) and capture report `docs/readiness/generative_quality_report_G-B.md` including confidence vs. edit scatter plots.
- [x] Tune intake prompts + safeguard templates; version control prompt changes in `docs/prompts/intake/` with change log noting rationale and observed impact.
- [x] Validate acceptance threshold ≥70% per brief field and ≤3 regenerations median; raise alert if confidence <0.55 but acceptance >80% (calibration drift) via dashboard update.
- [x] Gather qualitative feedback: run 3 moderated sessions, log quotes + insights to `docs/readiness/generative_quality_notes_G-B.md` and push follow-up actions to backlog.

#### Dry-Run Governance Playbook

**Owner:** Governance Sentinel  
**References:** [prd.md §5](./prd.md#evidence-analytics--governance), [architecture.md §3.7](./architecture.md#37-adaptive-safeguards), [ux.md §7](./ux.md#7-adaptive-safeguards-ux)

- [x] Draft reviewer SOP `docs/readiness/reviewer_workflow_G-B.md` covering decision tree (accept ↔ request changes ↔ escalate), safeguard interpretation, and undo expectations; include flowchart exported as SVG.
- [x] Add template for ROI + risk notes appended to evidence bundle (`docs/readiness/undo_narrative_template_G-B.md`) with guidance on quiet-window overrides and escalation contacts.
- [x] Conduct tabletop review with Governance Sentinel + Runtime Steward; record meeting notes + sign-off in `docs/readiness/governance_signoff_G-B.md`.
- [x] Update `docs/readiness/status_beacon_B.json` format to capture percentage completion per checklist, owner, blockers, and link to risk register.
- [x] Maintain risk register `docs/readiness/risk_register_G-B.json` noting mitigation owners for streaming regressions, telemetry gaps, storage failures, prompt drift, and reviewer backlog.

### Acceptance Instrumentation

**Required Tests & Audits:**

1. **Dry-run stopwatch:** Execute 3 persona scenarios (Revenue, Support, Finance) using seeded missions; record timestamps from intent submission to evidence bundle creation; verify <15 minutes per run; archive in `docs/readiness/dry_run_verification.md`.
2. **Streaming resilience QA:** Cypress or Playwright run (`pnpm test:streaming`) that asserts timeline updates every ≤5 s, approval modal interaction, and `copilotkit_exit` event.
3. **Evidence hash parity:** Run `python scripts/verify_artifact_hashes.py` and ensure 100% match between Supabase Storage and `artifacts` table; output saved to `docs/readiness/evidence_hash_report_G-B.json`.
4. **Telemetry audit:** Use `scripts/audit_telemetry_events.py --gate G-B` to confirm events per UX telemetry catalog (mission_created, planner_stage_started, approval_required, approval_decision, undo_requested, undo_completed); export results to `docs/readiness/telemetry_audit_G-B.csv`.
5. **Retention enforcement:** Execute `python scripts/check_retention.py --table copilot_messages --ttl-days 7`; confirm deletion of aged rows and log to `docs/readiness/message_retention_G-B.csv` (same file as checklist output).
6. **Planner eval suite:** `mise run test-agent` (wraps `adk eval agent/evals/dry_run_ranking_G-B.json`) – ensure pass rate ≥90% and log summary to `docs/readiness/planner_eval_G-B.json`.

### Evidence Artifacts (Required for Promotion)

- `docs/readiness/copilotkit_stream_contract_G-B.md`
- `docs/readiness/copilotkit_session_G-B.mp4` + console logs
- `docs/readiness/library_seed_log_G-B.md`
- `docs/readiness/planner_eval_G-B.json`
- `docs/readiness/evidence_bundle_sample_G-B.json`
- `docs/readiness/evidence_hash_report_G-B.json`
- `docs/readiness/undo_trace_G-B.md`
- `docs/readiness/message_retention_G-B.csv`
- `docs/readiness/generative_quality_report_G-B.md`
- `docs/readiness/generative_quality_notes_G-B.md`
- `docs/readiness/reviewer_workflow_G-B.md`
- `docs/readiness/status_beacon_B.json`
- `docs/readiness/risk_register_G-B.json`

### Gate KPIs & Metrics

- Dry-run cycle time <15 min (p95) from intent to artifact for each primary persona.
- Streaming heartbeat latency ≤5 s p95 from planner/executor to UI event receipt.
- Planner ranking latency ≤2.5 s p95; ≥85% of accepted plays drawn from Top-3 recommendations.
- Evidence hash parity 100%; undo plan success rate ≥95% in dry-run verification.
- Mission transcript retention: zero records older than 7 days unless flagged exempt (governance override).
- Generative acceptance ≥70% per brief field with ≤3 regenerations median; safeguard hint adoption ≥60%.

### Exit Criteria

- [x] All checklist items above checked with linked evidence artifacts.
- [x] Required tests (1–6) executed with passing status and stored outputs.
- [x] `status_beacon_B.json` reports ≥95% readiness and zero critical blockers.
- [x] Governance Sentinel + Runtime Steward sign-off documented in `governance_signoff_G-B.md`.
- [x] Updated risk register shows mitigations for all High risks with target owners.

### Dependencies & Risk Mitigation

- **Upstream:** Gate G-A evidence bundle + Supabase schema must remain stable; any migration deltas require re-running `scripts/test_supabase_persistence.py`.
- **Runtime:** Composio API quota and tool catalog freshness; schedule nightly `catalog-sync` Edge Function prior to planner evals.
- **UX/Frontend:** Next.js streaming reliability; include feature flag fallback to disable timeline if regressions detected.
- **Risks:**
  - Streaming regression → Mitigate with Playwright smoke + observability dashboards.
  - Telemetry drops → Implement retry + dead-letter queue for Supabase inserts; alert if drop rate >2%.
  - Evidence storage failure → Monitor Supabase Storage quotas; replicate bundles to local cache.
  - Prompt drift → Compare acceptance metrics weekly; revert prompt version if acceptance <65%.
  - Reviewer backlog → Add reminder emails via Supabase function if approval pending >4 hrs.

### Rollout & Post-Gate Tasks

- Publish Gate G-B retrospective and archive evidences in `docs/readiness/archive/2025-10-G-B/`.
- Socialize KPI improvements with GTM enablement; refresh enablement decks.
- Prepare Gate G-C kick-off: inventory OAuth-enabled missions, pre-seed safeguard lessons, schedule governance workshop.
- Ensure monitoring dashboards (Supabase telemetry + CopilotKit streaming) are linked in `docs/readiness/status_beacon_B.json` for ongoing visibility.

---

## Gate G-B — Code Refactoring & Cleanup Checkpoints

**Purpose:** This section outlines concrete refactoring tasks required to bring the codebase into alignment with Gate G-B documentation (architecture.md, ux.md, workflow.md). These checkpoints retire Gate G-A fallback logic and implement the full eight-stage flow with managed auth, coverage meters, streaming status panels, planner insight rails, evidence services, and comprehensive telemetry.

**Key Alignment Goals:**

- Remove all Gate G-A fallback states; ensure 100% generative intake
- Implement eight-stage mission flow with stage transitions
- Add managed auth flow via Composio Connect Link APIs
- Implement coverage meter with MCP inspection preview
- Add planner insight rail with streaming rationale
- Implement streaming status panel with heartbeat monitoring
- Add comprehensive telemetry aligned with ux.md §10 catalog
- Retire legacy placeholder logic and ensure RLS policies match current schema

### React/Next.js Control Plane Refactoring

**Owner:** CopilotKit Squad
**References:** [architecture.md §3.1](./architecture.md#31-presentation--control-plane-nextjs--copilotkit), [ux.md §4–§6](./ux.md#4-mission-workspace-anatomy), [workflow.md §1–§8](./workflow.md#1-eight-stage-mission-workspace-flow)

#### A. Generative Intake Component

**Location:** `src/components/MissionIntake.tsx`, `src/app/api/intake/*`

- [ ] **Remove fallback state UI**: Audit `MissionIntake.tsx` for any "manual input" or "skip generation" fallback paths; delete all fallback branches to enforce 100% generative intake per architecture.md §3.1 and ux.md §5.1.
  - **Acceptance:** No UI code path allows bypassing chip generation; all mission metadata sourced from Gemini generation or user edits of generated chips.
  - **Evidence:** Grep codebase for "fallback", "manual", "skip_generation" flags; confirm removal in PR diff.

- [ ] **Add confidence badges to chip rows**: Each generated chip (objective, audience, KPIs, safeguard hints) must display confidence score badge (High/Medium/Low) per ux.md §5.1.
  - **Acceptance:** Chips render with color-coded confidence badges; screen reader announces confidence level.
  - **Evidence:** Screenshot showing chip row with confidence badges; accessibility audit confirms ARIA labels.
  - **File references:** `src/components/MissionIntake.tsx:generateBrief callback`, confidence rendering in chip component.

- [ ] **Implement chip edit/regenerate/reset controls**: Wire inline edit, regenerate single chip, and reset-to-previous controls per ux.md §5.1 interaction pattern.
  - **Acceptance:** Users can edit chip inline (opens textarea), regenerate (calls `/api/intake/regenerate`), or reset to previous version; all actions emit `brief_item_modified` telemetry.
  - **Evidence:** Unit tests for chip actions; telemetry audit confirms event payloads.
  - **File references:** `src/components/MissionIntake.tsx:ChipRow`, `/api/intake/regenerate/route.ts`.

- [x] **Add token count and privacy notice**: Display character/token count indicator and privacy notice ("No data stored until you accept") per ux.md §4.2.
  - **Acceptance:** Banner shows live token count; privacy notice visible and accessible.
  - **Evidence:** Screenshot with token counter; accessibility audit confirms notice read by screen reader.
  - **File references:** `src/components/MissionIntake.tsx:GenerativeIntakeBanner`.

- [x] **Enforce 3-regeneration limit**: Implement client-side + server-side check to limit regeneration attempts per chip to 3 before prompting manual input per workflow.md §3.
  - **Acceptance:** After 3 regeneration attempts, UI displays "Edit manually" prompt instead of "Regenerate" button; backend validates regeneration count.
  - **Evidence:** Integration test confirming limit enforcement; backend validation logs.
  - **File references:** `src/lib/intake/service.ts:generateBrief`, `src/app/api/intake/regenerate/route.ts`.

#### B. Mission Workspace Eight-Stage Flow

**Location:** `src/app/(control-plane)/ControlPlaneWorkspace.tsx`, stage-specific components

- [x] **Implement stage progression state machine**: Refactor workspace to track eight stages (Intake → Brief → Toolkits → Inspect → Plan → Dry-Run → Evidence → Feedback) with clear stage transitions per workflow.md §1.
  - **Acceptance:** Workspace state includes `currentStage` enum; navigation between stages validated; cannot skip required stages.
  - **Evidence:** Unit tests for state machine transitions; stage progression logged to telemetry.
  - **File references:** `src/app/(control-plane)/ControlPlaneWorkspace.tsx:useMissionStage hook`, stage components.

- [x] **Add stage-specific telemetry events**: Emit stage transition events matching workflow.md §12 catalog (e.g., `stage_intake_completed`, `stage_toolkits_started`, `stage_plan_validated`).
  - **Acceptance:** All eight stages emit start/complete/failed events; payloads include stage name, duration, mission_id.
  - **Evidence:** Telemetry audit CSV showing all stage events; dashboard displays stage funnel.
  - **File references:** `src/lib/telemetry.ts`, stage transition hooks.

- [ ] **Implement Stage 3: Toolkit Palette with Composio Discovery**: Build `<RecommendedToolStrip>` component that displays toolkit cards with no-auth/OAuth badges, impact estimates, precedent missions per ux.md §5.2.
  - **Acceptance:** Toolkit cards render with badges, multi-select enabled, selections persist to `mission_safeguards`; inspection preview triggers on selection.
  - **Evidence:** Component screenshot showing toolkit cards; Supabase query confirms persisted selections; integration test validates inspection flow.
  - **File references:** `src/components/RecommendedToolStrip.tsx`, `src/app/api/toolkits/recommend/route.ts`, Composio `tools.get` integration per libs_docs/composio/llms.txt §3.1.

- [x] **Implement Stage 4: Coverage Meter with MCP Inspection**: Build coverage meter component displaying readiness percentage, gap highlights, and inspection preview per ux.md §4.2 and workflow.md §4.1.
  - **Acceptance:** Coverage meter shows percentage (0-100%); gaps highlighted in red; inspection summaries rendered inline; ≥85% required to proceed.
  - **Evidence:** Screenshot of coverage meter at various percentages; unit tests for gap calculation; MCP draft call logs.
  - **File references:** `src/components/CoverageMeter.tsx`, `src/app/api/inspect/preview/route.ts`, ADK inspection agent integration.

- [x] **Implement Stage 5: Planner Insight Rail**: Build streaming planner insight rail showing play ranking rationale, library matches, confidence scores per ux.md §5.3 and architecture.md §3.2.
  - **Acceptance:** Insight rail streams rationale markdown as planner ranks plays; "Why This?" tooltips populated; plays display impact/risk/undo metadata.
  - **Evidence:** Video showing streaming rationale; screenshot of tooltip; Supabase query shows `reason_markdown` populated.
  - **File references:** `src/components/PlannerInsightRail.tsx`, `src/app/api/planner/rank/route.ts`, ADK planner streaming integration per libs_docs/adk/llms-full.txt.

- [x] **Implement Stage 6: Streaming Status Panel**: Build streaming status panel with live progress narration, heartbeat monitoring, expandable logs per ux.md §5.4.
  - **Acceptance:** Status panel updates <5s p95 latency; shows checkmarks for completed steps; "Expand Details" reveals tool call logs; "Pause"/"Cancel" buttons functional.
  - **Evidence:** Latency measurements from telemetry; video showing real-time updates; unit tests for pause/resume.
  - **File references:** `src/components/StreamingStatusPanel.tsx`, CopilotKit `copilotkit_emit_message` integration per libs_docs/copilotkit/llms-full.txt.

- [ ] **Implement Stage 7: Artifact Gallery with Undo Bar**: Build artifact gallery with preview cards, download/share links, undo button per ux.md §5.6–§5.7.
  - **Acceptance:** Artifacts display with type badges; preview expands inline; download triggers Supabase Storage fetch; undo button visible for 24h with confirmation modal.
  - **Evidence:** Screenshot of artifact gallery; video showing undo flow; Storage access logs.
  - **File references:** `src/components/ArtifactGallery.tsx`, `src/components/UndoButton.tsx`, `src/app/api/evidence/undo/route.ts`.

- [ ] **Implement Stage 8: Feedback Drawer**: Build per-artifact rating component and mission feedback form per ux.md §3.1 journey stage 8.
  - **Acceptance:** Users can rate artifacts (1-5 stars), submit mission feedback text, and provide learning signals; feedback persisted to `mission_feedback` table.
  - **Evidence:** Screenshot of feedback drawer; Supabase query confirms feedback rows; telemetry shows `artifact_feedback_submitted` events.
  - **File references:** `src/components/FeedbackDrawer.tsx`, `src/app/api/feedback/submit/route.ts`.

#### C. Approval Modal & Safeguard UX

**Location:** `src/components/ApprovalModal.tsx`, `src/components/SafeguardDrawer.tsx`

- [ ] **Add safeguard chips to approval modal**: Display accepted safeguard hints (tone, timing, escalation) as chips in approval modal per ux.md §5.5.
  - **Acceptance:** Modal renders safeguard chips with status (accepted/edited/auto-fixed); suggested fix highlighted; "Apply Fix" button functional.
  - **Evidence:** Screenshot of approval modal with safeguard chips; unit test validates chip rendering.
  - **File references:** `src/components/ApprovalModal.tsx:SafeguardChips`.

- [ ] **Implement focus trap and keyboard navigation**: Ensure approval modal traps focus, supports Esc to reject, Enter to confirm, E for Edit per ux.md §9.2.
  - **Acceptance:** Keyboard navigation works without mouse; screen reader announces options; focus returns to trigger on close.
  - **Evidence:** Accessibility audit report; automated axe-core scan passes.
  - **File references:** `src/components/ApprovalModal.tsx:useFocusTrap hook`.

- [ ] **Add undo plan narration**: Display undo plan in approval modal with screen reader support per ux.md §5.5.
  - **Acceptance:** Undo plan rendered as readable text; screen reader announces plan on modal open.
  - **Evidence:** Screen reader test recording; undo plan text verified in DOM.
  - **File references:** `src/components/ApprovalModal.tsx:UndoPlanSection`.

- [ ] **Wire optimistic UI for approvals**: Implement optimistic updates when reviewer approves; handle conflict when multiple reviewers act concurrently per Gate G-B checklist.
  - **Acceptance:** UI updates immediately on approval; backend resolves conflicts with "last write wins" + revision_id; conflict notification displayed to users.
  - **Evidence:** Integration test simulating concurrent approvals; conflict resolution logs.
  - **File references:** `src/app/api/approvals/route.ts:handleConflict`, `src/hooks/useOptimisticApproval.ts`.

#### D. CopilotKit Session Management

**Location:** `src/app/api/copilotkit/*`, `src/hooks/useCopilotSession.ts`

- [ ] **Persist CopilotKit messages to Supabase**: Implement message persistence via `/api/copilotkit/session` endpoint per architecture.md §3.1 and workflow.md §11.
  - **Acceptance:** All CopilotKit messages written to `copilot_messages` table with `mission_id`, `payload_type`, `latency_ms`; session state persisted to `copilot_sessions`.
  - **Evidence:** Supabase query shows message rows; integration test confirms reload restores session.
  - **File references:** `src/app/api/copilotkit/session/route.ts`, `src/lib/copilotkit/persistence.ts`.

- [ ] **Implement 7-day message retention**: Wire retention policy to delete messages older than 7 days per prd.md §5 and architecture.md §3.4.
  - **Acceptance:** Scheduled job (Supabase cron or Edge Function) deletes aged messages; `SESSION_RETENTION_MINUTES` configurable via env var.
  - **Evidence:** Cron job logs; query confirms no messages older than retention period; retention audit CSV.
  - **File references:** `supabase/functions/cron/copilot_message_cleanup.sql`, `src/lib/constants.ts:SESSION_RETENTION_MINUTES`.

- [ ] **Add session recovery with revision_id conflict handling**: Implement multi-tab recovery with revision conflict detection per workflow.md §11.
  - **Acceptance:** User refreshing page mid-mission resumes from latest state; multi-tab conflict surfaces "Continue in active tab" prompt.
  - **Evidence:** Integration test simulating refresh; multi-tab test confirms conflict detection.
  - **File references:** `src/hooks/useCopilotSession.ts:handleReconnect`, `src/app/api/copilotkit/session/route.ts:revisionCheck`.

- [ ] **Emit CopilotKit lifecycle telemetry**: Add `copilotkit_session_started`, `copilotkit_exit` events per workflow.md §12.
  - **Acceptance:** Session start/end logged with session_id, mission_id, duration; exit event always fires including error paths.
  - **Evidence:** Telemetry audit confirms events; integration test validates exit on error.
  - **File references:** `src/hooks/useCopilotSession.ts:emitLifecycleEvents`.

#### E. Accessibility & Keyboard Navigation

**Location:** `src/app/(control-plane)/*`, global styles

- [ ] **Implement global keyboard shortcuts**: Add shortcuts per ux.md §9.2 (N for New Mission, D for Dashboard, Ctrl+Z for Undo, ? for Help).
  - **Acceptance:** All shortcuts functional; help modal displays shortcut reference; shortcuts work without focus on input fields.
  - **Evidence:** Manual test checklist; keyboard shortcut documentation screenshot.
  - **File references:** `src/hooks/useGlobalKeyboard.ts`, `src/components/KeyboardHelp.tsx`.

- [ ] **Ensure WCAG 2.1 AA contrast ratios**: Audit all UI components for 4.5:1 text contrast, 3:1 UI component contrast per ux.md §9.1.
  - **Acceptance:** Automated Stark plugin scan passes; manual spot checks confirm ratios; color palette documented.
  - **Evidence:** Accessibility audit report; Stark scan results; color palette reference.
  - **File references:** `tailwind.config.js:colorPalette`, design system documentation.

- [ ] **Add live regions for streaming updates**: Ensure streaming status, approval interrupts, undo confirmations use ARIA live regions per ux.md §9.3.
  - **Acceptance:** Screen reader announces updates with appropriate politeness (status=polite, alerts=assertive); no announcement spam.
  - **Evidence:** Screen reader test recordings (NVDA, JAWS, VoiceOver); ARIA audit.
  - **File references:** `src/components/StreamingStatusPanel.tsx:liveRegion`, `src/components/ApprovalModal.tsx:alertRole`.

#### F. Frontend Telemetry Instrumentation

**Location:** `src/lib/telemetry.ts`, component event handlers

- [ ] **Implement telemetry catalog from ux.md §10**: Add all events from ux.md §10.2 table (37 events covering intake, planning, execution, approvals, feedback).
  - **Acceptance:** All 37 events emitting with correct payloads; events visible in Supabase `mission_events` table; no duplicate events.
  - **Evidence:** Telemetry audit CSV comparing implementation vs. catalog; event payload validation tests.
  - **File references:** `src/lib/telemetry.ts:emitEvent`, event definitions matching ux.md §10.2 schema.

- [ ] **Add frontend latency tracking**: Measure and log p50/p95/p99 latencies for key operations (chip generation, play selection, approval decision) per architecture.md §7.
  - **Acceptance:** Latencies calculated client-side and server-side; stored in `mission_events.latency_ms`; dashboard displays percentiles.
  - **Evidence:** Latency report showing distribution; dashboard screenshot with p95 metrics.
  - **File references:** `src/lib/telemetry.ts:trackLatency`, `src/app/api/analytics/latency/route.ts`.

- [ ] **Implement PII redaction in telemetry**: Ensure no secrets, emails, tokens logged in telemetry payloads per workflow.md §10.3.
  - **Acceptance:** Automated scan confirms no PII patterns in telemetry payloads; redaction rules documented.
  - **Evidence:** PII scan report; redaction rule tests; sample telemetry payload audit.
  - **File references:** `src/lib/telemetry.ts:redactPayload`, PII regex patterns.

### ADK Agent Backend Refactoring

**Owner:** Runtime Steward
**References:** [architecture.md §3.2](./architecture.md#32-orchestration-gemini-adk), [workflow.md §3–§8](./workflow.md#3-stage-1-intake--generative-mission-creation), [libs_docs/adk/llms-full.txt](../libs_docs/adk/llms-full.txt)

#### A. Coordinator Agent Refactoring

**Location:** `agent/agents/coordinator.py`, `agent/agent.py`

- [ ] **Migrate to ADK SequentialAgent pattern**: Refactor coordinator from single `LlmAgent` to `SequentialAgent` deriving pattern per architecture.md §3.2 and libs_docs/adk.
  - **Acceptance:** Coordinator chains `IntakeAgent → PlannerAgent → ExecutionLoop` with `max_retries=3`; stage transitions emit telemetry.
  - **Evidence:** ADK agent graph shows sequential flow; stage transition logs; integration test validates retry logic.
  - **File references:** `agent/agents/coordinator.py:SequentialAgent`, ADK callback hooks.

- [ ] **Implement IntakeAgent with context hydration**: Build lightweight IntakeAgent that hydrates `ctx.session.state['mission_context']` from accepted chips per architecture.md §3.2.
  - **Acceptance:** IntakeAgent reads `mission_metadata` and `mission_safeguards`; populates session state; validates chip acceptance before proceeding.
  - **Evidence:** Unit test confirms state hydration; logs show context keys populated.
  - **File references:** `agent/agents/intake_agent.py`, Supabase query for metadata.

- [ ] **Add coordinator telemetry with callback hooks**: Emit `planner_stage_started`, `validator_stage_started`, `evidence_stage_started` via ADK callback hooks per architecture.md §3.2.
  - **Acceptance:** Telemetry events logged at each stage transition; payloads include mission_id, stage_name, timestamp.
  - **Evidence:** Telemetry audit shows coordinator events; ADK callback hook tests.
  - **File references:** `agent/agents/coordinator.py:callback_hooks`, `agent/lib/telemetry.py`.

- [ ] **Implement copilotkit_exit deterministic call**: Ensure `copilotkit_exit` always fires from coordinator including error paths per Gate G-B checklist.
  - **Acceptance:** Exit event logged on success, failure, timeout; integration test validates exit in all paths; router recovery confirmed.
  - **Evidence:** Exit event logs; router recovery test; error path integration tests.
  - **File references:** `agent/agents/coordinator.py:finalizeRun`, `agent/lib/copilotkit_client.py:emit_exit`.

#### B. Planner Agent Enhancement

**Location:** `agent/agents/planner.py`, `agent/services/library_service.py`

- [ ] **Implement hybrid ranking pipeline**: Combine Supabase pgvector similarity with Composio `tools.get(search=...)` per architecture.md §3.2 and workflow.md §4.
  - **Acceptance:** Planner queries both library_entries (pgvector) and Composio; ranks plays by weighted score (similarity + success rate); enforces "no mixed filters" rule per libs_docs/composio/llms.txt §3.1.
  - **Evidence:** Planner ranking logs showing dual sources; unit tests for ranking algorithm; validation that `search` not mixed with `tools`.
  - **File references:** `agent/agents/planner.py:rankPlays`, `agent/services/composio_service.py:discoverTools`.

- [ ] **Persist PlannerCandidate structures with rationale**: Store reason_markdown, impact, toolkits, undo sketch, confidence to `plays` table and session state per Gate G-B checklist.
  - **Acceptance:** Each play row includes `reason_markdown`, `confidence`, `similarity_score`; session state contains `ranked_plays` list.
  - **Evidence:** Supabase query shows populated fields; session state dump includes plays; markdown sanitization tests.
  - **File references:** `agent/agents/planner.py:persistPlays`, `agent/models/planner_candidate.py`.

- [ ] **Add planner telemetry with latency tracking**: Log `planner_latency_ms`, `primary_toolkits`, `embedding_similarity_avg`, `candidate_count` to `planner_runs` table per Gate G-B checklist.
  - **Acceptance:** Planner telemetry logged with all required fields; validation script confirms p95 latency ≤2.5s, similarity ≥0.62.
  - **Evidence:** Planner telemetry CSV; latency histogram; validation script output.
  - **File references:** `agent/agents/planner.py:logTelemetry`, `scripts/validate_planner_metrics.py`.

- [ ] **Implement recommended toolkit palette generation**: Generate toolkit cards with no-auth/OAuth badges, impact estimates, precedent missions per architecture.md §3.8 and ux.md §5.2.
  - **Acceptance:** Planner emits toolkit recommendation payload to CopilotKit; cards include auth badge, impact score, precedent mission count, undo confidence.
  - **Evidence:** CopilotKit payload inspection; unit tests for recommendation structure; screenshot of rendered cards.
  - **File references:** `agent/agents/planner.py:generateToolkitRecommendations`, recommendation payload schema.

- [ ] **Add inspection preview with MCP draft calls**: Implement non-mutating MCP inspection pass (e.g., fetch 5 sample contacts) to validate coverage per workflow.md §4.1.
  - **Acceptance:** Inspection agent runs draft calls using selected toolkits; coverage meter populated with readiness percentage; gaps highlighted.
  - **Evidence:** MCP draft call logs; coverage calculation tests; inspection summary artifacts stored.
  - **File references:** `agent/agents/inspection_agent.py`, `agent/services/mcp_client.py:draftCall`.

#### C. Validator Agent Enhancement

**Location:** `agent/agents/validator.py`

- [ ] **Consume accepted safeguard hints**: Refactor validator to read `mission_safeguards` with `status='accepted'` and apply constraints (tone, timing, escalation, budget) per architecture.md §3.7.
  - **Acceptance:** Validator queries safeguards table; applies tone checks, quiet window validation, escalation routing; returns `auto_fix`, `ask_reviewer`, or `retry_later`.
  - **Evidence:** Validator decision logs; unit tests for each safeguard type; integration test validates enforcement.
  - **File references:** `agent/agents/validator.py:applyHints`, Supabase safeguards query.

- [ ] **Log validator decisions to safeguard_events**: Write outcome, rationale, applied fixes to `safeguard_events` table per workflow.md §7.
  - **Acceptance:** Each validator decision logged with event_type (hint_applied, violation_detected, auto_fix), details JSON, resolved_at timestamp.
  - **Evidence:** Supabase query shows safeguard_events rows; event schema validation tests.
  - **File references:** `agent/agents/validator.py:logFeedback`, `agent/models/safeguard_event.py`.

- [ ] **Implement validator interrupt with CopilotKit**: Raise `CopilotInterrupt` when `ask_reviewer` outcome produced per architecture.md §4.3 and ux.md §5.5.
  - **Acceptance:** Validator calls CopilotKit interrupt API; approval modal rendered in UI; reviewer decision persisted to `approvals`.
  - **Evidence:** Interrupt flow integration test; approval modal screenshot; decision persistence verified.
  - **File references:** `agent/agents/validator.py:raiseInterrupt`, CopilotKit interrupt integration per libs_docs/copilotkit.

- [ ] **Add negative case evaluation suite**: Test tone softening, quiet window breach, escalation required scenarios per Gate G-B checklist.
  - **Acceptance:** ADK eval suite `agent/evals/validator_g_c.yaml` covers all negative cases; pass rate ≥90%.
  - **Evidence:** Eval run logs; pass/fail summary; failure case remediation notes.
  - **File references:** `agent/evals/validator_g_c.yaml`, `agent/tests/test_validator_negatives.py`.

#### D. Evidence Service Implementation

**Location:** `agent/services/evidence_service.py`

- [ ] **Implement hash_tool_args with SHA-256 canonicalization**: Hash tool arguments deterministically with PII redaction per architecture.md §3.5 and Gate G-B checklist.
  - **Acceptance:** Tool args hashed using SHA-256 with JSON canonicalization (sorted keys); PII fields redacted before hashing; hash stored in `tool_calls.args_hash`.
  - **Evidence:** Hash verification script confirms deterministic hashing; PII redaction tests; hash parity report.
  - **File references:** `agent/services/evidence_service.py:hash_tool_args`, PII redaction rules.

- [ ] **Implement bundle_proof_pack with metadata**: Compile mission brief, plays, tool calls, undo plans, safeguard feedback into structured bundle per Gate G-B checklist.
  - **Acceptance:** Evidence bundle includes all required sections; schema validated against TypeScript types; sample bundle stored in readiness docs.
  - **Evidence:** Bundle schema validation; sample JSON in `docs/readiness/evidence_bundle_sample_G-B.json`; TypeScript type comparison.
  - **File references:** `agent/services/evidence_service.py:bundle_proof_pack`, `agent/models/evidence_bundle.py`.

- [ ] **Implement Supabase Storage upload for large payloads**: Upload payloads >200 KB to `evidence-artifacts` bucket per architecture.md §3.5.
  - **Acceptance:** Storage upload triggers when payload exceeds threshold; `artifacts.content_ref` points to Storage URL; `size_bytes` recorded.
  - **Evidence:** Storage logs; size threshold tests; artifact table queries show Storage URLs.
  - **File references:** `agent/services/evidence_service.py:store_artifact`, Supabase Storage client integration per libs_docs/supabase.

- [ ] **Attach undo plans to every tool call**: Ensure every mutating tool call includes `undo_plan_json` with validator precautions per Gate G-B checklist.
  - **Acceptance:** `tool_calls.undo_plan` populated for all mutating calls; undo plan includes rollback steps, validator notes, time-bound constraints.
  - **Evidence:** Supabase query confirms undo plans; undo plan schema validation; sample undo trace.
  - **File references:** `agent/services/evidence_service.py:attachUndoPlan`, `tool_calls` table schema.

- [ ] **Implement execute_undo with telemetry**: Build undo execution handler that executes rollback and logs outcome per workflow.md §8.
  - **Acceptance:** Undo handler reads `tool_calls.undo_plan`, executes steps, updates `undo_status`, emits `undo_completed` telemetry.
  - **Evidence:** Undo smoke test in `docs/readiness/undo_trace_G-B.md`; telemetry shows undo events; undo success rate ≥95%.
  - **File references:** `agent/services/evidence_service.py:execute_undo`, `agent/lib/undo_executor.py`.

- [ ] **Build artifact hash verification script**: Create `scripts/verify_artifact_hashes.py` to ensure 100% hash parity per Gate G-B checklist.
  - **Acceptance:** Script reads artifacts from Storage and DB, recomputes hashes, reports mismatches; 100% parity required for gate promotion.
  - **Evidence:** Verification script output in `docs/readiness/evidence_hash_report_G-B.json`; parity report shows 0 mismatches.
  - **File references:** `scripts/verify_artifact_hashes.py`, verification report template.

#### E. Composio Integration Refactoring

**Location:** `agent/tools/composio_client.py`, `agent/services/composio_service.py`

- [ ] **Implement discovery with "no mixed filters" rule**: Ensure toolkit discovery never mixes `search` with explicit `tools` array or `scopes` across toolkits per libs_docs/composio/llms.txt §3.1.
  - **Acceptance:** Discovery code validates filter mode; raises error if mixed filters detected; discovery request + result hash logged.
  - **Evidence:** Unit tests for mixed filter validation; discovery logs show filter mode; error handling test.
  - **File references:** `agent/services/composio_service.py:discoverTools`, filter validation logic.

- [ ] **Implement managed auth via Connect Link**: Wire OAuth handshake using `toolkits.authorize` and `waitForConnection` per libs_docs/composio/llms.txt §4.1.
  - **Acceptance:** Auth flow generates `redirect_url`, stores `connection_id` and scopes in `oauth_tokens` with encryption; connection wait timeout handled.
  - **Evidence:** OAuth flow integration test; encrypted token storage verified; connection timeout test.
  - **File references:** `agent/tools/composio_client.py:authorize`, `agent/services/oauth_service.py:storeToken`.

- [ ] **Implement inspection mode with draft calls**: Support `execution_mode='SIMULATION'` for dry-run preview calls per workflow.md §5.
  - **Acceptance:** Draft calls annotated with `simulation_notice=true`; results flagged in UI; no live data mutations.
  - **Evidence:** Draft call logs; UI badge verification; mutation prevention tests.
  - **File references:** `agent/services/composio_service.py:executeTool`, simulation mode flag handling.

- [ ] **Add Composio rate limit handling**: Respect retry headers on 429 responses; pause mission, log `mission_flags.rate_limited` per workflow.md §13.
  - **Acceptance:** Rate limit handler backs off exponentially (max 3 retries); mission paused with "retry in Xs" message; rate limit flag logged.
  - **Evidence:** Rate limit drill test; backoff timing logs; UI messaging screenshot.
  - **File references:** `agent/services/composio_service.py:handleRateLimit`, exponential backoff implementation.

- [ ] **Implement trigger lifecycle management**: Build `create_trigger`, `subscribe_trigger`, `disable_trigger` per libs_docs/composio/llms.txt §7 and workflow.md §9.
  - **Acceptance:** Trigger CRUD operations functional; trigger configs stored in `triggers` table with `connection_id`, `scopes`, `status`; webhook subscription logged.
  - **Evidence:** Trigger lifecycle integration test; trigger events in `trigger_warehouse`; subscription logs.
  - **File references:** `agent/services/trigger_service.py`, `triggers` table schema.

#### F. ADK Evaluation Suite Expansion

**Location:** `agent/evals/`, `mise` tasks

- [ ] **Add dry-run ranking eval suite**: Create `agent/evals/dry_run_ranking_G-B.json` covering GTM/support/ops personas per Gate G-B checklist.
  - **Acceptance:** Eval suite includes ≥15 scenarios (5 personas × 3 variants); pass rate ≥90%; integrated into `mise run test-agent`.
  - **Evidence:** Eval run summary in `docs/readiness/planner_eval_G-B.json`; CI gating on eval pass rate.
  - **File references:** `agent/evals/dry_run_ranking_G-B.json`, `mise` test-agent task.

- [ ] **Add governed-mode regression set**: Extend eval coverage to include OAuth-backed governed scenarios per workflow integration gap GAP-04.
  - **Acceptance:** Governed eval suite covers approval interrupts, undo execution, safeguard enforcement; pass rate ≥90%.
  - **Evidence:** Eval results; governed scenario coverage report.
  - **File references:** `agent/evals/governed_scenarios_G-B.json`.

- [ ] **Integrate evals into CI gating**: Ensure `mise run test-agent` fails builds on eval regressions per Gate G-A checklist.
  - **Acceptance:** CI pipeline runs eval suite; build fails if pass rate <90%; eval results logged to readiness docs.
  - **Evidence:** CI logs showing eval gate; build failure on regression; eval artifact upload.
  - **File references:** `.github/workflows/test-agent.yml`, CI eval task.

### Supabase Schema Verification & In-Place Updates

**Owner:** Data Engineer
**References:** [architecture.md §3.4–§3.5](./architecture.md#34-supabase-data-plane), [workflow.md §10](./workflow.md#10-supabase-persistence-map), [libs_docs/supabase/llms_docs.txt](../libs_docs/supabase/llms_docs.txt)

> **Approach:** The Gate G-A/G-B schema, triggers, indexes, policies, functions, and analytics views all live in the consolidated migration `supabase/migrations/0001_init.sql`. When schema or policy work is required:
> - edit the relevant section of `0001_init.sql` (and companion seeds/comments) in place
> - regenerate types with `supabase gen types typescript --linked --schema public,storage,graphql_public >| supabase/types.ts`
> - do **not** add new `00XX_*.sql` migrations
> Runtime cron jobs and Edge Functions continue to live under `supabase/functions/` with schedules in `supabase/config.toml`.

#### A. Schema Verification & Telemetry Enhancements

- [ ] **Verify/Update plays telemetry columns** (`0001_init.sql`, plays table block). Confirm `latency_ms`, `success_score`, `tool_count`, and `evidence_hash` exist with comments/defaults; add missing columns in place and backfill if needed.
- [ ] **Verify/Update planner_runs telemetry table** (`0001_init.sql`, planner_runs block). Ensure schema, indexes (`idx_planner_runs_*`), and RLS mirror Gate G-B telemetry requirements.
- [ ] **Verify/Update mission_feedback table** (`0001_init.sql`, mission_feedback block). Check rating/feedback/learning_signals fields, triggers, and indexes; extend if Stage 8 contract evolves.
- [ ] **Verify/Update inspection_findings table** (`0001_init.sql`, inspection_findings block). Confirm coverage payload structure, indexes, and RLS; adjust for new inspection metadata.
- [ ] **Verify/Update toolkit_selections table** (`0001_init.sql`, toolkit_selections block). Ensure selected_tools JSON schema, uniqueness, indexes, and RLS coverage; update comments/examples as palette model changes.
- [ ] **Regenerate Supabase types** after any schema edits so the TypeScript client mirrors the updated definitions.

#### B. RLS Policy Verification & Governance Access

- [ ] **Review tenant-scoped RLS policies** (`0001_init.sql`, RLS section). Confirm objectives, mission_metadata, mission_safeguards, plays, tool_calls, approvals, artifacts, triggers, oauth_tokens, planner_runs, and feedback tables all enforce tenant isolation; patch policies in place if gaps are discovered.
- [ ] **Plan governance read-only policies** (Gate G-C). Document the required SELECT policies for governance personas; when ready, add them directly to the RLS policy block in `0001_init.sql`.
- [ ] **Validate oauth_tokens encryption** (`0001_init.sql`, oauth_tokens block) continues to align with `agent/services/oauth_service.py` helpers and pgcrypto columns; update column definitions or helper functions in the same migration if encryption strategy changes.

#### C. Analytics Views Verification & Updates

- [ ] **Check analytics_generative_acceptance view** (`0001_init.sql`, analytics views section). Update the SELECT if metric definitions move; ensure refresh strategy is documented.
- [ ] **Check analytics_connection_adoption view** (same section). Confirm toolkit adoption calculations still match mission_safeguards schema; revise in place as needed.
- [ ] **Check analytics_undo_success view** (same section). Validate undo KPIs remain accurate; adjust calculations for new undo telemetry.
- [ ] **Scope upcoming safeguard feedback view** (Gate G-C). Capture requirements now; when ready, add the view definition to the analytics block in `0001_init.sql`.
- [ ] **Define/verify view refresh cadence** (materialized vs standard). If materialized views are adopted, update the migration and schedule refresh via `supabase/config.toml`.

#### D. Edge Functions & Cron Jobs

- [ ] **Copilot message cleanup cron**: Keep `public.cleanup_copilot_messages` in `0001_init.sql` aligned with retention policy and schedule the job via `supabase/config.toml`; capture results in `docs/readiness/message_retention_G-B.csv`.
- [ ] **catalog-sync Edge Function**: Maintain implementation in `supabase/functions/catalog-sync/` and its schedule; update docs when toolkit scope changes.
- [ ] **generate-embedding Edge Function**: Ensure `supabase/functions/generate-embedding/` stays in sync with `library_entries` schema and embedding requirements.
- [ ] **Safeguard feedback rollup** and **trigger consistency jobs** (Gate G-C/G-D) remain TODOs—implement as Edge Functions with schedules once requirements finalize.

#### E. Database Performance & Indexing

- [ ] **Verify existing indexes** (`0001_init.sql`, index block). Ensure pgvector and composite indexes reflect current query patterns; adjust/add entries in the same section if new access patterns emerge.
- [ ] **Profile query latency** using `scripts/validate_supabase_queries.py`; when additional indexes are required, append them to the index block in `0001_init.sql` and document the before/after performance.
- [ ] **Document optimizations** (query plans, latency improvements) in readiness artifacts after each adjustment.

### Gate G-A Fallback Logic Cleanup

**Owner:** All roles
**References:** All documentation sections mandating 100% generative flow

#### A. Code Audit & Removal

- [ ] **Grep codebase for fallback patterns**: Search for "fallback", "manual_input", "skip_generation", "default_value" flags and remove all non-generative paths.
  - **Acceptance:** Grep returns zero matches for fallback patterns in intake/planning/safeguard code; all paths require generation.
  - **Evidence:** Grep report showing no matches; PR diff confirming deletions; code review sign-off.
  - **File references:** Entire codebase audit, focus on `src/components/MissionIntake.tsx`, `agent/agents/planner.py`, `src/lib/intake/service.ts`.

- [ ] **Remove fallback UI components**: Delete any "Skip" buttons, "Enter manually" links, default form fields that bypass generation.
  - **Acceptance:** UI audit confirms no bypass mechanisms; all inputs flow through generative APIs; user testing validates no manual escape hatches.
  - **Evidence:** UI component inventory; user testing video; accessibility audit.
  - **File references:** `src/components/*`, UI component library.

- [ ] **Remove fallback database columns**: Remove any definitions named `*_fallback`, `manual_override`, `skip_generation` directly inside `supabase/migrations/0001_init.sql`.
  - **Acceptance:** Consolidated migration no longer defines fallback columns; application code has no references; existing data migrated or backfilled as needed.
  - **Evidence:** Updated migration diff; grep showing zero references; pre/post data snapshot.
  - **File references:** `supabase/migrations/0001_init.sql`.

#### B. Telemetry & Validation

- [ ] **Add telemetry assertion for 100% generative**: Validate all missions have `source='generated'` or `source='edited'` in mission_metadata; fail promotion if manual entries found.
  - **Acceptance:** Validation script confirms all missions generative; alert triggered if manual entry detected; daily monitoring dashboard.
  - **Evidence:** Validation script output; monitoring dashboard screenshot; alerting test.
  - **File references:** `scripts/validate_generative_compliance.py`, monitoring dashboard.

- [ ] **Update documentation to remove fallback references**: Audit all docs (architecture.md, ux.md, workflow.md, todo.md) and remove any mentions of fallback states or manual input paths.
  - **Acceptance:** Grep docs for "fallback" returns only historical context; all flow diagrams show generative-only paths; stakeholder review confirms clarity.
  - **Evidence:** Doc diff showing fallback removal; stakeholder sign-off; updated flow diagrams.
  - **File references:** `new_docs/*.md`, flow diagram sources.

### Verification & Testing Checkpoints

**Owner:** All roles
**Cross-functional responsibility**

#### A. Integration Test Suite

- [ ] **Build end-to-end eight-stage flow test**: Create integration test covering all eight stages from intake to feedback per workflow.md §1.
  - **Acceptance:** Test creates mission, progresses through all stages, validates state transitions, confirms telemetry; passes on CI.
  - **Evidence:** Test logs; telemetry validation; CI green build; test coverage report.
  - **File references:** `tests/integration/test_eight_stage_flow.ts`, CI integration.

- [ ] **Build streaming resilience test**: Playwright/Cypress test asserting timeline updates ≤5s, approval modal interaction, copilotkit_exit event per Gate G-B checklist.
  - **Acceptance:** Test simulates slow network, validates update frequency, confirms exit event; passes on CI.
  - **Evidence:** Test execution video; latency measurements; CI results.
  - **File references:** `tests/e2e/test_streaming_resilience.spec.ts`.

- [ ] **Build evidence hash parity test**: Automated test running `scripts/verify_artifact_hashes.py` and asserting 100% match per Gate G-B checklist.
  - **Acceptance:** Test downloads artifacts, recomputes hashes, asserts parity; fails build on mismatch.
  - **Evidence:** Hash verification report; CI gate enforcement; zero mismatches.
  - **File references:** `scripts/verify_artifact_hashes.py`, CI test step.

#### B. Accessibility & UX Testing

- [ ] **Run WCAG 2.1 AA audit**: Use automated tools (axe-core, Lighthouse) and manual testing (screen readers) per ux.md §9.1.
  - **Acceptance:** Automated scans pass; manual tests confirm keyboard navigation, live regions, contrast ratios; findings documented.
  - **Evidence:** Accessibility audit report in `docs/readiness/accessibility_audit_G-E.pdf`; manual test videos.
  - **File references:** Accessibility test scripts, audit report template.

- [ ] **Conduct usability testing with 3 personas**: Run moderated sessions with Revenue Lead, Support Lead, Governance Officer per ux.md §2.1.
  - **Acceptance:** Users complete missions without errors; quotes + insights captured; follow-up actions prioritized.
  - **Evidence:** Session recordings; insights summary in `docs/readiness/generative_quality_notes_G-B.md`; backlog items.
  - **File references:** Usability testing protocol, session notes.

#### C. Performance & Load Testing

- [ ] **Run dry-run stopwatch test**: Execute 3 persona scenarios (Revenue, Support, Finance) and validate <15 min completion per Gate G-B checklist.
  - **Acceptance:** All scenarios complete in <15 min p95; detailed timing breakdown captured; bottlenecks identified.
  - **Evidence:** Stopwatch report in `docs/readiness/dry_run_verification.md`; timing breakdown; optimization plan.
  - **File references:** `scripts/dry_run_stopwatch.py`, test scenarios.

- [ ] **Run streaming latency benchmark**: Measure p50/p95 latency from planner/executor to UI event receipt per Gate G-B KPIs.
  - **Acceptance:** p95 streaming heartbeat ≤5s; latency histogram generated; outliers investigated.
  - **Evidence:** Latency report; histogram chart; outlier root cause analysis.
  - **File references:** `scripts/measure_streaming_latency.py`, latency dashboard.

- [ ] **Run planner ranking latency test**: Validate p95 planner latency ≤2.5s and similarity ≥0.62 using `scripts/validate_planner_metrics.py` per Gate G-B checklist.
  - **Acceptance:** Planner meets latency and similarity targets; outliers documented; optimization recommendations.
  - **Evidence:** Planner metrics report; similarity histogram; optimization plan.
  - **File references:** `scripts/validate_planner_metrics.py`, baseline configuration.

#### D. Telemetry Audit

- [ ] **Run telemetry audit script**: Execute `scripts/audit_telemetry_events.py --gate G-B` to confirm all 37 events from ux.md §10.2 catalog per Gate G-B checklist.
  - **Acceptance:** Audit confirms all events present with correct payloads; no missing or duplicate events; coverage report generated.
  - **Evidence:** Telemetry audit CSV in `docs/readiness/telemetry_audit_G-B.csv`; event payload validation.
  - **File references:** `scripts/audit_telemetry_events.py`, expected events catalog.

- [ ] **Validate retention enforcement**: Execute `scripts/check_retention.py --table copilot_messages --ttl-days 7` per Gate G-B checklist.
  - **Acceptance:** Script confirms deletion of aged rows; no records older than 7 days unless exempt; deletion logs captured.
  - **Evidence:** Retention enforcement report in `docs/readiness/message_retention_G-B.csv`; deletion logs.
  - **File references:** `scripts/check_retention.py`, retention policy configuration.

### Documentation & Evidence Tasks

**Owner:** All roles
**Cross-functional responsibility**

- [ ] **Generate evidence bundle samples**: Create sample evidence bundles for each persona (Revenue, Support, Governance) per Gate G-B checklist.
  - **Acceptance:** Sample bundles stored in `docs/readiness/evidence_bundle_sample_G-B.json`; schema validated; human-readable summaries included.
  - **Evidence:** Sample bundle files; schema validation report; summary review.
  - **File references:** Sample generation script, bundle templates.

- [ ] **Document CopilotKit stream contract**: Create `docs/readiness/copilotkit_stream_contract_G-B.md` documenting all streaming payload formats per Gate G-B checklist.
  - **Acceptance:** Contract document includes all stream event types, payload schemas, example payloads, versioning strategy.
  - **Evidence:** Contract document; payload schema validation tests; example payload collection.
  - **File references:** `docs/readiness/copilotkit_stream_contract_G-B.md`, schema definitions.

- [ ] **Record CopilotKit session video**: Capture `docs/readiness/copilotkit_session_G-B.mp4` showing full mission flow with console logs per Gate G-B checklist.
  - **Acceptance:** Video shows intake → evidence flow; console logs visible; streaming updates demonstrated; <5 min duration.
  - **Evidence:** Video file; console log export; video review notes.
  - **File references:** Screen recording, console log capture.

- [ ] **Generate generative quality report**: Run `scripts/analyze_edit_rates.py` and produce `docs/readiness/generative_quality_report_G-B.md` per Gate G-B checklist.
  - **Acceptance:** Report includes acceptance rates (≥70% target), regeneration counts (≤3 median), confidence vs edit scatter plots; segmented by persona.
  - **Evidence:** Quality report; scatter plots; persona segmentation analysis.
  - **File references:** `scripts/analyze_edit_rates.py`, report template.

- [ ] **Draft reviewer workflow SOP**: Create `docs/readiness/reviewer_workflow_G-B.md` covering decision tree, safeguard interpretation, undo expectations per Gate G-B checklist.
  - **Acceptance:** SOP includes flowchart (SVG), decision criteria, escalation contacts, undo guidelines; governance sentinel sign-off.
  - **Evidence:** SOP document; flowchart export; sign-off documentation.
  - **File references:** SOP template, flowchart source.

- [ ] **Update status beacon**: Maintain `docs/readiness/status_beacon_B.json` with completion percentages, owners, blockers, risk register link per Gate G-B checklist.
  - **Acceptance:** Status beacon updated weekly; completion ≥95% for gate promotion; zero critical blockers; risk register current.
  - **Evidence:** Status beacon file; weekly update log; risk register.
  - **File references:** `docs/readiness/status_beacon_B.json`, update script.

---

## Gate G-C — Governed Activation Core

**Mission Question:** Can we execute OAuth-backed plays with adaptive safeguards, approvals, undo, and trigger lifecycle controls while preserving auditability?\*

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

1. **Dashboard QA:** Test p95 latency, filters, data accuracy;
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

| Document                             | Key Sections                                                                                 | Purpose                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [architecture.md](./architecture.md) | §2 (Layered Architecture), §3 (Component Blueprints), §4 (Runtime Flows), §7 (Observability) | Technical implementation guidance          |
| [prd.md](./prd.md)                   | §5 (Product Scope), §6 (Metrics), §7 (GTM Packaging)                                         | Business requirements and success criteria |
| [ux.md](./ux.md)                     | §4 (Workspace Anatomy), §5 (Interaction Patterns), §7 (Adaptive Safeguards)                  | Experience blueprint and interaction cues  |

**End of Roadmap**
