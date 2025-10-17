# AI Employee Control Plane: Mission Backlog

**Version:** 1.0 (October 16, 2025)
**Audience:** AI Coding Agents, Engineering Teams, Product Management
**Status:** Actionable work items derived from comprehensive documentation review
**Last Updated:** October 16, 2025

---

## Purpose

This backlog consolidates work items derived from the AI Employee Control Plane documentation suite, schema analysis, and architectural review. It provides **clear, actionable tasks** organized by theme with priorities, dependencies, acceptance criteria, and documentation references. Tasks are scoped for autonomous agent execution or coordinated team implementation.

> **Foundation Stage Status (October 2025):** The Gemini ADK backend in `agent/agent.py` is currently **scaffolded with placeholder TODO comments**. Real ADK agent implementations (Coordinator, Intake, Inspector, Planner, Validator, Executor, Evidence), Google GenAI API integrations, and ADK evaluation configurations are **not yet wired up**. Theme 1 (ADK Agent Implementation) tasks below represent **future work** to be completed in Core and Scale milestones. The documentation describes the target architecture to guide implementation.

**Documentation Foundation:**
- Product Vision: `docs/01_product_vision.md`
- System Overview: `docs/02_system_overview.md` (Gemini ADK architecture)
- User Experience: `docs/03_user_experience.md`, `docs/03a_chat_experience.md`
- Implementation Guide: `docs/04_implementation_guide.md`
- Capability Roadmap: `docs/05_capability_roadmap.md`
- Data Intelligence: `docs/06_data_intelligence.md`
- Operations Playbook: `docs/07_operations_playbook.md`
- Release Readiness: `docs/09_release_readiness.md`
- Composio Integration: `docs/10_composio.md`
- Issue Tracking: `docs/11_issue_tracking.md` (`bd` CLI usage)
- Database Schema: `supabase/migrations/0001_init.sql`
- Agent Guide: `AGENTS.md`

**Key Architecture Notes:**
- **Gemini ADK Multi-Agent System:** Coordinator, Intake, Inspector, Planner, Validator, Executor, Evidence agents with shared session state (`ctx.session.state`)
- **Composio SDK as Sole Integration:** Native SDK for discovery, OAuth (Connect Links), and execution
- **Progressive Trust Model:** Inspector initiates OAuth during Stage 2 (Prepare), Planner uses established connections
- **Seven-Stage Mission Journey:** Home → Define → Prepare → Plan → Approve → Execute → Reflect
- **Single Supabase Migration:** All schema in `supabase/migrations/0001_init.sql` (no separate migrations)

---

## How to Use This Backlog

### For AI Coding Agents
1. **Filter by tag** to find tasks matching your capabilities (e.g., `#frontend`, `#agent`, `#data`)
2. **Check dependencies** before starting (column: Dependencies)
3. **Reference documentation** in the "Doc References" column for context
4. **Validate completion** using acceptance criteria before marking done
5. **Emit telemetry events** as specified in `docs/06_data_intelligence.md` for new features

### For Human Teams
1. **Use as input for sprint planning** with priorities (P0 = critical, P1 = high, P2 = medium, P3 = nice-to-have)
2. **Link tasks to `bd` issues** using `bd create` with dependencies (see `docs/11_issue_tracking.md`)
3. **Track evidence artifacts** in `docs/readiness/` per `docs/09_release_readiness.md`
4. **Coordinate across themes** using the dependency graph
5. **Reference milestone alignment** from `docs/05_capability_roadmap.md`

### Task Structure
Each task includes:
- **ID:** Unique identifier for cross-referencing
- **Title:** Short, action-oriented description
- **Priority:** P0 (critical) → P3 (nice-to-have)
- **Complexity:** Effort estimate (XS/S/M/L/XL)
- **Theme:** Organizational category
- **Tags:** Filterable labels for technology/component
- **Description:** What needs to be done and why
- **Acceptance Criteria:** Definition of done
- **Dependencies:** Other task IDs that must complete first
- **Doc References:** Specific documentation sections
- **Validation:** How to verify completion

---

## High-Level Objectives

Based on documentation analysis, the Control Plane has these strategic objectives:

### 1. Foundation Layer (Core Infrastructure)
**Goal:** Establish reliable seven-stage mission execution with ADK agents, Supabase persistence, and Composio SDK integration

**Status:** Foundation stage — architectural design complete, implementation scaffolded with TODOs

**Current State (October 2025):**
- ✓ Supabase schema migrated (`supabase/migrations/0001_init.sql`)
- ✓ FastAPI backend scaffolded (`agent/agent.py` with TODO markers)
- ✓ Frontend UI architecture defined (Next.js + CopilotKit patterns documented)
- ✓ Documentation suite comprehensive (design-ready for implementation)
- ✗ **ADK agent implementations** — Coordinator, Intake, Inspector, Planner, Validator, Executor, Evidence agents are **placeholders only** (no Google GenAI calls, no real agent logic)
- ✗ **ADK evaluation configs** — `agent/evals/` directory contains placeholder files, no real `.evalset.json` test suites
- ✗ **Composio SDK integration** — OAuth flows, toolkit discovery, and execution calls are documented but **not wired up**
- ✗ **Session state persistence** — `SupabaseSessionService` not implemented (InMemorySessionService placeholder only)
- ✗ **Frontend UI components** — Seven-stage workflow UIs designed but not built
- ✗ **Telemetry instrumentation** — Event catalog documented, emission logic deferred

**Implementation Deferred To:** Core and Scale milestones (see Theme 1 tasks below)

### 2. Trust & Progressive Authorization
**Goal:** Implement progressive trust model where Inspector presents anticipated scopes, stakeholders approve via chat, OAuth initiated post-approval, and Planner receives established connections

**Status:** Architecture defined in `docs/10_composio.md`, implementation pending

**Gaps:**
- Inspector discovery + scope preview without OAuth initiation
- Chat-based Connect Link approval workflow (CopilotKit integration)
- Inspector OAuth initiation after approval with `wait_for_connection()` handshake
- Scope logging in `mission_connections` table before planning
- Validator scope alignment checks (Inspector scopes vs Planner requirements)

### 3. Evidence & Governance
**Goal:** Every mission generates audit-ready evidence bundles with undo plans, safeguard compliance, and tamper-proof artifacts

**Status:** Schema ready (`mission_artifacts`, `mission_evidence`, `mission_undo_plans`), agent logic pending

**Gaps:**
- Evidence agent artifact packaging with SHA-256 hashing
- Undo plan generation per mutating action
- Validator preflight/postflight safeguard enforcement
- Approval workflow with role-based gating and audit trails
- Compliance export (PDF, CSV) functionality

### 4. Learning & Intelligence
**Goal:** Continuous improvement through telemetry loops, library reuse, adaptive safeguards, and agent performance metrics

**Status:** Analytics views defined, learning loops documented, implementation incomplete

**Gaps:**
- Library embeddings (pgvector) for play ranking
- Feedback loops for prompt tuning (Intake, Planner, Validator)
- Telemetry audit automation (`scripts/audit_telemetry_events.ts`)
- Dashboard implementations (Executive, Governance, Operations, Adoption, Agent Performance)
- Automated evidence generation for releases

### 5. Operational Excellence
**Goal:** Production-ready deployment, monitoring, incident response, and runbook-driven recovery

**Status:** Runbooks documented, automation pending

**Gaps:**
- Deployment automation (`scripts/deploy-agent.sh`, Vercel config)
- Monitoring dashboards (Datadog integration, alert rules)
- Incident response automation (auto-create `bd` issues on SEV-1/SEV-2)
- Rate limit handling for Composio SDK
- ADK agent heartbeat monitoring and lag alerting

---

## Backlog by Theme

### Theme 1: ADK Agent Implementation

> **⚠️ Foundation Stage — Implementation Deferred:** All tasks in this theme represent **future work**. As of October 2025, the Gemini ADK backend (`agent/agent.py`) is scaffolded with TODO comments only. No real agent logic, Google GenAI API calls, or ADK evaluation configs are wired up. These tasks document the planned implementation for Core and Scale milestones.

**Context:** Gemini ADK will provide multi-agent orchestration with shared session state. All agents will inherit from `BaseAgent` or `LlmAgent` and coordinate via `ctx.session.state` dictionary. Implementation patterns documented in `docs/04_implementation_guide.md` §3. Service layer scaffolding lives in `agent/services/{composio,supabase,telemetry}.py` with follow-up tasks `ai_eployee_0-1`, `ai_eployee_0-2`, and `ai_eployee_0-3` (see `docs/12_service_architecture.md`).

---

#### TASK-ADK-001: Implement CoordinatorAgent with Session State Management

**Priority:** P0
**Complexity:** L
**Tags:** `#agent`, `#adk`, `#backend`, `#foundation`

**Description:**
Implement the CoordinatorAgent as the orchestrator for the seven-stage mission journey. Coordinator initializes session state, routes to stage-specific agents (Intake, Inspector, Planner, Executor, Evidence), enforces stage transitions, and emits coordination telemetry.

**Acceptance Criteria:**
- [ ] CoordinatorAgent class inherits from `BaseAgent` with sub-agents (Intake, Inspector, Planner, Executor, Evidence)
- [ ] `_run_async_impl()` yields `Event` objects for stage transitions and coordination milestones
- [ ] Session state initialized with `mission_id`, `tenant_id`, `user_id`, `current_stage`
- [ ] Stage validation enforced before transitions (Define → Prepare → Plan → Approve → Execute → Reflect)
- [ ] Telemetry events: `mission_stage_transition`, `coordinator_handoff`
- [ ] Error handling with state rollback on agent failures
- [ ] Unit tests with ADK InMemorySessionService
- [ ] Integration test for full seven-stage flow

**Dependencies:** None (foundation task)

**Doc References:**
- `docs/02_system_overview.md` §ADK Agent Coordination & State Flow
- `docs/04_implementation_guide.md` §3 Backend Agents (Gemini ADK)
- `libs_docs/adk/llms-full.txt` (BaseAgent patterns, session management)

**Validation:**
```bash
mise run test-agent  # ADK eval suite
pytest agent/tests/test_coordinator.py -v
```

**Notes:**
- Reference session state schema in `docs/02_system_overview.md` §ADK Session State Schema
- Implement SupabaseSessionService for production (InMemory for dev/eval)
- Emit `session_heartbeat` every 30s per `docs/06_data_intelligence.md` §3.6

---

#### TASK-ADK-002: Implement IntakeAgent for Generative Brief Creation

**Priority:** P0
**Complexity:** M
**Tags:** `#agent`, `#adk`, `#backend`, `#define-stage`

**Description:**
Implement IntakeAgent for Stage 1 (Define) to parse mission intent and generate editable chips (objective, audience, KPI, safeguards, timeline). Agent should score confidence, provide rationale, and support sensible defaults without relying on fixed personas.

