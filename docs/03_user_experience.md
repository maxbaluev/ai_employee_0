# AI Employee Control Plane — User Experience Playbook

**Version:** 5.0 (October 16, 2025)
**Audience:** Product design, UX engineering, product operations, GTM enablement
**Purpose:** Give the teams building the Control Plane a crisp, user-first playbook that keeps missions fast, legible, and lovable for business stakeholders.

---

## What This Document Delivers

- A light yet complete end-to-end journey for missions run by RevOps, Support, and Governance leaders (see `docs/examples/*`).
- Stage-by-stage guardrails that emphasise speed to value, trust cues, and enterprise safety.
- Textual wireframe sketches that communicate intent without locking in visuals.
- Microcopy, accessibility, and telemetry expectations that keep the experience inclusive and measurable.

---

## Where We Improved the Previous Blueprint

| Previous Gap                                           | Why It Hurt                                     | How This Playbook Fixes It                                                                |
| ------------------------------------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Dense simultaneous panels and jargon-heavy copy        | Business users stalled before discovering value | One-surface-at-a-time layout, plain language, contextual help baked into every stage      |
| Precision UI (gauges, chip stacks) without explanation | False confidence, slow approvals                | Binary readiness badges, short checklists, inline rationale, progressive disclosure       |
| Approvals assumed same-user flow                       | Broke enterprise review chains                  | Request/assign approval workflow with read-only snapshot and reminders                    |
| Execution logs overwhelmed non-technical users         | Adoption risks for support & exec personas      | Live checklist as default, rich logs tucked in optional drawer, alerts summarised clearly |

---

## Primary Personas at a Glance

- **Riley Chen — Revenue Expansion Lead** (docs/examples/revops.md): needs reactivation missions live in <15 minutes, cares about coverage and outreach tone.
- **Sam Martinez — Support Operations Lead** (docs/examples/support_leader.md): wants triage relief inside SLA windows, prioritises duplicate control and escalation clarity.
- **Gabriela Torres — Governance Officer** (docs/examples/compliance_audit.md): ensures safeguards are honoured, approvals auditable, and undo plans bulletproof.

Executives and platform admins consume mission summaries and evidence but rarely drive the flow. The experience must respect their need for clarity without overwhelming the primary operators.

---

## Design Guardrails

1. **Fast path to value:** default to templates, pre-filled choices, and optimistic transitions; first plan should appear in under three minutes.
2. **Plain language everything:** surface technical context (Composio scopes, Supabase lineage) only when required for trust.
3. **One primary action per stage:** supporting panels collapse to smart summaries until expanded.
4. **Progressive trust:** inspection → connection → action. No tool call executes without visibility and an undo plan.
5. **Accessibility and localization are non-negotiable:** keyboard-first, screen reader labels, time zone aware outputs.
6. **Telemetry drives improvement:** every high-level interaction emits structured events for mission analytics (see `docs/06_data_intelligence.md`).

---

## Journey Map

```
Home → Define → Prepare → Plan → Approve → Execute → Reflect
        │          │       │        │         │         │
        ▼          ▼       ▼        ▼         ▼         ▼
Template or intent → Tool readiness → Ranked plays → Assignee approves → Live checklist → Outcomes & feedback
```

Each mission lives in a single responsive workspace. Stage summaries stay visible but collapsed, so the current decision is always obvious.

## Stage-Aware Copilot Surfaces

The workspace follows the CopilotKit stage-aware pattern from `libs_docs/copilotkit/llms-full.txt`, keeping each collaboration surface focused on a single decision while sharing state through CopilotKit.

