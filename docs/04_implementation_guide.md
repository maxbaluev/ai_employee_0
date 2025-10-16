# AI Employee Control Plane: Implementation Guide

**Version:** 3.1 (October 2025)
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

- `agent/agent.py` — FastAPI bootstrap, load `.env`, route definitions, ADK Runner initialization
- `agent/agents/` — Coordinator, Intake, Planner, Inspector, Executor, Validator, Evidence agents (all inherit from ADK `BaseAgent` or `LlmAgent`)
- `agent/services/` — Mission service, Composio client, Supabase client, telemetry, session state management
- `agent/tools/` — Tool abstractions, undo plans, scoring utilities, Composio provider adapters
- `agent/evals/` — ADK evaluation configs (`smoke_foundation.json`, `dry_run_ranking.json`, `agent_coordination.json`)

### Development Workflow

```bash
mise run agent      # hot reload FastAPI server with ADK Runner
mise run test-agent # adk eval smoke + execution ranking + agent coordination
uv run --with-requirements agent/requirements.txt pytest agent/tests
```

### ADK Agent Architecture

**All Control Plane agents inherit from Gemini ADK's `BaseAgent` or `LlmAgent`**, enabling:

- **Shared Session State:** All agents access `ctx.session.state` dictionary for cross-agent data flow
- **Event-Driven Coordination:** Agents yield `Event` objects via `async for event in agent.run_async(ctx)`
- **Composability:** Agents can be sub-agents of other agents (e.g., ValidatorAgent used by both Planner and Executor)
- **Testability:** ADK's `adk eval` framework validates agent behavior with mission-specific eval sets

**Base Agent Pattern:**

```python
from google.adk.agents import BaseAgent, LlmAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from typing import AsyncGenerator

class InspectorAgent(BaseAgent):
    """ADK agent for toolkit discovery and OAuth initiation"""

    def __init__(self, name: str, composio_client: ComposioClient, supabase_client: SupabaseClient):
        self.composio_client = composio_client
        self.supabase_client = supabase_client
        super().__init__(name=name, sub_agents=[])  # No sub-agents for Inspector

    async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
        """Core inspector logic with ADK event streaming"""
        # Read mission context from session state
        mission_brief = ctx.session.state.get("mission_brief")

        # Discover toolkits via Composio
        search = await self.composio_client.tools.search(query=mission_brief["objective"])

        # Write to session state for downstream agents
        ctx.session.state["anticipated_connections"] = [tk.dict() for tk in search.toolkits]
        ctx.session.state["coverage_estimate"] = self._compute_coverage(search.toolkits)

        # Yield event for CopilotKit to display
        yield Event(
            event_type="inspector_discovery_complete",
            content=f"Discovered {len(search.toolkits)} toolkits with {ctx.session.state['coverage_estimate']}% coverage",
            metadata={"mission_id": ctx.session.state["mission_id"]}
        )
```

### Agent Responsibilities & State Interactions

| Agent | Reads from `ctx.session.state` | Writes to `ctx.session.state` | Composio SDK Calls | Sub-Agents |
|-------|-------------------------------|------------------------------|-------------------|------------|
| **CoordinatorAgent** | All keys (monitors full state) | `mission_id`, `tenant_id`, `user_id`, `current_stage` | None | IntakeAgent, InspectorAgent, PlannerAgent, ExecutorAgent, EvidenceAgent |
| **IntakeAgent** | None | `mission_brief`, `safeguards`, `confidence_scores` | None | None |
| **InspectorAgent** | `mission_brief` | `anticipated_connections`, `granted_scopes`, `coverage_estimate`, `readiness_status` | `client.tools.search()`, `client.toolkits.authorize()`, `wait_for_connection()` | None |
| **PlannerAgent** | `granted_scopes`, `mission_brief`, `coverage_estimate` | `ranked_plays`, `undo_plans`, `tool_usage_patterns` | None | ValidatorAgent (for scope validation) |
| **ValidatorAgent** | `safeguards`, `granted_scopes`, `current_action` | `validation_results`, `auto_fix_attempts` | `client.connected_accounts.status()` | None |
| **ExecutorAgent** | `ranked_plays`, `granted_scopes` | `execution_results`, `heartbeat_timestamp` | `provider.session(...).handle_tool_call(...)` | ValidatorAgent (for preflight/postflight), EvidenceAgent (for artifact packaging) |
| **EvidenceAgent** | `execution_results`, `undo_plans` | `evidence_bundles`, `library_contributions` | `client.audit.list_events()` | None |

