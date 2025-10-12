# PR: Gate G‑B Cleanup & Telemetry Hardening

## Summary
- Refactored intake regeneration limiter into pluggable stores (memory, Postgres, Redis) with shared abstraction + tests (`src/lib/intake/regenerationLimiter.ts`, `src/lib/intake/stores/*`).
- Switched feedback service onto generated Supabase types and removed local shim (`src/lib/feedback/service.ts`, `supabase/types.ts`).
- Hardened telemetry redaction typing and added unit coverage (`src/lib/telemetry/redaction.ts`, `src/lib/telemetry/redaction.test.ts`).
- Added Supabase types CI guard and telemetry audit workflow (`.github/workflows/supabase-types-check.yml`, `.github/workflows/telemetry-audit.yml`).
- Updated docs/readiness for limiter backends, Supabase regeneration, telemetry hygiene (`AGENTS.md`, `README.md`, `docs/readiness/*`).

## Validation
- `pnpm vitest run src/lib/intake/regenerationLimiter.test.ts src/app/api/intake/regenerate/route.test.ts src/components/FeedbackDrawer.test.tsx src/lib/telemetry/redaction.test.ts`
- `mise run test-agent` (smoke + G‑B ranking)
- `pnpm tsc --noEmit` (pre-existing warnings only)

## Follow-ups
1. Regenerate Supabase types once `mission_regeneration_limits` lands in the linked project; remove temporary casts in Postgres store afterwards.
2. Provide `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets so telemetry audit workflow runs in CI.
3. Replace eval Supabase stub with real fixtures/creds when production Supabase access is available for Gate G‑B ADK suites.
