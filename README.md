# AI Employee Control Plane — Gate G-B Control Plane

This repository delivers the Gate G-B control plane for the AI Employee program. It pairs a CopilotKit-powered Next.js workspace with a packaged Gemini ADK backend, a Composio SDK integration, and Supabase migrations.

**Progressive Trust Model:** Start with **no-auth inspection**—read-only exploration of public data and toolkit capabilities to generate proof-of-value artifacts (contact enrichment drafts, campaign plans, competitive analysis) without requiring credentials. Once value is demonstrated, users opt into **governed execution** with OAuth for write actions, sensitive data access, and production workflows.

## Architecture Highlights

- **Frontend scaffolding:** `src/app/(control-plane)` now contains route groups and stage placeholders only. Use these shells to build the mission intake, readiness rail, planner, execution timeline, and evidence gallery described in `docs/03_user_experience.md` and `docs/04_implementation_guide.md`.
- **Backend scaffolding:** `agent/` provides a FastAPI app (`agent/agent.py`) plus stub modules under `agent/agents/`, `agent/services/`, and `agent/tools/`. Replace the TODOs with real Gemini ADK agents and Composio integrations during implementation.
- **Composio SDK integration:** No demo code remains. Implement Inspector/Planner/Executor flows using the native SDK (`ComposioClient`) as outlined in `docs/10_composio.md` when building out the backend.
- **Data plane:** `supabase/migrations/0001_init.sql` still holds the unified schema for missions, readiness evidence, and telemetry.
- All reference materials remain in `docs/` (architecture, guardrails, readiness roadmaps).

## Prerequisites

