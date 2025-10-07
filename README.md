# AI Employee Control Plane — Gate G-A Foundation

This repository delivers the Gate G-A foundation for the AI Employee Control Plane. It pairs a CopilotKit-powered Next.js workspace with a packaged Gemini ADK backend, a Composio catalog cache, and Supabase migrations so you can generate zero-privilege proof packs before requesting oauth credentials.

## Architecture Highlights
- **Frontend:** `src/app/(control-plane)` renders the mission intake, artifact gallery, and Copilot sidebar.
- **Backend:** `agent/` exposes a FastAPI app with a Gemini ADK agent (`agent/agents/control_plane.py`) and Composio catalog parsing (`agent/tools/composio_client.py`).
- **Data Plane:** `supabase/migrations/0001_init.sql` provisions tenants, objectives, plays, approvals, tool telemetry, pgvector embeddings, and RLS policies.
- **Readiness Evidence:** `docs/readiness/foundation_readiness.json` captures Gate G-A checks (migration hash, catalog checksum, shared-state checksum).
- Reference product docs live in `new_docs/` (architecture, implementation plan, guardrails, readiness schemas).

## Prerequisites
- [mise](https://mise.jdx.dev/) for tool version management
- Node.js 22 (installed via mise)
- Python 3.13 (installed via mise)
- [pnpm](https://pnpm.io/) (installed via mise)
- [uv](https://github.com/astral-sh/uv) for Python dependency installs
- Google Makersuite API key (https://makersuite.google.com/app/apikey)
- Supabase CLI (optional, for local database testing)

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

4. **Export your Makersuite key**
   ```bash
   export GOOGLE_API_KEY="your-google-api-key-here"
   ```

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

## Linting, Checks & Evidence
- Lint/type-check the UI: `mise run lint`
- Quick Python syntax check: `mise exec python -- -m compileall agent`
- Regenerate Gate G-A readiness JSON after updating migrations, catalog parsing, or mission UI:
  ```bash
  python scripts/generate_foundation_readiness.py > docs/readiness/foundation_readiness.json
  ```

## Repository Tour
- `src/app/(control-plane)/page.tsx` — Mission intake workspace with CopilotKit state synchronisation.
- `agent/runtime/app.py` — FastAPI app factory consumed by both uvicorn and tests.
- `agent/agents/control_plane.py` — Mission state tools (`set_mission_details`, `append_planner_note`, `upsert_artifact`) and catalog-aware prompts.
- `agent/tools/composio_client.py` — Parses `libs_docs/composio/llms.txt` into a checksummed catalog.
- `supabase/migrations/0001_init.sql` — Gates tenants, objectives, plays, approvals, tool telemetry, library embeddings, guardrail policies.
- `docs/readiness/` — Machine-readable evidence bundles per gate.
- `new_docs/` — Canonical architecture, guardrail, and readiness references.

## Troubleshooting
- **Agent connection warnings** usually mean the backend isn’t running or `GOOGLE_API_KEY` is missing. Ensure `mise run dev` (or `mise run agent`) is active.
- **Python import errors**: re-run `uv pip install -r agent/requirements.txt` to sync dependencies.
- **Supabase RLS/pgvector errors**: confirm the migration has been applied (`supabase db push ...`).
- **Catalog checksum mismatch** after editing `libs_docs/composio/llms.txt`: rerun the readiness script to refresh `foundation_readiness.json`.

## Additional References
- [Gemini ADK docs](https://google.github.io/adk-docs/)
- [CopilotKit docs](https://docs.copilotkit.ai/)
- [Composio resources](https://composio.dev/)
- [Supabase docs](https://supabase.com/docs)

## License

This project is licensed under the MIT License. See `LICENSE` for details.
