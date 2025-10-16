# AI Employee Control Plane: User Experience Journey

**Version:** 4.0 (October 2025)
**Audience:** Product Design, UX Engineering, Research, Trust & Accessibility
**Status:** Definitive interaction contract for the unified mission workspace

---

## Experience North Star

Deliver a mission workspace that **feels autonomously capable, stays legibly collaborative, and broadcasts trust at every turn**. Each surface answers three questions without hesitation:

1. **What is happening right now?** — Live cues, badges, and narration keep intent and execution observable.
2. **What decisions are on me?** — Inline approvals, safeguard edits, and undo timers present clear choices with context.
3. **What happens next?** — Stage cards preview downstream impact, evidence trails, and rollbacks before the user commits.

Mission context never resets: the workspace persists chips, safeguards, telemetry, and audit trails across stages without route changes or modal dead ends.

---

## Workspace at a Glance

```
+-----------------------------------------------------------------------+
| Top Bar: Mission name · Stage pill · Status LED · Quick actions       |
+-----------------------------------------------------------------------+
| Primary Column (scrolls)                    | Context Rail (sticky)   |
| ------------------------------------------- | ----------------------- |
| Intake / Toolkit / Planner / Timeline       | CopilotKit chat spine   |
| Evidence Gallery                            | Stage alerts & approvals|
| Undo / Feedback drawer toggles              | Event log shortcuts     |
+-----------------------------------------------------------------------+
| Footer: Telemetry heartbeat · Undo countdown · Accessibility helpers  |
+-----------------------------------------------------------------------+
```

| Layer | Description | Key Components | Responsive Behaviour |
|-------|-------------|----------------|----------------------|
| **Mission Header** | Stage-aware framing, mission metadata | `MissionHeader`, `StagePill`, `StatusLED`, `QuickActions` | Shrinks to two-line stack ≤1024px; actions move to overflow menu |
| **Primary Column** | Core stage canvas and evidence | `MissionIntake`, `ToolkitCanvas`, `PlannerRail`, `ExecutionTimeline`, `EvidenceGallery` | Collapsible sub-panels ≤768px; timeline converts to accordion |
| **Context Rail** | Collaboration, approvals, interrupts | `CopilotKitThread`, `StageAlertStack`, `ApprovalCards`, `UndoBar` | Becomes top-aligned drawer on tablet; modal on mobile |
| **Footer Strip** | Trust and accessibility affordances | `TelemetryHeartbeat`, `UndoCountdown`, `AccessibilityMenu` | Fully sticky ≤768px to keep undo visible |

### Responsive Breakpoints

| Viewport | Layout Notes | Critical Safeguards |
|----------|--------------|----------------------|
| ≥1440px   | Wide canvas with dual-column evidence | Undo bar anchored with tooltips; Planner shows two cards per row |
| 1024–1439px | Compact evidence grid, chat rail width 320px | Approval modals centre with focus trap; stage breadcrumbs persist |
| 768–1023px  | Context rail collapses into drawer; timeline uses horizontal scroll | Persistent undo button; chat announces stage change |
| ≤767px      | Vertical stack, chat rail overlays on demand | Sticky stage header and undo banner; keyboard focus order enforced |

### Five-Stage Flow (Always On-Screen in Stage Pill)

```
DEFINE → PREPARE → PLAN & APPROVE → EXECUTE & OBSERVE → REFLECT & IMPROVE
      │            │                 │                        │
      └── Context, safeguards, and undo plans persist through every stage ───┘
```

---

## Stage-by-Stage Journey

Each stage inherits prior context, prefetches downstream data, and exposes role-aware actions. Chat behaviour for every stage is detailed in `docs/03a_chat_experience.md` and referenced below.

### Stage 1 · Define — Mission Briefing

**Purpose:** Capture intent, constraints, and safeguards until a mission brief is locked.

```
+---------------------------------------------------------------+
| Stage Header (DEFINE)                                         |
+---------------------------+-----------------------------------+
| Mission Intake Banner     | CopilotKit Rail                   |
| Chip Draft Stack          | • Narrated extraction summary     |
| Safeguard Editor          | • Confirmation prompts            |
| Brief Preview Card        | • Event log shortcuts             |
+---------------------------------------------------------------+
```

