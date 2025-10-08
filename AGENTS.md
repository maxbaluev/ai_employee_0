# AI Employee Control Plane — Agent Guide

This repository hosts the Gate G-A foundation for the AI Employee Control Plane. The system pairs a Next.js CopilotKit workspace with a packaged Gemini ADK backend, Supabase migrations, and catalog parsing helpers. Use this guide to stay aligned with the guardrails, build steps, and verification flows described in `new_docs/`.

## Environment & Tooling
- Prefer **mise** to hydrate toolchains. Run `mise trust` (once), then `mise install` and `mise env activate` so Node 22, Python 3.13, pnpm, and uv match `.mise.toml`.
- Frontend packages use **pnpm**. Avoid generating lockfiles with other package managers.
- Python services live under `agent/`. Install deps with `uv pip install -r agent/requirements.txt` (fast) or a virtualenv activated via `mise exec python -- -m venv .venv`.
- Environment variables: `GOOGLE_API_KEY` must be set for ADK, plus Supabase/Composio secrets when you move past dry-run work. Keep secrets out of committed files.

## Setup Commands
- Install frontend deps: `mise run install` (wraps `pnpm install`)
- Install agent deps: `uv pip install -r agent/requirements.txt`
- Start full stack (UI + agent): `mise run dev`
- Run only the UI: `mise run ui`
- Run only the agent (JS launcher) : `mise run agent` or execute `mise exec python -- agent/agent.py`
- Apply Supabase schema locally: `supabase start && supabase db push --file supabase/migrations/0001_init.sql`

## Build & Test
- UI lint/type checks: `mise run lint`
- (Future) add unit tests under `agent/tests/` and run via `pnpm test` / `pytest`; keep placeholders updated as testing harness lands.
- Smoke-check the Python package after edits: `mise exec python -- -m compileall agent`

## Code Style & Patterns
- **TypeScript**: stick to strict mode defaults (`tsconfig`), use single quotes and trailing commas, no implicit `any`. Favor functional React patterns and avoid class components.
- **React**: colocate components in the `(control-plane)` directory, keep mission state sync through `useCoAgent`. Use descriptive tailwind utility groupings, no inline hex strings except theme accents.
- **Python**: follow PEP 8. Prefer dataclasses/Pydantic models for state. Avoid global side effects in module imports—use application factories (`agent/runtime/app.py`).
- Keep guardrail logic deterministic. Mission state mutations go through the declared ADK tools (`set_mission_details`, `append_planner_note`, `upsert_artifact`).

## Domain Guidance
- Use `new_docs/architecture.md` and `guardrail_policy_pack.md` to validate new planner/validator behavior. Gate G-A assumes dry-run only (no OAuth sends).
- Composio catalog metadata is sourced via the Composio SDK. Keep the SDK pinned, ensure `COMPOSIO_API_KEY` is configured, and rerun your chosen validation workflow so planners see the latest catalogue state.
- Supabase schema changes must retain RLS. Update `supabase/migrations/` and keep downstream validation assets in sync.

## When Editing
- Keep any gate-specific evidence assets up to date as they are introduced by future milestones.
- Touching `agent/agents/control_plane.py`? Confirm the CopilotKit UI still renders mission/artifact data (`pnpm dev` + browser check) and keep instructions aligned with Gate G progression.
- Coordinate copy or UX tweaks with the PRD (`new_docs/prd.md`) so Gate definitions (G-A → G-F) remain traceable.

## Useful References
- Implementation sequencing: `new_docs/implementation_plan.md`
- Guardrails & approvals: `new_docs/guardrail_policy_pack.md`
- Libraries & partner docs: `libs_docs/` (Composio, CopilotKit, ADK, Supabase)

Keep this file current as you expand beyond Gate G-A. Anything you would brief a new teammate on should live here for agents to pick up automatically.
