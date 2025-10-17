# AI Employee Control Plane: Product Vision

**Version:** 3.1 (October 2025)
**Audience:** Leadership, Product, GTM, Partners
**Status:** Active vision and strategic direction

---

## Executive Summary

The AI Employee Control Plane transforms how organizations deploy autonomous agents by replacing rigid, stage-gated workflows with a **single unified system** that balances autonomy with trust. This platform enables teams to move from intent to measurable business outcomes in under 15 minutes—proving value through read-only inspection before requesting credentials, then scaling safely with adaptive safeguards and human-centered approvals.

Unlike traditional automation platforms that demand full access upfront or lightweight copilots that lack accountability, the Control Plane delivers an **objective-first AI employee** that plans, executes, and learns like a top operator—capability-aware, radically reversible, and always auditable.

**The transformation:** From "configure integrations first" to "describe your goal once." From static policy manuals to generative, mission-specific safeguards. From black-box automation to continuous visibility and collaborative decision-making.

---

## The Problem

### Market Context

Senior operators face mounting pressure to scale revenue, retention, and operational efficiency without expanding headcount. They're caught between two inadequate options:

1. **Traditional Automations** — Demand full credentials upfront, require extensive configuration, lack rollback mechanisms, and provide no ROI visibility before commitment
2. **Lightweight Copilots** — Offer suggestions but lack autonomous execution, provide no accountability trails, and deliver inconsistent quality

Meanwhile, **leadership teams remain skeptical**:
- Governance officers can't approve what they can't audit
- CFOs need measurable ROI before budget allocation
- Technical leaders worry about security, compliance, and operational risk
- Board members demand evidence of business impact

### Core Pain Points

**For Operators:**
- Manual work doesn't scale; hiring isn't approved
- CRM enrichment, campaign launches, support triage consume hours daily
- Existing tools require too much setup before proving value
- Integration sprawl creates maintenance burden

**For Leadership:**
- No visibility into agent actions, decisions, or outcomes
- Attribution gaps prevent ROI measurement
- Compliance requirements block autonomous execution
- Rollback plans are unclear or nonexistent

**For Technical Teams:**
- Credential management is risky and complex
- OAuth scopes are over-permissive or under-documented
- Debugging agent behavior is opaque
- Integration testing is time-consuming

---

## Product Vision

### Vision Statement

**Deliver an objective-first AI employee that earns trust through transparency, proves value before requesting access, and scales safely with adaptive governance—enabling every organization to augment their operations with confident autonomy.**

### Guiding Principles

**1. Generative by Default, Editable by Design**

A single freeform input generates complete missions: objectives, audiences, KPIs, adaptive safeguards, and recommended plays. Every element remains fully editable—users stay in control while the system removes onboarding friction.

**2. Progressive Trust Model**

Start with **no-auth inspection**: read-only exploration of public data, toolkit capabilities, and draft generation without requiring OAuth credentials. This mode produces proof-of-value artifacts (enriched contact lists, campaign drafts, competitive analysis) for stakeholder review before any credentials are requested. Once value is demonstrated through these inspection artifacts, users opt into **governed execution**—OAuth-authenticated workflows with approvals and safeguard enforcement for write actions and sensitive data access. Trust is earned through transparency, not assumed upfront.

**3. Objective-First, Not Tool-First**

Users describe business goals and constraints. The system recommends toolkits, plays, and workflows based on capability grounding and historical success—manual configuration becomes the exception, not the rule.

**4. Human-Centered Copilot**

The AI employee is a collaborative partner presenting recommendations with rationale. Approval moments are constructive checkpoints—users refine, approve, or redirect with minimal friction. Autonomous doesn't mean opaque.

**5. Radically Reversible**

Every mutating action includes an undo plan. Users roll back with confidence. Governance teams audit rollback success rates. The system assumes mistakes will happen and designs for graceful recovery.

**6. Continuous Visibility**

Real-time streaming updates surface agent reasoning, safeguard feedback, and execution progress. Users never wonder "what is it doing?"—they see evidence, rationale, and next steps as work unfolds.

**7. Adaptive Safeguards**

Mission-specific hints (tone guidance, quiet windows, budget caps, escalation contacts) replace static policy manuals. Safeguards are generated, editable, and improve with feedback—balancing compliance with operational agility.

