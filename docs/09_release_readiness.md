# AI Employee Control Plane: Release Readiness

**Version:** 3.2 (October 16, 2025)
**Audience:** Product, Engineering, Operations, QA, Governance, Executive Leadership
**Status:** Active release checklist and evidence framework

---

## Purpose

This document defines the cross-functional readiness criteria, evidence requirements, and sign-off process for releasing capabilities to production. It ensures that product launches maintain quality, security, compliance, and operational standards while enabling rapid iteration.

> `bd` references in this guide point to the external Beads CLI issue tracker used by operators (see `docs/11_issue_tracking.md`). It is separate from the runtime features delivered to end users.

**Key Principles:**
- **Evidence-driven:** Every release backed by objective proof (test results, benchmarks, audits)
- **Cross-functional alignment:** Product, Engineering, Trust, Operations, and UX collaborate on readiness
- **Continuous validation:** Automated checks run on every build; manual reviews for major releases
- **Transparent accountability:** Clear ownership, sign-off requirements, and escalation paths
- **Dependency-aware:** bd issue tracker gates releases via dependency resolution and ready queues

---

## Release Tiers

### Tier 1: Minor Updates
**Scope:** Bug fixes, copy changes, telemetry additions, non-breaking enhancements

**Requirements:**
- ✓ Automated tests passing (unit, integration, e2e)
- ✓ Linting and type checking clean
- ✓ No security vulnerabilities introduced (Snyk/SAST)
- ✓ Peer code review approval
- ✓ **bd ready check:** No open blockers for release issue

**Evidence:** CI/CD pipeline logs, PR approval, bd issue closure

**Sign-Off:** Engineering Lead

**Deployment:** Automated via CI/CD to staging → production

**bd Integration:**
```bash
# Verify no blocking dependencies
bd ready --json | jq '.[] | select(.tag | contains("release"))'

# Close release issue
bd close BD-XXX --reason "Tier 1 release: automated checks passed"
```

---

### Tier 2: Feature Releases
**Scope:** New UI components, agent capabilities, toolkit integrations, dashboard updates

**Requirements:**
- All Tier 1 requirements, plus:
- ✓ Feature flag configured for progressive rollout
- ✓ Telemetry instrumented and validated (see `docs/06_data_intelligence.md`)
- ✓ User-facing documentation updated
- ✓ Accessibility audit passing (axe, pa11y)
- ✓ Performance benchmarks within SLOs
- ✓ Agent evals passing for affected agents (ADK eval suite)
- ✓ Preview environment QA completed
- ✓ **bd dependency checks:** All dependencies resolved, evidence artifacts linked
- ✓ **Composio SDK trust stage validated:** Inspector/Planner handoff tested, OAuth flows complete

**Evidence:**
- Test coverage report (≥85%)
- Accessibility audit results
- Performance benchmark comparison
- Telemetry validation report (audit script clean)
- QA sign-off document
- **bd issue with evidence artifacts linked** in description
- **Composio trust model checklist** (Connect Link completion, scope logging)

**Sign-Off:** Product Manager + Engineering Lead + UX Lead

**Deployment:** Canary rollout (10% → 50% → 100%) with monitoring

**bd Integration:**
```bash
# Verify dependency resolution
bd dep tree BD-XXX

# Check all evidence artifacts present
bd list --tag evidence --status open  # should return empty

# Tag release for deployment tracking
bd update BD-XXX --tag deployment-ready

# Close after successful rollout
bd close BD-XXX --reason "Tier 2 feature deployed: 100% rollout complete"
```

---

### Tier 3: Major Releases
**Scope:** Multi-stage changes, architectural shifts, new mission types, breaking changes