### ADK Patterns & Practices

- **Session State Management:**
  - All agents share `ctx.session.state` dictionary (backed by ADK's `InMemorySessionService` or Supabase)
  - State schema enforced by the agent services module with Pydantic validation (see shared patterns in `libs_docs/adk/llms-full.txt`)
  - Use `ctx.session.state.get(key, default)` for safe reads, direct assignment for writes

- **Event Streaming:**
  - Yield `Event` objects with `event_type`, `content`, `metadata` for CopilotKit display
  - Use `async for event in sub_agent.run_async(ctx)` to propagate sub-agent events
  - Events automatically logged to telemetry via ADK Runner

- **Multi-Agent Coordination:**
  - Parent agents pass `ctx` unchanged to sub-agents for state continuity
  - Use `SequentialAgent` for linear workflows, `ParallelAgent` for concurrent tasks
  - Custom agents inherit from `BaseAgent` and implement `_run_async_impl`

- **Composio Integration:**
  - Store `ComposioClient` as instance attribute: `self.composio_client = composio_client`
  - Pass `user_id`, `tenant_id` from session state to Composio SDK calls
  - Emit telemetry events after Composio operations: `composio_discovery`, `composio_auth_flow`, `composio_tool_call`

- **Telemetry:**
  - ADK Runner auto-emits `session_heartbeat` events with agent name, lag, token usage
  - Agents emit custom events via `yield Event(...)` for mission-specific tracking
  - Use `TelemetryClient.track(event, payload)` for Supabase persistence

- **Error Handling:**
  - Wrap Composio calls in try/except to handle `RateLimitError`, `AuthExpiredError`, `ToolkitNotFoundError`
  - Update session state with error details for coordinator retry logic
  - Yield error events for chat display: `Event(event_type="error", content="Auth expired", metadata={...})`

### ADK Evaluation Framework

**Purpose:** Ensure planner rankings, OAuth handoffs, executor safeguards, and evidence packaging remain reliable as the platform evolves.

**Evaluation Pillars:**

- **Smoke:** Core agent capabilities (discovery, OAuth, execution, evidence packaging) on every commit.
- **Mission Journeys:** End-to-end five-stage scenarios covering undo plans, telemetry assertions, and Supabase persistence.
- **Ranking Quality:** Planner ordering scored against golden missions to catch regressions in tool sequencing or safeguard coverage.
- **Coordination:** Shared-state handoffs, checkpoints, and rollback behavior under load or concurrent updates.
- **Recovery:** Rate limits, auth expiry, and Supabase disconnects validating graceful degradation and restart logic.

**Eval Suite Layout (recommended):**

```
agent/evals/
├── smoke_foundation.evalset.json       # Core agent smoke
├── discovery_coverage.evalset.json     # Inspector toolkit breadth & coverage math
├── ranking_quality.evalset.json        # Planner scoring + undo plans
├── execution_safety.evalset.json       # Executor + Validator safeguards
├── error_recovery.evalset.json         # Rate limits, auth expiry, Supabase outage cases
└── mission_end_to_end.evalset.json     # Five-stage scenario with telemetry assertions
```

**Running Evaluations:**

```bash
# Run the full ADK eval battery (wrapped in mise)
mise run test-agent

# Target a single agent + evalset
adk eval agent/agents/inspector.py agent/evals/discovery_coverage.evalset.json

# Debug mode with verbose traces
adk eval --verbose agent/agents/planner.py agent/evals/ranking_quality.evalset.json
```

**Evidence & Readiness:** Export eval reports (JSON + HTML) to `docs/readiness/agent-evals/` for release checkpoints. `docs/09_release_readiness.md` lists the minimum passing sets required before a production launch.

**Reference:** See `libs_docs/adk/llms-full.txt` for ADK patterns, `docs/02_system_overview.md` §ADK Agent Coordination for state flow diagrams, and `docs/09_release_readiness.md` for evaluation evidence requirements.

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

## 5. Composio SDK Integration

### 5.1 Native SDK Architecture

**The AI Employee Control Plane standardizes on the native Composio SDK for toolkit execution.** The SDK exposes discovery, authentication, execution, triggers, and telemetry under a single identity context (`user_id` + `tenantId`). No additional router layer or MCP bridge is required.

**Core SDK Surfaces (ADK backend only):**

- **Discovery:** `ComposioClient.tools.search()` and `ComposioClient.toolkits.get()` provide semantic catalog access for no-auth inspection.
- **Authentication:** `ComposioClient.toolkits.authorize()` is the managed fast path for issuing mission-scoped Connect Links (`await req.wait_for_connection()`). Fall back to `ComposioClient.connected_accounts.link()` / `.status()` for custom auth configs, and `.revoke()` for disconnects.
- **Sessions:** ADK agents wrap `ComposioClient` calls inside Python `provider.session(user_id=..., tenant_id=...)` context managers; we do not expose TypeScript or alternate framework adapters.
- **Execution:** `client.tools.execute()` (and ADK's `provider.session().handle_tool_call`) power governed execution—there is no LangChain, CrewAI, or other framework integration in this control plane.
- **Automation:** `client.triggers.create()` + `client.workflows.run()` orchestrate async jobs, batching, or multi-step escalations.
- **Telemetry:** Audit APIs (`client.audit.list_events`) and event hooks emit `composio_discovery`, `composio_auth_flow`, and `composio_tool_call` to our Supabase telemetry tables.

**Progressive Trust Flow:**

- **Define Stage:** Coordinator writes mission context; optional catalog warm-up via `client.tools.search()` seeds predicted coverage.
- **Prepare Stage:** Inspector discovers toolkits via `client.tools.search()`, previews anticipated scopes without initiating OAuth, presents Connect Link approval requests to stakeholders via chat, initiates OAuth via `client.toolkits.authorize()` after approval, awaits `wait_for_connection()` handshake, and logs all granted scopes in Supabase. Output stored in Supabase readiness tables and `mission_connections`.
- **Plan & Approve Stage:** Planner receives established connections from Inspector with validated scopes. Planner assembles mission plays (playbooks) emphasizing tool usage patterns, data investigation insights, and precedent missions, tagging sequencing, resource requirements, and undo affordances before ranking. Validator confirms scope alignment against Inspector's approved connections. Focus shifts to play ranking and safeguard attachment rather than credential management.
- **Execute & Observe Stage:** Executor runs approved actions via provider adapters/SDK using established connections, streams results to CopilotKit, logs audit trails, and triggers evidence packaging.

### 5.2 Implementation Patterns

**Inspector Agent (Discovery + OAuth Initiation):**

```python
from composio import ComposioClient

client = ComposioClient(api_key=settings.COMPOSIO_API_KEY)

async def inspect_mission(mission: Mission) -> InspectionReport:
    """Phase 1: Discovery and scope preview (no OAuth yet)"""
    search = await client.tools.search(query=mission.objective, limit=10, include_metadata=True)
    toolkits = [ToolkitSummary.from_api(tk) for tk in search.toolkits]

    anticipated_connections = []
    for toolkit in toolkits:
        if toolkit.requires_auth:
            anticipated_connections.append(
                AnticipatedConnection(
                    toolkit=toolkit.slug,
                    scopes=toolkit.required_scopes,
                    auth_flow=toolkit.auth_type,
                )
            )

    return InspectionReport(
        toolkits=toolkits,
        anticipated_connections=anticipated_connections,
        coverage_estimate=coverage.estimate(toolkits, mission.objective),
    )


async def establish_connections(mission: Mission, approved_scopes: list[AnticipatedConnection]) -> list[ConnectedAccount]:
    """Phase 2: OAuth initiation after stakeholder approval via chat"""
    requests = []

    for scope in approved_scopes:
        payload = scope.to_request()
        req = await client.toolkits.authorize(
            user_id=mission.user_id,
            toolkit=payload["toolkit"],
            scopes=payload["scopes"],
            metadata={"mission_id": mission.id, "tenantId": mission.tenant_id},
            expires_in_minutes=30,
        )

        # Store Connect Link for chat display and audit
        await supabase.store_connect_request(mission.id, req.redirect_url, scope)
        requests.append(req)

    # Wait for stakeholder to complete OAuth flow
    approvals = []
    for req in requests:
        approvals.append(await req.wait_for_connection(timeout=900))

    # Log granted scopes for Planner and Validator
    await supabase.store_approved_connections(mission.id, approvals)

    telemetry.emit("composio_auth_flow", mission_id=mission.id, status="approved", count=len(approvals))

    return approvals
```

**Planner + Validator (Play Assembly from Established Connections):**

```python
async def assemble_mission_plays(mission: Mission) -> list[MissionPlay]:
    """Planner receives established connections from Inspector"""
    # Retrieve approved connections from Inspector
    accounts = await client.connected_accounts.status(user_id=mission.user_id)
    mission_accounts = [acct for acct in accounts if acct.metadata.get("mission_id") == mission.id]

    # Validator confirms scopes match mission requirements
    validator.ensure_scopes_match(mission_accounts, mission.required_scopes)

    # Assemble plays emphasizing tool usage patterns and data investigation
    plays = await generate_plays(
        mission=mission,
        available_toolkits=[acct.toolkit for acct in mission_accounts],
        library_precedent=await library.search_similar(mission.objective),
        tool_usage_patterns=await analyze_tool_patterns(mission_accounts),
    )

    return plays
```

**Executor Agent (Governed Execution + Telemetry):**

```python
async def execute_plan(mission: Mission, actions: list[ToolInvocation]):
    telemetry.emit("composio_discovery", mission_id=mission.id, count=len(actions))

    async with provider.session(user_id=mission.user_id, tenant_id=mission.tenant_id) as session:
        for action in actions:
            validator.preflight(action, mission.safeguards)
            response = await session.handle_tool_call(action.to_provider_call())
            validator.verify(response, mission.safeguards)
            telemetry.emit(
                "composio_tool_call",
                mission_id=mission.id,
                toolkit=action.toolkit,
                action=action.name,
                duration_ms=response.latency_ms,
            )
            evidence.append(response)

    await client.audit.list_events(filters={"mission_id": mission.id})  # persisted for undo + compliance
```

### 5.3 Composio SDK Best Practices

**Discovery Optimization:**

- Cache `client.tools.search()` results for one hour per mission theme; invalidate when tool taxonomy updates.
- Store toolkit metadata (scopes, auth type, SLAs) in Supabase to support readiness dashboards.
- Limit discovery payloads to the top 10 toolkits to control token usage, then narrow execution sets with `client.tools.get(..., limit=6)` before handing tools to the LLM.

**OAuth & Consent:**

- Always initiate Connect Links from Inspector during Prepare stage; Executors should never request new scopes, and Planner should only assemble plays from established connections.
- Annotate Connect Links with mission metadata so the audit trail can be joined with Supabase records.
- Use `client.connected_accounts.revoke()` during mission cleanup or tenant offboarding.
- Planner validates that approved connections from Inspector satisfy mission requirements before assembling plays.

**Execution Safeguards:**

- Run Validator preflight checks before submitting actions to the provider adapter.
- Prefer streaming providers for long-running actions; fall back to `client.tools.execute()` for bulk operations.
- Use session-scoped adapters (`composio.createSession({...headers...})` or `provider.session(user_id=..., tenant_id=...)`) so every tool call carries mission + tenant headers.
- Capture undo instructions in Supabase using Composio audit events (`event.payload.undo_hint`).

**Telemetry & Observability:**

- Emit `composio_discovery`, `composio_auth_flow`, `composio_tool_call`, and `composio_tool_call_error` with consistent labels (`mission_id`, `tenantId`, `toolkit`, `action`).
- Monitor Connect Link drop-off to fine-tune scope requests.
- Alert on consecutive failures per toolkit to pre-empt partner incidents.

**Error Handling:**

```python
async def call_with_guardrails(action: ToolInvocation):
    try:
        return await provider.handle_tool_call(action.to_provider_call())
    except composio.RateLimitError as exc:
        backoff.schedule_retry(action, exc.retry_after)
        telemetry.emit("composio_tool_call_error", mission_id=action.mission_id, reason="rate_limit")
        raise
    except composio.AuthExpiredError:
        telemetry.emit("composio_auth_flow", mission_id=action.mission_id, status="expired")
        raise ReconnectRequired("Connection expired; rerun Connect Link in Plan stage")
    except composio.ToolkitNotFoundError:
        catalog.refresh_cache()
        raise
```

**Reference:** See `libs_docs/composio/llms.txt` for SDK quickstart, provider adapters, authentication guides, and trigger automation recipes.

### Partner Integration Architecture

```mermaidadap

```

**Integration References:**

- **CopilotKit:** See `libs_docs/copilotkit/llms-full.txt` for CoAgents patterns, streaming SSE, frontend actions, and state management
- **Gemini ADK:** See `libs_docs/adk/llms-full.txt` for agent orchestration, evaluation frameworks, and session coordination
- **Supabase:** See `libs_docs/supabase/llms_docs.txt` for database APIs, storage patterns, edge functions, and real-time subscriptions
- **Composio SDK:** See reference above and `libs_docs/composio/llms.txt` for native API guides, provider adapters, and trigger workflows

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
