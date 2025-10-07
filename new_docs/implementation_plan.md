# AI Employee Control Plane — Implementation Plan

## 1. Plan Overview

- **Plan Version:** 2025-10-07 (aligned with the latest PRD and architecture revisions).
- **Execution Scope:** Realise the AI Employee Control Plane by progressing through the capability states defined in `new_docs/architecture.md` Section 9.
- **Operating Mode:** Autonomous or semi-autonomous agents traverse gated states; human stakeholders only intervene at approval checkpoints or risk escalations.
- **Functional Owners (for accountability routing):**
  - Product Orchestrator Agent (represents business context and prioritisation).
  - Engineering Swarm (orchestration, frontend, data) coordinated by the Runtime Steward Agent.
  - Governance Sentinel (policies, compliance, approval logic).
  - GTM Enablement Agent (customer narratives, ROI packaging).

## 2. Objectives & Key Results

- **Objective 1:** Achieve Gate G-B (Dry-Run Proof Ready) with objective-to-evidence cycles under 15 minutes.
  - _KR1.1:_ ≥3 anchor customers complete successful dry-run missions.
  - _KR1.2:_ ≥80% of dry-run artifacts are approved without manual rework.
- **Objective 2:** Achieve Gate G-C (Governed Activation Ready) with OAuth-backed executions and mandatory approvals.
  - _KR2.1:_ Support at least two authenticated toolkits (CRM + calendar) per tenant.
  - _KR2.2:_ 100% of mutating actions route through CopilotKit approval gates.
- **Objective 3:** Achieve Gate G-E (Scale & Trust Ready) with analytics, library reuse, and hardening in place.
  - _KR3.1:_ Launch dashboards for adoption, ROI, guardrail compliance.
  - _KR3.2:_ Achieve ≥60% conversion from dry-run to connected plays among pilot tenants.

## 3. Milestone Gates (State Machine View)

| Gate ID | Target Architecture State | Triggering Conditions | Evidence Payload |
| ------- | ------------------------- | --------------------- | ---------------- |
| **G-A** | State A — Foundation Ready | All foundational tasks complete (Section 4.1/4.2 minimal viable endpoints live); Composio catalog cache validated; Supabase schema migration applied with RLS enforced. | `foundation_readiness.json` with migration hashes, catalog checksum, CopilotKit smoke test transcript. |
| **G-B** | State B — Dry-Run Proof Ready | Successful dry-run simulation with synthetic anchor tenant; evidence artifacts persisted and rendered; objective-to-evidence SLA < 15 minutes. | `dry_run_verification.md` summarising planner rankings, executor outputs, evidence agent log excerpts. |
| **G-C** | State C — Governed Activation Ready | OAuth loop exercised for at least two toolkits; validator interrupts observed; undo routines replayed without error. | `governed_activation_report.csv` with action IDs, approvals, undo traces. |
| **G-D** | State D — Insight & Library Ready | Dashboards return non-empty metrics; library returns ranked recommendations; embeddings present in Supabase. | `insight_snapshot.parquet` (metrics) + `library_recommendations.json`. |
| **G-E** | State E — Scale & Trust Ready | Security checklist ≥ 90% pass, load/regression tests satisfied, enablement content packaged. | `trust_review.pdf` + `load_test_results.json` + link to enablement bundle. |
| **G-F** | Stabilised Operations | Post-launch monitoring within guardrails for two consecutive reporting windows; incident queue empty or resolved. | `stabilisation_digest.md` containing KPI rollups, incident ledger, backlog summary. |

## 4. Workstreams & Deliverables

### 4.1 Orchestration & Runtime (Engineering)

- **Tasks:**
  - Extend the existing FastAPI service in `agent/agent.py` into a package structure (`agent/agents/`, `agent/tools/`, `agent/runners/`) hosting coordinator, planner, executor, validator, and evidence agents.
  - Integrate ADK runtime hooks, add observability instrumentation, and configure evaluation harness scripts under `agent/tests/`.
  - Implement a Composio SDK wrapper module (`agent/tools/composio_client.py`) with retry/backoff and structured logging.