**Requirements:**
- All Tier 1 & 2 requirements, plus:
- ✓ Security audit completed (penetration testing, threat modeling)
- ✓ Data migration tested with rollback plan
- ✓ Runbook created for incident response (see `docs/07_operations_playbook.md`)
- ✓ Customer communication plan prepared
- ✓ Partner integration validation (Composio SDK, CopilotKit, ADK, Supabase)
- ✓ Governance review completed (safeguard impact analysis)
- ✓ Business continuity plan documented
- ✓ Training materials updated
- ✓ **bd release milestone:** All child issues closed, dependency graph clean
- ✓ **Supabase single-migration validated:** Schema diff reviewed, rollback tested
- ✓ **Composio SDK trust stages:** All seven-stage handoffs tested end-to-end

**Evidence:**
- Security audit report (signed by Trust Lead)
- Migration validation logs (Supabase migration history)
- Runbook approval (ops review complete)
- Partner integration test results (Composio, CopilotKit, ADK)
- Governance sign-off memo
- Customer communication draft
- Executive summary deck
- **bd milestone report:** Dependency graph export, evidence matrix
- **Supabase migration artifact:** `supabase db history` output, rollback plan
- **Composio trust evidence:** Connect Link completion logs, scope audit trails

**Sign-Off:** Product VP + Engineering VP + Trust/Security Lead + Operations Lead + (optional) Executive Sponsor

**Deployment:** Phased rollout with stakeholder communication, 24/7 on-call coverage

**bd Integration:**
```bash
# Review full dependency graph for milestone
bd dep tree BD-MILESTONE-XXX

# Verify all sub-issues resolved
bd list --parent BD-MILESTONE-XXX --status open  # should return empty

# Export evidence for audit
bd ready --json > docs/readiness/bd-evidence/milestone-XXX.json

# Close milestone after deployment
bd close BD-MILESTONE-XXX --reason "Tier 3 major release: phased rollout complete, evidence archived"
```

---

## Cross-Functional Checklists

### Product Readiness

- User stories and acceptance criteria defined
- Success metrics and KPIs established
- Personas and use cases validated
- Rollout plan and communication strategy prepared
- Customer feedback mechanism in place
- Pricing/packaging impact assessed (if applicable)
- Competitive positioning updated
- Go-to-market materials ready (for major releases)
- **bd feature epic created** with child tasks and dependencies mapped

**Owner:** Product Manager
**Evidence Location:** `docs/readiness/product/<feature_name>/`
**bd Tracking:** Tag issues with `#product-readiness`

---

### Engineering Readiness

#### Code Quality
- All automated tests passing (unit, integration, e2e, agent evals)
- Test coverage ≥85% for new code
- Linting and formatting clean
- TypeScript strict mode passing
- No critical or high-severity security vulnerabilities
- Peer code reviews completed
- Tech debt documented and prioritized
- **bd code quality issues resolved** before merge

#### Performance
- Latency targets met (p95 ≤ 200ms for API calls, ≤ 150ms for stage transitions)
- SSE streaming heartbeat ≤ 5s
- Database query performance validated (no N+1 queries)
- Frontend bundle size within budget (≤ 500KB gzipped)
- Memory leak testing completed
- **Telemetry hygiene validated:** `pnpm ts-node scripts/audit_telemetry_events.py --mode check` passes

#### Architecture
- Component integration validated
- API contracts documented and versioned
- Database migrations tested (up and down) via Supabase single-migration workflow
- Feature flags configured and tested
- Rollback procedure validated
- Observability instrumented (logs, metrics, traces per `docs/06_data_intelligence.md`)
- **ADK agent coordination tested:** Session state handoffs verified across Inspector/Planner/Executor
- **Composio SDK integration verified:** Discovery, Connect Links, execution, telemetry events logged

**Owner:** Engineering Lead
**Evidence Location:** `docs/readiness/engineering/<feature_name>/`
**bd Tracking:** Tag issues with `#engineering-readiness`

---

### Trust & Security Readiness

