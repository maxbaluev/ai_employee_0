# AI Employee Control Plane — Technical Architecture

## 0. Repository Baseline (October 2025)
- **Frontend:** Next.js 15 application under `src/app`, currently exposing a CopilotKit-powered UI (`src/app/page.tsx`) with supporting assets in `public/` and styles in `src/app/globals.css`.
- **Agent Service:** Python ADK FastAPI service in `agent/agent.py`, launched via `scripts/run-agent.sh`, providing the initial LLM agent endpoint.
- **Documentation Inputs:** Partner summaries in `libs_docs/`, new control-plane docs in `new_docs/`, and starter README instructions in `README.md`.
- **Tooling:** Node scripts defined in `package.json`, Python deps declared in `agent/requirements.txt`, shell helpers in `scripts/`.

This architecture builds on the baseline and introduces the control-plane layers, data services, and governance assets required for the AI Employee roadmap.

## 1. Executive Architecture Summary
- **Mission Alignment:** Operationalize the PRD vision (October 7, 2025) of an objective-first, evidence-backed AI employee that progresses from zero-privilege proofs to governed automations.
- **Core Tenets:** Zero-trust progression, human-in-the-loop by default, composable plays, measurable ROI, reversible execution.
- **Partner Stack:** Composio for Model Context Protocol (MCP) tool breadth and OAuth management, CopilotKit CoAgents for collaborative UX, Google Gemini ADK for orchestrating multi-agent workflows, and Supabase for state, evidence, analytics, and vectorized play retrieval.
- **Outcome:** A control plane that lets accounts move from mission intake to verified outcomes in under 15 minutes, while preserving auditability, guardrails, and expansion hooks.

## 2. Architectural Principles
- **Zero-Privilege First:** Every objective begins in dry-run mode using Composio `no_auth` toolkits to earn trust before credentials are shared.
- **Governed Autonomy:** Any mutating action requires explicit approval and undo plans; quiet hours, rate caps, tone policies, and rollback cues are enforced by default.
- **Evidence-Centric:** Each play outputs artifacts, telemetry, and ROI deltas stored in Supabase for stakeholders and analytics.
- **Composable Agent Mesh:** ADK multi-agent hierarchies allow specialized planners, executors, validators, and evidence bots to cooperate while remaining debuggable.
- **Human-In-The-Loop UX:** CopilotKit CoAgents provide shared state, generative UI, and interruption points for reviewers to steer or block execution.
- **Observability & Learning:** Tool calls, approvals, and outcomes feed a play library with vector search for rapid reuse and franchising across tenants.

## 3. System Architecture Overview

### 3.1 Layered View
1. **Presentation Layer:** Existing Next.js frontend (`src/app`) expanded with CopilotKit chat, generative previews, and approval modals.
2. **Control Plane Layer:** New TypeScript modules under `src/app/(control-plane)` (or equivalent) for mission intake, capability grounding, play ranking, and mission briefs.
3. **Orchestration Layer:** ADK coordinator service evolved from `agent/agent.py`, potentially split into submodules under `agent/` to host planner, executor, validator, and evidence agents.
4. **Execution Layer:** Composio MCP servers orchestrated via Python SDK calls inside the agent service (e.g., `agent/tools/`), with retry/backoff helpers.
5. **Governance Layer:** Guardrail enforcement logic and approval queues persisted via Supabase (server components or API routes under `src/app/api/guardrails/`).
6. **Evidence & Analytics Layer:** Supabase Postgres + pgvector with migrations tracked in a new `supabase/migrations/` directory, served through PostgREST and surfaced in frontend dashboards.

### 3.2 Runtime Modes
- **Dry-Run Proof (Zero-Privilege):**
  - Inputs: Objective brief, guardrails.
  - Behavior: Planner selects `no_auth` toolkits (e.g., Slack drafts, Google Sheets sandbox) to produce drafts, lists, schedules.
  - Outputs: Evidence pack (mission brief, artifacts, risk/undo narratives) stored in Supabase, surfaced in CopilotKit for review.
- **Governed Activation (Connected):**
  - Prerequisites: OAuth connections via Composio AgentAuth; Supabase token vault.
  - Behavior: Executors call live toolkits after approvals; Validator enforces tone, rate caps, quiet hours; Evidence agent logs actions and undo scripts.
  - Outputs: Executed play telemetry, ROI deltas, compliance trail, and library updates.

## 4. Subsystem Detail

