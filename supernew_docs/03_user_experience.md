# AI Employee Control Plane: User Experience Blueprint

**Version:** 2.0 (October 2025)
**Audience:** Product Design, UX Engineering, Research, Accessibility
**Status:** Definitive interaction contract for the unified mission workspace

---

## Experience North Star

Deliver a single mission workspace that feels confidently autonomous yet deeply collaborative. Every surface answers three questions instantly:
1. **What is happening?** Streaming context and rationale keep work observable.
2. **What do I need to decide?** Approvals, edits, and safeguards present actionable choices without clutter.
3. **What happens next?** Each stage advertises downstream impact, undo plans, and feedback channels.

---

## Design Principles

1. **Context Never Resets** — The workspace persists mission intent, safeguards, and evidence across all stages. No full-screen reloads, no modal silos.
2. **Generative Scaffolding, Human Final Cut** — The system drafts objectives, toolkits, and plays; humans refine with inline controls.
3. **Progressive Confidence Signals** — Visual badges, coverage meters, and validator notes make agent certainty explicit.
4. **Bi-Directional Collaboration** — People can edit any generated artifact; the agent adapts in real time without losing state.
5. **Undo Is a First-Class Action** — Every mutating step displays its rollback plan and countdown before activation.
6. **Telemetry-Friendly by Design** — Every interaction emits structured events with clear intent, reason, and outcome metadata.
7. **Accessibility as Table Stakes** — Keyboard-first flows, screen reader announcements, and high-contrast palettes ship together.

---

## Mission Workspace Anatomy

| Surface | Purpose | Key Components | States |
|---------|---------|----------------|--------|
| **Generative Intake Banner** | Collect mission intent and constraints | `MissionIntake`, `ChipStack`, sample prompt carousel | idle · streaming · review |
| **Pinned Brief Card** | Persist accepted chips as mission truth | `MissionBriefCard`, confidence badges | draft · locked · edited |
| **Toolkit Canvas** | Curate capabilities and connection status | `RecommendedToolStrip`, `ConnectionSlot`, `ScopeBadge` | discover · authorize · ready |
| **Coverage Meter** | Verify readiness before execution | `CoverageRadial`, `ReadinessLegend` | ready · warning · blocked |
| **Planner Insight Rail** | Present ranked plays and rationale | `PlayCard`, `RationaleTooltip`, `SafeguardPill` | streaming · selected · superseded |
| **Streaming Status Panel** | Visualize execution timeline | `ExecutionTimeline`, `HeartbeatBadge`, `ActionLog` | idle · running · paused |
| **Evidence Gallery** | Review artifacts, hash audit, export | `ArtifactCard`, `HashBadge`, `ExportMenu` | pending · validated · undoing |
| **Undo Bar** | Summarize rollback plan | `UndoCountdown`, `ImpactSummary`, `ConfirmButton` | idle · armed · executed |
| **Feedback Drawer** | Capture per-artifact and mission feedback | `FeedbackTimeline`, `QuickReactions`, `FollowupPrompt` | closed · open · submitted |

All surfaces live in `MissionWorkspaceLayout` with responsive breakpoints (≥1280 desktop, 1024 tablet, 768 mobile). Side rails collapse intelligently; critical controls remain in the primary column.

---

## Eight-Stage Narrative Flow

The unified workspace moves through eight observable stages without route changes. Each stage inherits previous context and prefetches the next.

1. **Intake & Chip Review**
   - User pastes objective text; system generates chips (goal, audience, KPIs, safeguards, timeline).
   - Key interactions: edit inline, regenerate single chip, accept all, mark optional.
   - Accessibility: live region announces chip readiness; `Ctrl+Enter` accepts.

2. **Mission Brief Commitment**
   - Accepted chips lock into a brief summary card.
   - Users can reopen chips with `Edit Brief` (returns to stage 1 without losing downstream context).
   - Telemetry: `mission_brief_locked` with chip diff payload.

3. **Toolkit Discovery & Authorization**
   - Carousel highlights recommended toolkits with reason tags (precedent, data freshness, coverage gaps).
   - OAuth connects via side drawer; fallback instructions support service accounts.
   - Empty states encourage dry-run validation without credentials.

4. **Data Inspection**
   - Read-only previews confirm dataset coverage.
   - Coverage meter segments (objectives, contacts, safeguards, automation readiness) display numeric thresholds.
   - Users can annotate gaps; annotations surface during planning.

5. **Planning & Safeguard Review**
   - Planner streams candidate plays with success projections, safeguards, and dependencies.
   - Users approve one or more plays, request revisions, or pin manual steps.
   - Summaries include validator critique to avoid later rework.

