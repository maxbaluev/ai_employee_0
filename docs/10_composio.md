# Composio SDK: Unified Toolkit Execution Interface

**Date:** 2025-10-15 (Native SDK Clarification)
**Audience:** Platform Engineering, Agent Orchestration, Trust & Governance, UX Documentation
**Objective:** Document how the AI Employee Control Plane standardizes on the native Composio SDK for discovery, authentication, governed execution, and telemetry across the progressive trust model, and clarify how those touchpoints surface inside the CopilotKit chat experience.

---

## Executive Summary

The control plane now relies exclusively on the **Composio SDK**. Inspector, Planner, Executor, Validator, and Evidence agents all share a single Composio workspace that exposes catalog discovery, Connect Link–based authentication, provider adapters, triggers, and audit telemetry. The native SDK removes the legacy router layer, shortens execution paths, and gives us first-class observability via structured events. Every SDK interaction is mirrored in the CopilotKit chat so stakeholders can inspect intent, approvals, execution, and undo plans without leaving the workspace.

Key outcomes:

- **Progressive Trust Alignment:** No-auth inspection discovers toolkits in Prepare stage, OAuth happens during Prepare via Inspector-initiated Connect Links after stakeholder approval, and governed execution in Execute & Observe streams through provider adapters while validator safeguards run pre/post checks – all narrated in chat.
- **Governed Auth:** Scopes are previewed during Prepare, formally authorized after approval via Connect Links initiated by Inspector, persisted in Supabase, reconciled against validator requirements before execution, and summarized for reviewers directly in the chat rail.
- **Unified Telemetry:** Every discovery, auth, and tool call emits `composio_discovery`, `composio_auth_flow`, `composio_tool_call`, and `composio_tool_call_error` events tagged with mission, tenant, toolkit, and action metadata, with chat callouts ensuring humans know what fired and why.
- **Operational Simplicity:** Runbooks, dashboards, and quotas now focus on three canonical flows instead of six meta-tools. The SDK exposes consistent error codes (`RATE_LIMIT`, `AUTH_EXPIRED`, `TOOLKIT_NOT_FOUND`) with actionable context and the chat surfaces the resolution checklist to keep operators in-the-loop.

---

## Why the Native SDK?

### 1. Simplified Agent Architecture

```
User Request
  ↓
Inspector → ComposioClient.tools.search() (discovery)
  ↓
Inspector → Preview anticipated scopes + data coverage
  ↓
Inspector → toolkits.authorize() → Connect Link (after stakeholder approval)
  ↓
Stakeholder Approval (chat modal during Prepare)
  ↓
Planner → Assemble mission plays from approved toolkits
  ↓
Executor → provider.handle_tool_calls(...) (using established connections)
  ↓
Validator & Evidence → audit + triggers (chat evidence cards)
```

- **Single decision path:** Agents no longer branch between meta-tools and per-tool servers.
- **Shared context:** `user_id` + `tenantId` propagate through every call via `composio.createSession({ headers: { "x-tenant-id": tenantId } })` (TS) or `provider.session(user_id=..., tenant_id=...)` (Py); we log these fields for audits and announce them when scopes are granted.
- **Provider abstraction:** Anthropic, Gemini, OpenAI, LangChain, CrewAI, and Vercel adapters consume identical payloads produced from mission plans. CopilotKit streams the resulting tool events to the chat so reviewers can inspect raw inputs/outputs without opening a separate console.

### 2. Governed Authentication