- **Owners:** AI Platform Lead, Orchestration Engineers.
- **Deliverables:** Updated `agent/` service package, agent evaluation reports, Composio integration tests.
- **Dependencies:** Composio SDK access, Supabase credentials, architecture guardrail definitions.

### 4.2 Frontend & Copilot Experience (Engineering)

- **Tasks:**
  - Introduce a control-plane workspace under `src/app/(control-plane)/` with CopilotKit chat intake, mission brief editor, and generative artifact previews.
  - Implement approval modals tied to ADK `interrupt()` events via API routes in `src/app/api/approvals/` and shared components in `src/app/(components)/`.
  - Surface case-study anchors and capability suggestions sourced from `libs_docs/` data (via static imports or Supabase queries).
- **Owners:** Frontend Lead, CopilotKit specialist.
- **Deliverables:** Next.js application updates, CopilotKit configuration, UX review sign-off.
- **Dependencies:** Orchestration API endpoints, product copy, design assets.

### 4.3 Data, Evidence & Analytics (Data Engineering)

- **Tasks:**
  - Create a `supabase/` directory containing migrations (`supabase/migrations/0001_init.sql`) for objectives, plays, tool_calls, approvals, artifacts, oauth_tokens, library_entries with RLS and indexes.
  - Implement Supabase Edge Functions under `supabase/functions/` for OAuth callbacks, embedding generation, and audit exports.
  - Build analytics API routes (`src/app/api/analytics/`) and frontend dashboards that consume PostgREST endpoints.
- **Owners:** Data Lead, Analytics Engineer.
- **Deliverables:** Supabase migrations, Edge Function repo, analytics dashboards.
- **Dependencies:** Architecture schema approval, access keys, vector model selection.

### 4.4 Governance & Compliance (Ops)

- **Tasks:**
  - Translate the guardrail policy pack into executable validators (`agent/guardrails/`) and approval workflows stored in Supabase.
  - Draft reviewer SOPs (`docs/reviewer_sop.md`) covering approvals, undo, and incident response.
  - Coordinate SOC2/GDPR control mapping and audit log retention policies, documenting results in `docs/compliance_checklist.md`.
- **Owners:** Governance Officer, Compliance Analyst.
- **Deliverables:** Guardrail policy pack, reviewer playbook, compliance checklist.
- **Dependencies:** Engineering instrumentation, legal review, tool provider ToS confirmations.

### 4.5 GTM & Enablement (Product, Sales, CS)

- **Tasks:**
  - Recruit and manage three anchor customers for preview cohorts; store playbooks in `docs/enablement/`.
  - Produce evidence storytelling templates and ROI calculator sourcing Supabase metrics via exported Parquet files.
  - Prepare buyer enablement materials and embed them into the Next.js marketing surfaces (e.g., `src/app/(marketing)/` pages).
- **Owners:** Enablement Lead, Product Marketing, Customer Success.
- **Deliverables:** Preview onboarding scripts, ROI dashboards for customers, GA collateral.
- **Dependencies:** Dry-run artifacts, analytics data, governance approvals.

## 5. Task Bundles & Dependencies

Each bundle produces an artifact pack that advances a milestone gate. Bundles may execute in parallel when dependencies allow.

### Bundle A — Foundation Setup (unlocks Gate G-A)
- **Preconditions:** Cloud accounts provisioned, access keys distributed to agents.
- **Steps:**
  1. Apply Supabase migration `supabase/migrations/0001_init.sql`, enable pgvector, verify RLS policies with automated tests.
  2. Refactor `agent/agent.py` into package modules for coordinator and planner agents; confirm LangGraph endpoints respond to health checks.
  3. Deploy the extended CopilotKit shell (mission intake, shared state preview) to the staging environment (`src/app/(control-plane)/`); capture smoke-test transcript.
  4. Execute Composio catalog sync job from `agent/tools/composio_client.py`; compute checksum of toolkit metadata cache and persist in `foundation_readiness.json`.