**Acceptance Criteria:**
- [ ] IntakeAgent class inherits from `LlmAgent` with Gemini model configuration
- [ ] Parses freeform intent text and generates structured chips (objective, audience, KPI, safeguards)
- [ ] Confidence scoring for each chip (0.0-1.0)
- [ ] Writes `mission_brief`, `safeguards`, `confidence_scores` to `ctx.session.state`
- [ ] Persists to Supabase (`mission_metadata`, `mission_safeguards` tables)
- [ ] Telemetry events: `intent_submitted`, `brief_generated`, `brief_item_modified`
- [ ] Persona-specific defaults (RevOps, Support, Engineering, Governance)
- [ ] Unit tests with golden examples from `docs/examples/`
- [ ] ADK eval set: `intake_quality.evalset.json`

**Dependencies:** TASK-ADK-001 (CoordinatorAgent)

**Doc References:**
- `docs/03_user_experience.md` §Stage 1 — Define
- `docs/04_implementation_guide.md` §3 Backend Agents
- `docs/06_data_intelligence.md` §3.2 Stage 1: Define
- `docs/examples/revops.md`, `docs/examples/coder.md` (illustrative mission stories)

**Validation:**
```bash
mise run test-agent  # Runs intake_quality eval set
pytest agent/tests/test_intake.py
```

**Notes:**
- Reference prompt patterns from `docs/05_capability_roadmap.md` §A.1 Mission Intake 2.0
- Target: ≥80% briefs accepted without edits, <3s generation time (p95)

---

#### TASK-ADK-003: Implement InspectorAgent for No-Auth Discovery & OAuth Initiation

**Priority:** P0
**Complexity:** XL
**Tags:** `#agent`, `#adk`, `#backend`, `#prepare-stage`, `#composio`

**Description:**
Implement InspectorAgent for Stage 2 (Prepare) with two-phase workflow: (1) No-auth discovery via Composio SDK `client.tools.search()` to preview anticipated scopes, (2) OAuth initiation via Connect Links after stakeholder approval via chat. Inspector logs granted scopes before handing off to Planner.

**Acceptance Criteria:**
- [ ] InspectorAgent class inherits from `BaseAgent` with Composio SDK client
- [ ] Phase 1: No-auth discovery
  - [ ] Call `client.tools.search()` for toolkit recommendations
  - [ ] Preview anticipated scopes and connection requirements
  - [ ] Calculate coverage estimate (readiness %)
  - [ ] Write `anticipated_connections`, `coverage_estimate` to session state
  - [ ] Emit `composio_discovery` telemetry
- [ ] Phase 2: OAuth initiation (post-approval)
  - [ ] Present Connect Link approval requests via chat (CopilotKit integration)
  - [ ] Call `client.toolkits.authorize()` after stakeholder approval
  - [ ] Await `wait_for_connection()` handshake
  - [ ] Log granted scopes to `mission_connections` table
  - [ ] Write `granted_scopes`, `readiness_status` to session state
  - [ ] Emit `composio_auth_flow` telemetry
- [ ] Data inspection previews (read-only SDK probes)
- [ ] Readiness validation (coverage ≥85% threshold)
- [ ] Unit tests with mocked Composio SDK
- [ ] ADK eval set: `discovery_coverage.evalset.json`

**Dependencies:** TASK-ADK-001 (CoordinatorAgent), TASK-UI-004 (Chat Connect Link approval modal)

**Doc References:**
- `docs/02_system_overview.md` §ADK Agent Coordination (InspectorAgent row)
- `docs/04_implementation_guide.md` §5.2 Implementation Patterns (Inspector Agent)
- `docs/10_composio.md` §Plan & Approve, §Governed Execution
- `libs_docs/composio/llms.txt` (SDK authentication guides)

**Validation:**
```bash
mise run test-agent  # Runs discovery_coverage eval set
pytest agent/tests/test_inspector.py -k test_oauth_flow
```

**Notes:**
- Two-phase approach is critical: discovery without OAuth → approval → OAuth initiation
- Cache `client.tools.search()` results for 1 hour per `docs/04_implementation_guide.md` §5.3
- Emit telemetry with `user_id`, `tenantId` per `docs/06_data_intelligence.md` §3.3

---

#### TASK-ADK-004: Implement PlannerAgent with Library Retrieval & Ranking

**Priority:** P0
**Complexity:** XL
**Tags:** `#agent`, `#adk`, `#backend`, `#plan-stage`, `#library`

**Description:**
Implement PlannerAgent for Stage 3 (Plan) to assemble ranked mission plays emphasizing tool usage patterns, data investigation insights, and library precedent. Planner receives established connections from Inspector and validates scopes before play generation.

**Acceptance Criteria:**
- [ ] PlannerAgent class inherits from `LlmAgent` with ValidatorAgent as sub-agent
- [ ] Reads `granted_scopes`, `mission_brief`, `coverage_estimate` from session state
- [ ] Validates scopes with ValidatorAgent before play assembly
- [ ] Generates 3-5 ranked plays (mission playbooks) with:
  - [ ] Tool usage patterns and data investigation insights
  - [ ] Sequencing, resource requirements, undo affordances
  - [ ] Confidence scores and precedent counts
- [ ] Library retrieval via pgvector similarity search (`library_embeddings`)
- [ ] Hybrid ranking (retrieval + rules + validator critique)
- [ ] Writes `ranked_plays`, `undo_plans`, `tool_usage_patterns` to session state
- [ ] Persists to Supabase (`mission_plays`, `mission_undo_plans` tables)
- [ ] Telemetry events: `planner_candidate_generated`, `plan_ranked`, `plan_selected`
- [ ] Unit tests with library precedent mocks
- [ ] ADK eval set: `ranking_quality.evalset.json`

**Dependencies:** TASK-ADK-003 (InspectorAgent), TASK-ADK-005 (ValidatorAgent), TASK-DATA-002 (Library embeddings)

**Doc References:**
- `docs/02_system_overview.md` §ADK Agent Coordination (PlannerAgent row)
- `docs/03_user_experience.md` §Stage 3 — Plan
- `docs/04_implementation_guide.md` §3 Backend Agents, §5.2 Planner + Validator
- `docs/06_data_intelligence.md` §3.4 Stage 3: Plan

**Validation:**
```bash
mise run test-agent  # Runs ranking_quality eval set
pytest agent/tests/test_planner.py -k test_library_retrieval
```

**Notes:**
- Planner never requests new OAuth scopes (uses established connections from Inspector)
- Reference ranking logic from `docs/05_capability_roadmap.md` §D.1 Library Reuse Signals
- Target: ≥70% first-play approval rate, <2.5s for first plan visible

---

#### TASK-ADK-005: Implement ValidatorAgent for Safeguard Enforcement

**Priority:** P0
**Complexity:** L
**Tags:** `#agent`, `#adk`, `#backend`, `#safeguards`, `#governance`

**Description:**
Implement ValidatorAgent for preflight/postflight safeguard checks across Prepare, Plan, and Execute stages. Validator verifies scope alignment, enforces safeguards, attempts auto-fixes, and emits alerts for governance review.

**Acceptance Criteria:**
- [ ] ValidatorAgent class inherits from `BaseAgent`
- [ ] Scope validation: verify granted scopes vs mission requirements
  - [ ] Call `client.connected_accounts.status()` for scope alignment
- [ ] Safeguard preflight checks before tool execution
- [ ] Safeguard postflight checks after tool execution
- [ ] Auto-fix attempts with success/failure tracking
- [ ] Writes `validation_results`, `auto_fix_attempts` to session state
- [ ] Emits telemetry: `validator_alert_raised`, `validator_override_requested`
- [ ] Escalation to human override when auto-fix fails
- [ ] Unit tests with safeguard violation scenarios
- [ ] ADK eval set: `execution_safety.evalset.json`

**Dependencies:** TASK-ADK-001 (CoordinatorAgent)

**Doc References:**
- `docs/02_system_overview.md` §ADK Agent Coordination (ValidatorAgent row)
- `docs/03_user_experience.md` §Stage 5 — Execute (validator monitoring)
- `docs/04_implementation_guide.md` §3 Backend Agents
- `docs/06_data_intelligence.md` §5.3 Loop C — Safeguard Reinforcement

**Validation:**
```bash
mise run test-agent  # Runs execution_safety eval set
pytest agent/tests/test_validator.py
```

**Notes:**
- Validator is used as sub-agent by Planner and Executor
- Target: ≥80% auto-fix success, <200ms governance overhead per `docs/01_product_vision.md` §3.3

---

#### TASK-ADK-006: Implement ExecutorAgent for Governed Tool Execution

**Priority:** P0
**Complexity:** XL
**Tags:** `#agent`, `#adk`, `#backend`, `#execute-stage`, `#composio`

**Description:**
Implement ExecutorAgent for Stage 5 (Execute) to run governed tool calls via Composio SDK provider adapters. Executor coordinates with ValidatorAgent for preflight/postflight checks and EvidenceAgent for artifact packaging.

**Acceptance Criteria:**
- [ ] ExecutorAgent class inherits from `BaseAgent` with sub-agents (Validator, Evidence)
- [ ] Reads `ranked_plays`, `granted_scopes` from session state
- [ ] Executes approved play actions sequentially
- [ ] For each action:
  - [ ] Validator preflight check
  - [ ] Call Composio SDK via provider adapter (`provider.session().handle_tool_call()`)
  - [ ] Validator postflight check
  - [ ] Write `execution_results`, `heartbeat_timestamp` to session state
  - [ ] Emit `execution_step_completed`, `composio_tool_call` telemetry
  - [ ] Package artifacts via EvidenceAgent
- [ ] Error handling with recovery strategies (rate limits, auth expiry, Supabase outage)
- [ ] State checkpoint/rollback on failures
- [ ] Heartbeat every 30s for session liveness
- [ ] Unit tests with mocked Composio provider
- [ ] ADK eval set: `execution_safety.evalset.json`, `error_recovery.evalset.json`

**Dependencies:** TASK-ADK-001 (CoordinatorAgent), TASK-ADK-005 (ValidatorAgent), TASK-ADK-007 (EvidenceAgent)

**Doc References:**
- `docs/02_system_overview.md` §ADK Agent Coordination (ExecutorAgent row), §Error Handling & State Recovery
- `docs/03_user_experience.md` §Stage 5 — Execute
- `docs/04_implementation_guide.md` §3 Backend Agents, §5.2 Executor Agent
- `docs/06_data_intelligence.md` §3.6 Stage 5: Execute

**Validation:**
```bash
mise run test-agent  # Runs execution_safety + error_recovery eval sets
pytest agent/tests/test_executor.py -k test_rate_limit_recovery
```

**Notes:**
- Reference error recovery table in `docs/02_system_overview.md` §Error Handling & State Recovery
- Emit `session_heartbeat` with lag and token usage per `docs/06_data_intelligence.md` §3.6

---

#### TASK-ADK-007: Implement EvidenceAgent for Artifact Packaging & Library Curation

**Priority:** P1
**Complexity:** M
**Tags:** `#agent`, `#adk`, `#backend`, `#execute-stage`, `#reflect-stage`

