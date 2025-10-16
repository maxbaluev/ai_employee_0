# Composio SDK Integration: Progressive Trust with ADK Agents

**Date:** 2025-10-15 (ADK-Composio Integration Clarification)
**Audience:** Platform Engineering, ADK Agent Developers, Trust & Governance, UX Documentation
**Objective:** Document how the AI Employee Control Plane integrates Gemini ADK agents with the Composio SDK for discovery, authentication, governed execution, and telemetry across the progressive trust model, and clarify how ADK agents orchestrate Composio touchpoints surfaced in the CopilotKit chat experience.

---

## Executive Summary

The Control Plane is built on a **Gemini ADK-driven agent architecture tightly coupled with Composio state management**. ADK agents (Inspector, Planner, Executor, Validator, Evidence) orchestrate Composio SDK interactions through shared session state (`ctx.session.state`), delivering progressive trust across the five-stage mission lifecycle. Each agent reads from and writes to the session state, enabling stateful handoffs while Composio provides toolkit discovery, OAuth management, provider adapters, and audit telemetry. The native SDK removes the legacy router layer, and ADK's event-driven coordination ensures every SDK interaction is mirrored in the CopilotKit chat for stakeholder visibility.

Key outcomes:

- **ADK-Driven Progressive Trust:** Inspector agent discovers toolkits (Prepare), Planner agent assembles plays from established connections (Plan & Approve), Executor agent runs governed actions (Execute & Observe) – all coordinated via ADK session state and narrated in chat
- **Stateful Agent Coordination:** All ADK agents share `ctx.session.state` dictionary for mission context, granted scopes, ranked plays, execution results, and evidence bundles – enabling smooth handoffs across stages
- **Governed Auth:** Inspector previews scopes, initiates Connect Links after approval, awaits `wait_for_connection()`, and logs granted scopes to session state; Planner validates scope alignment; Executor never requests new OAuth
- **Unified Telemetry:** Every discovery, auth, and tool call emits `composio_discovery`, `composio_auth_flow`, `composio_tool_call`, and `composio_tool_call_error` events tagged with mission, tenant, toolkit, and action metadata, with ADK events yielded to CopilotKit for chat visibility
- **Operational Simplicity:** ADK's event-driven patterns simplify runbooks, dashboards, and quotas. The SDK exposes consistent error codes (`RATE_LIMIT`, `AUTH_EXPIRED`, `TOOLKIT_NOT_FOUND`) with actionable context, and ADK agents surface resolution checklists to keep operators in-the-loop

---

## Why ADK + Composio SDK?

### 1. Stateful Multi-Agent Architecture

```
User Request
  ↓
CoordinatorAgent (ADK) → Initialize mission context in ctx.session.state
  ↓
IntakeAgent (ADK) → Generate brief chips → Write to session state
  ↓
InspectorAgent (ADK) → ComposioClient.tools.search() (discovery)
                     → Preview scopes → Write to session state
                     → Await stakeholder approval via chat
                     → toolkits.authorize() → Connect Link
                     → wait_for_connection() → Write granted_scopes to session state
  ↓
PlannerAgent (ADK) → Read granted_scopes from session state
                   → Assemble mission plays emphasizing tool patterns
                   → Write ranked_plays, undo_plans to session state
  ↓
ValidatorAgent (ADK) → Read safeguards, granted_scopes from session state
                     → Preflight/postflight checks
                     → Write validation_results to session state
  ↓
ExecutorAgent (ADK) → Read ranked_plays, granted_scopes from session state
                    → provider.handle_tool_calls(...) via Composio
                    → Write execution_results to session state
  ↓
EvidenceAgent (ADK) → Read execution_results from session state
                    → Package artifacts → Write evidence_bundles to session state
                    → audit + triggers (chat evidence cards)
```

- **Stateful handoffs:** ADK agents share `ctx.session.state` for mission context, eliminating redundant API calls and enabling each agent to build on previous work
- **Event-driven coordination:** Each ADK agent yields `Event` objects via `async for event in agent.run_async(ctx)`, propagating to CopilotKit for real-time chat updates
- **Shared context:** `mission_id` + `tenant_id` + `user_id` persist in session state and flow into every Composio call issued by the Gemini ADK backend
- **Backend-only execution:** The control plane does not host LangChain, CrewAI, or alternate providers—ADK is the sole orchestrator streaming results to CopilotKit
- **Testability:** ADK's `adk eval` framework validates agent behavior and ranking quality before production deployment

