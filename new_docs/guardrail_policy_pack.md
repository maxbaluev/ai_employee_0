# Guardrail Policy Pack (Agent-Facing)

This pack operationalises the governance principles in `new_docs/architecture.md` (Sections 2, 4.3, 6) for autonomous agents. It establishes machine-checkable policies and references external documentation from `libs_docs/` to inform enforcement logic. Guardrail implementations should live in `agent/guardrails/` with corresponding frontend enforcement in `src/app/(control-plane)/` components and API routes.

## 1. Quiet Hours & Timing Controls
- **Global Window:** 22:00–06:00 local tenant time → no outbound sends without explicit override.
- **Override Path:** Request `quiet_hour_override` flag via CopilotKit approval modal; store decision in Supabase `approvals` table (`quiet_hour_override = true`).
- **Implementation:** Validator Agent checks tool call timestamps before execution. If breach detected, raise `interrupt` with options: `reschedule`, `request_override`, `cancel`.
- **Reference:** Supabase cron tutorial (`libs_docs/supabase/llms_docs.txt`) for scheduling recurring jobs when overrides are granted.

## 2. Rate Limits & Throughput
- **Default Envelope:**
  - CRM toolkits (Composio) → 60 calls/hour per tenant.
  - Collaboration toolkits (Slack, email drafts) → 120 calls/hour per tenant.
  - Research fetchers → 180 calls/hour shared across tenants.
- **Mechanism:** Executor agents must annotate each call with `rate_category`; runtime counter (Supabase function) enforces caps and emits warnings at 80% utilisation.
- **Backoff Strategy:** Follow Composio retry guidance (`libs_docs/composio/llms.txt` — rate hints); use exponential backoff with jitter (base 2, cap 5 retries) for `rate_limited` errors.

## 3. Tone & Content Policies
- **Allowed Voice:** Professional, action-oriented, brand-safe. No negative sentiment unless user explicitly requests.
- **Checks:**
  - Validator Agent runs sentiment and compliance evaluation prior to mutating sends.
  - If tone check fails, re-route to CopilotKit for human approval or prompt revision loops.
- **Escalation:** For high-risk communications (finance/legal), require dual approval (Governance Sentinel + tenant approver). Document scoreboard in `governed_activation_report.csv`.
- **Reference:** CopilotKit messaging best practices (`libs_docs/copilotkit/llms-full.txt`) for human-in-the-loop checkpoints.

## 4. Credential & OAuth Safety
- **Token Storage:** All tokens encrypted and stored in Supabase `oauth_tokens` table; never expose raw tokens to LLM contexts.
- **Scope Minimalism:** When Composio AgentAuth requests scopes, default to minimal set for each toolkit; escalate to human if broader scopes needed.
- **Rotation:** Schedule Supabase Edge Function to refresh tokens every 24 hours or upon `auth_expired` responses.
- **Audit Trail:** Log every token refresh and revocation event in `tool_calls` (type=`oauth_maintenance`).

## 5. Evidence & Undo Guarantees
- **Undo Requirement:** Any mutating tool call must produce inverse instruction stored in Supabase `tool_calls.undo_plan`.
- **Preview:** Before execution, CopilotKit surfaces summary + undo outline; human confirmation required unless autopilot window authorised.
- **Rollback Flow:** Evidence Agent executes or hands off undo plan if `cancel` chosen post-action. All results appended to `artifacts` table.

## 6. Data Handling & Privacy
- **PII Redaction:** Replace emails, phone numbers, and addresses in prompt payloads with anonymised tokens. Maintain mapping in secure storage; expiry 30 days unless renewed.
- **Logging:** Truncate arguments in logs beyond 512 characters; mask secrets.
- **Exports:** Use Supabase audit exports for compliance; align with Supabase Auth docs (`libs_docs/supabase/llms_docs.txt`).

## 7. Approval Workflow Mechanics
- **Default State:** All destructive actions require human approval. Non-destructive drafts auto-approve but still log event.
- **CopilotKit Integration:** Use `interrupt()` nodes with `risk_summary`, `expected_outcome`, `undo_plan` fields. Approvals recorded in `approvals` table with `decision`, `rationale`.
- **Batching:** If >5 similar approvals queued, Governance Sentinel may batch them while ensuring each action retains traceability.

## 8. Incident Response Protocol
- **Trigger Conditions:**
  - Repeated guardrail breach (≥3 in rolling 24 hours).
  - P1 incident (e.g., unauthorised send, data leak risk).
- **Actions:** Create incident record, notify human stakeholder via CopilotKit + Composio Slack integration, pause affected workflows, prepare remediation plan.
- **Documentation:** Update `stabilisation_digest.md` with incident details.

## 9. Compliance Mapping
- **SOC 2:** Logins, approvals, and data changes audit-ready via Supabase; maintain evidence in `trust_review.pdf`.
- **GDPR:** Support export/delete requests by referencing Supabase Auth + Edge Functions; record completion in `compliance_requests` table.
- **Provider ToS:** Adhere to Composio tool usage guidelines; avoid scraping or unsupported automation.

## 10. Maintenance Hooks
- Review guardrail parameters quarterly or upon partner API changes.
- Sync Composio cookbook updates weekly; update allowed toolkits list accordingly.
- Store current policy version in Supabase `guardrail_policies` table with effective timestamp and changelog.

This pack enables enforcement of governance without relying on human scheduling, ensuring agents apply uniform controls across dry-run and governed modes.
