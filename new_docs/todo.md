# AI Employee Control Plane — Checkpoint Control Plan (October 8, 2025)

## Purpose
Provide a single program tracker that governs every gate of the AI Employee Control Plane. Each checkpoint below defines the minimum scope, acceptance instrumentation, evidence bundles, and dependencies needed to promote the system from zero-privilege proofs to governed activation and scale. Treat every checklist item as enforceable; promotion is blocked until all exit criteria are satisfied.

## Canonical References
- Business PRD (`new_docs/prd.md`)
- Technical Architecture Blueprint (`new_docs/architecture.md`)
- Guardrail Policy Pack (`new_docs/guardrail_policy_pack.md`)
- CopilotKit documentation (`libs_docs/copilotkit/llms-full.txt`)
- Composio field guide (`libs_docs/composio/llms.txt`)
- Gemini ADK repository notes (`libs_docs/adk/llms-full.txt`)
- Supabase AI & Vector toolkit (`libs_docs/supabase/llms_docs.txt`)

## Role Charter
| Role | Primary Ownership | Critical Touchpoints |
| --- | --- | --- |
| Runtime Steward | Gemini ADK orchestration, evaluation harnesses | ADK eval suites, custom `_run_async_impl` flows, error budgets |
| CopilotKit Squad | Mission intake UX, streaming status, approvals UI | `copilotkit_emit_message`, `copilotkit_exit`, shared state persistence |
| Data Engineer | Supabase schema, pgvector, Cron, analytics | `pg_cron`, PostgREST, Edge Functions, evidence exports |
| Governance Sentinel | Guardrails, reviewer SOPs, undo assurances | Policy enforcement, audit trails, redaction workflows |
| GTM Enablement Lead | Play library, evidence storytelling, customer readiness | Dry-run artifacts, ROI dashboards, enablement bundles |

## Checkpoint Overview
| Gate | Capability Focus | Primary Outcomes | Evidence Artifacts |
| --- | --- | --- | --- |
| G-A | Foundation Baseline | Zero-privilege proof infrastructure, catalog sync, persistence scaffolding | `status_beacon_A.json`, Supabase checksum logs, CopilotKit smoke notes |
| G-B | Dry-Run Proof Loop | Draft-quality outputs <15 minutes, streaming UX, transcript retention | `dry_run_verification.md`, QA media, telemetry snapshot |
| G-C | Governed Activation Core | OAuth execution, approvals, undo plans, trigger lifecycle | `governed_activation_report.csv`, approval feed export |
| G-D | Insight & Library Fabric | Analytics dashboards, library embeddings, trigger warehouse | `insight_snapshot.parquet`, `library_recommendations.json` |
| G-E | Scale Hardening | Security & performance certification, enablement assets | `trust_review.pdf`, `load_test_results.json`, enablement bundle |
| G-F | Stabilised Operations | Sustained governed ops, incident hygiene, roadmap alignment | `stabilisation_digest.md`, KPI exports |

---

## Gate G-A — Foundation Baseline
**Mission Question:** Can we demonstrate the objective → artifact loop without credentials while keeping governance instrumentation ready?

### Build Scope
- **CopilotKit:** Stage the mission workspace with shared state backed by Supabase tables (sessions/messages), apply retention policy, confirm message management hooks from the docs are callable.
- **Gemini ADK:** Expose coordinator + planner agents with deterministic `_run_async_impl` branches; ensure eval harness (`adk eval`) executes smoke scenarios.
- **Composio:** Nightly catalog snapshot via `pg_cron`, store toolkit metadata + checksum, validate `tools.get` and `get_raw_composio_tools` sampling for no-auth toolkits.
- **Supabase:** Apply `0001_init.sql` with pgvector, enforce RLS, rehearse `supabase db diff/push` to capture migration evidence.
- **Governance:** Map guardrail policy primitives (tone, quiet hours, undo concept) into documentation and reviewer SOP drafts.

### Acceptance Tests & Instrumentation
- `adk eval` smoke run logs saved with pass/fail summary.
- CopilotKit persistence rehearsal: create mission, refresh session, confirm state restored, log DB row hashes.
- Cron dry run: execute snapshot job once, verify checksum change and Supabase log entry.

### Evidence to Produce
- `status_beacon_A.json` with readiness %, owners, blockers.
- Supabase migration log (hash + command output) stored under `docs/readiness/`.
- Catalog snapshot checksum report.

### Exit Checklist
- [ ] Supabase schema + RLS validated, audit log captured.
- [ ] CopilotKit persistence + reload verified with screenshots/console output.
- [ ] Nightly Cron job scheduled and monitored.
- [ ] Guardrail policy mapping approved by Governance Sentinel.

