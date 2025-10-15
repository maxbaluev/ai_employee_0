# AI Employee Control Plane: Actionable Next Steps

**Version:** 2.0 (October 2025)
**Audience:** AI Agents, Development Teams, Project Managers
**Purpose:** Track immediate priorities and next actionable tasks
**Status:** Living document — updated as work progresses

---

## How to Use This Document

This todo list provides **actionable next steps** for building and improving the AI Employee Control Plane. It complements the comprehensive documentation suite without duplicating content.

**For AI Agents:**
- Focus on tasks marked `[ ]` (not started) or `[WIP]` (in progress)
- Reference linked documentation for implementation details
- Mark tasks `[✓]` when complete and add completion notes
- Escalate blockers with `BLOCKER:` tags

**For Human Teams:**
- Review weekly to align priorities
- Update based on roadmap changes
- Archive completed tasks monthly
- Use as input for sprint planning

---

## Quick Links to Documentation

- **[Documentation Guide](./00_README.md)** — Navigate all docs
- **[Getting Started](./08_getting_started.md)** — Setup environment
- **[Capability Roadmap](./05_capability_roadmap.md)** — Milestone plan
- **[Implementation Guide](./04_implementation_guide.md)** — Technical details
- **[Release Readiness](./09_release_readiness.md)** — Launch criteria
- **[AGENTS.md](../AGENTS.md)** — AI agent quick reference

---

## Current Priorities (October 2025)

### Foundation Milestone — Core Infrastructure

#### 1. Generative Intake Excellence

**Objective:** Achieve ≥80% chip acceptance rate without regeneration

- [ ] **Optimize intake prompts for persona specificity**
  - Review chip acceptance telemetry (`brief_item_modified` events)
  - Identify common regeneration patterns
  - Update prompts in `agent/agents/intake_agent.py`
  - **Reference:** [Implementation Guide](./04_implementation_guide.md) § Backend Agents
  - **Evidence:** `docs/readiness/intake_acceptance_report.md`

- [ ] **Implement confidence score calibration**
  - Add confidence threshold tuning based on historical accuracy
  - Display confidence rationale in UI tooltips
  - **Reference:** [User Experience Blueprint](./03_user_experience.md) § Interaction Patterns

- [WIP] **Add sample prompt carousel to intake banner**
  - Curate 5-7 templates per persona (Revenue, Support, Operations)
  - Implement carousel UI component
  - **Reference:** [Getting Started](./08_getting_started.md) § First Mission Walkthrough
  - **Owner:** Frontend team

#### 2. Inspection Loop Optimization

**Objective:** Maintain ≤15 min p95 execution completion time

- [ ] **Optimize SSE heartbeat reliability**
  - Add exponential backoff for network instability
  - Implement client-side reconnection logic
  - Test with simulated network interruptions
  - **Reference:** [System Overview](./02_system_overview.md) § Streaming Status Panel
  - **Evidence:** `docs/readiness/inspection_resilience.md`

- [ ] **Improve executor performance**
  - Profile Composio SDK call latencies
  - Implement parallel execution where safe
  - **Reference:** [System Overview](./02_system_overview.md) § Executor Agent

- [ ] **Enhance execution streaming visibility**
  - Add per-step progress indicators
  - Show validator feedback in real-time
  - **Reference:** [User Experience Blueprint](./03_user_experience.md) § Streaming Status Panel

#### 3. Evidence & Artifact Quality

**Objective:** Generate complete, tamper-proof evidence bundles

- [ ] **Validate hash verification end-to-end**
  - Test SHA-256 hash generation and verification
  - Ensure hash display in artifact gallery
  - **Reference:** [System Overview](./02_system_overview.md) § Evidence Agent

- [✓] **Implement artifact export (PDF/CSV)** — Completed Oct 15
  - Export menu functional in evidence gallery
  - Compliance-ready formatting validated

- [ ] **Add artifact versioning**
  - Support multiple versions of same artifact
  - Display version history in gallery
  - **Reference:** [Data Intelligence](./06_data_intelligence.md) § Analytics Views

### Core Milestone — Governed Execution & Learning

#### 4. OAuth Lite Activation

**Objective:** ≥65% toolkit connection completion rate

- [ ] **Implement Connect Link OAuth flow**
  - Integrate Composio Connect Link side drawer
  - Display scope previews before grant
  - Handle OAuth callback and token storage
  - **Reference:** [System Overview](./02_system_overview.md) § Composio Integration
  - **Evidence:** `docs/readiness/oauth_scope_audit.md`
  - **BLOCKER:** Composio scope metadata dependency

- [ ] **Build OAuth token management**
  - Encrypted storage in `oauth_tokens` table
  - Token rotation and expiry handling
  - **Reference:** [Operations Playbook](./07_operations_playbook.md) § Security & Compliance