- Threat model reviewed and mitigations implemented
- Authentication and authorization tested
- PII redaction verified (telemetry, logs, error messages per `docs/06_data_intelligence.md` § Redaction)
- Data encryption at rest and in transit validated
- Vulnerability scan completed (SAST, DAST, dependency audit)
- OAuth scopes follow least-privilege principle
- **Composio trust model validated:**
  - Inspector initiates Connect Links during Prepare stage
  - All granted scopes logged before planning begins
  - Planner assembles plays from established connections only
  - Executor uses validated connections with audit trails
- Safeguard logic validated (auto-fix, validator, approval gates)
- Audit trail completeness verified
- Incident response runbook prepared (see `docs/07_operations_playbook.md`)
- Compliance requirements met (SOC 2, GDPR, HIPAA if applicable)
- **bd security issues closed** with evidence artifacts

**Owner:** Trust/Security Lead
**Evidence Location:** `docs/readiness/security/<feature_name>/`
**bd Tracking:** Tag issues with `#security-readiness`

---

### Operations Readiness

#### Deployment
- Deployment runbook created and reviewed (linked from `docs/07_operations_playbook.md`)
- Rollback procedure tested
- Database migration strategy validated (Supabase single-migration workflow)
- Environment configuration verified (dev, staging, production)
- Feature flags tested for instant rollback
- Canary deployment plan prepared (for Tier 2+)
- Zero-downtime deployment validated
- **bd deployment issue created** with rollback dependencies mapped

#### Monitoring & Observability
- Key metrics instrumented (success rate, latency, error rate)
- Dashboards created (operational, executive, governance views)
- Alerts configured with appropriate thresholds
- On-call rotation updated
- Incident escalation path documented
- Logging aggregation verified (structured JSON, correlation IDs)
- Telemetry coverage validated (all critical paths emit events per `docs/06_data_intelligence.md`)
- **Composio SDK telemetry validated:** `composio_discovery`, `composio_auth_flow`, `composio_tool_call` events logged
- **ADK agent telemetry validated:** `session_heartbeat` events with lag and token usage

#### Reliability
- Load testing completed (expected traffic + 2x headroom)
- Failure mode testing (database outage, API rate limits, network issues)
- Data backup and restore tested (Supabase backup/restore verified)
- Disaster recovery plan validated
- SLA/SLO targets defined and instrumented
- **bd operations issues resolved** before production deployment

**Owner:** Operations Lead
**Evidence Location:** `docs/readiness/operations/<feature_name>/`
**bd Tracking:** Tag issues with `#operations-readiness`

---

### UX & Design Readiness

- Design specifications complete (Figma, Storybook)
- Design QA passed (pixel-perfect review)
- Interaction patterns consistent with design system
- Responsive design tested (desktop, tablet, mobile)
- Accessibility audit passed (WCAG 2.1 AA compliance)
- Keyboard navigation tested
- Screen reader testing completed (NVDA, VoiceOver)
- High-contrast and motion-reduced modes validated
- Copy reviewed and approved (tone, clarity, terminology)
- Internationalization ready (strings externalized, RTL tested if applicable)
- **bd UX issues resolved** with design review sign-off

**Owner:** UX Lead
**Evidence Location:** `docs/readiness/ux/<feature_name>/`
**bd Tracking:** Tag issues with `#ux-readiness`

---

### Data & Analytics Readiness

- Telemetry events defined and documented (see `docs/06_data_intelligence.md` § Event Catalog)
- Event schema validated (`scripts/audit_telemetry_events.py` passes)
- PII redaction verified (redaction helpers applied)
- Analytics views created or updated
- Dashboards refreshed and tested
- Anomaly detection rules configured
- Data retention policies applied (180 days per policy)
- Export functionality tested (CSV, PDF for compliance)
- Learning loops instrumented (library contributions, safeguard feedback)
- **Composio SDK telemetry coverage:** Discovery, auth flows, execution, errors all logged
- **bd analytics issues resolved** with dashboard evidence