| Surface | What the User Sees | System Signals |
|---------|--------------------|----------------|
| **Mission Intake Banner** | Textarea with prompt carousel and tone presets | Streaming chip render; token + guardrail hints |
| **Chip Draft Stack** | Objective, audience, KPI, safeguard, timeline chips | Confidence badges (`High`, `Medium`, `Needs Review`), edit icons |
| **Safeguard Editor** | Inline markdown editor with checklist | Validator hints; highlight unmet compliance requirements |
| **Brief Preview Card** | Summarised mission brief with diff highlights | `Lock Brief` CTA disabled until all required chips approved |

| User Action | System Response | Chat Rail Behaviour | Telemetry |
|-------------|-----------------|---------------------|-----------|
| Paste mission intent | Chips generated, safeguards suggested | Narration summarises extracted chips, requests confirmation | `intent_submitted`, `brief_generated` |
| Edit / regenerate chip | Chip updates, diff badge shown | Chat posts change receipt with author + summary | `chip_regenerated`, `chip_edited` |
| Lock brief | Banner collapses, pinned brief card appears | Chat emits "Brief locked" receipt with edit link | `mission_brief_locked` |
| Toggle safeguard requirement | Validator re-runs coverage, updates risk pill | Chat flags safeguard impact | `safeguard_updated` |

**Availability by Role**

| Role | Capabilities |
|------|--------------|
| Mission Owner | Full edit + lock authority, safeguard overrides |
| Team Collaborator | Can propose edits, mark chips ready, annotate safeguards |
| Governance Reviewer | Read-only chips, can comment on safeguards before lock |
| Viewer | Read-only brief snapshot; chat read access only |

**Connection Status Impact**

| State | Behaviour |
|-------|-----------|
| Online | Streaming chip rendering, live confidence badges |
| Offline | Autosave draft locally; brief lock disabled; chat queues messages |
| Intermittent | Auto-retry chip generation; chat sends stage summary once connection restores |

**Accessibility Notes**

- Stage header announces "Define stage" via `aria-live="polite"` when entered.
- Chips are keyboard navigable pill groups; `Enter` expands edit drawer, `Esc` collapses.
- Safeguard editor exposes markdown preview for screen readers with labelled toggle.

### Stage 2 · Prepare — Toolkit Readiness

**Purpose:** Curate tools, perform scope reviews, and confirm data readiness before planning.

```
+------------------------------------------------------------------+
| Stage Header (PREPARE)                                           |
+---------------------------+--------------------------------------+
| Toolkit Canvas            | CopilotKit Rail                      |
| Connection Status Grid    | • Inspector summary cards            |
| Coverage Meter            | • Connect Link approvals             |
| Data Preview Drawer       | • Scope audit log shortcuts          |
+------------------------------------------------------------------+
```

| Surface | What the User Sees | System Signals |
|---------|--------------------|----------------|
| **Toolkit Canvas** | Ranked toolkits with rationale, precedent missions | Coverage %, sources, scope badges |
| **Connection Status Grid** | Slots for each toolkit showing `Discover`, `Authorize`, `Ready` states | Animated progress rings, Connect Link buttons |
| **Coverage Meter** | Radial gauge with thresholds (≥85% to proceed) | Turns amber below 85%, red below 60% |
| **Data Preview Drawer** | Sample records with redacted fields, schema diff | Redaction badges, PII flags |

| User Action | System Response | Chat Rail Behaviour | Telemetry |
|-------------|-----------------|---------------------|-----------|
| Inspect toolkit | Shows actions, required scopes, dependencies | Inspector posts coverage delta summary | `toolkit_recommended`, `toolkit_viewed` |
| Initiate Connect Link | Opens approval modal with scope checklist | Chat delivers Connect Link URL + expiry | `composio_auth_flow` |
| Approve scopes | Slot shifts to `Authorize`, OAuth handled backend | Chat confirms handshake, records approver | `toolkit_selected`, `scope_granted` |
| Review data preview | Highlights missing fields, compliance flags | Chat suggests remediation checklist | `data_preview_generated`, `coverage_gap_identified` |
| Request override | Logs governance note, requires reviewer approval | Chat pings governance reviewer inline | `coverage_override_requested` |

