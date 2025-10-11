# AI Employee Control Plane — Agent Guide

## Overview
- Next.js control plane frontend lives under `src/app/(control-plane)` and mirrors the mission intake + artifact gallery UX.
- The Gemini ADK FastAPI agent resides in `agent/`, with eval configs under `agent/evals/` and CLI helpers in `scripts/`.
- Supabase schemas and functions are in `supabase/`; readiness evidence lives in `docs/readiness/` and product docs in `new_docs/`.

## Toolchain & Setup
- Trust and hydrate pinned tool versions with `.mise.toml`:
  - `mise trust`
  - `mise install`
- Install workspace dependencies via mise tasks:
  - `mise run install` (wraps `pnpm install`)
  - `mise run agent-deps` (installs Python deps with `uv`)
- All project scripts assume `pnpm` and `uv` are supplied by mise; avoid mixing in global Node or Python installs.

## Environment Management with direnv
- Use `direnv` for per-shell environment hydration; `use mise` in `.envrc` bootstraps the pinned toolchain automatically when you `cd` into the repo.
- Populate `.envrc` (or `.envrc.local`) with the required secrets. A minimal template:
  ```bash
  use mise
  export NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
  export NEXT_PUBLIC_SUPABASE_ANON_KEY="anon-key-from-supabase"
  export SUPABASE_SERVICE_ROLE_KEY="service-role-key-from-supabase"
  export GOOGLE_API_KEY="your-google-api-key"
  export COMPOSIO_API_KEY="your-composio-api-key"
  export GATE_GA_DEFAULT_TENANT_ID="00000000-0000-0000-0000-000000000000"
  export NEXT_PUBLIC_COPILOT_RUNTIME_URL="/api/copilotkit"
  export NEXT_PUBLIC_COPILOT_AGENT_ID="control_plane_foundation"
  ```
- Run `direnv allow` after editing to trust the file. `.envrc*` entries are already ignored by git—keep secrets there.
- For subshells that bypass direnv (CI runners, one-off commands), wrap the invocation: `direnv exec . mise run dev`.

## Common Workflows
- Full stack (UI + agent): `mise run dev` (use `direnv exec . mise run dev` if direnv isn't auto-loading)
- UI only: `mise run ui`
- Agent only: `mise run agent` or `./scripts/run-agent.sh`
- Supabase local stack:
  ```bash
  supabase start
  supabase db reset --seed supabase/seed.sql
  # or, for iterative changes
  supabase db push --file supabase/migrations/0001_init.sql
  ```
  `0001_init.sql` now contains the full schema (feedback, toolkit selections, inspection findings, OAuth tokens). Regenerate Supabase types after schema edits via `supabase gen types typescript --linked`. Update readiness artifacts in `docs/readiness/` after applying migrations.

## Testing & Quality Gates
- UI unit/integration tests: `pnpm run test:ui`
- Agent smoke + ranking evals (long running): `mise run test-agent`
- Lint + TypeScript checks: `pnpm run lint` (mise task `mise run lint` is equivalent)
- Python quick syntax sweep: `mise exec python -- -m compileall agent`
- Add or update tests alongside any code changes; CI expects a clean run of lint + both test suites before merge.

## Code Style & Conventions
- TypeScript runs in strict mode; prefer functional React components and server components when possible.
- Follow the Next.js default ESLint config: single quotes, no semicolons, Tailwind 4 utility classes.
- Keep shared utilities co-located with their feature; avoid cross-package mutations.
- Python agent modules should remain typed (`typing`/`pydantic`) and formatted via Ruff/Black defaults (run `uv run ruff check --fix agent` if needed).

## Hotspots & References
- `src/app/(control-plane)/ControlPlaneWorkspace.tsx` — primary UI orchestrator.
- `agent/agents/control_plane.py` — mission tools exposed to the UI.
- `agent/runtime/app.py` — FastAPI factory consumed by scripts/tests.
- `scripts/test_supabase_persistence.py` & `scripts/test_copilotkit_persistence.py` — targeted persistence smoke tests.
- `supabase/migrations/0001_init.sql` — consolidated schema (missions, feedback, toolkit selections, inspection findings, OAuth tokens).

## Troubleshooting
- Missing toolchain warnings mean `mise install` has not been run; rehydrate before debugging.
- If the agent refuses connections, ensure `mise run agent` is active (with direnv-loaded credentials) and that Makersuite + Composio keys are populated.
- Supabase RLS errors usually indicate migrations were not applied; rerun the commands under "Common Workflows".
- Catalog refresh issues can be diagnosed with `direnv exec . python -m agent.tools.composio_client --status`.

Keep AGENTS.md in sync with workflow changes—agents treat this file as the source of truth for project automation.