**Description:**
Implement EvidenceAgent for Stages 5-6 (Execute, Reflect) to package mission artifacts, generate SHA-256 hashes for tamper detection, create undo hints from Composio audit logs, and suggest library contributions.

**Acceptance Criteria:**
- [ ] EvidenceAgent class inherits from `BaseAgent`
- [ ] Reads `execution_results`, `undo_plans` from session state
- [ ] Artifact packaging:
  - [ ] Generate evidence bundles with tool outputs (redacted), ROI estimates, safeguard outcomes
  - [ ] Calculate SHA-256 hashes for tamper detection
  - [ ] Store in Supabase Storage (`evidence/${missionId}`)
  - [ ] Write metadata to `mission_artifacts`, `mission_evidence` tables
- [ ] Undo planning:
  - [ ] Call `client.audit.list_events()` for undo hints
  - [ ] Generate rollback instructions per action
- [ ] Library curation:
  - [ ] Suggest reusable plays based on feedback ratings (≥4★)
  - [ ] Write `library_contributions` to session state
- [ ] Emit telemetry: `evidence_bundle_generated`, `library_contribution`
- [ ] Unit tests with artifact generation
- [ ] ADK eval set: `mission_end_to_end.evalset.json`

**Dependencies:** TASK-ADK-001 (CoordinatorAgent)

**Doc References:**
- `docs/02_system_overview.md` §ADK Agent Coordination (EvidenceAgent row)
- `docs/03_user_experience.md` §Stage 6 — Reflect
- `docs/04_implementation_guide.md` §3 Backend Agents
- `docs/06_data_intelligence.md` §5.4 Loop D — Library Growth

**Validation:**
```bash
mise run test-agent  # Runs mission_end_to_end eval set
pytest agent/tests/test_evidence.py
```

**Notes:**
- Evidence bundles must include redaction status per `docs/06_data_intelligence.md` §6.1
- Hash verification per `docs/01_product_vision.md` §3.4 Evidence-First Architecture

---

#### TASK-ADK-008: Implement SupabaseSessionService for Production State Persistence

**Priority:** P1
**Complexity:** M
**Tags:** `#agent`, `#adk`, `#backend`, `#supabase`, `#infrastructure`

**Description:**
Implement custom `SupabaseSessionService` to replace ADK's `InMemorySessionService` in production. Service persists `ctx.session.state` to `mission_sessions` table with optimistic locking and conflict resolution.

**Acceptance Criteria:**
- [ ] `SupabaseSessionService` class implements ADK `SessionService` interface
- [ ] `load_state(session_id)` retrieves `state_snapshot` from `mission_sessions` table
- [ ] `save_state(session_id, state, agent_name)` upserts with optimistic locking (`version` field)
- [ ] Read-through pattern: first access loads from Supabase, subsequent reads from memory
- [ ] Write-behind pattern: batch writes on agent completion, checkpoints, and heartbeat interval (30s)
- [ ] Conflict resolution: last-write-wins for non-overlapping keys
- [ ] Error handling: retry with exponential backoff, queue writes on Supabase outage
- [ ] Configuration: `EVAL_MODE=true` uses InMemorySessionService, production uses Supabase
- [ ] Unit tests with Supabase mock
- [ ] Integration tests with real Supabase instance

**Dependencies:** TASK-ADK-001 (CoordinatorAgent)

**Doc References:**
- `docs/02_system_overview.md` §Session State Persistence & Supabase Integration
- `docs/04_implementation_guide.md` §3 Backend Agents (Session State Management)
- `AGENTS.md` §Operational Notes (EVAL_MODE)

**Validation:**
```bash
pytest agent/tests/test_supabase_session.py
EVAL_MODE=false mise run test-agent  # Test with real Supabase
```

**Notes:**
- Reference implementation pattern in `docs/02_system_overview.md` §Session State Persistence & Supabase Integration
- Ensure `mission_sessions` table matches schema in `supabase/migrations/0001_init.sql`

---

### Theme 2: Frontend UI Components (Next.js + CopilotKit)

**Context:** Control Plane UI uses Next.js 15 App Router with CopilotKit for streaming chat, approval modals, and artifact previews. Seven-stage workspace with persistent chat rail. Patterns in `docs/03_user_experience.md` and `docs/04_implementation_guide.md` §2.

---

#### TASK-UI-001: Implement Home Dashboard with Multi-Mission Overview

**Priority:** P0
**Complexity:** L
**Tags:** `#frontend`, `#ui`, `#home-stage`, `#nextjs`

**Description:**
Implement Stage 0 (Home) dashboard showing active missions, pending approvals, recent outcomes, and mission library. Include readiness badges, alert rail, and direct navigation to stage workspaces.

**Acceptance Criteria:**
- [ ] Page at `src/app/(control-plane)/workspace/page.tsx`
- [ ] Mission list with columns: title, stage, owner, readiness badge, next action
- [ ] Readiness badge states: ready, needs-auth, needs-data, blocked
- [ ] Approvals card with direct routing to Stage 4 (Approve) workspace
- [ ] Mission Library panel with curated templates surfaced by impact and readiness signals
- [ ] Recent Outcomes cards with impact metrics and time saved
- [ ] Alert rail for pending validator reminders and blockers
- [ ] "New mission" button routing to Stage 1 (Define)
- [ ] Responsive layout (desktop, tablet, mobile)
- [ ] Accessibility: ARIA landmarks, keyboard navigation, screen reader labels
- [ ] Telemetry: `home_tile_opened`, `readiness_badge_rendered`, `alert_rail_viewed`, `mission_list_action_taken`
- [ ] Unit tests with React Testing Library
- [ ] Storybook stories for all states

**Dependencies:** None (foundation task)

**Doc References:**
- `docs/03_user_experience.md` §Stage 0 — Home Overview
- `docs/04_implementation_guide.md` §2 Frontend (Next.js + CopilotKit)
- `docs/06_data_intelligence.md` §3.1 Stage 0: Home

**Validation:**
```bash
pnpm run test:ui  # Unit tests
pnpm run test:a11y  # Accessibility audit
```

**Notes:**
- Reference wireframe in `docs/03_user_experience.md` §Stage 0
- Query `mission_readiness` view for readiness badges (see `supabase/migrations/0001_init.sql`)

---

#### TASK-UI-002: Implement Define Stage with Generative Intake & Chip Editing

**Priority:** P0
**Complexity:** M
**Tags:** `#frontend`, `#ui`, `#define-stage`, `#nextjs`

**Description:**
Implement Stage 1 (Define) with freeform intent field, generative chip display (objective, audience, KPI, safeguards), inline editing, and brief locking. Integration with IntakeAgent via `/api/intake/generate` endpoint.

**Acceptance Criteria:**
- [ ] Page at `src/app/(control-plane)/workspace/define/page.tsx`
- [ ] Large intent input field with optional example prompts (no persona lock-in)
- [ ] "Generate brief" action calling `/api/intake/generate`
- [ ] Chip display for: objective, audience, KPI, safeguards, timeline
- [ ] Inline editing for each chip with confidence badges
- [ ] Safeguard checklist with add/remove actions
- [ ] "Lock brief" CTA with summary preview modal
- [ ] Persistent chat rail (CopilotKit) showing IntakeAgent narration
- [ ] Skeleton states during generation (<3s target)
- [ ] Accessibility: live region announcements, keyboard controls
- [ ] Telemetry: `intent_submitted`, `brief_generated`, `brief_item_modified`, `mission_brief_locked`, `safeguard_added`
- [ ] Unit tests with chip editing flows
- [ ] Storybook stories for all generation states

**Dependencies:** TASK-ADK-002 (IntakeAgent), TASK-API-001 (`/api/intake/generate`)

**Doc References:**
- `docs/03_user_experience.md` §Stage 1 — Define
- `docs/04_implementation_guide.md` §2 Frontend (Key Components: MissionIntake)
- `docs/06_data_intelligence.md` §3.2 Stage 1: Define

**Validation:**
```bash
pnpm run test:ui
pnpm run test:a11y
```

**Notes:**
- Reference microcopy in `docs/03_user_experience.md` §Microcopy & Tone
- Generation target: <3s (p95) per `docs/01_product_vision.md` §3.1

---

#### TASK-UI-003: Implement Prepare Stage with Toolkit Panel & Readiness Meter

**Priority:** P0
**Complexity:** L
**Tags:** `#frontend`, `#ui`, `#prepare-stage`, `#nextjs`, `#composio`

**Description:**
Implement Stage 2 (Prepare) with recommended toolkit cards, OAuth connection status, data inspection previews, and readiness badge. Integration with InspectorAgent for discovery and Connect Link workflows.

**Acceptance Criteria:**
- [ ] Page at `src/app/(control-plane)/workspace/prepare/page.tsx`
- [ ] Toolkit cards showing: purpose, scopes (plain language), connection status, primary action
- [ ] Readiness badge: Ready, Needs data, Needs auth
- [ ] Data preview panel with anonymized samples, duplicate clusters, PII badges
- [ ] Coverage meter (radial/progress bar) showing ≥85% threshold
- [ ] Inspector notes rail with scope explanations and readiness blockers
- [ ] Accessibility: color + icon + text for readiness states, screen reader guidance
- [ ] Telemetry: `composio_discovery`, `toolkit_recommended`, `toolkit_connected`, `readiness_status_changed`, `coverage_preview_opened`
- [ ] Unit tests for toolkit selection flows
- [ ] Storybook stories for all readiness states

**Dependencies:** TASK-ADK-003 (InspectorAgent), TASK-UI-004 (Connect Link modal), TASK-API-002 (`/api/toolkits/recommend`)

**Doc References:**
- `docs/03_user_experience.md` §Stage 2 — Prepare
- `docs/04_implementation_guide.md` §2 Frontend (Key Components: RecommendedToolStrip, CoverageMeter)
- `docs/06_data_intelligence.md` §3.3 Stage 2: Prepare

**Validation:**
```bash
pnpm run test:ui
pnpm run test:a11y
```

**Notes:**
- Toolkit scopes use friendly language per `libs_docs/composio/llms.txt` terminology
- Coverage meter threshold: ≥85% per `docs/10_composio.md` §Governance Alignment

---

#### TASK-UI-004: Implement CopilotKit Chat Rail with Connect Link Approval Modal

**Priority:** P0
**Complexity:** M
**Tags:** `#frontend`, `#ui`, `#chat`, `#copilotkit`, `#composio`

**Description:**
Implement persistent CopilotKit chat rail across all stages with special handling for Connect Link approval requests from Inspector. Modal presents anticipated scopes, requires stakeholder approval, and triggers Inspector OAuth initiation.

**Acceptance Criteria:**
- [ ] Persistent chat rail component in `src/app/(control-plane)/layout.tsx`
- [ ] CopilotKit SSE streaming integration for agent narration
- [ ] Connect Link approval modal triggered by InspectorAgent
  - [ ] Display toolkit name, anticipated scopes (plain language), auth flow type
  - [ ] Approve/Decline actions
  - [ ] On approve: trigger Inspector OAuth via `/api/toolkits/authorize`
  - [ ] On decline: record reason and block progression