- [ ] **Add connection status indicators**
  - Real-time OAuth connection health
  - Re-auth prompts when tokens expire
  - **Reference:** [User Experience Blueprint](./03_user_experience.md) § Toolkit Canvas

#### 5. Adaptive Safeguards Feedback Loop

**Objective:** ≥75% auto-fix adoption, reduce manual edits over time

- [ ] **Implement safeguard learning pipeline**
  - Capture safeguard edits from feedback drawer
  - Cluster edits by theme (tone, timing, budget)
  - Update planner prompt templates based on patterns
  - **Reference:** [Capability Roadmap](./05_capability_roadmap.md) § Adaptive Safeguards Loop
  - **Evidence:** `docs/readiness/safeguard_learning_loop.md`
  - **BLOCKER:** Feedback drawer instrumentation incomplete

- [ ] **Build safeguard feedback analytics**
  - Dashboard showing edit frequency by type
  - Auto-fix adoption rates
  - **Reference:** [Data Intelligence](./06_data_intelligence.md) § Governance Dashboard

#### 6. Library Reuse Signals

**Objective:** ≥40% library reuse rate (3 plays/tenant/month)

- [ ] **Implement library embeddings refresh**
  - Weekly re-embedding job for successful missions
  - pgvector GiST index optimization
  - **Reference:** [System Overview](./02_system_overview.md) § Data Layer
  - **Evidence:** `docs/readiness/library_reuse_metrics.md`

- [ ] **Build "Pin to Library" functionality**
  - One-click artifact tagging from evidence gallery
  - Tag management and search
  - **Reference:** [User Experience Blueprint](./03_user_experience.md) § Interaction Patterns

- [ ] **Enhance planner library retrieval**
  - Combine library precedent with Composio discovery
  - Display embedding match scores in rationale
  - **Reference:** [System Overview](./02_system_overview.md) § Planner Agent

### Scale Milestone — Operational Excellence

#### 7. Unified Observability

**Objective:** Single dashboard for latency, success rates, incidents

- [ ] **Configure Datadog dashboards**
  - Metrics: mission success rate, planner latency, executor heartbeat
  - Alerts: Critical thresholds with escalation paths
  - **Reference:** [Operations Playbook](./07_operations_playbook.md) § Monitoring & Alerting
  - **Evidence:** `docs/readiness/observability_dashboard.md`

- [ ] **Build analytics views**
  - Executive, Governance, Operations dashboards
  - Nightly refresh via pg_cron
  - **Reference:** [Data Intelligence](./06_data_intelligence.md) § Analytics Views

#### 8. Runbook Library

**Objective:** Complete incident playbooks for common scenarios

- [ ] **Create core runbooks**
  - Heartbeat failure recovery
  - OAuth token rotation
  - Undo failure handling
  - Rate limit mitigation
  - **Reference:** [Operations Playbook](./07_operations_playbook.md) § Incident Response
  - **Evidence:** `docs/readiness/runbook_validation.md`
  - **BLOCKER:** Incident Management owner assignment

- [ ] **Conduct incident drills**
  - Quarterly game days with chaos experiments
  - Document learnings and update runbooks
  - **Reference:** [Operations Playbook](./07_operations_playbook.md) § Continuous Improvement

### Cross-Cutting Tasks

#### 9. Testing & Quality

- [ ] **Achieve test coverage targets**
  - Frontend: ≥80% coverage (currently ~65%)
  - Agent: ≥90% coverage (currently ~85%)
  - **Reference:** [Implementation Guide](./04_implementation_guide.md) § Testing Strategy

- [ ] **Run ADK eval suites**
  - Target: ≥90% pass rate
  - Focus on execution ranking, validator negatives
  - **Reference:** [System Overview](./02_system_overview.md) § ADK Evaluation

- [ ] **Accessibility compliance**
  - Zero critical violations from axe audit
  - Manual screen reader testing
  - **Reference:** [User Experience Blueprint](./03_user_experience.md) § Accessibility Compliance

#### 10. Documentation & Readiness

- [✓] **Complete unified documentation overhaul** — Completed Oct 2025
  - Removed gate terminology across all docs
  - Created navigation guide (00_README.md)
  - Added Getting Started guide
  - Added Release Readiness guide

- [ ] **Generate missing evidence artifacts**
  - `intake_acceptance_report.md`
  - `inspection_resilience.md`
  - `oauth_scope_audit.md`
  - `library_reuse_metrics.md`
  - `observability_dashboard.md`
  - `runbook_validation.md`
  - **Reference:** [Release Readiness](./09_release_readiness.md) § Evidence Artifact Repository

