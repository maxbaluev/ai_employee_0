# AI Employee Control Plane — Guardrail Policy Pack (October 8, 2025)

## 1. Purpose & Scope
This policy pack defines the non-negotiable guardrails the AI Employee Control Plane must enforce from Gate G-A through Gate G-C. The guardrails govern every mission run, whether in dry-run proof or governed activation mode, and apply to all personas (revenue, marketing, support, finance, technical enablement). Coding agents should treat these rules as canonical requirements when building UI flows, Gemini ADK validators, Supabase policies, Composio integrations, or evidence exports.

Guardrails are classified into five categories:

| Guardrail | Intent | Primary Enforcement Surfaces | Owner |
| --- | --- | --- | --- |
| Tone & Brand Safety | Prevent off-brand, abusive, or non-compliant copy | ADK Validator, CopilotKit approval UI | Governance Sentinel |
| Quiet Hours & Send Windows | Block sends during restricted hours per tenant | Supabase schedule store, Validator, Approval overrides | Governance Sentinel |
| Rate Limits & Budget Caps | Prevent tool throttling and runaway spend | Supabase metrics, Validator, Evidence agent | Runtime Steward |
| Credential & Scope Control | Ensure least privilege and scoped OAuth usage | Composio auth flows, Supabase token vault, Validator | Runtime Steward |
| Undo & Incident Readiness | Guarantee reversibility for every mutating action | Evidence service, CopilotKit UI, Supabase audit tables | GTM Enablement Lead |

## 2. Canonical Guardrail Configuration Model
Guardrails are described per tenant and optionally per mission. Configuration state lives in Supabase tables and is injected into the ADK session state once a mission is created.

### 2.1 Supabase Schema (excerpt)
```sql
create table guardrail_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references auth.users(id) not null,
  label text not null,
  tone_policy jsonb not null default '{"forbidden": [], "required": ["professional"]}',
  quiet_hours jsonb not null default '{"start": 20, "end": 7, "timezone": "UTC"}',
  rate_limit jsonb not null default '{"per_hour": 30, "burst": 10}',
  budget_cap jsonb not null default '{"currency": "USD", "max_cents": 5000, "period": "daily"}',
  undo_required boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table guardrail_profiles enable row level security;
create policy "guardrails are tenant scoped" on guardrail_profiles
  for all using ( tenant_id = auth.uid() )
  with check ( tenant_id = auth.uid() );

create table mission_guardrails (
  mission_id uuid references objectives(id) on delete cascade,
  guardrail_profile_id uuid references guardrail_profiles(id),
  custom_overrides jsonb,
  effective_at timestamptz default now(),
  primary key (mission_id, guardrail_profile_id)
);
```

### 2.2 Runtime JSON Contract
Gemini ADK validators and CopilotKit components must rely on a consistent runtime payload. The Coordinator agent loads the merged configuration into `ctx.session.state['guardrails']` using this type:

```typescript
export interface GuardrailConfig {
  tonePolicy: {
    forbidden: string[]; // phrases that cannot appear
    required?: string[]; // words/sentiments that must appear
    escalationChannel?: 'governance' | 'legal';
  };
  quietHours: {
    start: number; // 0-23 hour in tenant timezone
    end: number;
    timezone: string;
    overrideProcedure: 'manual_approval' | 'auto_resume';
  };
  rateLimit: {
    perHour: number;
    burst: number;
    toolkitScopes?: Record<string, number>; // overrides per toolkit slug
  };
  budgetCap: {
    currency: string;
    maxCents: number;
    period: 'daily' | 'weekly' | 'mission';
  };
  undo: {
    required: boolean;
    windowMinutes: number;
    handler: 'evidence_service' | 'manual_playbook';
  };
  escalationContacts: {
    primary: string;
    secondary?: string;
  };
}
```

## 3. Enforcement Surfaces
Guardrail logic must fire in multiple layers to guarantee deterministic behavior.

### 3.1 CopilotKit (Frontend)
- Persist guardrail metadata in mission state so reviewers see the active policy for each mission.
- Implement the guardrail summary card, approval modal, and override interactions as described in `new_docs/ux.md` to ensure consistent language, layout, and accessibility.
- When a violation occurs, render an interrupt modal with: violation type, evidence, and the exact policy clause, leveraging the "Approval Required" UX pattern.
- All approval decisions must write `approvals.decision` and `approvals.guardrail_violation` in Supabase and emit the telemetry events defined in the UX instrumentation catalog (`approval_required`, `approval_decision`, `guardrail_override_requested`).
- Generated guardrail suggestions must cite the originating policy clause and include a confidence score; accepting or editing the suggestion logs an entry in `guardrail_suggestions` (see §5).

### 3.2 Gemini ADK Validator Tree
- The `ValidatorAgent` reads `ctx.session.state['guardrails']` and returns `validation_passed` or `validation_failed` with `violation_details`.
- Implement reusable helper functions:
  - `check_quiet_hours(datetime, guardrail_config)`
  - `check_rate_limit(toolkit, metrics, guardrail_config)`
  - `check_tone(text, guardrail_config)` (prompt an LLM if regex fails)
  - `check_budget(spend, guardrail_config)`
