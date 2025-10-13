# Gate G-B Implementation Todo List

_Generated: 2025-10-12_
_Status: Tracking tasks required to deliver the full eight-stage dry-run proof for Gate G-B._

## Quick Stage Status

| Stage | Component Focus | Status | Priority | Blocker |
| ----- | ---------------- | ------ | -------- | ------- |
| 1. Intake | Generative intake panel & confidence signals | ✅ Complete | P1 | None |
| 2. Brief | Mission brief persistence | ✅ Complete | P2 | None |
| 3. Toolkits | Recommended tool palette + Connect Link OAuth | ⚠️ Partial | P0 | Undo token wiring + Connect Link status persistence outstanding |
| 4. Inspect | Coverage meter & MCP inspection preview | ❌ Missing | P0 | Inspection agent + findings schema |
| 5. Plan | Planner insight rail streaming rationale | ⚠️ Partial | P0 | Telemetry & Supabase persistence gaps |
| 6. Dry-Run | Streaming status panel & heartbeat | ⚠️ Partial | P1 | Heartbeat resiliency tests |
| 7. Evidence | Artifact gallery + undo execution | ⚠️ Partial | P0 | Undo endpoint, hash verification script |
| 8. Feedback | Feedback drawer & mission feedback store | ❌ Missing | P1 | API route + Supabase table |

---

## Section 1 · Frontend Implementation (Next.js + CopilotKit)

### [x] Surface Confidence Badges in Mission Intake

**Files**
- `src/components/MissionIntake.tsx`
- `src/lib/intake/service.ts`

**Requirements**
- Render model confidence badges beside each generated chip with tooltip copy per `ux.md §5.1`.
- Map numeric confidence to badge tiers defined in `new_docs/todo.md` Gate G-B checklist (green ≥0.75, amber 0.4–0.74, red <0.4).
- Display regeneration history count and last regenerated timestamp inline.

**Acceptance**
- [x] Vitest snapshot covers badge rendering for all tiers.
- [ ] Manual QA screenshot added to `docs/readiness/intake_confidence_G-B.png`.
- [x] Telemetry event `intake_confidence_viewed` fires with badge tier payload.

**Notes**
- Confidence components implemented in `src/components/MissionIntake.tsx` (see `FieldConfidenceBadge` at lines 802-853) using tier helpers from `src/lib/intake/confidenceBadges.ts`.
- Automated coverage lives in `src/components/__tests__/MissionIntake.confidenceBadges.test.tsx`, including telemetry assertions for `intake_confidence_viewed`.

**Dependencies**
- Requires updated telemetry schema in `planner_runs` (see Section 3).

**Priority**
- P1 (trust signal for Stage 1).

**References**
- `ux.md §5.1`, `workflow.md §3`, `todo.md` lines 235-252.

### [x] Remove Gate G-A Fallback Toggle from Intake

**Files**
- `src/app/(control-plane)/ControlPlaneWorkspace.tsx`
- `src/components/MissionIntake.tsx`

**Requirements**
- Delete legacy manual brief editor toggle introduced for Gate G-A fallback.
- Ensure mission acceptance flow always runs through generated chips with inline editing per `architecture.md §3.1`.
- Display guardrail toast if CopilotKit streaming fails, guiding user to retry rather than fallback.

**Acceptance**
- [ ] Manual regression shows no path to bypass generative intake.
- [x] Telemetry `fallback_editor_opened` removed from event catalog.
- [ ] Update CopilotKit QA evidence to confirm generative-only loop.

**Notes**
- Legacy fallback toggle removed from `src/app/(control-plane)/ControlPlaneWorkspace.tsx` and associated branches in `src/components/MissionIntake.tsx`, enforcing the generated chip flow exclusively.
- Telemetry catalog verified via repository search—`fallback_editor_opened` no longer appears in code or event fixtures.

**Dependencies**
- Requires CopilotKit session resiliency task (Section 5).

**Priority**
- P0 (eliminate Gate G-A fallback per Gate G-B readiness memo).

**References**
- `architecture.md §3.1`, `todo.md` lines 257-266.

### [x] Implement Recommended Tool Strip Component

**Files**
- Create `src/components/RecommendedToolStrip.tsx`
- Update `src/app/(control-plane)/stages/StageThreeToolkits.tsx`
- Update `src/app/(control-plane)/ControlPlaneWorkspace.tsx`

**Requirements**
- Render carousel of recommended toolkits with metadata (auth type, category, capability tags) from `/api/toolkits`.
- Support multi-select with keyboard navigation (arrow keys + space) per `ux.md §5.2`.
- Persist selections to Supabase `toolkit_selections` table via `/api/toolkits/selections`.
- Show Connect Link badge for OAuth required kits.

**Acceptance**
- [ ] Cypress test validates multi-select and persistence.
- [ ] Selected toolkit chips appear in Stage 4 inspection summary.
- [ ] Telemetry events `toolkit_recommendation_viewed` and `toolkit_selected` emitted with toolkit ids.

**Notes**
- Keyboard navigation and selection handled within `src/components/RecommendedToolkits.tsx` with arrow/space support and Connect Link CTA badges.
- Persistence and telemetry verified by unit tests in `src/components/__tests__/RecommendedToolkits.test.tsx` (multi-select, API POST, OAuth launch, keyboard navigation).

**Dependencies**
- Requires `/api/toolkits/recommend` route and Composio discovery client (Section 3 & 2).

**Priority**
- P0 (critical gate blocker).

**References**
- `ux.md §5.2`, `workflow.md §4.0`, `libs_docs/composio/llms.txt §3.1`, `todo.md` line 311.

### [x] Wire Toolkit Selection Persistence & Undo Tokens

**Files**
- `src/lib/toolkits/persistence.ts`
- `supabase/migrations/0001_init.sql` (`toolkit_selections` table)
- `src/app/api/toolkits/select/route.ts`

**Requirements**
- Create `toolkit_selections` table with mission_id, toolkit_id, auth_mode, undo_token, created_at, created_by columns.
- API should insert or soft-delete selection, attaching undo token from Validator agent.
- Update CopilotKit store to keep selections in session state.

**Acceptance**
- [x] Supabase type generation reflects new table.
- [x] Integration test ensures selections survive page reload.
- [x] Undo path in Stage 7 reads undo_token for evidence bundling.