**8. Compounding Intelligence**

Successful missions become library assets. Play recommendations improve with precedent. The system learns which approaches work for different operator contexts, building organizational memory that scales expertise.

---

## Value Proposition

### Differentiation

**vs. Traditional Automations:**
- ✓ Prove value in <15 minutes with no-auth inspection artifacts—no credentials required upfront (vs. weeks of OAuth setup before seeing any value)
- ✓ Separate inspection (read-only, public data) from execution (OAuth-gated, write actions)—users control when to grant access
- ✓ Adaptive safeguards replace static policies (edit inline vs. legal review)
- ✓ Undo plans for every action (vs. manual cleanup or permanent damage)
- ✓ Transparent reasoning trails across the system architecture (Presentation → APIs → Orchestration → Data layers) instead of opaque configuration screens

**vs. Lightweight Copilots:**
- ✓ Autonomous execution with approval gates (vs. manual copy-paste)
- ✓ Complete evidence bundles for compliance (vs. chat transcripts)
- ✓ Multi-toolkit orchestration (vs. single-app suggestions)
- ✓ Compounding library of proven plays (vs. ephemeral recommendations)

**vs. Legacy Stage-Gated Systems:**
- ✓ Seven-stage journey with preserved checkpoints (vs. scattered gates)
- ✓ Generative scaffolding from freeform input (vs. blank forms)
- ✓ Continuous workspace visibility across stages (vs. segmented interfaces)
- ✓ Integrated feedback loops (vs. post-mortem analysis)

### Business Outcomes

**For Revenue Teams:**
- Revive dormant accounts with tailored campaigns (87 contacts enriched, 3-5% reply rate)
- Launch outreach plays in <15 minutes (vs. days of manual prep)
- Attribute pipeline lift to specific agent actions
- Scale without adding SDR headcount

**For Customer Operations:**
- Compress response times with churn-risk triage
- Meet SLAs confidently with tone-aware automations
- Maintain compliance through auditable approval trails
- Reduce manual queue management overhead

**For Business Operations:**
- Automate billing nudges, scheduling, and reporting
- Maintain oversight through evidence bundles
- Reduce missed payments and follow-up cycles
- Free operators for strategic work

**For Technical Enablement:**
- Route code changes through reviewer checkpoints
- Enable agent-led fixes without compromising hygiene
- Preserve git history with intelligent undo plans
- Accelerate incident response

**For Governance & Compliance:**
- Audit every action with timestamped evidence
- Review safeguard feedback patterns
- Export compliance-ready reports (CSV, PDF)
- Justify expansion with measurable risk mitigation

---

## Strategic Differentiators

### 1. Generative Onboarding at Scale

**The Innovation:**
Single-input intake parses objectives, audiences, KPIs, safeguards, tone hints, and toolkit recommendations—all from a paragraph of context. Users edit chips inline rather than filling blank forms.

**Flow Touchpoint:** `DefineStage → IntakeAPI → Coordinator → Planner` keeps the workspace, orchestration layer, and Supabase metadata synchronized from the first keystroke.

**Business Impact:**
- 3-second generation time (p95) reduces onboarding friction by 90%
- 80% acceptance rate without regeneration proves quality
- Persona-specific defaults accelerate playbook adoption
- Lower training costs for new users

### 2. Native Composio SDK Orchestration

**The Innovation:**
All toolkit execution flows through the **Composio SDK**, a production-ready surface that exposes more than 500 toolkits with native authentication, schema translation, and telemetry. The progressive trust model maps cleanly to SDK calls:
- **Discovery:** Inspectors call `ComposioClient.tools.search()` and provider formatters to assemble capability snapshots without touching customer data.
- **Authentication:** Planners generate mission-scoped Connect Links via `ComposioClient.toolkits.authorize()` (and `await wait_for_connection()`), collect approvals, and confirm with `.status()` before committing plans.
- **Execution:** Executors stream writes through provider adapters (`provider.handle_tool_calls(...)`) or direct `client.tools.execute()` calls, with triggers/workflows handling longer-running actions.