- [ ] Approval history log in chat timeline
- [ ] Accessibility: modal focus trap, keyboard controls, screen reader announcements
- [ ] Telemetry: `composio_auth_flow` (initiated/approved/declined), `approval_requested`
- [ ] Unit tests with modal interaction flows
- [ ] Storybook stories for approval modal states

**Dependencies:** TASK-ADK-003 (InspectorAgent), TASK-API-003 (`/api/toolkits/authorize`)

**Doc References:**
- `docs/03a_chat_experience.md` (chat rail behavior, agent narration)
- `docs/04_implementation_guide.md` §2 Frontend (CopilotKit Hooks)
- `docs/10_composio.md` §Plan & Approve (Connect Link approval flow)

**Validation:**
```bash
pnpm run test:ui
pnpm run test:a11y
```

**Notes:**
- Modal must display scopes in plain language per `docs/03_user_experience.md` §Trust & accessibility
- Inspector initiates OAuth only after approval per `docs/10_composio.md` progressive trust model

---

#### TASK-UI-005: Implement Plan Stage with Ranked Plays & Undo Plan Preview

**Priority:** P0
**Complexity:** L
**Tags:** `#frontend`, `#ui`, `#plan-stage`, `#nextjs`

**Description:**
Implement Stage 3 (Plan) with ranked mission plays, rationale toggle, undo plan callouts, and play selection. Integration with PlannerAgent for streaming play candidates.

**Acceptance Criteria:**
- [ ] Page at `src/app/(control-plane)/workspace/plan/page.tsx`
- [ ] Best plan card expanded by default with:
  - [ ] Outcome summary and impact estimate
  - [ ] Step-by-step breakdown
  - [ ] Safeguards honored badges
  - [ ] Undo window callout (e.g., "15-minute undo available")
- [ ] Alternative plays collapsed with expand controls
- [ ] Rationale toggle showing library precedent, tool usage patterns, data investigation insights
- [ ] Adjustment controls: scale slider, channel toggles, tone selector
- [ ] Play selection action routing to Stage 4 (Approve)
- [ ] Accessibility: keyboard shortcuts (r = rationale, c = comparison), focus management
- [ ] Telemetry: `planner_candidate_generated`, `plan_ranked`, `plan_adjusted`, `plan_selected`
- [ ] Unit tests for play selection and adjustment
- [ ] Storybook stories for play cards

**Dependencies:** TASK-ADK-004 (PlannerAgent), TASK-API-004 (`/api/plans/rank`)

**Doc References:**
- `docs/03_user_experience.md` §Stage 3 — Plan
- `docs/04_implementation_guide.md` §2 Frontend (Key Components: PlannerRail)
- `docs/06_data_intelligence.md` §3.4 Stage 3: Plan

**Validation:**
```bash
pnpm run test:ui
pnpm run test:a11y
```

**Notes:**
- Planner streams plays <2.5s for first plan per `docs/01_product_vision.md` §3.1
- Reference play card wireframe in `docs/03_user_experience.md` §Stage 3

---

#### TASK-UI-006: Implement Approve Stage with Dedicated Approval Checkpoint

**Priority:** P0
**Complexity:** M
**Tags:** `#frontend`, `#ui`, `#approve-stage`, `#nextjs`, `#governance`

**Description:**
Implement Stage 4 (Approve) as dedicated approval checkpoint showing selected play summary, affected records, safeguards, undo plan, and approval workflow (self-approve or delegate).

**Acceptance Criteria:**
- [ ] Page at `src/app/(control-plane)/workspace/approve/page.tsx`
- [ ] Read-only summary card with:
  - [ ] What will happen (play description)
  - [ ] Who is affected (record counts, data sources)
  - [ ] Safeguards + undo plan summary
  - [ ] Required permissions (OAuth scopes)
- [ ] Approval workflow:
  - [ ] Self-approve with rationale input
  - [ ] Delegate to approver (role selector, due date, notification)
  - [ ] Comment thread for review discussion
- [ ] Approval history timeline
- [ ] Export to PDF action for compliance
- [ ] Accessibility: printable summary, focus on decision buttons
- [ ] Telemetry: `approval_requested`, `approval_delegated`, `approval_granted`, `approval_rejected`, `approval_exported`, `audit_event_recorded`
- [ ] Unit tests for approval workflows
- [ ] Storybook stories for approval states

**Dependencies:** TASK-ADK-001 (CoordinatorAgent), TASK-API-005 (`/api/approvals`)

**Doc References:**
- `docs/03_user_experience.md` §Stage 4 — Approve
- `docs/04_implementation_guide.md` §2 Frontend (Key Components: ApprovalModal)
- `docs/06_data_intelligence.md` §3.5 Stage 4: Approve

**Validation:**
```bash
pnpm run test:ui
pnpm run test:a11y
```

**Notes:**
- Approval summary must be read-only and printable per `docs/03_user_experience.md` §Trust & accessibility
- Audit trail recorded in `mission_approvals` table per `docs/09_release_readiness.md` §Governance Readiness

---

#### TASK-UI-007: Implement Execute Stage with Live Checklist & Undo Banner

**Priority:** P0
**Complexity:** L
**Tags:** `#frontend`, `#ui`, `#execute-stage`, `#nextjs`, `#copilotkit`

**Description:**
Implement Stage 5 (Execute) with live execution checklist, alert rail for validator notifications, evidence artifact streaming, and undo banner with countdown timer.

**Acceptance Criteria:**
- [ ] Page at `src/app/(control-plane)/workspace/execute/page.tsx`
- [ ] Live checklist (≤8 steps) with status icons: waiting, running, done
- [ ] Alert rail for validator alerts with inline resolution actions
- [ ] Evidence artifact streaming to gallery (cards with redaction badges)
- [ ] Undo banner with countdown timer and "Finalize now" action
- [ ] Optional log drawer for detailed execution traces
- [ ] Pause/cancel controls with confirmation modal
- [ ] Accessibility: live region announcements, undo keyboard shortcut (u)
- [ ] Telemetry: `execution_started`, `execution_step_completed`, `validator_alert_raised`, `undo_available`, `undo_requested`, `execution_finalized`
- [ ] Unit tests for checklist updates and undo actions
- [ ] Storybook stories for execution states

**Dependencies:** TASK-ADK-006 (ExecutorAgent), TASK-API-006 (`/api/execution/run`)

**Doc References:**
- `docs/03_user_experience.md` §Stage 5 — Execute
- `docs/04_implementation_guide.md` §2 Frontend (Key Components: ExecutionPanel, UndoBar, EvidenceGallery)
- `docs/06_data_intelligence.md` §3.6 Stage 5: Execute

**Validation:**
```bash
pnpm run test:ui
pnpm run test:a11y
```

**Notes:**
- Step updates stream <500ms from backend per `docs/03_user_experience.md` §Performance & telemetry
- Undo button accessible via keyboard shortcut `u` per `docs/03_user_experience.md` §Trust & accessibility

---

#### TASK-UI-008: Implement Reflect Stage with Outcomes & Feedback Drawer

**Priority:** P1
**Complexity:** M
**Tags:** `#frontend`, `#ui`, `#reflect-stage`, `#nextjs`

**Description:**
Implement Stage 6 (Reflect) with outcome snapshot, evidence gallery, follow-up checklist with `bd` integration, and feedback drawer for ratings and qualitative notes.

**Acceptance Criteria:**
- [ ] Page at `src/app/(control-plane)/workspace/reflect/page.tsx`
- [ ] Outcome snapshot card with:
  - [ ] Impact metrics (meetings booked, tickets resolved, risk mitigated)
  - [ ] Records touched count
  - [ ] Time saved estimate
- [ ] Evidence gallery with artifact cards (download, share controls)
- [ ] Follow-up checklist with:
  - [ ] Task type, owner, due date
  - [ ] Direct `bd` issue creation links (`bd create ... -l follow-up`)
  - [ ] Status tracking (open, in_progress, done)
- [ ] Feedback drawer:
  - [ ] Star rating (1-5)
  - [ ] Effort saved input (hours)
  - [ ] Qualitative notes textarea
  - [ ] "What improved?" chip selection
- [ ] Library contribution suggestion for high-rated missions (≥4★)
- [ ] Accessibility: feedback form keyboard navigation, non-blocking submission
- [ ] Telemetry: `mission_completed`, `evidence_opened`, `feedback_submitted`, `followup_scheduled`, `library_contribution`
- [ ] Unit tests for feedback submission
- [ ] Storybook stories for outcome states

**Dependencies:** TASK-ADK-007 (EvidenceAgent), TASK-API-007 (`/api/feedback/*`)

**Doc References:**
- `docs/03_user_experience.md` §Stage 6 — Reflect
- `docs/04_implementation_guide.md` §2 Frontend (Key Components: FeedbackDrawer)
- `docs/06_data_intelligence.md` §3.7 Stage 6: Reflect
- `docs/11_issue_tracking.md` §2 Core Workflow (`bd` follow-up creation)

**Validation:**
```bash
pnpm run test:ui
pnpm run test:a11y
```

**Notes:**
- Outcome snapshot loads <1.2s per `docs/03_user_experience.md` §Performance & telemetry
- Follow-up actions can create `bd` issues and link to mission per `docs/06_data_intelligence.md` §3.7

---

### Theme 3: API Layer (Next.js Routes)

**Context:** Next.js API routes orchestrate between frontend UI, ADK agents, Composio SDK, and Supabase. Patterns in `docs/04_implementation_guide.md` §4.

---

#### TASK-API-001: Implement `/api/intake/generate` for Brief Generation

**Priority:** P0
**Complexity:** S
**Tags:** `#api`, `#backend`, `#nextjs`, `#define-stage`

**Description:**
Implement `/api/intake/generate` endpoint to receive mission intent, invoke IntakeAgent, and return generated chips (objective, audience, KPI, safeguards) with confidence scores.

**Acceptance Criteria:**
- [ ] POST endpoint at `src/app/api/intake/generate/route.ts`
- [ ] Input validation: `intent` (string, required), `template_id` (optional)
- [ ] Invoke IntakeAgent via ADK Runner
- [ ] Return JSON: `{ chips: [...], confidence_scores: {...}, generation_latency_ms: number }`
- [ ] Error handling: validation errors (400), IntakeAgent failures (500)
- [ ] Supabase Auth JWT validation
- [ ] Rate limiting: per-account sliding window
- [ ] Telemetry: `intent_submitted`, `brief_generated`
- [ ] Unit tests with Supertest
- [ ] OpenAPI schema documentation

**Dependencies:** TASK-ADK-002 (IntakeAgent)

**Doc References:**
- `docs/04_implementation_guide.md` §4 API Layer
- `docs/06_data_intelligence.md` §3.2 Stage 1: Define