**Notes**
- Session-aware helpers introduced in `src/lib/toolkits/persistence.ts` now persist selection metadata (including undo tokens) to session storage and CopilotKit state via `useCopilotReadable` in `src/components/RecommendedToolkits.tsx`.
- `/api/toolkits` and `/api/toolkits/selections` return and store `undo_token` values (see `toolkit_selections` schema and `route.ts` handlers), with coverage in `src/components/__tests__/RecommendedToolkits.test.tsx` validating hydration.
- Stage 7 undo requests forward tokens through `useUndoFlow` and `/api/undo` for telemetry/evidence (`src/hooks/useUndoFlow.ts`, `src/app/api/undo/route.ts`, `src/components/ArtifactGallery.tsx`).

**Dependencies**
- Requires Validator agent to generate undo tokens (Section 2).

**Priority**
- P0 (blocks Stage 4 inspection gating).

**References**
- `architecture.md §3.5`, `workflow.md §4.1`, `todo.md` lines 333-349.

### [ ] Add Connect Link OAuth CTA Flow

**Files**
- `src/components/RecommendedToolStrip.tsx`
- `src/components/ConnectLinkModal.tsx`
- `src/app/api/composio/connect/route.ts`

**Requirements**
- Display Connect Link CTA chip for OAuth-required toolkits with status badge (Not Linked, Pending, Linked).
- Launch modal to guide user through Connect Link OAuth flow per `libs_docs/composio/llms.txt §4`.
- Persist link status in Supabase `toolkit_connections` table (Section 3).
- Provide fallback to shareable link when Connect Link API unavailable.

**Acceptance**
- [ ] Manual QA shows OAuth completion updates status badge.
- [ ] Telemetry `connect_link_launched` and `connect_link_completed` emitted with toolkit ids.
- [ ] Error states captured with toast and log instrumentation.

**Dependencies**
- Requires backend Connect Link route and Supabase table (Section 3).

**Priority**
- P0 (Gate G-B contract for managed auth).

**References**
- `architecture.md §3.3`, `ux.md §5.2`, `libs_docs/composio/llms.txt §4`, `todo.md` lines 352-361.

### [ ] Implement Coverage Meter Component & Layout

**Files**
- Create `src/components/CoverageMeter.tsx`
- Update `src/app/(control-plane)/stages/StageFourInspect.tsx`

**Requirements**
- Render radial progress meter showing coverage percentage with segments for objectives, safeguards, plays, datasets per `ux.md §4.2`.
- Display textual summary of gaps below threshold (<85% highlight red).
- Provide tooltip with inspection findings reference IDs.

**Acceptance**
- [ ] Component unit test verifies color thresholds and rounding.
- [ ] Stage 4 visually matches blueprint screenshot appended to readiness docs.
- [ ] Telemetry `inspection_coverage_viewed` fires with coverage buckets.

**Dependencies**
- Requires inspection findings API (Section 3) and agent (Section 2).

**Priority**
- P0 (gating signal for Stage 5).

**References**
- `ux.md §4.2`, `workflow.md §4.1`, `todo.md` lines 368-390.

### [ ] Integrate Inspection Summary Panel

**Files**
- `src/app/(control-plane)/stages/StageFourInspect.tsx`
- `src/components/InspectionSummaryList.tsx`

**Requirements**
- Show list of inspection findings grouped by category (coverage, safeguard, risk) with severity icons.
- Provide quick actions for "Accept gap" vs "Regenerate" per `workflow.md §4.1`.
- Link each finding to toolkits or objectives requiring attention.

**Acceptance**
- [ ] Integration test ensures selecting "Regenerate" re-triggers inspection agent.
- [ ] Findings persist after refresh via Supabase data.
- [ ] Telemetry `inspection_gap_actioned` logged with action.

**Dependencies**
- Wait on inspection agent and Supabase tables (Sections 2 & 3).

**Priority**
- P0.

**References**
- `workflow.md §4.1`, `ux.md Stage 4 table`, `todo.md` lines 392-405.

### [ ] Build Planner Insight Rail UI

**Files**
- Create `src/components/PlannerInsightRail.tsx`
- Update `src/app/(control-plane)/stages/StageFivePlan.tsx`

**Requirements**
- Stream planner rationale cards (why selected, impact, safeguards) using CopilotKit subscriptions per `architecture.md §3.2`.
- Provide filter chips for persona, play type, automation risk.
- Highlight top-ranked play with "Recommended" badge.

**Acceptance**
- [ ] Streaming test ensures new rationale arrives without full re-render.
- [ ] Telemetry `planner_rationale_viewed` includes candidate id.
- [ ] Planner cards anchor to `plays` table entries.

**Dependencies**
- Requires planner agent telemetry and Supabase persistence (Sections 2 & 3).

**Priority**
- P0.

**References**
- `ux.md §5.3`, `workflow.md §5`, `todo.md` lines 410-423.

### [ ] Introduce Planner Comparison Diff View

**Files**
- `src/components/PlannerInsightRail.tsx`
- `src/components/PlannerDiffModal.tsx`

**Requirements**
- Enable users to compare current recommended play vs previous iteration (diff of toolkit list, safeguards, undo plan).
- Provide call-to-action to pin winning play and log decision per Stage 5 blueprint.

**Acceptance**
- [ ] Unit test verifying diff rendering for added/removed toolkits.
- [ ] Pinning a play sets `pinned_at` column in Supabase.
- [ ] Telemetry `planner_play_pinned` emitted.

**Dependencies**
- Depends on `plays` table updates (Section 3).

**Priority**
- P1.

**References**
- `ux.md §5.3`, `todo.md` lines 424-435.

### [ ] Harden Streaming Status Panel Heartbeat

**Files**
- `src/components/StreamingStatusPanel.tsx`
- `src/lib/telemetry/heartbeat.ts`

**Requirements**
- Display real-time heartbeat indicator with 5s SLA per `ux.md §5.4`.
- Add exponential backoff SSE reconnect with CopilotKit fallback to polling.
- Surface toast if heartbeat misses 2 intervals.

**Acceptance**
- [ ] Playwright streaming test shows heartbeat updates ≤5s.
- [ ] Telemetry `streaming_heartbeat_missed` logs occurrences.
- [ ] Integration test simulates SSE drop and verifies reconnect.

**Dependencies**
- Requires SSE utility enhancements (Section 5 tests).

