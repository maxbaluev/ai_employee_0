# Control Plane Cleanup – October 13, 2025

## Summary
- Removed the unused `/api/safeguards/toolkits` fallback endpoint and its test harness.
- Updated `/api/toolkits` to source previously-selected toolkits from `toolkit_selections`, aligning with the Gate G-B data contract.
- Extracted safeguard normalization helpers to `src/lib/safeguards/normalization.ts` so ControlPlaneWorkspace and future flows share a single canonical implementation.
- Cleared residual fallback commentary from the intake service.

## Verification
- `pnpm run test:ui -- --runInBand src/components/__tests__/MissionIntake.confidenceBadges.test.tsx src/components/__tests__/MissionIntake.fallbackRemoval.test.tsx`

## Follow Ups
1. Backfill `toolkit_selections` from legacy `mission_safeguards` rows where `hint_type = 'toolkit_recommendation'` (script in Supabase console).
2. Introduce a lightweight unit test for `normalizeSafeguards` once additional callers adopt the helper.
