# AI Employee Control Plane: AI Agent Action Checklist

**Version:** 2.0 (October 2025)
**Audience:** AI Agents, Autonomous Operators, Engineering Automation
**Purpose:** Comprehensive, actionable task list derived from unified documentation suite
**Status:** Active roadmap for AI-driven documentation and product readiness execution

---

## Overview

This checklist translates the AI Employee Control Plane vision into executable tasks for AI agents. It covers the **unified mission lifecycle**, **data intelligence loops**, and **operational readiness** based on seven core documents:

1. **Product Vision** (`01_product_vision.md`)
2. **System Overview** (`02_system_overview.md`)
3. **User Experience Blueprint** (`03_user_experience.md`)
4. **Implementation Guide** (`04_implementation_guide.md`)
5. **Capability Roadmap** (`05_gates_roadmap.md`)
6. **Data Intelligence** (`06_data_intelligence.md`)
7. **Operations Playbook** (`07_operations_playbook.md`)

Plus supporting materials: diagrams (`diagrams/*.mmd`), examples (`examples/*.json`), and partner integration references (`libs_docs/`).

---

## How to Use This Checklist

**For AI Agents:**
- Each section maps to a capability pillar or system layer
- Tasks include **prerequisites**, **verification steps**, **evidence artifacts**, and **cross-references**
- Mark tasks `[ ]` incomplete, `[WIP]` in progress, `[✓]` complete
- Use telemetry event names to verify implementation completeness
- Escalate blockers via `BLOCKER:` tags with context

**For Human Operators:**
- Review completed evidence artifacts in `docs/readiness/`
- Validate cross-links point to current documentation
- Update this checklist when roadmap milestones change

---

## I. GENERATIVE INTAKE & BRIEFING PILLAR

### Objective
Enable one-prompt mission creation with ≥80% acceptance rate, editable chips, and confidence signals.

### Prerequisites
- [ ] Review `01_product_vision.md` § Product Vision → Guiding Principles #1
- [ ] Review `02_system_overview.md` § Architectural Tenets #1
- [ ] Review `03_user_experience.md` § Eight-Stage Narrative Flow → Stage 1
- [ ] Review `04_implementation_guide.md` § 2. Frontend (Next.js + CopilotKit)

### Tasks

#### 1.1 Generative Intake Implementation
- [ ] Verify `MissionIntake` component exists at `src/components/MissionIntake.tsx`
  - **Evidence:** Component renders generative banner with sample prompt carousel
  - **Verification:** `pnpm test:ui` passes for intake component
  - **Cross-ref:** `03_user_experience.md:34` (Generative Intake Banner)

- [ ] Confirm `/api/intake/generate` endpoint operational
  - **Evidence:** API returns chips (objective, audience, KPIs, safeguards, timeline) in ≤3s p95
  - **Verification:** `curl -X POST /api/intake/generate -d '{"objective":"..."}' | jq .`
  - **Telemetry:** `intent_submitted`, `brief_generated` events logged
  - **Cross-ref:** `02_system_overview.md:275-284`, `04_implementation_guide.md:111`

- [ ] Validate chip editing controls (regenerate, edit, accept, discard)
  - **Evidence:** User can edit chips inline, regenerate single chip
  - **Verification:** Accessibility check with `Ctrl+Enter` to accept
  - **Telemetry:** `brief_item_modified` event logged
  - **Cross-ref:** `03_user_experience.md:96` (Accept/Edit Chips pattern)

#### 1.2 Confidence Badges & Scaffolding
- [ ] Implement confidence scoring (High · Medium · Needs Review)
  - **Evidence:** Tri-state badges with tooltip explaining rationale source
  - **Verification:** Inspect `mission_metadata.confidence` column
  - **Cross-ref:** `03_user_experience.md:97` (Confidence Badges)

- [ ] Enable chip acceptance → mission brief lock
  - **Evidence:** `MissionBriefCard` displays pinned brief with status badges
  - **Verification:** `mission_created` telemetry event fired
  - **Cross-ref:** `03_user_experience.md:57-60` (Mission Brief Commitment)

#### 1.3 Brief Revision Loop (Status: ⚠️ In Progress)
- [ ] Support brief reopening without losing downstream context
  - **Evidence:** Edit Brief button returns to stage 1, preserves toolkit selections
  - **Verification:** Test stage state persistence via `MissionStageProvider`
  - **Telemetry:** `mission_brief_reopened`, `mission_brief_diff_applied`
  - **Cross-ref:** `05_gates_roadmap.md:51-58` (Brief Revision Loop milestone)
  - **BLOCKER:** Planner diff resilience dependency (Owner: Frontend Platform)

#### 1.4 Evidence & Verification
- [ ] Generate readiness artifact: `docs/readiness/intake_acceptance_report.md`
  - **Contents:** Acceptance rate metrics, regeneration frequency, latency p95
  - **Cross-ref:** `05_gates_roadmap.md:46`

- [ ] Run telemetry audit for intake events
  - **Command:** `pnpm ts-node scripts/audit_telemetry_events.py --gate intake`
  - **Cross-ref:** `06_data_intelligence.md:67`

---

## II. CAPABILITY ORCHESTRATION PILLAR

### Objective
User-curated toolkit discovery, OAuth with scope transparency, and coverage validation ≥85%.

### Prerequisites
- [ ] Review `01_product_vision.md` § Strategic Differentiators #2
- [ ] Review `02_system_overview.md` § 3. Execution Layer (Composio + MCP)
- [ ] Review `libs_docs/composio/llms.txt` for discovery, auth, execution patterns
- [ ] Review `03_user_experience.md` § Mission Workspace Anatomy → Toolkit Canvas

### Tasks

#### 2.1 Toolkit Recommendations
- [ ] Verify `RecommendedToolStrip` component with auth badges
  - **Evidence:** Toolkit carousel displays no-auth first, OAuth-ready second
  - **Verification:** Component in `src/components/RecommendedToolkits.tsx`
  - **Cross-ref:** `03_user_experience.md:35`, `04_implementation_guide.md:54`

- [ ] Confirm `/api/toolkits/recommend` endpoint
  - **Evidence:** Returns ranked toolkit list with rationale, impact estimates in ≤1.5s p95
  - **Verification:** Query includes `missionId`, `persona`, `industry` params
  - **Telemetry:** `toolkit_recommendation_viewed`, `toolkit_selected`
  - **Cross-ref:** `02_system_overview.md:298-306`, `05_gates_roadmap.md:60-68`

