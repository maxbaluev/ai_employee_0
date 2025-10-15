# Composio SDK: Unified Toolkit Execution Interface

**Date:** 2025-10-15 (Native SDK Clarification)
**Objective:** Document how the AI Employee Control Plane standardizes on the native Composio SDK for discovery, authentication, governed execution, and telemetry across the progressive trust model.

---

## Executive Summary

The control plane now relies exclusively on the **Composio SDK**. Inspector, Planner, Executor, Validator, and Evidence agents all share a single Composio workspace that exposes catalog discovery, Connect Link–based authentication, provider adapters, triggers, and audit telemetry. The native SDK removes the legacy router layer, shortens execution paths, and gives us first-class observability via structured events.

Key outcomes:

- **Progressive Trust Alignment:** No-auth inspection stays read-only, OAuth happens during Plan & Approve via Connect Links, and governed execution streams through provider adapters while validator safeguards run pre/post checks.
- **Governed Auth:** Scopes are mission-scoped through Connect Links, persisted in Supabase, and reconciled against validator requirements before execution.
- **Unified Telemetry:** Every discovery, auth, and tool call emits `composio_discovery`, `composio_auth_flow`, `composio_tool_call`, and `composio_tool_call_error` events tagged with mission, tenant, toolkit, and action metadata.
- **Operational Simplicity:** Runbooks, dashboards, and quotas now focus on three canonical flows instead of six meta-tools. The SDK exposes consistent error codes (`RATE_LIMIT`, `AUTH_EXPIRED`, `TOOLKIT_NOT_FOUND`) with actionable context.

---

## Why the Native SDK?

### 1. Simplified Agent Architecture

```
User Request
  ↓
Inspector → ComposioClient.tools.search()
  ↓
Planner → toolkits.authorize() → Connect Link
  ↓
Stakeholder Approval
  ↓
Executor → provider.handle_tool_calls(...)
  ↓
Validator & Evidence → audit + triggers
```

- **Single decision path:** Agents no longer branch between meta-tools and per-tool servers.
- **Shared context:** `user_id` + `tenantId` propagate through every call via `composio.createSession({ headers: { "x-tenant-id": tenantId } })` (TS) or `provider.session(user_id=..., tenant_id=...)` (Py); we log these fields for audits.
- **Provider abstraction:** Anthropic, Gemini, OpenAI, LangChain, CrewAI, and Vercel adapters consume identical payloads produced from mission plans.

### 2. Governed Authentication

- **Connect Links:** Generated with `client.toolkits.authorize()`; include mission/tenant metadata, expiry windows, and an async `wait_for_connection()` handshake before execution.
- **Custom Auth Configs:** For bespoke scopes, call `client.connected_accounts.link()` / `.status()` against specific auth configs while preserving mission metadata.
- **Approval evidence:** Stored in Supabase (`mission_connections` table) with granted scopes, timestamps, and validator sign-off.
- **Revocation:** Managed through `client.connected_accounts.revoke()` during mission closeout or tenant offboarding.
- **Principle:** Executors never initiate new OAuth—Plan & Approve is the only stage allowed to request scopes.

### 3. Observability & Telemetry

- **Events:**
  - `composio_discovery` — catalog queries, includes `query`, `result_count`, `latency_ms`.
  - `composio_auth_flow` — Connect Link status changes (`initiated`, `approved`, `revoked`).
  - `composio_tool_call` — execution result (`status`, `latency_ms`, `toolkit`, `action`, `error_code`).
- **Dashboards:** Integration Health dashboard plots success/error rates, Connect Link completion, and per-toolkit volume.
- **Alerts:**
  - Error rate >10% per toolkit triggers degradation warning.
  - Consecutive `AUTH_EXPIRED` events escalate to Plan & Approve to re-request scopes.
  - Spikes in `RATE_LIMIT` trigger Runbook 4 (see Operations section).

### 4. Operational Efficiency

- **Caching:** Discovery responses cached 60 minutes per mission theme; invalidated on toolkit updates.
- **Triggers & Workflows:** Long-running actions (bulk email, exports) move to `client.triggers` so Executor threads remain responsive.
- **Undo Plans:** `client.audit.list_events()` supplies action payloads and undo hints for each tool call. Evidence bundler persists them alongside artifacts.

---

## Progressive Trust Alignment