- When `validation_failed` is set, the Coordinator must raise a `CopilotInterrupt` event with remediation instructions.

### 3.3 Supabase Policies & Jobs
- `tool_calls` table triggers should enforce quota metrics (update hourly aggregates in `tool_call_metrics`).
- `pg_cron` job runs nightly to validate quiet-hour windows and pre-compute the next allowable send slot per mission.
- Edge Function `/guardrails/refresh` recomputes effective guardrail payloads when governance teams update a profile.

### 3.4 Composio Integrations
- During OAuth (`toolkits.authorize`), filter requested scopes against guardrail policy. Reject connects exceeding allowed scopes and log the attempt.
- On execute, include guardrail metadata as structured context to the LLM so the agent reasons about constraints before issuing tool calls.

## 4. Override & Escalation Workflow
When a user attempts a prohibited action (see override flow visuals in `new_docs/ux.md §7.2`):

1. Validator sets `validation_failed` with violation metadata.
2. CopilotKit raises an interrupt and displays the violation modal.
3. Reviewer options:
   - **Reschedule:** Provide new timestamp; CopilotKit writes to `tool_calls.scheduled_for` and records override rationale.
   - **Request Override:** Provide justification; CopilotKit posts to `/api/guardrails/override`. This API:
     - Writes to `guardrail_overrides` table with expiry and reviewer ID.
     - Notifies Governance Sentinel via webhook (Slack or email).
     - Returns `override_token` used by ADK to temporarily bypass the guardrail.
   - **Cancel:** Mission status becomes `blocked_guardrail`; Evidence agent records the decision.
4. Evidence agent appends override decisions to the mission evidence bundle.

Override requests expire automatically via `pg_cron`. Missions cannot promote to Gate G-C while outstanding overrides are unresolved.

## 5. Evidence & Telemetry Requirements
Every guardrail evaluation must produce auditable evidence.

- `tool_calls.guardrail_snapshot` (jsonb) stores the guardrail payload used at execution time.
- `guardrail_incidents` table tracks each violation: type, severity, resolution, override token, reviewer.
- Analytics view `analytics_guardrail_incidents` aggregates incidents per tenant and persona.
- `guardrail_suggestions` table logs every generated recommendation, confidence score, user action (accepted/edited/rejected), and resulting policy diff.
- `docs/readiness/guardrail_reports/<gate>.md` should contain narrative summaries for each checkpoint review. Governance dashboards that surface these metrics must follow the layout and filters documented in `new_docs/ux.md §8.3`.

Telemetry metrics (publish via Supabase Realtime and dashboards):

| Metric | Definition | Source |
| --- | --- | --- |
| `guardrail_incidents_per_mission` | Count of violations per mission | `guardrail_incidents` view |
| `override_rate` | Overrides / total approvals | Approvals table |
| `mean_time_to_override_close` | Duration between override request and closure | `guardrail_overrides` |
| `undo_success_rate` | Undo completed / undo initiated | Evidence service logs |
| `guardrail_suggestion_accept_rate` | Accepted suggestions / total suggestions | `guardrail_suggestions` |

## 6. Testing & Verification
- **Unit tests:** Validators must include tests for tone, quiet hour boundaries, rate caps, and undo requirements. Use compiled guardrail fixtures from this doc.
- **Integration tests:** Simulate mission runs with guardrail edge cases (e.g., tone violation, midnight quiet hours) via `adk eval` scenarios.
- **UI tests:** Using Playwright or Cypress, confirm CopilotKit modals render guardrail text and that overrides persist to Supabase.
- **Generative suggestion tests:** Validate that guardrail suggestions include correct policy references, confidence scores, and logging when users accept, edit, or reject them.
- **Load tests:** Ensure guardrail checks add <200ms p95 latency during governed activation.

## 7. Incident Response
1. Evidence agent automatically files an entry in `guardrail_incidents` when a violation reaches `severity = 'blocking'`.
2. Governance Sentinel triages within 1 business day, coordinating with Runtime Steward for remediation.
3. For repeated incidents of the same type (>3 within 7 days), freeze governed activation and revert missions to dry-run.
4. Document root cause and mitigation in `docs/readiness/guardrail_reports/latest.md` and reference in Gate review.

## 8. Reference Implementations
- `src/app/api/guardrails/validate/route.ts` — request-time enforcement (see architecture.md §4.3).
- `agent/agents/control_plane.py:ValidatorAgent` — ADK validator logic.
- `src/app/components/ApprovalModal.tsx` — guardrail interrupts surfaced to reviewers.
- `new_docs/ux.md §7` — guardrail summary, override, and incident log UX patterns.
- `supabase/migrations/20250108_guardrails.sql` — application of the schema above.

## 9. Change Management Checklist
- Update this policy pack and bump the `guardrail_profiles.version` column when policies change.
- Regenerate `docs/readiness/status_beacon_<gate>.json` with the new guardrail readiness state.
- Notify GTM and governance stakeholders via weekly ops sync.

This pack must remain in sync with the architecture blueprint, UX blueprint, and checkpoint control plan. No guardrail relaxations are permitted without Governance Sentinel approval and revised evidence artifacts.