**Owner:** Data/Analytics Lead
**Evidence Location:** `docs/readiness/analytics/<feature_name>/`
**bd Tracking:** Tag issues with `#analytics-readiness`

---

### Governance Readiness

- Safeguard logic reviewed and approved
- Approval workflows tested (role-based gating)
- Undo plans validated for all mutating actions
- Evidence bundle completeness verified
- Audit trail integrity checked (tamper detection, SHA-256 hashes)
- Override policies documented and enforced
- Compliance export functionality tested
- Governance dashboard updated
- Risk assessment completed (impact × reversibility matrix)
- Policy alignment confirmed (internal governance policies)
- **Composio trust stages validated:** Inspector OAuth initiation, Planner connection validation, Executor audit trails
- **bd governance issues resolved** with compliance evidence

**Owner:** Governance/Compliance Lead
**Evidence Location:** `docs/readiness/governance/<feature_name>/`
**bd Tracking:** Tag issues with `#governance-readiness`

---

## Evidence Artifacts

All readiness evidence must be stored in structured locations and referenced in release PRs and bd issues:

### Artifact Structure
```
docs/readiness/
├── product/
│   └── <feature_name>/
│       ├── acceptance_criteria.md
│       ├── success_metrics.md
│       └── rollout_plan.md
├── engineering/
│   └── <feature_name>/
│       ├── test_coverage_report.html
│       ├── performance_benchmarks.json
│       ├── api_contract.yaml
│       ├── adk_eval_results.json              # NEW: ADK agent eval reports
│       └── rollback_validation.md
├── security/
│   └── <feature_name>/
│       ├── threat_model.md
│       ├── vulnerability_scan_results.pdf
│       ├── composio_trust_audit.md            # NEW: Composio OAuth/trust validation
│       └── penetration_test_report.pdf
├── operations/
│   └── <feature_name>/
│       ├── deployment_runbook.md
│       ├── monitoring_dashboard.json
│       ├── supabase_migration_plan.md         # NEW: Single-migration workflow evidence
│       └── load_test_results.md
├── ux/
│   └── <feature_name>/
│       ├── accessibility_audit.html
│       ├── design_qa_checklist.md
│       └── usability_test_summary.md
├── analytics/
│   └── <feature_name>/
│       ├── telemetry_schema.json
│       ├── event_validation_report.md
│       ├── telemetry_audit_output.txt         # NEW: audit_telemetry_events.py results
│       └── dashboard_preview.png
├── governance/
│   └── <feature_name>/
│       ├── safeguard_review.md
│       ├── risk_assessment.md
│       └── compliance_checklist.md
├── bd-evidence/                                # NEW: bd dependency graph exports
│   └── milestone-XXX.json
└── runbooks/
    └── <incident_type>.md
```

### Artifact Requirements
- **Format:** Markdown for text, HTML for reports, JSON for data, PDF for formal audits
- **Naming:** `<feature_name>_<artifact_type>_<YYYYMMDD>.ext`
- **Versioning:** Git-tracked with timestamps
- **Ownership:** Clear owner and reviewer listed in frontmatter
- **Expiry:** Evidence reviewed quarterly; stale artifacts flagged
- **bd Linking:** All evidence artifacts referenced in bd issue descriptions with relative paths

---

## Sign-Off Process

### Tier 1 (Minor Updates)
1. Developer creates PR with description and automated checks passing
2. **Verify bd ready queue:** `bd ready --json | jq '.[] | select(.priority <= 1)'`
3. Peer reviewer approves code
4. Engineering Lead merges
5. CI/CD deploys automatically
6. **Close bd issue** with deployment timestamp

**Timeline:** Same day

---

