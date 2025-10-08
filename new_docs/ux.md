# AI Employee Control Plane — UX Blueprint

**Version:** 1.0 (October 8, 2025)
**Audience:** Product, Design, Engineering, Governance
**Status:** Active UX vision and interaction model

---

## Executive Summary

This UX blueprint defines the user experience strategy for the AI Employee Control Plane — a mission workspace that converts a single freeform input (links, goals, context) into fully generated missions, objectives, toolkits, audiences, and guardrails that remain editable at every step. The design centers on **trust through visibility**: users provide intent once, then maintain control as the system proposes, auto-populates, and iterates on the plan.

The experience prioritizes:
- **Single-input onboarding** — users paste one prompt; the workspace generates structured objectives, personas, constraints, and plays
- **Generative defaults with human oversight** — every recommendation is editable, traceable, and easy to accept, refine, or replace
- **Zero-to-value in <15 minutes** — from initial input to reviewable proof pack
- **Progressive trust** — dry-run first, governed activation when ready
- **Continuous visibility** — streaming agent reasoning, guardrail enforcement, evidence trails
- **Human-centered approvals** — collaborative decision points, not gatekeeping friction
- **Accessibility & inclusion** — WCAG 2.1 AA compliance, keyboard navigation, screen reader support

---

## Table of Contents