- [ ] Validate Composio discovery integration
  - **Evidence:** Planner queries `Composio.tools.get(search, limit)` with persona filters
  - **Verification:** Check `agent/services/composio_service.py` discovery logic
  - **Cross-ref:** `02_system_overview.md:550-557`, `libs_docs/composio/llms.txt`

#### 2.2 OAuth Lite Activation (Status: ⚠️ In Progress)
- [ ] Implement Connect Link OAuth flow
  - **Evidence:** Side drawer displays scope previews with rollback instructions
  - **Verification:** `toolkits.authorize` generates session, `waitForConnection` polls
  - **Telemetry:** `connect_link_completed`, `connection_deferred`
  - **Cross-ref:** `05_gates_roadmap.md:69-76`, `02_system_overview.md:556-562`

- [ ] Validate scope transparency UI
  - **Evidence:** User sees required scopes before OAuth grant
  - **Verification:** `ScopeBadge` component renders scope list
  - **Cross-ref:** `03_user_experience.md:35`, `02_system_overview.md:71-78`
  - **BLOCKER:** Composio scope metadata dependency (Owner: Integrations)

- [ ] Store OAuth tokens encrypted
  - **Evidence:** Tokens in `oauth_tokens` table encrypted via Supabase vault
  - **Verification:** Check `supabase/migrations/0001_init.sql` schema
  - **Cross-ref:** `02_system_overview.md:1013-1014`, `07_operations_playbook.md:92`

#### 2.3 Data Inspection & Coverage Validation
- [ ] Implement `CoverageMeter` component with radial progress
  - **Evidence:** Segments for objectives, safeguards, plays, datasets with numeric thresholds
  - **Verification:** Component at `src/components/CoverageMeter.tsx`
  - **Cross-ref:** `03_user_experience.md:36`, `04_implementation_guide.md:55`

- [ ] Confirm `/api/inspect/preview` endpoint
  - **Evidence:** Read-only MCP calls validate dataset coverage in ≤10s p95
  - **Verification:** Inspection agent issues non-mutating tool calls
  - **Telemetry:** `inspection_preview_rendered`, `coverage_threshold_met`
  - **Cross-ref:** `02_system_overview.md:320-328`, `03_user_experience.md:67-71`

- [ ] Validate coverage meter threshold enforcement
  - **Evidence:** Stage 5 (Plan) blocked until coverage ≥85% or governance override
  - **Verification:** Test Coordinator agent stage guards in `agent/agents/coordinator.py`
  - **Cross-ref:** `02_system_overview.md:436`

#### 2.4 Evidence & Verification
- [ ] Generate readiness artifact: `docs/readiness/toolkit_recommendation_accuracy.md`
  - **Contents:** Top-3 ranking accuracy, rationale quality scores
  - **Cross-ref:** `05_gates_roadmap.md:63`

- [ ] Generate readiness artifact: `docs/readiness/oauth_scope_audit.md`
  - **Contents:** Scope coverage analysis, rollback plan validation
  - **Cross-ref:** `05_gates_roadmap.md:72`

---

## III. PLANNING & ADAPTIVE SAFEGUARDS PILLAR

### Objective
Hybrid play ranking (library + discovery), mission-specific safeguard hints, <200ms validator overhead.

### Prerequisites
- [ ] Review `01_product_vision.md` § Strategic Differentiators #3, #5
- [ ] Review `02_system_overview.md` § 3. Orchestration Layer (Gemini ADK) → Planner Agent
- [ ] Review `libs_docs/adk/llms-full.txt` for agent coordination patterns
- [ ] Review `diagrams/adaptive_safeguards_lifecycle.mmd`

### Tasks

#### 3.1 Planner Agent Implementation
- [ ] Verify Planner agent exists at `agent/agents/planner.py`
  - **Evidence:** CustomAgent with hybrid ranking (library retrieval + Composio discovery)
  - **Verification:** `mise run test-agent` passes planner eval suite
  - **Cross-ref:** `02_system_overview.md:455-468`, `04_implementation_guide.md:94`

- [ ] Confirm pgvector library query integration
  - **Evidence:** Planner queries Supabase `library_entries` with cosine ≥0.75
  - **Verification:** Check `library_entries.embedding` GiST index exists
  - **Telemetry:** `play_generated`, `play_selected`
  - **Cross-ref:** `02_system_overview.md:458-460`, `06_data_intelligence.md:120-125`

- [ ] Validate play rationale generation
  - **Evidence:** Play cards include "Why This?" citations with embedding match scores
  - **Verification:** `PlannerRail` component displays rationale tooltips
  - **Cross-ref:** `03_user_experience.md:38`, `02_system_overview.md:464-465`

- [ ] Ensure ≤2.5s p95 latency for 3 candidate generation
  - **Evidence:** Performance target met per `02_system_overview.md:467`
  - **Verification:** Load test `/api/plan/*` endpoints
  - **Cross-ref:** `02_system_overview.md:120` (Performance Targets table)

#### 3.2 Adaptive Safeguards System
- [ ] Implement safeguard hint generation during intake
  - **Evidence:** Mission-specific hints (tone, timing, budget, escalation) with confidence scores
  - **Verification:** `mission_safeguards` table populated on brief generation
  - **Cross-ref:** `02_system_overview.md:41-50`, `03_user_experience.md:98`

- [ ] Enable inline safeguard editing
  - **Evidence:** Safeguard drawer allows user edits, syncs to planner prompt
  - **Verification:** Edits update `mission_safeguards.status` and `updated_at`
  - **Telemetry:** `safeguard_edited`, `validator_override_requested`
  - **Cross-ref:** `03_user_experience.md:98`, `06_data_intelligence.md:105-110`

- [ ] Verify Validator agent enforces accepted hints
  - **Evidence:** Validator checks tone, timing, budget, escalation; produces auto_fix/ask_reviewer/retry
  - **Verification:** Test Validator at `agent/agents/validator.py`
  - **Cross-ref:** `02_system_overview.md:499-513`

- [ ] Ensure <200ms p95 validator overhead per tool call
  - **Evidence:** Performance target met per `02_system_overview.md:511`
  - **Verification:** Measure `validator_check` span duration
  - **Cross-ref:** `02_system_overview.md:119` (Performance Targets table)

#### 3.3 Safeguard Feedback Loop (Status: ❌ Not Started)
- [ ] Implement safeguard learning pipeline
  - **Evidence:** Feedback events cluster by theme (tone, budget, timing)
  - **Verification:** Planner prompt templates update based on edit patterns
  - **Telemetry:** Track reduction in manual edits over time
  - **Cross-ref:** `05_gates_roadmap.md:105-112`, `06_data_intelligence.md:112-118`
  - **BLOCKER:** Feedback drawer instrumentation (Owner: Planner Team)