### 2. Governed Authentication via ADK Agents

- **InspectorAgent (Prepare Stage):**
  - Discovers toolkits via `client.tools.search()` and writes `anticipated_connections` to `ctx.session.state`
  - Previews scopes without initiating OAuth, awaits stakeholder approval via chat
  - Calls `client.toolkits.authorize()` after approval to generate Connect Links
  - Awaits `wait_for_connection()` handshake and writes `granted_scopes` to session state
  - All scopes, timestamps, and metadata persisted to Supabase (`mission_connections` table)
  - Chat displays Connect Link summary, requested scopes, countdown timers during validation

- **PlannerAgent (Plan & Approve Stage):**
  - Reads `granted_scopes` from session state (established by Inspector)
  - Assembles mission plays from approved connections without initiating new OAuth
  - Focuses on tool usage patterns, data investigation insights, and precedent missions
  - Writes `ranked_plays`, `undo_plans`, `tool_usage_patterns` to session state

- **ValidatorAgent (Cross-Stage):**
  - Reads `safeguards` and `granted_scopes` from session state
  - Validates scope alignment via `client.connected_accounts.status()` before play approval
  - Performs preflight/postflight checks during execution
  - Writes `validation_results` to session state; chat surfaces validator alerts inline

- **ExecutorAgent (Execute & Observe Stage):**
  - Reads `ranked_plays` and `granted_scopes` from session state
  - Executes approved actions via `provider.session(...).handle_tool_call(...)` using established connections
  - Never initiates new OAuth; if auth expires, surfaces error and reroutes to Inspector for re-authorization
  - Writes `execution_results` to session state; chat streams tool calls with validator flags

- **Custom Auth Configs:** For bespoke scopes, Inspector calls `client.connected_accounts.link()` / `.status()` while preserving mission metadata in session state; chat highlights deviations from recommended scopes
- **Revocation:** Managed through `client.connected_accounts.revoke()` during mission closeout; InspectorAgent handles revocation and updates session state; chat displays notice with undo plan link
- **Principle:** Only Inspector initiates OAuth (Prepare stage). Planner and Executor use established connections from session state. Chat interrupts execution if scope escalation is attempted outside Inspector.

### 3. Observability & Telemetry

- **Events:**
  - `composio_discovery` — catalog queries, includes `query`, `result_count`, `latency_ms`; narrated in chat with coverage deltas.
  - `composio_auth_flow` — Connect Link status changes (`initiated`, `approved`, `revoked`); surfaced as toast + persistent thread message.
  - `composio_tool_call` — execution result (`status`, `latency_ms`, `toolkit`, `action`, `error_code`); chat emits streaming status updates and links to evidence cards.
- **Dashboards:** Integration Health dashboard plots success/error rates, Connect Link completion, and per-toolkit volume, while chat mirrors critical alerts for the active mission.
- **Alerts:**
  - Error rate >10% per toolkit triggers a chat interrupt pointing to Runbook 4.
  - Consecutive `AUTH_EXPIRED` events escalate to Plan & Approve with a chat prompt to re-request scopes.
  - Spikes in `RATE_LIMIT` trigger adaptive backoff and a chat notification summarizing the retry schedule.

### 4. Operational Efficiency

- **Caching:** Discovery responses cached 60 minutes per mission theme; invalidated on toolkit updates. Chat flags when cached insights power recommendations from earlier sessions.
- **Triggers & Workflows:** Long-running actions (bulk email, exports) move to `client.triggers` so Executor threads remain responsive; chat uses progress pips to keep humans informed.
- **Undo Plans:** `client.audit.list_events()` supplies action payloads and undo hints for each tool call. CopilotKit’s undo drawer references the same audit events the SDK records.

### 5. Toolkit Coverage Snapshot