**Availability by Role**

| Role | Capabilities |
|------|--------------|
| Mission Owner | Approve scopes, acknowledge coverage warnings, assign remediation |
| Team Collaborator | Suggest toolkits, add context notes, request overrides |
| Governance Reviewer | Must co-approve overrides, can freeze progression |
| Viewer | Read-only; may subscribe to coverage alerts |

**Connection Status Impact**

| State | Behaviour |
|-------|-----------|
| Online | OAuth handshakes run inline; Inspector caches results for 1 hour |
| Offline | Toolkit edits allowed; Connect Link creation disabled; alerts queued |
| Intermittent | Retry logic for OAuth with exponential backoff; chat surfaces pending actions |

**Accessibility Notes**

- Connect Link modal announces scope list with `aria-describedby` referencing risk summary.
- Coverage meter exposes numeric value for screen readers; colour-coded states also include patterns.
- Data preview table offers `Skip to next flagged field` shortcut key.

### Stage 3 · Plan & Approve — Blueprint Commitment

**Purpose:** Select and finalise mission plays, safeguards, and undo plans.

```
+--------------------------------------------------------------------+
| Stage Header (PLAN & APPROVE)                                      |
+------------------------------+-------------------------------------+
| Planner Insight Rail         | CopilotKit Rail                     |
| Play Comparison Matrix       | • Planner narration & quick replies |
| Safeguard + Undo Checklist   | • Approval queue cards              |
| Approval Modal Launcher      | • Risk alerts                       |
+--------------------------------------------------------------------+
```

| Surface | What the User Sees | System Signals |
|---------|--------------------|----------------|
| **Planner Insight Rail** | Streaming ranked plays with confidence, effort, coverage tags | Live diff badges when Inspector updates scope readiness |
| **Play Comparison Matrix** | Table of candidate plays vs impact, effort, risk | Highlighted recommendation; hover reveals rationale tooltip |
| **Safeguard + Undo Checklist** | Required safeguards with validation icons, undo countdown previews | Turns green only when undo paths verified |
| **Approval Modal Launcher** | `Approve plan` button showing outstanding blockers | Disabled until required reviewers respond |

| User Action | System Response | Chat Rail Behaviour | Telemetry |
|-------------|-----------------|---------------------|-----------|
| Expand candidate play | Shows detailed steps, dependencies, undo plan | Planner narrates reasoning, invites feedback buttons | `planner_candidate_generated`, `plan_viewed` |
| Request revision | Planner regenerates focusing on flagged criteria | Chat posts revision summary referencing change | `planner_retry_requested` |
| Attach manual step | Adds human task with owner and due date | Chat confirms assignment, notifies owner | `manual_step_added` |
| Approve plan | Locks plan, triggers governance confirmation workflow | Chat announces approval, posts undo digest | `plan_ranked`, `plan_approved` |
| Reject plan | Sends plan back to Prepare stage context | Chat notifies stakeholders, restates blockers | `plan_rejected` |

**Availability by Role**

| Role | Capabilities |
|------|--------------|
| Mission Owner | Approve/reject plays, assign manual steps, edit safeguards |
| Team Collaborator | Comment on plays, attach notes, propose manual tasks |
| Governance Reviewer | Mandatory approval for high-risk scopes; can require additional safeguards |
| Viewer | Can review final plan snapshot; cannot approve |

**Connection Status Impact**

| State | Behaviour |
|-------|-----------|
| Online | Planner updates stream continuously; approvals instant |
| Offline | Plays cached for review; approvals disabled; chat queues questions |
| Intermittent | Quick replies degrade to buttons; plan lock waits for confirmed handshake |

**Accessibility Notes**

- Planner cards expose structured heading hierarchy for screen readers (`h3` per play).
- Approval modal offers summary table with row-level `aria-label` for risk categories.
- Undo summary exposes `aria-live="assertive"` when countdown arms.

### Stage 4 · Execute & Observe — Governed Run Time

**Purpose:** Execute approved plan, surface live telemetry, and keep undo within reach.