**Priority**
- P1.

**References**
- `ux.md §5.4`, `todo.md` lines 600-610.

### [ ] Implement Artifact Gallery Layout & Hash Badges

**Files**
- `src/components/ArtifactGallery.tsx`
- `src/components/ArtifactCard.tsx`

**Requirements**
- Render grid of artifacts with status: draft, validated, rejected.
- Display SHA-256 hash + timestamp, linking to evidence bundle file.
- Provide filter for persona and automation stage per `ux.md §5.6`.

**Acceptance**
- [ ] Storybook doc demonstrates all artifact states.
- [ ] Telemetry `artifact_viewed` includes hash_id.
- [ ] Undo action availability tied to artifact status.

**Dependencies**
- Requires evidence service updates (Section 2) and hash script (Section 4).

**Priority**
- P0.

**References**
- `ux.md §5.6`, `workflow.md §7`, `todo.md` lines 612-627.

### [ ] Add Undo Countdown Bar in Artifact Drawer

**Files**
- `src/components/ArtifactUndoBar.tsx`
- `src/app/(control-plane)/stages/StageSevenEvidence.tsx`

**Requirements**
- Present persistent undo bar with countdown from validator-defined window (default 15 minutes) per `ux.md §5.7`.
- Show undo plan summary and risk tags from Validator agent.
- Provide override link for Governance sentinel (if override flag set).

**Acceptance**
- [ ] Unit test ensures countdown stops at zero and disables undo button.
- [ ] Telemetry `undo_triggered` recorded with tool_call_id.
- [ ] Undo bar persists across navigation until expiry.

**Dependencies**
- Wait for `/api/evidence/undo` and validator outputs (Sections 2 & 3).

**Priority**
- P0.

**References**
- `ux.md §5.7`, `workflow.md §7`, `todo.md` lines 628-645.

### [ ] Build Feedback Drawer & Feedback Stream Timeline

**Files**
- Create `src/components/FeedbackDrawer.tsx`
- Update `src/app/(control-plane)/stages/StageEightFeedback.tsx`

**Requirements**
- Render timeline of feedback entries grouped by persona with filters (positive, risk, escalation).
- Provide quick actions for "Promote to library" and "Flag for follow-up".
- Integrate quick form to submit new feedback entries hitting `/api/feedback/submit`.

**Acceptance**
- [ ] Integration test posts feedback and verifies persistence.
- [ ] Telemetry `feedback_submitted` logs sentiment and stage.
- [ ] Drawer accessible via keyboard and screen readers.

**Dependencies**
- Requires mission_feedback table and API (Section 3).

**Priority**
- P1.

**References**
- `ux.md §7`, `workflow.md §8`, `todo.md` lines 646-662.

### [ ] Provide Feedback Insights Highlights

**Files**
- `src/components/FeedbackDrawer.tsx`
- `src/components/FeedbackInsights.tsx`

**Requirements**
- Auto-generate insights summary chips (Top praise, Top risk, Safeguards escalated) using mission_feedback data.
- Show trend chart for acceptance rate per mission.

**Acceptance**
- [ ] Unit test ensures insights update when new feedback arrives.
- [ ] Telemetry `feedback_insight_viewed` emitted.
- [ ] Chart responsive and accessible.

**Dependencies**
- Builds on mission_feedback analytics view (Section 3).

**Priority**
- P2.

**References**
- `ux.md §7`, `workflow.md §8`, `todo.md` lines 663-675.

### [ ] Enforce Accessibility & Keyboard Navigation Audit

**Files**
- `src/components/*`
- `scripts/a11y_scan.ts`

**Requirements**
- Implement skip links, ARIA roles, and keyboard traps per `ux.md §9`.
- Run automated axe-core scan and capture violations.
- Document manual keyboard walkthrough for Stage 3–8 components.

**Acceptance**
- [ ] `pnpm run test:a11y` passes with zero critical issues.
- [ ] Accessibility checklist stored in `docs/readiness/a11y_G-B.md`.
- [ ] Screen reader labels validated for toolkit cards and coverage meter.

**Dependencies**
- Requires Playwright/axe setup (Section 5).

**Priority**
- P1.

**References**
- `ux.md §9`, `todo.md` lines 700-714.

---

## Section 2 · Backend Agents & Services (Gemini ADK)

### [ ] Implement InspectionAgent with MCP Draft Mode

**Files**
- Create `agent/agents/inspection_agent.py`
- Update `agent/agent.py`
- Update `agent/services/inspection_service.py`

**Requirements**
- Implement ADK `CustomAgent` running MCP draft calls per toolkit selection using `execution_mode='SIMULATION'`.
- Produce coverage metrics (objectives, datasets, safeguards) stored in session context.
- Emit telemetry `inspection_stage_completed` with coverage %, gaps list, duration.

**Acceptance**
- [ ] Unit test mocks MCP client and asserts findings payload.
- [ ] ADK eval scenario added to `agent/evals/control_plane/inspection_smoke.json`.
- [ ] Coverage metrics persisted for UI consumption.

**Dependencies**
- Requires Composio MCP client enhancements (below) and `inspection_findings` table (Section 3).

**Priority**
- P0.

**References**
- `workflow.md §4.1`, `architecture.md §3.3`, `libs_docs/composio/llms.txt §5`, `todo.md` lines 440-458.

### [ ] Extend Coordinator Sequential Flow with Stage Guards

**Files**
- `agent/agents/coordinator.py`
- `agent/agent.py`
- `agent/services/state_service.py`

**Requirements**
- Enforce eight-stage transition rules (block Stage 5 until coverage ≥85% or governance override).
- Wrap each stage in telemetry span capturing latency and error info.
- Persist stage transitions to Supabase `mission_runs` table.

**Acceptance**
- [ ] Integration test drives mission through all stages and logs transitions.
- [ ] Telemetry `stage_transition_blocked` triggered when coverage insufficient.
- [ ] Coordinator gracefully skips Connect Link tasks in dry-run only missions.

**Dependencies**
- Needs inspection agent results plus Supabase updates (Section 3).

**Priority**
- P0.

**References**
- `workflow.md §2`, `architecture.md §3.2`, `todo.md` lines 459-474.

### [ ] Enhance PlannerAgent with Hybrid Ranking + Rationale

**Files**
- `agent/agents/planner.py`
- `agent/services/library_service.py`
- `agent/services/composio_service.py`

