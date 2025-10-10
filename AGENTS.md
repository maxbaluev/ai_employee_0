# AI Employee Control Plane — Agent Operating Guide

This repository powers the Gate G-A/G-B milestones for the AI Employee control plane: a Next.js CopilotKit workspace, Gemini ADK backend, Supabase data plane, and supporting scripts. Use this guide as the single source of truth for automated contributors.

## 1. Toolchain Hydration

- **Trust mise configs once:** `mise trust`
- **Install pinned runtimes:** `mise install`
- **Activate env + PATH:** `eval "$(mise env activate bash)"`
  - Exports everything declared in `.env`, `.mise.toml`
  - Sets Node 22, Python 3.13, pnpm, uv, Supabase CLI, etc.
- Use `mise exec <tool> -- <cmd>` to run commands against hydrated runtimes without globally activating them.

## 2. Environment Variables

Required for both UI and agents (most live in `.env`):

| Key                                                               | Purpose                             |
| ----------------------------------------------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | Frontend Supabase client            |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`                      | Server/agent Supabase connectivity  |
| `GOOGLE_API_KEY`                                                  | Gemini ADK intake + planner prompts |
| `COMPOSIO_API_KEY`                                                | Toolkit discovery & OAuth passes    |
| `GATE_GA_DEFAULT_TENANT_ID`                                       | Tenant fallback for local runs      |
| `NEXT_PUBLIC_COPILOT_AGENT_ID`, `NEXT_PUBLIC_COPILOT_RUNTIME_URL` | CopilotKit shared state             |

**Tip:** Agents fail fast if `SUPABASE_SERVICE_ROLE_KEY` is missing. Always ensure `env | grep SUPABASE` shows both URL + service key before running scripts.

## 3. Daily Commands

- Install frontend deps: `mise run install` (wraps `pnpm install`)
- Install agent deps: `uv pip install -r agent/requirements.txt`
- Full stack dev (UI + agent): `mise run dev`
- UI only: `mise run ui`
- Agent only: `mise run agent` or `mise exec python -- agent/agent.py`
- Gemini ADK smoke suite (Gate G-B ready): `mise run test-agent`
- Lint: `mise run lint`
- Python package sanity: `mise exec python -- -m compileall agent`

## 4. Supabase CLI Workflow

- Use supabase cli for supabase manipulations like migrations.

## 5. Testing Expectations

- Gate G-A smoke: `mise run test-agent` (runs `agent/evals/smoke_g_a_v2.json`)
- Gate G-B evals: `mise run test-agent` automatically covers ranking + streaming; regenerate evidence artifacts under `docs/readiness/`
- When running tests or Supabase scripts directly, activate the env in the current shell first: `eval "$(mise env activate bash)"` so `.env` secrets (Supabase keys, API tokens) are loaded.
- Frontend lint: `pnpm lint`
- Planned future tests:
  - `pnpm test` / `pytest` once test suites land in `agent/tests/`
  - `scripts/analyze_edit_rates.py` (requires Supabase service creds)
  - `scripts/verify_artifact_hashes.py`

## 6. Code Style & Conventions

- **TypeScript:** strict mode, single quotes, trailing commas, functional React patterns, no implicit any.
- **React:** keep Gate control-plane components in `src/app/(control-plane)`, prefer CopilotKit hooks (`useCopilotReadable`, `useCopilotAction`), keyboard-accessible UI, descriptive Tailwind groupings.
- **Python:** PEP 8, dataclasses/pydantic for state, avoid side effects at import time, centralize Supabase interactions via `agent/services`.
- **Migrations:** RLS required for every table; never remove existing policies without stakeholder review.
- **Telemetry:** emit via `TelemetryEmitter`/`emitTelemetry` helpers; sync with `new_docs/ux.md §10` event catalog.
- **Migrations** do not implement new migrations, if you need database change modify 0001_init.sql

## 7. Mission Safety & Guardrails

- Adaptive safeguards (tone, quiet hours, escalation) must route through `mission_safeguards` and be respected by validators.
- Undo plans required for every governed tool call (`tool_calls.undo_plan_json`).
- Sensitive data redacted before telemetry/evidence; the evidence service hashes arguments before storing.
- Composio usage rules: do not mix `search` with explicit tool arrays; prefer `tools.get` filtered by toolkit + scopes.

## 8. Documentation & Evidence

- Keep Gate readiness artifacts in `docs/readiness/` synced with implementation (status beacons, seed logs, undo traces, eval outputs).
- Update `new_docs/` (architecture, PRD, UX, workflow, todo) whenever behaviour changes.

## 9. Escalation Matrix

- **Runtime steward (ADK + agents):** owns planner/executor/validator behaviour & eval suites.
- **CopilotKit squad:** UX streaming, approvals modal, shared state.
- **Data engineer:** Supabase migrations, analytics views, retention jobs.
- **Governance sentinel:** Guardrail policy pack, undo readiness, reviewer SOP.
- **GTM enablement:** Library seeding, evidence storytelling.

Stay current: rerun `mise env activate` after editing `.env`/`.mise.toml`, keep Supabase CLI authenticated, and refresh readiness artifacts before promoting a Gate.

## 10. Reference Doc Outline

- **`new_docs/`**
  - `architecture.md` — Technical architecture blueprint covering layers, agents, data plane, and safeguards (updated October 8, 2025).
  - `prd.md` — Business PRD with market context, personas, value props, and scope expectations (drafted October 7, 2025).
  - `todo.md` — Gate-by-gate implementation roadmap with checklists, owners, and evidence requirements (version 1.1, October 8, 2025).
  - `ux.md` — UX blueprint detailing personas, workspace anatomy, interaction patterns, and telemetry priorities (version 1.0, October 8, 2025).
  - `workflow.md` — Workflow specification translating docs into execution sequences and MCP guardrails (last updated October 9, 2025).

- **`libs_docs/`**
  - `adk/llms-full.txt` — Gemini ADK reference pack covering agent orchestration patterns and toolkit capabilities.
  - `composio/llms.txt` — Composio toolkit catalogue excerpt for discovery, scopes, and planner integration.
  - `copilotkit/llms-full.txt` — CopilotKit workspace guidance covering hooks, shared state, and streaming UX contracts.
  - `supabase/llms_docs.txt` — Supabase CLI and schema companion outlining migrations, RLS expectations, and persistence workflows.