**Flow Touchpoint:** `PrepareStage → InspectAPI → Inspector` issues discovery queries against the catalog cache. `PlanStage → PlannerAPI` surfaces Connect Links, persists the granted scopes, and records them in Supabase. `ExecuteStage → Executor` runs native SDK executions, capturing audit trails through `client.audit.list_events(...)`.

**Business Impact:**
- Informed consent replaces blind OAuth grants
- Coverage meter (≥85% threshold) prevents under-scoped connections
- Undo-first architecture leverages native audit logs
- Reduced integration sprawl through curated toolkit selection

### 3. Adaptive Safeguard System

**The Innovation:**
Mission-specific hints (tone, timing, budget, escalation) are generated with confidence scores, edited inline, and enforced by validator. Auto-fix suggestions, reviewer overrides, and feedback loops replace static policy documents.

**Flow Touchpoint:** Safeguard edits propagate through `PlanStage → ApprovalAPI → Validator` and loop back via `ExecuteStage → Validator`, ensuring governance continuity across layers.

**Business Impact:**
- <200ms governance overhead (vs. manual reviews)
- 82% auto-fix adoption reduces approval bottlenecks
- Safeguard feedback stream identifies prompt tuning opportunities
- Compliance without bureaucracy

### 4. Evidence-First Architecture

**The Innovation:**
Every mission generates a complete evidence bundle: brief, tool outputs (redacted), ROI estimates, safeguard outcomes, undo instructions, telemetry summary. Artifacts are SHA-256 hashed for tamper detection.

**Flow Touchpoint:** `ExecuteStage → EvidenceAPI → EvidenceAgent → Storage/Supabase` guarantees that operators, validators, and auditors access identical artifacts, while `EvidenceAgent → ReflectStage` feeds the learning loop.

**Business Impact:**
- Audit-ready compliance exports (PDF, CSV)
- Attribution clarity for pipeline and efficiency gains
- Stakeholder confidence through transparency
- Reduced compliance review cycles

### 5. Compounding Play Library

**The Innovation:**
Successful missions become reusable plays with embeddings, success scores, and mission metadata. Planner combines library precedent with live Composio discovery to rank recommendations.

**Business Impact:**
- Play reuse rate (3 per tenant/month) drives efficiency gains
- Agencies can package repeatable services
- Franchises scale expertise across locations
- Network effects improve recommendations over time

---

## Target Customers & Use Cases

### Primary Personas

#### **1. Revenue Expansion Lead (Emma)**

**Profile:**
Director of Business Development, mid-market SaaS, managing 200+ dormant accounts, pressure to hit quarterly pipeline goals without SDR budget

**Job-to-Be-Done:**
"When I have a quarterly pipeline target, I want to receive ready-to-run outreach plays so I can demonstrate lift before granting send permissions."

**Control Plane Solution:**
- Stage 1 (Define): Paste objective → receive tailored campaign with enriched contacts
- Dry-run proof pack shows 87 contacts, draft messages, 3-5% reply estimate
- Stage 2 (Prepare): Inspector presents Connect Link OAuth requests after stakeholder review; approvals land before planning begins
- Stage 3 (Plan): Planner assembles outreach plays from established connections, ranking variants using tool usage patterns and data investigation output
- Stage 4 (Approve): Stakeholder approves selected play with full audit trail
- Stage 5 (Execute): Track attribution: replies, meetings booked, pipeline created

**Success Metrics:**
- Time-to-proof: <15 minutes
- Dry-run conversion rate: 68%
- Reply rate lift: 3-5%
- Cost per outreach: $0.02 (vs. $15 with manual SDR)

---

#### **2. Customer Operations Leader (Omar)**

**Profile:**
Head of Support, high-growth e-commerce, 500+ tickets/day, 4h SLA, 3% churn risk, team of 12

**Job-to-Be-Done:**
"When churn-risk cases surface, I want safeguarded automations that propose responses and log evidence so my team meets SLAs confidently."

**Control Plane Solution:**
- Zendesk triage identifies at-risk tickets
- Draft responses with tone safeguards (warm-professional)
- Approval checkpoint before send
- Undo button active for 15 minutes
- Evidence bundle for compliance audits

**Success Metrics:**
- Response time reduction: 40%
- SLA compliance: 89% → 97%
- Escalation rate: <2%
- Churn risk resolution: +15%