**Requirements**
- Combine library embeddings with live Composio discovery per `libs_docs/composio/llms.txt §3`.
- Return structured rationale containing impact score, toolkit ids, undo sketch, telemetry tags.
- Capture planner latency metrics and insert into Supabase `planner_runs` table.

**Acceptance**
- [ ] New eval cases guarantee rationale completeness and ranking precision ≥0.62 similarity.
- [ ] Telemetry `planner_candidate_generated` logs candidate_id, rank, latency_ms.
- [ ] Unit test ensures fallback when Composio discovery fails.

**Dependencies**
- Relies on Supabase schema update and telemetry pipeline (Section 3 & 4).

**Priority**
- P0.

**References**
- `architecture.md §3.2`, `todo.md` lines 475-507, `libs_docs/adk/llms-full.txt §2.4`.

### [ ] Upgrade ValidatorAgent for Adaptive Safeguards

**Files**
- `agent/agents/validator.py`
- `agent/policies/safeguards.py`
- `agent/services/safeguard_service.py`

**Requirements**
- Evaluate plays against tone, timing, budget, escalation policies defined in `safeguard_integration.md §2-5`.
- Generate undo tokens and attach to tool calls and toolkit selections.
- Emit `validator_violation_detected` telemetry with severity and recommended fix.

**Acceptance**
- [ ] Unit tests cover positive (no violation) and negative (violation) paths.
- [ ] Generated undo token stored in Supabase `tool_calls.undo_plan_json`.
- [ ] Validator summary available for approval modal.

**Dependencies**
- Requires Supabase schema fields (Section 3) and telemetry instrumentation (Section 4).

**Priority**
- P0.

**References**
- `safeguard_integration.md §2-5`, `workflow.md §6`, `todo.md` lines 508-538.

### [ ] Implement EvidenceService Undo Execution Path

**Files**
- `agent/services/evidence_service.py`
- `agent/agents/evidence.py`
- `scripts/verify_artifact_hashes.py`

**Requirements**
- Execute undo plans for each tool call, verifying completion and hashing outputs.
- Attach undo proof to evidence bundle metadata and log to Supabase `artifacts`.
- Provide CLI to re-run undo plan for QA.

**Acceptance**
- [ ] Hash verification script validates 100% parity.
- [ ] Telemetry `undo_plan_executed` emitted with success flag.
- [ ] Evidence bundle contains undo summary for each action.

**Dependencies**
- Depends on validator tokens and Supabase artifact schema (Section 3).

**Priority**
- P0.

**References**
- `workflow.md §7`, `todo.md` lines 539-568.

### [ ] Add Dry-Run Executor Simulation Enhancements

**Files**
- `agent/agents/executor.py`
- `agent/tools/supabase_stub.py`
- `agent/services/composio_service.py`

**Requirements**
- Support execute vs. simulate modes based on `EVAL_MODE` flag.
- Capture streaming status heartbeat updates and forward to CopilotKit SSE.
- Store simulated outputs in Supabase `simulated_results` table for evidence.

**Acceptance**
- [ ] ADK eval ensures simulation path outputs deterministic stub data.
- [ ] Telemetry `executor_simulation_completed` logs runtime.
- [ ] Streaming status panel shows progress events during dry-run.

**Dependencies**
- SSE instrumentation (Section 4) and Supabase schema (Section 3).

**Priority**
- P1.

**References**
- `architecture.md §3.3`, `workflow.md §6`, `todo.md` lines 569-594.

### [ ] Harden CopilotKit Session Persistence

**Files**
- `agent/services/copilotkit_service.py`
- `src/app/api/copilotkit/session/route.ts`

**Requirements**
- Guarantee `copilotkit_exit` fires on all success/error paths and persists transcript to Supabase `copilot_messages`.
- Implement retention enforcement job for 7-day policy.

**Acceptance**
- [ ] Integration test ensures transcripts survive server restart.
- [ ] Telemetry `copilot_exit_sent` captured with mission_id.
- [ ] Retention job documented in readiness evidence.

**Dependencies**
- Depends on retention script in Section 5 and Supabase TTL config (Section 3).

**Priority**
- P1.

**References**
- `todo.md` lines 600-610, `architecture.md §3.1`, `libs_docs/copilotkit/llms-full.txt §4`.

---

## Section 3 · API & Database Surface Area (Supabase + Next.js Routes)

### [ ] Add `/api/toolkits/recommend` Endpoint

**Files**
- Create `src/app/api/toolkits/recommend/route.ts`
- `src/lib/toolkits/recommendation.ts`

**Requirements**
- Fetch library metadata and Composio discovery results, merge into ranked list with auth metadata.
- Support query params for persona, industry, mission_id.
- Emit telemetry `api_toolkits_recommend_hit` with latency.

**Acceptance**
- [ ] Handler unit test covers success and failure responses.
- [ ] Endpoint documented in `docs/readiness/api_catalog_G-B.md`.
- [ ] Rate limits defined (5/10s per mission).

**Dependencies**
- Requires planner library service (Section 2) and Supabase caching tables.

**Priority**
- P0.

**References**
- `architecture.md §3.2`, `todo.md` lines 333-349, `libs_docs/composio/llms.txt §3`.

### [ ] Create `/api/inspect/preview` Route for Coverage Checks

**Files**
- Create `src/app/api/inspect/preview/route.ts`
- `src/lib/inspection/service.ts`

**Requirements**
- Invoke Inspection agent, return findings + coverage metrics.
- Persist request/response payloads to Supabase `inspection_requests`.
- Validate mission has toolkit selections before triggering.

**Acceptance**
- [ ] Integration test ensures 400 response without selections.
- [ ] Response schema documented for frontend consumption.
- [ ] Telemetry `api_inspect_preview_completed` includes coverage %.

**Dependencies**
- Requires inspection agent (Section 2) and schema updates.

**Priority**
- P0.

**References**
- `workflow.md §4.1`, `todo.md` lines 368-390.

### [ ] Implement `/api/evidence/undo` Endpoint

**Files**
- Create `src/app/api/evidence/undo/route.ts`
- `src/lib/evidence/undo.ts`

**Requirements**
- Accept undo_token and mission_id; invoke evidence service to reverse tool call.
- Update `tool_calls.undo_status` and insert audit entry in `undo_events` table.
- Return updated artifact bundle summary.