| Stage                 | Copilot Surface      | What the Surface Delivers                                                                           | Primary Hooks                                                                                                                   |
| --------------------- | -------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Define**            | Mission Intake Panel | Capture intent, personas, and KPIs; stream ADK rationale chips without forcing premature locks.     | `useCopilotReadable`, `useCopilotAction`, `useCopilotAdditionalInstructions`                                                    |
| **Prepare**           | Inspection Drawer    | Show no-auth discovery, anticipated scopes, and Connect Link approvals once stakeholders consent.   | `useCopilotReadable`, `useCopilotAction`, `useCopilotChat`, `useCopilotChatSuggestions`                                         |
| **Plan & Approve**    | Approval Timeline    | Stream planner-ranked plays, highlight safeguards, and collect approvals without new OAuth prompts. | `useCopilotAction`, `useCopilotChat`, `useCopilotChatSuggestions`, `useCopilotAdditionalInstructions`, `useCopilotChatHeadless` |
| **Execute & Observe** | Live Runboard        | Mirror Composio SDK tool calls, surface intervention modals, and display undo countdowns.           | `useCopilotChat`, `useCopilotChatHeadless`, `useCopilotAction`, `useCoAgent`, `useCoAgentStateRender`                           |
| **Reflect & Improve** | Artifact Gallery     | Package evidence bundles, suggest library reuse, and gather structured feedback.                    | `useCopilotReadable`, `useCopilotAction`, `useCopilotChat`, `useCopilotChatHeadless`, `useCopilotAdditionalInstructions`        |

For hook-specific implementation notes, reference `docs/05a_copilotkit_hooks_guide.md`.

**Progressive trust guardrails:**

- Prepare surfaces attach "No credentials required" badges to inspection results and preview anticipated OAuth scopes before Connect Links launch.
- Planner and approver flows reuse validated connections; if freshness checks fail they route back to Prepare instead of reissuing prompts.
- Execution stages never request new OAuth scopes—only connection freshness—and anchor undo affordances to Composio audit events.

---

## Stage 0 — Home Overview (before missions)

**Why it matters:** Operators juggle multiple missions. They need one glance to know what requires input, where approvals are blocked, and which outcomes deserve celebration.

```
+--------------------------------------------------------------+
| Header: AI Employee • Global search • New mission button      |
+----------------------+----------------------+----------------+
| My Missions          | Approvals Waiting     | Mission Library|
| ▸ Q4 Reactivation    | ▸ Sam – Triage Plan   | ▸ RevOps       |
| ▸ Support Surge      | ▸ Gabriela – Policy   | ▸ Support      |
| ▸ Compliance Sweep   |                      | ▸ Governance   |
+----------------------+----------------------+----------------+
| Recent Outcomes (cards showing impact, time saved, owner)     |
+--------------------------------------------------------------+
```

**Key interactions**

- Mission rows surface stage, owner, next action, and readiness badge.
- Approvals card routes directly into read-only summary with approve/decline.
- Mission Library exposes curated templates per persona with time-to-value estimates.

**Telemetry**: `mission_created`, `approval_opened`, `template_selected`, `outcome_viewed`.

---

## Stage 1 — Define · Lock the Mission Brief Fast

**Business value:** flatten the intake process so Riley or Sam can articulate outcomes in conversational language and lock a brief within two minutes.

```
+--------------------------------------------------------------+
| Stage header: DEFINE • Status=Draft • Primary CTAs            |
+---------------------------+-------------------------------+
| Intent field (with        | Right rail (collapsible)      |
| persona examples)         | - Chat recap                  |
| ▸ Objective summary       | - Safeguard hints             |
| ▸ Audience line           | - Pending questions           |
| ▸ KPI line                |                               |
| Safeguard checklist       |                               |
+---------------------------+-------------------------------+
| Pinned preview (updates as chips lock)                      |
+--------------------------------------------------------------+
```

**UI essentials**

- One large intent field seeded with persona-flavoured examples from `docs/examples`.
- Inline plain-text sections for Objective, Audience, KPI, Timeline, Safeguards; convert to compact chips only after acceptance to preserve editability.
- Safeguard checklist uses defaults from Governance missions, with ability to add freeform safeguards.
- `Lock brief` CTA summarises what will freeze; soft warning if no safeguards added.

**Trust & accessibility**