#### 3.4 Evidence & Verification
- [ ] Generate readiness artifact: `docs/readiness/safeguard_learning_loop.md`
  - **Contents:** Edit frequency, auto-fix adoption rate, override patterns
  - **Cross-ref:** `05_gates_roadmap.md:108`

- [ ] Run ADK eval for planner ranking
  - **Command:** `mise run test-agent` (dry-run ranking suite)
  - **Target:** ≥90% pass rate for top-3 play ranking
  - **Cross-ref:** `02_system_overview.md:106`, `04_implementation_guide.md:86`

---

## IV. EXECUTION & EVIDENCE PILLAR

### Objective
Dry-run streaming <15min p95, undo plans for every mutating action, ≥95% rollback success.

### Prerequisites
- [ ] Review `01_product_vision.md` § Guiding Principles #5 (Radically Reversible)
- [ ] Review `02_system_overview.md` § Eight-Stage Mission Flow → Stages 6-7
- [ ] Review `diagrams/eight_stage_journey.mmd`
- [ ] Review `examples/mission_example_revenue.json` for dry-run artifacts

### Tasks

#### 4.1 Executor Agent & Dry-Run Streaming (Status: ⚠️ In Progress)
- [ ] Verify Executor agent at `agent/agents/executor.py`
  - **Evidence:** Supports dry-run (SIMULATION) and governed modes
  - **Verification:** Test executes via Composio SDK with `execution_mode` parameter
  - **Cross-ref:** `02_system_overview.md:484-497`, `04_implementation_guide.md:94`

- [ ] Confirm streaming status panel with <5s heartbeat
  - **Evidence:** `ExecutionPanel` component streams progress via SSE
  - **Verification:** Component at `src/components/ExecutionPanel.tsx`
  - **Telemetry:** `dry_run_started`, `dry_run_step_completed`, `dry_run_completed`
  - **Cross-ref:** `03_user_experience.md:39`, `02_system_overview.md:121`

- [ ] Validate ≤15 min p95 dry-run loop end-to-end
  - **Evidence:** Performance target met per `02_system_overview.md:118`
  - **Verification:** Load test full dry-run flow from intake to evidence
  - **Cross-ref:** `02_system_overview.md:64`, `05_gates_roadmap.md:78-86`
  - **BLOCKER:** Network instability mitigation (exponential backoff)

- [ ] Implement pause/resume controls
  - **Evidence:** User can pause execution mid-stream, resume later
  - **Verification:** UI displays pause button, state persists to Supabase
  - **Telemetry:** `dry_run_paused`
  - **Cross-ref:** `03_user_experience.md:78`, `04_implementation_guide.md:64`

#### 4.2 Undo Portfolio (Status: ❌ Not Started)
- [ ] Generate undo plans for every mutating action
  - **Evidence:** Validator creates undo tokens, stores in `tool_calls.undo_plan_json`
  - **Verification:** Check `undo_events` schema in `supabase/migrations/0001_init.sql`
  - **Cross-ref:** `05_gates_roadmap.md:87-94`, `02_system_overview.md:104`

- [ ] Implement `UndoBar` component with countdown timer
  - **Evidence:** Displays undo plan summary, impact summary, 15-minute countdown
  - **Verification:** Component at `src/components/UndoBar.tsx`
  - **Cross-ref:** `03_user_experience.md:41`, `02_system_overview.md:212`

- [ ] Confirm `/api/evidence/undo` endpoint
  - **Evidence:** Validates undo token expiry, executes rollback in <5s p95
  - **Verification:** Evidence service `execute_undo` function operational
  - **Telemetry:** `undo_requested`, `undo_completed`
  - **Cross-ref:** `02_system_overview.md:341-350`

- [ ] Ensure ≥95% undo success rate
  - **Evidence:** Target met per `02_system_overview.md:480`
  - **Verification:** Query `analytics_undo_success` view
  - **Cross-ref:** `05_gates_roadmap.md:183` (Metrics & Targets table)
  - **BLOCKER:** Supabase function `verify_undo` dependency (Owner: Trust Engineering)

#### 4.3 Evidence Agent & Artifact Gallery
- [ ] Verify Evidence agent at `agent/agents/evidence.py`
  - **Evidence:** Bundles mission brief, tool outputs, ROI summary with SHA-256 hashes
  - **Verification:** Bundle generation completes in <5s
  - **Cross-ref:** `02_system_overview.md:515-528`, `04_implementation_guide.md:95`

- [ ] Implement `EvidenceGallery` component
  - **Evidence:** Grid of artifacts with hash badges, status filters, export menu
  - **Verification:** Component at `src/components/EvidenceGallery.tsx`
  - **Cross-ref:** `03_user_experience.md:40`, `04_implementation_guide.md:57`

- [ ] Validate artifact storage with hash verification
  - **Evidence:** Artifacts stored in `evidence-artifacts` bucket with versioning
  - **Verification:** SHA-256 hash parity check on retrieval
  - **Cross-ref:** `02_system_overview.md:88-94`, `02_system_overview.md:645-648`

- [ ] Enable export to PDF/CSV for compliance
  - **Evidence:** Export menu generates compliance-ready reports
  - **Verification:** Test export via `/api/evidence/export`
  - **Cross-ref:** `01_product_vision.md:198`, `07_operations_playbook.md:94`

#### 4.4 Evidence & Verification
- [ ] Generate readiness artifact: `docs/readiness/dry_run_resilience.md`
  - **Contents:** Heartbeat latency, retry success, pause/resume testing
  - **Cross-ref:** `05_gates_roadmap.md:82`

- [ ] Generate readiness artifact: `docs/readiness/undo_efficacy.md`
  - **Contents:** Rollback success rate, coverage analysis, expiry handling
  - **Cross-ref:** `05_gates_roadmap.md:91`

---

## V. LEARNING & INTELLIGENCE PILLAR

### Objective
Library reuse ≥40%, telemetry coverage 100%, closed-loop feedback improving planner and safeguards.

### Prerequisites
- [ ] Review `01_product_vision.md` § Strategic Differentiators #5
- [ ] Review `06_data_intelligence.md` (entire document)
- [ ] Review `diagrams/library_learning_loop.mmd`
- [ ] Review `examples/telemetry_sample_traces.json`

### Tasks

#### 5.1 Library Reuse Signals (Status: ⚠️ In Progress)
- [ ] Verify library embeddings pipeline
  - **Evidence:** Successful missions stored in `library_entries` with pgvector embeddings
  - **Verification:** Supabase edge function `generate-embedding` operational
  - **Cross-ref:** `02_system_overview.md:653`, `06_data_intelligence.md:120-125`