**Validation:**
```bash
pnpm test:api
```

**Notes:**
- Target: <3s response time (p95) per `docs/01_product_vision.md` §3.1
- Return confidence scores for each chip per `docs/02_system_overview.md` §Stage 1 — Define

---

#### TASK-API-002: Implement `/api/toolkits/recommend` for Inspector Discovery

**Priority:** P0
**Complexity:** M
**Tags:** `#api`, `#backend`, `#nextjs`, `#prepare-stage`, `#composio`

**Description:**
Implement `/api/toolkits/recommend` endpoint for InspectorAgent no-auth discovery phase. Returns recommended toolkits, anticipated scopes, and coverage estimate without initiating OAuth.

**Acceptance Criteria:**
- [ ] POST endpoint at `src/app/api/toolkits/recommend/route.ts`
- [ ] Input validation: `mission_id` (uuid, required), `mission_brief` (object, required)
- [ ] Invoke InspectorAgent discovery phase
- [ ] Return JSON: `{ toolkits: [...], anticipated_connections: [...], coverage_estimate: number, readiness_status: string }`
- [ ] Cache discovery results for 1 hour per mission theme
- [ ] Error handling: Composio rate limits (429), discovery failures (500)
- [ ] Supabase Auth JWT validation
- [ ] Telemetry: `composio_discovery`, `toolkit_recommended`
- [ ] Unit tests with mocked InspectorAgent
- [ ] OpenAPI schema documentation

**Dependencies:** TASK-ADK-003 (InspectorAgent)

**Doc References:**
- `docs/04_implementation_guide.md` §4 API Layer, §5.2 Inspector Agent (Discovery + OAuth Initiation)
- `docs/06_data_intelligence.md` §3.3 Stage 2: Prepare

**Validation:**
```bash
pnpm test:api
```

**Notes:**
- Cache results to minimize Composio catalog calls per `docs/04_implementation_guide.md` §5.3
- First readiness assessment returns <1.5s per `docs/03_user_experience.md` §Stage 2

---

#### TASK-API-003: Implement `/api/toolkits/authorize` for OAuth Initiation

**Priority:** P0
**Complexity:** M
**Tags:** `#api`, `#backend`, `#nextjs`, `#prepare-stage`, `#composio`

**Description:**
Implement `/api/toolkits/authorize` endpoint for InspectorAgent OAuth initiation after stakeholder approval. Generates Connect Link, awaits connection, and logs granted scopes.

**Acceptance Criteria:**
- [ ] POST endpoint at `src/app/api/toolkits/authorize/route.ts`
- [ ] Input validation: `mission_id` (uuid, required), `toolkit_slug` (string, required), `approved_scopes` (array, required)
- [ ] Invoke InspectorAgent OAuth phase:
  - [ ] Call `client.toolkits.authorize()` with mission metadata
  - [ ] Await `wait_for_connection()` handshake (timeout: 900s)
  - [ ] Log granted scopes to `mission_connections` table
- [ ] Return JSON: `{ connect_link_id: string, granted_scopes: [...], status: string }`
- [ ] Error handling: OAuth timeout (408), auth expiry (401), Composio errors (502)
- [ ] Supabase Auth JWT validation
- [ ] Telemetry: `composio_auth_flow` (initiated/approved/expired)
- [ ] Unit tests with mocked Composio SDK
- [ ] OpenAPI schema documentation

**Dependencies:** TASK-ADK-003 (InspectorAgent)

**Doc References:**
- `docs/04_implementation_guide.md` §4 API Layer, §5.2 Inspector Agent (Discovery + OAuth Initiation)
- `docs/10_composio.md` §Plan & Approve (Connect Link workflows)
- `libs_docs/composio/llms.txt` (Authentication guides)

**Validation:**
```bash
pnpm test:api
```

**Notes:**
- Store Connect Link ID and metadata for audit trail per `docs/10_composio.md` §Governance Alignment
- Timeout: 900s (15 minutes) per OAuth flow best practices

---

#### TASK-API-004: Implement `/api/plans/rank` for Planner Streaming

**Priority:** P0
**Complexity:** M
**Tags:** `#api`, `#backend`, `#nextjs`, `#plan-stage`

**Description:**
Implement `/api/plans/rank` endpoint for PlannerAgent to stream ranked mission plays. Supports Server-Sent Events (SSE) for progressive play candidate delivery.

**Acceptance Criteria:**
- [ ] GET endpoint at `src/app/api/plans/rank/route.ts` with SSE support
- [ ] Query params: `mission_id` (uuid, required)
- [ ] Invoke PlannerAgent via ADK Runner
- [ ] Stream SSE events:
  - [ ] `play_candidate`: individual play with confidence, precedent count, undo plan
  - [ ] `ranking_complete`: final ordered plays with rationale
- [ ] Error handling: connection drops (reconnect), PlannerAgent failures (error event)
- [ ] Supabase Auth JWT validation
- [ ] Telemetry: `planner_candidate_generated`, `plan_ranked`
- [ ] Unit tests with SSE mocking
- [ ] OpenAPI schema documentation

**Dependencies:** TASK-ADK-004 (PlannerAgent)

**Doc References:**
- `docs/04_implementation_guide.md` §2 Frontend (Streaming), §4 API Layer
- `docs/06_data_intelligence.md` §3.4 Stage 3: Plan

**Validation:**
```bash
pnpm test:api
```

**Notes:**
- First plan visible <2.5s, alternatives stream after per `docs/03_user_experience.md` §Stage 3
- SSE reconnect handlers manage 429 backoffs per `docs/04_implementation_guide.md` §2 Streaming

---

#### TASK-API-005: Implement `/api/approvals` for Approval Workflow

**Priority:** P0
**Complexity:** S
**Tags:** `#api`, `#backend`, `#nextjs`, `#approve-stage`, `#governance`

**Description:**
Implement `/api/approvals` endpoints (POST for request, PATCH for decision, GET for status) to manage Stage 4 approval workflow with role-based gating and audit trails.

**Acceptance Criteria:**
- [ ] POST `/api/approvals` — create approval request
  - [ ] Input: `mission_id`, `play_id`, `approver_role`, `due_at`, `rationale`
  - [ ] Persist to `mission_approvals` table with status `requested`
  - [ ] Send notification to approver (email/Slack placeholder)
  - [ ] Return approval ID
- [ ] PATCH `/api/approvals/:id` — approve or reject
  - [ ] Input: `status` (approved/rejected), `rationale`
  - [ ] Update `mission_approvals` with decision timestamp and approver identity
  - [ ] Emit `audit_event_recorded` telemetry
  - [ ] Return updated approval
- [ ] GET `/api/approvals/:id` — fetch approval status
- [ ] Role-based access: validate approver permissions via Supabase RLS
- [ ] Error handling: unauthorized (403), not found (404)
- [ ] Telemetry: `approval_requested`, `approval_granted`, `approval_rejected`, `audit_event_recorded`
- [ ] Unit tests with role scenarios
- [ ] OpenAPI schema documentation

**Dependencies:** TASK-ADK-001 (CoordinatorAgent)

**Doc References:**
- `docs/04_implementation_guide.md` §4 API Layer
- `docs/06_data_intelligence.md` §3.5 Stage 4: Approve
- `docs/09_release_readiness.md` §Governance Readiness (approval workflows)

**Validation:**
```bash
pnpm test:api
```

**Notes:**
- Approval snapshot renders instantly from cached plan per `docs/03_user_experience.md` §Stage 4
- Audit trail integrity via `mission_approvals` table per `docs/09_release_readiness.md` §Governance Readiness

---

#### TASK-API-006: Implement `/api/execution/run` for Executor Orchestration

**Priority:** P0
**Complexity:** M
**Tags:** `#api`, `#backend`, `#nextjs`, `#execute-stage`

**Description:**
Implement `/api/execution/run` endpoint for ExecutorAgent to run approved play actions with streaming progress updates, validator monitoring, and evidence packaging.

**Acceptance Criteria:**
- [ ] POST endpoint at `src/app/api/execution/run/route.ts` with SSE support
- [ ] Input validation: `mission_id` (uuid, required), `play_id` (uuid, required)
- [ ] Invoke ExecutorAgent via ADK Runner
- [ ] Stream SSE events:
  - [ ] `execution_step_started`: action details
  - [ ] `execution_step_completed`: result, duration, status
  - [ ] `validator_alert`: safeguard notifications
  - [ ] `undo_available`: undo window countdown
  - [ ] `execution_complete`: final summary
- [ ] Error handling: tool call failures, validator rejections, connection drops
- [ ] Supabase Auth JWT validation
- [ ] Telemetry: `execution_started`, `execution_step_completed`, `composio_tool_call`, `validator_alert_raised`, `session_heartbeat`
- [ ] Unit tests with mocked ExecutorAgent
- [ ] OpenAPI schema documentation

**Dependencies:** TASK-ADK-006 (ExecutorAgent)

**Doc References:**
- `docs/04_implementation_guide.md` §2 Frontend (Streaming), §4 API Layer
- `docs/06_data_intelligence.md` §3.6 Stage 5: Execute

**Validation:**
```bash
pnpm test:api
```

**Notes:**
- Step updates stream <500ms from backend per `docs/03_user_experience.md` §Stage 5
- Emit `session_heartbeat` every 30s per `docs/06_data_intelligence.md` §3.6

---

#### TASK-API-007: Implement `/api/feedback/*` for Reflect Stage

**Priority:** P1
**Complexity:** S
**Tags:** `#api`, `#backend`, `#nextjs`, `#reflect-stage`

**Description:**
Implement feedback submission endpoints for Stage 6 (Reflect) including ratings, effort saved, qualitative notes, and library contribution suggestions.

**Acceptance Criteria:**
- [ ] POST `/api/feedback/submit` — submit mission feedback
  - [ ] Input: `mission_id`, `rating` (1-5), `effort_saved_hours`, `qualitative_notes`, `blockers`
  - [ ] Persist to `mission_feedback` table
  - [ ] Trigger library curation for ≥4★ missions
  - [ ] Return feedback ID
- [ ] POST `/api/feedback/library-contribution` — promote artifact to library
  - [ ] Input: `mission_id`, `artifact_id`, `library_category`
  - [ ] Generate embedding via pgvector
  - [ ] Persist to `library_entries` and `library_embeddings` tables
  - [ ] Return library entry ID
- [ ] GET `/api/feedback/:id` — fetch feedback
- [ ] Error handling: validation errors (400), not found (404)
- [ ] Telemetry: `feedback_submitted`, `library_contribution`
- [ ] Unit tests
- [ ] OpenAPI schema documentation

**Dependencies:** TASK-ADK-007 (EvidenceAgent), TASK-DATA-002 (Library embeddings)

**Doc References:**
- `docs/04_implementation_guide.md` §4 API Layer
- `docs/06_data_intelligence.md` §3.7 Stage 6: Reflect, §5.4 Loop D — Library Growth