**Acceptance**
- [ ] Endpoint denies expired undo tokens (controlled by TTL from validator).
- [ ] Integration test covers success, already executed, expired, and invalid tokens.
- [ ] Telemetry `api_evidence_undo_attempted` recorded with outcome.

**Dependencies**
- Needs undo tokens from Validator (Section 2) and Supabase schema.

**Priority**
- P0.

**References**
- `workflow.md §7`, `todo.md` lines 628-645.

### [ ] Add `/api/feedback/submit` and `/api/feedback/list`

**Files**
- Create `src/app/api/feedback/submit/route.ts`
- Create `src/app/api/feedback/list/route.ts`
- `src/lib/feedback/service.ts`

**Requirements**
- Provide mission feedback submission with sentiment, persona, safeguard flags.
- Expose paginated list with filters for persona, sentiment, stage.
- Sanitize content via telemetry redaction helper.

**Acceptance**
- [ ] Unit tests ensure validation errors for missing sentiment or stage.
- [ ] Endpoint integrated with Feedback Drawer and Mission summary export.
- [ ] Telemetry `api_feedback_submitted` logs anonymised digest.

**Dependencies**
- Requires `mission_feedback` table.

**Priority**
- P1.

**References**
- `ux.md §7`, `workflow.md §8`, `todo.md` lines 646-675.

### [ ] Implement `/api/composio/connect` OAuth Flow

**Files**
- Create `src/app/api/composio/connect/route.ts`
- `src/lib/composio/connectLink.ts`

**Requirements**
- Generate Connect Link session, redirect user, poll status, update Supabase `toolkit_connections` table.
- Support revocation endpoint to unlink toolkit.
- Handle errors surfaced from Composio Connect Link API gracefully.

**Acceptance**
- [ ] Manual QA flow recorded for readiness docs.
- [ ] Telemetry `connect_link_status_updated` emitted.
- [ ] API secured via mission ownership check.

**Dependencies**
- Relies on Composio API credentials in `.env` and Supabase table.

**Priority**
- P0.

**References**
- `architecture.md §3.3`, `libs_docs/composio/llms.txt §4`, `todo.md` lines 352-361.

### [ ] Expand Supabase Schema for Gate G-B Tables

**Files**
- `supabase/migrations/0001_init.sql`
- `supabase/types.ts`

**Requirements**
- Add tables: `toolkit_selections`, `inspection_findings`, `inspection_requests`, `planner_runs`, `mission_feedback`, `toolkit_connections`, `undo_events`, `simulated_results`.
- Ensure RLS policies per tenant using `auth.uid()`.
- Create supporting indexes for planner latency queries and inspection lookups.

**Acceptance**
- [ ] Migration validated via `supabase db reset --seed`.
- [ ] Types regenerated (`supabase/types.ts`) and compile clean with `pnpm tsc --noEmit`.
- [ ] Readiness doc updated with schema diff.

**Dependencies**
- Coordinates with tasks across Sections 1-5.

**Priority**
- P0.

**References**
- `architecture.md §3.5`, `workflow.md §10`, `todo.md` lines 700-735, `libs_docs/supabase/llms_docs.txt §2`.

### [ ] Update `plays` and `tool_calls` Tables for Rationale & Undo

**Files**
- `supabase/migrations/0001_init.sql`
- `supabase/types.ts`

**Requirements**
- Add columns: `reason_markdown`, `impact_score`, `undo_plan_json`, `validator_summary`, `pinned_at`.
- Enforce constraint requiring undo plan for mutating tool calls.
- Update seeds to include sample rationale data.

**Acceptance**
- [ ] Planner inserts succeed with new columns.
- [ ] Telemetry aggregator uses new fields.
- [ ] Seed script updated and documented.

**Dependencies**
- Works with planner and validator agent tasks.

**Priority**
- P0.

**References**
- `todo.md` lines 595-610, `architecture.md §3.5`.

### [ ] Add Mission Feedback Analytics View

**Files**
- `supabase/migrations/0001_init.sql`
- `supabase/seed.sql`

**Requirements**
- Create materialized view summarizing feedback sentiment by mission/stage.
- Provide index to support trend chart in Feedback insights.
- Schedule refresh via `pg_cron`.

**Acceptance**
- [ ] View accessible via Supabase REST and types generated.
- [ ] Cron job documented in readiness notes.
- [ ] Telemetry ensures refresh completion logged.

**Dependencies**
- Feedback API and UI tasks.

**Priority**
- P2.

**References**
- `workflow.md §8`, `architecture.md §3.5`, `todo.md` lines 670-685.

### [ ] Harden Retention Enforcement Script

**Files**
- `scripts/check_retention.py`
- `supabase/migrations/0001_init.sql`

**Requirements**
- Implement CLI to verify TTL for `copilot_messages`, `mission_feedback`, `simulated_results` matches 7-day policy.
- Fail CI if retention limit exceeded.

**Acceptance**
- [ ] Script integrated into CI pipeline.
- [ ] Retention metrics recorded in readiness evidence.

**Dependencies**
- Telemetry & Testing sections.

**Priority**
- P1.

**References**
- `todo.md` lines 858-865, `architecture.md §3.5`.

---

## Section 4 · Telemetry, Analytics & Tooling

### [ ] Complete Frontend Telemetry Catalog (37 Events)

**Files**
- `src/lib/telemetry/frontendEvents.ts`
- `src/components/*`

**Requirements**
- Implement all events listed in `ux.md §10.2`, including payload validation and redaction.
- Ensure each component dispatches events at appropriate interaction points (viewed, acted, error).
- Update telemetry typing to enforce payload schemas.

**Acceptance**
- [ ] Telemetry audit script (Section 5) reports 100% coverage.
- [ ] TypeScript compile ensures all events enumerated.
- [ ] QA log appended to `docs/readiness/telemetry_frontend_G-B.md`.

**Dependencies**
- Depends on components from Section 1.

**Priority**
- P0.

**References**
- `ux.md §10.2`, `todo.md` lines 750-770.

### [ ] Capture Backend Agent Telemetry Spans

**Files**
- `agent/common/telemetry.py`
- `agent/agents/*`
- `agent/services/*`

**Requirements**
- Emit spans for each agent stage (start, success, failure) with latency, retries, safeguard counts.
- Forward telemetry to Supabase `mission_events` table and optionally to analytics sink.
- Ensure PII scrubbing uses `src/lib/telemetry/redaction.ts`.

