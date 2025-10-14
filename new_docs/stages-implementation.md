# Mission Stages Implementation Guide

_Last updated: October 14, 2025_

## 0. Purpose & Source Map

This guide documents how the eight-stage mission workflow is implemented in the AI Employee Control Plane frontend. It is the bridge between the conceptual workflow described in `new_docs/workflow.md` and the UX blueprint in `new_docs/ux.md`, and it references the core state management utilities in `src/components/mission-stages/` alongside the primary workspace container at `src/app/(control-plane)/ControlPlaneWorkspace.tsx`.

Read this alongside:

- `new_docs/workflow.md §1` for the stage-by-stage business flow.
- `new_docs/architecture.md §3.1` for the presentation layer blueprint.
- `new_docs/ux.md §3` for workspace interaction details.
- `src/components/mission-stages/MissionStageProvider.tsx` for the context implementation referenced throughout this document.

---

## 1. Why stages are not Next.js routes

### 1.1 Stateful workspace, not segmented routes

The workspace lives at `src/app/(control-plane)/page.tsx` and renders a single React tree. Stages are UI states inside that tree rather than file-based routes such as `/stages/intake` or `/stages/dry-run`. This decision keeps the following guarantees:

- **Continuous CopilotKit context** – streaming chat, plan updates, and mission state hydrate into a single provider tree that would otherwise reset on route transitions.
- **Cross-stage coordination** – components for Plan, Dry Run, Evidence, and Feedback need to observe shared mission data, undo tokens, and validation results without reloading or juggling query params.
- **Hydration recovery** – the workspace rehydrates prior stage states from Supabase snapshots (`hydrateStages` helper) so a browser refresh or reconnect returns the user to the correct stage with the associated telemetry context.

### 1.2 Implementation note

`MissionStageProvider` wraps the entire workspace in `ControlPlaneWorkspace.tsx` (see lines 2090–2110). Child components use `useMissionStages()` to read the current stage, gate UI, and emit stage transitions.

---

## 2. Stage state machine

### 2.1 Stage order and enums

`src/components/mission-stages/types.ts` defines the canonical order via `MISSION_STAGE_ORDER`:

1. `intake`
2. `brief`
3. `toolkits`
4. `inspect`
5. `plan`
6. `dry_run`
7. `evidence`
8. `feedback`

Each stage status has a `state` of `pending`, `active`, `completed`, or `failed`, plus timestamps and metadata.

### 2.2 Transition rules

Key functions in `MissionStageProvider.tsx`:

- `markStageStarted(stage, metadata?)`
- `markStageCompleted(stage, metadata?)`
- `markStageFailed(stage, metadata?)`

Transitions obey gating rules:

- Only the current `active` stage or its immediate successor can move to `active`.
- Completing a stage automatically starts the next stage unless it is locked or failed.
- Failing a stage locks it and prevents further progression until manual recovery logic runs.

### 2.3 Telemetry coupling

Telemetry events (`stage_<name>_started|completed|failed`) are batched via `pendingTelemetryRef` and flushed in an effect. Each event includes `tenantId`, `missionId`, `timestamp`, and optional metadata. See lines 340–383 in `MissionStageProvider.tsx`.

---

## 3. Component mapping & completion triggers

The table below ties each stage to the primary UI surfaces and describes the conditions that mark the stage as completed. Line numbers reference `ControlPlaneWorkspace.tsx` where the components render and call the stage helpers.

| Stage | Component(s) | Trigger for `markStageCompleted` | Key references |
| --- | --- | --- | --- |
| Intake | `MissionIntake` | Accepted chips persisted via `handleIntakeAccept`; telemetry `brief_generated` | `ControlPlaneWorkspace.tsx:1490-1560`, `MissionStageProvider.tsx:183-233` |
| Brief | `MissionBriefCard`, pinned brief stack | Supabase mission brief load + acceptance toast | `ControlPlaneWorkspace.tsx:330-520` |
| Toolkits | `RecommendedToolStrip`, Connect Link modal | Selected toolkits stored in `toolkit_selections`, undo tokens generated | `ControlPlaneWorkspace.tsx:1561-1655`, `src/components/RecommendedToolkits.tsx` |
| Inspect | Coverage meter, MCP inspection summary | Inspection previews resolve (`inspection_preview_rendered` telemetry) | `ControlPlaneWorkspace.tsx:1656-1704`, `src/hooks/useInspectionPreview.ts` |
| Plan | Planner insight rail, play cards | User locks a plan; validator returns `plan_validated` | `ControlPlaneWorkspace.tsx:1705-1820`, `src/components/PlannerInsightRail.tsx` |
| Dry Run | Streaming status panel, heartbeat | Dry-run loop completes with evidence bundle | `ControlPlaneWorkspace.tsx:1821-1980`, `src/components/StreamingStatusPanel.tsx` |
| Evidence | Artifact gallery, undo bar | Artifacts persisted, undo tokens verified | `ControlPlaneWorkspace.tsx:1981-2040`, `src/components/ArtifactGallery.tsx` |
| Feedback | Feedback drawer | Feedback submitted to Supabase `mission_feedback` | `ControlPlaneWorkspace.tsx:2041-2100`, `src/components/FeedbackDrawer.tsx` |