- When suggestions appear, announce via polite live region (“Generated objective suggestion: ...”).
- Required fields expose inline help (“Why we need this KPI”) referencing `docs/01_product_vision.md` outcomes.
- Autosave local drafts for offline moments; re-sync with Supabase once online.

**Performance & telemetry**

- Chip suggestions appear within 3 seconds or show skeleton + “finishing up” microcopy.
- Emit `intent_submitted`, `brief_field_edited`, `mission_brief_locked`, `safeguard_added`.

---

## Stage 2 — Prepare · Make Readiness Obvious

**Business value:** remove friction around tools and data so Gabriela retains confidence while Riley avoids technical detours.

```
+--------------------------------------------------------------+
| Stage header: PREPARE • Readiness badge (Ready / Needs fix)   |
+---------------------------+-------------------------------+
| Tool cards                | Summary rail (collapsible)    |
| ▸ HubSpot — Connected     | - Outstanding blockers        |
| ▸ Gmail — Needs auth      | - Inspector notes             |
| ▸ Slack — Ready           | - Connect link history        |
| Data clarity preview (VIPs, duplicates, sample rows)        |
+--------------------------------------------------------------+
```

**UI essentials**

- Each tool card lists purpose, scopes in plain language, last validated timestamp, and a single primary action (`Connect`, `Inspect`, `Fix`).
- Readiness badge shows `Ready`, `Needs data`, or `Needs auth`; clicking reveals a short checklist.
- Data preview shows anonymised samples, duplicate clusters, and PII badges; link to `docs/06_data_intelligence.md` for scoring explanation.

**Trust & accessibility**

- Connect link modals state scopes using friendly language borrowed from `libs_docs/composio/llms.txt` terminology.
- Screen readers receive clear guidance (“Connect Gmail to draft and send email sequences”).
- All colours follow WCAG AA contrast; readiness status also encoded via iconography for colour-blind support.

**Performance & telemetry**

- First readiness assessment returns <1.5s; subsequent updates stream in.
- Emit `toolkit_recommended`, `toolkit_connected`, `readiness_status_changed`, `coverage_preview_opened`, `governance_override_requested`.

---

## Stage 3 — Plan · Highlight the Best Play First

**Business value:** surface a confident, explainable plan in under five minutes with two smart alternatives so decision-makers act quickly.

```
+-------------------------------------------------------------+
| Stage header: PLAN • Recommended play ready                 |
+--------------------------+-------------------------------+
| Card 1: Best plan        | Context rail                  |
| ▸ Outcome + impact       | - Rationale toggle            |
| ▸ Step summary           | - Similar past missions       |
| ▸ Safeguards honoured    | - Risk callouts               |
| ▸ Undo window            |                               |
| Divider: Alternatives    |                               |
| Card 2: Faster, lower risk                                |
| Card 3: Deeper, higher yield                               |
+--------------------------+-------------------------------+
| Adjustments row: scale slider • channel toggles • tone      |
+-------------------------------------------------------------+
```

**UI essentials**

- Best plan card is expanded by default with plain-language summary (“Reach 83 manufacturing CFOs over 3 days, undo available for 15 minutes”).
- Alternatives collapse into headers until expanded to avoid noise.
- Adjustments present guardrailed controls (volume, channels, tone) with instant preview.

**Trust & accessibility**

- Rationale uses bullet points referencing data gathered in Stage 2 and precedent missions.
- Safeguard summary highlights compliance items so Gabriela can approve at a glance.
- Keyboard shortcut `r` opens rationale, `c` toggles comparison table.

**Performance & telemetry**

- First plan visible <2.5s; alternatives stream after.
- Emit `planner_generated`, `plan_adjusted`, `plan_selected`, `plan_dismissed`.

---

## Stage 4 — Approve · Match Enterprise Review Flows

**Business value:** approvals happen with zero ambiguity. The owner can self-approve or assign to peers with audit-ready context.