### Dependencies & Notes
- Requires Google Gemini API key, Composio API key, Supabase project credentials (no secrets in repo).

---

## Gate G-B — Dry-Run Proof Loop
**Mission Question:** Can stakeholders receive high-quality drafts with full telemetry in <15 minutes and observe the agent’s reasoning live?

### Build Scope
- **CopilotKit:** Implement streaming via `copilotkit_emit_message`, enforce `copilotkit_exit` at loop completion, enable reviewer annotations.
- **Gemini ADK:** Planner ranking uses PRD recipes + Composio search + Supabase embeddings; Evidence agent archives artifacts and metrics.
- **Composio:** Integrate `tools.get(search=…)` filters for persona-relevant no-auth toolkits; log tool selection rationale in planner output.
- **Supabase:** Persist mission transcripts, artifact metadata, and telemetry with retention verification.
- **Governance:** Document reviewer workflow for dry-run sign-off, including undo narrative requirements.

### Acceptance Tests & Instrumentation
- End-to-end dry-run timed tests (<15 minutes) recorded with start/end timestamps.
- Evidence agent output hashed and compared to Supabase artifact storage records.
- Streaming UX QA video demonstrating interim status updates and reviewer edits.

### Evidence to Produce
- `dry_run_verification.md` containing timing table, artifact samples, planner telemetry.
- CopilotKit session recording (video) + console logs.
- Updated `status_beacon_B.json`.

### Exit Checklist
- [ ] Dry-run latency KPI met across 3 persona scenarios.
- [ ] Streaming status + exit hooks validated.
- [ ] Mission transcript retention confirmed for 7-day window.
- [ ] Reviewer workflow documented and approved.

### Dependencies & Notes
- Requires curated library seeds from architecture section 4.4 + PRD plays.

---

## Gate G-C — Governed Activation Core
**Mission Question:** Can the system execute OAuth-backed plays with approvals, undo, and trigger lifecycle controls while preserving auditability?

### Build Scope
- **CopilotKit:** Approval modals with risk, undo, scope preview; undo buttons wired to Evidence agent data; message pruning for revoked actions.
- **Gemini ADK:** Validators enforce tone, rate, quiet hours; Evidence agent stores undo plans; custom branching reruns executions on validation failure.
- **Composio:** Implement OAuth handshake (`toolkits.authorize`, `waitForConnection`) and trigger CRUD (`triggers.create/subscribe/disable`); log auth evidence.
- **Supabase:** Store approvals, tool calls, trigger configs with RLS; add PostgREST policies for reviewer and admin personas.
- **Governance:** Publish approval SOP, quiet-hour override policy, rollback checklist.

### Acceptance Tests & Instrumentation
- OAuth connection rehearsal recorded (redirect URL, connection ID, scopes).
- Trigger subscription test produces synthetic event logged in Supabase.
- Validator negative-case suite (tone violation, quiet hour breach) halts execution and raises CopilotKit interrupt.

### Evidence to Produce
- `governed_activation_report.csv` (connections, approvals, undo traces, trigger events).
- Approval feed export showing reviewer decisions.
- `status_beacon_C.json` with risk assessment.

### Exit Checklist
- [ ] At least two OAuth toolkits operational with approvals recorded.
- [ ] Trigger lifecycle covered (list/get/create/subscribe/disable) with audit logs.
- [ ] Validator interruptions verified and resolved paths documented.
- [ ] Undo buttons tested and evidence stored.

### Dependencies & Notes
- Coordinate with security for vaulting OAuth secrets; ensure compliance with guardrail policy pack.

---

## Gate G-D — Insight & Library Fabric
**Mission Question:** Can we surface actionable analytics, recommendations, and reusable plays across tenants and personas?

### Build Scope
- **CopilotKit:** Evidence browsing UI with filters (tenant, persona, mission state); recommendation surfaces tied to Supabase endpoints.
- **Gemini ADK:** Library agent curates embeddings, ROI, risk metadata; Planner consumes recommendation API for next-best-job prompts.
- **Composio:** Tag tool usage with metadata for analytics (toolkit, scopes, success score).
- **Supabase:** Dashboards via PostgREST (adoption, ROI, guardrails, latency), hybrid search combining pgvector + keyword, trigger warehouse tables.
- **Governance:** Analytics access control and data retention policy published.

### Acceptance Tests & Instrumentation
- Dashboard QA: p95 latency < target, filters functioning, data accurate vs sample queries.
- Recommendation API integration tests verifying contextual suggestions.
- Trigger warehouse consistency checks (events vs tool calls).