### 4.1 Objective & Planning Subsystem
- **Mission Intake:** CopilotKit chat collects goal, audience, timeframe, guardrails; normalized into Supabase `objectives`.
- **Capability Grounding:** Planner agent queries cached Composio catalog (`list_toolkits`, `list_tools`) filtered by industry tags, auth type, and known scopes.
- **Play Discovery:** Combines PRD playpacks with Composio cookbook recipes (CRM, finance, analytics, Trello MCP server, etc.) and historical successes stored as vectors in Supabase.
- **Proposal Generation:** ADK planner crafts Top 3 plays with Why, Impact, Risk, Proof, Undo narratives aligned to PRD expectations; outputs to `plays` table.
- **User Edits:** CopilotKit shared state lets reviewers adjust parameters (audience segment, quiet hours) before committing.

### 4.2 Orchestration & Execution Subsystem
- **Agent Hierarchy (ADK):**
  - `CoordinatorAgent`: Routes objectives to specialist trees (Outreach, Support, Finance, Research).
  - `PlannerAgent`: Decomposes plays into tasks, selects Composio tool invocations.
  - `ExecutorAgents`: Domain-specific CoAgents (e.g., CRM reactivation, billing nudges, research syntheses) with contextual prompts.
  - `ValidatorAgent`: Performs tone checks, ROI sanity, compliance gating before destructive actions.
  - `EvidenceAgent`: Captures outputs, metrics, and rollback context.
- **Workflow Patterns:** Sequential agents for draft→critique→revise, Loop agents for iterative enrichment, conditional branches for guardrail triggers.
- **Tool Invocation:** Integrate Composio Python SDK from executor agents; enforce retry with exponential backoff, rate hints, and latency metrics.
- **Fallback Handling:** Map provider errors (invalid_scope, quota exceeded) to actionable CopilotKit prompts.

### 4.3 Governance & Safety Subsystem
- **Pre-Flight Checks:** Confirm OAuth tokens, guardrail schema, allowed send windows, and reviewer availability before moving to governed mode.
- **Approval Workflow:** CopilotKit interruption nodes surface action summaries with risk and undo steps; reviewers approve, reject, or edit.
- **Run-Time Guardrails:** Rate caps per tenant/provider stored in Supabase; quiet hours enforced via scheduler; PII redaction pipeline for prompts/logs.
- **Undo & Rollback:** Each successful tool call writes inverse instructions; CopilotKit UI exposes instant undo buttons with context.

### 4.4 Evidence, Analytics & Library Subsystem
- **Schema (Supabase Postgres):**
  - `objectives(id, tenant_id, goal, audience, timeframe, guardrails, status, created_at)`
  - `plays(id, objective_id, mode, plan_json, impact_estimate, risk_profile, undo_plan, created_at)`
  - `tool_calls(id, play_id, provider, toolkit, tool_name, args_hash, result_ref, latency_ms, cost_cents, quiet_hour_override, created_at)`
  - `approvals(id, tool_call_id, reviewer_id, decision, rationale, decision_at)`
  - `artifacts(id, play_id, type, title, content_ref, reviewer_edits, stored_at)`
  - `oauth_tokens(id, tenant_id, provider, scopes, encrypted_token, refreshed_at, revoked_at)`
  - `library_entries(id, tenant_id, embedding vector(1536), metadata_json, success_score, reuse_count)`
- **Vector Search:** pgvector enables semantic retrieval of play templates and external content for planners; embeddings generated via Supabase Edge Functions.
- **Analytics:** PostgREST exposes metrics for dashboards (weekly approved jobs, dry-run-to-connected conversion, guardrail incidents, latency p95).
- **Case Study Anchors:** Evidence hub references Composio examples (Assista AI 90% GTM reduction, Fabrile Google integration) and Supabase customer stories to reinforce trust.

### 4.5 Library & Learning
- Successful plays saved as parametrized templates with embeddings for quick cloning.
- Ranking blends reuse frequency, reviewer NPS, measured ROI, and risk incidents.
- Agencies can opt-in to share templates across tenants, enabling franchising while maintaining tenant isolation through Supabase Row Level Security (RLS).

## 5. Data Flows

### 5.1 Dry-Run Proof Sequence
1. User enters objective via CopilotKit chat.
2. Planner agent normalizes data, stores `objective` row.
3. Capability discovery pulls Composio `no_auth` toolkits (e.g., Slack draft, Trello sandbox) and library plays via vector similarity.
4. Planner generates play candidates; writes to `plays` with mode `dry_run`.
5. Executor agents generate artifacts (draft emails, schedules, briefs) without sending; Evidence agent persists artifacts and metrics in Supabase.
6. CopilotKit renders generative UI preview; reviewers iterate before opting into activation.