### Tier 2 (Feature Releases)
1. Developer creates PR with evidence artifacts linked
2. **Verify bd dependencies resolved:** `bd dep tree BD-XXX`
3. Automated checks pass (tests, linting, security scan, a11y audit, telemetry audit)
4. Peer code review completed
5. QA validates in preview environment
6. Product Manager reviews acceptance criteria and success metrics
7. Engineering Lead reviews technical readiness (including ADK eval results)
8. UX Lead reviews design and accessibility
9. **bd evidence artifacts attached** to issue description
10. Multi-approval merge (Product + Engineering + UX)
11. Canary deployment with monitoring (logged in bd)
12. **Close bd issue** after 100% rollout with evidence summary

**Timeline:** 2-5 days

---

### Tier 3 (Major Releases)
1. Developer creates PR with comprehensive evidence bundle
2. **Verify bd milestone dependencies:** All child issues closed, dependency graph clean
3. All Tier 2 checks completed
4. Security audit completed and signed off (including Composio trust model)
5. Operations validates deployment and monitoring readiness (including Supabase migration plan)
6. Governance reviews safeguard logic and compliance
7. Stakeholder demo to Product VP + Engineering VP
8. Executive summary presented (if needed)
9. **bd milestone report exported** to `docs/readiness/bd-evidence/`
10. Multi-stakeholder sign-off (Product VP + Engineering VP + Trust Lead + Ops Lead)
11. Customer communication sent (if external impact)
12. Phased rollout with 24/7 on-call (tracked in bd deployment issue)
13. **Close bd milestone** with retrospective and lessons learned

**Timeline:** 1-3 weeks

---

## Rollback & Incident Response

### Rollback Triggers
- Critical bugs affecting ≥5% of users
- Security vulnerabilities (CVSS ≥7.0)
- Performance degradation (p95 latency >2x baseline)
- Data integrity issues
- Safeguard bypass detected
- Compliance violation
- **bd incident auto-created** on SEV-1/SEV-2 alerts

### Rollback Procedures

**Immediate Actions (0-15 minutes):**
1. Disable feature flag (instant rollback for new features)
2. **Create bd rollback issue:** `bd create "ROLLBACK: <feature>" -p 0 -t rollback`
3. Alert on-call engineer and stakeholders
4. Open incident ticket with severity classification (linked to bd issue)
5. Switch traffic to previous deployment (Vercel rollback, or equivalent)

**Short-Term Actions (15-60 minutes):**
1. Validate rollback success (metrics return to baseline)
2. Preserve evidence (logs, telemetry, error traces)
3. Notify affected users (if external impact)
4. **Update bd rollback issue** with mitigation steps
5. Begin root cause analysis

**Follow-Up Actions (1-24 hours):**
1. Root cause identified and documented
2. Fix implemented and tested
3. Readiness re-validation completed (all checklists re-run)
4. **Create bd action items** as `discovered-from` dependencies of rollback issue
5. Incident retrospective scheduled
6. Runbook updated with learnings
7. **Close bd rollback issue** with incident report link

**Owner:** On-call engineer (immediate), Engineering Lead (follow-up)
**Escalation:** VP Engineering (if >1 hour downtime or data loss)

**For detailed incident response procedures, see `docs/07_operations_playbook.md` § Incident Response.**

---

## Automation & Continuous Validation

### CI/CD Gates

All PRs must pass automated gates before merge:

1. **Unit Tests:** `pnpm test:ui`, `mise run test-agent`
2. **Linting:** `pnpm run lint`, `uv run ruff check agent`
3. **Type Checking:** `pnpm tsc --noEmit`
4. **Security Scan:** Snyk dependency audit, SAST
5. **Accessibility:** `pnpm run test:a11y` (axe-core)
6. **Performance:** Lighthouse checks for critical pages
7. **Telemetry Validation:** `pnpm ts-node scripts/audit_telemetry_events.py --mode check`
8. **ADK Agent Evals:** `mise run test-agent` (smoke + ranking + coordination suites)
9. **Supabase Migration Check:** `supabase db diff` (no unexpected drift)
10. **bd Dependency Check:** `bd dep cycles` (no circular dependencies)

