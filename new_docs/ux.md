# AI Employee Control Plane — UX Blueprint

**Version:** 1.0 (October 8, 2025)
**Audience:** Product, Design, Engineering, Governance
**Status:** Active UX vision and interaction model

---

## Executive Summary

This UX blueprint defines the user experience strategy for the AI Employee Control Plane — a mission workspace that converts a single freeform input (links, goals, context) into fully generated missions, objectives, toolkits, audiences, and adaptive safeguards that remain editable at every step. The design centers on **trust through visibility**: users provide intent once, then maintain control as the system proposes, auto-populates, and iterates on the plan.

The experience prioritizes:

- **Single-input onboarding** — users paste one prompt; the workspace generates structured objectives, personas, constraints, and plays
- **Generative defaults with human oversight** — every recommendation is editable, traceable, and easy to accept, refine, or replace
- **Zero-to-value in <15 minutes** — from initial input to reviewable proof pack
- **Progressive trust** — dry-run first, governed activation when ready
- **Continuous visibility** — streaming agent reasoning, safeguard feedback, evidence trails
- **Human-centered approvals** — collaborative decision points, not gatekeeping friction
- **Accessibility & inclusion** — WCAG 2.1 AA compliance, keyboard navigation, screen reader support
- **Curated tool orchestration** — the workspace recommends Composio toolkits (no-auth first, OAuth-ready second) with rationale tags so users can co-author the plan before execution

---

## Table of Contents

