# Gate G‑B Status

- **Key Code Changes**: `src/lib/intake/regenerationLimiter.ts`, `src/lib/intake/stores/postgresStore.ts`, `src/lib/feedback/service.ts`, `src/lib/telemetry/redaction.ts`, `.github/workflows/supabase-types-check.yml`, `supabase/migrations/0001_init.sql`, `supabase/types.ts`.
- **Targeted Tests**: `pnpm vitest run src/components/FeedbackDrawer.test.tsx src/lib/intake/regenerationLimiter.test.ts src/app/api/intake/regenerate/route.test.ts src/lib/telemetry/redaction.test.ts` — all passing (60 tests).
- **Typecheck**: `pnpm tsc --noEmit` still surfaces pre-existing issues (ControlPlaneWorkspace severity badge, pdfkit typings, Vitest globals, planner/safeguards type gaps). No new Gate G‑B errors introduced.
- **Telemetry Audit**: `python scripts/audit_telemetry_events.py --gate G-B` skipped — missing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in current env.
- **ADK Evals**: `mise run test-agent` now passes (smoke + G‑B ranking suites); Supabase types still need `mission_regeneration_limits` regeneration downstream.
- **Remaining Follow-ups**: Redis-backed limiter store (REDIS_URL, atomic INCR/PEXPIRE), wire telemetry audit into CI once Supabase creds available, align docs/AGENTS.md/README with Redis backend + Supabase type regeneration workflow.
- **Supabase Types**: Regeneration blocked until a linked Supabase project (or `SUPABASE_ACCESS_TOKEN` + `supabase/config.toml`) is provided; once available run `supabase gen types typescript --project-ref <PROJECT_REF> --schema public,storage,graphql_public > supabase/types.ts`. Postgres store casts stay in place until types include `mission_regeneration_limits`.