**Acceptance**
- [ ] Telemetry integration test verifies spans created for inspection/planner/validator.
- [ ] `scripts/audit_telemetry_events.py --gate G-B` passes.
- [ ] Observability doc updated with sample payloads.

**Dependencies**
- Relies on agent updates (Section 2).

**Priority**
- P0.

**References**
- `workflow.md §12`, `architecture.md §7`, `todo.md` lines 771-788.

### [ ] Build Planner Metrics Dashboard Seed

**Files**
- `docs/readiness/analytics/planner_metrics_G-B.md`
- `supabase/migrations/0001_init.sql`
- `scripts/validate_planner_metrics.py`

**Requirements**
- Script calculates p95 latency, candidate count, similarity averages per mission.
- Dashboard doc visualizes metrics for last 10 missions.
- Establish threshold alerts for regressions.

**Acceptance**
- [ ] Script integrated into CI with threshold gating.
- [ ] Dashboard doc includes charts and interpretation.
- [ ] Telemetry events include latency_ms for planner.

**Dependencies**
- Planner telemetry and Supabase updates (Sections 2 & 3).

**Priority**
- P1.

**References**
- `todo.md` lines 851-856, `architecture.md §7`.

### [ ] Implement Artifact Hash Verification Script

**Files**
- Create `scripts/verify_artifact_hashes.py`
- `agent/services/evidence_service.py`

**Requirements**
- Generate SHA-256 for artifacts, compare with Supabase stored hash, emit mismatch report.
- Provide CLI options for mission scope, full scan, and diff output.

**Acceptance**
- [ ] Script passes when run against seeded data.
- [ ] Integration test fails on intentional hash mismatch.
- [ ] Report archived in readiness folder.

**Dependencies**
- Evidence service updates (Section 2) and artifact schema (Section 3).

**Priority**
- P0.

**References**
- `todo.md` lines 668-675, `workflow.md §7`.

### [ ] Add Streaming Heartbeat Monitoring & Alerting

**Files**
- `scripts/monitor_streaming.py`
- `src/components/StreamingStatusPanel.tsx`
- `agent/services/copilotkit_service.py`

**Requirements**
- Collect heartbeat latency metrics, store in Supabase `streaming_metrics` table.
- Trigger alert when heartbeat misses >2 intervals in 10 min window.

**Acceptance**
- [ ] Monitoring script runs via cron and logs results.
- [ ] Alert notification integrated with ops channel.
- [ ] Readiness doc includes baseline metrics.

**Dependencies**
- SSE enhancements (Section 1) and database table (Section 3).

**Priority**
- P1.

**References**
- `ux.md §5.4`, `todo.md` lines 817-823.

### [ ] Telemetry Redaction & PII Audit

**Files**
- `src/lib/telemetry/redaction.ts`
- `agent/common/redaction.py`
- `scripts/audit_telemetry_events.py`

**Requirements**
- Update redaction helpers to cover new payload fields (toolkit metadata, hashed evidence).
- Provide automated check verifying no raw PII fields leak per telemetry catalog.

**Acceptance**
- [ ] Audit script output appended to readiness docs.
- [ ] Unit tests cover PII removal for sample payloads.

**Dependencies**
- Telemetry events from sections 1-4.

**Priority**
- P1.

**References**
- `safeguard_integration.md §5`, `todo.md` lines 788-805.

---

## Section 5 · Testing, QA & Performance Validation

### [ ] Eight-Stage End-to-End Mission Flow Test

**Files**
- `tests/e2e/missionFlow.spec.ts`
- `scripts/run-e2e.sh`

**Requirements**
- Simulate mission from intake through feedback using seeded personas (Revenue, Support, Governance).
- Assert stage transitions, toolkit selections, inspection gating, planner rationale, evidence undo, feedback submission.

**Acceptance**
- [ ] Test passes locally and in CI using Playwright with `REDIS_URL` set.
- [ ] Video artifact stored in `docs/readiness/e2e_mission_flow_G-B.mp4`.
- [ ] Failure screenshots automatically uploaded to readiness folder.

**Dependencies**
- Requires UI components and API routes from Sections 1 & 3.

**Priority**
- P0.

**References**
- `workflow.md §1-8`, `todo.md` lines 817-823.

### [ ] Streaming Resilience & Heartbeat Playwright Suite

**Files**
- `tests/e2e/streamingHeartbeat.spec.ts`

**Requirements**
- Simulate SSE dropouts, measure time to recover, assert heartbeat indicator updates ≤5s.
- Validate fallback polling path and CopilotKit reconnection messaging.

**Acceptance**
- [ ] Test reports metrics logged to telemetry.
- [ ] Alerts triggered when latency >5s.

**Dependencies**
- Streaming panel updates (Section 1) and monitoring script (Section 4).

**Priority**
- P1.

**References**
- `ux.md §5.4`, `todo.md` lines 817-823.

### [ ] Planner Ranking Evaluation Expansion

**Files**
- `agent/evals/dry_run_ranking_G-B.json`
- `agent/evals/library_precision.json`

**Requirements**
- Add negative case scenarios covering tone softening, budget breach, escalation required.
- Ensure eval suite targets ≥90% top-3 accuracy.

**Acceptance**
- [ ] `mise run test-agent` passes with new eval coverage.
- [ ] Eval report stored in `docs/readiness/planner_eval_G-B.md`.

**Dependencies**
- Planner agent enhancements (Section 2).

**Priority**
- P0.

**References**
- `todo.md` lines 634-645, `architecture.md §3.2`.

### [ ] Validator Negative Scenario Tests

**Files**
- `agent/tests/test_validator.py`
- `agent/evals/validator_negatives.json`

**Requirements**
- Cover tone violation, quiet window breach, escalation requirement, budget overspend.
- Assert undo plans generated and telemetry recorded.

**Acceptance**
- [ ] Tests pass with deterministic fixtures.
- [ ] Evidence of each scenario stored in readiness.

**Dependencies**
- Validator updates (Section 2).

**Priority**
- P0.

**References**
- `safeguard_integration.md §3-5`, `todo.md` lines 634-645.

### [ ] Undo Execution Regression Test Harness

**Files**
- `tests/integration/evidenceUndo.test.ts`
- `agent/tests/test_evidence_service.py`

