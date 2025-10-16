# AI Employee Control Plane: System Overview

**Version:** 3.0 (October 2025)
**Audience:** Engineering, Architecture, Technical Leadership
**Status:** Active technical blueprint

---

## Executive Summary

The AI Employee Control Plane converts a single freeform mission intent into governed execution across a **five-stage mission journey**: **Define, Prepare, Plan & Approve, Execute & Observe, Reflect & Improve**. Each stage preserves safeguards, telemetry, and approval checkpoints while reducing handoffs and documentation drift. Presentation, orchestration, execution, and data layers collaborate to deliver governed autonomy with continuous evidence.

Key architectural pillars:

- **Generative intent capture** that produces mission briefs, safeguards, and KPIs inside Stage 1 (Define)
- **Progressive trust** with toolkit validation and data inspection in Stage 2 (Prepare)
- **Ranked plays, approvals, and undo plans** orchestrated in Stage 3 (Plan & Approve)
- **Governed multi-agent execution** with streaming telemetry in Stage 4 (Execute & Observe)
- **Feedback loops and library updates** completing Stage 5 (Reflect & Improve)

The system preserves schema and telemetry naming. Existing Supabase tables, CopilotKit interactions, Composio integrations, and Gemini ADK agent roles operate unchanged.

---

## Architecture Overview

### Layered System

1. **Presentation Layer** — Next.js (App Router) + CopilotKit CoAgents, Tailwind UI primitives, artifact gallery, approval modals, persistent chat rail
2. **Orchestration Layer** — **Gemini ADK agents** (Coordinator, Intake, Planner, Inspector, Executor, Validator, Evidence) with **shared session state** (`ctx.session.state`) enabling stateful multi-agent coordination
3. **Execution Layer** — Composio toolkits, provider adapters, OAuth token vault, undo handlers
4. **Data Layer** — Supabase (Postgres + Storage + Functions) for mission metadata, telemetry, evidence bundles, library embeddings

### ADK Agent Architecture

**The Control Plane is built on Google's Gemini ADK (Agent Development Kit)**, providing code-first, modular multi-agent orchestration with:

- **Stateful Session Management:** All agents share `ctx.session.state` dictionary for cross-agent data flow
- **Event-Driven Coordination:** Agents yield `Event` objects via `AsyncGenerator` patterns (Python)
- **Flexible Composition:** Mix `LlmAgent`, `SequentialAgent`, `LoopAgent`, `ParallelAgent`, and custom `BaseAgent` subclasses
- **Composio Tool Orchestration:** **Gemini ADK backend is the exclusive orchestrator** calling Composio SDK methods through ADK agents (`InspectorAgent`, `PlannerAgent`, `ExecutorAgent`)
- **Evaluation Framework:** Built-in `adk eval` for testing agent behavior and ranking quality

**Reference:** See `libs_docs/adk/llms-full.txt` for comprehensive ADK patterns and `docs/04_implementation_guide.md` §3 for Control Plane-specific agent implementations.

### High-Level Component Graph

```mermaid
graph TB
    subgraph Presentation
        Workspace(Next.js Workspace)
        DefineStage(Define Stage Workspace)
        PrepareStage(Prepare Stage Toolkit Panel)
        PlanStage(Plan & Approve Console)
        ExecuteStage(Execute & Observe Stream)
        ReflectStage(Reflect & Improve Console)
    end

    subgraph Control Plane APIs
        IntakeAPI(/api/intake/generate)
        ToolkitsAPI(/api/toolkits/recommend)
        InspectAPI(/api/inspect/preview)
        PlannerAPI(/api/plans/rank)
        ApprovalAPI(/api/approvals)
        ExecutionAPI(/api/execution/run)
        EvidenceAPI(/api/evidence/archive)
        FeedbackAPI(/api/feedback/submit)
    end

    subgraph Orchestration
        Coordinator(Coordinator Agent)
        Planner(Planner Agent)
        Validator(Validator Agent)
        Executor(Executor Agent)
        EvidenceAgent(Evidence Agent)
        Inspector(Inspector Agent)
    end

    subgraph Data & Integrations
        Supabase(Supabase)
        Storage(Supabase Storage)
        Library(Mission Library)
        Composio(Composio Toolkits)
        OAuth(OAuth Vault)
        Telemetry(Telemetry Events)
    end

    Workspace --> DefineStage
    DefineStage --> IntakeAPI
    IntakeAPI --> Coordinator
    Coordinator --> Planner

    PrepareStage --> ToolkitsAPI
    PrepareStage --> InspectAPI
    Validator --> Inspector
    Inspector --> InspectAPI
    Inspector --> Composio
    InspectAPI --> Supabase

    PlanStage --> PlannerAPI
    PlanStage --> ApprovalAPI
    Planner --> PlannerAPI
    PlannerAPI --> Supabase
    PlannerAPI --> Library
    Planner --> Validator
    Validator --> ToolkitsAPI
    ToolkitsAPI --> Composio
    Planner --> ApprovalAPI
    ApprovalAPI --> OAuth
    ApprovalAPI --> Composio

    ExecuteStage --> ExecutionAPI
    ExecuteStage --> EvidenceAPI
    Executor --> ExecutionAPI
    ExecutionAPI --> Composio
    ExecutionAPI --> Telemetry
    Executor --> EvidenceAgent
    EvidenceAgent --> EvidenceAPI
    EvidenceAPI --> Storage

    ReflectStage --> FeedbackAPI
    FeedbackAPI --> Supabase
    FeedbackAPI --> Library
    Telemetry --> Supabase
```