- [ ] Confirm planner library retrieval integration
  - **Evidence:** Planner queries library with cosine similarity ≥0.75
  - **Verification:** Test ranking combines library precedent + Composio discovery
  - **Telemetry:** `library_play_recommended`, `library_play_activated`
  - **Cross-ref:** `05_gates_roadmap.md:97-104`, `06_data_intelligence.md:30-33`

- [ ] Validate library reuse rate ≥40%
  - **Evidence:** Metrics dashboard shows reuse rate per tenant
  - **Verification:** Query `analytics` view for library reuse
  - **Cross-ref:** `05_gates_roadmap.md:184` (Metrics & Targets table)
  - **BLOCKER:** Cold-start bias mitigation with curated playbooks

#### 5.2 Telemetry Event Coverage
- [ ] Audit all 37+ canonical telemetry events
  - **Evidence:** Event catalog in `scripts/audit_telemetry_events.py` up-to-date
  - **Verification:** Run `pnpm ts-node scripts/audit_telemetry_events.py --mode check`
  - **Cross-ref:** `06_data_intelligence.md:55-67`, `04_implementation_guide.md:155-162`

- [ ] Validate event schema compliance
  - **Evidence:** All events include mission_id, stage, actor, timestamp
  - **Verification:** Check `telemetry_events` table schema
  - **Cross-ref:** `03_user_experience.md:140-152` (Stage-to-Event Matrix)

- [ ] Implement PII redaction pipeline
  - **Evidence:** Telemetry scrubbed via `src/lib/telemetry/redaction.ts` helpers
  - **Verification:** Test redaction function with sample data
  - **Cross-ref:** `06_data_intelligence.md:130`, `07_operations_playbook.md:94`

#### 5.3 Analytics Dashboards
- [ ] Create Executive Dashboard (`views/executive_summary`)
  - **Evidence:** Displays weekly approved missions, conversion rates, pipeline impact
  - **Verification:** Dashboard accessible via Supabase Studio or Metabase
  - **Cross-ref:** `06_data_intelligence.md:73-77`, `02_system_overview.md:635-642`

- [ ] Create Governance Dashboard (`views/governance_insights`)
  - **Evidence:** Shows safeguard edits, overrides, undo success, incident frequency
  - **Verification:** Drill-down to mission timeline and evidence bundles
  - **Cross-ref:** `06_data_intelligence.md:78-83`, `01_product_vision.md:267-282`

- [ ] Create Operations Dashboard (`views/operations_health`)
  - **Evidence:** Latency percentiles, SSE heartbeat, Composio rate limits
  - **Verification:** Integrated with Datadog metrics overlay
  - **Cross-ref:** `06_data_intelligence.md:84-88`, `07_operations_playbook.md:48-56`

- [ ] Create Adoption Funnel Dashboard (`views/adoption_funnel`)
  - **Evidence:** Conversion funnel with persona segmentation
  - **Verification:** Tracks intake → brief → toolkit → activation
  - **Cross-ref:** `06_data_intelligence.md:89-91`, `01_product_vision.md:462-471`

#### 5.4 Feedback Loops
- [ ] Implement Generative Quality Loop
  - **Evidence:** Chip edit patterns update prompt templates
  - **Verification:** Acceptance rate trends toward ≥80% target
  - **Cross-ref:** `06_data_intelligence.md:98-104`

- [ ] Implement Planner Excellence Loop
  - **Evidence:** Rejections and overrides feed retrieval scoring
  - **Verification:** ADK eval pass rate improves over time
  - **Cross-ref:** `06_data_intelligence.md:106-111`

- [ ] Implement Safeguard Reinforcement Loop
  - **Evidence:** Validator outcomes cluster by theme, update generation prompts
  - **Verification:** Manual edit frequency decreases
  - **Cross-ref:** `06_data_intelligence.md:113-119`

- [ ] Implement Library Growth Loop
  - **Evidence:** Pinned artifacts embedded and boosted in future recommendations
  - **Verification:** Library reuse rate increases
  - **Cross-ref:** `06_data_intelligence.md:121-126`

#### 5.5 Evidence & Verification
- [ ] Generate readiness artifact: `docs/readiness/library_reuse_metrics.md`
  - **Contents:** Reuse rate trends, embedding quality, cold-start mitigations
  - **Cross-ref:** `05_gates_roadmap.md:100`

- [ ] Generate readiness artifact: `docs/readiness/observability_dashboard.md`
  - **Contents:** Dashboard screenshots, metric definitions, alert thresholds
  - **Cross-ref:** `05_gates_roadmap.md:118`

---

## VI. OPERATIONAL EXCELLENCE PILLAR

### Objective
≥99% mission success rate, <30min incident MTTR, SOC 2 readiness, complete runbook library.

### Prerequisites
- [ ] Review `07_operations_playbook.md` (entire document)
- [ ] Review `05_gates_roadmap.md` § E. Operational Excellence
- [ ] Review `diagrams/end_to_end_data_flow.mmd`

### Tasks

#### 6.1 Deployment & Environment Management
- [ ] Verify environment matrix (local, dev, staging, production)
  - **Evidence:** Each environment with proper secrets management
  - **Verification:** Check `.env` templates and vault configurations
  - **Cross-ref:** `07_operations_playbook.md:22-31`, `04_implementation_guide.md:180-185`

- [ ] Validate deployment workflows
  - **Evidence:** Frontend (Vercel/container), Agent (Fly.io/GKE), Supabase migrations
  - **Verification:** Test `scripts/deploy-agent.sh`, verify health checks
  - **Cross-ref:** `07_operations_playbook.md:36-44`, `04_implementation_guide.md:182-186`

- [ ] Ensure rollback plans documented
  - **Evidence:** Git revert, Supabase migration down scripts, agent rollback instructions
  - **Verification:** Test rollback in staging environment
  - **Cross-ref:** `07_operations_playbook.md:43`

#### 6.2 Monitoring & Alerting
- [ ] Configure metrics collection (Datadog or equivalent)
  - **Evidence:** Track mission.success_rate, planner.latency.p95, executor.heartbeat.latency
  - **Verification:** Dashboards display real-time metrics
  - **Cross-ref:** `07_operations_playbook.md:48-56`, `05_gates_roadmap.md:115-120`

- [ ] Set up structured logging (JSON to SIEM)
  - **Evidence:** Logs include mission_id, stage, actor, error_code
  - **Verification:** Log retention 30 days hot, 180 days cold
  - **Cross-ref:** `07_operations_playbook.md:57-61`