**Requirements**
- Automate undo flow for sample toolkit actions; verify hash parity and Supabase updates.
- Simulate expired token, duplicate undo, and success cases.

**Acceptance**
- [ ] Tests pass; failure captures mismatch details.
- [ ] QA log stored in readiness folder.

**Dependencies**
- Evidence service & API tasks (Sections 2 & 3).

**Priority**
- P0.

**References**
- `workflow.md §7`, `todo.md` lines 668-675.

### [ ] Performance Benchmark Harness

**Files**
- `scripts/benchmark_gate_gb.py`
- `docs/readiness/perf_benchmark_G-B.md`

**Requirements**
- Measure mission runtime (<15 min), planner latency (p95 ≤2.5s), streaming heartbeat (<5s), validator latency (<2s).
- Provide CLI to run benchmarks and persist results.

**Acceptance**
- [ ] Benchmark script runs in CI weekly, failing if thresholds breached.
- [ ] Report stored with charts.

**Dependencies**
- Telemetry metrics (Section 4) and agents.

**Priority**
- P1.

**References**
- `prd.md §9`, `todo.md` lines 840-856.

### [ ] Retention Enforcement Test

**Files**
- `tests/integration/retention.spec.ts`
- `scripts/check_retention.py`

**Requirements**
- Validate TTL jobs purge `copilot_messages`, `mission_feedback`, `simulated_results` after 7 days.
- Ensure telemetry logs retention run with counts.

**Acceptance**
- [ ] Test passes using time travel or manual seed.
- [ ] Evidence log stored in readiness folder.

**Dependencies**
- Supabase TTL config (Section 3).

**Priority**
- P1.

**References**
- `todo.md` lines 858-865, `architecture.md §3.5`.

### [ ] Accessibility Regression Suite

**Files**
- `tests/e2e/a11y.spec.ts`
- `scripts/a11y_scan.ts`

**Requirements**
- Run axe-core and keyboard navigation tests across Stages 3-8.
- Fail if new violations introduced.

**Acceptance**
- [ ] CI includes accessibility suite.
- [ ] Report appended to `docs/readiness/a11y_G-B.md`.

**Dependencies**
- Accessibility updates (Section 1).

**Priority**
- P1.

**References**
- `ux.md §9`, `todo.md` lines 700-714.

### [ ] Telemetry Audit CI Integration

**Files**
- `.github/workflows/telemetry_audit.yml`
- `scripts/audit_telemetry_events.py`

