# AI Employee Control Plane — Agent Guide

## Project Snapshot

- Next.js control plane frontend lives under `src/app/(control-plane)` and mirrors the mission intake plus artifact gallery UX.
- Gemini ADK FastAPI agent code resides in `agent/`; evaluation configs live in `agent/evals/` and CLI helpers in `scripts/`.
- Supabase schema + functions are under `supabase/`; readiness evidence is tracked in `docs/readiness/` and long-form product material in `docs/`.
- The repo uses a **single consolidated migration** (`supabase/migrations/0001_init.sql`). When schema or policy updates are required, edit that file (and related sections within it) directly instead of generating new migrations.
- **Documentation:** Navigate all docs via `docs/00_README.md` — includes role-based reading paths and quick reference guides.

## Trust Model & Tool Router Quick Reference

**Tool Router Architecture:**
- **Sole Interface:** All toolkit execution flows through Composio Tool Router meta-tools
- **No MCP Server Selection:** No per-toolkit MCP server configuration required
- **Meta-Tools:** `COMPOSIO_SEARCH_TOOLS`, `COMPOSIO_CREATE_PLAN`, `COMPOSIO_MANAGE_CONNECTIONS`, `COMPOSIO_MULTI_EXECUTE_TOOL`, `COMPOSIO_REMOTE_WORKBENCH`, `COMPOSIO_REMOTE_BASH_TOOL`
- **Sessions:** Scope each mission via `composio.experimental.tool_router.create_session(user_id, options)` before initiating OAuth

**No-Auth Inspection:**
- Inspector agent uses `COMPOSIO_SEARCH_TOOLS` for read-only toolkit discovery without OAuth
- Used for demos, proof-of-value artifacts, and coverage validation
- Returns toolkit metadata, action schemas, and capability assessments
- No write actions or sensitive data access permitted

**Plan & Approve:** Planner triggers `COMPOSIO_MANAGE_CONNECTIONS` (`action="create"`) after stakeholders approve scopes; pass the session URL returned by `create_session` so Auth Link prompts stay scoped to the mission.

**Governed Execution:**
- Executor agent uses `COMPOSIO_MANAGE_CONNECTIONS` (verify action) to ensure connections are active
- All write operations flow through `COMPOSIO_MULTI_EXECUTE_TOOL` with safeguard validation
- Tool Router handles authentication, rate limiting, and error recovery internally
- All actions logged with undo plans for reversibility

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
- **Supabase Workflow:**
  - Link to your Supabase project (local or cloud)
  - After schema edits regenerate types: `supabase gen types typescript --linked --schema public,storage,graphql_public > supabase/types.ts`
  - Validate types compile: `pnpm tsc --noEmit`
  - Update readiness docs in `docs/readiness/` if schema changes affect capabilities
- **Agent Evals:** Run `mise run test-agent` to execute ADK evaluation suites; keep them green before merging.

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

## Tool Router Integration Notes

- **Sole Mechanism:** AI Employee Control Plane standardizes on Tool Router; no per-toolkit MCP servers used
- **Inspector Pattern:** Uses `COMPOSIO_SEARCH_TOOLS` for no-auth discovery and capability assessment
- **Executor Pattern:** Uses `COMPOSIO_MANAGE_CONNECTIONS` for OAuth + `COMPOSIO_MULTI_EXECUTE_TOOL` for parallel execution
- **Context Usage:** Tool Router operations consume ~20k tokens/session; cache discovery results (1-hour TTL)
- **Reference:** See `libs_docs/composio/llms.txt` for complete Tool Router API specs and meta-tool parameters

## Troubleshooting Cheatsheet

- Missing toolchain errors → rerun `mise install` after verifying `.mise.toml` has been trusted.
- Agent refusing connections → ensure secrets are loaded and `mise run agent` is active.
- Supabase RLS failures → confirm migrations have been applied (see Supabase workflow above).
- Tool Router errors → verify `COMPOSIO_API_KEY` configured; check telemetry for `tool_router_call` events; ensure discovery cache not stale.
- Inspect currently active tool versions → `mise current`.

Keep this guide current—agents treat AGENTS.md as the single source of truth for local workflows.

## Documentation Quick Links

For comprehensive guides beyond quick setup:
- **[Documentation Guide](docs/00_README.md)** — Navigate all documentation with role-based reading paths
- **[Getting Started](docs/08_getting_started.md)** — Detailed setup walkthrough and first mission
- **[Capability Roadmap](docs/05_capability_roadmap.md)** — Milestone-based development plan
- **[Implementation Guide](docs/04_implementation_guide.md)** — Component catalog and integration patterns
- **[Actionable Next Steps](docs/todo.md)** — Current priorities and tasks

**For AI agents:** Reference these docs when implementing features or troubleshooting complex issues beyond this quick reference.

## Operational Notes

- **Database Schema:** All database and storage logic is defined in `supabase/migrations/0001_init.sql` (single consolidated migration).
- **ADK Eval Mode:**
  - Set `EVAL_MODE=true` before running `mise run test-agent` to activate in-memory Supabase stubs used by `agent/evals/control_plane`
  - Unset `EVAL_MODE` when testing against real Supabase to avoid overriding live clients

### Telemetry Hygiene

- Scrub PII before sending events—reuse `src/lib/telemetry/redaction.ts` helpers and extend them if new fields appear.
- CopilotKit runtime supports opt-out/sampling flags; set `telemetryDisabled` or adjust sample rate when needed.
- CI: set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to enable the telemetry-audit workflow.