- [ ] Configure alert routing (PagerDuty)
  - **Evidence:** Critical alerts for success <97%, heartbeat >8s, undo failures >1%
  - **Verification:** Test alert escalation path
  - **Cross-ref:** `07_operations_playbook.md:62-68`

#### 6.3 Incident Response & Runbooks (Status: ❌ Not Started)
- [ ] Create runbook library at `docs/readiness/runbooks/`
  - **Evidence:** Runbooks for common incidents (heartbeat failure, OAuth expired, undo failure)
  - **Verification:** Each runbook includes command snippets, dashboards, fallbacks
  - **Cross-ref:** `05_gates_roadmap.md:122-130`, `07_operations_playbook.md:78-86`
  - **BLOCKER:** Incident Management owner assignment

- [ ] Document incident severity levels (SEV1, SEV2, SEV3)
  - **Evidence:** Clear definitions and response flows
  - **Verification:** Incident Commander role defined, communication templates ready
  - **Cross-ref:** `07_operations_playbook.md:73-86`

- [ ] Conduct incident drills (quarterly game days)
  - **Evidence:** Chaos experiments, rollback drills recorded
  - **Verification:** Store recordings and notes in knowledge base
  - **Cross-ref:** `07_operations_playbook.md:148`

#### 6.4 Security & Compliance
- [ ] Enforce access control (principle of least privilege)
  - **Evidence:** RLS policies on all Supabase tables
  - **Verification:** Test tenant isolation, scoped tokens
  - **Cross-ref:** `07_operations_playbook.md:92`, `02_system_overview.md:1008-1023`

- [ ] Implement audit trail logging
  - **Evidence:** Every mission action, safeguard edit, undo in `mission_events` table
  - **Verification:** Timestamped with actor ID, before/after state
  - **Cross-ref:** `07_operations_playbook.md:93`

- [ ] Encrypt data at rest and in transit
  - **Evidence:** OAuth tokens encrypted (Supabase vault), TLS 1.3 for all connections
  - **Verification:** Check encryption configurations
  - **Cross-ref:** `07_operations_playbook.md:94`, `02_system_overview.md:1018-1023`

- [ ] Run security checks before releases
  - **Evidence:** Static analysis (ESLint, Ruff, Bandit), dependency CVE scans
  - **Verification:** CI pipeline enforces checks
  - **Cross-ref:** `07_operations_playbook.md:98-103`

- [ ] Prepare SOC 2 Type II compliance artifacts
  - **Evidence:** Evidence bundles, audit trails, data export tools
  - **Verification:** Compliance review scheduled Q2 2026
  - **Cross-ref:** `01_product_vision.md:392`, `07_operations_playbook.md:95`

#### 6.5 Maintenance Operations
- [ ] Schedule Supabase nightly backups + weekly restore verification
  - **Evidence:** Backups automated, restore tested
  - **Verification:** Check backup logs
  - **Cross-ref:** `07_operations_playbook.md:108`

- [ ] Implement library embeddings refresh (weekly)
  - **Evidence:** Re-embedding job completes, metrics validated before/after
  - **Verification:** Monitor embedding quality
  - **Cross-ref:** `07_operations_playbook.md:109`

- [ ] Set up telemetry vacuum (purge expired events)
  - **Evidence:** Scheduled job removes raw events after 180 days
  - **Verification:** Retention policy enforced
  - **Cross-ref:** `07_operations_playbook.md:110`

- [ ] Schedule Composio sync (weekly toolkit metadata refresh)
  - **Evidence:** New toolkits discovered and cataloged
  - **Verification:** Check `catalog_snapshot` pg_cron job
  - **Cross-ref:** `07_operations_playbook.md:111`, `02_system_overview.md:657`

#### 6.6 Evidence & Verification
- [ ] Generate readiness artifact: `docs/readiness/runbook_validation.md`
  - **Contents:** Runbook completeness checklist, drill results
  - **Cross-ref:** `05_gates_roadmap.md:126`

- [ ] Publish operational scorecard (monthly)
  - **Evidence:** Success rate, incident MTTR, library reuse, latency trends
  - **Verification:** Shared with stakeholders
  - **Cross-ref:** `07_operations_playbook.md:151`

---

## VII. USER EXPERIENCE & ACCESSIBILITY PILLAR

### Objective
WCAG 2.1 AA compliance, keyboard-first flows, ≤150ms stage transitions, Storybook coverage.

### Prerequisites
- [ ] Review `03_user_experience.md` (entire document)
- [ ] Review `04_implementation_guide.md` § 2. Frontend (Next.js + CopilotKit)
- [ ] Review `diagrams/eight_stage_journey.mmd`

### Tasks

#### 7.1 Component Implementation
- [ ] Build all mission workspace components per spec
  - **Evidence:** Components in `src/components/` match `03_user_experience.md:32-43`
  - **Verification:** Storybook stories at `stories/mission-workspace/*.stories.tsx`
  - **Cross-ref:** `04_implementation_guide.md:50-61`

- [ ] Implement MissionStageProvider with eight-stage state machine
  - **Evidence:** Single React tree with shared CopilotKit context
  - **Verification:** No route transitions, state persists across stages
  - **Cross-ref:** `02_system_overview.md:214`, `03_user_experience.md:49-92`

- [ ] Validate stage transition performance ≤150ms
  - **Evidence:** Stage changes are instant, no full-screen reloads
  - **Verification:** Measure with browser profiler
  - **Cross-ref:** `03_user_experience.md:125`

#### 7.2 Accessibility Compliance
- [ ] Ensure semantic landmarks frame layout
  - **Evidence:** `<main>`, `<aside>`, `<nav>` tags used correctly
  - **Verification:** Automated axe scan passes
  - **Cross-ref:** `03_user_experience.md:110`

- [ ] Implement keyboard-first navigation
  - **Evidence:** Tab, Enter, Space, Esc, Arrow keys functional
  - **Verification:** Test all flows without mouse
  - **Cross-ref:** `03_user_experience.md:248`

- [ ] Add screen reader support
  - **Evidence:** Live regions with `role="status"`, `aria-live`
  - **Verification:** Test with NVDA/JAWS/VoiceOver
  - **Cross-ref:** `03_user_experience.md:249`

- [ ] Validate focus indicators (2px outline, 4.5:1 contrast)
  - **Evidence:** All interactive elements have visible focus
  - **Verification:** Manual and automated contrast checks
  - **Cross-ref:** `03_user_experience.md:250`