| Trust Stage            | Composio SDK Interaction                          | Mission Artifacts Generated                                   |
| ---------------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| **No-Auth Inspection** | `client.tools.search()` + schema previews         | Coverage reports, anticipated scopes, risk notes               |
| **Plan & Approve**     | `toolkits.authorize()` + validator checks         | Approved scopes, Connect Link URL, safeguard matrix           |
| **Governed Execution** | Provider adapters / `client.tools.execute()`      | Tool outputs, undo hints, telemetry traces, evidence bundles   |
| **Reflect & Improve**  | `client.audit.list_events()` + triggers workflows | Post-mission analytics, play updates, Supabase readiness logs  |

**Inspector Responsibilities:**
- Run discovery queries and compute coverage percentage.
- Flag missing toolkits and projected mission risk.
- Emit `composio_discovery` events for dashboarding.

**Planner Responsibilities:**
- Package recommended toolkits and safeguards.
- Call `client.toolkits.authorize()` for each toolkit, share `redirect_url` with stakeholders, and await `.wait_for_connection()` before handing off to Executor.
- Once approved, confirm validator-specified scopes are satisfied.

**Executor Responsibilities:**
- Use provider adapters (preferred) or `client.tools.execute()` for bespoke actions, passing trimmed toolsets from `client.tools.get(..., limit=6)`.
- Stream results to CopilotKit, collect undo hints, and append to evidence store.
- Emit `composio_tool_call` (and `composio_tool_call_error` on failures) telemetry for every execution with status + latency.

**Validator Responsibilities:**
- Preflight each action against safeguard constraints.
- Auto-fix parameter issues when possible; otherwise block and return feedback.
- Post-check outputs for compliance (PII, brand tone, budgets).

**Evidence Responsibilities:**
- Snapshot approval trail, tool responses (redacted), safeguards, undo steps.
- Hash artifacts (SHA-256) and store under `docs/readiness` per mission.

---

## Operational Guardrails

### Access & Credentials

- `COMPOSIO_API_KEY` scoped to mission-tier workspace.
- API key rotated quarterly or upon incident via Composio dashboard.
- Supabase stores mission-level Connect Link metadata for audit reconciliation.
- Executors run with least privilege—mission-specific scopes only.

### Rate Limiting & Backoff

- Default exponential backoff: 1s → 2s → 4s → 8s (max 5 attempts).
- Circuit breaker trips after three consecutive failures per toolkit.
- Mission-level quotas prevent a single tenant from exhausting all capacity.

### Data Residency & Privacy

- Tool responses redacted before storage; use `src/lib/telemetry/redaction.ts` for telemetry payloads.
- Audit events stored for 180 days; extendable via Supabase retention policies.
- Connect Link metadata excludes sensitive tokens; only scope + account alias stored.

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

### Runbook Snapshot

1. **Runbook 1 – Discovery Failure:**
   - Symptom: `composio_discovery` error rate >5%.
   - Fix: Refresh catalog cache, verify Composio status, degrade gracefully with fallback playbooks.
2. **Runbook 2 – Connect Link Stuck:**
   - Symptom: `composio_auth_flow` stuck in `initiated` >30 minutes.
   - Fix: Ping stakeholder, resend link, verify scopes still valid, escalate to partner success.
3. **Runbook 3 – Auth Expired Mid-Mission:**
   - Symptom: `composio_tool_call` errors with `AUTH_EXPIRED`.
   - Fix: Mark mission paused, route to Plan & Approve for re-approval, re-run validator before resuming.
4. **Runbook 4 – Rate Limit Exceeded:**
   - Symptom: Consecutive `RATE_LIMIT` statuses.
   - Fix: Trigger throttling, redistribute workload, open quota request with Composio, monitor backlog size.

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
- [ ] Telemetry dashboards configured for discovery/auth/execution funnels.
- [ ] Alerts configured for rate limit, auth expiry, and discovery degradation thresholds.

---

## Migration Note

- 2025-10-15: Router middleware removed; native Composio SDK adopted across all stages.
- Backfilled telemetry renamed from the legacy router event to `composio_tool_call`, with historical mapping maintained in analytics.
- Runbooks, documentation, and readiness evidence updated to reference native SDK operations only.

---

## References

- `libs_docs/composio/llms.txt` — Curated Composio documentation index (Quickstart, Providers, Authenticating Tools, Executing Tools, Triggers, Dashboard guides).
- `docs/04_implementation_guide.md` — Code-level integration patterns using the SDK.
- `docs/07_operations_playbook.md` — Operational runbooks and telemetry metrics.
- `docs/09_release_readiness.md` — Evidence expectations prior to launch.
- `AGENTS.md` — Onboarding reference for Inspector/Planner/Executor responsibilities.
