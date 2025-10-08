# AI Employee Control Plane — Execution Tracker (October 8, 2025)

This tracker is the single source of truth for what the AI Employee Control Plane must deliver and verify across all gates. Treat every item as actionable by AI agents or human counterparts unless marked informational.

## Live Program Snapshot
- **Current Gate:** G-A (Foundation Baseline)
- **Target Next Gate:** G-B readiness dry run ETA ≤ 2 sprints once high-priority backlog clears.
- **Core Pillars:** CopilotKit UX, Gemini ADK orchestration, Composio integrations, Supabase data plane, Governance/Compliance.

## Gate Ladder — Goals, Scope, Deliverables, Signals

### Gate G-A — Foundation Baseline
- **Goal:** Stand up zero-privilege infrastructure that proves the objective → artifact loop without OAuth credentials.
- **Scope (build & configure):**
  - Supabase migration `0001_init.sql` with pgvector enabled, RLS enforced, schema tests captured via `supabase db diff/push` transcripts.
  - CopilotKit control-plane shell in staging, synchronized with Supabase-backed session/message persistence (tables, retention policy, migrations, rollback plan).
  - Gemini ADK coordinator + planner availability checks (`adk eval` smoke suite) returning healthy.
  - Composio catalog snapshot job scheduled through Supabase `pg_cron` (nightly) writing checksum + metadata rows.
- **Deliverables / Evidence:**
  - `status_beacon_A.json` summarizing readiness %, blockers, owner sign-offs.
  - Supabase checksum log excerpts and CopilotKit smoke-note attachment stored in `docs/readiness/`.
- **Signals / Ownership:** Runtime Steward (ADK health), Data Engineer (Supabase schema & cron), CopilotKit squad (persistence QA), Governance Sentinel (RLS review).

### Gate G-B — Dry-Run Proof Loop
- **Goal:** Produce stakeholder-ready drafts within 15 minutes using no-auth toolkits.
- **Scope:**
  - Planner ranks plays via PRD + Composio `tools.get(search=…)` + Supabase embeddings.
  - Executors generate outreach/research/scheduling drafts; Evidence agent stores outputs and telemetry.
  - CopilotKit UI streams long-running updates with `copilotkit_emit_message`, exits loops via `copilotkit_exit`, and supports reviewer annotations.
  - Mission transcripts persisted for replay/debugging; retention validated.
- **Evidence:** `dry_run_verification.md` (latency chart, artifact samples, planner telemetry) and CopilotKit QA video/screenshots.
- **Signals:** `status_beacon_B.json`, Governance Sentinel SLA alerts, CopilotKit review transcript.

### Gate G-C — Governed Activation Core
- **Goal:** Enable OAuth-connected execution with approvals, undo, and triggers.
- **Scope:**
  - Composio OAuth handshake (`toolkits.authorize()` → `wait_for_connection()` → `tools.get()` → `provider.handle_tool_calls()` / `tools.execute()`) scripted and replayable.
  - Trigger lifecycle helpers (list/get/create/subscribe/disable) implemented with type-safe payloads and Supabase storage for audit.
  - Validator enforcing tone, rate, quiet hours; undo pipeline surfaced in CopilotKit UI with log references.
  - Copilot loop hygiene: every approval or completion path issues `copilotkit_exit`, prunes revoked messages, and verifies router recovery.
- **Evidence:** `governed_activation_report.csv` (connections, approvals, undo traces, trigger events) + approval feed export.
- **Signals:** `status_beacon_C.json`, CopilotKit approval feed notification trail, trigger health monitor.

### Gate G-D — Insight & Library Fabric
- **Goal:** Transform telemetry into recommendations and reusable plays.
- **Scope:**
  - Supabase dashboards (PostgREST + SQL queries) for adoption, ROI, guardrail incidents, approval throughput.
  - Library API with embeddings + ranking metadata; “next best job” endpoint using pgvector similarity.
  - Trigger event warehouse tables with analytics rollups.
- **Evidence:** `insight_snapshot.parquet`, `library_recommendations.json`, dashboard QA recordings.
- **Signals:** `status_beacon_D.json`, analytics QA alerts, trigger heatmaps.

### Gate G-E — Scale Hardening
- **Goal:** Validate security, performance, enablement ahead of GA.
- **Scope:**
  - Security checklist (token rotation, PII redaction, trigger permission audits).
  - Load tests for Composio tool & trigger throughput, Supabase query latency.
  - Enablement bundle (case studies, ROI calculator, trigger playbooks) published.