---

## ADK Agent Coordination & State Flow

The Control Plane agents form a **stateful multi-agent system** where each agent reads from and writes to a shared session state (`ctx.session.state`), enabling smooth handoffs across the five-stage mission lifecycle.

### Agent Roles & Responsibilities

| ADK Agent            | Stage(s)                                   | Primary Responsibilities                                                                                                                | State Interactions                                                                                                       | Composio SDK Usage                                                              |
| -------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **CoordinatorAgent** | All                                        | Stage orchestration, safeguards enforcement, telemetry fan-out, mission context initialization                                          | Writes `mission_id`, `tenant_id`, `current_stage`; reads all downstream state                                            | None direct; coordinates other agents                                           |
| **IntakeAgent**      | Define                                     | Chip generation (objective, audience, KPI, safeguards), confidence scoring, rationale hints                                             | Writes `mission_brief`, `safeguards`, `confidence_scores`                                                                | None                                                                            |
| **InspectorAgent**   | Prepare                                    | Toolkit discovery, anticipated scope previews, OAuth initiation via Connect Links after approval, connection establishment              | Writes `anticipated_connections`, `granted_scopes`, `coverage_estimate`, `readiness_status`; reads `mission_brief`       | `client.tools.search()`, `client.toolkits.authorize()`, `wait_for_connection()` |
| **PlannerAgent**     | Plan & Approve                             | Play generation emphasizing tool usage patterns + data investigation insights, hybrid ranking (retrieval + rules), safeguard attachment | Reads `granted_scopes`, `mission_brief`, `coverage_estimate`; writes `ranked_plays`, `undo_plans`, `tool_usage_patterns` | None direct; uses Inspector's approved connections                              |
| **ValidatorAgent**   | Prepare, Plan & Approve, Execute & Observe | Scope verification, safeguard preflight/postflight checks, success heuristics, undo planning                                            | Reads `safeguards`, `granted_scopes`, `current_action`; writes `validation_results`, `auto_fix_attempts`                 | `client.connected_accounts.status()` for scope validation                       |
| **ExecutorAgent**    | Execute & Observe                          | Governed tool execution via **ADK backend calling Composio SDK**, state tracking, heartbeat updates                                                        | Reads `ranked_plays`, `granted_scopes`; writes `execution_results`, `heartbeat_timestamp`                                | ADK agent calls `client.tools.execute()` for execution                     |
| **EvidenceAgent**    | Execute & Observe, Reflect & Improve       | Artifact packaging, hash generation, library updates, mission retrospective                                                             | Reads `execution_results`, `undo_plans`; writes `evidence_bundles`, `library_contributions`                              | `client.audit.list_events()` for undo hints                                     |

### State Flow Across Mission Lifecycle