**Validation:**
```bash
pnpm test:api
```

**Notes:**
- Trigger library curation for ≥4★ missions per `docs/06_data_intelligence.md` §5.4
- Outcome snapshot loads <1.2s per `docs/03_user_experience.md` §Stage 6

---

### Theme 4: Data & Analytics

**Context:** Supabase provides data layer with schema, materialized views, cron jobs, and pgvector for library embeddings. Patterns in `docs/06_data_intelligence.md` and `supabase/migrations/0001_init.sql`.

---

#### TASK-DATA-001: Implement Telemetry Audit Script

**Priority:** P1
**Complexity:** M
**Tags:** `#data`, `#analytics`, `#telemetry`, `#ci`

**Description:**
Implement `scripts/audit_telemetry_events.ts` to validate event catalog completeness, ensure all documented events exist in codebase, verify context fields, and generate coverage reports.

**Acceptance Criteria:**
- [ ] Script at `scripts/audit_telemetry_events.ts`
- [ ] Modes:
  - [ ] `--mode check`: CI gate (exit 0 if valid, exit 1 if issues)
  - [ ] `--mode report`: generate coverage report to `docs/readiness/telemetry_coverage.md`
- [ ] Validations:
  - [ ] All events in `docs/06_data_intelligence.md` §3 exist in codebase
  - [ ] Required context fields present (`mission_id`, `tenantId`, `stage`)
  - [ ] Stage alignment (event stage matches documented stage)
  - [ ] Alias documentation (e.g., `brief_field_edited` → `brief_item_modified`)
- [ ] Report includes:
  - [ ] Coverage percentage (events implemented / events documented)
  - [ ] Missing events list
  - [ ] Events without context fields
  - [ ] Orphan events (in code but not documented)
- [ ] CI integration: run on PRs touching telemetry, UI, or agents
- [ ] Unit tests for validator logic

**Dependencies:** None (can run against existing codebase)

**Doc References:**
- `docs/06_data_intelligence.md` §3 Event Catalog by Mission Stage, §7.1 Telemetry Audits
- `docs/09_release_readiness.md` §Data & Analytics Readiness (Telemetry validation)

**Validation:**
```bash
pnpm run audit:telemetry
pnpm ts-node --esm scripts/audit_telemetry_events.ts --mode report --output docs/readiness/telemetry_coverage.md
```

**Notes:**
- Required CI gate per `docs/09_release_readiness.md` §CI/CD Gates (item 7)
- Target: 100% coverage before releases per `docs/09_release_readiness.md` §Metrics & Success Criteria

---

#### TASK-DATA-002: Implement Library Embeddings with pgvector

**Priority:** P1
**Complexity:** M
**Tags:** `#data`, `#analytics`, `#library`, `#supabase`, `#ml`

**Description:**
Implement library embedding generation using pgvector for semantic search of mission plays. Supports PlannerAgent library retrieval for play ranking.

**Acceptance Criteria:**
- [ ] Embedding generation function:
  - [ ] Input: library entry (title, description, playbook JSON)
  - [ ] Generate 1536-dimensional embedding (OpenAI text-embedding-ada-002 or equivalent)
  - [ ] Store in `library_embeddings` table with `entry_id`, `embedding`, `embedding_provider`, `embedding_model`
- [ ] Semantic search helper (already in schema):
  - [ ] Function `search_library_entries(query_embedding, similarity_threshold, limit)`
  - [ ] Returns entries ordered by cosine similarity
- [ ] Embedding refresh automation:
  - [ ] Weekly cron job (Supabase function `refresh_library_embeddings()`)
  - [ ] Incremental: only update stale embeddings (>7 days old)
- [ ] Integration with PlannerAgent:
  - [ ] Generate query embedding from mission objective
  - [ ] Retrieve top K library entries (K=5)
  - [ ] Include precedent count in ranking
- [ ] Unit tests with sample library entries
- [ ] Monitoring: embedding generation latency, weekly refresh completion

**Dependencies:** None (schema already exists)

**Doc References:**
- `supabase/migrations/0001_init.sql` (library tables, search function)
- `docs/04_implementation_guide.md` §6 Supabase Data Layer (pgvector)
- `docs/06_data_intelligence.md` §5.4 Loop D — Library Growth

**Validation:**
```bash
# Test embedding generation
pytest agent/tests/test_library_embeddings.py

# Test search function
supabase functions invoke refresh_library_embeddings
```

**Notes:**
- Weekly refresh scheduled via Supabase cron per `supabase/migrations/0001_init.sql`
- Target: Library reuse ≥40% of missions per `docs/05_capability_roadmap.md` §7 Metrics & Targets

---

#### TASK-DATA-003: Implement Analytics Dashboard Materialized View Refresh

**Priority:** P1
**Complexity:** S
**Tags:** `#data`, `#analytics`, `#supabase`, `#dashboards`

**Description:**
Implement nightly materialized view refresh automation for analytics dashboards (Executive, Governance, Operations, Adoption, Agent Performance).

**Acceptance Criteria:**
- [ ] Supabase cron job configured (already scheduled in schema at 02:00 UTC)
- [ ] Refresh function `refresh_analytics_views()` (already exists) tested for:
  - [ ] All views refresh successfully
  - [ ] Completion within SLA (Executive ≤5 min, others ≤10 min)
  - [ ] No data corruption or missing indices
- [ ] Telemetry event: `metrics_refresh_completed` with status and duration
- [ ] Monitoring alerts:
  - [ ] Refresh failure (critical)
  - [ ] Refresh duration >10 min (warning)
- [ ] Manual refresh script: `pnpm ts-node scripts/run_metrics_refresh.py --view <name>`
- [ ] Documentation in `docs/readiness/runbooks/analytics_refresh.md`

**Dependencies:** None (schema already exists)

**Doc References:**
- `supabase/migrations/0001_init.sql` (materialized views, refresh function, cron schedule)
- `docs/06_data_intelligence.md` §4 Role-Specific Analytics Dashboards, §7.3 Analytics View Refresh

**Validation:**
```bash
# Manual refresh test
pnpm ts-node scripts/run_metrics_refresh.py --view executive_summary_mv

# Verify cron job
supabase functions invoke refresh_analytics_views
```

**Notes:**
- Nightly refresh at 02:00 UTC per `supabase/migrations/0001_init.sql`
- SLA: Executive ≤5 min, others ≤10 min per `docs/06_data_intelligence.md` §7.3

---

#### TASK-DATA-004: Implement Executive Dashboard Frontend

**Priority:** P2
**Complexity:** M
**Tags:** `#data`, `#analytics`, `#frontend`, `#dashboards`

**Description:**
Implement Executive Dashboard frontend consuming `executive_summary` view with weekly approved missions, conversion funnel, automation coverage, and role-agnostic metrics.

**Acceptance Criteria:**
- [ ] Page at `src/app/(control-plane)/analytics/executive/page.tsx`
- [ ] Data source: `executive_summary` view (Supabase)
- [ ] Visualizations:
  - [ ] Weekly trend line chart (approved missions, conversion rate)
  - [ ] Conversion funnel (intent → execution)
  - [ ] Automation coverage bar chart (% missions with ≥3 toolkits)
  - [ ] Persona-specific outcome tiles (pipeline impact, time saved)
- [ ] Filters: date range, mission type, readiness
- [ ] Refresh indicator (last updated timestamp)
- [ ] Export to PDF/CSV actions
- [ ] Accessibility: ARIA labels, keyboard navigation, screen reader support
- [ ] Responsive layout (desktop, tablet)
- [ ] Unit tests with mocked view data
- [ ] Storybook stories

**Dependencies:** TASK-DATA-003 (Analytics refresh)

**Doc References:**
- `docs/06_data_intelligence.md` §4.1 Executive Dashboard
- `supabase/migrations/0001_init.sql` (executive_summary view)

**Validation:**
```bash
pnpm run test:ui
pnpm run test:a11y
```

**Notes:**
- Nightly refresh ensures data freshness per `docs/06_data_intelligence.md` §4.1
- Reference example outcomes from `docs/examples/revops.md`

---

#### TASK-DATA-005: Implement Governance Dashboard Frontend

**Priority:** P2
**Complexity:** M
**Tags:** `#data`, `#analytics`, `#frontend`, `#dashboards`, `#governance`

**Description:**
Implement Governance Dashboard frontend consuming `governance_insights` view with safeguard adherence, undo efficacy, validator override rates, and incident tracking.

**Acceptance Criteria:**
- [ ] Page at `src/app/(control-plane)/analytics/governance/page.tsx`
- [ ] Data source: `governance_insights` view (Supabase)
- [ ] Visualizations:
  - [ ] Safeguard intervention timeline
  - [ ] Validator alert heatmap (by toolkit)
  - [ ] Undo success gauge (target ≥95%)
  - [ ] Incident cards with severity and MTTR
  - [ ] Scope compliance table (Inspector vs Planner alignment)
- [ ] Alerts:
  - [ ] Undo success <95% (7-day rolling) — red badge
  - [ ] Validator override >10% WoW — yellow badge
  - [ ] Incident MTTR >30 min — red badge
- [ ] Filters: date range, severity, approver role
- [ ] Export to PDF for compliance reports
- [ ] Accessibility: ARIA labels, keyboard navigation, screen reader support
- [ ] Responsive layout
- [ ] Unit tests with mocked view data
- [ ] Storybook stories

**Dependencies:** TASK-DATA-003 (Analytics refresh)

**Doc References:**
- `docs/06_data_intelligence.md` §4.2 Governance Dashboard
- `supabase/migrations/0001_init.sql` (governance_insights view)
- `docs/09_release_readiness.md` §Governance Readiness (compliance reports)

**Validation:**
```bash
pnpm run test:ui
pnpm run test:a11y
```

**Notes:**
- Hourly aggregates for active missions per `docs/06_data_intelligence.md` §4.2
- Link to runbooks (`docs/07_operations_playbook.md`) for incident response

---

### Theme 5: Testing & Quality

**Context:** Testing strategy includes frontend (Vitest, Playwright, axe), backend (pytest, ADK evals), and integration (Supertest). Patterns in `docs/04_implementation_guide.md` §8 and `docs/09_release_readiness.md`.

---

#### TASK-TEST-001: Implement ADK Evaluation Suites

**Priority:** P0
**Complexity:** L
**Tags:** `#testing`, `#agent`, `#adk`, `#backend`

**Description:**
Implement ADK evaluation suites (`*.evalset.json`) for agent smoke tests, mission journeys, ranking quality, coordination, and recovery scenarios per `docs/04_implementation_guide.md` §3 ADK Evaluation Framework.

**Acceptance Criteria:**
- [ ] Eval sets created:
  - [ ] `agent/evals/smoke_foundation.evalset.json` — Core agent smoke tests
  - [ ] `agent/evals/discovery_coverage.evalset.json` — Inspector toolkit discovery and coverage
  - [ ] `agent/evals/ranking_quality.evalset.json` — Planner play ranking accuracy
  - [ ] `agent/evals/execution_safety.evalset.json` — Executor + Validator safeguards
  - [ ] `agent/evals/error_recovery.evalset.json` — Rate limits, auth expiry, Supabase outage
  - [ ] `agent/evals/mission_end_to_end.evalset.json` — Seven-stage scenario with telemetry assertions