- [ ] **Update AGENTS.md**
  - Align with new documentation layout
  - Reference docs/00_README.md for navigation
  - Simplify troubleshooting cheatsheet

---

## Blockers & Dependencies

### Active Blockers

| Blocker | Impact | Owner | Mitigation |
|---------|--------|-------|------------|
| Composio scope metadata incomplete | OAuth Lite Activation delayed | Integrations Team | Use manual scope config, sync with Composio weekly |
| Feedback drawer instrumentation missing | Safeguard learning loop blocked | Frontend Platform | Implement basic tracking, enhance later |
| Incident Management owner unassigned | Runbook library incomplete | Operations Lead | Assign owner by end of month |

### External Dependencies

| Dependency | Required For | Status | Next Review |
|------------|--------------|--------|-------------|
| Composio SDK update | Trigger lifecycle support | Scheduled Q1 2026 | Monthly sync |
| CopilotKit session recovery | Multi-tab support | Testing in progress | Nov 2025 |
| Supabase pgvector optimization | Library embedding performance | Roadmap review | Nov 2025 |

---

## Completed Recently

- [✓] **Unified documentation overhaul** (Oct 2025)
  - Removed gate terminology
  - Created navigation guide
  - Added Getting Started and Release Readiness docs

- [✓] **Artifact export functionality** (Oct 15, 2025)
  - PDF/CSV export from evidence gallery
  - Compliance-ready formatting

- [✓] **Chip regeneration optimization** (Oct 10, 2025)
  - Reduced latency to <2s p95
  - Improved prompt templates

---

## Monthly Archive

Move completed tasks to `docs/readiness/YYYY_MM/completed_tasks.md` at end of each month.

---

## How to Contribute

1. **Add New Tasks:**
   - Use imperative verb form (e.g., "Implement X", "Build Y")
   - Include objective, reference links, and evidence artifacts
   - Assign owner if known

2. **Update Status:**
   - `[ ]` — Not started
   - `[WIP]` — In progress (add owner)
   - `[✓]` — Completed (add completion date)
   - `[BLOCKER]` — Blocked (add context)

3. **Link to Documentation:**
   - Always reference relevant docs for implementation details
   - Link to evidence artifact requirements
   - Cross-reference roadmap milestones

4. **Review Cadence:**
   - Weekly: Update task status
   - Bi-weekly: Review priorities with Product/Engineering leads
   - Monthly: Archive completed tasks, refresh next priorities

---

---

## Automation-First Execution Notes

**Philosophy:** This todo list reflects the unified automation-first, Codex-centric approach:
- **Dry-run first:** Prove value with zero-privilege executions before requesting credentials
- **Evidence-driven:** Every capability ships with automated metrics and proof artifacts
- **Continuous validation:** ADK evals, accessibility scans, and telemetry audits run in CI/CD
- **Self-documenting:** Telemetry events and evidence bundles reduce manual status updates

**Key Automation Priorities:**
1. Keep ADK evaluation suites green (≥90% pass rate target)
2. Automate evidence artifact generation for each milestone
3. Expand CI/CD gates to include performance benchmarks and accessibility checks
4. Build self-service dashboards to reduce manual reporting overhead

---

## Follow-Up Items & Gaps

### Documentation Gaps
- [ ] **Create missing evidence artifacts** listed in section 10 (intake_acceptance_report.md, inspection_resilience.md, etc.)
- [ ] **Document Codex integration patterns** if using Codex-based code generation for agents
- [ ] **Expand runbook library** with common incident scenarios (Execute & Observe stage failures, OAuth token issues)
- [ ] **Add architecture decision records (ADRs)** in `docs/adrs/` for major design choices

### Automation Gaps
- [ ] **Automate readiness evidence collection** — Script to generate evidence artifacts from telemetry and test results
- [ ] **CI/CD performance regression detection** — Automated alerts when latency SLOs are breached in staging
- [ ] **Self-healing OAuth token rotation** — Automated re-auth flow when tokens expire
- [ ] **Library embedding refresh automation** — Weekly job currently manual, needs monitoring and alerting

### Cross-Functional Alignment Gaps
- [ ] **Governance sentinel integration** — Automated policy violation detection mentioned in assumptions but not yet implemented
- [ ] **Partner roadmap sync cadence** — Quarterly reviews with Composio, CopilotKit, ADK, Supabase (document schedule)
- [ ] **Compliance certification timeline** — SOC 2 Type II planned Q2 2026, track milestones in roadmap

---

**Document Owner:** AI Agent Operations Team & Product Management
**Last Updated:** October 2025
**Next Review:** Weekly (align with sprint planning)
**Feedback:** Submit issues to `docs/readiness/feedback/` or tag `@ai-agent-team`