- **Evidence:** `trust_review.pdf`, `load_test_results.json`, enablement bundle artifact package.
- **Signals:** `status_beacon_E.json`, performance dashboards, enablement readiness score.

### Gate G-F — Stabilised Operations
- **Goal:** Demonstrate governed operations over two reporting windows.
- **Scope:**
  - Production telemetry with incident retrospectives and escalation analytics.
  - Trigger incident drill-downs and next-phase backlog alignment.
- **Evidence:** `stabilisation_digest.md` (KPIs, incident ledger, backlog summary).
- **Signals:** `status_beacon_F.json`, Supabase KPI snapshot, GTM sentiment digest.

## Immediate Backlog (Sprint-Level)
- [ ] **Supabase persistence:** finalize CopilotKit session/message schema, retention, migrations, and document rollback.
- [ ] **Cron job:** deploy nightly Composio catalog sync, expose job status + checksum validation in `status_beacon_A.json`.
- [ ] **CopilotKit streaming & exits:** add `copilotkit_emit_message` + `copilotkit_exit` hooks to current mission flow, capture QA artifacts (video + console logs).
- [ ] **pgvector/RLS validation:** run `supabase db diff/push` rehearsals and store command output with approvals in readiness archive.
- [ ] **Trigger scaffolding:** draft Supabase tables for trigger events and seed synthetic data for downstream analytics.
- [ ] **Evidence automation:** script exports of `docs/readiness/` artifacts to cold storage post-each checkpoint review.

## Operational Rituals & Verification
- **Before promoting a gate:** run targeted `adk eval` suites (dry-run + governed traces) and attach logs inside corresponding `status_beacon_<letter>.json`.
- **UI QA:** Capture CopilotKit session recordings whenever validating streaming updates, approvals, undo flows, or router exits.
- **Cron Monitoring:** Log Supabase `pg_cron` job execution IDs and errors into governance digest; page Data Engineer if failures >1 in 24h.
- **Evidence Sync:** After each checkpoint review, ensure Supabase evidence exports and `docs/readiness/` artifacts align (hash comparison logged).

## Cross-Stream Ownership
- **Orchestration Runtime:** Runtime Steward — ADK services, Composio SDK wrappers, trigger utilities.
- **Frontend & Copilot UX:** CopilotKit squad — mission intake, approvals UI, trigger notifications, streaming UX.
- **Data & Analytics:** Data Engineer — migrations, embeddings, dashboards, trigger warehouse.
- **Governance:** Governance Sentinel — guardrails, reviewer SOPs, undo assurances, retention policy compliance.
- **GTM Enablement:** Enablement Lead — playbooks, ROI stories, packaged plays, customer narratives.

## Dependency Matrix
- **CopilotKit:** `libs_docs/copilotkit/llms-full.txt` for persistence hooks, streaming, exit behaviours, message management.
- **Composio:** `libs_docs/composio/llms.txt` for discovery, auth, trigger lifecycle, governance expectations.
- **Gemini ADK:** `libs_docs/adk/llms-full.txt` covering agent composition, custom `_run_async_impl` patterns, eval tooling.
- **Supabase:** `libs_docs/supabase/llms_docs.txt` for pgvector, PostgREST, Edge Functions, Cron, CLI workflows.

## Risk Watchlist & Mitigations
- **Credential adoption lag:** escalate if <50% tenants progress to OAuth by Gate G-C; reinforce value via dry-run artifacts + case studies.
- **Approval fatigue:** monitor reviewer load (>6 approvals/day triggers batching feature design).
- **Integration drift:** schedule quarterly roadmap syncs with Composio, CopilotKit, ADK, Supabase; refresh docs + trackers after each sync.
- **Data anomalies:** run weekly QA queries; alert if embeddings drift, trigger events missing, or dashboards lag >24h.
- **Throughput guardrails:** enforce Composio/trigger latency p95 <250ms prior to Gate G-E; log load-test results.

## Decision Log & Open Questions (address before Gate G-D)
- [ ] Confirm LLM fallback strategy (Gemini primary vs. OpenAI/Anthropic adapters) and document prompt/telemetry adjustments.
- [ ] Finalize message redaction workflow within CopilotKit UI/CLI for governance audits.
- [ ] Schedule partner syncs (Composio, CopilotKit, ADK, Supabase) to validate roadmap assumptions embedded here.
- [ ] Determine telemetry granularity needed for outcome-based pricing experiments.

Keep this tracker updated whenever evidence ships, risks escalate, or dependency assumptions change. It replaces prior checkpoint plans — do not maintain parallel lists elsewhere.
