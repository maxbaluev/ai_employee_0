# AI Employee Control Plane: Implementation Guide

**Version:** 3.0 (October 2025)
**Audience:** Frontend, Backend, Agent, and Infra Engineers
**Status:** Authoritative build and extension manual

---

## 1. Orientation

- **Repository Root:** `/` (Next.js 15 app, FastAPI agent, Supabase schema)
- **Primary Workspaces:**
  - `src/app/(control-plane)` — Mission workspace UI (CopilotKit powered)
  - `src/app/api/*` — Next.js API routes (intake, toolkits, missions, evidence)
  - `agent/` — Gemini ADK FastAPI service (Coordinator, Planner, Executor, Validator, Evidence agents)
  - `supabase/` — Single migration (`migrations/0001_init.sql`), seed data, edge functions
  - `docs/readiness/` — Evidence artifacts for major capabilities
- **Toolchain Managed by `mise`:** Node 22.20.0, pnpm 10.18.0, Python 3.13.7, uv 0.9.2

### Setup Checklist

```bash
mise trust
mise install
mise run install       # pnpm install
mise run agent-deps    # uv sync for agent
mise run dev           # Next.js + FastAPI concurrently
```

Optional:

- `mise run ui` (UI-only)
- `mise run agent` (agent-only)
- `pnpm run test:ui`, `mise run test-agent`, `pnpm run lint`

---

## 2. Frontend (Next.js + CopilotKit)

### Architecture Highlights

- **App Router:** `src/app/(control-plane)/layout.tsx` hosts `MissionWorkspaceLayout`
- **State:** `MissionStageProvider` orchestrates five-stage flow with shared context (`DEFINE`, `PREPARE`, `PLAN_APPROVE`, `EXECUTE_OBSERVE`, `REFLECT_IMPROVE`)
- **CopilotKit Hooks:**
  - `useCopilotReadable` exposes mission brief, toolkits, safeguards
  - `useCopilotAction` handles chip acceptance, play selection, undo decisions
  - `copilotkit_emit_message` streams planner/execution updates
- **Styling:** Tailwind v4 + custom tokens (see `src/styles/tokens.ts`)
- **Testing:** Vitest + Testing Library (`pnpm test:ui`), Playwright for e2e

### Key Components

- `MissionIntake` — Define stage generative banner, chip editing controls
- `MissionBriefCard` — Persistent mission truth with edit locking
- `RecommendedToolStrip` — Toolkit recommendations, OAuth badges
- `CoverageMeter` — Prepare stage readiness radial with segment analytics
- `PlannerRail` — Plan & Approve stage streaming plays with rationale and safeguard tags
- `ExecutionPanel` — Execute & Observe stage streaming timeline with pause/cancel
- `EvidenceGallery` — Execute & Observe stage artifact cards, hash badges, export menu
- `UndoBar` — Execute & Observe stage countdown + impact summary + confirm
- `FeedbackDrawer` — Reflect & Improve stage timeline of feedback events with quick reactions

### Implementation Guidelines

- **Streaming:** Server-sent events via `/api/stream/*`; ensure SSE reconnect handlers manage `429` backoffs.
- **State Persistence:** Use `MissionWorkspaceStore` (Zustand) backed by `sessionStorage` to maintain context across reloads; persist current five-stage state for telemetry alignment.
- **Accessibility:** Wrap streaming sections in `aria-live="polite"`; provide keyboard shortcuts for primary actions.
- **Error Handling:** Display inline callouts with retry affordances; log telemetry (`error_surface_viewed`).
- **Storybook:** Add stories under `stories/mission-workspace/*.stories.tsx` with controls and accessibility notes.

---

## 3. Backend Agents (Gemini ADK)

### Service Layout

- `agent/agent.py` — FastAPI bootstrap, load `.env`, route definitions
- `agent/agents/` — Coordinator, Planner, Executor, Validator, Evidence agents
- `agent/services/` — Mission service, Composio client, Supabase client, telemetry
- `agent/tools/` — Tool abstractions, undo plans, scoring utilities
- `agent/evals/` — Evaluation configs (`smoke_foundation.json`, `dry_run_ranking.json`)

### Development Workflow

```bash
mise run agent      # hot reload FastAPI server
mise run test-agent # adk eval smoke + execution ranking
uv run --with-requirements agent/requirements.txt pytest agent/tests
```

### Agent Responsibilities

- **CoordinatorAgent** — Stage orchestration, safeguards enforcement, telemetry fan-out
- **IntakeAgent** — Chip generation, confidence scoring, rationale hints
- **PlannerAgent** — Play generation with hybrid ranking (retrieval + rule-based filters)
- **ExecutorAgent** — Composio tool execution, state tracking, heartbeat updates
- **ValidatorAgent** — Safeguard verification, success heuristics, undo planning
- **EvidenceAgent** — Artifact packaging, hash generation, library updates

### Patterns & Practices

- **Session State:** Persist mission context in Supabase `mission_state` table; agents read/write via transactional API.
- **Telemetry:** Use `TelemetryClient.track(event, payload)` with correlation ids; follow schema in `scripts/audit_telemetry_events.py`.
- **Safeguards:** Generate default hints, allow overrides, mirror edits back to Supabase.
- **Undo Plans:** Required for every mutating action; store in `undo_events` with rollback script reference.
- **Retries:** Exponential backoff for Composio calls; surface failure reason to planner for adaptation.

---

## 4. API Layer (Next.js Routes)

- `/api/intake/generate` — Gemini prompt orchestration and chip normalization
- `/api/toolkits/recommend` — Toolkit scoring (precedent, capability vectors)
- `/api/toolkits/authorize` — Connect Link token issuance and status polling
- `/api/inspect/preview` — Read-only Composio previews for data coverage
- `/api/plan/*` — Planner streaming endpoints (SSE)
- `/api/execution/*` — Execution triggers, heartbeat updates
- `/api/evidence/*` — Artifact retrieval, undo execution, export bundling
- `/api/feedback/*` — Feedback submission, library tagging

