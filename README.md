# AI Employee Control Plane — Gate G-B Control Plane

This repository delivers the Gate G-B control plane for the AI Employee program. It pairs a CopilotKit-powered Next.js workspace with a packaged Gemini ADK backend, a Composio SDK integration, and Supabase migrations so you can generate zero-privilege proof packs before requesting oauth credentials.

## Architecture Highlights

- **Frontend:** `src/app/(control-plane)` renders the mission intake, artifact gallery, and Copilot sidebar.
- **Backend:** `agent/` exposes a FastAPI app with a Gemini ADK agent (`agent/agents/control_plane.py`) and a Composio SDK-powered discovery client (`agent/tools/composio_client.py`).
- **Data Plane:** `supabase/migrations/0001_init.sql` provisions tenants, objectives, plays, approvals, tool telemetry, pgvector embeddings, and RLS policies.
- Reference product docs live in `docs/` (architecture, execution tracker, guardrails, readiness schemas).

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

### Composio catalog utilities

- Check SDK connectivity: `python -m agent.tools.composio_client --status` (paste the result into `docs/readiness/composio_status_G-A.txt`)
- Force a fresh catalogue fetch: `python -m agent.tools.composio_client --refresh`

## Linting & Checks

- Lint/type-check the UI: `mise run lint`
- Quick Python syntax check: `mise exec python -- -m compileall agent`

## Repository Tour

- `src/app/(control-plane)/page.tsx` — Server component that hydrates Supabase data for the Gate G-A workspace.
- `src/app/(control-plane)/ControlPlaneWorkspace.tsx` — Client workspace aligning with the UX blueprint and CopilotKit actions.
- `agent/runtime/app.py` — FastAPI app factory consumed by both uvicorn and tests.
- `agent/agents/control_plane.py` — Mission state tools (`set_mission_details`, `append_planner_note`, `upsert_artifact`) and catalog-aware prompts.
- `agent/tools/composio_client.py` — Minimal Composio SDK client with CLI helpers.
- `supabase/migrations/0001_init.sql` — Gates tenants, objectives, plays, approvals, tool telemetry, library embeddings, guardrail policies.
- `docs/readiness/` — Machine-readable evidence bundles for future gates.
- `docs/` — Canonical architecture, guardrail, and readiness references.

## Troubleshooting

- **Agent connection warnings** usually mean the backend isn’t running or `GOOGLE_API_KEY` is missing. Ensure `mise run dev` (or `mise run agent`) is active.
- **Python import errors**: re-run `uv pip install -r agent/requirements.txt` to sync dependencies.
- **Supabase RLS/pgvector errors**: confirm the migration has been applied (`supabase db push ...`).
- **Catalog sync issues** when using the Composio SDK: confirm the SDK is installed, `COMPOSIO_API_KEY` is configured, and run `python -m agent.tools.composio_client --status` for diagnostics.

## Additional References

- [Gemini ADK docs](https://google.github.io/adk-docs/)
- [CopilotKit docs](https://docs.copilotkit.ai/)
- [Composio resources](https://composio.dev/)
- [Supabase docs](https://supabase.com/docs)

## Gate G-B Notes

- Regeneration limiter state persists via Supabase tables defined in `supabase/migrations/0001_init.sql`; no external Redis service is required.
- After Supabase schema edits run `supabase gen types typescript --linked --schema public,storage,graphql_public > supabase/types.ts` and follow up with `pnpm tsc --noEmit` to confirm generated bindings compile cleanly (regenerate once new columns are in place to drop casts).

## License

This project is licensed under the MIT License. See `LICENSE` for details.