---

#### **3. Governance Officer (Priya)**

**Profile:**
Compliance Lead, regulated fintech, board-level reporting, zero tolerance for policy violations

**Job-to-Be-Done:**
"When reviewing automation requests, I want visibility into who approved each action, what toolkits were used, and how rollback works so I can justify expansion."

**Control Plane Solution:**
- Governance dashboard with full audit trails
- Safeguard feedback timeline (applied, edited, violated)
- Exportable evidence bundles with signatures
- Override register with expiry tracking
- Incident summaries with auto-generated narratives

**Success Metrics:**
- Audit completion time: 10-15 minutes
- Policy violation rate: <5%
- Time-to-resolution: <24 hours
- Stakeholder confidence score: 4.5/5

---

#### **4. Technical Enablement Lead (Jamal)**

**Profile:**
Platform Engineer, dev tooling startup, maintains 40 repos, 20+ PRs/week, concerned about code hygiene

**Job-to-Be-Done:**
"When agents propose code changes, I want them routed through a code MCP with reviewer checkpoints so I can enable fixes without compromising hygiene."

**Control Plane Solution:**
- Agent identifies bugs, proposes fixes with rationale
- Diff previews in approval modal
- Git-aware undo plans (revert commits, preserve history)
- PR descriptions include testing notes
- Reviewer sign-off before merge

**Success Metrics:**
- Time-to-fix reduction: 60%
- PR approval rate: 78%
- Rollback incidents: <3%
- Code quality maintained

---

#### **5. Executive Sponsor (Carlos)**

**Profile:**
COO, professional services firm, board presentations, budget justification, risk committee oversight

**Job-to-Be-Done:**
"When presenting to the board, I want dashboards showing weekly approved jobs, ROI, and safeguard impact so I can justify budget and expansion."

**Control Plane Solution:**
- Executive analytics dashboard (KPI tiles, trends, filters)
- Automated narrative summaries (editable)
- Exportable board decks (PDF)
- Incident reports with mitigation notes
- Library reuse and success metrics

**Success Metrics:**
- Board prep time: 2 hours → 30 minutes
- Budget approval confidence: 90%
- ROI visibility: 100% coverage
- Risk committee sign-off rate: 95%

---

### Secondary Use Cases

**Agency Partners:**
Clone top-performing plays across clients, track performance deltas, package AI-led services efficiently

**Finance Ops Managers:**
Automate billing nudges and scheduling with oversight, reduce missed payments, maintain audit trails

**Marketing Ops Leads:**
Draft nurture sequences, enrich lead lists during inspection, prove lift before production execution

---

## Go-to-Market Strategy

### Phased Rollout

#### **Phase 1: Private Preview (Weeks 1-6)**

**Focus:** Co-design with 3 anchor customers (Revenue, Support, Technical)

**Deliverables:**
- Zero-privilege proof packs with ROI capture
- Dry-run loop optimized (<15 min p95)
- Evidence bundles for stakeholder demos
- Initial library seeded with 10 proven plays

**Success Criteria:**
- 100% anchor completion of ≥3 missions
- Generative acceptance rate ≥70%
- NPS ≥8 from pilot users
- Zero critical security incidents

---

#### **Phase 2: Limited GA (Weeks 7-12)**

**Focus:** Scale to 20 paying tenants, launch curated play bundles

**Deliverables:**
- Governed activation with OAuth (2+ toolkits)
- Analytics dashboards (executive & governance views)
- Play bundles: Outreach, Research, Support, Code
- Partner case studies (Assista AI, Fabrile)

**Success Criteria:**
- 60% inspection → governed conversion
- Library reuse rate: 3 plays/tenant/month
- Safeguard feedback closure time: <24h
- Revenue expansion: 40% QoQ

---

#### **Phase 3: Scale Push (Post-Quarter)**

**Focus:** Vertical playpacks, outcome-linked pricing pilots, co-marketing

**Deliverables:**
- Vertical plays (SaaS, E-commerce, Fintech, DevTools)
- Outcome pricing experiments (per-mission, per-outcome)
- Joint marketing with Composio, CopilotKit
- Enterprise compliance certifications (SOC 2, ISO 27001)