```
+--------------------------------------------------------------+
| Stage header: APPROVE • Pending                             |
+---------------------------+-------------------------------+
| Summary card              | Right rail                    |
| ▸ What will happen        | - Assign approver             |
| ▸ Who is affected         | - Due time                    |
| ▸ Safeguards + undo plan  | - Comment thread              |
| ▸ Required permissions    | - Approval history            |
+---------------------------+-------------------------------+
| CTA row: Approve • Request approval • Export PDF             |
+--------------------------------------------------------------+
```

**UI essentials**

- Summary is read-only and printable, mirroring compliance needs in `docs/examples/compliance_audit.md`.
- Assign approver triggers notification with secure link; reminder badges display if due within 12 hours.
- Rejections capture reason and suggested edits, feeding back into Stage 3 automatically.

**Trust & accessibility**

- Every approval decision enters the Supabase audit log with timestamp, user id, and diff of plan.
- Live region announces approval status changes; focus stays on decision buttons for keyboard users.

**Performance & telemetry**

- Approval snapshot renders instantly from cached plan.
- Emit `approval_requested`, `approval_granted`, `approval_rejected`, `approval_exported`.

---

## Stage 5 — Execute · Keep It Calm, Not Technical

**Business value:** give Sam and Riley legible progress without forcing them into raw logs; surface only what needs their attention.

```
+--------------------------------------------------------------+
| Stage header: EXECUTE • Live • Undo 14:59                    |
+---------------------------+-------------------------------+
| Live checklist            | Alert rail                     |
| 1. Enrich contacts  ✔     | - 6 emails paused (missing fn) |
| 2. Draft outreach  ●      | - Validator auto-fixed tone    |
| 3. Queue review  ◌        |                               |
| "View details" opens log drawer                            |
+---------------------------+-------------------------------+
| Evidence strip: first drafts, export, share link            |
+--------------------------------------------------------------+
```

**UI essentials**

- Live checklist shows no more than eight steps, each with icon (waiting/running/done) and short description.
- Alert rail summarises exceptions; one click opens inline resolution (e.g., “Auto-fill greeting” vs. “Review before continue”).
- Log drawer (optional) exposes streaming JSON for platform admins.
- Undo banner persists until timer expires; “Finalize now” closes undo window early.

**Trust & accessibility**

- Alerts use colour + icon + text; screen readers announce when new alert arrives.
- Undo button accessible via keyboard shortcut `u`.
- Evidence entries labelled with redaction status drawn from Supabase metadata.

**Performance & telemetry**

- Step updates stream <500ms from backend.
- Emit `execution_started`, `execution_step_updated`, `validator_override`, `undo_triggered`, `execution_finalized`.

---

## Stage 6 — Reflect · Capture Impact and Next Steps

**Business value:** quantify outcomes and learnings so the team reuses success and improves weaker missions.

```
+--------------------------------------------------------------+
| Stage header: REFLECT • Completed                           |
+---------------------------+-------------------------------+
| Outcome snapshot          | Insight rail                  |
| ▸ Impact metric           | - Library suggestion          |
| ▸ Records touched         | - Governance trend (e.g.,     |
| ▸ Time saved              |   SLA compliance)             |
| Evidence gallery (cards)  | - Follow-up checklist         |
+---------------------------+-------------------------------+
| Feedback footer: ⭐ rating • "What improved?" text chip      |
+--------------------------------------------------------------+
```

**UI essentials**

- Outcome snapshot highlights human-friendly metrics (meetings booked, tickets resolved, risk mitigated) sourced from mission telemetry.
- Evidence gallery groups artefacts (emails, exports, policies) with hash + redaction flags.
- Follow-up checklist includes nudges such as “Notify exec sponsor” or “Schedule review” derived from `docs/07_operations_playbook.md`; each action links users directly to create or update the matching `bd` issue (`bd create … -l follow-up`), keeping the mission audit trail intact (see `docs/11_issue_tracking.md`).
- Feedback is two taps: star rating + optional note. Next mission surfaces “What changed because of your feedback.”