```
+--------------------------------------------------------------------+
| Stage Header (EXECUTE & OBSERVE)                                   |
+--------------------------+-----------------------------------------+
| Streaming Status Panel   | CopilotKit Rail                         |
| Action Log Timeline      | • Executor narration & validator flags  |
| Evidence Gallery         | • Undo countdown mirroring              |
| Undo Bar (sticky)        | • Escalation shortcuts                  |
+--------------------------------------------------------------------+
```

| Surface | What the User Sees | System Signals |
|---------|--------------------|----------------|
| **Streaming Status Panel** | Current step, tool call summary, heartbeat indicator | Turns amber on retries, red on validator interrupts |
| **Action Log Timeline** | Step-by-step cards with tool inputs/outputs | Expand to view raw payloads, timestamps, hash badges |
| **Evidence Gallery** | Artifact cards (files, transcripts, metrics) with validation status | Hash + redaction badges, export menu |
| **Undo Bar** | Countdown, impact summary, confirm button | Pulses during armed rollback; shows audit link after completion |

| User Action | System Response | Chat Rail Behaviour | Telemetry |
|-------------|-----------------|---------------------|-----------|
| Pause execution | Executor suspends next step, highlights reason | Chat posts pause confirmation and next decision deadline | `execution_paused` |
| Approve auto-fix | Executor retries with suggested fix | Chat shows delta and new ETA | `execution_step_retry` |
| Trigger undo | Undoes last mutating action, logs audit trail | Chat counts down, confirms success/failure with evidence link | `undo_initiated`, `undo_completed` |
| Annotate evidence | Adds note + owner tags to artifact card | Chat shares annotation with thread participants | `evidence_note_added` |
| Export artifact | Downloads signed package, logs export | Chat posts export receipt with hash reference | `evidence_bundle_generated`, `artifact_exported` |

**Availability by Role**

| Role | Capabilities |
|------|--------------|
| Mission Owner | Pause, approve fixes, trigger undo, annotate evidence |
| Team Collaborator | Annotate evidence, request pause, suggest alternative path |
| Governance Reviewer | View evidence in real time, require manual confirmation before risky steps |
| Viewer | Observe execution feed, download permitted artifacts |

**Connection Status Impact**

| State | Behaviour |
|-------|-----------|
| Online | Live streaming updates with ≤5s heartbeat |
| Offline | Execution continues with safeguards; local view shows paused state; undo disabled |
| Intermittent | Chat aggregates step summaries; evidence cards queue until stable |

**Accessibility Notes**

- Action timeline supports `Skip to current step` shortcut.
- Undo bar uses both colour and motion; reduced-motion users receive static countdown with numeric timer.
- Evidence cards expose semantic `<figure>`/`<figcaption>` pairs for screen reader context.

### Stage 5 · Reflect & Improve — Close the Loop

**Purpose:** Capture feedback, surface reuse opportunities, and assign follow-up actions.

```
+--------------------------------------------------------------------+
| Stage Header (REFLECT & IMPROVE)                                   |
+--------------------------+-----------------------------------------+
| Mission Summary Card     | CopilotKit Rail                         |
| Feedback Drawer          | • Recap narrative & follow-up prompts   |
| Library Suggestions      | • Survey card + rating controls         |
| Checklist Tracker        | • Hand-off notifications                |
+--------------------------------------------------------------------+
```

| Surface | What the User Sees | System Signals |
|---------|--------------------|----------------|
| **Mission Summary Card** | Highlights outcomes, savings, residual risk | Confidence meter, delta vs goals |
| **Feedback Drawer** | Per-artifact ratings, mission survey, freeform notes | Autocomplete tags, anonymise toggle |
| **Library Suggestions** | Recommended plays/templates with reuse stats | `Pin to library` CTA with tagging |
| **Checklist Tracker** | Follow-up items, owners, due dates | Progress pills, integration hooks (Jira/Asana) |

| User Action | System Response | Chat Rail Behaviour | Telemetry |
|-------------|-----------------|---------------------|-----------|
| Submit artifact feedback | Stores rating, updates quality dashboards | Chat thanks user, suggests follow-up play | `feedback_submitted`, `artifact_rated` |
| Add library pin | Creates reusable play entry with metadata | Chat posts library link, notifies enablement channel | `library_contribution` |
| Log follow-up task | Creates task with owner + due date | Chat confirms assignment, subscribes owner | `followup_scheduled` |
| Share mission summary | Generates shareable link/PDF | Chat posts export confirmation | `mission_retrospective_logged`, `summary_exported` |