| Category | Representative Toolkits | Practical Coverage |
| -------- | ----------------------- | ------------------ |
| CRM & RevOps | HubSpot, Salesforce, Zendesk, Pipedrive, Zoho | Pipeline management, customer success escalations, service desk automations |
| Communication & Meetings | Slack, Gmail, Outlook, Zoom, Microsoft Teams, Webex | Multi-channel outreach, approvals, incident broadcast flows |
| Data & Analytics | Snowflake, BigQuery, Mixpanel, Amplitude, PostHog, ClickHouse | Mission insights, experiment dashboards, anomaly detection |
| Productivity & Knowledge | Notion, Linear, ClickUp, Airtable, Coda, Todoist | Task orchestration, documentation updates, backlog grooming |
| Marketing & Growth | Brevo, MailerLite, Campaign Cleaner, Instantly, Hunter | Lifecycle email, lead enrichment, campaign execution |
| Automation & Web Agents | Apify, AgentQL, BrightData, Firecrawl, Tavily | Structured web extraction, research taps, enrichment pipelines |

> Source: `libs_docs/composio/llms.txt` — review it when verifying toolkit availability or adding new mission playbooks.

---

## Progressive Trust with ADK Agents & Composio SDK

| Trust Stage | ADK Agent | Composio SDK Interaction | Session State Artifacts | Chat Experience |
|-------------|-----------|-------------------------|------------------------|-----------------|
| **Define** | IntakeAgent | None | `mission_brief`, `safeguards`, `confidence_scores` | Coordinator narrates chip generation, requests edits |
| **Prepare (Inspector)** | InspectorAgent | `client.tools.search()` → `toolkits.authorize()` → `wait_for_connection()` | `anticipated_connections`, `granted_scopes`, `coverage_estimate`, `readiness_status` | Inspector posts discovery cards with coverage score, Connect Link modal, granted scope confirmations |
| **Plan & Approve (Planner + Validator)** | PlannerAgent, ValidatorAgent | Validator: `client.connected_accounts.status()` | `ranked_plays`, `undo_plans`, `tool_usage_patterns`, `validation_results` | Planner shares ranked plays with tool patterns, safeguard recap, undo plans; Validator confirms scope alignment |
| **Execute & Observe (Executor + Validator)** | ExecutorAgent, ValidatorAgent | `provider.session(...).handle_tool_call(...)` | `execution_results`, `heartbeat_timestamp` | Executor streams action logs, validator alerts, undo timers |
| **Reflect & Improve (Evidence)** | EvidenceAgent | `client.audit.list_events()` + triggers | `evidence_bundles`, `library_contributions` | Evidence agent posts retrospective bundles, feedback form, follow-up checklist |

> **See also:** `docs/03a_chat_experience.md` for narrative walkthrough of each chat touchpoint and `docs/02_system_overview.md` §ADK Agent Coordination for state flow diagrams.

### ADK Agent Responsibilities by Stage

**InspectorAgent (Prepare Stage):**
- Reads `mission_brief` from session state
- Runs `client.tools.search(mission.objective)` and writes `anticipated_connections` to session state
- Computes coverage percentage and writes `coverage_estimate` to session state
- Previews anticipated scopes without OAuth; awaits stakeholder approval via chat
- Calls `client.toolkits.authorize()` after approval, generates Connect Links, shares `redirect_url` via chat
- Awaits `.wait_for_connection()` handshake before proceeding
- Writes `granted_scopes`, `readiness_status` to session state
- Persists connection metadata to Supabase (`mission_connections` table)
- Emits `composio_discovery`, `composio_auth_flow` telemetry events
- Chat: Discovery cards, coverage deltas, Connect Link approval requests, granted scope confirmations

**PlannerAgent (Plan & Approve Stage):**
- Reads `granted_scopes`, `mission_brief`, `coverage_estimate` from session state (established by Inspector)
- Assembles mission plays (playbooks) emphasizing tool usage patterns, data investigation insights, library precedent
- Tags each play with sequencing, resource requirements, undo affordances
- Writes `ranked_plays`, `undo_plans`, `tool_usage_patterns` to session state
- Coordinates with ValidatorAgent for scope validation
- Focuses on play ranking and safeguard attachment—never initiates OAuth
- Chat: Streams ranked plays with confidence scores, rationale, tool pattern highlights, undo plan previews

