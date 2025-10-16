# AI Employee Control Plane: System Overview

**Version:** 3.0 (October 2025)
**Audience:** Engineering, Architecture, Technical Leadership
**Status:** Active technical blueprint

---

## Executive Summary

The AI Employee Control Plane converts a single freeform mission intent into governed execution across a **seven-stage mission journey**: **Stage 0 (Home Overview), Stage 1 (Define), Stage 2 (Prepare), Stage 3 (Plan), Stage 4 (Approve), Stage 5 (Execute), Stage 6 (Reflect)**. Each stage preserves safeguards, telemetry, and approval checkpoints while reducing handoffs and documentation drift. Presentation, orchestration, execution, and data layers collaborate to deliver governed autonomy with continuous evidence.

Key architectural pillars:

- **Pre-mission context** via Stage 0 (Home Overview) showing active missions, pending approvals, and outcomes
- **Generative intent capture** that produces mission briefs, safeguards, and KPIs in Stage 1 (Define)
- **Progressive trust** with toolkit validation and data inspection in Stage 2 (Prepare)
- **Ranked plays and undo plans** generated in Stage 3 (Plan)
- **Dedicated approval checkpoint** with stakeholder review in Stage 4 (Approve)
- **Governed multi-agent execution** with streaming telemetry in Stage 5 (Execute)
- **Feedback loops and library updates** completing Stage 6 (Reflect)

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
        PlanStage(Plan Stage Console)
        ApproveStage(Approve Stage Decision Rail)
        ExecuteStage(Execute Stage Stream)
        ReflectStage(Reflect Stage Console)
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
    Workspace --> ApproveStage
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
    ApproveStage --> ApprovalAPI
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

The Control Plane agents form a **stateful multi-agent system** where each agent reads from and writes to a shared session state (`ctx.session.state`), enabling smooth handoffs across the seven-stage mission lifecycle.

### Agent Roles & Responsibilities

| ADK Agent            | Stage(s)                     | Primary Responsibilities                                                                                                                | State Interactions                                                                                                       | Composio SDK Usage                                                              |
| -------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **CoordinatorAgent** | All                          | Stage orchestration, safeguards enforcement, telemetry fan-out, mission context initialization                                          | Writes `mission_id`, `tenant_id`, `current_stage`; reads all downstream state                                            | None direct; coordinates other agents                                           |
| **IntakeAgent**      | Stage 1 (Define)             | Chip generation (objective, audience, KPI, safeguards), confidence scoring, rationale hints                                             | Writes `mission_brief`, `safeguards`, `confidence_scores`                                                                | None                                                                            |
| **InspectorAgent**   | Stage 2 (Prepare)            | Toolkit discovery, anticipated scope previews, OAuth initiation via Connect Links after approval, connection establishment              | Writes `anticipated_connections`, `granted_scopes`, `coverage_estimate`, `readiness_status`; reads `mission_brief`       | `client.tools.search()`, `client.toolkits.authorize()`, `wait_for_connection()` |
| **PlannerAgent**     | Stage 3 (Plan)               | Play generation emphasizing tool usage patterns + data investigation insights, hybrid ranking (retrieval + rules), safeguard attachment | Reads `granted_scopes`, `mission_brief`, `coverage_estimate`; writes `ranked_plays`, `undo_plans`, `tool_usage_patterns` | None direct; uses Inspector's approved connections                              |
| **ValidatorAgent**   | Stages 2, 3, 4, 5            | Scope verification, safeguard preflight/postflight checks, success heuristics, undo planning                                            | Reads `safeguards`, `granted_scopes`, `current_action`; writes `validation_results`, `auto_fix_attempts`                 | `client.connected_accounts.status()` for scope validation                       |
| **ExecutorAgent**    | Stage 5 (Execute)            | Governed tool execution via **ADK backend calling Composio SDK**, state tracking, heartbeat updates                                                        | Reads `ranked_plays`, `granted_scopes`; writes `execution_results`, `heartbeat_timestamp`                                | ADK agent calls `client.tools.execute()` for execution                     |
| **EvidenceAgent**    | Stages 5, 6 (Execute, Reflect) | Artifact packaging, hash generation, library updates, mission retrospective                                                             | Reads `execution_results`, `undo_plans`; writes `evidence_bundles`, `library_contributions`                              | `client.audit.list_events()` for undo hints                                     |

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
    CoordinatorAgent->>SessionState: Update current_stage=PLAN

    CoordinatorAgent->>PlannerAgent: Assemble mission plays
    PlannerAgent->>SessionState: Read granted_scopes, mission_brief
    PlannerAgent->>ValidatorAgent: Validate scope alignment
    ValidatorAgent->>Composio: client.connected_accounts.status()
    ValidatorAgent->>SessionState: Write validation_results
    PlannerAgent->>SessionState: Write ranked_plays, undo_plans, tool_usage_patterns
    PlannerAgent-->>User: Display ranked plays for review
    User->>CoordinatorAgent: Select play
    CoordinatorAgent->>SessionState: Update current_stage=APPROVE
    CoordinatorAgent-->>User: Present approval checkpoint
    User->>CoordinatorAgent: Approve play
    CoordinatorAgent->>SessionState: Update current_stage=EXECUTE

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
    CoordinatorAgent->>SessionState: Update current_stage=REFLECT

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
    "current_stage": "HOME" | "DEFINE" | "PREPARE" | "PLAN" | "APPROVE" | "EXECUTE" | "REFLECT",

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

    # Plan stage (PlannerAgent + ValidatorAgent)
    "ranked_plays": list[dict],              # Mission playbooks
    "undo_plans": dict[str, dict],           # Per-action rollback plans
    "tool_usage_patterns": dict,             # Emphasizes data investigation insights
    "validation_results": dict,              # Validator scope checks

    # Approve stage (Coordinator + Approver)
    "approval_request": {
        "approver_role": str,
        "due_at": datetime | None,
        "approval_type": str,
        "play_id": str
    },
    "approval_decision": {
        "status": "pending" | "approved" | "rejected",
        "decided_by": str | None,
        "decided_at": datetime | None,
        "rationale": str | None
    },

    # Execute stage (ExecutorAgent + EvidenceAgent)
    "execution_results": list[dict],         # Tool call outcomes
    "heartbeat_timestamp": datetime,         # Session liveness
    "evidence_bundles": list[dict],          # Artifact packages

    # Reflect stage (EvidenceAgent)
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