### 5.2 Governed Activation Sequence
1. Reviewer selects play for activation; system verifies OAuth tokens and guardrail readiness.
2. Validator agent checks tone, compliance, quota; CopilotKit surfaces approval summary.
3. Upon approval, executor calls Composio OAuth toolkit; result captured by Evidence agent alongside undo plan.
4. Supabase logs tool call, approval decision, ROI metrics (e.g., reactivated accounts, time saved).
5. Dashboard updates via Supabase realtime; CopilotKit notifies stakeholders with evidence pack.

### 5.3 Approval & Undo Loop
1. Guardrail condition encountered (quiet hour, budget cap) → Validator raises `interrupt` event.
2. CopilotKit modal presents options (reschedule, request override, cancel).
3. Reviewer decision updates Supabase `approvals`; ADK resumes with modified parameters or rollback.
4. Undo request triggers Evidence agent to execute stored inverse sequence through Composio or human handoff instructions.

## 6. Security, Privacy & Compliance
- **Zero-Privilege Baseline:** Credentials never exposed during dry runs; Composio AgentAuth gates OAuth flows with least-privilege scopes.
- **Token Management:** Supabase stores encrypted tokens; access mediated by Edge Functions; refresh cadence logged for audit.
- **Row Level Security:** Enforced across all Supabase tables, ensuring tenant isolation for objectives, plays, tool calls, and library entries.
- **PII Handling:** Replace explicit PII with resource IDs in prompts; Composio args sanitized before logging; Supabase functions perform redaction.
- **Audit Trail:** Immutable logs (tool_calls, approvals) retained 90 days hot, archived to cold storage for two years; PostgREST enables export for audits.
- **Compliance Targets:** SOC 2 readiness (access controls, logging), GDPR (export/delete endpoints), provider ToS adherence (rate limits, data locality, no scraping).

## 7. Deployment Architecture
- **Frontend:** Next.js app deployed on Vercel (or similar) with CopilotKit provider; integrates PostgREST endpoints and Supabase client for secure data access.
- **Agent Backend:** Python ADK project with LangGraph runtime; preferred managed deployment on LangGraph Platform for observability, fallback to containerized FastAPI on Cloud Run.
- **Supabase:** Managed Postgres with pgvector extension, Row Level Security, Edge Functions for OAuth callbacks, and Realtime channels for approvals and dashboards.
- **Composio Runtime:** SDK within agent backend; periodic catalog sync job caches toolkit metadata in Supabase; execution uses governed MCP servers.
- **Observability:** Use ADK logging, Supabase metrics, and CopilotKit session traces; aggregate into centralized monitoring.

## 8. Integration Patterns

### 8.1 Composio MCP
- **Discovery:** Nightly job refreshes toolkit metadata (tags, auth requirements) referencing cookbook categories (CRM, analytics, finance, Trello).
- **Authentication:** Composio AgentAuth handles OAuth; Supabase Edge Functions store tokens; UI highlights scope lists and connection health.
- **Execution:** Executors call `composio.invoke` with structured args; backoff strategies respect provider rate hints; results linked to artifacts.
- **Use-Case Surfacing:** UI references Assista AI, Fabrile, and AgentArena case studies to illustrate value and trust.

### 8.2 CopilotKit CoAgents
- **Shared State:** LangGraph agents expose context to front end, enabling collaborative editing of mission briefs and artifact drafts.
- **Human Checkpoints:** `interrupt()` nodes trigger approval modals for sends, charges, or code changes.
- **Generative UI:** Real-time previews of drafts, dashboards, and undo plans; integrates CopilotKit chat, Agentic Chat UI, and frontend actions.

### 8.3 Gemini ADK (with LangGraph)
- **Agent Composition:** Coordinator, Planner, Executor, Validator, Evidence agents defined via ADK; orchestrated with LangGraph for branching and loop control.
- **Testing & Evaluation:** ADK eval tooling ensures deterministic dry-run outputs before enabling governed mode.
- **Deployment:** CI/CD packages ADK project to LangGraph Platform or Cloud Run; environment variables include `COMPOSIO_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` (if used for prompting).