```mermaid
sequenceDiagram
    participant User
    participant CoordinatorAgent
    participant IntakeAgent
    participant InspectorAgent
    participant PlannerAgent
    participant ValidatorAgent
    participant ExecutorAgent
    participant EvidenceAgent
    participant SessionState as ctx.session.state
    participant Composio

    User->>CoordinatorAgent: Submit mission intent
    CoordinatorAgent->>SessionState: Write mission_id, tenant_id, current_stage=DEFINE
    CoordinatorAgent->>IntakeAgent: Generate brief
    IntakeAgent->>SessionState: Write mission_brief, safeguards, confidence_scores
    IntakeAgent-->>User: Display chips for review
    User->>CoordinatorAgent: Approve brief
    CoordinatorAgent->>SessionState: Update current_stage=PREPARE

    CoordinatorAgent->>InspectorAgent: Discover toolkits & preview scopes
    InspectorAgent->>Composio: client.tools.search(mission_objective)
    Composio-->>InspectorAgent: Toolkit metadata
    InspectorAgent->>SessionState: Write anticipated_connections, coverage_estimate
    InspectorAgent-->>User: Present Connect Link approval requests
    User->>InspectorAgent: Approve OAuth
    InspectorAgent->>Composio: client.toolkits.authorize() → Connect Links
    Composio-->>InspectorAgent: wait_for_connection() → granted scopes
    InspectorAgent->>SessionState: Write granted_scopes, readiness_status
    CoordinatorAgent->>SessionState: Update current_stage=PLAN_APPROVE

    CoordinatorAgent->>PlannerAgent: Assemble mission plays
    PlannerAgent->>SessionState: Read granted_scopes, mission_brief
    PlannerAgent->>ValidatorAgent: Validate scope alignment
    ValidatorAgent->>Composio: client.connected_accounts.status()
    ValidatorAgent->>SessionState: Write validation_results
    PlannerAgent->>SessionState: Write ranked_plays, undo_plans, tool_usage_patterns
    PlannerAgent-->>User: Display ranked plays for approval
    User->>CoordinatorAgent: Approve play
    CoordinatorAgent->>SessionState: Update current_stage=EXECUTE_OBSERVE

    CoordinatorAgent->>ExecutorAgent: Execute approved play
    ExecutorAgent->>SessionState: Read ranked_plays, granted_scopes
    loop For each action
        ExecutorAgent->>ValidatorAgent: Preflight check
        ValidatorAgent->>SessionState: Read safeguards, current_action
        ValidatorAgent-->>ExecutorAgent: Validation passed
        ExecutorAgent->>Composio: provider.session().handle_tool_call(action)
        Composio-->>ExecutorAgent: Tool result
        ExecutorAgent->>SessionState: Write execution_results, heartbeat_timestamp
        ExecutorAgent->>EvidenceAgent: Package artifact
        EvidenceAgent->>SessionState: Write evidence_bundles
    end
    CoordinatorAgent->>SessionState: Update current_stage=REFLECT_IMPROVE

    CoordinatorAgent->>EvidenceAgent: Generate retrospective
    EvidenceAgent->>SessionState: Read execution_results, undo_plans
    EvidenceAgent->>Composio: client.audit.list_events() for undo hints
    EvidenceAgent->>SessionState: Write library_contributions
    EvidenceAgent-->>User: Display mission summary and feedback form
```

### ADK Session State Schema

The `ctx.session.state` dictionary follows a consistent schema across all agents:

```python
{
    # Coordinator-managed mission context
    "mission_id": str,
    "tenant_id": str,
    "user_id": str,
    "current_stage": "DEFINE" | "PREPARE" | "PLAN_APPROVE" | "EXECUTE_OBSERVE" | "REFLECT_IMPROVE",

    # Define stage (IntakeAgent)
    "mission_brief": {
        "objective": str,
        "audience": str,
        "kpi": str,
        "timeline": str
    },
    "safeguards": list[dict],
    "confidence_scores": dict[str, float],

    # Prepare stage (InspectorAgent)
    "anticipated_connections": list[dict],  # Previewed before OAuth
    "granted_scopes": list[dict],            # Logged after OAuth completion
    "coverage_estimate": float,              # Readiness percentage
    "readiness_status": "ready" | "warning" | "blocked",

    # Plan & Approve stage (PlannerAgent + ValidatorAgent)
    "ranked_plays": list[dict],              # Mission playbooks
    "undo_plans": dict[str, dict],           # Per-action rollback plans
    "tool_usage_patterns": dict,             # Emphasizes data investigation insights
    "validation_results": dict,              # Validator scope checks

    # Execute & Observe stage (ExecutorAgent + EvidenceAgent)
    "execution_results": list[dict],         # Tool call outcomes
    "heartbeat_timestamp": datetime,         # Session liveness
    "evidence_bundles": list[dict],          # Artifact packages

    # Reflect & Improve stage (EvidenceAgent)
    "library_contributions": list[dict]      # Reusable assets
}
```