## Seven-Stage Mission Journey

| Stage               | Primary Outcomes                                                  | Governance Checkpoints                       |
| ------------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| **Stage 0 — Home**  | Mission context, pending approvals, recent outcomes visible       | Multi-mission visibility, approval routing   |
| **Stage 1 — Define**            | Mission intent captured, safeguards aligned, brief locked         | Intent review, safeguard acceptance          |
| **Stage 2 — Prepare**           | Toolkits authorized, data coverage validated, readiness confirmed | Toolkit approval, data coverage attestation  |
| **Stage 3 — Plan**    | Ranked plays generated, undo plans created, plays ready for review    | Play review, risk assessment                 |
| **Stage 4 — Approve**    | Stakeholder approval granted, audit trail captured    | Formal approval, authorization sign-off                 |
| **Stage 5 — Execute** | Governed actions run, validator monitoring, artifacts generated   | Live execution oversight, evidence packaging |
| **Stage 6 — Reflect** | Feedback captured, library reuse identified, next steps logged    | Feedback routing, library curation           |

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

### Stage 3 — Plan

- Planner agent receives established connections from Inspector with validated scopes
- Planner ranks plays (mission playbooks) using library embeddings (`library_entries`, `library_embeddings`), tool usage patterns, and data investigation insights
- Each play is annotated with sequencing, resource requirements, and undo affordances before ranking so reviewers understand operational impact
- Plays emphasize mission strategy, sequencing, and safeguard alignment rather than credential discovery
- Undo plans generated per mutating step; stored in `mission_undo_plans`
- Validator verifies scopes via `client.connected_accounts.status()` against Inspector's approved connections
- Telemetry rollup: `planner_candidate_generated`, `plan_ranked`, `plan_selected`
- Chat narrative: Planner streams ranked plays with rationale, embeds undo plan callouts, highlights tool usage patterns, and confirms scope alignment from Inspector.

### Stage 4 — Approve