6. **Dry-Run Execution**
   - Status panel streams each step with timestamps, tool call summaries, and validation outcomes.
   - Failures trigger inline resolution prompts (retry, adjust safeguard, swap toolkit).
   - Safeguard conflicts highlight impacted chips.

7. **Evidence & Undo Readiness**
   - Artifacts display preview, confidence badge, inhibitor alerts, and download options.
   - Undo bar lists reversible actions with countdown timers and prerequisites.
   - Users can attach notes before approving activation.

8. **Feedback & Learning**
   - Drawer captures quick reactions and structured feedback per artifact.
   - Mission-level feedback requests satisfaction rating, effort saved, and blockers.
   - Completion screen showcases library recommendations for future reuse.

---

## Key Interaction Patterns

- **Accept/Edit Chips** — Hover reveals `Regenerate` and `Convert to Note`. Chips support multiline editing and mention syntax for teammates.
- **Confidence Badges** — Tri-state (High · Medium · Needs Review) with tooltip explaining rationale source.
- **Safeguard Drawer** — Inline editing of generated safeguards; edits sync to planner prompt in seconds.
- **Approval Modal** — Summarizes proposed activation, required scopes, undo plan, and contact routes.
- **Streaming Logs** — Expandable drawer reveals raw reasoning, tool inputs, and outputs for debugging.
- **Pin to Library** — Any artifact can be pinned, tagged, and scheduled for reuse with a single click.
- **Multiplayer Presence** — Avatars highlight active viewers, stage lock prevents conflicting edits, chat lives in mission timeline.

Every pattern includes design tokens for spacing, color, typography, and motion. Implement components in Storybook with accessibility knobs and visual regression tests.

---

## Accessibility & Inclusivity Checklist

- Semantic landmarks (`<main>`, `<aside>`, `<nav>`) frame layout.
- Keyboard traps forbidden; modals use `aria-modal="true"` and focus return.
- Live regions throttle announcements to avoid screen reader overload.
- Gesture alternatives provided (e.g., `Shift+Space` toggles safeguard switches).
- Motion-reduced mode disables animated gradients and streaming shimmer.
- Copy avoids jargon; key metrics include helper text and examples.
- Localization ready: strings externalized with ICU format, right-to-left layouts tested.

---

## Prototype & Testing Guidance

1. **Design QA** — Ship Figma and Storybook parity checklist with every feature.
2. **Usability Validation** — Conduct stage-focused studies (Intake, Planning, Evidence) monthly with primary personas.
3. **Accessibility Audits** — Automated (axe, pa11y) on each PR; manual screen reader sweeps prior to releases.
4. **Telemetry Verification** — Confirm events fire with expected payload via `scripts/audit_telemetry_events.py`.
5. **Performance Targets** — Stage transitions ≤150ms, streaming heartbeat ≤5s, artifact load ≤2s p95.
6. **Feedback Loop** — UX team triages feedback drawer submissions weekly; high-impact insights become backlog items.

---

## Deliverables & Ownership

- **Design System Updates** — Tokens, components, and guidelines captured in CopilotKit design kit.
- **Storybook Coverage** — Mission workspace components marked `docsReady` only when interactivity matches production.
- **Documentation Linkage** — Cross-reference this blueprint in product vision (personas) and system overview (component catalog).
- **Change Control** — Any deviation from principles triggers UX Design Review with Product, Engineering, and Trust leads.

---

## Appendix: Stage-to-Event Matrix

| Stage | Primary Events | Optional Events | Payload Highlights |
|-------|----------------|-----------------|--------------------|
| Intake | `intent_submitted`, `brief_generated` | `chip_regenerated`, `chip_discarded` | token counts, tone hints, safeguard presence |
| Brief | `mission_brief_locked` | `mission_brief_reopened` | chip diff, editor id |
| Toolkit | `toolkit_recommendation_viewed`, `toolkit_selected` | `connection_deferred` | toolkit id, capability vector, reason codes |
| Inspect | `inspection_preview_rendered`, `coverage_threshold_met` | `coverage_override_requested` | datasets touched, gaps annotated |
| Plan | `play_generated`, `play_selected`, `play_feedback_submitted` | `planner_retry_requested` | confidence score, safeguard summary |
| Dry-Run | `dry_run_started`, `dry_run_step_completed`, `dry_run_completed` | `dry_run_paused` | tool call id, validator critique |
| Evidence | `artifact_published`, `undo_requested`, `undo_completed` | `artifact_flagged` | artifact hash, undo latency |
| Feedback | `feedback_submitted`, `satisfaction_recorded` | `followup_scheduled` | rating, effort saved, blocker category |

Design leads maintain this matrix alongside telemetry schema changes to keep UX, engineering, and analytics aligned.