**Success Criteria:**
- 100+ tenants, 50+ agencies
- Median ARR: $36K
- Net retention: 120%
- Category leadership positioning

---

### Packaging Tiers

#### **Starter: Rapid Pilots**

**Target:** SMB operators, agencies testing AI augmentation

**Includes:**
- 1 objective stream
- 50 mission credits/month
- Library (read-only)
- Community support
- Shared analytics snapshot

**Pricing:** $499/month

---

#### **Growth: Scaled Operations**

**Target:** Mid-market teams, active automations

**Includes:**
- 5 objective streams
- 500 mission credits/month
- Library (full access + custom plays)
- Governance routing
- Priority support
- Executive dashboards

**Pricing:** $2,499/month

---

#### **Scale: Enterprise Governance**

**Target:** Regulated industries, multi-team deployments

**Includes:**
- Unlimited objectives
- Pooled credits (3,000+)
- Compliance reviews
- Custom integrations
- Dedicated success manager
- Outcome-based add-ons

**Pricing:** Custom (starts $10K/month)

---

## Key Metrics & Success Criteria

### North Star Metric

**Weekly Approved Agent Jobs per Active Account**

Measures sustained value delivery and trust maturation

---

### Adoption Funnel

| Stage | Metric | Target | Milestone |
|-------|--------|--------|-----------|
| **Onboarding** | % tenants completing first inspection within Day 1 | ≥70% | Foundation |
| **Time-to-Evidence** | Median minutes from intent to proof pack | ≤15 min | Foundation |
| **Inspection Conversion** | % missions advancing to governed execution | ≥60% | Core |
| **OAuth Adoption** | Avg connected toolkits per tenant @ Day 30 | ≥2 | Core |
| **Library Reuse** | Plays reused per tenant per month | ≥3 | Scale |
| **Retention** | Net retention rate (expansions - churn) | ≥110% | Scale |

---

### Quality & Trust Metrics

| Metric | Target | Source |
|--------|--------|--------|
| **Generative Acceptance Rate** | ≥80% chips accepted without regeneration | Intake telemetry |
| **Safeguard Auto-Fix Adoption** | ≥75% fixes applied vs. send-anyway | Validator feedback |
| **Undo Success Rate** | ≥95% rollbacks complete successfully | Evidence service |
| **Approval Throughput** | ≥85% approvals within 2 minutes | CopilotKit sessions |
| **Governance Feedback Closure** | <24 hours mean time to resolution | Safeguard events |

---

### Business Impact Metrics

| Persona | Metric | Expected Lift |
|---------|--------|---------------|
| **Revenue** | Pipeline attributed to agent actions | +25% QoQ |
| **Support** | Response time reduction | 40% faster |
| **Operations** | Manual task hours saved | 15 hours/week/user |
| **Executive** | Board prep time reduction | 75% faster |

---

## Strategic Partnerships

### Composio: Native SDK as Sole Integration Interface

**Value:** Production-ready SDK that spans discovery, authentication, execution, triggers, and telemetry across 500+ toolkits. Eliminates bespoke connectors, keeps OAuth within governed Connect Link flows, and exposes detailed audit logs for every mission.

**Integration:**
- **Discovery:** Inspector agents call `ComposioClient.tools.search()` + provider formatters to present capability previews without credentials.
- **Authentication:** Planner agents generate Connect Link URLs through `client.toolkits.authorize()` (fallback: `client.connected_accounts.link()` for custom configs), await connection, and persist granted scopes in Supabase for auditability.
- **Execution:** Executors stream tool calls via provider adapters (`provider.handle_tool_calls(...)`) or direct `client.tools.execute()` calls; triggers/workflows handle long-running tasks.
- **Governance:** Audit events (`client.audit.list_events`) and telemetry (`composio_tool_call`, `composio_auth_flow`) funnel into our readiness dashboards.

**Joint Goals:**
- Co-marketing: "Powered by Composio Native SDK" badge highlighting trust-aligned execution
- Shared customer references showcasing Connect Link approvals, trigger automation, and audit visibility
- Integration depth certifications covering catalog coverage, trigger adoption, and telemetry completeness

---

### CopilotKit: Human-in-the-Loop UX

**Value:** Streaming chat, approval modals, artifact previews, session persistence