**Implementation Note:** All agents use async/await patterns with `async for event in agent.run_async(ctx)` to yield telemetry events while updating shared state. The ADK Runner manages event propagation to CopilotKit for UI updates.

**Reference:** See the session state schema guidance in `docs/04_implementation_guide.md` and the patterns captured in `libs_docs/adk/llms-full.txt`; the agent services module provides typed helpers that enforce this contract.

### Session State Persistence & Supabase Integration

ADK's `ctx.session.state` dictionary integrates with Supabase for durable mission state across agent invocations:

**Persistence Strategy:**
- **In-Memory (Development/Eval):** ADK's `InMemorySessionService` for fast iteration and testing (`adk eval` mode)
- **Supabase-Backed (Production):** Custom `SupabaseSessionService` persists state to `mission_sessions` table with:
  - `session_id` (primary key, maps to mission_id)
  - `state_snapshot` (JSONB, full `ctx.session.state` dict)
  - `last_updated` (timestamp for staleness detection)
  - `agent_name` (last agent to write state)
  - `version` (optimistic locking to detect concurrent updates)

**State Synchronization Flow:**

```python
from google.adk.sessions import SessionService
from typing import Dict, Any

class SupabaseSessionService(SessionService):
    """Supabase-backed session state persistence for production missions"""

    async def load_state(self, session_id: str) -> Dict[str, Any]:
        """Load state from Supabase mission_sessions table"""
        result = await self.supabase.table("mission_sessions").select("*").eq("session_id", session_id).single().execute()
        return result.data["state_snapshot"] if result.data else {}

    async def save_state(self, session_id: str, state: Dict[str, Any], agent_name: str) -> None:
        """Save state with optimistic locking"""
        await self.supabase.table("mission_sessions").upsert({
            "session_id": session_id,
            "state_snapshot": state,
            "agent_name": agent_name,
            "last_updated": "now()",
            "version": "version + 1"
        }, on_conflict="session_id").execute()
```

**Read-Through Pattern:** Agents access state via `ctx.session.state.get(key)` → ADK runner loads from Supabase on first access → subsequent reads served from memory → writes batched and persisted on agent completion or explicit `ctx.session.save()` call.

**Write-Behind Pattern:** State updates accumulate in memory during agent execution; ADK runner flushes to Supabase on:
- Agent completion (successful or error)
- Explicit checkpoint: `await ctx.session.checkpoint()`
- Heartbeat interval (every 30s for long-running agents)

**Conflict Resolution:** If two agents attempt concurrent updates (rare due to sequential orchestration), Supabase version check triggers retry with latest state merge using last-write-wins for non-overlapping keys.

**Reference:** See `docs/04_implementation_guide.md` §3 (Session State Management) for a sample Supabase-backed session service and additional configuration notes.

### Error Handling & State Recovery

**Agent-Level Error Handling:**

Each ADK agent implements graceful degradation and state rollback on errors:

```python
async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
    """Inspector agent with error recovery"""
    try:
        # Read existing state
        mission_brief = ctx.session.state.get("mission_brief")

        # Checkpoint before risky operation
        await ctx.session.checkpoint()

        # Perform discovery
        search = await self.composio_client.tools.search(query=mission_brief["objective"])

        # Update state optimistically
        ctx.session.state["anticipated_connections"] = [tk.dict() for tk in search.toolkits]
        ctx.session.state["coverage_estimate"] = self._compute_coverage(search.toolkits)

        yield Event(event_type="inspector_discovery_complete", content="Discovery successful")

    except composio.RateLimitError as exc:
        # Rollback to checkpoint
        await ctx.session.rollback()
        ctx.session.state["readiness_status"] = "rate_limited"
        ctx.session.state["error_context"] = {"retry_after": exc.retry_after_seconds}
        yield Event(event_type="error", content=f"Rate limited, retry in {exc.retry_after_seconds}s")

    except composio.ToolkitNotFoundError:
        # Partial failure: log but continue with reduced scope
        ctx.session.state["readiness_status"] = "degraded"
        ctx.session.state["coverage_estimate"] = 0.5  # Reduced confidence
        yield Event(event_type="warning", content="Toolkit discovery incomplete, proceeding with reduced coverage")
```