**Availability by Role**

| Role | Capabilities |
|------|--------------|
| Mission Owner | Approve final summary, publish learnings, assign follow-ups |
| Team Collaborator | Provide feedback, propose reuse items, claim tasks |
| Governance Reviewer | Validate residual risk notes, sign off on compliance artefacts |
| Viewer | Read-only summary, can submit feedback if granted |

**Connection Status Impact**

| State | Behaviour |
|-------|-----------|
| Online | Feedback autosaves, library updates real time |
| Offline | Feedback captured locally and syncs upon reconnect; sharing disabled |
| Intermittent | Chat batches recap updates; checklist updates require confirmation |

**Accessibility Notes**

- Feedback form fields labelled with success criteria hints.
- Checklist items expose drag handles but also keyboard move commands.
- Mission summary gauge includes alt text describing improvement metrics.

---

## Interaction Patterns Reference

| Pattern | Description | Components | Notes |
|---------|-------------|------------|-------|
| **Chip Editing & Locking** | Accept, regenerate, convert chips into notes | `MissionIntake`, `ChipCard`, `ChipHistoryDrawer` | Keep audit of edits; mention syntax for teammates |
| **Scope Approval (Connect Link)** | Two-phase flow: preview scopes → stakeholder approval → OAuth handshake | `ConnectLinkModal`, `ScopeChecklist`, `ApprovalReceipt` | Links expire in 15 minutes; reissue retains audit history |
| **Safeguard Drawer** | Inline markdown with compliance checklist | `SafeguardDrawer`, `ValidatorHint` | Edits sync to Planner prompts in under 5 seconds |
| **Plan Approval Modal** | Summaries of impact, safeguards, undo plan | `PlanApprovalModal`, `RiskMatrix`, `UndoSummary` | Requires dual confirmation for red risk items |
| **Streaming Logs** | Expandable raw reasoning and tool payloads | `StreamingLogDrawer`, `ActionCard` | Expose copy button + redaction toggle |
| **Undo Execution** | Countdown, scope preview, audit link | `UndoBar`, `UndoConfirmModal` | Countdown defaults to 15s; can extend to 60s for high-risk plays |
| **Pin to Library** | Save artifacts/plays for reuse with metadata | `LibraryPinButton`, `TagPicker` | Auto-tags persona from examples (see `docs/examples/`) |

---

## Accessibility & Inclusivity Checklist

1. **Semantic Structure:** `<header>`, `<main>`, `<aside>`, `<footer>` frame every stage; headings follow `h1 → h2 → h3` order.
2. **Keyboard-First:** All controls operable via keyboard; offer shortcuts per stage (documented in UI tooltip and `?` panel).
3. **Live Region Discipline:** Announcement rate-limited to avoid screen reader overload; stage changes `aria-live="polite"`, critical alerts `assertive`.
4. **High Contrast & Patterns:** Colour-coded badges use accompanying icons/patterns; meets WCAG 2.2 AA.
5. **Motion Reduction:** Provide reduced-motion mode; streaming shimmers replaced with discrete step counters.
6. **Localization:** Strings externalised with ICU format; supports RTL reflow, including chat rail.
7. **Cognitive Load:** Each stage summarises tasks at top; tooltips provide plain-language definitions of trust badges.

---

## Prototype & Testing Guidance

| Track | Cadence | What to Validate |
|-------|---------|------------------|
| **Design QA** | Per feature | Figma ↔ Storybook parity, token usage, responsive states |
| **Usability Studies** | Monthly (per key persona) | Stage clarity, decision friction, undo comprehension |
| **Accessibility Audits** | Automated per PR; manual per release | Axe/Pa11y automation + NVDA/VoiceOver sweeps |
| **Telemetry Verification** | Weekly | `scripts/audit_telemetry_events.py` ensures event payloads align with Appendix A |
| **Performance Benchmarks** | Each release candidate | Stage transitions ≤150 ms, heartbeat ≤5 s, evidence load ≤2 s p95 |
| **Feedback Loop** | Weekly triage | Review feedback drawer submissions; convert high-impact insights into backlog |