### Bundle B — Dry-Run Proof System (depends on Bundle A, unlocks Gate G-B)
- **Steps:**
  1. Implement planner ranking logic combining PRD playpacks, Composio cookbook tags, and Supabase vector similarity scores (backend module `agent/planner/ranking.py`).
  2. Build executor agents for outreach drafts, research syntheses, scheduling proposals; attach telemetry hooks (logging to Supabase via `src/app/api/telemetry/`).
  3. Persist evidence artifacts and metrics in Supabase; ensure CopilotKit renders previews with reviewer annotations enabled in `src/app/(control-plane)/evidence-panel.tsx`.
  4. Run synthetic dry-run simulation; measure objective-to-evidence latency; store results in `dry_run_verification.md` under `docs/readiness/`.

### Bundle C — Governed Activation Core (depends on Bundle B, unlocks Gate G-C)
- **Steps:**
  1. Implement Composio AgentAuth OAuth flow for target toolkits; add Supabase Edge Function callback at `supabase/functions/oauth/index.ts` for token storage.
  2. Extend validator agent (`agent/guardrails/validator.py`) with tone, rate, quiet-hour policies plus interrupt dispatch to CopilotKit.
  3. Deliver undo execution pipeline (inverse instructions + UI surfacing) and log retention routines (UI hooks in `src/app/(control-plane)/undo-bar.tsx`).
  4. Conduct governed activation pilot scenario; export approval metrics to `docs/readiness/governed_activation_report.csv`.

### Bundle D — Insight & Library Fabric (depends on Bundle C, unlocks Gate G-D)
- **Steps:**
  1. Launch analytics dashboards in `src/app/(analytics)/dashboards/` using PostgREST queries; validate metric accuracy via sampling harness.
  2. Stand up play library repository at `src/app/api/library/` with embedding generation Edge Function (`supabase/functions/embeddings/index.ts`) and ranking heuristics.
  3. Ship “next best job” recommendation endpoint (`src/app/api/recommendations/route.ts`) and integrate into CopilotKit suggestions panel.
  4. Persist outputs (`docs/readiness/insight_snapshot.parquet`, `docs/readiness/library_recommendations.json`).

### Bundle E — Scale Hardening (depends on Bundle D, unlocks Gate G-E)
- **Steps:**
  1. Run security checklist (token rotation evidence, PII redaction tests, audit export) and capture findings in `docs/trust/trust_review_notes.md`.
  2. Load test Composio invocations (`scripts/loadtest_composio.py`) and Supabase queries; compare against performance guardrails.
  3. Produce enablement collateral package (case studies, onboarding scripts, ROI calculator) stored in `docs/enablement/enablement_bundle/`.
  4. Generate `docs/readiness/trust_review.pdf` summarising readiness with companion `docs/readiness/load_test_results.json` and `docs/enablement/enablement_bundle.zip`.

### Bundle F — Stabilised Operations (depends on Bundle E, unlocks Gate G-F)
- **Steps:**
  1. Monitor production KPIs for two consecutive reporting windows; log deviations via Supabase dashboard snapshots.
  2. Address governance feedback, incident retrospectives, and backlog triage for future enhancements tracked in `docs/roadmap/backlog.md`.
  3. Produce `docs/readiness/stabilisation_digest.md` with KPI rollups, incident ledger, recommended backlog priorities.

## 6. Dependencies & Integrations

- **External APIs:** Composio MCP servers (CRM, Calendar, Support), Supabase services, ADK Platform, OAuth providers (Google Workspace, HubSpot, Slack, Stripe as needed).
- **Internal Inputs:** Guardrail policy definitions, GTM narratives, brand tone guide, legal compliance requirements.
- **Tooling:** GitHub Actions CI/CD, automated lint/tests (only for touched files), Supabase CLI, Composio SDK, CopilotKit SDK, ADK evaluation scripts.
- **Data Privacy:** Secure storage of OAuth tokens (Supabase KMS), compliance with provider ToS and GDPR deletion/export processes.