- [ ] Golden examples for each eval set (from `docs/examples/`)
- [ ] Telemetry assertions in end-to-end eval set
- [ ] CI integration: `mise run test-agent` on every PR
- [ ] Blocking merge if pass rate <90%
- [ ] Reports exported to `docs/readiness/agent-evals/`

**Dependencies:** TASK-ADK-001 through TASK-ADK-007 (all agents)

**Doc References:**
- `docs/04_implementation_guide.md` §3 Backend Agents (ADK Evaluation Framework)
- `docs/09_release_readiness.md` §Engineering Readiness (ADK agent evals)
- `libs_docs/adk/llms-full.txt` (eval patterns)

**Validation:**
```bash
mise run test-agent  # Runs full eval battery
adk eval --verbose agent/agents/planner.py agent/evals/ranking_quality.evalset.json
```

**Notes:**
- Export reports to `docs/readiness/agent-evals/` for release sign-off per `docs/09_release_readiness.md`
- Target: ≥90% pass rate per PR per `docs/09_release_readiness.md` §CI/CD Gates

---

#### TASK-TEST-002: Implement Frontend Accessibility Testing

**Priority:** P1
**Complexity:** M
**Tags:** `#testing`, `#frontend`, `#accessibility`, `#ui`

**Description:**
Implement automated accessibility testing for all UI components using axe-core. CI gate to enforce WCAG 2.1 AA compliance before merge.

**Acceptance Criteria:**
- [ ] Script at `scripts/test_a11y.sh`
- [ ] Tool: axe-core CLI
- [ ] Coverage: all pages under `src/app/(control-plane)/workspace/`
- [ ] Validations:
  - [ ] WCAG 2.1 AA compliance
  - [ ] Color contrast (AA level)
  - [ ] Keyboard navigation
  - [ ] Screen reader labels (ARIA)
  - [ ] Live region announcements
- [ ] CI integration: `pnpm run test:a11y` on every PR
- [ ] Blocking merge if critical violations detected
- [ ] Report: `docs/readiness/ux/accessibility_audit.html`
- [ ] Unit tests for specific accessibility scenarios (keyboard shortcuts, focus management)

**Dependencies:** TASK-UI-001 through TASK-UI-008 (all UI components)

**Doc References:**
- `docs/03_user_experience.md` §Accessibility & Inclusion Checklist
- `docs/04_implementation_guide.md` §8 Testing Strategy
- `docs/09_release_readiness.md` §UX & Design Readiness

**Validation:**
```bash
pnpm run test:a11y  # Runs axe-core audit
```

**Notes:**
- Target: 100% WCAG 2.1 AA compliance per `docs/09_release_readiness.md` §UX & Design Readiness
- Critical violations block merge per `docs/09_release_readiness.md` §CI/CD Gates

---

#### TASK-TEST-003: Implement End-to-End Integration Tests

**Priority:** P1
**Complexity:** L
**Tags:** `#testing`, `#e2e`, `#integration`, `#playwright`

**Description:**
Implement end-to-end integration tests for complete mission journeys (Home → Reflect) using Playwright with real ADK agents, Composio SDK mocks, and Supabase test instance.

**Acceptance Criteria:**
- [ ] Test suite at `tests/e2e/mission-journeys.spec.ts`
- [ ] Scenarios:
  - [ ] RevOps mission: Define → Prepare (OAuth) → Plan → Approve → Execute → Reflect
  - [ ] Support mission with validator intervention
  - [ ] Engineering mission with undo flow
  - [ ] Governance mission with approval delegation
- [ ] Environment: staging Supabase instance, mocked Composio SDK
- [ ] Validations:
  - [ ] All stages complete successfully
  - [ ] Telemetry events emitted correctly
  - [ ] Session state persisted to Supabase
  - [ ] Artifacts generated and stored
- [ ] CI integration: nightly runs on main branch
- [ ] Reports: Playwright HTML report with screenshots
- [ ] Performance assertions (stage transitions <200ms)

**Dependencies:** TASK-ADK-001 through TASK-ADK-007 (all agents), TASK-UI-001 through TASK-UI-008 (all UI)

**Doc References:**
- `docs/02_system_overview.md` §Seven-Stage Mission Journey
- `docs/04_implementation_guide.md` §8 Testing Strategy
- `docs/09_release_readiness.md` §Engineering Readiness (e2e tests)

**Validation:**
```bash
pnpm run test:e2e  # Runs Playwright suite
```

**Notes:**
- Use golden examples from `docs/examples/` as test scenarios
- Target: All stages complete in <5 minutes per `docs/09_release_readiness.md` §Metrics & Success Criteria

---

### Theme 6: Operations & Deployment

**Context:** Production deployment, monitoring, incident response, and runbook automation. Patterns in `docs/07_operations_playbook.md` and `docs/09_release_readiness.md`.

---

#### TASK-OPS-001: Implement Agent Deployment Automation

**Priority:** P1
**Complexity:** M
**Tags:** `#operations`, `#deployment`, `#backend`, `#fastapi`

**Description:**
Implement `scripts/deploy-agent.sh` for FastAPI agent deployment to Fly.io or GKE with health checks, rollback procedures, and environment validation.

**Acceptance Criteria:**
- [ ] Script at `scripts/deploy-agent.sh`
- [ ] Deployment targets: Fly.io (primary), GKE (fallback)
- [ ] Steps:
  - [ ] Validate environment variables (Supabase, Composio, OpenAI keys)
  - [ ] Build Docker image with ADK dependencies
  - [ ] Push to registry
  - [ ] Deploy with blue-green strategy (zero downtime)
  - [ ] Health check: `/health` endpoint (ADK agents ready)
  - [ ] Smoke test: invoke CoordinatorAgent via API
  - [ ] Rollback on failure
- [ ] CI integration: auto-deploy on main branch after tests pass
- [ ] Monitoring: emit `deployment_started`, `deployment_completed` telemetry
- [ ] Documentation: `docs/readiness/runbooks/agent_deployment.md`

**Dependencies:** TASK-ADK-001 through TASK-ADK-007 (all agents)

**Doc References:**
- `docs/04_implementation_guide.md` §9 Operational Readiness
- `docs/07_operations_playbook.md` §Deployment
- `docs/09_release_readiness.md` §Operations Readiness (Deployment)

**Validation:**
```bash
./scripts/deploy-agent.sh --env staging
./scripts/deploy-agent.sh --env production
```

**Notes:**
- Zero-downtime deployment validated per `docs/09_release_readiness.md` §Operations Readiness
- Rollback procedure tested per `docs/09_release_readiness.md` §Rollback & Incident Response

---

#### TASK-OPS-002: Implement Monitoring Dashboards (Datadog Integration)

**Priority:** P1
**Complexity:** M
**Tags:** `#operations`, `#monitoring`, `#observability`, `#datadog`

**Description:**
Implement Datadog integration for Control Plane monitoring with dashboards for Operations, Agent Performance, and Infrastructure health.

**Acceptance Criteria:**
- [ ] Datadog agent configured for:
  - [ ] Next.js frontend (logs, metrics, traces)
  - [ ] FastAPI backend (logs, metrics, ADK agent telemetry)
  - [ ] Supabase (connection pool, query performance)
- [ ] Dashboards created:
  - [ ] Operations Health: SSE latency (p95 <500ms), error rate (<2%), heartbeat success
  - [ ] Agent Performance: lag and token usage per agent, session state size, error outcomes
  - [ ] Infrastructure: memory, CPU, connection pool utilization
- [ ] Alert rules:
  - [ ] Error rate spike (>2% for >5 min) → SEV-2 alert
  - [ ] Latency degradation (p95 >200ms sustained) → SEV-3 alert
  - [ ] ADK agent heartbeat lag >10s → SEV-2 alert
  - [ ] Composio rate limit spike → SEV-3 alert
- [ ] Alert actions: auto-create `bd` issue, notify on-call engineer (PagerDuty)
- [ ] Documentation: `docs/readiness/runbooks/monitoring.md`

**Dependencies:** TASK-ADK-001 through TASK-ADK-007 (agents emit telemetry)

**Doc References:**
- `docs/06_data_intelligence.md` §4.3 Operations Dashboard
- `docs/07_operations_playbook.md` §Monitoring & Observability
- `docs/09_release_readiness.md` §Operations Readiness (Monitoring)

**Validation:**
```bash
# Test alert rules
datadog-cli monitor test <monitor_id>
```

**Notes:**
- Real-time streaming with 1-minute aggregation per `docs/06_data_intelligence.md` §4.3
- Auto-create `bd` issues on SEV-1/SEV-2 per `docs/09_release_readiness.md` §Rollback & Incident Response

---

#### TASK-OPS-003: Implement Incident Response Automation

**Priority:** P2
**Complexity:** M
**Tags:** `#operations`, `#incident-response`, `#automation`

**Description:**
Implement automated incident response workflow with `bd` issue creation, runbook routing, and escalation paths for SEV-1 and SEV-2 alerts.

**Acceptance Criteria:**
- [ ] Webhook endpoint: `/api/incidents/webhook` (receives alerts from Datadog/PagerDuty)
- [ ] On alert:
  - [ ] Auto-create `bd` issue: `bd create "SEV-{level}: {summary}" -p 0 -t incident`
  - [ ] Determine runbook from alert tags (e.g., `rate_limit` → `docs/readiness/runbooks/beads_db.md`)
  - [ ] Notify on-call engineer (Slack, PagerDuty)
  - [ ] Emit telemetry: `incident_opened`
- [ ] Incident resolution:
  - [ ] PATCH `/api/incidents/:id` with resolution details
  - [ ] Close `bd` issue: `bd close BD-XXX --reason "Resolved: {summary}"`
  - [ ] Emit telemetry: `incident_resolved` with MTTR
- [ ] Runbook links in incident notifications
- [ ] Post-mortem template generation for SEV-1
- [ ] Documentation: `docs/readiness/runbooks/incident_response.md`

**Dependencies:** TASK-OPS-002 (Monitoring)

**Doc References:**
- `docs/07_operations_playbook.md` §Incident Response
- `docs/09_release_readiness.md` §Rollback & Incident Response
- `docs/11_issue_tracking.md` §2 Core Workflow (`bd` usage)

**Validation:**
```bash
# Test incident webhook
curl -X POST http://localhost:3000/api/incidents/webhook -H "Content-Type: application/json" -d '{"severity": 1, "summary": "Rate limit spike"}'
```

**Notes:**
- Auto-create `bd` issues per `docs/09_release_readiness.md` §Continuous Monitoring
- Target MTTR: <30 minutes per `docs/05_capability_roadmap.md` §7 Metrics & Targets