---

## Deliverables & Ownership

- **Design System Updates:** Sync new components/tokens into CopilotKit kit; mark `docsReady` once Storybook matches production interactions.
- **Documentation Cross-Links:** Ensure product vision (`docs/01_product_vision.md`), system overview (`docs/02_system_overview.md`), and examples (`docs/examples/*.md`) reference this journey.
- **Change Control:** Deviations from principles require UX Design Review with Product, Engineering, and Trust leads.
- **Telemetry Guardrails:** `composio_discovery`, `composio_auth_flow`, and `composio_tool_call` events must fire consistently per stage tables.

---

## Appendix A · Stage-to-Event Matrix

| Stage | Primary Events | Optional Events | Payload Highlights |
|-------|----------------|-----------------|--------------------|
| Define | `intent_submitted`, `brief_generated`, `mission_brief_locked` | `chip_regenerated`, `safeguard_updated` | Chip ids, confidence, safeguard diffs |
| Prepare | `toolkit_recommended`, `toolkit_selected`, `data_preview_generated`, `composio_auth_flow` | `coverage_gap_identified`, `coverage_override_requested` | Toolkit id, scope list, coverage %, approver ids |
| Plan & Approve | `planner_candidate_generated`, `plan_ranked`, `plan_approved` | `planner_retry_requested`, `manual_step_added` | Confidence score, undo summary id, reviewer role |
| Execute & Observe | `execution_started`, `execution_step_completed`, `validator_alert_raised`, `evidence_bundle_generated`, `undo_initiated`, `undo_completed` | `execution_paused`, `execution_step_retry` | Tool call id, validator reason, artifact hash |
| Reflect & Improve | `feedback_submitted`, `mission_retrospective_logged`, `library_contribution` | `artifact_rated`, `followup_scheduled`, `summary_exported` | Rating, effort saved estimate, library tag |

---

## Appendix B · Persona Alignment

| Persona (see `docs/examples/`) | Primary Goals | Critical Stages |
|--------------------------------|---------------|-----------------|
| **Riley – Revenue Operator (`docs/examples/revops.md`)** | Launch campaigns quickly, ensure sales tooling coverage | Define, Prepare |
| **Sam – Support Leader (`docs/examples/support_leader.md`)** | Maintain SLA, coordinate customer responses | Execute & Observe |
| **Jordan – Coder (`docs/examples/coder.md`)** | Inspect evidence, reuse proven plays | Plan & Approve, Reflect & Improve |
| **Gabriela – Governance Lead (`docs/examples/compliance_audit.md`)** | Validate safeguards, ensure audit readiness | Prepare, Plan & Approve |

---

## Appendix C · Visual Design Tokens (Reference)

| Token Group | Sample Values | Notes |
|-------------|---------------|-------|
| **Colour** | `stage.define = #D0E9FF`, `stage.prepare = #E4F7E9`, `risk.high = #FF5C5C` | Pair with iconography for accessibility |
| **Typography** | `Heading` = Inter 24/32 (700), `Body` = Inter 16/24 (400), `Mono` = JetBrains Mono 14/20 | Respect min 3 px letter spacing on stage pills |
| **Spacing** | `grid = 8px`, `stage-gap = 24px`, `rail-width = 360px` | Maintain rail width desktop ≥320px |
| **Motion** | `stage-transition = 150ms ease`, `undo-countdown = 1s step` | Honour reduced-motion preference |

---

## Appendix D · Quick ASCII References

### Define Stage — Chip Editing Focus

```
[Intent Textarea]
     ↓ generate chips
[Objective] [Audience] [KPI]
     ↓ edits via drawer
[Safeguard Markdown]
     ↓ lock brief → [Pinned Brief Card]
```

### Execute Stage — Streaming Timeline

```
Step N   ┌──────────────────────────┐
         │ Tool Call Summary        │
         │ • Input / Output preview │
         │ • Validator status       │
         └──────────────────────────┘
         ↓ evidence links
[Evidence Card] [Undo Countdown]
```

These diagrams should accompany Storybook examples and remain updated whenever UI flows evolve.