**ValidatorAgent (Cross-Stage):**
- Reads `safeguards`, `granted_scopes`, `current_action` from session state
- Validates scope alignment via `client.connected_accounts.status()` against Inspector's approved connections
- Performs preflight checks before execution, postflight checks after execution
- Auto-fixes parameter issues when possible; blocks and returns feedback otherwise
- Writes `validation_results`, `auto_fix_attempts` to session state
- Chat: Surfaces validator alerts inline with suggested fixes, compliance verdict badges

**ExecutorAgent (Execute & Observe Stage):**
- Reads `ranked_plays`, `granted_scopes` from session state
- Uses provider adapters via `provider.session(user_id, tenant_id).handle_tool_call(action)`
- Coordinates with ValidatorAgent for preflight/postflight checks
- Never initiates new OAuth; if auth expires, surfaces error and reroutes to Inspector
- Writes `execution_results`, `heartbeat_timestamp` to session state
- Emits `composio_tool_call`, `composio_tool_call_error`, `session_heartbeat` telemetry events
- Coordinates with EvidenceAgent for artifact packaging
- Chat: Streams tool calls, validator flags, evidence cards as steps complete

**EvidenceAgent (Execute & Observe, Reflect & Improve):**
- Reads `execution_results`, `undo_plans` from session state
- Calls `client.audit.list_events()` for undo hints and audit trails
- Packages artifacts with SHA-256 hashes
- Writes `evidence_bundles`, `library_contributions` to session state
- Persists to Supabase Storage (`supabase/storage/evidence/${missionId}`)
- Chat: Posts artifact cards with hashes and download links, mission summary, feedback form

---

## Composio SDK Session Management & Provider Patterns

### Provider-Specific Session Handling

Composio sessions run exclusively inside the Gemini ADK service. Each agent call is wrapped in a Python context manager that stamps `user_id` + `tenantId` so tool executions inherit mission identity and audit context.

**Python Pattern:**

```python
from composio import ComposioClient

client = ComposioClient(api_key=settings.COMPOSIO_API_KEY)

async def run_governed_actions(mission: Mission, actions: list[dict]):
    async with client.provider.session(
        user_id=mission.user_id,
        tenant_id=mission.tenant_id,
        metadata={"mission_id": mission.id}
    ) as session:
        for action in actions:
            result = await session.handle_tool_call(action)
            yield result
```

### Session Lifecycle Management

- **Initialization (Prepare / Inspector):** Inspector seeds `ctx.session.state` with `mission_id`, `user_id`, `tenant_id`, and constructs the first Composio session. Connect Link approvals attach the same identity metadata for audit trails.
- **Propagation (Plan & Execute):** Planner, Validator, and Executor reuse session metadata from `ctx.session.state`, ensuring scope checks and tool calls always carry mission context without re-authorizing.
- **Freshness Checks (Execute):** Executor verifies session freshness before each tool call; if stale, it pauses execution and routes back to Inspector for re-auth without creating a new session silently.
- **Cleanup (Reflect / Evidence):** Evidence agent marks sessions complete, archives audit metadata, and triggers retention timers. Supabase cron purges session state per retention policy.

**Reference:** See `docs/02_system_overview.md` §Session State Persistence for Supabase-backed synchronization and `docs/04_implementation_guide.md` §ADK Patterns for implementation examples.

---

## Operational Guardrails

### Access & Credentials

- `COMPOSIO_API_KEY` scoped to mission-tier workspace.
- API key rotated quarterly or upon incident via Composio dashboard.
- Supabase stores mission-level Connect Link metadata for audit reconciliation.
- Executors run with least privilege—mission-specific scopes only.
- Chat notifies stakeholders when credentials are rotated or revoked mid-session.

### Rate Limiting & Backoff

- Default exponential backoff: 1s → 2s → 4s → 8s (max 5 attempts).
- Circuit breaker trips after three consecutive failures per toolkit.
- Mission-level quotas prevent a single tenant from exhausting all capacity.
- Chat displays retry schedules and prompts humans when manual escalation is required.

### Data Residency & Privacy