### Implementation Notes

- **Auth:** Supabase Auth JWT validated via middleware; internal service-to-service tokens stored in environment.
- **Rate Limiting:** per-account quotas with sliding window implemented via Supabase functions.
- **Error Surface:** Map known error codes to user-friendly messages; include incident id.
- **Testing:** Supertest integration tests under `tests/api/*.test.ts`.

---

## 5. Composio Integration Patterns

- **Discovery:** `/api/toolkits/recommend` surfaces toolkits with metadata (category, success rate, sample plays).
- **Authorization:** Connect Link ensures least-privilege scopes; support manual tokens for enterprise.
- **Execution:** ExecutorAgent issues calls with context-aware payloads; handle `429` and partial data gracefully.
- **Triggers:** Scheduler service registers Composio triggers for governed automation; store trigger configs in `supabase.storage`.
- **Audit Trail:** Log tool call inputs/outputs (redacted) for evidence bundles.

### Partner Integration Architecture

```mermaid
graph LR
  UI[Next.js Workspace]
  CopilotKit[CopilotKit SDK]
  ADK[Gemini ADK Agents]
  Composio[Composio Toolkits]
  Supabase[Supabase Platform]
  Analytics[Analytics & Dashboards]

  UI --> CopilotKit
  CopilotKit --> ADK
  ADK --> Composio
  ADK --> Supabase
  Composio --> Supabase
  Supabase --> Analytics
  Analytics --> UI
```

---

## 6. Supabase Data Layer

- **Schema:** Single migration `supabase/migrations/0001_init.sql`
  - Key tables: `missions`, `mission_metadata`, `toolkits`, `mission_toolkits`, `undo_events`, `artifacts`, `mission_feedback`
  - Views: `mission_activity_feed`, `mission_performance_dashboard`, `governance_incidents`
- **Policies:** RLS ensures persona-specific access (operators vs. governance vs. admins)
- **Edge Functions:** `verify_undo`, `export_evidence`, `trigger_analytics`
- **Cron:** Nightly library embedding refresh, weekly telemetry rollups
- **Types:** Regenerate after schema changes:
  ```bash
  supabase gen types typescript --linked --schema public,storage,graphql_public > supabase/types.ts
  pnpm tsc --noEmit
  ```

---

## 7. Telemetry & Analytics

- **Event Catalog:** 37 canonical events (frontend + backend). Maintain schema in `scripts/audit_telemetry_events.py`.
- **Collection:** `telemetry_client.ts` (frontend) → `/api/telemetry` → Supabase `telemetry_events`
- **Dashboards:** Supabase SQL + Metabase (if connected) for executive, governance, operations views.
- **Redaction:** Use `src/lib/telemetry/redaction.ts` helpers to scrub PII.
- **Audits:** Run `pnpm ts-node scripts/audit_telemetry_events.py --mode check` before releases.

---

## 8. Testing Strategy

- **Frontend:**
  - Unit: `pnpm test:ui`
  - Integration: Playwright `pnpm test:e2e`
  - Accessibility: `pnpm run test:a11y` (axe CLI)
- **Agent:** `mise run test-agent` (ADK evals), `pytest agent/tests`
- **API:** `pnpm test:api`
- **Supabase:** `supabase db reset --seed supabase/seed.sql` for local reproducibility
- **Performance:** `pnpm run test:perf` (Lighthouse + k6 scripts)
- **Observability:** Validate metrics/log traces via staging Grafana dashboards

---

## 9. Operational Readiness

- **Environments:** local → dev → staging → production
- **Deployment:**
  - Next.js: Vercel or custom Docker (production should pin environment variables from `.env.production`)
  - FastAPI: Fly.io or GKE (use `scripts/deploy-agent.sh`)
  - Supabase: Apply migration via CI pipeline, confirm types generation
- **Secrets Management:** `.env` for local, environment-specific vault for production
- **Monitoring:**
  - Metrics: Datadog dashboards (latency, error rates, planner success)
  - Logs: Structured JSON shipped via OTLP
  - Alerts: On-call rotation via PagerDuty, rules for heartbeat misses, undo failures, SLA breaches
- **Runbooks:** Store incident guides in `docs/readiness/runbooks/*.md`

---

## 10. Extension Playbooks

- **Add a New Stage:** Define stage contract, extend `MissionStageProvider`, add telemetry, update UX blueprint.
- **Introduce New Toolkit:** Register metadata in Supabase, implement Composio connector, add recommendation logic, document scopes.
- **Expand Library Learning:** Add embedding retraining script, update planner retrieval pipeline, monitor reuse metrics.
- **Create New Dashboard:** Add Supabase view, update Metabase, document metrics origin, ensure telemetry coverage.

---

## 11. Change Management

- **Proposal Process:** RFC in `docs/rfcs/`, review with Product, UX, Trust, and Engineering leads.
- **Testing Requirements:** No merges without lint, tests, agent evals passing; include evidence artifact references in PR description.
- **Documentation:** Update relevant sections in `docs` alongside code changes.
- **Release Notes:** Publish weekly changelog summarizing mission improvements, toolkit additions, safeguards updates.

---

## 12. Resources

- `docs/01_product_vision.md` — Business context
- `docs/02_system_overview.md` — Architecture reference
- `docs/03_user_experience.md` — UX contracts and telemetry matrix
- `docs/readiness/` — Evidence artifacts and checklists
- `libs_docs/` — Partner SDK quick references (CopilotKit, Composio, ADK, Supabase)