- Dedicated approval checkpoint presenting selected play for stakeholder review
- Approval summary shows objectives, affected records, safeguards, and undo plans
- Approvals captured in `mission_approvals` with role-based gating and full audit trail
- Support for self-approval or delegation to governance officers
- Telemetry rollup: `approval_requested`, `approval_granted`, `approval_rejected`
- Chat narrative: Approval modal displays mission context, rationale, and allows inline review comments.

### Stage 5 — Execute

- Executor agent runs provider adapters (`provider.session(...)` + `session.handle_tool_call(...)`) for governed tool execution; validator enforces safeguards pre/post call
- Evidence agent streams outputs, attaches to artifact gallery (`mission_artifacts`)
- Undo handler applies rollbacks when triggered
- Telemetry rollup: `execution_started`, `execution_step_completed`, `validator_alert_raised`, `evidence_bundle_generated`, `composio_tool_call`, `composio_tool_call_error`, `session_heartbeat`
- Chat narrative: Executor streams tool calls, validator flags safeguards, evidence agent delivers hash cards and undo countdowns.

### Stage 6 — Reflect

- Feedback modal captures qualitative + quantitative signals
- Library curator suggests reusable assets; contributions stored in `library_entries`
- Post-mission checklist prompts next-step logging (`mission_followups`)
- Operators capture residual work and dependencies in `bd` — see `docs/11_issue_tracking.md` for commands to create follow-up issues and link them back to the mission
- Telemetry rollup: `feedback_submitted`, `mission_retrospective_logged`, `library_contribution`
- Chat narrative: Evidence agent posts mission summary, feedback form, and follow-up checklist with owners.

---

## Telemetry & Analytics Continuity

Events emitted by the UI, Gemini ADK agents, CopilotKit workspace, and Composio SDK all land in `telemetry_events` with a shared schema (`event_type`, `stage`, `status`, `context`). Dashboards group them by the seven-stage labels using the mapping tables below.

**Stage-Centric Events**

| Telemetry Event                | Stage           | Notes                                                                                     |
| ------------------------------ | --------------- | ----------------------------------------------------------------------------------------- |
| `mission_viewed`               | Home (Stage 0)  | User views mission list or dashboard                                                       |
| `approval_opened`              | Home (Stage 0)  | User opens pending approval from home                                                      |
| `intent_submitted`             | Define (Stage 1)            | Entry point for mission text                                                              |
| `brief_generated`              | Define (Stage 1)            | Generative chips produced                                                                 |
| `brief_item_modified`          | Define (Stage 1)            | User edits for audit trail                                                                |
| `composio_discovery`           | Prepare (Stage 2)           | Catalog lookup, includes result count & latency                                           |
| `safeguard_reviewed`           | Prepare (Stage 2)           | Emitted when safeguards are explicitly reviewed                                           |
| `toolkit_recommended`          | Prepare (Stage 2)           | Ranked toolkit suggestions                                                                |
| `toolkit_selected`             | Prepare (Stage 2)           | User selection captured                                                                   |
| `data_preview_generated`       | Prepare (Stage 2)           | Read-only inspection outputs                                                              |
| `composio_auth_flow`           | Prepare (Stage 2)           | Connect Link lifecycle (`initiated/approved/expired`); Inspector-initiated after approval |
| `planner_candidate_generated`  | Plan (Stage 3)    | Each play candidate (mission playbooks)                                                   |
| `plan_ranked`                  | Plan (Stage 3)    | Final ordering emitted with tool usage patterns                                           |
| `plan_selected`                | Plan (Stage 3)    | User selects a play for approval                                                                  |
| `approval_requested`           | Approve (Stage 4)    | Approval checkpoint presented                                                                  |
| `approval_granted`             | Approve (Stage 4)    | Approval modal confirmed                                                                  |
| `approval_rejected`            | Approve (Stage 4)    | Approval declined with reason                                                                  |
| `execution_started`            | Execute (Stage 5) | First governed action                                                                     |
| `execution_step_completed`     | Execute (Stage 5) | Step-by-step tracing                                                                      |
| `validator_alert_raised`       | Execute (Stage 5) | Safeguard hit, auto-fix                                                                   |
| `composio_tool_call`           | Execute (Stage 5) | Provider adapter outcome + latency                                                        |
| `composio_tool_call_error`     | Execute (Stage 5) | Normalized failure envelope (`rate_limit`, etc.)                                          |
| `evidence_bundle_generated`    | Execute (Stage 5) | Final artifact package                                                                    |
| `feedback_submitted`           | Reflect (Stage 6) | Primary feedback form                                                                     |
| `mission_retrospective_logged` | Reflect (Stage 6) | Post-mission summary                                                                      |
| `library_contribution`         | Reflect (Stage 6) | Library entry or update                                                                   |