- [mise](https://mise.jdx.dev/) for tool version management
- Node.js 22 (installed via mise)
- Python 3.13 (installed via mise)
- [pnpm](https://pnpm.io/) (installed via mise)
- [uv](https://github.com/astral-sh/uv) for Python dependency installs
- Google Makersuite API key (https://makersuite.google.com/app/apikey)
- Supabase CLI (optional, for local database testing)
- Composio API key (required for catalog discovery)

> Run `mise trust` once in the repo, then `mise install` to hydrate Node, pnpm, and Python according to `.mise.toml`.

## Getting Started

1. **Install toolchains**

   ```bash
   mise trust
   mise install
   ```

2. **Install JavaScript dependencies**

   ```bash
   mise run install   # wraps `pnpm install`
   ```

3. **Install Python dependencies**

   ```bash
   uv pip install -r agent/requirements.txt
   ```

4. **Export environment variables**

   ```bash
   export GOOGLE_API_KEY="your-google-api-key-here"
   export COMPOSIO_API_KEY="your-composio-api-key"
   export NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
   export NEXT_PUBLIC_SUPABASE_ANON_KEY="anon-key-from-supabase"
   export SUPABASE_SERVICE_ROLE_KEY="service-role-key-from-supabase"
   export NEXT_PUBLIC_COPILOT_RUNTIME_URL="/api/copilotkit"
   export NEXT_PUBLIC_COPILOT_AGENT_ID="control_plane_foundation"
   export AGENT_HTTP_URL="http://localhost:8000/"
   ```

   **Note:** Gate G-B requires explicit tenant context. All API routes now require `tenantId` in request payloads or authenticated Supabase sessions. No default tenant fallbacks are supported.

5. **Run the full stack**

   ```bash
   mise run dev
   ```

   - UI only: `mise run ui`
   - Agent only: `mise run agent` or `mise exec python -- agent/agent.py`

## Supabase (Optional)

Spin up a local stack and apply the Gate G-A migration:

```bash
supabase start
supabase db push --file supabase/migrations/0001_init.sql
```

Record the CLI output in `docs/readiness/migration_log_G-A.md` and update
`docs/readiness/db_checksum_G-A.csv` with the row checksums you observe. Seed
baseline guardrail profiles using `docs/readiness/guardrail_profiles_seed.csv`
before running QA.

### Native Composio SDK Integration

**The AI Employee Control Plane standardizes on the native Composio SDK for catalog discovery, OAuth, and governed execution.**

**Core SDK surfaces orchestrated by Gemini ADK agents:**
- `ComposioClient.tools.search()` — semantic toolkit discovery and capability assessment used by the Inspector ADK agent
- `ComposioClient.connected_accounts.initiate()` / `.status()` — mission-scoped Connect Link flows that the Planner ADK agent presents for approvals
- **Gemini ADK backend** — the exclusive orchestrator calling Composio tools through ADK agent patterns (`InspectorAgent`, `PlannerAgent`, `ExecutorAgent`)
- `ComposioClient.tools.execute()` and streaming helpers — governed execution with automatic retry, throttling, and response shaping called by Executor ADK agent
- Triggers & workflows (`client.triggers.create` and `client.workflows.run`) — async orchestration for long-running actions managed by the Executor ADK agent

**Sessions & trust:** mission sessions key off a shared `user_id` + `tenantId` tuple. Inspectors operate in read-only mode using discovery APIs, Planners gate OAuth scopes through Connect Links, and Executors run approved operations while emitting structured telemetry. No MCP-presigned URLs are required.

See `libs_docs/composio/llms.txt` for a curated index of native Composio guides (Quickstart, Providers, Authenticating Tools, Executing Tools, Triggers, and more).

## Linting & Checks

- Lint/type-check the UI: `mise run lint`
- Quick Python syntax check: `mise exec python -- -m compileall agent`

## Repository Tour

- `src/app/page.tsx` — Landing page summarising the five-stage lifecycle. Replace with the real Define stage when intake components are ready.
- `src/app/(control-plane)/layout.tsx` — CopilotKit-aware layout for mission routes with TODO markers for mission context and telemetry.
- `src/app/(control-plane)/workspace/*` — Stage-specific placeholders (Define, Prepare, Plan, Execute, Reflect) ready for component wiring.
- `src/app/api/**` — API route scaffolding returning 501 responses until agents are implemented.
- `agent/agent.py` — FastAPI application stub ready for Gemini ADK Runner integration.
- `agent/agents/` — Placeholder classes for Coordinator, Intake, Inspector, Planner, Validator, Executor, Evidence agents.
- `agent/services/` — Stub wrappers for Composio, Supabase, and telemetry clients.
- `agent/tools/` — Placeholder package for Composio tool wrappers and undo plans.
- `agent/evals/` — Folder reserved for Gemini ADK evaluation specs.
- `supabase/migrations/0001_init.sql` — Gates tenants, objectives, plays, approvals, tool telemetry, library embeddings, guardrail policies.
- `docs/readiness/` — Machine-readable evidence bundles for future gates.
- `docs/03a_chat_experience.md` — CopilotKit chat behaviour, interrupts, telemetry hooks.
- `docs/` — Canonical architecture, guardrail, and readiness references.

## Troubleshooting

- **Agent connection warnings** usually mean the backend isn't running or `GOOGLE_API_KEY` is missing. Ensure `mise run dev` (or `mise run agent`) is active.
- **Python import errors**: re-run `uv pip install -r agent/requirements.txt` to sync dependencies.
- **Supabase RLS/pgvector errors**: confirm the migration has been applied (`supabase db push ...`).
- **Composio SDK errors**: confirm `COMPOSIO_API_KEY` is configured. Check telemetry for `composio_tool_call` events and provider-specific error payloads to diagnose mission execution issues.

## Additional References

- [Gemini ADK docs](https://google.github.io/adk-docs/)
- [CopilotKit docs](https://docs.copilotkit.ai/)
- [Composio resources](https://composio.dev/)
- [Supabase docs](https://supabase.com/docs)

## Gate G-B Notes

- Regeneration limiter state persists via Supabase tables defined in `supabase/migrations/0001_init.sql`
- After Supabase schema edits run `supabase gen types typescript --linked --schema public,storage,graphql_public > supabase/types.ts` and follow up with `pnpm tsc --noEmit` to confirm generated bindings compile cleanly (regenerate once new columns are in place to drop casts).

## License

This project is licensed under the MIT License. See `LICENSE` for details.