**Trust & accessibility**

- Evidence items open in accessible modal with download + share controls.
- Feedback form supports keyboard navigation and is non-blocking.

**Performance & telemetry**

- Outcome snapshot loads <1.2s; evidence lazy-loads as user scrolls.
- Emit `mission_completed`, `evidence_opened`, `feedback_submitted`, `template_saved_from_mission`.

---

## Cross-Stage Interaction Patterns

- **Pinned brief:** read-only summary anchored below header; inline edit returns user to Stage 1 with history preserved.
- **Readiness badge:** simple traffic-light state tied to Supabase `mission_readiness` view.
- **Safeguard drawer:** consistent component that lists active safeguards and validators.
- **Undo banner:** same placement and behaviour in Execute and shortly after Reflect to encourage confidence.
- **Comments & mentions:** single mission-level thread to avoid noise; link to `docs/03a_chat_experience.md` for chat specifics.
- **Telemetry heartbeat:** unobtrusive footer status showing “All events healthy” with quick link to diagnostics.

---

## Microcopy & Tone

| Situation          | Say This                                                         | Avoid                                      |
| ------------------ | ---------------------------------------------------------------- | ------------------------------------------ |
| Readiness blocked  | "Needs auth: Connect Gmail to send outreach."                    | "OAuth failure: missing scope chat:write." |
| Safeguard reminder | "Undo available for 15 minutes after send."                      | "System may attempt rollback."             |
| Error alert        | "We paused 6 drafts. Add first names or accept our placeholder." | "Validation error: missing field fn."      |
| Success toast      | "Done: 83 drafts prepared. Finalize when ready."                 | "Process completed."                       |

All content should sound like a helpful teammate—confident, respectful, never cute.

---

## Accessibility & Inclusion Checklist

- Logical heading order, ARIA landmarks for header, primary canvas, rail, and footer.
- Keyboard map surfaced via `?` overlay (document in `docs/08_getting_started.md`).
- Live regions for dynamic content: intent suggestions, approval status, new alerts.
- High-contrast theme as default; dark mode respects user’s system preference.
- Date, currency, and time formats localised using mission region metadata.
- Motion-reduced mode removes non-essential transitions but keeps contextual affordances.

---

## Responsive Behaviour

- **≥1440px:** wide layout, mission rail pinned, two-column evidence grid.
- **1024–1439px:** stage canvas remains primary; rail collapses to 320px drawer.
- **768–1023px:** stacked layout, stage summaries become accordions, undo button stays sticky.
- **≤767px:** mobile-first flow; stage header sticky, rail behaves as slide-over.

Controls stay reachable with thumb-friendly spacing and avoid hovering-only interactions.

---

## Telemetry We Ship Day One

- Mission lifecycle: created → brief locked → readiness achieved → plan selected → approval status → execution metrics → completion.
- Tooling: recommendation surfaced, connection attempts, scope grants, inspector overrides.
- Safeguards: triggered, auto-remediated, overridden (with reason and approver).
- Feedback loop: rating submitted, comment captured, template saved, mission reused.

Events align with naming in `docs/06_data_intelligence.md` so analytics stays consistent.

---

## Implementation Checklist

- Mirror these layouts in the Next.js app under `src/app/(control-plane)`; reuse existing stage machines and telemetry helpers.
- Ensure Composio tool calls follow the progressive trust model: `tools.search()` for inspection, `connected_accounts.initiate()` for auth, `tools.execute()` post-approval.
- Regenerate Supabase types after schema updates (`supabase gen types` > `supabase/types.ts`).
- Validate UI with `pnpm run test:ui` and agent flows with `mise run test-agent`; both must stay green before shipping.
- Visual QA: leverage the browser tooling to confirm wireframe intent translates to accessible, polished UI.

This playbook should feel lightweight, decisive, and ready to act. Every mission should answer, within seconds, “What is happening, what do I need to do, and what happens next?” for the people who run the business.