- Tool responses redacted before storage; use `src/lib/telemetry/redaction.ts` for telemetry payloads.
- Audit events stored for 180 days; extendable via Supabase retention policies.
- Connect Link metadata excludes sensitive tokens; only scope + account alias stored.
- Chat clears sensitive payload previews after output verification to avoid accidental retention.

---

## Telemetry & Runbooks

### Event Schema (Supabase `telemetry_events`)

| Field | Type | Description |
|-------|------|-------------|
| `event_type` | text | `composio_discovery`, `composio_auth_flow`, `composio_tool_call`, `composio_tool_call_error` |
| `mission_id` | uuid | Mission identifier |
| `tenant_id` | uuid | Tenant identifier |
| `toolkit` | text | Toolkit slug |
| `action` | text | Action name |
| `status` | text | `success`, `rate_limit`, `auth_expired`, `error` |
| `latency_ms` | int | Milliseconds to complete action |
| `error_code` | text | Optional error detail |
| `payload_sha` | text | SHA-256 hash of tool payload (for tamper detection) |

CopilotKit emits lightweight chat annotations each time a telemetry record lands so humans can cross-check Supabase against the conversational log.

### Runbook Snapshot

1. **Runbook 1 – Discovery Failure:**
   - Symptom: `composio_discovery` error rate >5%.
   - Fix: Refresh catalog cache, verify Composio status, degrade gracefully with fallback playbooks.
   - Chat Action: Inspector posts fallback playbook card and invites human assignment.
2. **Runbook 2 – Connect Link Stuck:**
   - Symptom: `composio_auth_flow` stuck in `initiated` >30 minutes.
   - Fix: Ping stakeholder, resend link, verify scopes still valid, escalate to partner success.
   - Chat Action: Planner pings owners with quick-reply buttons to resend or cancel.
3. **Runbook 3 – Auth Expired Mid-Mission:**
   - Symptom: `composio_tool_call` errors with `AUTH_EXPIRED`.
   - Fix: Mark mission paused, route to Plan & Approve for re-approval, re-run validator before resuming.
   - Chat Action: Executor stops streaming, posts undo hint, and reassigns to Planner automatically.
4. **Runbook 4 – Rate Limit Exceeded:**
   - Symptom: Consecutive `RATE_LIMIT` statuses.
   - Fix: Trigger throttling, redistribute workload, open quota request with Composio, monitor backlog size.
   - Chat Action: Session banner displays throttle state and expected resume time.

Full procedures live in `docs/07_operations_playbook.md`.

---

## Implementation Checklist

- [ ] `COMPOSIO_API_KEY` stored in secret manager and injected via mise.
- [ ] Composio SDK client initialized with mission context wrapper (user/tenant IDs, correlation IDs).
- [ ] Inspector cache seeded nightly via `client.tools.search()` to keep coverage stats fresh.
- [ ] Connect Link approval UI built in CopilotKit with mission + scope display.
- [ ] Executor emits telemetry and evidence artifacts for every tool call.
- [ ] Validator enforces safeguards both preflight and postflight with hooks around provider adapters.
- [ ] Evidence bundler attaches audit events and undo hints to each mission bundle.
- [ ] Telemetry dashboards configured for discovery/auth/execution funnels and mirrored in chat callouts.
- [ ] Alerts configured for rate limit, auth expiry, and discovery degradation thresholds with chat escalation scripts.

---

## Migration Note

- 2025-10-15: Router middleware removed; native Composio SDK adopted across all stages.
- Backfilled telemetry renamed from the legacy router event to `composio_tool_call`, with historical mapping maintained in analytics.
- Runbooks, documentation, readiness evidence, and chat copy updated to reference native SDK operations only.

---

## References

- `docs/03a_chat_experience.md` — Chat experience blueprint tying SDK events to UX patterns.
- `libs_docs/composio/llms.txt` — Curated Composio documentation index (Quickstart, Providers, Authenticating Tools, Executing Tools, Triggers, Dashboard guides).
- `docs/04_implementation_guide.md` — Code-level integration patterns using the SDK.
- `docs/07_operations_playbook.md` — Operational runbooks and telemetry metrics.
- `docs/09_release_readiness.md` — Evidence expectations prior to launch.
- `AGENTS.md` — Onboarding reference for Inspector/Planner/Executor responsibilities.