**Enforcement:** Automated via GitHub Actions; failing checks block merge

**bd Integration:** CI pipeline queries `bd ready` to surface unblocked work

---

### Continuous Monitoring (Post-Deployment)

**Real-Time Alerts:**
- Error rate spike (>2% for >5 minutes)
- Latency degradation (p95 >200ms sustained)
- Failed authentication attempts spike
- Safeguard violation rate increase
- Database connection pool exhaustion
- Memory leak detection (heap growth >20% per hour)
- **Composio SDK rate limits:** Alert on `RATE_LIMIT_EXCEEDED` spike
- **ADK agent heartbeat lag:** Alert on `session_heartbeat` lag >10s
- **Auto-create bd incident** on critical alerts

**Daily Health Checks:**
- Telemetry ingestion rate (should match user activity)
- Test suite health (all passing on main branch)
- Evidence artifact freshness (no artifacts >30 days stale)
- Library embedding refresh status
- Backup completion status
- **bd ready queue health:** Verify no stale blockers

**Weekly Reviews:**
- Incident frequency and MTTR trends
- Release velocity and rollback rate
- Test coverage trends
- Technical debt accumulation
- **bd dependency graph review:** Identify bottlenecks

**Owner:** Operations team (alerts), Engineering Manager (reviews)

---

## Metrics & Success Criteria

### Release Quality Metrics

| Metric | Target | Measurement | bd Integration |
|--------|--------|-------------|----------------|
| **Automated Test Pass Rate** | 100% on main | CI/CD dashboard | Block merge if failing |
| **Test Coverage** | ≥85% for new code | Coverage reports | Track in bd issue metadata |
| **Mean Time to Merge (MTTM)** | <3 days for Tier 2 | GitHub metrics | Alert on bd age >3 days |
| **Rollback Rate** | <5% of releases | Incident tracking | Tag bd rollback issues |
| **Post-Deployment Incidents** | <1 per 10 releases | Incident dashboard | Link bd deployments to incidents |
| **Security Vulnerabilities** | 0 critical, <3 medium | Snyk, SAST | Block with bd security issue |
| **Accessibility Compliance** | 100% WCAG 2.1 AA | axe audits | Track in bd UX checklist |
| **Telemetry Hygiene** | 100% audit pass | audit_telemetry_events.py | CI gate blocks on failure |
| **bd Dependency Resolution** | 100% for releases | bd ready queue | Block deployment if blockers exist |

---

### Release Velocity Metrics

| Metric | Target | Measurement | bd Integration |
|--------|--------|-------------|----------------|
| **Release Frequency** | 2-3 deploys/week | Deployment logs | Count bd deployment issues closed |
| **Mean Time to Production (MTTP)** | <5 days (Tier 2) | PR lifecycle | Measure bd issue age |
| **Evidence Generation Time** | <15 min per milestone | Automation tracking | Track artifact timestamps in bd |
| **Sign-Off Cycle Time** | <24 hours (Tier 2) | Approval timestamps | Monitor bd issue update frequency |
| **Dependency Resolution Time** | <2 days | bd dep tree age | Alert on stale blockers |

---

### Operational Health Metrics

| Metric | Target | Measurement | bd Integration |
|--------|--------|-------------|----------------|
| **Uptime** | ≥99.9% | Monitoring dashboard | Create bd incident on downtime |
| **Mean Time to Detect (MTTD)** | <5 minutes | Alert timestamps | Log in bd incident creation time |
| **Mean Time to Resolve (MTTR)** | <30 minutes | Incident logs | Track bd incident close duration |
| **Rollback Success Rate** | ≥95% | Rollback tracking | Tag bd rollback issues with outcome |
| **On-Call Response Time** | <10 minutes | PagerDuty logs | Validate bd incident acknowledgment |

---

## Communication & Transparency

### Internal Communication