**Integration:**
- CoAgents model for planner, executor, validator
- Frontend Actions for chip editing, play selection
- Interrupts for safeguard checkpoints
- Shared state for mission context

**Joint Goals:**
- Reference architecture publication
- Co-hosted workshops
- Integration showcases at conferences

---

### Gemini ADK: Agent Orchestration

**Value:** Coordinator patterns, eval suites, observability

**Integration:**
- Multi-agent coordination (Planner → Executor → Validator → Evidence)
- Session state management
- Checkpointed evaluations
- Audit trails

**Joint Goals:**
- Case study publication
- ADK best practices contribution
- Evaluation methodology sharing

---

### Supabase: Data Intelligence & Analytics

**Value:** Postgres with pgvector, edge functions, cron jobs, storage

**Integration:**
- Mission metadata and safeguard hints
- Library embeddings for play ranking
- Analytics views for dashboards
- Evidence bundle storage

**Joint Goals:**
- AI product showcase
- Vector search optimization insights
- Edge function use case documentation

---

## Risk Mitigation

### Risk: Value Proof Stalls Without Credentials

**Mitigation:**
- Ship polished no-auth inspection plays (campaign prep, competitor briefs)
- Spotlight upgrade pathways with case benchmarks
- Provide ROI calculators showing potential lift
- Offer free inspection credits for evaluation

---

### Risk: Scope Creep Toward Unsupervised Automation

**Mitigation:**
- Keep approvals mandatory by default
- Surface rollback instructions prominently
- Offer opt-in autopilot windows (limited scope)
- Governance dashboard highlights unsupervised usage

---

### Risk: Tool Discovery Overwhelm

**Mitigation:**
- Curate recommended toolkits per mission archetype
- Leverage cookbook recipes
- Surface relevant success stories in-product
- Provide "quick start" templates

---

### Risk: Partner Dependency Drift

**Mitigation:**
- Quarterly alignment meetings with roadmap sync
- Shared branding and co-marketing commitments
- Contractual SLA monitoring
- Multi-vendor fallback strategies where feasible

---

## Open Questions & Assumptions

### Open Questions

1. **Pricing Evolution:** When should outcome-based pricing pilots begin? (Assumption: Scale milestone unless GTM revises)
2. **Multi-Tenant Analytics:** Shared Supabase project or per-instance? (Assumption: per-instance for now)
3. **LLM Provider Mix:** Gemini primary, OpenAI fallback—prompt parity required? (Assumption: yes, with telemetry alignment)
4. **Trigger Coverage:** Expansion cadence depends on Composio roadmap sync—quarterly reviews scheduled?
5. **Enterprise Compliance:** SOC 2 Type II timeline? (Assumption: Q2 2026)

### Key Assumptions

- Redacted telemetry sufficient for compliance (no additional anonymization)
- Supabase functions available for rate limiting before promotion
- Supabase credentials accessible for type gen and cron
- CopilotKit SSE infrastructure stable for production
- Evidence bundles stored with versioning enabled
- Governance sentinel available for SOP review within sprint

---

## Conclusion

The AI Employee Control Plane replaces the legacy stage-gated paradigm with a **single unified system** that earns trust through transparency, proves value before requesting access, and scales safely with adaptive governance.

By combining **generative scaffolding**, **user-curated tool orchestration**, **adaptive safeguards**, and **evidence-first architecture**, we enable organizations to confidently augment operations with AI employees that plan, execute, and learn like top operators.

**The outcome:** Teams move from intent to measurable business outcomes in under 15 minutes, governance officers audit with confidence, and executives justify expansion with transparent ROI data.

**Next Steps:**

1. Validate vision with anchor customers (Revenue, Support, Governance operators)
2. Finalize partnership agreements (Composio, CopilotKit, ADK, Supabase)
3. Complete Foundation milestone implementation (inspection excellence, evidence integrity)
4. Prepare Limited GA launch assets (play bundles, case studies, pricing)
5. Establish board-level metrics dashboard (weekly approved jobs, NRR, incident rate)

---

**Document Owner:** Product Leadership
**Last Updated:** October 2025
**Related Documents:** `02_system_overview.md`, `03_user_experience.md`, `05_capability_roadmap.md`