---

### Theme 7: Documentation & Evidence

**Context:** Maintain documentation freshness, generate readiness evidence, and ensure compliance with release checklists. Patterns in `docs/09_release_readiness.md`.

---

#### TASK-DOC-001: Implement Evidence Bundle Export Automation

**Priority:** P2
**Complexity:** M
**Tags:** `#documentation`, `#governance`, `#evidence`

**Description:**
Implement `scripts/export_evidence_bundle.py` to package mission metadata, telemetry slice, validator notes, artifacts, and compliance manifests for governance reviewers.

**Acceptance Criteria:**
- [ ] Script at `scripts/export_evidence_bundle.py`
- [ ] Input: `--mission-id <uuid>`, `--output <file>` (PDF or JSON)
- [ ] Bundle contents:
  - [ ] Mission metadata (brief, stage status, stakeholders)
  - [ ] Telemetry events (filtered by mission_id)
  - [ ] Validator notes and safeguard compliance
  - [ ] Artifacts (redacted tool outputs, evidence bundles)
  - [ ] Undo plans and execution summary
  - [ ] Redaction manifest (fields scrubbed, PII status)
  - [ ] Approval trail with timestamps and approver identities
- [ ] Output formats: PDF (human-readable), JSON (machine-readable)
- [ ] SHA-256 hash for tamper detection
- [ ] Compliance footer: retention policy, export timestamp
- [ ] Unit tests with sample missions

**Dependencies:** TASK-ADK-007 (EvidenceAgent), TASK-DATA-001 (Telemetry audit)

**Doc References:**
- `docs/06_data_intelligence.md` §7.4 Evidence Bundle Export
- `docs/09_release_readiness.md` §Governance Readiness (evidence exports)

**Validation:**
```bash
pnpm ts-node scripts/export_evidence_bundle.py --mission-id <uuid> --output evidence.pdf
```

**Notes:**
- Always include redaction manifest per `docs/06_data_intelligence.md` §6.1
- SHA-256 hash per `docs/01_product_vision.md` §3.4 Evidence-First Architecture

---

#### TASK-DOC-002: Implement Quarterly Documentation Review Checklist

**Priority:** P3
**Complexity:** S
**Tags:** `#documentation`, `#process`

**Description:**
Create quarterly documentation review checklist and automation to flag stale docs, missing evidence artifacts, and broken cross-references.

**Acceptance Criteria:**
- [ ] Checklist template at `docs/readiness/quarterly_review_checklist.md`
- [ ] Automation script: `scripts/audit_docs.sh`
- [ ] Validations:
  - [ ] All docs have "Last Updated" within 90 days
  - [ ] Evidence artifacts referenced in `docs/09_release_readiness.md` exist
  - [ ] Cross-references valid (no broken links)
  - [ ] Diagrams (Mermaid) render correctly
  - [ ] Persona examples in `docs/examples/` align with current UI
- [ ] CI integration: weekly audit report
- [ ] Outputs: markdown report with action items
- [ ] Owner assignment for stale docs

**Dependencies:** None

**Doc References:**
- `docs/00_README.md` §Documentation Standards (Maintenance)
- `docs/09_release_readiness.md` §Evidence Management

**Validation:**
```bash
./scripts/audit_docs.sh --output docs/readiness/doc_audit_report.md
```

**Notes:**
- Quarterly reviews per `docs/00_README.md` §Documentation Standards
- Flag artifacts >30 days stale per `docs/09_release_readiness.md` §Evidence Artifact Requirements

---

## Assumptions & Open Questions

### Assumptions
1. **Gemini ADK as Primary Agent Framework:** All agent coordination uses Gemini ADK patterns with shared session state (`ctx.session.state`). No alternative frameworks (LangChain, CrewAI) are in scope.
2. **Composio SDK as Sole Integration:** Native Composio SDK is the exclusive interface for toolkit execution. No MCP servers or alternate routers required.
3. **Single Supabase Migration Workflow:** All schema changes edit `supabase/migrations/0001_init.sql` directly. No separate migration files created.
4. **Progressive Trust Model:** Inspector presents anticipated scopes → stakeholder approval → OAuth initiation → Planner receives established connections. This sequence is non-negotiable for governance.
5. **Seven-Stage Journey:** Home → Define → Prepare → Plan → Approve → Execute → Reflect. All UX, telemetry, and agent logic aligns to these stages.
6. **Telemetry as Contract:** Event catalog in `docs/06_data_intelligence.md` §3 is authoritative. All features must emit documented events before release.
7. **Mise-Managed Toolchain:** All development uses mise for Node, Python, pnpm, uv versions. No global installs mixed in.
8. **Beads (`bd`) for Operational Tracking:** `bd` CLI used for issue tracking, dependency management, and evidence linking. Not part of product runtime.
9. **Evidence-First Architecture:** Every mission generates tamper-proof artifacts with SHA-256 hashes, undo plans, and audit trails for governance.
10. **Accessibility as Requirement:** WCAG 2.1 AA compliance enforced via CI gates. Keyboard navigation and screen reader support mandatory.

### Open Questions
1. **LLM Provider Mix:** Should Planner and Validator use different LLM providers (Gemini vs OpenAI) for cost/latency optimization? If yes, what prompt parity requirements?
   - **Impact:** Agent implementation patterns, ADK configuration, telemetry attribution
   - **Owner:** Engineering Lead + Product
   - **Recommendation:** Document in `AGENTS.md` after decision

2. **Multi-Tenant Analytics:** Shared Supabase project for all tenants or per-instance isolation?
   - **Impact:** RLS policies, analytics views, data retention
   - **Owner:** Operations + Data Engineering
   - **Recommendation:** Start per-instance, evaluate shared model for Scale milestone

3. **Evidence Bundle Retention:** How long should artifact history be retained beyond 365-day requirement?
   - **Impact:** Storage costs, compliance windows, analytics backfill
   - **Owner:** Governance + Operations
   - **Recommendation:** Document in `docs/06_data_intelligence.md` §6.2 after legal review

4. **Library Marketplace:** Should library plays be shared publicly (cross-tenant) or private only?
   - **Impact:** Security review, moderation overhead, embedding privacy
   - **Owner:** Product + Trust
   - **Recommendation:** Defer to post-Scale milestone per `docs/05_capability_roadmap.md` §11

5. **Codex Integration Depth:** Should agent prompt generation leverage Codex/Claude Code for self-improving templates?
   - **Impact:** Library learning loop complexity, prompt quality, token costs
   - **Owner:** ML Team + Product
   - **Recommendation:** Spike in research phase, document in `docs/research/`

6. **Approval Delegation Depth:** Can approvers delegate multiple levels deep (e.g., A → B → C)?
   - **Impact:** Approval workflow complexity, audit trail depth
   - **Owner:** Product + Governance
   - **Recommendation:** Start single-level delegation, evaluate multi-level for Scale milestone

7. **Composio Rate Limit Strategy:** Should rate limit recovery be exponential backoff only, or include circuit breaker pattern?
   - **Impact:** Error recovery complexity, user experience during spikes
   - **Owner:** Engineering Lead + Operations
   - **Recommendation:** Start exponential backoff per `docs/02_system_overview.md` §Error Handling, evaluate circuit breaker for Scale milestone

8. **ADK Eval Coverage Expansion:** Which eval sets are critical for Foundation milestone vs deferred to Core/Scale?
   - **Impact:** Testing velocity, release confidence
   - **Owner:** Engineering Lead + QA
   - **Recommendation:** Foundation: smoke, discovery, ranking. Core: execution safety, error recovery. Scale: agent coordination.

---

## Next Steps for AI Agents

### Quick Start for Autonomous Agents
1. **Choose a task** from backlog matching your capabilities (filter by tags: `#frontend`, `#agent`, `#api`, etc.)
2. **Verify dependencies** are completed (check "Dependencies" column)
3. **Read doc references** for context (listed in "Doc References" column)
4. **Implement following acceptance criteria** as checklist
5. **Run validation** commands to verify completion
6. **Emit telemetry events** as specified in `docs/06_data_intelligence.md` §3
7. **Update task status** (if using `bd` for tracking)

### Recommended Starting Tasks for Agents
- **Backend Specialists:** TASK-ADK-001 (CoordinatorAgent), TASK-ADK-002 (IntakeAgent)
- **Frontend Specialists:** TASK-UI-001 (Home Dashboard), TASK-UI-002 (Define Stage)
- **API Specialists:** TASK-API-001 (Intake API), TASK-API-002 (Toolkits API)
- **Data Specialists:** TASK-DATA-001 (Telemetry Audit), TASK-DATA-002 (Library Embeddings)
- **Testing Specialists:** TASK-TEST-001 (ADK Evals), TASK-TEST-002 (Accessibility Tests)

### Task Prioritization
**P0 (Critical) — Foundation Milestone:**
- All TASK-ADK-* (agent implementations)
- TASK-UI-001 through TASK-UI-007 (seven-stage UI)
- TASK-API-001 through TASK-API-006 (core APIs)

**P1 (High) — Core Milestone:**
- TASK-DATA-* (analytics, library, telemetry)
- TASK-TEST-* (evals, accessibility, e2e)
- TASK-OPS-001, TASK-OPS-002 (deployment, monitoring)

**P2 (Medium) — Scale Milestone:**
- TASK-OPS-003 (incident automation)
- TASK-DOC-001 (evidence export)
- TASK-DATA-004, TASK-DATA-005 (dashboard frontends)

**P3 (Nice-to-Have):**
- TASK-DOC-002 (quarterly review)
- Documentation enhancements
- Performance optimizations

---

## Maintenance & Updates

**Last Updated:** October 16, 2025
**Next Review:** December 15, 2025
**Owner:** AI Agent Team + Engineering Leadership

### When to Update This Backlog
- New capabilities documented in `docs/` require implementation tasks
- Milestone completion triggers review of next-phase tasks
- Agent implementation patterns change (new ADK features, Composio SDK updates)
- Schema changes in `supabase/migrations/0001_init.sql` require downstream updates
- Telemetry event catalog in `docs/06_data_intelligence.md` expands
- Release readiness criteria in `docs/09_release_readiness.md` change

### How to Propose New Tasks
1. Reference documentation source (which doc, which section)
2. Justify priority based on milestone dependencies (`docs/05_capability_roadmap.md`)
3. Define acceptance criteria and validation steps
4. Estimate complexity (XS/S/M/L/XL)
5. Identify dependencies and blocking tasks
6. Submit as RFC to `docs/rfcs/` or create `bd` issue with `#backlog-proposal` tag

---

**End of Backlog**

For questions or feedback, consult:
- **[Documentation Guide](docs/00_README.md)** — Navigate all documentation
- **[AGENTS.md](AGENTS.md)** — Quick reference for AI agents
- **[Issue Tracking](docs/11_issue_tracking.md)** — `bd` CLI usage and dependency management
- **[Release Readiness](docs/09_release_readiness.md)** — Evidence requirements and sign-off process
