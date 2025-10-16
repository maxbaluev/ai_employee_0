# Support Operations Playbook — High-Priority Ticket Triage

**Persona:** Sam Martinez (Support Operations Lead)  
**Industry:** Enterprise Healthcare SaaS  
**Mission Date:** October 16, 2025  
**Time to Value:** 19 minutes (Home → Reflect)  
**Outcome:** 47 high-priority tickets triaged, 12 draft responses ready, 3 escalations routed

---

## Journey Snapshot

`Home → Define → Prepare → Plan → Approve → Execute → Reflect`

| Stage | What Sam Experiences | Telemetry Highlights |
| --- | --- | --- |
| **Home** | Surge alert tile pulses amber; readiness badge warns “Needs auth” for Zendesk. Live checklist shows SLA countdown for six tickets. | `home_tile_opened`, `readiness_badge_rendered`, `alert_rail_viewed` |
| **Define** | Intent banner captures “Triage critical API auth tickets <4h old” and generates objective, audience, KPI, safeguard lines. Sam adds “Empathetic, non-technical responses” safeguard, locks brief in one surface. | `intent_submitted`, `brief_generated`, `safeguard_added`, `mission_brief_locked` |
| **Prepare** | Tool cards clarify scopes: **Zendesk** (read/comment), **Confluence** (read KB), **Slack** (notify #eng-oncall). Zendesk OAuth cleared in-line; Confluence stays no-auth; Slack already green. Data preview highlights duplicate incidents + VIP accounts. | `toolkit_recommended`, `composio_auth_flow`, `toolkit_connected`, `data_preview_generated` |
| **Plan** | Best Plan card “High-Touch SLA Sweep” lists steps, effort, undo window. Alternatives collapse (“Batch close” flagged as risk). Alert rail warns 6 tickets are inside 90-minute SLA; checklist auto-prioritises them. | `planner_candidate_generated`, `plan_ranked`, `plan_adjusted`, `sla_alert_created` |
| **Approve** | Summary spotlights affected customers, safeguards, undo plan, and required scopes. Sam routes approval to regional manager; manager approves via link, note logged automatically. | `approval_requested`, `approval_granted`, `audit_event_recorded` |
| **Execute** | Live checklist runs `Categorise`, `Draft responses`, `Escalate`. Alert rail surfaces two tickets missing KB links—Sam clicks “Fix” to attach article. Undo banner promises 15-minute rollback on comments. | `execution_started`, `execution_step_completed`, `validator_alert_raised`, `undo_available` |
| **Reflect** | Outcome snapshot: “47 tickets triaged · 12 drafts ready · 0 SLA breaches · 2h saved.” Evidence gallery contains triage board, validator report, Slack transcript. Feedback drawer captures 4★ (“Add customer sentiment tag”), tasks push to follow-up queue. | `mission_completed`, `evidence_opened`, `feedback_submitted`, `task_created` |

---

## Stage Detail

### Home — Mission Launcher
- Surge badge + amber readiness icon nudge Sam into the mission immediately.
- Live checklist previews SLA clock, helping her reserve time before breaches occur.

### Define — Intent & Safeguards
- Conversational intake with persona tips (Support, Compliance) ensures Sam includes empathy and SLA targets.
- Safeguard checklist defaults to “Use verified KB” and “No jargon”; Sam keeps both.

### Prepare — Tools & Data
- OAuth flows use plain-language scope descriptions (“Comment on tickets on Sam’s behalf”).
- Data preview clusters similar incidents, marks VIP orgs, and visualises queue age to keep priorities straight.

### Plan — Best Plan First
- Primary plan emphasises quick high-touch sweeps; alternatives are collapsed but available for edge cases.
- SLA alerts inject urgency, and adjustments allow Sam to tune batch size or escalation thresholds without leaving the stage.

### Approve — Distributed Review
- Regional manager signs off in read-only approval view; comments captured for audit.
- Approval screen reiterates undo path and outstanding scopes (none after Zendesk auth), aligning with governance expectations.

### Execute — Calm Control
- Live checklist plus alert rail means Sam sees only the exceptions that need human input.
- Validator auto-adjusts tone where drafts drift too technical; Sam can accept or override within the same surface.
- Undo banner remains sticky for 15 minutes in case new information appears.

### Reflect — Close the Loop
- Outcome snapshot quantifies SLA wins and time saved; evidence gallery supports post-incident review.
- Feedback + follow-up checklist push improvements into backlog (“Enrich KB with API auth workaround”).

---

## Mission Results

| Metric | Value |
| --- | --- |
| Tickets triaged | 47 high-priority cases |
| Draft responses prepared | 12 personalised replies (validator-friendly tone) |
| Escalations triggered | 3 routed to #eng-oncall with context packs |
| SLA breaches | 0 (six at risk resolved) |
| Effort saved vs. manual | ≈2 hours |

### Signals to Carry Forward
- Readiness + alert rail let Sam act before SLA breaks.
- Best-plan-first limited cognitive load in the busiest window of the week.
- Live checklist + undo banner provided oversight without inviting log fatigue.