**State Validation Checkpoints:**

Coordinator enforces state schema at stage boundaries:

```python
from pydantic import BaseModel, ValidationError

class PrepareStageOutput(BaseModel):
    anticipated_connections: list[dict]
    granted_scopes: list[dict]
    coverage_estimate: float
    readiness_status: str

async def validate_stage_output(ctx: InvocationContext, stage: str) -> bool:
    """Validate state before stage transition"""
    try:
        if stage == "PREPARE":
            PrepareStageOutput(**ctx.session.state)
        # ... other stage validators
        return True
    except ValidationError as exc:
        await self.telemetry.emit("stage_validation_failed", stage=stage, errors=exc.errors())
        return False
```

**Recovery Strategies:**

| Error Scenario | Recovery Strategy | State Handling |
|----------------|-------------------|----------------|
| **Composio Rate Limit** | Exponential backoff + retry (Inspector, Executor) | Preserve state, update `readiness_status` → `rate_limited`, surface retry schedule via chat |
| **OAuth Expired** | Reroute to Inspector for re-authorization | Preserve mission state, clear `granted_scopes`, reset stage to `PREPARE` |
| **Validator Safeguard Failure** | Auto-fix attempt → manual override request if failed | Checkpoint before validator, rollback on rejection, emit `validator_alert_raised` |
| **Supabase Connection Loss** | Retry with exponential backoff (3 attempts) | Keep state in memory, queue writes, flush on reconnect or fail mission with state snapshot |
| **Agent Timeout** | Cancel agent, preserve last checkpoint | Emit `session_heartbeat` with lag warning, restart agent from last checkpoint |
| **Concurrent State Update** | Optimistic lock failure → reload + merge | Retry with latest state, prefer last-write-wins for non-conflicting keys |

**Telemetry for Observability:**

All error recovery paths emit structured telemetry:

```python
await self.telemetry.emit("error_recovery_triggered",
    mission_id=ctx.session.state["mission_id"],
    agent=self.name,
    error_type="composio_rate_limit",
    recovery_action="exponential_backoff",
    state_checkpoint_id=ctx.session.checkpoint_id
)
```

**Reference:** See `docs/07_operations_playbook.md` Runbook 4 for rate limit recovery and `docs/04_implementation_guide.md` §3 Error Handling for implementation patterns.

---

## Five-Stage Mission Journey

| Stage                 | Primary Outcomes                                                  | Governance Checkpoints                       |
| --------------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| **Define**            | Mission intent captured, safeguards aligned, brief locked         | Intent review, safeguard acceptance          |
| **Prepare**           | Toolkits authorized, data coverage validated, readiness confirmed | Toolkit approval, data coverage attestation  |
| **Plan & Approve**    | Ranked plays reviewed, undo plans validated, approvals granted    | Play approval, risk sign-off                 |
| **Execute & Observe** | Governed actions run, validator monitoring, artifacts generated   | Live execution oversight, evidence packaging |
| **Reflect & Improve** | Feedback captured, library reuse identified, next steps logged    | Feedback routing, library curation           |

**Chat orchestration:** CopilotKit maintains a single conversational spine across all stages, broadcasting telemetry, approvals, and evidence updates without route changes. Refer to `docs/03a_chat_experience.md` for UI specifics.

### Stage 1 — Define

- Intake banner (`src/app/(control-plane)/mission/define/page.tsx`) sends text to `IntakeAPI`
- Gemini/Claude parsing yields objective, audience, KPI, safeguard chips
- Supabase `mission_metadata`, `mission_safeguards` persist accepted chips with provenance
- Telemetry rollup: `intent_submitted`, `brief_generated`, `brief_item_modified`
- Chat narrative: Mission intent summary, chip regeneration prompts, and “Brief locked” confirmation receipts.

### Stage 2 — Prepare