Components subscribe to `useMissionStages()` to determine whether they should render, remain disabled, or emit transition calls. The workspace ensures that earlier stages remain visible for review while later stages progress.

---

## 4. Persistence & hydration

### 4.1 Supabase snapshots

Mission stages persist to Supabase as an array saved with the mission record. Snapshots include `stage`, `state`, `startedAt`, `completedAt`, `metadata`, and optional `locked`. The structure is restored when a session reconnects or the workspace loads from an existing mission.

### 4.2 Hydration logic

`hydrateStages(entries)` coerces snapshot values into `Date` objects, merges metadata, and avoids rerenders when no fields change. It gracefully handles missing stages, unknown states, or timestamp formats. See `MissionStageProvider.tsx:270-339`.

### 4.3 Recovery flow

`ControlPlaneWorkspace.tsx` invokes `hydrateStages` once mission data loads (lines 560-720). If the snapshot marks a stage as `failed`, the workspace keeps it locked and surfaces guardrails to the user. Telemetry events are not re-fired during hydration; they only emit from user-driven transitions.

---

## 5. Testing stages

### 5.1 Unit tests

`src/components/mission-stages/__tests__/MissionStageProvider.test.tsx` covers:

- Initialization with Intake active.
- Sequential progression through all stages.
- Auto-start of the next stage on completion.
- Blocking out-of-order transitions.
- Duration calculations.

`src/components/mission-stages/__tests__/MissionStageProvider.telemetry.test.tsx` validates telemetry batching and payload structure.

### 5.2 Integration tests

When writing integration tests:

- Wrap components with `MissionStageProvider` and mock `sendTelemetryEvent` to assert expected events.
- Use `hydrateStages` to seed states before rendering (e.g., to test stage-specific surfaces without running full flows).
- For Next.js page-level tests, use the workspace fixtures in `src/app/tests/workspaceHarness.tsx` to render the control plane with stage overrides.

---

## 6. Extending or modifying stages

To add a new stage or change stage behavior:

1. **Update types:** add the enum value and insert it into `MISSION_STAGE_ORDER` in `src/components/mission-stages/types.ts`.
2. **Adjust provider logic:** extend gating rules if the new stage should run in parallel or permit skipping. Ensure telemetry event names align with the new stage identifier.
3. **Render UI:** mount the new component inside `ControlPlaneWorkspace.tsx` and guard it with `useMissionStages()` checks.
4. **Persist state:** update Supabase schema and hydration logic if additional metadata is required.
5. **Telemetry:** register new events in the telemetry catalog and update analytics dashboards if necessary.
6. **Tests:** add unit coverage for new transition paths and update integration tests to cover UI visibility and end-to-end flows.

When removing a stage, reverse the process and ensure Supabase snapshots are migrated or coerced to avoid stale entries.

---

## 7. Troubleshooting

| Symptom | Diagnosis steps | Fix |
| --- | --- | --- |
| Stage never advances | Check whether previous stage marked `completed`; inspect Supabase snapshot for locked state | Manually clear `locked` flag or update completion trigger logic |
| Stage reverts to pending on refresh | Ensure `hydrateStages` receives mission snapshot; confirm Supabase returns array format | Verify API response shape and hydration call in `ControlPlaneWorkspace.tsx` |
| Telemetry missing for stage | Confirm `markStage*` helper is invoked; ensure telemetry flush effect runs (no render loops) | Add explicit transition call or telemetry metadata |
| Component renders too early | Wrap component logic with `stages.get(stage)` state checks; confirm gating conditions | Adjust condition to require `state !== 'pending'` before rendering |

---

## 8. Reference index

- `src/components/mission-stages/types.ts`
- `src/components/mission-stages/MissionStageProvider.tsx`
- `src/components/mission-stages/MissionStageProgress.tsx`
- `src/app/(control-plane)/ControlPlaneWorkspace.tsx`
- `src/components/RecommendedToolkits.tsx`
- `src/components/StreamingStatusPanel.tsx`
- `src/components/ArtifactGallery.tsx`
- `src/components/FeedbackDrawer.tsx`
- `new_docs/workflow.md`
- `new_docs/ux.md`
- `new_docs/architecture.md`

