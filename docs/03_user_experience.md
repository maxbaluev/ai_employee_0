# AI Employee Control Plane: User Experience Blueprint

**Version:** 3.0 (October 2025)
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
| ---------------------------- | ----------------------------------------- | ------------------------------------------------------ | --------------------------------- |
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

## Five-Stage Mission Journey

The unified workspace moves through five observable stages without route changes. Each stage inherits previous context and prefetches the next.

1. **Define** — Mission intent capture and brief commitment.
2. **Prepare** — Toolkit curation, authorization, and data validation.
3. **Plan & Approve** — Ranked plays, safeguard review, undo plan confirmation.
4. **Execute & Observe** — Governed execution with live telemetry and evidence capture.
5. **Reflect & Improve** — Feedback collection, library reuse suggestions, next-step logging.

### Stage Details

#### Define
- Paste mission intent, receive chips (objective, audience, KPI, safeguard, timeline).
- Edit or regenerate any chip; accept all to lock the brief.
- Telemetry: `intent_submitted`, `brief_generated`, `mission_brief_locked`.

#### Prepare
- Recommended toolkits displayed with rationale, precedent, and auth status.
- OAuth drawer surfaces scopes; data inspection previews sample records with redaction.
- Coverage meter requires ≥85% readiness before advancing.
- Telemetry: `toolkit_recommended`, `toolkit_selected`, `data_preview_generated`, `safeguard_reviewed`.

#### Plan & Approve
- Planner streams candidate plays ranked by impact and similarity.
- Users approve plays, request revisions, attach manual steps, and validate undo plans.
- Approval modal summarizes risk assessment and required safeguards.
- Telemetry: `planner_candidate_generated`, `plan_ranked`, `plan_approved`.

#### Execute & Observe
- Streaming panel shows tool calls, validator checks, and auto-fix attempts.
- Evidence cards populate in real time with hash badges and redaction states.
- Undo countdown visible for each mutating action.
- Telemetry: `execution_started`, `execution_step_completed`, `validator_alert_raised`, `evidence_bundle_generated`.

#### Reflect & Improve
- Feedback drawer enables per-artifact reactions and mission-level surveys.
- Library suggestions highlight reusable plays and prompt templates.
- Checklist captures follow-up tasks and owner assignments.
- Telemetry: `feedback_submitted`, `mission_retrospective_logged`, `library_contribution`.

---

## Legacy Mapping Callout

| Legacy Stage | Five-Stage Destination | Notes |
|--------------|------------------------|-------|
| Intake | Define | Mission intent capture unchanged |
| Mission Brief | Define | Brief locking occurs before Prepare |
| Toolkits & Connect | Prepare | Authorization and toolkit selection combined |
| Data Inspect | Prepare | Coverage validation happens before planning |
| Plan | Plan & Approve | Approval emphasis retained |
| Governed Execution | Execute & Observe | Execution telemetry unchanged |
| Evidence | Execute & Observe | Artifact packaging tied to execution |
| Feedback | Reflect & Improve | Feedback loops and library updates |

Use this table when aligning with stakeholders familiar with the eight-stage narrative.

---

## Interaction Patterns

- **Accept/Edit Chips** — Hover reveals `Regenerate` and `Convert to Note`. Chips support multiline editing and mention syntax for teammates.
- **Confidence Badges** — Tri-state (High · Medium · Needs Review) with tooltip explaining rationale source.
- **Safeguard Drawer** — Inline editing of generated safeguards; edits sync to planner prompt in seconds.
- **Approval Modal** — Summarizes proposed activation, required scopes, undo plan, and contact routes.
- **Streaming Logs** — Expandable drawer reveals raw reasoning, tool inputs, and outputs for debugging.
- **Pin to Library** — Any artifact can be pinned, tagged, and scheduled for reuse with a single click.

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
2. **Usability Validation** — Stage-focused studies (Define, Prepare, Execute & Observe) monthly with primary personas.
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

## Appendix A: Stage-to-Event Matrix (Five-Stage Rollup)

| Stage | Primary Events | Optional Events | Payload Highlights |
|-------|----------------|-----------------|--------------------|
| Define | `intent_submitted`, `brief_generated`, `mission_brief_locked` | `chip_regenerated`, `chip_discarded` | token counts, tone hints, safeguard presence |
| Prepare | `toolkit_recommended`, `toolkit_selected`, `data_preview_generated`, `safeguard_reviewed` | `coverage_override_requested` | toolkit id, coverage gaps, scope rationale |
| Plan & Approve | `planner_candidate_generated`, `plan_ranked`, `plan_approved` | `planner_retry_requested` | confidence score, undo summary, reviewer id |
| Execute & Observe | `execution_started`, `execution_step_completed`, `validator_alert_raised`, `evidence_bundle_generated` | `execution_paused` | tool call id, validator critique, artifact hash |
| Reflect & Improve | `feedback_submitted`, `mission_retrospective_logged`, `library_contribution` | `followup_scheduled` | rating, effort saved, reusable asset id |

---

## Appendix B: Persona Alignment

- **Revenue Operator (Riley)** — Prioritizes Define/Prepare for rapid campaign launches.
- **Support Leader (Sam)** — Focuses on Execute & Observe dashboards for SLA adherence.
- **Governance Lead (Gabriela)** — Evaluates Plan & Approve checkpoints and safeguard audit trails.
- **Platform Engineer (Priya)** — Monitors telemetry integrity across all stages via Appendix A.