- [ ] Implement motion-reduced mode
  - **Evidence:** Disables animated gradients, streaming shimmer
  - **Verification:** Test with `prefers-reduced-motion`
  - **Cross-ref:** `03_user_experience.md:114`

#### 7.3 Interaction Patterns
- [ ] Implement Accept/Edit Chips pattern
  - **Evidence:** Hover reveals Regenerate, Convert to Note
  - **Verification:** Multiline editing, mention syntax functional
  - **Cross-ref:** `03_user_experience.md:96`

- [ ] Implement Approval Modal pattern
  - **Evidence:** Summarizes activation, scopes, undo plan, contact routes
  - **Verification:** Modal supports keyboard nav, focus return
  - **Cross-ref:** `03_user_experience.md:99`

- [ ] Implement Streaming Logs expandable drawer
  - **Evidence:** Raw reasoning, tool inputs/outputs for debugging
  - **Verification:** Expandable drawer with copy-to-clipboard
  - **Cross-ref:** `03_user_experience.md:100`

- [ ] Implement Pin to Library pattern
  - **Evidence:** One-click artifact tagging for reuse
  - **Verification:** Artifact appears in library with tags
  - **Cross-ref:** `03_user_experience.md:101`

#### 7.4 Telemetry Verification
- [ ] Confirm all interaction events emit telemetry
  - **Evidence:** Stage-to-Event Matrix fully instrumented
  - **Verification:** Run `scripts/audit_telemetry_events.py --gate ux`
  - **Cross-ref:** `03_user_experience.md:140-152`

#### 7.5 Evidence & Verification
- [ ] Run accessibility audit suite
  - **Command:** `pnpm run test:a11y` (axe CLI)
  - **Target:** Zero critical violations
  - **Cross-ref:** `03_user_experience.md:123`, `04_implementation_guide.md:170`

- [ ] Conduct usability validation with primary personas
  - **Evidence:** Stage-focused studies (Intake, Planning, Evidence) monthly
  - **Verification:** Document findings, create backlog items
  - **Cross-ref:** `03_user_experience.md:122`

---

## VIII. PARTNER INTEGRATION PILLAR

### Objective
Deep integration with Composio (toolkits), CopilotKit (UX), ADK (orchestration), Supabase (data).

### Prerequisites
- [ ] Review `01_product_vision.md` § Strategic Partnerships
- [ ] Review `diagrams/partner_integration_map.mmd`
- [ ] Review `libs_docs/composio/llms.txt`
- [ ] Review `libs_docs/copilotkit/llms-full.txt`
- [ ] Review `libs_docs/adk/llms-full.txt`
- [ ] Review `libs_docs/supabase/llms_docs.txt`

### Tasks

#### 8.1 Composio Integration
- [ ] Verify discovery API integration (`Composio.tools.get`)
  - **Evidence:** Semantic search with persona filters operational
  - **Verification:** Test in `agent/tools/composio_client.py`
  - **Cross-ref:** `02_system_overview.md:550-557`, `libs_docs/composio/llms.txt`

- [ ] Validate Connect Link OAuth flow
  - **Evidence:** `toolkits.authorize`, `waitForConnection` functional
  - **Verification:** Test OAuth completion and token storage
  - **Cross-ref:** `02_system_overview.md:556-562`

- [ ] Confirm execution modes (SIMULATION, real)
  - **Evidence:** Executor switches modes based on dry-run vs. governed
  - **Verification:** Test both modes in `agent/agents/executor.py`
  - **Cross-ref:** `02_system_overview.md:564-568`

- [ ] Implement trigger lifecycle management
  - **Evidence:** `create_trigger`, `subscribe_trigger`, `disable_trigger` operational
  - **Verification:** Test trigger registration and webhook delivery
  - **Cross-ref:** `02_system_overview.md:569-575`

- [ ] Handle error cases (429, 401/403, zero results)
  - **Evidence:** Exponential backoff, re-auth prompts, library-only fallback
  - **Verification:** Test error handling paths
  - **Cross-ref:** `02_system_overview.md:576-582`, `02_system_overview.md:876-882`

#### 8.2 CopilotKit Integration
- [ ] Implement shared state via `useCopilotReadable`
  - **Evidence:** Mission brief, toolkits, safeguards shared across agents
  - **Verification:** Test state persistence in components
  - **Cross-ref:** `02_system_overview.md:238-243`, `libs_docs/copilotkit/llms-full.txt`

- [ ] Implement frontend actions via `useCopilotAction`
  - **Evidence:** Chip edits, play selection, approvals handled
  - **Verification:** Test action invocation
  - **Cross-ref:** `02_system_overview.md:240`

- [ ] Implement streaming via `copilotkit_emit_message`
  - **Evidence:** Planner rationale, execution progress streamed
  - **Verification:** Test SSE delivery to UI
  - **Cross-ref:** `02_system_overview.md:241`

- [ ] Implement interrupts via `CopilotInterrupt`
  - **Evidence:** Safeguard checkpoints pause execution for user review
  - **Verification:** Test approval modal triggers
  - **Cross-ref:** `02_system_overview.md:242`

- [ ] Implement session recovery
  - **Evidence:** Disconnects preserve context, reconnects replay messages
  - **Verification:** Test disconnect/reconnect flows
  - **Cross-ref:** `02_system_overview.md:900-905`

#### 8.3 Gemini ADK Integration
- [ ] Verify agent coordination patterns (SequentialAgent, CustomAgent)
  - **Evidence:** Coordinator, Planner, Executor, Validator, Evidence agents operational
  - **Verification:** Test agent handoffs
  - **Cross-ref:** `02_system_overview.md:384-528`, `libs_docs/adk/llms-full.txt`

- [ ] Implement session state management (`ctx.session.state`)
  - **Evidence:** Mission context, agent progress, pending interrupts persisted
  - **Verification:** Test state persistence across agent transitions
  - **Cross-ref:** `02_system_overview.md:918-925`

- [ ] Run ADK evaluation suites
  - **Evidence:** Eval suites at `agent/evals/control_plane/*.json`
  - **Verification:** `mise run test-agent` passes ≥90%
  - **Cross-ref:** `02_system_overview.md:927-932`

#### 8.4 Supabase Integration
- [ ] Verify schema migration applied (`0001_init.sql`)
  - **Evidence:** All tables, views, policies, functions exist
  - **Verification:** Run `supabase db reset` and verify
  - **Cross-ref:** `04_implementation_guide.md:141-152`, `libs_docs/supabase/llms_docs.txt`

