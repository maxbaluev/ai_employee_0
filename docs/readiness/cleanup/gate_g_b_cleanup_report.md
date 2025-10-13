# Gate G-B Cleanup Report

**Last updated:** 2025-10-13

## Overview
This report consolidates cleanup work undertaken to align the Control Plane with the Gate G-B generative-first architecture. It supersedes the ad-hoc notes previously stored in this folder.

## Completed Work

### Intake & Safeguards
- Removed Gate G-A fallback code paths from Mission Intake and Control Plane workspace.
- Centralised safeguard normalisation in `src/lib/safeguards/normalization.ts`.
- Added confidence badge telemetry and regeneration tracking tests.

### Toolkit Selection
- Migrated toolkit persistence to the `toolkit_selections` table via `/api/toolkits/selections`.
- Planner inspection preview reads from `fetch_toolkit_selections` in the Supabase service helper.
- Removed redundant `/api/safeguards/toolkits` route and associated tests.

### Tenant Context & Fallbacks
- Eliminated `GATE_GA_DEFAULT_TENANT_ID` fallbacks across API routes, agents, and UI components.
- Enforced explicit tenant context in request payloads and Supabase session helpers.
- Simplified `scripts/fallback_allowlist.json`; only active operational limitations remain.

### Telemetry
- Aligned emitted events with the Gate G-B catalog (`new_docs/ux.md`).
- Deprecated toolkit fallback event renamed (`toolkit_selection_saved` → `toolkit_selected`).
- Added mission brief load/pin telemetry and ensured documented payloads match implementation.

### Documentation
- README and readiness guides updated for Gate G-B requirements.
- CopilotKit stream contract explains absence of default tenant fallbacks.
- Gate G-A readiness artefacts archived under `docs/readiness/archive/gate-g-a/`.

## Testing
- `pnpm run test:ui -- --runInBand src/components/__tests__/RecommendedToolkits.test.tsx`
- `pnpm run test:ui -- --runInBand src/components/__tests__/MissionIntake.confidenceBadges.test.tsx src/components/__tests__/MissionIntake.fallbackRemoval.test.tsx`
- `pnpm exec vitest run src/lib/mission/normalizeBrief.test.ts`
- `pytest agent/tests/test_supabase_catalog.py`

## Follow-ups
- [ ] Optional: add CHECK constraint to `mission_safeguards.hint_type` to prevent toolkit records.
- [ ] Monitor telemetry dashboards for the updated event names and payloads.
