# Professional AI Programmer Playbook — Authentication Overhaul

**Persona:** Jordan Nakamura (Founder & Solo Technical Lead)  
**Industry:** Early-Stage B2B SaaS  
**Mission Date:** October 16, 2025  
**Time to Value:** 2 hours 18 minutes (Home → Reflect)  
**Outcome:** Authentication stack refactored, 3 critical bugs fixed, 127 unit tests passing, zero-downtime deploy validated

---

## Journey Snapshot

`Home → Define → Prepare → Plan → Approve → Execute → Reflect`

| Stage | What Jordan Experiences | Telemetry Highlights |
| --- | --- | --- |
| **Home** | Engineering dashboard flags auth instability with amber readiness badge (“Needs auth: Vercel deploy token”). Mission tile previews open TODOs and validator reminders from last security fix. | `home_tile_opened`, `readiness_badge_rendered`, `alert_rail_viewed` |
| **Define** | Intent captures “Refactor auth for session stability + CSRF protection.” Jordan adds safeguards for zero downtime and mandatory code review. Chips stay readable (Objective, Scope, KPIs, Safeguards, Timeline) until he locks the brief. | `intent_submitted`, `brief_generated`, `safeguard_added`, `mission_brief_locked` |
| **Prepare** | Tool cards clarify scopes: **GitHub** (branch + PR), **Supabase** (inspect auth tables), **Linear** (update issues), **Vercel** (deploy). Inline connect link grabs Vercel token; readiness badge flips green. Code explorer preview highlights auth modules with failing tests. | `toolkit_recommended`, `toolkit_connected`, `composio_auth_flow`, `data_preview_generated` |
| **Plan** | Best Plan “Phased Auth Hardening” outlines five phases (Diagnostics → Token lifecycle → CSRF → Error handling → Deploy). Alternatives collapse (e.g., “Hotfix only” flagged risky). Plan card summarises undo window per phase and required approvals. | `planner_candidate_generated`, `plan_ranked`, `plan_adjusted` |
| **Approve** | CTO review required for safeguards touching auth. Approval sheet packages diff summary, safeguards, undo (feature flag rollback), outstanding scopes (none). CTO approves asynchronously; note logged. | `approval_requested`, `approval_granted`, `audit_event_recorded` |
| **Execute** | Live checklist maps to the five phases. Alert rail surfaces two flaky integration tests; validator proposes retries with recorded seed. Undo banner offers 20-minute rollback for each deployment step. | `execution_started`, `execution_step_completed`, `validator_alert_raised`, `undo_available` |
| **Reflect** | Outcome snapshot: “Token bug fixed · CSRF enforced · 127 tests green · 0 downtime.” Evidence gallery stores diff, CI run, canary logs. Feedback drawer captures 5★ rating and request for automated dependency diff. | `mission_completed`, `evidence_opened`, `feedback_submitted`, `library_contribution` |

---

## Stage Detail

### Home — Engineering Overview
- Readiness badge calls out missing deploy token before work starts.
- Alert rail surfaces validator reminders (e.g., “Regenerate canary link after deploy”).

### Define — Technical Charter
- Intake prompt includes module-level suggestions (auth middleware, session refresh, CSRF) drawn from repo telemetry.
- Jordan adds safeguard “Roll back via feature flag within 5 minutes if canary fails,” reinforcing undo-first mindset.

### Prepare — Tools & Context
- GitHub card promotes scratch branch with direct link; Supabase card offers schema diagram + sample sessions.
- Vercel connect link describes scopes plainly (“Create preview deploys, promote to production”). Token stored with mission metadata.
- Data preview highlights failing Jest suites and open Linear tickets so Jordan can prioritise.

### Plan — Phased Blueprint
- Best plan details five phases, each with expected duration and success criteria:
  1. Diagnostics & logging improvements
  2. Refresh token lifecycle rewrite
  3. CSRF middleware rollout
  4. Error-handling consolidation
  5. Canary + production deploy
- Alternatives remain collapsed but note trade-offs (“Ship hotfix only — fastest, highest risk”).
- Adjustments let Jordan toggle test depth (smoke vs. full) and choose deploy cadence; he keeps “Full test suite” and “Canary + auto promote.”

### Approve — Governance Alignment
- CTO sees read-only summary with diffs, safeguards, undo path. Approval captured alongside justification (“Required for SOC 2 findings”).
- Approval record feeds Supabase audit log and fuels later compliance reporting.

### Execute — Guided Engineering Run
- Live checklist integrates GitHub + CI status; each step can expand into logs when needed.
- Validator monitors lint/test output, auto-runs retries with captured seed, and flags any dependency upgrades.
- Undo banner persists until Jordan finalises; rollbacks are per phase via feature flag or GitHub revert.

### Reflect — Ship, Learn, Document
- Outcome card summarises metrics; evidence gallery includes merged PR, CI artifacts, deploy logs.
- Follow-up checklist queues docs update, security notification, and next sprint retrospective note.
- Feedback + missions library entry help other engineers reuse the phased approach.

---

## Mission Results

| Metric | Value |
| --- | --- |
| Bugs resolved | 3 production-auth incidents closed |
| Test coverage | 92% (up from 86%) |
| Deployment impact | 0 downtime; canary promoted automatically |
| Effort saved vs. solo manual | ≈4 hours |
| Library impact | “Phased Auth Hardening” play tagged for engineering reuse |

### Signals to Carry Forward
- Plain-language scope cards speed up complex tool authorisations.
- Phased live checklist keeps deep engineering work legible for stakeholders.
- Persisting undo paths (feature flags + Git rollback) maintain risk tolerance even in high-stakes deploys.