- [ ] Validate RLS policies enforce tenant isolation
  - **Evidence:** All tables have RLS via `auth.uid()`
  - **Verification:** Test cross-tenant access denied
  - **Cross-ref:** `02_system_overview.md:664-668`, `07_operations_playbook.md:92`

- [ ] Confirm edge functions operational
  - **Evidence:** `generate-embedding`, `catalog-sync`, `narrative-summariser`
  - **Verification:** Test function invocation
  - **Cross-ref:** `02_system_overview.md:650-655`

- [ ] Validate pg_cron jobs scheduled
  - **Evidence:** Nightly rollups, health checks, retention enforcement
  - **Verification:** Check cron job status
  - **Cross-ref:** `02_system_overview.md:656-662`

- [ ] Test evidence artifact storage with versioning
  - **Evidence:** `evidence-artifacts` bucket with signed URLs
  - **Verification:** Upload, retrieve, verify hash
  - **Cross-ref:** `02_system_overview.md:645-648`

#### 8.5 Evidence & Verification
- [ ] Document partner integration versions
  - **Evidence:** Lock file versions for Composio SDK, CopilotKit, ADK, Supabase client
  - **Verification:** Quarterly review with partner roadmap sync
  - **Cross-ref:** `05_gates_roadmap.md:196`

- [ ] Schedule quarterly partner alignment meetings
  - **Evidence:** Shared roadmap, co-marketing commitments, SLA monitoring
  - **Verification:** Meeting notes stored, action items tracked
  - **Cross-ref:** `01_product_vision.md:600-606`, `05_gates_roadmap.md:196`

---

## IX. TESTING & QUALITY ASSURANCE PILLAR

### Objective
100% test coverage for critical paths, CI/CD gates enforced, performance benchmarks met.

### Prerequisites
- [ ] Review `04_implementation_guide.md` § 8. Testing Strategy
- [ ] Review `05_gates_roadmap.md` § 4. Dependency Graph
- [ ] Review CI/CD pipeline spec in `02_system_overview.md:1068-1076`

### Tasks

#### 9.1 Frontend Testing
- [ ] Run unit tests with Vitest + Testing Library
  - **Evidence:** All components have unit tests
  - **Command:** `pnpm test:ui`
  - **Cross-ref:** `04_implementation_guide.md:167`

- [ ] Run integration tests with Playwright
  - **Evidence:** E2E flows for all eight stages tested
  - **Command:** `pnpm test:e2e`
  - **Cross-ref:** `04_implementation_guide.md:169`

- [ ] Run accessibility tests with axe
  - **Evidence:** Zero critical violations
  - **Command:** `pnpm run test:a11y`
  - **Cross-ref:** `04_implementation_guide.md:170`

#### 9.2 Agent Testing
- [ ] Run ADK eval suites
  - **Evidence:** Smoke tests, dry-run ranking, validator negatives
  - **Command:** `mise run test-agent`
  - **Target:** ≥90% pass rate
  - **Cross-ref:** `04_implementation_guide.md:86`, `02_system_overview.md:529-535`

- [ ] Run pytest unit tests
  - **Evidence:** Agent logic, services, tools tested
  - **Command:** `uv run --with-requirements agent/requirements.txt pytest agent/tests`
  - **Cross-ref:** `04_implementation_guide.md:87`

#### 9.3 API Testing
- [ ] Run Supertest integration tests
  - **Evidence:** All API routes tested (intake, toolkits, missions, evidence)
  - **Command:** `pnpm test:api`
  - **Cross-ref:** `04_implementation_guide.md:125`, `04_implementation_guide.md:171`

#### 9.4 Performance Testing
- [ ] Run Lighthouse performance audit
  - **Evidence:** Accessibility, performance, best practices scores ≥90
  - **Command:** `pnpm run test:perf`
  - **Cross-ref:** `04_implementation_guide.md:174`

- [ ] Run k6 load tests
  - **Evidence:** API latency p95 ≤300ms, streaming heartbeat ≤5s
  - **Verification:** Load test scripts in `scripts/performance/`
  - **Cross-ref:** `02_system_overview.md:113-124`, `07_operations_playbook.md:14`

#### 9.5 CI/CD Gates
- [ ] Enforce lint and type check
  - **Command:** `mise run lint`, `pnpm tsc --noEmit`
  - **Cross-ref:** `02_system_overview.md:1069`

- [ ] Enforce telemetry audit
  - **Command:** `scripts/audit_telemetry_events.py --gate unified`
  - **Cross-ref:** `02_system_overview.md:1072`, `04_implementation_guide.md:161`

- [ ] Enforce evidence collection
  - **Evidence:** Readiness artifacts exported to `docs/readiness/`
  - **Verification:** CI checks artifacts exist and are updated
  - **Cross-ref:** `02_system_overview.md:1076`, `05_gates_roadmap.md:160-165`

#### 9.6 Evidence & Verification
- [ ] Maintain test coverage report
  - **Evidence:** Coverage ≥80% for frontend, ≥90% for agent
  - **Verification:** Generate coverage with `pnpm run coverage`, `pytest --cov`
  - **Cross-ref:** `04_implementation_guide.md:166-175`

---

## X. DOCUMENTATION & COMMUNICATION PILLAR

### Objective
Documentation synced with implementation, stakeholder communication plan active, weekly digest.

### Prerequisites
- [ ] Review `05_gates_roadmap.md` § 8. Communication Plan
- [ ] Review `07_operations_playbook.md` § 10. Documentation & Training

### Tasks

#### 10.1 Documentation Maintenance
- [ ] Keep `supernew_docs/` synced with operational truths
  - **Evidence:** Quarterly review confirms accuracy
  - **Verification:** Track last updated dates
  - **Cross-ref:** `07_operations_playbook.md:140`

- [ ] Update diagrams when architecture changes
  - **Evidence:** Mermaid diagrams in `diagrams/` reflect current state
  - **Verification:** Render diagrams and validate
  - **Cross-ref:** `supernew_docs/diagrams/`

- [ ] Maintain examples with realistic data
  - **Evidence:** `examples/*.json` files have current schema
  - **Verification:** Validate JSON against API contracts
  - **Cross-ref:** `supernew_docs/examples/`

#### 10.2 Stakeholder Communication
- [ ] Publish weekly digest
  - **Evidence:** Summary of milestone status and risks
  - **Verification:** Email or Slack post sent weekly
  - **Cross-ref:** `05_gates_roadmap.md:193`

- [ ] Host monthly webinar for stakeholders
  - **Evidence:** Business impact highlights presented
  - **Verification:** Recorded and shared
  - **Cross-ref:** `05_gates_roadmap.md:194`