**Stakeholder Updates:**
- **Daily:** Automated Slack digest of releases and incidents (with bd issue links)
- **Weekly:** Engineering all-hands (demos, metrics, retrospectives)
- **Monthly:** Executive dashboard review (velocity, quality, impact)
- **Quarterly:** Roadmap alignment session (Product, Engineering, Trust, Ops) with bd milestone review

**Channels:**
- Slack: `#releases`, `#incidents`, `#ai-control-plane`
- Email: Weekly release notes to stakeholders
- Wiki: Release history and runbook updates
- **bd:** Central source of truth for work tracking and evidence linking

**Automation:**
- Slack bot posts bd issue updates to relevant channels
- bd dependency graph visualized in weekly reports
- Auto-tag stakeholders in bd based on component ownership

---

### External Communication (Customer-Facing Releases)

**Pre-Release:**
- Feature preview announcements (2 weeks before)
- Beta testing invitations (1 week before)
- Documentation updates published

**Release Day:**
- Release notes published (changelog, new features, fixes)
- Email to active users (for major releases)
- In-app notifications (for UI changes)

**Post-Release:**
- Support team briefing (known issues, FAQs)
- Office hours for customer questions (for major releases)
- Feedback collection (NPS, feature surveys)
- **bd post-release issue** for feedback triaging

---

## Appendix A: Release Tier Decision Tree

```
┌─ Breaking changes, schema migrations, or multi-stage refactor?
│  └─ YES → Tier 3 (Major Release) + bd milestone with full dependency graph
│  └─ NO ↓
│
├─ New UI components, agent capabilities, or toolkit integrations?
│  └─ YES → Tier 2 (Feature Release) + bd feature issue with evidence artifacts
│  └─ NO ↓
│
└─ Bug fix, copy change, telemetry update, or minor enhancement?
   └─ YES → Tier 1 (Minor Update) + bd bug/task issue with ready queue check
```

---

## Appendix B: Evidence Artifact Templates

### Template: Acceptance Criteria Document
```markdown
# Feature Name: <name>
**Owner:** <Product Manager>
**Date:** <YYYY-MM-DD>
**bd Issue:** BD-XXX

## User Stories
- As a <persona>, I want <capability> so that <outcome>
- ...

## Acceptance Criteria
- Criterion 1 (measurable, testable)
- Criterion 2
- ...

## Success Metrics
- Metric 1: <definition> (target: <value>)
- Metric 2: ...

## Out of Scope
- <explicitly excluded functionality>
```

### Template: Deployment Runbook
```markdown
# Deployment Runbook: <feature_name>
**Owner:** <Operations Engineer>
**Date:** <YYYY-MM-DD>
**bd Issue:** BD-XXX

## Pre-Deployment Checklist
- Backup database
- Verify staging deployment
- Alert on-call team
- Run bd dependency check: `bd ready --json`
- Verify telemetry audit: `pnpm ts-node scripts/audit_telemetry_events.py --mode check`
- Review Supabase migration: `supabase db diff`
- ...

## Deployment Steps
1. Step 1 (command, expected output)
2. Step 2
...

## Validation Steps
1. Check 1 (pass/fail criteria)
2. Check 2
...

## Rollback Procedure
1. Rollback step 1 (command, expected output)
2. Create bd rollback issue: `bd create "ROLLBACK: <feature>" -p 0 -t rollback`
...

## Contacts
- On-Call: <name, contact>
- Escalation: <name, contact>
```

### Template: Risk Assessment
```markdown
# Risk Assessment: <feature_name>
**Owner:** <Governance Lead>
**Date:** <YYYY-MM-DD>
**bd Issue:** BD-XXX

## Risk Matrix
| Dimension | Score (1-5) | Notes |
|-----------|-------------|-------|
| **Complexity** | X | <rationale> |
| **Impact** | X | <affected users, systems> |
| **Reversibility** | X | <rollback plan quality> |
| **Test Coverage** | X | <confidence in testing> |
| **Dependency Health** | X | <bd graph complexity> |

## Identified Risks
1. **Risk 1:** <description>
   - **Likelihood:** Low/Medium/High
   - **Impact:** Low/Medium/High
   - **Mitigation:** <plan>
   - **Owner:** <name>
   - **bd Tracking:** BD-YYY

## Approval
- Risks reviewed and mitigations acceptable
- Sign-Off: <name, date>
```

