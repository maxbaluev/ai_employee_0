# AI Employee Control Plane — Agent Guide

## Project Snapshot

- Next.js control plane frontend lives under `src/app/(control-plane)` and mirrors the mission intake plus artifact gallery UX.
- Gemini ADK FastAPI agent code resides in `agent/`; evaluation configs live in `agent/evals/` and CLI helpers in `scripts/`.
- Supabase schema + functions are under `supabase/`; readiness evidence is tracked in `docs/readiness/` and long-form product material in `new_docs/`.

## Mise-First Setup

- mise manages tool versions, environment variables, and project tasks for this repo—do not mix in global Node or Python installs.
- Bootstrap the toolchain (trust→install) from the repo root:
  - `mise trust`
  - `mise install`
  - `mise run install` (wraps `pnpm install` for the workspace)
  - `mise run agent-deps` (syncs Python deps via `uv` and `agent/requirements.txt`)
- Expected pinned versions (`mise current`): Node `22.20.0`, Python `3.13.7`, pnpm `10.18.0`, uv `0.9.2`.
- Need a quick status check? Use `mise doctor`, `mise config`, `mise env`, or `mise which <tool>` to debug runtime mismatches.
- List all available project automations with `mise tasks`; every command in this guide assumes the mise-managed PATH.

## Environment & Secrets

- Secrets already inside `.env` file
- `agent/agent.py` calls `load_dotenv()`, so the FastAPI service picks up values from `.env` automatically. Next.js also reads the same file when you run `pnpm dev` / `mise run dev`.
- For ad-hoc shells, source the file (`set -a; source .env; set +a`) or pass it via `mise exec --env-file .env <command>` if you need the variables in other tooling.

## Core Tasks & Workflows

- `mise run dev` — launch full stack (Next.js UI + FastAPI agent).
- `mise run ui` — UI-only dev server.
- `mise run agent` or `./scripts/run-agent.sh` — start the Gemini ADK agent in isolation.
- Use supabase linked stack
  After schema edits regenerate types with `supabase gen types typescript --linked --schema public,storage,graphql_public >| supabase/types.ts` and update readiness docs in `docs/readiness/`.
- Agent evals: once deps are synced run
  ```bash
  uv run --with-requirements agent/requirements.txt \
    adk eval agent/agent.py agent/evals/smoke_g_a_v2.json
  uv run --with-requirements agent/requirements.txt \
    adk eval agent/agent.py agent/evals/dry_run_ranking_G-B.json
  ```
  (These are the commands behind `mise run test-agent`; keep them green before merging.)

## Testing & Quality Gates

- UI unit/integration tests: `pnpm run test:ui` (leverages Vitest + React Testing Library).
- Agent evals: `mise run test-agent` (wraps the ADK eval commands above).
- Python quick sweep: `mise exec python -- -m compileall agent` for fast syntax validation.
- Lint + TypeScript checks: `pnpm run lint` or `mise run lint` (run a dry pass before autofix; stay scoped to files you touched).
- Add/update tests alongside code changes—CI expects green lint, UI tests, and agent evals.

## Code Style & Conventions

- TypeScript is strict; prefer functional React components and server components where applicable.
- ESLint defaults: single quotes, no semicolons, Tailwind v4 utilities.
- Keep shared utilities near their feature boundaries; avoid cross-package mutations unless documented.
- Python modules stay fully typed; format via Ruff/Black (`uv run ruff check --fix agent`).

## Supabase & Data Artifacts

- Primary schema file: `supabase/migrations/0001_init.sql` (missions, feedback, toolkit selections, inspection findings, OAuth tokens).
- Seeds live in `supabase/seed.sql`; rerun `supabase db reset --seed supabase/seed.sql` when iterating on local data.
- Update `docs/readiness/` after any schema or data contract change.

## Troubleshooting Cheatsheet

- Missing toolchain errors → rerun `mise install` after verifying `.mise.toml` has been trusted.
- Agent refusing connections → ensure secrets are loaded and `mise run agent` is active.
- Supabase RLS failures → confirm migrations have been applied (see Supabase workflow above).
- Catalog refresh or Composio drift → `mise exec --env-file .env python -m agent.tools.composio_client --status`.
- Inspect currently active tool versions → `mise current`.

Keep this guide current—agents treat AGENTS.md as the single source of truth for local workflows.