- [ ] Maintain internal wiki page
  - **Evidence:** Links to most recent roadmap snapshot
  - **Verification:** Updated bi-weekly
  - **Cross-ref:** `05_gates_roadmap.md:195`

#### 10.3 Training & Onboarding
- [ ] Record incident drills
  - **Evidence:** Recordings and notes in knowledge base
  - **Verification:** Accessible to on-call team
  - **Cross-ref:** `07_operations_playbook.md:141`

- [ ] Onboard new operators via shadow program
  - **Evidence:** Certification checklist completed
  - **Verification:** Track onboarding completion
  - **Cross-ref:** `07_operations_playbook.md:142`

#### 10.4 Evidence & Verification
- [ ] Maintain evidence artifact index
  - **Evidence:** Spreadsheet tracks owner, last updated, validation status
  - **Verification:** Monthly review ensures artifacts fresh
  - **Cross-ref:** `05_gates_roadmap.md:162`

---

## XI. CROSS-CUTTING READINESS CHECKS

### Final Validation Before Production Release

#### 11.1 Performance Targets Met
- [ ] Generative intake ≤3s p95
- [ ] Chip regeneration ≤2s p95
- [ ] Toolkit recommendation ≤1.5s p95
- [ ] Planner ranking ≤2.5s p95
- [ ] Validator overhead <200ms p95
- [ ] Dry-run loop ≤15 min p95
- [ ] Streaming heartbeat <5s
- [ ] Undo execution <5s p95
- [ ] Evidence bundle gen <5s
- **Cross-ref:** `02_system_overview.md:113-124`, `02_system_overview.md:963-975`

#### 11.2 Quality Metrics Met
- [ ] Generative acceptance rate ≥80%
- [ ] Safeguard auto-fix adoption ≥75%
- [ ] Undo success rate ≥95%
- [ ] Approval throughput ≥85% within 2 min
- [ ] Governance feedback closure <24h
- **Cross-ref:** `01_product_vision.md:475-483`

#### 11.3 Business Impact Metrics Baseline
- [ ] Pipeline attributed to agent actions (Revenue persona)
- [ ] Response time reduction (Support persona)
- [ ] Manual task hours saved (Operations persona)
- [ ] Board prep time reduction (Executive persona)
- **Cross-ref:** `01_product_vision.md:486-494`

#### 11.4 Security & Compliance Checklist
- [ ] All Supabase RLS policies active
- [ ] OAuth tokens encrypted at rest
- [ ] PII redaction enforced
- [ ] Audit logs capturing all actions
- [ ] Evidence bundles tamper-proof (SHA-256)
- [ ] SOC 2 prep artifacts ready
- **Cross-ref:** `07_operations_playbook.md:91-97`, `02_system_overview.md:1007-1033`

#### 11.5 Partner Integration Validation
- [ ] Composio SDK version locked, integration tested
- [ ] CopilotKit session recovery tested
- [ ] ADK eval pass rate ≥90%
- [ ] Supabase migrations applied, types generated
- **Cross-ref:** `01_product_vision.md:498-564`

---

## XII. CONTINUOUS IMPROVEMENT & ITERATION

### Post-Launch Learning

#### 12.1 Feedback Collection
- [ ] Monitor feedback drawer submissions weekly
  - **Evidence:** UX team triages, high-impact insights → backlog
  - **Cross-ref:** `03_user_experience.md:126`

- [ ] Quarterly metric review
  - **Evidence:** Latency, success rate, override spike analysis
  - **Cross-ref:** `07_operations_playbook.md:149`

#### 12.2 Future Enhancements
- [ ] Track research experiments in `docs/research/`
  - **Evidence:** Narrative Intelligence, Multi-Agent Collaboration, Advanced Triggers
  - **Cross-ref:** `02_system_overview.md:1126-1150`, `05_gates_roadmap.md:201-208`

- [ ] Evaluate marketplace integrations
  - **Evidence:** Community toolkit submissions with review workflows
  - **Cross-ref:** `05_gates_roadmap.md:203`

---

## Appendix: Quick Reference

### Key Documentation Cross-Links
- **Product Vision:** `supernew_docs/01_product_vision.md`
- **System Overview:** `supernew_docs/02_system_overview.md`
- **UX Blueprint:** `supernew_docs/03_user_experience.md`
- **Implementation Guide:** `supernew_docs/04_implementation_guide.md`
- **Capability Roadmap:** `supernew_docs/05_gates_roadmap.md`
- **Data Intelligence:** `supernew_docs/06_data_intelligence.md`
- **Operations Playbook:** `supernew_docs/07_operations_playbook.md`

### Partner Integration References
- **CopilotKit:** `libs_docs/copilotkit/llms-full.txt`
- **Composio:** `libs_docs/composio/llms.txt`
- **Gemini ADK:** `libs_docs/adk/llms-full.txt`
- **Supabase:** `libs_docs/supabase/llms_docs.txt`

### Diagrams
- **Eight-Stage Journey:** `diagrams/eight_stage_journey.mmd`
- **Adaptive Safeguards Lifecycle:** `diagrams/adaptive_safeguards_lifecycle.mmd`
- **End-to-End Data Flow:** `diagrams/end_to_end_data_flow.mmd`
- **Library Learning Loop:** `diagrams/library_learning_loop.mmd`
- **Partner Integration Map:** `diagrams/partner_integration_map.mmd`

### Examples
- **Revenue Mission:** `examples/mission_example_revenue.json`
- **Support Mission:** `examples/mission_example_support.json`
- **Governance Mission:** `examples/mission_example_governance.json`
- **Telemetry Traces:** `examples/telemetry_sample_traces.json`

### Toolchain Commands
- **Start development:** `mise run dev`
- **Run frontend tests:** `pnpm test:ui`
- **Run agent tests:** `mise run test-agent`
- **Run API tests:** `pnpm test:api`
- **Run lint:** `mise run lint`
- **Audit telemetry:** `pnpm ts-node scripts/audit_telemetry_events.py --gate unified`
- **Deploy agent:** `scripts/deploy-agent.sh`
- **Generate Supabase types:** `supabase gen types typescript --linked > supabase/types.ts`

---

## Status Legend

- `[ ]` — Not started
- `[WIP]` — Work in progress (link to PR or issue)
- `[✓]` — Complete (link to evidence artifact)
- `[BLOCKER]` — Blocked (describe blocker, tag owner)

---

**Document Owner:** AI Agent Operations Team
**Last Updated:** October 2025
**Next Review:** Monthly (align with capability roadmap review)
**Feedback:** Submit issues to `docs/readiness/feedback/` or tag `@ai-agent-team`