## 7. Resource Allocation

- **Engineering:** 2 backend (ADK/Composio), 2 frontend (CopilotKit/Next.js), 1 data engineer, shared DevOps support.
- **Product & Design:** 1 product manager, 1 product designer/human-in-loop UX specialist.
- **Governance & Ops:** 1 governance officer, 0.5 legal counsel, 1 enablement lead, 1 customer success manager.
- **Budget Considerations:** Composio enterprise plan, ADK Platform key, Supabase Pro tier, LLM inference costs (Anthropic Claude or Gemini), design tooling.

## 8. Acceptance Gates & Deliverables

- **Gate G-A:** Evidence bundle `docs/readiness/foundation_readiness.json` approved by Runtime Steward and Governance Sentinel.
- **Gate G-B:** Dry-run verification report (`docs/readiness/dry_run_verification.md`) accepted; KR1.1 auto-updated; backlog labelled with post-dry-run deltas.
- **Gate G-C:** Governed activation report (`docs/readiness/governed_activation_report.csv`) confirms 100% approval coverage; undo simulation signed-off; security checklist progress ≥ 0.9.
- **Gate G-D:** Analytics snapshot and library recommendations (`docs/readiness/insight_snapshot.parquet`, `docs/readiness/library_recommendations.json`) validated by Data Lead agent; GTM enablement references integrated.
- **Gate G-E:** Trust review pack (`docs/readiness/trust_review.pdf` + companions) acknowledged by compliance reviewers; performance guardrails met; enablement collateral ready for distribution.
- **Gate G-F:** Stabilisation digest (`docs/readiness/stabilisation_digest.md`) shows KPIs within thresholds and incident queue cleared or assigned; roadmap seeds captured in backlog.

## 9. Communication Cadence (Agent Signals)

- **Status Beacons:** After each bundle completes, emit `status_beacon.json` containing gate readiness, risk deltas, and outstanding decisions.
- **Steering Digest:** Governance Sentinel aggregates risks every two bundles (or when severity ≥ high) into `governance_digest.md` for sponsor review; no fixed calendar required.
- **Customer Feedback Loop:** GTM Enablement Agent ingests pilot transcripts asynchronously and feeds sentiment summaries into the play library metadata.
- **Continuous Log Sync:** Runtime Steward publishes streaming telemetry (KR progress, error rates, approvals) to the shared Supabase dashboard; alerts trigger automatically when thresholds breach.

## 10. Risk Tracking

- **Credential Adoption Delays:** Mitigated by high-quality dry-run artifacts and in-product case studies; escalate to Enablement if conversion <50% when evaluating Gate G-C readiness.
- **Approval Fatigue:** Monitor approval counts per reviewer; introduce batching or delegation if >6 approvals/day sustained.
- **Integration Drift:** Schedule partner syncs (Composio, CopilotKit, ADK, Supabase) every four weeks; maintain abstraction layers in orchestration codebase.
- **Data Quality Issues:** Establish weekly analytics QA checklist; enable alerting for Supabase data anomalies.
- **Throughput Bottlenecks:** Performance test Composio calls (>50/min) and Supabase query response (<250 ms p95) before GA gate.

## 11. Appendices

- **A. Reference Documents:** PRD, Architecture, Guardrail Policy Pack, Readiness Artifact Schemas, Reviewer SOP, Compliance Checklist.
- **B. Tool Access Checklist:** Composio API keys, Supabase service role, CopilotKit public & secret keys, ADK project credentials.
- **C. Definitions:** Dry-run proof, governed activation, evidence pack, guardrail incident, undo sequence, library entry.

This implementation plan sequences the work required to deliver the AI Employee Control Plane from concept to governed launch, aligning cross-functional teams, timelines, and measurable outcomes.