- Recommended toolkits via Composio discovery (`client.tools.search()` + `client.toolkits.get()`), prioritized by readiness
- Inspector previews anticipated scopes and connection requirements without initiating OAuth
- After stakeholder review and approval via chat, Inspector initiates OAuth via `client.toolkits.authorize()` Connect Links
- Inspector awaits `wait_for_connection()` handshake before proceeding; all granted scopes logged in Supabase
- Data inspection previews sample records via read-only SDK probes (`client.tools.execute()` on inspection-safe actions)
- Supabase tables: `toolkit_selections`, `data_inspection_checks`, `mission_connections` (approved scopes + timestamps)
- Telemetry rollup: `toolkit_recommended`, `toolkit_selected`, `data_preview_generated`, `safeguard_reviewed`, `composio_discovery`, `composio_auth_flow`
- Chat narrative: Inspector cards summarize readiness gaps, present Connect Link approval modals, log granted scopes, and confirm readiness before planning.

### Stage 3 — Plan & Approve

- Planner agent receives established connections from Inspector with validated scopes
- Planner ranks plays (mission playbooks) using library embeddings (`library_entries`, `library_embeddings`), tool usage patterns, and data investigation insights
- Each play is annotated with sequencing, resource requirements, and undo affordances before ranking so reviewers understand operational impact
- Plays emphasize mission strategy, sequencing, and safeguard alignment rather than credential discovery
- Undo plans generated per mutating step; stored in `mission_undo_plans`
- Validator verifies scopes via `client.connected_accounts.status()` against Inspector's approved connections before play approval
- Approvals captured in `mission_approvals` with role-based gating
- Telemetry rollup: `planner_candidate_generated`, `plan_ranked`, `plan_approved`
- Chat narrative: Planner streams ranked plays with rationale, embeds undo plan callouts, highlights tool usage patterns, and confirms scope alignment from Inspector.

### Stage 4 — Execute & Observe

- Executor agent runs provider adapters (`provider.session(...)` + `session.handle_tool_call(...)`) for governed tool execution; validator enforces safeguards pre/post call
- Evidence agent streams outputs, attaches to artifact gallery (`mission_artifacts`)
- Undo handler applies rollbacks when triggered
- Telemetry rollup: `execution_started`, `execution_step_completed`, `validator_alert_raised`, `evidence_bundle_generated`, `composio_tool_call`, `composio_tool_call_error`, `session_heartbeat`
- Chat narrative: Executor streams tool calls, validator flags safeguards, evidence agent delivers hash cards and undo countdowns.

### Stage 5 — Reflect & Improve

- Feedback modal captures qualitative + quantitative signals
- Library curator suggests reusable assets; contributions stored in `library_entries`
- Post-mission checklist prompts next-step logging (`mission_followups`)
- Telemetry rollup: `feedback_submitted`, `mission_retrospective_logged`, `library_contribution`
- Chat narrative: Evidence agent posts mission summary, feedback form, and follow-up checklist with owners.

---

## Telemetry & Analytics Continuity

Events emitted by the UI, Gemini ADK agents, CopilotKit workspace, and Composio SDK all land in `telemetry_events` with a shared schema (`event_type`, `stage`, `status`, `context`). Dashboards group them by the five-stage labels using the mapping tables below.

**Stage-Centric Events**

| Telemetry Event                | Stage             | Notes                                                                                     |
| ------------------------------ | ----------------- | ----------------------------------------------------------------------------------------- |
| `intent_submitted`             | Define            | Entry point for mission text                                                              |
| `brief_generated`              | Define            | Generative chips produced                                                                 |
| `brief_item_modified`          | Define            | User edits for audit trail                                                                |
| `composio_discovery`           | Prepare           | Catalog lookup, includes result count & latency                                           |
| `safeguard_reviewed`           | Prepare           | Emitted when safeguards are explicitly reviewed                                           |
| `toolkit_recommended`          | Prepare           | Ranked toolkit suggestions                                                                |
| `toolkit_selected`             | Prepare           | User selection captured                                                                   |
| `data_preview_generated`       | Prepare           | Read-only inspection outputs                                                              |
| `composio_auth_flow`           | Prepare           | Connect Link lifecycle (`initiated/approved/expired`); Inspector-initiated after approval |
| `planner_candidate_generated`  | Plan & Approve    | Each play candidate (mission playbooks)                                                   |
| `plan_ranked`                  | Plan & Approve    | Final ordering emitted with tool usage patterns                                           |
| `plan_approved`                | Plan & Approve    | Approval modal confirmed                                                                  |
| `execution_started`            | Execute & Observe | First governed action                                                                     |
| `execution_step_completed`     | Execute & Observe | Step-by-step tracing                                                                      |
| `validator_alert_raised`       | Execute & Observe | Safeguard hit, auto-fix                                                                   |
| `composio_tool_call`           | Execute & Observe | Provider adapter outcome + latency                                                        |
| `composio_tool_call_error`     | Execute & Observe | Normalized failure envelope (`rate_limit`, etc.)                                          |
| `evidence_bundle_generated`    | Execute & Observe | Final artifact package                                                                    |
| `feedback_submitted`           | Reflect & Improve | Primary feedback form                                                                     |
| `mission_retrospective_logged` | Reflect & Improve | Post-mission summary                                                                      |
| `library_contribution`         | Reflect & Improve | Library entry or update                                                                   |