**Requirements**
- Run telemetry audit with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` secrets in CI.
- Fail pipeline if required events missing.

**Acceptance**
- [ ] Workflow green after secrets configured.
- [ ] Failure message actionable with missing event list.

**Dependencies**
- Telemetry tasks (Section 4) and secrets setup.

**Priority**
- P0.

**References**
- `todo.md` lines 858-874, `architecture.md §7`.

---

## Section 6 · Documentation, Readiness & Evidence Collection

### [ ] Update Architecture & UX Docs with IMPLEMENTED References

**Files**
- `new_docs/architecture.md`
- `new_docs/ux.md`

**Requirements**
- Annotate sections reflecting completed implementation (e.g., link to actual components, agents).
- Add callouts for differences requiring follow-up.

**Acceptance**
- [ ] PR includes doc updates referencing file paths.
- [ ] Architecture doc cross-links to Supabase tables created.

**Dependencies**
- Implementation tasks above.

**Priority**
- P2.

**References**
- `todo.md` cross references, blueprint docs.

### [ ] Produce Gate G-B Evidence Bundle Index

**Files**
- `docs/readiness/evidence_index_G-B.md`

**Requirements**
- Catalogue all evidence artifacts (videos, logs, scripts) with owner and storage path.
- Update as tasks complete.

**Acceptance**
- [ ] Evidence index matches Appendix A checklist.
- [ ] Reviewed by Governance sentinel.

**Dependencies**
- Evidence artifacts from Appendix A.

**Priority**
- P0.

**References**
- `todo.md` evidence list, `safeguard_integration.md §6`.

### [ ] Publish Reviewer Workflow SOP

**Files**
- `docs/readiness/reviewer_workflow_G-B.md`

**Requirements**
- Draft decision tree for approvals, escalation, undo, coverage gating.
- Include screenshots from approval modal and validator summary.

**Acceptance**
- [ ] SOP signed off by Governance sentinel.
- [ ] Linked from status beacon.

**Dependencies**
- Approval modal enhancements (Section 1) and validator outputs (Section 2).

**Priority**
- P1.

**References**
- `safeguard_integration.md §3-5`, `todo.md` lines 893-898.

### [ ] Maintain Gate G-B Status Beacon JSON

**Files**
- `docs/readiness/status_beacon_B.json`

**Requirements**
- Update completion percentages, owners, blockers after each milestone.
- Add risk register link and last updated timestamp.

**Acceptance**
- [ ] Beacon consumed by telemetry audit dashboard.
- [ ] Reviewers can identify blockers quickly.

**Dependencies**
- All sections.

**Priority**
- P1.

**References**
- `todo.md` lines 898-905.

### [ ] Document CopilotKit Stream Contract

**Files**
- `docs/readiness/copilotkit_stream_contract_G-B.md`

**Requirements**
- Capture payload schema for streaming events, heartbeat, fallback messaging.
- Include sample logs and SSE headers.

**Acceptance**
- [ ] Document referenced by Telemetry team.
- [ ] Contract validated during streaming tests.

**Dependencies**
- Streaming tasks (Sections 1 & 4).

**Priority**
- P0.

**References**
- `ux.md §5.4`, `todo.md` lines 878-883.

### [ ] Record CopilotKit Dry-Run Session Video

**Files**
- `docs/readiness/copilotkit_session_G-B.mp4`

**Requirements**
- Capture full mission flow including toolkit selection, inspection gating, planner rationale, undo action, feedback submission.
- Overlay console logs or telemetry overlay.

**Acceptance**
- [ ] Video stored and linked in evidence index.
- [ ] Verified by product and governance leads.

**Dependencies**
- End-to-end test readiness (Section 5).

**Priority**
- P1.

**References**
- `todo.md` lines 883-888.

### [ ] Generate Generative Quality Report

**Files**
- `docs/readiness/generative_quality_report_G-B.md`
- `scripts/analyze_edit_rates.py`

**Requirements**
- Analyze acceptance vs edit rates for mission brief and plays.
- Provide summary charts and recommendations.

**Acceptance**
- [ ] Report includes <=20% edit rate target and trend.
- [ ] Action items captured for improvements.

**Dependencies**
- Telemetry data (Section 4).

**Priority**
- P1.

**References**
- `prd.md §7`, `todo.md` lines 888-892.

### [ ] Compile Evidence Bundle Samples

**Files**
- `docs/readiness/evidence_samples_G-B/`
- `scripts/export_evidence_bundle.py`

**Requirements**
- Export bundle for each persona with artifacts, hashes, undo audit, safeguard summary.
- Provide README explaining structure.

**Acceptance**
- [ ] Bundles validated via hash script.
- [ ] Governance sentinel signs off.

**Dependencies**
- Evidence service updates (Section 2) and hash script (Section 4).

**Priority**
- P0.

**References**
- `workflow.md §7`, `todo.md` lines 873-878.

### [ ] Update AGENTS.md & README Gate Notes

**Files**
- `AGENTS.md`
- `README.md`

**Requirements**
- Document new workflows (`mise run test-gb`, Connect Link setup, streaming test instructions).
- Clarify gating expectations and telemetry requirements.

**Acceptance**
- [ ] README includes Gate G-B quickstart.
- [ ] AGENTS.md cross-links to new scripts.

**Dependencies**
- Implementation tasks to be complete.

**Priority**
- P2.

**References**
- Project guide, `todo.md` readiness notes.

### [ ] Publish Retrospective & Archive Evidence

**Files**
- `docs/readiness/archive/2025-10-G-B/retrospective.md`

**Requirements**
- Document lessons learned, timeline, blockers, next-gate recommendations.
- Archive final evidence bundles.

**Acceptance**
- [ ] Retrospective shared with leadership.
- [ ] Archive contains checksums and manifest.

**Dependencies**
- All tasks complete.

**Priority**
- P2.

**References**
- `todo.md` lines 370-375.

---

## Open Questions & Assumptions

### Open Questions
1. **Coverage Threshold Enforcement** — Does Stage 5 allow progression when coverage is 70–84% with governance override? _Source: `workflow.md §4.1` vs `ux.md Stage 4`._
2. **Connect Link Scope Bundles** — Are toolkit scopes auto-selected or user-selectable per Connect Link session? _Source: `libs_docs/composio/llms.txt §4`._
3. **Undo Window Duration** — Confirm default undo TTL (15 minutes?) and whether mission-level configuration is required. _Source: `ux.md §5.7`, `todo.md` lines 628-645._
4. **Telemetry Secrets in CI** — Verify availability of `SUPABASE_SERVICE_ROLE_KEY` for telemetry audit workflow. _Source: `telemetry` tasks & readiness docs._
5. **Retention Policy Exceptions** — Are any enterprise tenants exempt from 7-day retention? _Source: `prd.md §9`._
6. **Planner Caching Strategy** — Clarify caching layer for toolkit metadata to maintain ≤2.5s p95 latency. _Source: `todo.md` lines 851-856._
7. **MCP Draft Result Schema** — Need confirmed schema for Composio draft execution response to map coverage findings. _Source: `libs_docs/composio/llms.txt §5`._

### Assumptions
- Redacted telemetry is sufficient for compliance; no additional anonymization layer required.
- Redis instance is available for regeneration limiter before promotion (see `.env` guidance).
- Supabase linked project credentials available to run `supabase gen types` and `pg_cron` jobs.
- CopilotKit SSE infrastructure stable enough for gating tests; fallback polling used only as last resort.
- Evidence bundles stored in Supabase storage bucket with versioning enabled.
- Governance sentinel can review new SOP within current sprint cadence.
- Playwright-based e2e tests acceptable for Gate G-B sign-off (no Cypress requirement).

---

## Appendix A · Required Evidence Artifacts

- [ ] `docs/readiness/copilotkit_stream_contract_G-B.md`
- [ ] `docs/readiness/copilotkit_session_G-B.mp4`
- [ ] `docs/readiness/intake_confidence_G-B.png`
- [ ] `docs/readiness/e2e_mission_flow_G-B.mp4`
- [ ] `docs/readiness/planner_eval_G-B.md`
- [ ] `docs/readiness/validator_negatives_G-B.md`
- [ ] `docs/readiness/evidence_samples_G-B/` (bundle + manifest)
- [ ] `docs/readiness/undo_trace_G-B.log`
- [ ] `docs/readiness/telemetry_frontend_G-B.md`
- [ ] `docs/readiness/telemetry_backend_G-B.md`
- [ ] `docs/readiness/perf_benchmark_G-B.md`
- [ ] `docs/readiness/a11y_G-B.md`
- [ ] `docs/readiness/generative_quality_report_G-B.md`
- [ ] `docs/readiness/reviewer_workflow_G-B.md`
- [ ] `docs/readiness/status_beacon_B.json`
- [ ] `docs/readiness/evidence_index_G-B.md`
- [ ] `docs/readiness/archive/2025-10-G-B/retrospective.md`
- [ ] `docs/readiness/copilotkit_stream_metrics_G-B.csv`
- [ ] `docs/readiness/hash_verification_report_G-B.json`
- [ ] `docs/readiness/retention_audit_G-B.md`

---

## Appendix B · Gate G-B Promotion Criteria

1. **Functional Completeness** — Stages 1-8 implemented with gating logic, coverage meter enforcing ≥85% or documented override.
2. **Managed Auth Readiness** — Connect Link OAuth flows verified with at least two toolkits and undo assurances captured.
3. **Telemetry Coverage** — Frontend & backend event catalogs (37 events) audited with zero missing entries.
4. **Evidence Integrity** — Artifact hashes verified, undo executions logged, evidence bundles exported for all personas.
5. **Performance SLOs** — Dry-run <15 minutes, planner p95 ≤2.5s, heartbeat <5s, validator <2s, retention checks passing.
6. **Testing & QA** — Eight-stage e2e, streaming resilience, validator negatives, undo regression, accessibility, telemetry audit all green.
7. **Documentation & SOP** — Updated architecture/UX references, reviewer SOP, evidence index, retrospective complete.
8. **Stakeholder Sign-off** — Product, Governance, and Runtime owners approve status beacon; risks logged with mitigation.

---
