# AI Employee Control Plane — Copilot Instructions

This is a hybrid Next.js + Python agent system implementing the "AI Employee Control Plane" — a governed automation platform that progresses from zero-privilege proofs to OAuth-enabled execution.

## Architecture Overview

**Frontend:** Next.js 15 with CopilotKit CoAgents in `src/app/(control-plane)/`  
**Backend:** Python ADK FastAPI service in `agent/` with Gemini orchestration  
**Integration:** Composio for tool access + Supabase for state/evidence storage  
**State Management:** Shared mission state between UI and agents via CopilotKit

## Key Development Patterns

### Mission State Architecture

- **Shared State:** `MissionState` class syncs between React UI and Python agents
- **Tools Bridge:** Agent uses `set_mission_details()`, `append_planner_note()`, `upsert_artifact()`
- **UI Actions:** `useCopilotAction` hooks like `updateMissionDraft`, `registerArtifactPreview`
- **State Location:** Python agent stores in `tool_context.state`, React accesses via `useCoAgent`

### Agent Development (Python)

- **Base:** Extend from `agent/agents/control_plane.py` pattern using ADK `LlmAgent`
- **Tools:** Define functions with `ToolContext` parameter, register in agent's `tools=[]`
- **Callbacks:** Use `before_model_modifier` to inject context, `after_model_modifier` for flow control
- **Sessions:** ADK handles state persistence; use `InMemorySessionService` for dev

### Frontend Development (TypeScript)

- **Components:** Keep mission UI in `src/app/(control-plane)/` directory
- **CopilotKit:** Use `useCoAgent<AgentState>()` for shared state, `useCopilotAction()` for agent tools
- **Styling:** Tailwind with CSS custom properties for theming (`--copilot-kit-primary-color`)

## Development Workflow

### Setup Commands

```bash
mise trust && mise install    # Install Node 22, Python 3.13, pnpm, uv
mise run install             # Install frontend deps (pnpm install)
uv pip install -r agent/requirements.txt  # Install Python deps
export GOOGLE_API_KEY="your-key"  # Required for ADK
```

### Running the Stack

```bash
mise run dev        # Full stack (UI + agent)
mise run ui         # Frontend only (Next.js)
mise run agent      # Agent only (Python FastAPI)
```

### Key Files Structure

- `src/app/(control-plane)/page.tsx` — Main mission workspace with CopilotKit integration
- `agent/agents/control_plane.py` — Core agent with mission state tools
- `agent/runtime/app.py` — FastAPI app factory, imports agents
- `src/app/api/copilotkit/route.ts` — CopilotKit runtime connecting to Python agent
- `agent/tools/composio_client.py` — Composio catalog parser from `libs_docs/`

## Project-Specific Conventions

### Python Code Style

- Use **dataclasses** for simple models, **Pydantic** for validation
- **Avoid global imports** with side effects; use app factories (`agent/runtime/app.py`)
- **Deterministic guardrails:** All mission mutations through declared ADK tools
- **Environment:** Load from `.env`, required: `GOOGLE_API_KEY`

### TypeScript Patterns

- **Strict mode:** Follow `tsconfig.json` strict settings, no implicit `any`
- **React:** Functional components only, avoid classes
- **State:** Keep agent state flat, use CopilotKit for complex synchronization
- **Styling:** Group Tailwind utilities logically, use theme colors over hex

### Integration Patterns

- **Agent Communication:** HttpAgent connects Next.js API route to Python FastAPI
- **Catalog Management:** Parse Composio docs from `libs_docs/composio/llms.txt`
- **Mission Flow:** Draft → Agent Planning → Evidence Generation → Approval → Execution
- **Evidence Storage:** Artifacts stored as JSON in agent state, presented in React gallery

## Critical Development Guidelines

### When Editing Agents

1. **Test mission sync:** After changing `control_plane.py`, verify UI still renders state
2. **Run full stack:** Use `mise run dev` and check browser for live updates
3. **State validation:** Ensure `MissionState` changes sync between Python/TypeScript

### When Editing Frontend

1. **Preserve CopilotKit hooks:** Don't break `useCoAgent` or `useCopilotAction` integrations
2. **Check agent tools:** Verify action handlers still match agent tool signatures
3. **Test responsiveness:** UI must work across desktop/mobile for approvals workflow

### Integration Testing

- **Smoke test:** `mise exec python -- -m compileall agent` for Python syntax
- **Lint check:** `mise run lint` for TypeScript/React
- **Agent connection:** Verify Python agent responds at `http://localhost:8000/`

## Gate-Specific Context

**Current State:** Gate G-A Foundation (dry-run proofs only)  
**Next Phases:** OAuth activation → Governed execution → Analytics dashboard  
**Compliance:** Zero-privilege first, human-in-loop approvals, audit trails

### Evidence Requirements

- Mission artifacts stored in shared state for approval workflows
- Guardrail policies referenced in `new_docs/guardrail_policy_pack.md`
- Implementation sequencing follows `new_docs/implementation_plan.md`

## Common Pitfalls

- **Agent disconnection:** Ensure `GOOGLE_API_KEY` set and Python service running
- **State desync:** Always use CopilotKit tools, avoid direct state mutation
- **Package conflicts:** Use `pnpm` for frontend, `uv` for Python (not mixing package managers)
- **Catalog staleness:** Rerun validation workflow after updating `libs_docs/composio/llms.txt`

This system emphasizes governed autonomy with human oversight — all automations start as dry-run proofs before earning OAuth credentials.
