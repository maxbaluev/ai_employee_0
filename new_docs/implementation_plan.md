# AI Employee Control Plane — Checkpoint Plan

This plan stays checkpoint-focused so every team can see state transitions at a glance. Each checkpoint outputs evidence (where applicable) in `docs/readiness/` and a `status_beacon_<letter>.json` summarising readiness %, risks, and required decisions.

## Checkpoint A — Foundation Baseline (Gate G-A)

- **Goal:** Stand up baseline infrastructure for zero-privilege proofs.
- **Scope:** Supabase migration `0001_init.sql` with pgvector + RLS tests; ADK coordinator/planner health checks green; CopilotKit control-plane shell in staging; Composio catalog sync job with checksum.
- **Evidence:** No standalone artifact required; completion is validated via Supabase checksum logging and CopilotKit smoke test notes.
- **Signal Owners:** Runtime Steward emits `status_beacon_A.json`; Product Orchestrator confirms smoke-test transcript.

## Checkpoint B — Dry-Run Proof Loop (Gate G-B)

- **Goal:** Objective → artifact loop <15 minutes using no-auth toolkits.
- **Scope:** Planner ranking (PRD + Composio `tools.get(search=...)` + Supabase embeddings); executor agents produce outreach/research/scheduling drafts; CopilotKit renders review UI with annotations.
- **Evidence:** `dry_run_verification.md` (latency, artifact samples, planner telemetry).
- **Signal Owners:** Runtime Steward + Governance Sentinel publish and SLA alerts.

## Checkpoint C — Governed Activation Core (Gate G-C)

- **Goal:** Upgrade to OAuth-backed execution with approvals, undo, and trigger integrations.
- **Scope:**
  - Quickstart handshake embedded (`toolkits.authorize()` → `wait_for_connection()` → `tools.get()` → `provider.handle_tool_calls()` / `tools.execute()`).
  - Semantic discovery helpers wrap `tools.get(search=...)` and `tools.get_raw_composio_tools(...)` for planners/upstream LLMs.
  - Validator enforces tone, rate, quiet hours; undo pipeline live in UI.
  - **Triggers:** Implement trigger lifecycle helpers (list/get type/create/subscribe/disable) using Composio `triggers.create`, `triggers.subscribe`, and type-safe payloads.
- **Evidence:** `governed_activation_report.csv` (connection logs, approvals, undo traces, trigger events).
- **Signals:** `status_beacon_C.json`, CopilotKit approval feed, trigger health alerts.

## Checkpoint D — Insight & Library Fabric (Gate G-D)

- **Goal:** Turn mission telemetry into recommendations and reusable plays.
- **Scope:** Analytics dashboards (PostgREST + Supabase), library API with embeddings, “next best job” endpoint, trigger event warehouse tables for trend analysis.
- **Evidence:** `insight_snapshot.parquet`, `library_recommendations.json`.
- **Signals:** `status_beacon_D.json`, analytics QA alerts, trigger activity heatmaps.

## Checkpoint E — Scale Hardening (Gate G-E)

- **Goal:** Certify security, performance, and enablement for GA.
- **Scope:** Security checklist (token rotation, PII redaction, trigger permission audits), load tests for Composio + triggers throughput, enablement bundle (case studies, ROI calculator, trigger playbooks).
- **Evidence:** `trust_review.pdf`, `load_test_results.json`, enablement bundle artifact.
- **Signals:** `status_beacon_E.json`, performance dashboards, enablement readiness score.

## Checkpoint F — Stabilised Operations (Gate G-F)

- **Goal:** Demonstrate sustained governed operations with incident hygiene.
- **Scope:** Two reporting windows of production metrics; incident retrospectives logged; trigger incident escalations analyzed; next-phase backlog agreed.
- **Evidence:** `stabilisation_digest.md` (KPIs, incident ledger, backlog summary).
- **Signals:** `status_beacon_F.json`, Supabase KPI snapshot, GTM sentiment digest.

## Cross-Stream Owners

- **Orchestration Runtime:** Runtime Steward (ADK services, Composio SDK wrappers, trigger utilities).
- **Frontend & Copilot UX:** CopilotKit squad (mission intake, approvals, trigger notifications UI).
- **Data & Analytics:** Data engineer (migrations, embeddings, trigger event tables, dashboards).
- **Governance:** Governance Sentinel (guardrails, reviewer SOPs, trigger approval policy).
- **GTM Enablement:** Enablement lead (playbooks, ROI stories, trigger-driven packaged plays).

## Signals & Cadence

- `status_beacon_<letter>.json` after each checkpoint.
- Governance digest every two checkpoints or on high-severity risk.
- Customer narrative updates from GTM Enablement post-pilot.
- Continuous telemetry dashboards (Supabase, CopilotKit, trigger metrics) with automated alerts.

## Risk Watchlist

- Credential adoption lag (monitor at C, trigger escalation if <50% conversion).
- Approval fatigue (>6 per reviewer/day triggers batching).
- Integration drift (quarterly sync with Composio, CopilotKit, ADK, Supabase teams, incl. trigger catalog updates).
- Data quality anomalies (weekly QA, automated alerts).
- Throughput guardrails (Composio + trigger events p95 <250ms before Checkpoint E).

## References

- PRD, Architecture, Guardrail Policy Pack, Readiness Artifact Schemas, Reviewer SOP, Compliance Checklist.
- Tool access checklist (Composio API keys, Supabase service role, CopilotKit secrets, ADK credentials).
- Glossary: dry-run proof, governed activation, trigger event, evidence pack, guardrail incident, undo sequence, library entry.