### Evidence to Produce
- `insight_snapshot.parquet` (metrics extract).
- `library_recommendations.json` (top plays, metadata, embeddings hashes).
- Analytics QA recording + `status_beacon_D.json`.

### Exit Checklist
- [ ] Dashboards validated with governance-approved metrics.
- [ ] Recommendation service serving at least 5 curated templates per persona.
- [ ] Trigger warehouse populated and reconciled with live events.

### Dependencies & Notes
- Confirm Supabase Edge Functions for streaming evidence and ROI calculations are deployed.

---

## Gate G-E — Scale Hardening
**Mission Question:** Is the platform ready for broader rollout with enforced security, performance, and enablement guardrails?

### Build Scope
- **Security:** Token rotation, PII redaction pipelines, trigger permission audits, SOC2-oriented controls documented.
- **Performance:** Load testing for Composio tool execution and trigger throughput; Supabase query/embedding latency benchmarks.
- **Enablement:** Publish enablement bundle (case studies, ROI calculator, trigger playbooks) aligned with PRD packaging models.

### Acceptance Tests & Instrumentation
- Load-test reports (success %, error classes, latency percentiles) archived.
- Security checklist sign-off with evidence (logs, policies, runbooks).
- Enablement content review with GTM/cross-functional stakeholders.

### Evidence to Produce
- `trust_review.pdf` (security/compliance summary).
- `load_test_results.json` (latency + capacity data).
- Enablement bundle artifact + `status_beacon_E.json`.

### Exit Checklist
- [ ] Security controls audited and signed.
- [ ] Performance SLAs met or mitigation plan approved.
- [ ] Enablement package distributed to stakeholders.

### Dependencies & Notes
- Coordinate with partner teams (Composio, CopilotKit, ADK, Supabase) for roadmap validation per PRD guidance.

---

## Gate G-F — Stabilised Operations
**Mission Question:** Can we sustain governed operations over multiple reporting windows with incident hygiene and future roadmap clarity?

### Build Scope
- **Operational Metrics:** Collect two reporting cycles of production KPIs (adoption, approvals, guardrail incidents, ROI).
- **Incident Hygiene:** Document incidents, postmortems, escalation handling, trigger failures.
- **Roadmap Alignment:** Compile backlog for next phase based on telemetry and GTM feedback.

### Acceptance Tests & Instrumentation
- KPI exports reconciled with Supabase dashboard data.
- Incident ledger reviewed with governance and runtime teams.
- Next-phase backlog scored and prioritized.

### Evidence to Produce
- `stabilisation_digest.md` (KPIs, incidents, backlog summary).
- `status_beacon_F.json` with final readiness score.

### Exit Checklist
- [ ] Two consecutive reporting windows closed with compliant metrics.
- [ ] All incidents resolved with documented learnings.
- [ ] Next-phase roadmap approved by leadership.

### Dependencies & Notes
- Ensure evidence archives (Supabase storage + `docs/readiness/`) mirror final state.

---

## Operational Cadence & Verification
- **Weekly:** Review Cron health, streaming UX QA status, open risks; update tracker with task progress.
- **Bi-Weekly:** Run `adk eval` regression suites, validate Supabase diffs, confirm Composio tool coverage.
- **Pre-Gate Review:** Freeze feature work, re-run acceptance instrumentation, gather required evidence, update `status_beacon_<letter>.json`.
- **Post-Gate:** Export artifacts to cold storage, refresh analytics baselines, adjust risk register.

## Risk Watchlist & Mitigations
- Credential adoption lag → escalate at Gate C if <50% tenants opt into OAuth; amplify dry-run success stories.
- Reviewer fatigue → monitor approvals per reviewer; design batching/autopilot windows when threshold exceeded.
- Integration drift → quarterly sync with Composio, CopilotKit, ADK, Supabase; update tracker within 48h of each sync.
- Data anomalies → automated QA on embeddings, trigger streams, dashboards; alert on drift or missing data.
- Latency/Throughput spikes → run load tests during each gate promotion rehearsal; enforce p95 <250ms before Gate E.

## Decision Log Template
Maintain a dated list of major decisions (e.g., LLM provider fallback, pricing telemetry granularity, redaction workflow) within this document during reviews. Include context, decision, owner, and follow-up tasks.

## Upcoming Reviews
- **Next checkpoint audit:** October 22, 2025 (target readiness review for Gate G-A → G-B promotion).
- Update this tracker immediately after every checkpoint or major decision; it replaces all prior implementation plans.