**Cross-Cutting Workspace & Session Events**

| Telemetry Event         | Stage Scope       | Notes                                                     |
| ----------------------- | ----------------- | --------------------------------------------------------- |
| `inspection_viewed`     | Prepare → Execute | CopilotKit panel viewed; fuels session heatmaps           |
| `approval_granted`      | Plan & Approve    | Stakeholder action from workspace modal                   |
| `rollback_triggered`    | Execute & Observe | Live undo request surfaced in UI                          |
| `workspace_stream_open` | Execute & Observe | SSE channel opened; includes `telemetryDisabled` sampling |
| `session_heartbeat`     | All stages        | Gemini ADK per-agent heartbeat (lag + token usage)        |

Update dashboard grouping clauses (`supabase/functions/dashboard_views.sql`) to include the new event families; no schema migrations are required because payload shape already matches `telemetry_events`.

---

## Governance Alignment

- **Define:** Safeguard chips require dual acknowledgement (mission owner + governance delegate). Validator enforces accepted constraints downstream.
- **Prepare:** Inspector previews anticipated scopes and presents Connect Link approval requests to stakeholders via chat. OAuth approvals logged with scope diff view; all granted scopes stored in `mission_connections` table. Coverage meter must reach ≥85% before progressing to planning.
- **Plan & Approve:** Planner receives validated connections from Inspector. Risk matrix (impact × reversibility) reviewed alongside undo plan before granting play approvals. Focus shifts to mission strategy, tool usage patterns, and data investigation insights rather than credential management.
- **Execute & Observe:** Validator monitors each tool call; auto-fix attempts logged; manual stop available via live control strip.
- **Reflect & Improve:** Feedback routed to governance queue when safeguards were overridden or validator escalated auto-fix failures.

Governance checkpoints are callable via `mise run governance-check`, which now references five-stage labels in its output.

---

## Subsystems

### Intake & Safeguards (Define)

- `agent/tools/intake.py` handles parsing and chip scoring
- `src/lib/mission/safeguards.ts` exposes helper utilities for UI display
- Confidence weighting ensures low-certainty chips require user edits

### Toolkit Selection & Inspection (Prepare)

- `src/app/(control-plane)/mission/prepare/toolkit-panel.tsx`
- `agent/tools/composio_client.py` orchestrates discovery and authorization
- Inspection API limits data sampling to redactable fields using `src/lib/telemetry/redaction.ts`

### Planning & Approval (Plan & Approve)

- `agent/planner/plan_agent.py` ranks plays with pgvector similarity
- `src/components/PlanReviewModal.tsx` collects approvals and exposes undo plan details
- `supabase/functions/apply_approval_policy.sql` enforces role gating

### Execution & Evidence (Execute & Observe)

- `agent/executor/sequential_executor.py` coordinates provider sessions (`provider.session(...)` + `handle_tool_call`)
- `src/components/ExecutionTimeline.tsx` streams SSE updates
- Evidence bundler writes to `supabase/storage/evidence/${missionId}` with SHA-256 verification

### Feedback & Library (Reflect & Improve)

- `src/app/(control-plane)/mission/reflect/page.tsx`
- `agent/tools/library_client.py` manages contribution suggestions
- `supabase/functions/update_library_metrics.sql` aggregates reuse signals

---

## System Notes

- URLs, API endpoints, Supabase schemas, and telemetry events remain unchanged
- Historical missions automatically surface the new stage labels via Supabase views; no manual data cleanup required
- All diagrams are now embedded inline within this document for durability