### 8.4 Supabase Platform
- **Data Plane:** Postgres schema with RLS, vector storage, and PostgREST APIs; integrates seamlessly with Next.js via service role on server and anon keys on client.
- **Edge Functions:** Handle OAuth callbacks, webhook ingestion, and embedding generation; rely on Supabase's open source toolkit for AI workflows.
- **Analytics & Search:** Use Supabase vector columns for semantic search, hybrid search for metadata filters, and REST endpoints for dashboards.

## 9. Capability Progression Ladder

Agents advance through the following capability states. Each state must satisfy all exit criteria before promotion. No calendar assumptions are required; promotions occur as soon as predicates are met.

### State A — Foundation Ready
- Supabase project provisioned with schema, RLS, and pgvector enabled.
- ADK coordinator and planner agents reachable through LangGraph runtime.
- CopilotKit shell exposes mission intake, shared state, and artifact preview surfaces.
- Composio catalog sync job caches `no_auth` discovery data for planners.

### State B — Dry-Run Proof Ready
- Planner ranks plays using PRD recipes plus Composio cookbook metadata.
- Domain executor agents generate outreach drafts, research syntheses, and scheduling proposals.
- Evidence agent persists artifacts and metrics in Supabase; CopilotKit renders previews for reviewers.
- Dry-run validation check confirms objective-to-evidence cycle completes within 15 minutes in simulation.

### State C — Governed Activation Ready
- Composio AgentAuth OAuth flow operational for at least two production toolkits.
- Validator agent enforces tone, rate, quiet hours, and guardrail policies; violations raise CopilotKit interrupts.
- Undo mechanics create inverse instructions for each mutating call and surface undo shortcuts in UI.
- Telemetry for latency, error classes, and ROI estimates streams into Supabase analytics tables.

### State D — Insight & Library Ready
- Dashboards expose adoption, ROI, guardrail incidents, and approval throughput via PostgREST endpoints.
- Play library persists embeddings, ranking metadata, and template cloning controls.
- Recommendation service surfaces “next best job” suggestions conditioned on tenant context.
- Supabase AI templates (semantic + hybrid search) wired into evidence browsing.

### State E — Scale & Trust Ready
- Security review checklist passes (token rotation, PII redaction, audit exports, privilege boundaries).
- Load tests verify Composio invocation throughput and Supabase query latency within guardrails.
- Compliance documentation and customer-facing guides published; case study spotlights embedded in UI onboarding.
- Observability alerts and incident runbooks validated through tabletop simulation.

## 10. Risks & Mitigations
- **Credential Hesitancy:** Maintain polished dry-run artifacts and highlight Composio case studies to demonstrate value pre-credentials.
- **Tool Overload:** Curate recommended toolkits per persona; use CopilotKit suggestions and Supabase vector ranks to surface relevant plays.
- **Governance Drift:** Enforce approvals, audit logs, and regular guardrail testing; provide dashboards for governance officers.
- **Partner Dependency:** Schedule quarterly roadmap syncs with Composio, CopilotKit, ADK, and Supabase teams; maintain abstraction layers in orchestration code.
- **Scalability Spikes:** Use Supabase's scalable PostgREST, Supabase Edge caching, and ADK autoscaling on LangGraph Platform or Cloud Run autoscaling configurations.

## 11. Appendix — Key References
- **Business PRD:** `new_docs/prd.md`
- **Composio Resources:** `libs_docs/composio/llms.txt` — case studies (Assista AI, Fabrile), cookbook categories (CRM, analytics, finance, Trello MCP).
- **CopilotKit CoAgents:** `libs_docs/copilotkit/llms-full.txt` — standard vs CoAgents, human-in-the-loop patterns, LangGraph integration.
- **Gemini ADK:** `libs_docs/adk/llms-full.txt` — multi-agent composition, deployment patterns, evaluation tooling.
- **Supabase AI Toolkit:** `libs_docs/supabase/llms_docs.txt` — pgvector, Edge Functions, PostgREST, AI templates and integrations.
- **Readiness Artifacts:** `new_docs/readiness_artifact_schemas.md` — machine-readable evidence packages for gate progression (store output locally under `docs/readiness/` and in Supabase storage).
- **Guardrail Policies:** `new_docs/guardrail_policy_pack.md` — enforcement parameters for tone, rate, quiet hours, and undo guarantees (implemented across `agent/` validators and `src/app` approval flows).

This architecture grounds the AI Employee Control Plane in the documented partner capabilities, delivering an accountable, extensible system that converts objectives into governed outcomes with a clear path from private preview to scaled adoption.