**Cross-Cutting Workspace & Session Events**

| Telemetry Event         | Stage Scope       | Notes                                                     |
| ----------------------- | ----------------- | --------------------------------------------------------- |
| `inspection_viewed`     | Prepare → Execute | CopilotKit panel viewed; fuels session heatmaps           |
| `approval_granted`      | Approve (Stage 4)    | Stakeholder action from workspace modal                   |
| `rollback_triggered`    | Execute (Stage 5) | Live undo request surfaced in UI                          |
| `workspace_stream_open` | Execute (Stage 5) | SSE channel opened; includes `telemetryDisabled` sampling |
| `session_heartbeat`     | All stages        | Gemini ADK per-agent heartbeat (lag + token usage)        |

Update dashboard grouping clauses (`supabase/functions/dashboard_views.sql`) to include the seven-stage event families; no schema migrations are required because payload shape already matches `telemetry_events`.

---

## Governance Alignment

- **Stage 0 — Home:** Multi-mission visibility allows governance officers to track approval queues and outstanding missions across the organization.
- **Stage 1 — Define:** Safeguard chips require dual acknowledgement (mission owner + governance delegate). Validator enforces accepted constraints downstream.
- **Stage 2 — Prepare:** Inspector previews anticipated scopes and presents Connect Link approval requests to stakeholders via chat. OAuth approvals logged with scope diff view; all granted scopes stored in `mission_connections` table. Coverage meter must reach ≥85% before progressing to planning.
- **Stage 3 — Plan:** Planner receives validated connections from Inspector. Risk matrix (impact × reversibility) reviewed alongside undo plan as part of play generation. Focus shifts to mission strategy, tool usage patterns, and data investigation insights rather than credential management.
- **Stage 4 — Approve:** Dedicated approval checkpoint where stakeholders formally approve or reject the selected play with full audit trail and rationale capture.
- **Stage 5 — Execute:** Validator monitors each tool call; auto-fix attempts logged; manual stop available via live control strip.
- **Stage 6 — Reflect:** Feedback routed to governance queue when safeguards were overridden or validator escalated auto-fix failures; follow-up actions are linked into the Beads tracker so operations and governance can audit resolution.

Governance checkpoints are callable via `mise run governance-check`, which now references seven-stage labels in its output.

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

### Planning (Stage 3 — Plan)

- `agent/planner/plan_agent.py` ranks plays with pgvector similarity
- `src/components/PlanReviewModal.tsx` collects approvals and exposes undo plan details
- `supabase/functions/apply_approval_policy.sql` enforces role gating

### Approval (Stage 4 — Approve)

- `src/components/ApprovalModal.tsx` presents the selected play for stakeholder review
- `src/app/(control-plane)/mission/approve/page.tsx` hosts the approval checkpoint
- `supabase/functions/apply_approval_policy.sql` enforces role gating and captures audit trail

### Execution & Evidence (Stage 5 — Execute)

- `agent/executor/sequential_executor.py` coordinates provider sessions (`provider.session(...)` + `handle_tool_call`)
- `src/components/ExecutionTimeline.tsx` streams SSE updates
- Evidence bundler writes to `supabase/storage/evidence/${missionId}` with SHA-256 verification

### Feedback & Library (Stage 6 — Reflect)

- `src/app/(control-plane)/mission/reflect/page.tsx`
- `agent/tools/library_client.py` manages contribution suggestions
- `supabase/functions/update_library_metrics.sql` aggregates reuse signals

---

## System Notes

- URLs, API endpoints, Supabase schemas, and telemetry events remain unchanged
- Historical missions automatically surface the new stage labels via Supabase views; no manual data cleanup required
- All diagrams are now embedded inline within this document for durability