- **Connect Links:** Generated with `client.toolkits.authorize()` during the Prepare stage by Inspector; include mission/tenant metadata, expiry windows, and an async `wait_for_connection()` handshake before proceeding to planning. Chat messages display the link summary, requested scopes, and countdown timers while validation is pending.
- **Custom Auth Configs:** For bespoke scopes, call `client.connected_accounts.link()` / `.status()` against specific auth configs while preserving mission metadata; the chat highlights any deviations from recommended scopes.
- **Approval evidence:** Stored in Supabase (`mission_connections` table) with granted scopes, timestamps, and validator sign-off; chat pins the approval receipt so auditors can replay the timeline.
- **Revocation:** Managed through `client.connected_accounts.revoke()` during mission closeout or tenant offboarding; chat drops a notice and links to the undo plan when revocation happens mid-mission.
- **Principle:** Executors never initiate new OAuth—Prepare (Inspector) is the only stage allowed to request scopes via Connect Links. Planner focuses on assembling plays from established connections, and chat interrupts execution if an executor attempts to escalate scopes directly.

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

---

## Progressive Trust Alignment

| Trust Stage            | Composio SDK Interaction                          | Chat Experience                                      | Mission Artifacts Generated                                   |
| ---------------------- | ------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| **Prepare (Inspector)** | `client.tools.search()` + schema previews + `toolkits.authorize()` after approval | Inspector posts discovery cards with coverage score, then Connect Link modal upon approval  | Coverage reports, anticipated scopes, approved scopes, Connect Link URL, risk notes               |
| **Plan & Approve (Planner)** | Assemble mission plays from established connections + validator checks | Planner shares ranked plays based on tool usage patterns, safeguard recap, undo plans | Mission plays, safeguard matrix, undo plan details, data investigation insights |
| **Governed Execution** | Provider adapters / `client.tools.execute()`      | Executor streams action logs, validator alerts, undo | Tool outputs, undo hints, telemetry traces, evidence bundles   |
| **Reflect & Improve**  | `client.audit.list_events()` + triggers workflows | Evidence agent posts retrospective bundles + follow-up prompts | Post-mission analytics, play updates, Supabase readiness logs  |

> **See also:** `docs/03a_chat_experience.md` for a narrative walkthrough of each chat touchpoint.

**Inspector Responsibilities (Prepare Stage):**
- Run discovery queries and compute coverage percentage.
- Preview anticipated scopes and connection requirements without initiating OAuth.
- Present Connect Link approval requests to stakeholders via chat after coverage validation.
- Call `client.toolkits.authorize()` for each approved toolkit, share `redirect_url` with stakeholders, and await `.wait_for_connection()` before proceeding to planning.
- Log all granted scopes and connection metadata for validator reconciliation.
- Emit `composio_discovery` and `composio_auth_flow` events for dashboarding and summarize gaps in chat.

**Planner Responsibilities (Plan & Approve Stage):**
- Receive established connections from Inspector with validated scopes.
- Assemble mission plays (playbooks) based on tool usage patterns, data investigation output, library precedent, and sequencing/resource annotations inherited from mission context.
- Focus on play ranking, safeguard attachment, and undo plan validation—not OAuth flows.
- Confirm validator-specified scopes are satisfied against Inspector's approved connections and log confirmations via chat checklist items.
- Stream ranked plays to chat with confidence scores, rationale, and safeguard summaries.

**Executor Responsibilities:**
- Use provider adapters (preferred) or `client.tools.execute()` for bespoke actions, passing trimmed toolsets from `client.tools.get(..., limit=6)`.
- Stream results to CopilotKit, collect undo hints, and append to evidence store; chat emits evidence cards as each step finalizes.
- Emit `composio_tool_call` (and `composio_tool_call_error` on failures) telemetry for every execution with status + latency; the chat thread links directly to the relevant telemetry entry.

**Validator Responsibilities:**
- Preflight each action against safeguard constraints; chat surfaces blocking issues with suggested fixes.
- Auto-fix parameter issues when possible; otherwise block and return feedback with inline annotations.
- Post-check outputs for compliance (PII, brand tone, budgets) and drop verdict badges inside the chat timeline.

**Evidence Responsibilities:**
- Snapshot approval trail, tool responses (redacted), safeguards, undo steps.
- Hash artifacts (SHA-256) and store under `docs/readiness` per mission; chat adds the artifact hash + download link for context.

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