1. [Design Philosophy & Principles](#1-design-philosophy--principles)
2. [User Personas & Jobs-to-Be-Done](#2-user-personas--jobs-to-be-done)
3. [Core User Journeys](#3-core-user-journeys)
4. [Mission Workspace Anatomy](#4-mission-workspace-anatomy)
5. [Interaction Patterns & UI Components](#5-interaction-patterns--ui-components)
6. [Progressive Disclosure & Complexity Management](#6-progressive-disclosure--complexity-management)
7. [Guardrail Transparency & Override UX](#7-guardrail-transparency--override-ux)
8. [Evidence & Analytics Storytelling](#8-evidence--analytics-storytelling)
9. [Accessibility & Inclusive Design](#9-accessibility--inclusive-design)
10. [Instrumentation & Telemetry Touchpoints](#10-instrumentation--telemetry-touchpoints)
11. [Cross-References & Implementation Tie-Ins](#11-cross-references--implementation-tie-ins)

---

## 1. Design Philosophy & Principles

### 1.1 Core Tenets

**Generative by Default, Editable by Design**
The workspace ingests a single freeform input and produces structured objectives, audiences, guardrails, and plays automatically. Every generated element is surfaced with edit, replace, or reject affordances so users stay in control.

**Trust Through Transparency**
Every agent action, guardrail check, and execution step surfaces in real-time. Users never wonder "what is it doing?" — they see reasoning, evidence, and undo plans as work unfolds.

**Progressive Trust Model**
Start with zero-privilege dry runs (drafts, lists, schedules). Once value is proven, users opt into governed activation with OAuth scopes, approvals, and enforcement.

**Human-Centered Copilot, Not Autonomous Autopilot**
The agent is a collaborative partner, not a replacement. Approval moments are designed as constructive checkpoints — users refine, approve, or redirect with minimal friction.

**Objective-First, Not Tool-First**
Users describe goals and constraints once; the system recommends toolkits, plays, and workflows based on capability grounding and library intelligence, while keeping manual overrides simple.

**Radically Reversible**
Every mutating action includes an undo plan. Users can roll back with confidence, and governance teams audit rollback success rates.

### 1.2 Design Principles

| Principle | What It Means | How It Shapes UX |
|-----------|---------------|------------------|
| **Generative Scaffolding** | System proposes objectives, audiences, toolkits automatically, always editable | Chips, inline editors, "Regenerate" buttons on every generated section |
| **Clarity Over Cleverness** | Simple, direct language beats jargon; status updates beat spinners | Plain language mission briefs, progress narration, explicit error messages |
| **Guardrails as Guidance** | Constraints are helpers, not barriers | Inline guardrail summaries, proactive override paths, contextual help |
| **Evidence Before Execution** | Prove value with artifacts before requesting credentials | Dry-run proofs with sample outputs, ROI estimates, risk disclosures |
| **Adaptive Density** | Surface complexity only when needed; beginners see essentials, experts access depth | Collapsible sections, contextual expansion, role-based views |
| **Feedback Loops at Every Step** | Users confirm direction before agents commit resources | Approval modals, play selection, guardrail overrides, undo confirmations |
| **Instrumentation as a First-Class Citizen** | Telemetry touchpoints are baked into flows, not bolted on | Inline event tracking, analytics handoffs, evidence capture |

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
- Generative starting point that auto-creates objective, audience, guardrails, and outreach plan with inline edit controls

---

#### **P2: Customer Operations Leader (Omar)**

**Role:** Head of Support, high-growth e-commerce
**Goal:** Compress response times, prevent churn, uphold SLAs with blended human + agent workflows
**Pain Points:**
- Queue spikes overwhelm team; need triage automation
- Compliance requires approval trails for customer-facing actions
- Can't risk tone violations or accidental escalations

**JTBD:** "When churn-risk cases surface, I want guardrailed automations that propose responses and log evidence so my team meets SLAs confidently."

**UX Priorities:**
- Tone guardrails front-and-center in approval modals
- Undo buttons for every customer-facing action
- Clear evidence bundles for compliance audits
- Auto-generated guardrail-aware responses with quick edit/approve toggles

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
- Guardrail override register with expiry tracking
- Exportable evidence bundles (CSV, PDF) for external audits
- Generated policy summaries highlighting any inferred guardrail adjustments before activation

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
**Goal:** Justify agent expansion with dashboards summarizing ROI, approvals, guardrail events
**Pain Points:**
- Board demands quantified business impact
- Risk committee needs compliance posture
- Can't evaluate agent performance without telemetry

**JTBD:** "When presenting to the board, I want dashboards showing weekly approved jobs, ROI, and guardrail incident rates so I can justify budget and expansion."

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

#### Stages

| Stage | User Actions | Agent Actions | UI Touchpoints | Success Criteria |
|-------|--------------|---------------|----------------|------------------|
| **1. Single Input Capture** | Pastes one paragraph with objective, links, tone preferences: "We’re Acme SaaS..." | Parses text, extracts entities, infers personas, timeframe, tone | Generative Intake Panel with paste box + "Generate mission" CTA | Input accepted; generation kicks off |
| **2. Generated Brief Preview** | Reviews auto-created mission brief (objective, audience, KPIs, guardrails) | Builds structured brief, confidence scores, suggested edits | Brief Summary Card with inline chips + "Edit", "Regenerate" | User accepts or tweaks brief items |
| **3. Auto Toolkit & Auth Draft** | Scans brief, proposes toolkits, auth modes, quiet hours | Queries Composio catalog + Supabase data to recommend no-auth + OAuth paths | Toolkit & Auth Drawer with badges ("Connect later", "No Auth") | User accepts defaults or swaps | 
| **4. Generated Play Ranking** | Picks from 3 generated plays ("Enrich + Draft Campaign", etc.) | Planner ranks plays, attaches rationale, undo plans | Play Cards with impact, risk, "Regenerate" button | Preferred play selected with minimal edits |
| **5. Dry-Run Execution** | Clicks "Run Draft" (auto-populated) | Executor uses chosen plan, streams progress | Streaming status panel: "Researching accounts…" etc. | <15 min to evidence bundle |
| **6. Evidence Review** | Reviews generated artifacts, ROI estimate, optional adjustments | Evidence agent assembles bundles, highlights suggested modifications | Artifact Previews + inline edit toggles (e.g., edit draft email) | User comfortable with outputs, optionally refines |
| **7. Trust Decision** | Chooses "Approve & Connect" (with auto-suggested scopes) or "Regenerate" | Initiates OAuth flow with recommended scopes, or loops back | OAuth Modal pre-filled with recommended scopes + editable list | User grants scopes or requests new generation |

**Total Time Budget:** 12–15 minutes from intake to evidence
**Key Metrics:** Dry-run completion rate, time-to-evidence, approval-to-OAuth conversion

---

### 3.2 Journey Map: Governed Activation (Gate G-C Focus)

**Goal:** Omar (Support Lead) activates guardrailed response automation.

#### Stages

| Stage | User Actions | Agent Actions | UI Touchpoints | Success Criteria |
|-------|--------------|---------------|----------------|------------------|
| **1. Generated Connection Plan** | Reviews auto-suggested toolkit + scope plan (Zendesk triage + Slack summaries) | Builds connection checklist, scopes, quiet hours from brief & historical runs | Connection Planner Panel with toggle chips ("Zendesk Reply", "Slack Digest") | User enables/edits suggested connections |
| **2. Guardrail Auto-Tune** | Sees generated quiet hours, tone rules based on tenant + mission | Suggests guardrail profile adjustments (e.g., "quiet hours 9pm–7am PST") with rationale | Guardrail Summary Card w/ "Accept", "Edit", "Regenerate" controls | Guardrails confirmed or adjusted |
| **3. Governed Execution Trigger** | Accepts generated mission start prompt | Validator checks tone, quiet hours, rate limits before execution | Pre-flight Validation Panel showing generated checklist | Guardrails enforced before action |
| **4. Approval Checkpoint** | Reviews generated response + suggested edits | Validator surfaces tone check results, undo plan, recommended edits | Approval Modal with generative suggestions ("Apply suggested tone softener?") | User approves, tweaks, or regenerates portions |
| **5. Live Execution** | Clicks "Approve & Send" | Executor posts Zendesk reply, logs tool call, captures latency | Execution Confirmation: "Reply sent... Undo available" | Action completes; evidence stored |
| **6. Undo Safety Net** | Clicks "Undo" within 10 minutes | Evidence service deletes reply, updates Zendesk, logs rollback | Undo Status: "Reply removed, ticket restored to 'Open'" | User rolls back confidently |

**Total Time Budget:** 3–5 minutes per approval cycle
**Key Metrics:** Approval throughput, guardrail incident rate, undo success rate, time-to-override-close

---

### 3.3 Journey Map: Governance Audit (Gate G-C Focus)

**Goal:** Priya (Governance Officer) audits a mission for compliance.

#### Stages

| Stage | User Actions | Agent Actions | UI Touchpoints | Success Criteria |
|-------|--------------|---------------|----------------|------------------|
| **1. Dashboard Access** | Navigates to Governance Dashboard | Loads missions, guardrail incidents, override register from Supabase | Dashboard Home: KPI tiles (incident rate, override rate, undo success) | Quick situational awareness |
| **2. Mission Drill-Down** | Clicks mission ID to view evidence bundle | Retrieves mission brief, tool calls, approvals, guardrail snapshots | Mission Detail Page: timeline, tool call log, guardrail summary | Full audit trail visible |
| **3. Guardrail Incident Review** | Filters incidents by severity, status | Evidence agent surfaces violation details, override tokens, resolution timestamps | Incident Table: sortable, filterable, exportable | Priya identifies patterns, escalates if needed |
| **4. Export for External Audit** | Clicks "Export Evidence Bundle (PDF)" | Supabase Edge Function generates redacted report with signatures | Download Modal: "Evidence bundle ready, includes approvals, tool calls, undo logs" | Compliance-ready artifact |
| **5. Policy Update** | Edits quiet hours or tone policy | Supabase triggers `/api/guardrails/refresh`, notifies active missions | Policy Editor: inline validation, "Changes apply to future missions" warning | Policy updated, missions inherit on next run |

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
│                                                                       │
│ ┌──────────────────────┬────────────────────────────────────────┐   │
│ │  Mission Sidebar     │  Mission Canvas (Primary Workspace)    │   │
│ │  ─────────────────   │  ──────────────────────────────────    │   │
│ │                      │                                         │   │
│ │  Active Missions     │  ┌───────────────────────────────────┐ │   │
│ │  ─────────────       │  │ Mission Brief (Card)              │ │   │
│ │  • Mission #42       │  │ Goal: Revive 100 dormant accounts │ │   │
│ │  • Mission #38       │  │ Audience: Enterprise SaaS          │ │   │
│ │                      │  │ Timeframe: 2 weeks                 │ │   │
│ │  Recent              │  │ Status: [Dry-run] [In Progress]   │ │   │
│ │  ─────────────       │  └───────────────────────────────────┘ │   │
│ │  • Mission #35       │                                         │   │
│ │  • Mission #29       │  ┌───────────────────────────────────┐ │   │
│ │                      │  │ Agent Chat (Streaming)            │ │   │
│ │  [+ New Mission]     │  │                                   │ │   │
│ │                      │  │ Agent: Researching accounts…      │ │   │
│ │                      │  │ User: How many contacts so far?   │ │   │
│ │                      │  │ Agent: 87 contacts enriched.      │ │   │
│ │                      │  │                                   │ │   │
│ │                      │  │ [Message Input]                   │ │   │
│ │                      │  └───────────────────────────────────┘ │   │
│ │                      │                                         │   │
│ │                      │  ┌───────────────────────────────────┐ │   │
│ │                      │  │ Recommended Plays (Cards)         │ │   │
│ │                      │  │ ─────────────────────────────     │ │   │
│ │                      │  │ [Play 1] [Play 2] [Play 3]        │ │   │
│ │                      │  └───────────────────────────────────┘ │   │
│ │                      │                                         │   │
│ │                      │  ┌───────────────────────────────────┐ │   │
│ │                      │  │ Guardrail Summary (Collapsible)   │ │   │
│ │                      │  │ Tone: Professional, Rate: 30/hr   │ │   │
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
  - **Mission Brief Card:** Goal, audience, timeframe, status badges
  - **Agent Chat Panel:** CopilotKit chat with streaming agent updates
  - **Play Recommendation Cards:** Top-3 plays with impact/risk/undo metadata
  - **Guardrail Summary:** Active policies, inline edits
  - **Artifact Previews:** Expandable evidence (drafts, lists, schedules)
  - **Approval Modals:** Overlay for guardrail checks, OAuth, undo confirmations

---

## 5. Interaction Patterns & UI Components

### 5.1 Mission Intake Flow

**Pattern:** Conversational + Structured Form Hybrid

**Why:** Balances flexibility (users describe goals naturally) with structure (agents need goal, audience, timeframe, guardrails).

**Component:** `<MissionIntakeModal>`

**Interaction Steps:**
1. User clicks "+ New Mission"
2. Modal appears with structured fields:
   - **Goal** (textarea, 280 chars): "What outcome do you want?"
   - **Audience** (text input): "Who is the target?"
   - **Timeframe** (date range picker): "When do you need this?"
   - **Guardrails** (multi-select): Tone, quiet hours, rate limits (defaults pre-filled)
3. User submits; modal closes; Mission Brief appears in canvas
4. Agent chat activates: "Great! Let me find the best toolkits for this…"

**Accessibility:**
- Keyboard navigation: Tab through fields, Enter to submit
- ARIA labels for all inputs
- Focus trap inside modal
- Esc to close

---

### 5.2 Play Selection & Ranking

**Pattern:** Card-Based Selection with Inline Metadata

**Why:** Visual comparison of options; users weigh impact vs. risk vs. complexity.

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
1. User reviews 3 cards side-by-side
2. Hovers "Why This?" → Tooltip: "Library shows 85% success rate for your persona"
3. Clicks "Select Play" → Agent starts dry-run execution
4. Card collapses; streaming status panel expands

**Accessibility:**
- Arrow keys to navigate cards
- Screen reader announces impact/risk/undo
- "Why This?" tooltip accessible via focus

---

### 5.3 Streaming Status Panel

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

### 5.4 Approval Modal (Guardrail Checkpoint)

**Pattern:** Interrupt-Driven Decision Point with Contextual Remediation

**Why:** Compliance demands explicit approvals; UX must minimize friction while maximizing clarity.

**Component:** `<ApprovalModal>`

**Modal Anatomy:**
```
┌────────────────────────────────────────────────┐
│ Approval Required: Tone Violation              │
│ ────────────────────────────────────            │
│ Proposed Message:                               │
│ "Your account has been flagged for inactivity. │
│  Reply now or we'll assume disinterest."       │
│                                                 │
│ Issue: Tone too aggressive; guardrail requires │
│        "professional" sentiment.                │
│                                                 │
│ Undo Plan: Delete draft, revert contact status │
│                                                 │
│ Options:                                        │
│ [Edit Message] [Override (Governance Approval)]│
│ [Reject] [Reschedule]                          │
└────────────────────────────────────────────────┘
```

**Interaction Steps:**
1. Validator detects tone violation
2. Agent raises `CopilotInterrupt` → Modal overlays canvas
3. User reads proposed message, violation details, undo plan
4. User chooses:
   - **Edit Message:** Inline editor opens, revalidates on save
   - **Override:** Justification textarea → Posts to `/api/guardrails/override` → Governance notified
   - **Reject:** Mission status → `blocked_guardrail`, logs decision
   - **Reschedule:** Date/time picker → Tool call queued for later

**Accessibility:**
- Focus trap, Esc to reject
- Screen reader announces violation type, undo plan
- Keyboard shortcuts for common actions (E for Edit, R for Reject)

---

### 5.5 Artifact Preview Cards

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

### 5.6 Undo Button (Rollback Safety Net)

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

| User Level | Default View | Available Expansions |
|------------|--------------|----------------------|
| **Beginner** | Mission brief, chat, top-3 plays | Toolkit details, guardrail editor |
| **Intermediate** | + Guardrail summaries, artifact previews | Tool call logs, library rankings |
| **Expert** | + Telemetry panels, approval history | Raw API payloads, embedding vectors |

**Implementation:**
- **Beginner Mode (default):** Hides "Advanced Options" accordion
- **Expert Toggle:** Settings → "Show advanced telemetry" → Expands panels
- **Contextual Expansion:** "Learn more" links inline (e.g., "Why this toolkit?" → Opens toolkit modal)

---

### 6.2 Collapsible Sections

**Use Cases:**
- Guardrail policies (collapsed by default; expand to edit)
- Tool call logs (collapsed; expand for debugging)
- Mission history (collapsed; expand to view past runs)

**Pattern:**
```
┌────────────────────────────────────────────────┐
│ ▶ Guardrail Policies (3 active)               │
└────────────────────────────────────────────────┘

[User clicks ▶]

┌────────────────────────────────────────────────┐
│ ▼ Guardrail Policies (3 active)               │
│ ────────────────────────────────────            │
│ Tone: Professional (forbidden: "aggressive")   │
│ Quiet Hours: 8pm–7am UTC                       │
│ Rate Limit: 30 calls/hour                      │
│ [Edit Policies]                                 │
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
- Guardrail violations (hover "Tone violation" → Tooltip: "Message contains forbidden phrase: 'aggressive'")

**Pattern:**
- Subtle "?" icon or dotted underline
- Hover or focus triggers tooltip (accessible via keyboard)
- Tooltip dismisses on Esc or click outside

---

## 7. Guardrail Transparency & Override UX

### 7.1 Guardrail Summary Card

**Location:** Mission Canvas, below Mission Brief

**Appearance:**
```
┌────────────────────────────────────────────────┐
│ Guardrails Active                               │
│ ────────────────────────────────────            │
│ Tone: Professional | Quiet Hours: 8pm–7am UTC  │
│ Rate Limit: 30/hr | Budget Cap: $50/day        │
│ Undo Required: Yes                              │
│                                                 │
│ [Edit Policies] [View Incidents]                │
└────────────────────────────────────────────────┘
```

**Interaction:**
- **Edit Policies:** Opens modal with inline validation; changes apply to future missions
- **View Incidents:** Navigates to Governance Dashboard, filtered to current mission

---

### 7.2 Override Request Flow

**Scenario:** User needs to send during quiet hours (e.g., urgent support case).

**Steps:**
1. Validator detects quiet hour violation
2. Approval modal appears with "Override (Governance Approval)" button
3. User clicks → Justification textarea: "Why is this urgent?"
4. User submits → Posts to `/api/guardrails/override`
5. Governance Sentinel receives Slack notification
6. Sentinel reviews, approves or rejects within SLA (24h)
7. User receives notification: "Override approved, mission resumed"
8. Override token expires automatically after 48h

**Accessibility:**
- Clear language: "This requires governance approval" (not "Access denied")
- Status updates via in-app notifications + email

---

### 7.3 Guardrail Incident Log

**Location:** Governance Dashboard

**Table View:**
```
┌────────────────────────────────────────────────────────────────────┐
│ Mission ID | Violation Type | Severity | Status    | Resolved   │
├────────────────────────────────────────────────────────────────────┤
│ #42        | Tone           | Low      | Resolved  | 2h ago     │
│ #38        | Quiet Hour     | High     | Override  | Pending    │
│ #35        | Rate Limit     | Medium   | Rejected  | 1d ago     │
└────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Sortable, filterable by severity, status, date
- Click row → Drill-down view with violation details, override justification, reviewer ID
- Export CSV or PDF for external audits

---

## 8. Evidence & Analytics Storytelling

### 8.1 Evidence Bundle Structure

**Goal:** Package mission outcomes as shareable, auditable artifacts.

**Bundle Contents:**
- **Mission Brief:** Goal, audience, timeframe, status
- **Toolkits Used:** Names, scopes, connection IDs
- **Tool Calls:** Hashed arguments, results (redacted if sensitive), latency, undo plans
- **Artifacts:** Drafts, lists, schedules (downloadable)
- **Guardrail Snapshots:** Active policies, violations, overrides
- **ROI Estimates:** Contacts enriched, messages sent, reply rates, time saved
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
│ │ Weekly Jobs │ Dry-Run     │ Approval    │ Guardrail   │           │
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

---

## 9. Accessibility & Inclusive Design

### 9.1 WCAG 2.1 AA Compliance

**Commitment:** All UI components meet WCAG 2.1 Level AA standards.

| Guideline | Compliance Strategy | Implementation Notes |
|-----------|---------------------|----------------------|
| **1.1 Text Alternatives** | All icons, images, charts have alt text or ARIA labels | Chart data tables for screen readers |
| **1.3 Adaptable** | Semantic HTML, logical tab order, responsive layouts | Use `<main>`, `<nav>`, `<article>`, `<aside>` |
| **1.4 Distinguishable** | 4.5:1 contrast ratio (text), 3:1 (UI components) | Tailwind color palette tested with Stark plugin |
| **2.1 Keyboard Accessible** | All interactions keyboard-operable (Tab, Enter, Space, Esc, Arrow keys) | Focus indicators visible (2px outline, high contrast) |
| **2.4 Navigable** | Skip links, landmark regions, breadcrumbs | "Skip to main content" link at top |
| **3.1 Readable** | Plain language, readability grade 8–10, tooltips for jargon | Hemingway App for copy review |
| **4.1 Compatible** | Valid HTML, ARIA roles/states, tested with NVDA, JAWS, VoiceOver | Automated testing with axe-core |

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
- Simplified guardrail summaries (collapsible by default)

---

## 10. Instrumentation & Telemetry Touchpoints

### 10.1 Event Tracking Strategy

**Goal:** Measure user behavior, agent performance, guardrail efficacy, and business outcomes.

**Tracking Layers:**
1. **Frontend Events:** User interactions (clicks, form submissions, approvals)
2. **Agent Events:** Agent reasoning steps, tool calls, interrupts
3. **Backend Events:** API calls, Supabase queries, guardrail evaluations

**Implementation:** Supabase Edge Functions + PostgREST views; optional export to external analytics (Amplitude, Mixpanel).

---

### 10.2 Key Event Catalog

| Event Name | Trigger | Payload | Purpose |
|------------|---------|---------|---------|
| `mission_created` | User submits mission intake | `mission_id`, `goal`, `audience`, `timeframe`, `user_id` | Adoption funnel, time-to-first-mission |
| `play_selected` | User clicks "Select Play" | `mission_id`, `play_id`, `play_type`, `toolkit_names` | Play popularity, toolkit adoption |
| `dry_run_started` | Agent begins execution | `mission_id`, `play_id`, `start_timestamp` | Latency tracking, success rate |
| `dry_run_completed` | Evidence bundle assembled | `mission_id`, `duration_ms`, `artifact_count`, `roi_estimate` | Time-to-evidence KPI, conversion funnel |
| `approval_required` | Validator raises interrupt | `mission_id`, `violation_type`, `severity`, `guardrail_snapshot` | Guardrail incident rate, policy efficacy |
| `approval_decision` | User approves/rejects | `mission_id`, `tool_call_id`, `decision`, `reviewer_id`, `edits` | Approval throughput, reviewer behavior |
| `oauth_initiated` | User clicks "Connect Toolkit" | `mission_id`, `toolkit_name`, `scopes_requested` | OAuth conversion, scope adoption |
| `oauth_completed` | Token stored | `mission_id`, `toolkit_name`, `connection_id` | OAuth success rate |
| `governed_execution_completed` | Live action finishes | `mission_id`, `tool_call_id`, `latency_ms`, `result_hash` | Execution latency, success rate |
| `undo_requested` | User clicks "Undo" | `mission_id`, `tool_call_id`, `reason` | Undo frequency, failure analysis |
| `undo_completed` | Evidence service rolls back | `mission_id`, `tool_call_id`, `success` | Undo success rate |
| `guardrail_override_requested` | User submits override | `mission_id`, `violation_type`, `justification`, `reviewer_id` | Override frequency, governance load |
| `guardrail_override_resolved` | Sentinel approves/rejects | `mission_id`, `override_token`, `decision`, `duration_h` | Time-to-override-close, policy adjustments |
| `evidence_bundle_exported` | User downloads PDF/CSV | `mission_id`, `format`, `user_id` | Artifact sharing, stakeholder engagement |
| `dashboard_viewed` | User navigates to analytics | `dashboard_type`, `filters`, `user_id` | Dashboard adoption, filter patterns |

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

| UX Component | Architecture Reference | Implementation Assets |
|--------------|------------------------|------------------------|
| Mission Intake Modal | `architecture.md §3.1` | `src/app/(control-plane)/MissionIntake.tsx` |
| Streaming Status Panel | `architecture.md §4.1` | CopilotKit `copilotkit_emit_message` integration |
| Approval Modal | `architecture.md §3.1, §4.3` | `src/app/components/ApprovalModal.tsx` |
| Play Recommendation Cards | `architecture.md §3.2` | Planner agent output, Supabase `plays` table |
| Artifact Preview Cards | `architecture.md §3.5` | `artifacts` table, Supabase Storage |
| Guardrail Summary Card | `guardrail_policy_pack.md §2` | `src/app/components/GuardrailSummary.tsx` |
| Undo Button | `architecture.md §3.5` | Evidence service `execute_undo` endpoint |
| Analytics Dashboard | `architecture.md §3.5` | Next.js server components, PostgREST views |
| Governance Dashboard | `guardrail_policy_pack.md §5` | `src/app/(governance)/dashboard/page.tsx` |

---

### 11.2 Guardrail Policy Alignment

| UX Surface | Guardrail Policy Reference | Compliance Requirement |
|------------|----------------------------|------------------------|
| Approval Modal: Tone Violation | `guardrail_policy_pack.md §3.2` | Display `violation_details`, undo plan, override path |
| Guardrail Summary Card | `guardrail_policy_pack.md §2.2` | Surface active policies from `ctx.session.state['guardrails']` |
| Quiet Hour Override | `guardrail_policy_pack.md §4` | Justification textarea, `/api/guardrails/override`, Governance notification |
| Incident Log Table | `guardrail_policy_pack.md §5` | Populate from `guardrail_incidents` table, exportable CSV/PDF |
| Override Register | `guardrail_policy_pack.md §4` | Display `guardrail_overrides` with expiry countdown, revoke action |

---

### 11.3 PRD Value Proposition Realization

| PRD Differentiator | UX Manifestation |
|--------------------|------------------|
| **Zero-to-value runway** | Dry-run proof loop completes in <15 min (Mission Intake → Evidence Bundle) |
| **Proven outcomes** | ROI estimates in Artifact Cards ("87 contacts, 3–5% reply rate"), library reuse metrics in Analytics |
| **Human-centered copilot UX** | CopilotKit chat, approval modals, inline edits, "Why This?" tooltips |
| **Governed autonomy** | Guardrail Summary, Approval Modal, Override Request, Undo Button |
| **Compounding library** | Play Recommendation Cards surface top plays from library; Analytics shows reuse trends |

---

### 11.4 Gate-by-Gate UX Delivery

| Gate | UX Deliverables | Acceptance Evidence |
|------|-----------------|---------------------|
| **G-A (Foundation)** | Mission Intake Modal, CopilotKit workspace scaffold, Guardrail Summary | Screenshots in `docs/readiness/copilotkit_qa_G-A/` |
| **G-B (Dry-Run Proof)** | Streaming Status Panel, Play Cards, Artifact Previews, Evidence Bundle export | QA video in `docs/readiness/copilotkit_session_G-B.mp4` |
| **G-C (Governed Activation)** | Approval Modal, OAuth flow, Undo Button, Guardrail Incident Log | Approval feed export in `docs/readiness/approval_feed_export_G-C.json` |
| **G-D (Analytics)** | Analytics Dashboard, Governance Dashboard, Library Recommendations | Dashboard QA video in `docs/readiness/dashboard_qa_G-D.mp4` |
| **G-E (Scale Hardening)** | Mobile responsive breakpoints, accessibility audit report | Accessibility report in `docs/readiness/accessibility_audit_G-E.pdf` |

---

## Appendices

### Appendix A: UI Component Checklist (Gate G-B)

- [ ] `<MissionIntakeModal>` — Structured form with goal, audience, timeframe, guardrails
- [ ] `<MissionBriefCard>` — Display goal, audience, timeframe, status badges
- [ ] `<PlayCard>` — Impact, risk, undo, toolkits, "Select Play", "Why This?"
- [ ] `<StreamingStatusPanel>` — Live progress, checkmarks, "Expand Details", "Pause", "Cancel"
- [ ] `<ArtifactCard>` — Preview, Download CSV, Share Link
- [ ] `<GuardrailSummaryCard>` — Tone, quiet hours, rate limits, "Edit Policies", "View Incidents"
- [ ] `<ApprovalModal>` — Violation details, undo plan, "Edit", "Override", "Reject", "Reschedule"
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

- [ ] All events in catalog tracked with correct payloads
- [ ] Supabase Edge Functions log events to analytics tables
- [ ] Privacy redaction enforced (hashed arguments, PII removed)
- [ ] Export APIs (`/evidence/:mission_id`, `/analytics/export`) functional
- [ ] Analytics views queryable via PostgREST
- [ ] Dashboard filters tested (persona, date range, mission status)
- [ ] Event correlation working (mission → plays → tool_calls → approvals)

---

## Conclusion

This UX blueprint establishes a foundation for an **elegant, loved-by-users mission workspace** that balances AI autonomy with human oversight. By centering on **trust through transparency**, **progressive trust**, and **radically reversible actions**, the AI Employee Control Plane empowers users to prove value quickly, govern confidently, and scale safely.

The design aligns with Gate G-A expectations (dry-run focus) and extends toward governed activation (Gate G-C), with clear paths to analytics (Gate G-D) and scale hardening (Gate G-E). Every interaction pattern, component, and telemetry touchpoint ties back to the PRD's value proposition, architecture blueprint, and guardrail policy pack.

**Next Steps:**
1. Review with Product, Design, Governance stakeholders
2. Validate accessibility commitments with WCAG audit
3. Build component library (Storybook) per Appendix A checklist
4. Instrument analytics per Appendix C verification
5. Iterate based on user testing and Gate promotion feedback

---

**Maintained by:** Product Design Lead
**Last Updated:** October 8, 2025
**Cross-References:** `prd.md`, `architecture.md`, `guardrail_policy_pack.md`, `todo.md`