### Template: bd Dependency Graph Export (NEW)
```bash
# Export dependency graph for milestone
bd ready --json > docs/readiness/bd-evidence/milestone-XXX.json

# Export full dependency tree
bd dep tree BD-MILESTONE-XXX > docs/readiness/bd-evidence/milestone-XXX-dep-tree.txt

# Verify no cycles before release
bd dep cycles
```

---

## Appendix C: Composio SDK Trust Model Checklist (NEW)

Use this checklist for Tier 2+ releases involving Composio SDK integration:

### Inspector Stage (Prepare)
- Discovery runs without OAuth: `client.tools.search()` completes
- Anticipated connections identified and logged
- Coverage estimates calculated and displayed
- Connect Link approval flow tested in chat
- OAuth initiated only after stakeholder approval: `client.toolkits.authorize()`
- `wait_for_connection()` completes successfully
- All granted scopes logged to Supabase before planning
- Telemetry events logged: `composio_discovery`, `composio_auth_flow`

### Planner Stage (Plan)
- Planner receives established connections from Inspector
- Validator confirms scopes match mission requirements
- Play assembly uses validated connections only (no new OAuth requests)
- Tool usage patterns incorporated into ranking
- Undo plans attached to all plays
- `plan_selected` emitted when owner chooses preferred play
- No scope escalation during planning

### Approval Stage (Approve)
- Approval modal summarises objectives, safeguards, undo plan, and scope usage
- Required approver role assigned (or self-approval recorded with rationale)
- Decision recorded in `mission_approvals` with timestamps and approver identity
- Telemetry events logged: `approval_requested`, `approval_granted`/`approval_rejected`
- Audit export verified (PDF/Slack) for governance handoff

### Executor Stage (Execute)
- Execution uses established connections with session context
- Provider adapters correctly scope calls with `user_id` + `tenantId`
- Validator preflight checks run before each tool call
- Audit trail logged for all executions
- Telemetry events logged: `composio_tool_call`, `composio_tool_call_error`
- Rate limit handling tested (exponential backoff)
- Auth expiry handling tested (graceful degradation)

### Evidence & Audit
- Connect Link completion logs archived
- Scope approval timestamps captured
- Execution audit trail complete (including undo hints)
- Compliance export includes Composio events

**Reference:** See `docs/10_composio.md` for full trust model documentation.

---

## Appendix D: Related Documents

- **[Product Vision](./01_product_vision.md)** — Strategic context and value proposition
- **[System Overview](./02_system_overview.md)** — Architecture and technical specifications
- **[User Experience Playbook](./03_user_experience.md)** — UX contracts and accessibility
- **[Implementation Guide](./04_implementation_guide.md)** — Development standards and patterns
- **[Capability Roadmap](./05_capability_roadmap.md)** — Milestone planning and dependencies
- **[Data Intelligence](./06_data_intelligence.md)** — Telemetry and analytics requirements
- **[Operations Playbook](./07_operations_playbook.md)** — Deployment and incident response
- **[Getting Started](./08_getting_started.md)** — Onboarding for new team members
- **[Issue Tracking](./11_issue_tracking.md)** — bd workflow and dependency management
- **[AGENTS.md](../AGENTS.md)** — AI agent quick reference

---

**Document Owner:** Product & Engineering Leadership
**Last Updated:** October 16, 2025
**Next Review:** January 2026
**Feedback:** Submit to `docs/readiness/feedback/` or tag `@ai-agent-team`