1. [Design Philosophy & Principles](#1-design-philosophy--principles)
2. [User Personas & Jobs-to-Be-Done](#2-user-personas--jobs-to-be-done)
3. [Core User Journeys](#3-core-user-journeys)
4. [Mission Workspace Anatomy](#4-mission-workspace-anatomy)
5. [Interaction Patterns & UI Components](#5-interaction-patterns--ui-components)
6. [Progressive Disclosure & Complexity Management](#6-progressive-disclosure--complexity-management)
7. [Adaptive Safeguards UX](#7-adaptive-safeguards-ux)
8. [Evidence & Analytics Storytelling](#8-evidence--analytics-storytelling)
9. [Accessibility & Inclusive Design](#9-accessibility--inclusive-design)
10. [Instrumentation & Telemetry Touchpoints](#10-instrumentation--telemetry-touchpoints)
11. [Cross-References & Implementation Tie-Ins](#11-cross-references--implementation-tie-ins)

---

## 1. Design Philosophy & Principles

### 1.1 Core Tenets

**Generative by Default, Editable by Design**
The workspace ingests a single freeform input and produces structured objectives, audiences, safeguards, and plays automatically. Every generated element is surfaced with edit, replace, or reject affordances so users stay in control.

**Trust Through Transparency**
Every agent action, safeguard check, and execution step surfaces in real-time. Users never wonder "what is it doing?" — they see reasoning, evidence, and undo plans as work unfolds.

**Progressive Trust Model**
Start with zero-privilege dry runs (drafts, lists, schedules). Once value is proven, users opt into governed activation with OAuth scopes, approvals, and enforcement.

**Human-Centered Copilot, Not Autonomous Autopilot**
The agent is a collaborative partner, not a replacement. Approval moments are designed as constructive checkpoints — users refine, approve, or redirect with minimal friction.

**Objective-First, Not Tool-First**
Users describe goals and constraints once; the system recommends toolkits, plays, and workflows based on capability grounding and library intelligence, while keeping manual overrides simple.

**Radically Reversible**
Every mutating action includes an undo plan. Users can roll back with confidence, and governance teams audit rollback success rates.

### 1.2 Design Principles

| Principle                                    | What It Means                                                                       | How It Shapes UX                                                           |
| -------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Generative Scaffolding**                   | System proposes objectives, audiences, toolkits automatically, always editable      | Chips, inline editors, "Regenerate" buttons on every generated section     |
| **Clarity Over Cleverness**                  | Simple, direct language beats jargon; status updates beat spinners                  | Plain language mission briefs, progress narration, explicit error messages |
| **Safeguards as Guidance**                   | Adaptive hints remove friction while keeping users in control                       | Inline safeguard drawer, one-click fixes, contextual help                  |
| **Evidence Before Execution**                | Prove value with artifacts before requesting credentials                            | Dry-run proofs with sample outputs, ROI estimates, risk disclosures        |
| **Adaptive Density**                         | Surface complexity only when needed; beginners see essentials, experts access depth | Collapsible sections, contextual expansion, role-based views               |
| **Feedback Loops at Every Step**             | Users confirm direction before agents commit resources                              | Approval modals, play selection, safeguard feedback, undo confirmations    |
| **Instrumentation as a First-Class Citizen** | Telemetry touchpoints are baked into flows, not bolted on                           | Inline event tracking, analytics handoffs, evidence capture                |

---

## 2. User Personas & Jobs-to-Be-Done

### 2.1 Primary Personas

#### **P1: Revenue Expansion Lead (Emma)**

**Role:** Director of Business Development, mid-market SaaS
**Goal:** Revive dormant accounts, launch tailored campaigns, prove ROI without hiring SDRs
**Pain Points:**

- Manual outreach doesn't scale; CRM enrichment is tedious
- Leadership demands attribution data before budget approvals
- Credentialed tools scare IT; need proof-of-value first

**JTBD:** "When I have a quarterly pipeline goal, I want to receive ready-to-run outreach plays so I can demonstrate lift before granting send permissions."

**UX Priorities:**

- Fast dry-run loop (<15 min from objective to draft campaign)
- Clear ROI estimates (contacts enriched, messages drafted, expected reply rate)
- Smooth OAuth onboarding once trust is earned
- Generative starting point that auto-creates objective, audience, safeguards, and outreach plan with inline edit controls

---

#### **P2: Customer Operations Leader (Omar)**

**Role:** Head of Support, high-growth e-commerce
**Goal:** Compress response times, prevent churn, uphold SLAs with blended human + agent workflows
**Pain Points:**

- Queue spikes overwhelm team; need triage automation
- Compliance requires approval trails for customer-facing actions
- Can't risk tone violations or accidental escalations

**JTBD:** "When churn-risk cases surface, I want safeguarded automations that propose responses and log evidence so my team meets SLAs confidently."

**UX Priorities:**

- Tone safeguards front-and-center in approval modals
- Undo buttons for every customer-facing action
- Clear evidence bundles for compliance audits
- Auto-generated safeguard-aware responses with quick edit/approve toggles

---

#### **P3: Governance Officer (Priya)**

**Role:** Compliance Lead, regulated fintech
**Goal:** Audit approvals, toolkits, and rollback plans; greenlight broader usage
**Pain Points:**

- Opaque AI systems make compliance impossible
- Need timestamped logs, scopes, reviewer IDs
- Override workflows must expire automatically

**JTBD:** "When reviewing automation requests, I want visibility into who approved each action, what toolkits were used, and how rollback works so I can justify expansion."

**UX Priorities:**

- Read-only governance dashboard with full audit trails
- Safeguard feedback timeline that highlights what was auto-fixed vs. sent anyway
- Exportable evidence bundles (CSV, PDF) for external audits
- Generated summaries explaining any accepted or edited safeguard hints before activation

---

#### **P4: Technical Enablement Lead (Jamal)**

**Role:** Platform Engineer, dev tooling startup
**Goal:** Enable agent-led repo fixes without compromising code hygiene
**Pain Points:**

- Direct repo access is risky; need reviewer checkpoints
- PR descriptions must explain reasoning and testing
- Rollback must preserve git history

**JTBD:** "When agents propose code changes, I want them routed through a code MCP with reviewer checkpoints so I can enable fixes without compromising hygiene."

**UX Priorities:**

- Clear diff previews in approval modals
- Inline commentary from validator agents
- Git-aware undo plans (revert commits, not force-push)
- Generated implementation plan that suggests repositories, branches, and reviewers while remaining editable

---

#### **P5: Executive Sponsor (Carlos)**

**Role:** COO, professional services firm
**Goal:** Justify agent expansion with dashboards summarizing ROI, approvals, safeguard feedback
**Pain Points:**

- Board demands quantified business impact
- Risk committee needs compliance posture
- Can't evaluate agent performance without telemetry

**JTBD:** "When presenting to the board, I want dashboards showing weekly approved jobs, ROI, and safeguard impact so I can justify budget and expansion."

**UX Priorities:**

- Executive-friendly analytics (simple KPIs, trend lines, filters)
- Exportable reports (PDF, slides)
- Incident summaries with mitigation narratives
- Generated board-ready summary cards populated automatically after each mission

---

### 2.2 Secondary Personas

- **Agency Partner (builds AI-led services):** Needs cloneable plays, performance tracking
- **Finance Ops Manager:** Automates billing nudges, scheduling with oversight
- **Marketing Ops Lead:** Drafts nurture sequences, enriches lead lists in dry-run mode

---

## 3. Core User Journeys

### 3.1 Journey Map: Dry-Run Proof (Gate G-B Focus)

**Goal:** Emma (Revenue Lead) wants to prove value before granting OAuth scopes.

#### Eight Stages

| Stage                     | User Actions                                                                                        | Agent Actions                                                                                                        | UI Touchpoints                                                                                             | Success Criteria                                              | Time Budget | Telemetry Events                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| **1. Intake**             | Pastes one paragraph with objective, links, tone preferences into single-input banner               | Parses text via Gemini, extracts entities, generates chips (objective, audience, KPIs, safeguards)                   | Generative Intake Banner with paste box + "Generate mission" CTA                                           | Chips generated; no fallback state needed                     | ≤3s p95     | `intent_submitted`, `brief_generated`                                              |
| **2. Mission Brief**      | Reviews and accepts generated chips; accepted chips persist as pinned mission brief card            | Builds structured brief with confidence scores; persists to Supabase `mission_metadata`                              | Mission Brief Card (pinned, persistent) with inline chips + "Edit", "Regenerate", "Accept"                 | User accepts brief; chip acceptance ≥70% without regeneration | 1-2 min     | `brief_item_modified`, `mission_created`                                           |
| **3. Toolkits & Connect** | Curates Composio toolkit palette; inspects recommended tools with badges; connects via Connect Link | Queries `Composio.tools.get` and `toolkits.list`; surfaces no-auth first, OAuth-ready second with impact estimates   | Toolkit Palette (RecommendedToolStrip + ToolCard) with inspection preview, multi-select, Connect Link auth | Toolkits selected; OAuth ready or no-auth confirmed           | 2-3 min     | `toolkit_recommendation_viewed`, `toolkit_selected`, `inspection_preview_rendered` |
| **4. Data Inspect**       | Reviews coverage meter and inspection preview; validates data coverage/freshness                    | MCP draft calls validate coverage; generates readiness percentage and gap highlights                                 | Coverage Meter (readiness %, gap highlighting) + inspection preview panel                                  | Inspection pass ≥85%; coverage meter shows readiness          | 2-3 min     | `inspection_preview_rendered`, `plan_validated`                                    |
| **5. Plan**               | Selects from ranked plays with impact/risk/undo metadata; reviews planner insight rail              | Planner insight rail streams rationale; ranks plays with library embeddings and historical outcomes                  | Planner Insight Rail (streaming rationale) + Play Cards (impact/risk/undo, "Why This?")                    | Preferred play selected with minimal edits                    | 2-3 min     | `play_selected`, `plan_validated`                                                  |
| **6. Dry-Run**            | Monitors streaming status panel; observes planner → executor → validator loop with heartbeat + logs | Executor streams progress via `copilotkit_emit_message`; validator checks safeguards; evidence agent bundles outputs | Streaming Status Panel (live progress, checkmarks, heartbeat, expandable logs, "Pause", "Cancel")          | Dry-run completes <15 min p95                                 | <15 min p95 | `dry_run_started`, `dry_run_stage_completed`, `dry_run_completed`                  |
| **7. Evidence**           | Reviews artifact gallery with proof pack, ROI estimates; accesses undo bar for time-bound rollback  | Evidence agent surfaces artifacts, ROI summary, undo plans; enables download/share                                   | Artifact Gallery (proof pack, ROI cards, undo bar, download/share links)                                   | User comfortable with outputs; artifacts accessible           | 2-3 min     | `dry_run_completed`, `evidence_bundle_exported`                                    |
| **8. Feedback**           | Submits per-artifact ratings and mission feedback; provides learning signals                        | Feedback agent logs ratings, mission feedback; feeds learning signals to next runs                                   | Feedback Drawer (per-artifact ratings, mission feedback form, learning signals)                            | Feedback adoption ≥60%; signals captured for iteration        | 1-2 min     | `artifact_feedback_submitted`, `mission_feedback_submitted`                        |

**Total Time Budget:** 12–15 minutes from intake to feedback
**Key Metrics:** Chip acceptance ≥70% (without regeneration), inspection pass ≥85%, dry-run <15 min p95, feedback adoption ≥60%, coverage meter accuracy, planner insight rail engagement

---

### 3.2 Journey Map: Governed Activation (Gate G-C Focus)

**Goal:** Omar (Support Lead) activates safeguarded response automation.

#### Stages

| Stage                             | User Actions                                                                   | Agent Actions                                                                 | UI Touchpoints                                                                | Success Criteria                               |
| --------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------- |
| **1. Generated Connection Plan**  | Reviews auto-suggested toolkit + scope plan (Zendesk triage + Slack summaries) | Builds connection checklist, scopes, quiet hours from brief & historical runs | Connection Planner Panel with toggle chips ("Zendesk Reply", "Slack Digest")  | User enables/edits suggested connections       |
| **2. Safeguard Auto-Tune**        | Reviews generated tone, timing, escalation hints                               | Planner/validator refine hints using mission context                          | Safeguard Drawer with "Accept", "Edit", "Regenerate" controls                 | Hints accepted or tailored                     |
| **3. Governed Execution Trigger** | Accepts generated mission start prompt                                         | Validator checks hints before execution                                       | Pre-flight checklist showing active safeguards                                | Safeguards confirmed or amended                |
| **4. Approval Checkpoint**        | Reviews generated response + suggested edits                                   | Validator surfaces tone check results, undo plan, recommended edits           | Approval Modal with generative suggestions ("Apply suggested tone softener?") | User approves, tweaks, or regenerates portions |
| **5. Live Execution**             | Clicks "Approve & Send"                                                        | Executor posts Zendesk reply, logs tool call, captures latency                | Execution Confirmation: "Reply sent... Undo available"                        | Action completes; evidence stored              |
| **6. Undo Safety Net**            | Clicks "Undo" within 10 minutes                                                | Evidence service deletes reply, updates Zendesk, logs rollback                | Undo Status: "Reply removed, ticket restored to 'Open'"                       | User rolls back confidently                    |

**Total Time Budget:** 3–5 minutes per approval cycle
**Key Metrics:** Approval throughput, safeguard feedback adoption, undo success rate, time-to-fix

---

### 3.3 Journey Map: Governance Audit (Gate G-C Focus)

**Goal:** Priya (Governance Officer) audits a mission for compliance.

#### Stages

| Stage                            | User Actions                                            | Agent Actions                                                         | UI Touchpoints                                                                      | Success Criteria                                |
| -------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------- |
| **1. Dashboard Access**          | Navigates to Governance Dashboard                       | Generates KPI tiles & summaries from latest runs                      | Dashboard Home with auto-generated narrative badges ("No critical incidents in 7d") | Quick situational awareness                     |
| **2. Mission Drill-Down**        | Clicks mission ID to view evidence bundle               | Auto-highlights anomalies, safeguard feedback, unusual edits          | Mission Detail Page with generated callouts ("Tone hint edited 1x")                 | Full audit trail visible + insights             |
| **3. Safeguard Feedback Review** | Filters hints by outcome (auto-fixed, edited, rejected) | Summarises clusters, recommends follow-ups                            | Feedback table + generative sidebar ("Tone hints auto-applied 82%")                 | Priya identifies patterns, requests tuning      |
| **4. Export for External Audit** | Clicks "Export Evidence Bundle (PDF)"                   | Generates redacted report, auto-includes generative executive summary | Download Modal: "Evidence bundle ready, includes approvals, tool calls, undo logs"  | Compliance-ready artefact                       |
| **5. Safeguard Tuning**          | Reviews prompt recommendations before editing           | Suggests refined hints with impact projections                        | Safeguard Editor with "Accept" + inline diff view                                   | Safeguard prompts updated with rationale stored |

**Total Time Budget:** 10–15 minutes per audit
**Key Metrics:** Audit completion time, export download success, policy update adoption

---

## 4. Mission Workspace Anatomy

### 4.1 Layout Structure

The mission workspace is a persistent, chat-first interface powered by CopilotKit's CoAgents model. It combines conversational AI with structured controls and generative UI.

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Global Nav: Logo | Missions | Library | Dashboard | Settings]      │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Generative Intake Banner                                       │ │
│ │ Paste intent + links → [Generate Mission]                      │ │
│ │ · Shows token count, privacy notice, sample prompts            │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────┬────────────────────────────────────────┐   │
│ │  Mission Sidebar     │  Mission Canvas (Primary Workspace)    │   │
│ │  ─────────────────   │  ──────────────────────────────────    │   │
│ │                      │  ┌───────────────────────────────────┐ │   │
│ │  Active Missions     │  │ Generated Brief Stack             │ │   │
│ │  ─────────────       │  │ • Objective chip row (editable)  │ │   │
│ │  • Mission #42       │  │ • Audience chip row (editable)   │ │   │
│ │  • Mission #38       │  │ • Safeguard hints                │ │   │
│ │                      │  │   [Edit] [Regenerate] [Accept]    │ │   │
│ │  Recent              │  └───────────────────────────────────┘ │   │
│ │  ─────────────       │                                         │   │
│ │  • Mission #35       │  ┌───────────────────────────────────┐ │   │
│ │  • Mission #29       │  │ Agent Chat (Streaming)            │ │   │
│ │                      │  │                                   │ │   │
│ │  [+ New Mission]     │  │ Agent: Generated 3 plays…         │ │   │
│ │                      │  │ User: Soften tone for execs.      │ │   │
│ │                      │  │ Agent: Updated preview below.     │ │   │
│ │                      │  │                                   │ │   │
│ │                      │  │ [Message Input]                   │ │   │
│ │                      │  └───────────────────────────────────┘ │   │
│ │                      │                                         │   │
│ │                      │  ┌───────────────────────────────────┐ │   │
│ │                      │  │ Generated Plays (Cards)           │ │   │
│ │                      │  │ [Play 1] [Play 2] [Regenerate]    │ │   │
│ │                      │  └───────────────────────────────────┘ │   │
│ │                      │                                         │   │
│ │                      │  ┌───────────────────────────────────┐ │   │
│ │                      │  │ Safeguard & Auth Drawer           │ │   │
│ │                      │  │ Tone: Professional (edit)        │ │   │
│ │                      │  │ Scopes: HubSpot read/write (✎)   │ │   │
│ │                      │  └───────────────────────────────────┘ │   │
│ │                      │                                         │   │
│ └──────────────────────┴────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Component Hierarchy

- **Global Nav:** Persistent access to missions, library, analytics, settings
- **Mission Sidebar:** Active/recent missions, quick navigation
- **Mission Canvas:** Primary interaction surface
- **Generative Intake Banner:** Single text input with sample prompts, privacy note, and generation trigger
- **Generated Brief Stack:** Goal, audience, timeframe, safeguard hints surfaced as editable chips with confidence badges
- **Mission Brief Card:** Persisted version of accepted brief with status badges
  - **Agent Chat Panel:** CopilotKit chat with streaming agent updates
- **Generated Play Cards:** Auto-ranked plays with impact/risk/undo metadata and regenerate/accept actions
- **Safeguard & Auth Drawer:** Generated safeguard recommendations, OAuth scope plan, quiet hour suggestions with edit controls
  - **Artifact Previews:** Expandable evidence (drafts, lists, schedules)
  - **Approval Modals:** Overlay for safeguard feedback, OAuth, undo confirmations

---

## 5. Interaction Patterns & UI Components

### 5.1 Generative Intake Panel

**Pattern:** Single freeform input → generated structured brief

**Why:** Minimizes friction; users paste any context (press release, links, OKRs) and the system infers objectives, audiences, safeguards, and KPIs automatically while preserving editability.

**Component:** `<GenerativeIntakeBanner>`

**Interaction Steps:**

1. User clicks "+ New Mission" or lands on empty state.
2. Banner displays a large textarea with placeholder examples and privacy notice.
3. User pastes text/links and hits "Generate mission" (Enter or button).
4. System streams generated objective, audience, safeguards, KPIs, and suggested success metrics with confidence badges.
5. Each generated item appears as an editable chip (e.g., `[Objective ▾ Edit | Regenerate | Replace with template]`).
6. User accepts all, edits individual chips, or regenerates sections before continuing to play selection.

**Accessibility:**

- Textarea supports paste via keyboard, drag-and-drop, and `Ctrl+Enter` to generate.
- Generated chips announced via live region with summary ("Objective generated: Re-engage 100 dormant accounts; confidence high").
- Edit buttons accessible via Tab; `R` key triggers regenerate for focused chip; `Enter` opens inline editor.

---

### 5.2 Recommended Tool Palette

**Pattern:** Curated Composio tool cards with auth badges and precedent cues guide users toward the best toolkit mix before MCP planning begins.

**Why:** Users stay in control by deciding which integrations the AI employee can touch. Presenting no-auth options first helps pilots stay credential-light, while clearly labeled OAuth-ready tools accelerate trust once value is proven.

**Component:** `<RecommendedToolStrip>` + `<ToolCard>`

**Interaction Steps:**

1. Planner responds to mission brief by streaming a row of tool cards sourced from `Composio.tools.get` and `toolkits.list` (see `libs_docs/composio/llms.txt`).
2. Each card displays: toolkit logo, short description, badge for `No credentials needed` / `Requires OAuth`, impact estimate, precedent missions, and undo confidence.
3. Users toggle cards on/off or expand to adjust optional parameters (scope, sandbox, sample size). Multi-select is supported with keyboard and pointer.
4. Selections persist immediately to Supabase (`mission_safeguards` with `hint_type='toolkit_recommendation'`) and drive a draft MCP inspection pass.
5. CopilotKit shows inspection results inline (e.g., "Fetched 5 sample contacts"), highlighting any guardrail mismatches before the plan crystalizes.
6. Users can regenerate suggestions, pin favorites, or request alternatives ("Show me finance tools") via quick actions.

**Accessibility:**

- Cards are rendered as ARIA radio/checkbox hybrids with full keyboard support (`Space` toggles selection, `Shift+Arrow` multi-select).
- Auth badges include text + icon pairings, announced to screen readers ("Requires OAuth scope: hubspot.crm.write").
- Live region announces inspection results and validation checklist status.

**Empty States:**

- If no matching toolkits, display "No tools yet" message with quick actions: `Broaden search`, `Use library-only plan`, `Request human guidance`.
- Provide learn-more link to partner docs and reason codes from Composio for transparency.

**Telemetry:** `toolkit_recommendation_viewed`, `toolkit_selected`, `toolkit_deselected`, `inspection_preview_rendered`, `plan_validated`.

---

### 5.3 Generated Play Selection & Ranking

**Pattern:** Auto-generated cards with inline metadata + regenerate controls

**Why:** The system can infer the smallest effective workflows; users confirm or tweak instead of crafting plans manually.

**Component:** `<PlayCard>`

**Card Anatomy:**

```
┌────────────────────────────────────────────────┐
│ Play 1: Enrich + Draft Campaign                │
│ ────────────────────────────────────            │
│ Impact: 87 contacts, 3–5% reply rate estimate  │
│ Risk: Low (no-auth, drafts only)               │
│ Undo: Delete drafts, revert CRM fields         │
│                                                 │
│ Toolkits: HubSpot (no-auth), Clearbit (no-auth)│
│                                                 │
│ [Select Play] [Why This?]                      │
└────────────────────────────────────────────────┘
```

**Interaction Steps:**

1. System renders Top 3 plays with rationale; each card shows a confidence badge (High/Medium) and "Regenerate" pill.
2. User hovers "Why This?" → Tooltip: "Generated from library match to agencies (success 85%)."
3. User can inline edit impact or undo plan by clicking chip icons, or press `Shift+R` to regenerate the focused card.
4. Click "Accept" to lock selected play and proceed (card collapses; streaming status opens). Users can accept multiple plays for sequencing.

**Accessibility:**

- Arrow keys to navigate cards
- Screen reader announces impact/risk/undo
- "Why This?" tooltip accessible via focus

---

### 5.4 Streaming Status Panel

**Pattern:** Live Progress Narration with Collapsible Steps

**Why:** Reduces "black box" anxiety; users see what's happening.

**Component:** `<StreamingStatusPanel>`

**Appearance:**

```
┌────────────────────────────────────────────────┐
│ Executing: Enrich + Draft Campaign             │
│ ────────────────────────────────────            │
│ ✓ Researching accounts (2m 34s)                │
│ ✓ Enriching contacts (4m 12s)                  │
│ ⏳ Drafting messages (in progress…)            │
│ ⬜ Assembling evidence bundle                   │
│                                                 │
│ [Expand Details] [Pause] [Cancel]              │
└────────────────────────────────────────────────┘
```

**Interaction Steps:**

1. Agent streams `copilotkit_emit_message` with step updates
2. UI updates in real-time (checkmark when step completes)
3. User clicks "Expand Details" → Shows tool call logs, latency, arguments (hashed)
4. User clicks "Pause" → Agent checkpoints state; "Resume" appears

**Accessibility:**

- Live region (ARIA `role="status"`) announces updates
- Pause/Cancel keyboard shortcuts (Ctrl+P, Ctrl+X)

---

### 5.5 Approval Modal (Safeguard Checkpoint)

**Pattern:** Interrupt-Driven Decision Point with Contextual Remediation

**Why:** Compliance demands explicit approvals; UX must minimize friction while maximizing clarity.

**Component:** `<ApprovalModal>`

**Modal Anatomy:**

```
┌────────────────────────────────────────────────┐
│ Safeguard Check-In                             │
│ ────────────────────────────────────            │
│ Proposed Message:                               │
│ "Your account has been flagged for inactivity. │
│  Reply now or we'll assume disinterest."       │
│                                                 │
│ Safeguard Hint: Keep tone warm-professional.   │
│ Suggested Fix: Replace “act now” with “we’d     │
│ love to reconnect soon.”                       │
│                                                 │
│ Undo Plan: Delete draft, revert contact status │
│                                                 │
│ Options:                                        │
│ [Apply Fix] [Edit Manually] [Send Anyway]       │
│ [Schedule Later]                               │
└────────────────────────────────────────────────┘
```

**Interaction Steps:**

1. Validator detects tone violation
2. Agent raises `CopilotInterrupt` → Modal overlays canvas
3. User reads proposed message, violation details, undo plan
4. User chooses:
   - **Edit Message:** Inline editor opens, revalidates on save
   - **Send Anyway:** Brief justification logged as safeguard feedback; governance notified via lightweight ping when confidence is low
   - **Cancel:** Mission status updates to `paused_safeguard_feedback`, prompting users to revisit later
   - **Reschedule:** Date/time picker → Tool call queued for later

**Accessibility:**

- Focus trap, Esc to reject
- Screen reader announces violation type, undo plan
- Keyboard shortcuts for common actions (E for Edit, R for Reject)

---

### 5.6 Artifact Preview Cards

**Pattern:** Expandable Evidence with Download/Share Actions

**Why:** Evidence must be browsable, shareable, and exportable.

**Component:** `<ArtifactCard>`

**Card Anatomy:**

```
┌────────────────────────────────────────────────┐
│ Artifact: Enriched Contact List                │
│ ────────────────────────────────────            │
│ 87 contacts | LinkedIn, HubSpot data           │
│                                                 │
│ [Preview] [Download CSV] [Share Link]          │
└────────────────────────────────────────────────┘
```

**Interaction Steps:**

1. User clicks "Preview" → Expandable table view (paginated)
2. User clicks "Download CSV" → Supabase Storage link downloads
3. User clicks "Share Link" → Generates expiring link (24h default)

**Accessibility:**

- Table announced as "87 rows, 5 columns"
- Download triggers focus shift to notification

---

### 5.7 Undo Button (Rollback Safety Net)

**Pattern:** Persistent Action with Confirmation

**Why:** Users need confidence that mistakes are reversible.

**Component:** `<UndoButton>`

**Appearance:**

```
[⟲ Undo: Delete reply to Ticket #12345]
```

**Interaction Steps:**

1. Button appears immediately after governed action completes
2. User clicks → Confirmation modal: "This will delete the Zendesk reply. Continue?"
3. User confirms → Evidence service executes undo plan
4. Success toast: "Reply removed, ticket restored to 'Open'"
5. Button grays out: "[✓ Undone]"

**Accessibility:**

- Keyboard shortcut: Ctrl+Z (context-aware)
- Screen reader announces "Undo available for 10 minutes"

---

## 6. Progressive Disclosure & Complexity Management

### 6.1 Beginner vs. Expert Views

**Challenge:** Beginners need simplicity; experts need depth.

**Solution:** Adaptive UI density with progressive disclosure.

| User Level       | Default View                                                 | Available Expansions                  |
| ---------------- | ------------------------------------------------------------ | ------------------------------------- |
| **Beginner**     | Single input banner, generated brief, recommended play       | Toolkit details, safeguard quick tips |
| **Intermediate** | + Safeguard drawer, artefact previews, regenerate controls   | Tool call logs, library rankings      |
| **Expert**       | + Telemetry panels, approval history, full generation traces | Raw API payloads, embedding vectors   |

**Implementation:**

- **Beginner Mode (default):** Hides "Advanced Options" accordion
- **Expert Toggle:** Settings → "Show advanced telemetry" → Expands panels
- **Contextual Expansion:** "Learn more" links inline (e.g., "Why this toolkit?" → Opens toolkit modal)

---

### 6.2 Collapsible Sections

**Use Cases:**

- Safeguard history (collapsed by default; expand to inspect)
- Tool call logs (collapsed; expand for debugging)
- Mission history (collapsed; expand to view past runs)

**Pattern:**

```
┌────────────────────────────────────────────────┐
│ ▶ Safeguard History (last 3 hints)            │
└────────────────────────────────────────────────┘

[User clicks ▶]

┌────────────────────────────────────────────────┐
│ ▼ Safeguard History (last 3 hints)            │
│ ────────────────────────────────────            │
│ Tone hint accepted 2h ago (auto-fix applied)    │
│ Quiet window edited yesterday (shifted 1 h)     │
│ Escalation skipped today (exec override)        │
│ [Open Feedback Stream]                          │
└────────────────────────────────────────────────┘
```

**Accessibility:**

- ARIA `aria-expanded` states
- Keyboard: Space to toggle

---

### 6.3 Contextual Help & Tooltips

**Use Cases:**

- Toolkit badges ("no-auth" → Tooltip: "No credentials required; drafts only")
- Play impact estimates (hover "3–5% reply rate" → Tooltip: "Based on 12 similar campaigns in library")
- Safeguard prompts (hover chips to see why a hint was generated)

**Pattern:**

- Subtle "?" icon or dotted underline
- Hover or focus triggers tooltip (accessible via keyboard)
- Tooltip dismisses on Esc or click outside

---

## 7. Adaptive Safeguards UX

### 7.1 Safeguard Drawer

**Location:** Mission Canvas, beside the generated brief.

**Appearance:**

```
┌────────────────────────────────────────────────┐
│ Adaptive Safeguards                             │
│ ────────────────────────────────────            │
│ Tone Hint: Warm-professional (confidence 0.82) │
│ Quiet Window: 8 pm–7 am tenant local           │
│ Budget Nudge: Keep spend under $500            │
│ Escalate To: Rina Patel for high-risk sends    │
│                                                 │
│ [Accept All] [Edit Individually] [Regenerate]   │
└────────────────────────────────────────────────┘
```

**Interactions:**

- _Accept All_ locks hints in and emits `safeguard_hint_applied`.
- _Edit_ opens inline controls (dropdowns, sliders, text areas) to refine tone wording, timing, or assignee.
- _Regenerate_ prompts for optional context (e.g., “Sounds more casual”) and updates the chip with a new suggestion.
- _Pin_ marks a hint as a preferred seed for future missions.

### 7.2 Safeguard Feedback Modal

When Validator spots a potential issue, the approval modal offers a focused remediation card rather than a policy wall.

```
┌────────────────────────────────────────────────┐
│ Safeguard Check-In                              │
│ ────────────────────────────────────            │
│ Suggested Fix: Replace “act now” with           │
│ “we’d love to reconnect soon.”                  │
│ Confidence: 0.78                                │
│                                                 │
│ [Apply Fix] [Edit Manually] [Send Anyway]       │
│ [Schedule Later]                                │
└────────────────────────────────────────────────┘
```

**Principles:**

- Highlight one action at a time with a short rationale.
- “Send Anyway” requests a quick justification and logs a safeguard feedback event for analytics.
- “Schedule Later” surfaces times outside the suggested quiet window.
- Chips representing hints (tone, quiet window, escalation) can be toggled on/off before approval.

### 7.3 Safeguard Feedback Stream

**Location:** Adaptive Safeguards section within the Analytics & Governance dashboard.

**List View:**

```
┌──────────────────────────────────────────────────────────────┐
│ Mission | Hint Type   | Outcome     | Time to Resolve        │
├──────────────────────────────────────────────────────────────┤
│ #42     | Tone        | Auto-fixed  | 2 min                  │
│ #38     | Quiet Time  | Rescheduled | 15 min                 │
│ #35     | Escalation  | Sent anyway | note: exec override    │
└──────────────────────────────────────────────────────────────┘
```

**Features:**

- Filter by persona, hint type, or outcome (auto-fixed, edited, rejected).
- Drill into a row to view context, original suggestion, reviewer notes, and whether follow-up is needed.
- Export CSV or PDF for compliance snapshots.
- Narrative summaries highlight weekly trends (e.g., “Tone hints auto-applied 82% of the time; consider softening base prompt.”).

---

## 8. Evidence & Analytics Storytelling

### 8.1 Evidence Bundle Structure

**Goal:** Package mission outcomes as shareable, auditable artifacts.

**Bundle Contents:**

- **Mission Brief:** Goal, audience, timeframe, status (generated + final edits logged)
- **Toolkits Used:** Names, scopes, connection IDs (initial suggestion vs. accepted)
- **Tool Calls:** Hashed arguments, results (redacted if sensitive), latency, undo plans
- **Artifacts:** Drafts, lists, schedules (downloadable)
- **Safeguard Summary:** Accepted hints, auto-fixes, reviewer notes
- **ROI Estimates:** Contacts enriched, messages sent, reply rates, time saved (generated projections vs. actual outcomes)
- **Telemetry Summary:** Execution time, agent reasoning steps, approval decisions

**Access Paths:**

1. Mission Canvas → "Download Evidence Bundle (PDF)"
2. Governance Dashboard → Mission drill-down → "Export Bundle"
3. Supabase API → `/evidence/:mission_id` (for programmatic access)

---

### 8.2 Analytics Dashboard (Executive View)

**Target Persona:** Carlos (COO), Emma (Revenue Lead)

**Dashboard Layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ AI Employee Control Plane — Analytics                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│ ┌─────────────┬─────────────┬─────────────┬─────────────┐           │
│ │ Weekly Jobs │ Dry-Run     │ Approval    │ Safeguard   │           │
│ │ Approved    │ Conversion  │ Throughput  │ Incidents   │           │
│ │ 247         │ 68%         │ 89%         │ 4.2%        │           │
│ │ +12% WoW    │ +5% WoW     │ -2% WoW     │ -1.1% WoW   │           │
│ └─────────────┴─────────────┴─────────────┴─────────────┘           │
│                                                                       │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ Trend: Weekly Approved Jobs (12 weeks)                       │   │
│ │ [Line chart: steady upward trend]                            │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                       │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ Library Reuse (Top Plays)                                     │   │
│ │ 1. Enrich + Draft Campaign (87 reuses, 85% success)          │   │
│ │ 2. Churn-Risk Response (64 reuses, 92% success)              │   │
│ │ 3. Code Fix + PR (43 reuses, 78% success)                    │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                       │
│ Filters: [Persona: All] [Date Range: Last 90 Days] [Export PDF]     │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Features:**

- **KPI Tiles:** Big numbers, week-over-week deltas, color-coded (green = improving, red = regressing)
- **Trend Charts:** Line charts for time-series, bar charts for categorical comparisons
- **Library Reuse Table:** Top plays ranked by reuse count, success score
- **Filters:** Persona, date range, mission status
- **Export:** PDF (for board decks), CSV (for analysis)
- **Narrative Summary:** Generative paragraph at top ("This week, approved jobs grew 12% driven by outreach play reuse") with edit/regenerate controls

**Accessibility:**

- Charts include data tables (keyboard-navigable)
- Screen reader announces KPI changes ("Weekly jobs approved increased by 12%")

---

### 8.3 Governance Dashboard (Compliance View)

**Target Persona:** Priya (Governance Officer)

**Dashboard Layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ AI Employee Control Plane — Governance                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│ ┌─────────────┬─────────────┬─────────────┬─────────────┐           │
│ │ Incidents   │ Override    │ Undo        │ Mean Time   │           │
│ │ (Last 30d)  │ Rate        │ Success     │ to Override │           │
│ │ 23          │ 8.2%        │ 97%         │ 4.2h        │           │
│ │ -5 MoM      │ +1% MoM     │ +2% MoM     │ -0.8h MoM   │           │
│ └─────────────┴─────────────┴─────────────┴─────────────┘           │
│                                                                       │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ Recent Incidents (Sortable Table)                             │   │
│ │ Mission | Type       | Severity | Status   | Resolved        │   │
│ │ #42     | Tone       | Low      | Resolved | 2h ago          │   │
│ │ #38     | Quiet Hour | High     | Override | Pending         │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                       │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ Override Register (Active)                                    │   │
│ │ Mission | Justification          | Expiry   | Approver       │   │
│ │ #38     | Urgent support case    | 6h left  | Priya K.       │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                       │
│ Filters: [Severity: All] [Status: All] [Export Audit Report (PDF)]  │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Features:**

- **Incident Table:** Click row → Drill-down with violation details, override justification, reviewer ID
- **Override Register:** Active overrides with expiry countdown; click to extend or revoke
- **Export Audit Report:** PDF with signatures, timestamps, evidence pointers (for external audits)
- **Narrative Insights:** Generative callouts summarizing incident patterns and recommending policy updates, with accept/rewrite options

---

## 9. Accessibility & Inclusive Design

### 9.1 WCAG 2.1 AA Compliance

**Commitment:** All UI components meet WCAG 2.1 Level AA standards.

| Guideline                   | Compliance Strategy                                                     | Implementation Notes                                  |
| --------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| **1.1 Text Alternatives**   | All icons, images, charts have alt text or ARIA labels                  | Chart data tables for screen readers                  |
| **1.3 Adaptable**           | Semantic HTML, logical tab order, responsive layouts                    | Use `<main>`, `<nav>`, `<article>`, `<aside>`         |
| **1.4 Distinguishable**     | 4.5:1 contrast ratio (text), 3:1 (UI components)                        | Tailwind color palette tested with Stark plugin       |
| **2.1 Keyboard Accessible** | All interactions keyboard-operable (Tab, Enter, Space, Esc, Arrow keys) | Focus indicators visible (2px outline, high contrast) |
| **2.4 Navigable**           | Skip links, landmark regions, breadcrumbs                               | "Skip to main content" link at top                    |
| **3.1 Readable**            | Plain language, readability grade 8–10, tooltips for jargon             | Hemingway App for copy review                         |
| **4.1 Compatible**          | Valid HTML, ARIA roles/states, tested with NVDA, JAWS, VoiceOver        | Automated testing with axe-core                       |

---

### 9.2 Keyboard Navigation Standards

**Global Shortcuts:**

- `N` — New Mission
- `D` — Dashboard
- `L` — Library
- `G` then `A` — Navigate to Analytics
- `G` then `G` — Navigate to Governance
- `Ctrl+Z` — Undo last action (context-aware)
- `Ctrl+P` — Pause agent execution
- `Ctrl+X` — Cancel mission
- `?` — Show keyboard shortcuts reference

**Component-Specific:**

- **Mission Sidebar:** Arrow keys to navigate, Enter to open
- **Play Cards:** Tab to focus, Arrow keys to navigate cards, Enter to select
- **Approval Modal:** Tab through options, Enter to confirm, Esc to reject
- **Artifact Cards:** Tab to focus, Space to expand, Arrow keys to navigate table rows

---

### 9.3 Screen Reader Support

**Live Regions:**

- Agent streaming status (ARIA `role="status"`, `aria-live="polite"`)
- Approval interrupts (ARIA `role="alert"`, `aria-live="assertive"`)
- Undo confirmations (ARIA `role="status"`, `aria-live="polite"`)

**Semantic Announcements:**

- "Mission #42 created"
- "Play 1 selected: Enrich + Draft Campaign"
- "Agent researching accounts, 2 minutes elapsed"
- "Approval required: Tone violation"
- "Undo successful: Reply removed"

---

### 9.4 Responsive & Mobile Considerations

**Mobile Strategy:** Progressive web app (PWA) with responsive breakpoints.

**Breakpoints:**

- **Desktop (1280px+):** Full sidebar + canvas layout
- **Tablet (768px–1279px):** Collapsible sidebar, stacked panels
- **Mobile (≤767px):** Bottom nav, single-column layout, chat-first UI

**Mobile-Specific UX:**

- Approval modals slide up from bottom (easier thumb reach)
- Artifact previews open in full-screen overlays
- Simplified safeguard summaries (collapsible by default)

---

## 10. Instrumentation & Telemetry Touchpoints

### 10.1 Event Tracking Strategy

**Goal:** Measure user behavior, agent performance, safeguard efficacy, and business outcomes.

**Tracking Layers:**

1. **Frontend Events:** User interactions (clicks, form submissions, approvals)
2. **Agent Events:** Agent reasoning steps, tool calls, interrupts
3. **Backend Events:** API calls, Supabase queries, safeguard evaluations

**Implementation:** Supabase Edge Functions + PostgREST views; optional export to external analytics (Amplitude, Mixpanel).

---

### 10.2 Key Event Catalog

| Event Name                     | Trigger                                            | Payload                                                                 | Purpose                                                   |
| ------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| `intent_submitted`             | User clicks "Generate mission" after pasting input | `mission_id`, `input_chars`, `link_count`, `user_id`                    | Track single-input adoption, detect overlong prompts      |
| `brief_generated`              | System produces objective/audience/safeguard set   | `mission_id`, `confidence_scores`, `generated_fields`                   | Measure generation quality, identify low-confidence areas |
| `brief_item_modified`          | User edits/regenerates a generated chip            | `mission_id`, `field`, `action` (edit/regenerate/accept), `delta_chars` | Understand where users intervene                          |
| `toolkit_suggestion_applied`   | User accepts generated toolkit/auth plan           | `mission_id`, `toolkit_list`, `scopes`, `edit_count`                    | Evaluate recommendation usefulness                        |
| `mission_created`              | User submits mission intake                        | `mission_id`, `goal`, `audience`, `timeframe`, `user_id`                | Adoption funnel, time-to-first-mission                    |
| `play_selected`                | User clicks "Select Play"                          | `mission_id`, `play_id`, `play_type`, `toolkit_names`                   | Play popularity, toolkit adoption                         |
| `dry_run_started`              | Agent begins execution                             | `mission_id`, `play_id`, `start_timestamp`                              | Latency tracking, success rate                            |
| `dry_run_completed`            | Evidence bundle assembled                          | `mission_id`, `duration_ms`, `artifact_count`, `roi_estimate`           | Time-to-evidence KPI, conversion funnel                   |
| `approval_required`            | Validator raises interrupt                         | `mission_id`, `hint_type`, `severity`, `suggested_fix`                  | Safeguard feedback rate, hint efficacy                    |
| `approval_decision`            | User approves/rejects                              | `mission_id`, `tool_call_id`, `decision`, `reviewer_id`, `edits`        | Approval throughput, reviewer behavior                    |
| `oauth_initiated`              | User clicks "Connect Toolkit"                      | `mission_id`, `toolkit_name`, `scopes_requested`                        | OAuth conversion, scope adoption                          |
| `oauth_completed`              | Token stored                                       | `mission_id`, `toolkit_name`, `connection_id`                           | OAuth success rate                                        |
| `governed_execution_completed` | Live action finishes                               | `mission_id`, `tool_call_id`, `latency_ms`, `result_hash`               | Execution latency, success rate                           |
| `undo_requested`               | User clicks "Undo"                                 | `mission_id`, `tool_call_id`, `reason`                                  | Undo frequency, failure analysis                          |
| `undo_completed`               | Evidence service rolls back                        | `mission_id`, `tool_call_id`, `success`                                 | Undo success rate                                         |
| `safeguard_hint_applied`       | User accepts a safeguard hint                      | `mission_id`, `hint_type`, `confidence`, `source`                       | Track hint adoption                                       |
| `safeguard_hint_rejected`      | User rejects or sends anyway                       | `mission_id`, `hint_type`, `reason`, `reviewer_id`                      | Identify where prompts need tuning                        |
| `evidence_bundle_exported`     | User downloads PDF/CSV                             | `mission_id`, `format`, `user_id`                                       | Artifact sharing, stakeholder engagement                  |
| `dashboard_viewed`             | User navigates to analytics                        | `dashboard_type`, `filters`, `user_id`                                  | Dashboard adoption, filter patterns                       |

---

### 10.3 Telemetry Privacy & Redaction

**Principles:**

- **No sensitive data in logs:** Hash arguments, redact PII before storing
- **Granular consent:** Users opt into telemetry; governance teams review redaction policies
- **Audit trails:** All telemetry includes `user_id`, `mission_id`, `timestamp` for compliance

**Implementation:**

- Evidence service hashes arguments using SHA-256 before logging to `tool_calls` table
- Supabase Edge Function redacts PII (emails, phone numbers, SSNs) from `copilot_messages` before analytics export
- Governance dashboard includes "Redaction Log" showing redacted fields per mission

---

## 11. Cross-References & Implementation Tie-Ins

### 11.1 Architecture Mapping

| UX Component              | Architecture Reference       | Implementation Assets                            |
| ------------------------- | ---------------------------- | ------------------------------------------------ |
| Mission Intake Modal      | `architecture.md §3.1`       | `src/app/(control-plane)/MissionIntake.tsx`      |
| Streaming Status Panel    | `architecture.md §4.1`       | CopilotKit `copilotkit_emit_message` integration |
| Approval Modal            | `architecture.md §3.1, §4.3` | `src/app/components/ApprovalModal.tsx`           |
| Play Recommendation Cards | `architecture.md §3.2`       | Planner agent output, Supabase `plays` table     |
| Artifact Preview Cards    | `architecture.md §3.5`       | `artifacts` table, Supabase Storage              |
| Safeguard Drawer          | `architecture.md §3.1`       | `src/app/components/SafeguardDrawer.tsx`         |
| Undo Button               | `architecture.md §3.5`       | Evidence service `execute_undo` endpoint         |
| Analytics Dashboard       | `architecture.md §3.6`       | Next.js server components, PostgREST views       |
| Governance Dashboard      | `architecture.md §3.7`       | `src/app/(governance)/dashboard/page.tsx`        |

---

### 11.2 Safeguard Alignment

| UX Surface               | Supporting Document                                    | Implementation Notes                                                |
| ------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------- |
| Safeguard Drawer         | `architecture.md §3.7`, `prd.md` (Adaptive Safeguards) | Render generated hints with confidence + edit/regenerate actions    |
| Safeguard Feedback Modal | `architecture.md §4.3`                                 | Present quick fixes, log outcomes to safeguard feedback stream      |
| Governance Dashboard     | `architecture.md §3.6`, `todo.md` (Gates G-C/G-D)      | Show safeguard feedback stream, narrative summaries, export options |
| Analytics Telemetry      | `architecture.md §7`, `todo.md` (telemetry audits)     | Track hint adoption, auto-fix rate, send-anyway justifications      |

---

### 11.3 PRD Value Proposition Realization

| PRD Differentiator            | UX Manifestation                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Zero-to-value runway**      | Dry-run proof loop completes in <15 min (Mission Intake → Evidence Bundle)                           |
| **Proven outcomes**           | ROI estimates in Artifact Cards ("87 contacts, 3–5% reply rate"), library reuse metrics in Analytics |
| **Human-centered copilot UX** | CopilotKit chat, approval modals, inline edits, "Why This?" tooltips                                 |
| **Adaptive safeguards**       | Safeguard Drawer, feedback modal, undo-first approvals                                               |
| **Compounding library**       | Play Recommendation Cards surface top plays from library; Analytics shows reuse trends               |

---

### 11.4 Gate-by-Gate UX Delivery

| Gate                          | UX Deliverables                                                                   | Acceptance Evidence                                                    |
| ----------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **G-A (Foundation)**          | Generative Intake Modal, CopilotKit workspace scaffold, Safeguard Drawer scaffold | Screenshots in `docs/readiness/copilotkit_qa_G-A/`                     |
| **G-B (Dry-Run Proof)**       | Streaming Status Panel, Play Cards, Artefact Previews, Safeguard feedback logging | QA video in `docs/readiness/copilotkit_session_G-B.mp4`                |
| **G-C (Governed Activation)** | Safeguard feedback modal, OAuth flow, undo-first approvals                        | Approval feed export in `docs/readiness/approval_feed_export_G-C.json` |
| **G-D (Analytics)**           | Analytics Dashboard, Safeguard feedback stream, Library Recommendations           | Dashboard QA video in `docs/readiness/dashboard_qa_G-D.mp4`            |
| **G-E (Scale Hardening)**     | Mobile responsive breakpoints, accessibility audit report                         | Accessibility report in `docs/readiness/accessibility_audit_G-E.pdf`   |

---

## Appendices

### Appendix A: UI Component Checklist (Gate G-B)

- [ ] `<GenerativeIntakeBanner>` — Single textarea, sample prompts, privacy note, generate CTA
- [ ] `<GeneratedChipRow>` — Editable chips for objective, audience, safeguards with confidence badges and regenerate controls
- [ ] `<MissionBriefCard>` — Display final accepted brief with status badges
- [ ] `<PlayCard>` — Impact, risk, undo, toolkits, "Accept", "Regenerate", "Why This?"
- [ ] `<StreamingStatusPanel>` — Live progress, checkmarks, "Expand Details", "Pause", "Cancel"
- [ ] `<ArtifactCard>` — Preview, Download CSV, Share Link
- [ ] `<SafeguardDrawer>` — Tone, timing, escalation hints with Accept/Edit/Regenerate controls
- [ ] `<ApprovalModal>` — Safeguard hint, suggested fix, "Apply", "Edit", "Send Anyway", "Schedule"
- [ ] `<UndoButton>` — "Undo: [action description]", confirmation modal
- [ ] `<CopilotChat>` — CopilotKit agent chat with streaming updates

### Appendix B: Accessibility Audit Checklist (Gate G-E)

- [ ] All components tested with NVDA, JAWS, VoiceOver
- [ ] All interactions keyboard-operable (Tab, Enter, Space, Esc, Arrow keys)
- [ ] Focus indicators visible (2px outline, 4.5:1 contrast)
- [ ] ARIA roles/states correct (`role="status"`, `aria-live="polite"`, `aria-expanded`)
- [ ] Color contrast meets WCAG 2.1 AA (4.5:1 text, 3:1 UI components)
- [ ] Skip links, landmark regions, breadcrumbs implemented
- [ ] Keyboard shortcuts documented, "?" shortcut displays reference
- [ ] Mobile responsive breakpoints tested (320px, 768px, 1280px)
- [ ] Automated testing with axe-core passes
- [ ] Manual testing with users with disabilities (if feasible)

### Appendix C: Instrumentation Verification (Gate G-C)

- [ ] All events in catalog tracked with correct payloads (including `intent_submitted`, `brief_generated`, `brief_item_modified`, `toolkit_suggestion_applied`)
- [ ] Supabase Edge Functions log events to analytics tables
- [ ] Privacy redaction enforced (hashed arguments, PII removed)
- [ ] Export APIs (`/evidence/:mission_id`, `/analytics/export`) functional
- [ ] Analytics views queryable via PostgREST
- [ ] Dashboard filters tested (persona, date range, mission status)
- [ ] Event correlation working (mission → plays → tool_calls → approvals)

---

## Conclusion

This UX blueprint establishes a foundation for an **elegant, loved-by-users mission workspace** that balances AI autonomy with human oversight. By centering on **trust through transparency**, **progressive trust**, and **radically reversible actions**, the AI Employee Control Plane empowers users to prove value quickly, govern confidently, and scale safely.

The design aligns with Gate G-A expectations (dry-run focus) and extends toward governed activation (Gate G-C), with clear paths to analytics (Gate G-D) and scale hardening (Gate G-E). Every interaction pattern, component, and telemetry touchpoint ties back to the PRD's value proposition and the architecture blueprint.

**Next Steps:**

1. Review with Product, Design, Governance stakeholders
2. Validate generative quality metrics (confidence scoring, edit rate) alongside WCAG audit commitments
3. Build component library (Storybook) per Appendix A checklist
4. Instrument analytics per Appendix C verification
5. Iterate based on user testing and Gate promotion feedback

---

**Maintained by:** Product Design Lead
**Last Updated:** October 8, 2025
**Cross-References:** `prd.md`, `architecture.md`, `todo.md`
