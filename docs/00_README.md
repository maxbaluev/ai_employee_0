# AI Employee Control Plane: Documentation Guide

**Version:** 3.2 (October 2025)
**Purpose:** Navigate the AI Employee Control Plane documentation suite
**Audience:** All stakeholders — Product, Engineering, Operations, Governance, Partners

> **Seven-Stage Mission Journey:** All docs align to the consolidated lifecycle — **Stage 0 (Home Overview), Stage 1 (Define), Stage 2 (Prepare), Stage 3 (Plan), Stage 4 (Approve), Stage 5 (Execute), Stage 6 (Reflect)**.

---

## How to Use This Documentation

This documentation is organized as a **sequential knowledge base** that enables understanding and building the AI Employee Control Plane from scratch. **The platform architecture calls for a Gemini ADK-driven agent backend tightly coupled with Composio state management** (Foundation stage: scaffolded with TODOs; full ADK agent implementation deferred to Core/Scale milestones). Documents are numbered for suggested reading order, but you can jump to specific topics based on your role.

> **Foundation Stage Note (October 2025):** The Gemini ADK backend (`agent/agent.py`) is currently scaffolded with placeholder TODO comments. Real ADK agent implementations (Coordinator, Intake, Inspector, Planner, Validator, Executor, Evidence), Google GenAI API calls, and evaluation configs are not yet wired up. Documentation describes the target architecture to guide future implementation. See `docs/backlog.md` Theme 1 (TASK-ADK-*) for implementation roadmap.

---

## Quick Navigation

### Core Documentation (Read in Order)

1. **[Product Vision](./01_product_vision.md)** — Strategic direction, value proposition, example missions, use cases
2. **[System Overview](./02_system_overview.md)** — **Planned ADK agent architecture** (scaffolded), data flows, Composio integration, technical specifications
3. **[User Experience Playbook](./03_user_experience.md)** — Seven-stage journey, agent-driven interaction patterns, illustrative operators, accessibility
4. **[Chat Experience Guide](./03a_chat_experience.md)** — CopilotKit rail behaviour, agent narration, message types, telemetry hooks
5. **[Implementation Guide](./04_implementation_guide.md)** — **Planned Gemini ADK agent development** (scaffolded), Composio SDK patterns, component catalog, library docs cross-references
6. **[Capability Roadmap](./05_capability_roadmap.md)** — Milestone-based roadmap with evidence requirements
7. **[Data Intelligence](./06_data_intelligence.md)** — Telemetry, analytics, learning loops, agent performance metrics
8. **[Operations Playbook](./07_operations_playbook.md)** — Deployment, monitoring, agent orchestration, incident response, runbooks
9. **[Getting Started](./08_getting_started.md)** — Environment setup, running the ADK agent stack, first mission walkthrough
10. **[Release Readiness](./09_release_readiness.md)** — Cross-functional checklists, evidence artifacts, sign-off process
11. **[Issue Tracking & Dependency Graph](./11_issue_tracking.md)** — `bd` workflow, dependency hygiene, automation safeguards
12. **[Service Architecture Foundation](./12_service_architecture.md)** — Service module contracts for Composio, Supabase, telemetry, and session state

### Special Purpose Documents

- **[AI Agent Guide (AGENTS.md)](../AGENTS.md)** — Quick reference for AI agents working with this codebase
- **[Todo List (todo.md)](./todo.md)** — Actionable next steps referencing the unified documentation
- **[Trust Model & Composio Integration](./10_composio.md)** — **Progressive trust staging with ADK agents**, Composio SDK alignment, OAuth flows, and chat touchpoints
- **[Issue Tracking & Dependency Graph](./11_issue_tracking.md)** — External `bd` issue tracker quickstart for human/agent operators
- **[Service Architecture Foundation](./12_service_architecture.md)** — Detailed guide to `agent/services/*` modules and follow-up tasks

---

## Reading Paths by Role

### Product Managers & Leadership

**Goal:** Understand vision, strategy, metrics, and customer value

**Recommended Path:**

1. [Product Vision](./01_product_vision.md) — Market context, value prop, GTM strategy
2. [User Experience Playbook](./03_user_experience.md) — Seven-stage journey, illustrative operators, accessibility guardrails
3. [Chat Experience Guide](./03a_chat_experience.md) — How the CopilotKit rail keeps missions collaborative
4. [Capability Roadmap](./05_capability_roadmap.md) — Milestone plan with dependencies
5. [Release Readiness](./09_release_readiness.md) — Launch criteria and sign-off process
6. [Data Intelligence](./06_data_intelligence.md) — Analytics dashboards and success metrics

**Key Questions Answered:**

- What problem does this solve and for whom?
- What are the strategic differentiators?
- How do we measure success?
- What's the roadmap and when do capabilities ship?

---

### Engineering Teams

**Goal:** Build, extend, and maintain the Control Plane

**Recommended Path:**

1. [Getting Started](./08_getting_started.md) — Setup environment and review scaffolded ADK agent stack
2. [System Overview](./02_system_overview.md) — **Planned Gemini ADK agent architecture** (Foundation stage: scaffolded with TODOs)
3. [Implementation Guide](./04_implementation_guide.md) — **Planned ADK agent development patterns** (scaffolded), Composio SDK patterns, component catalog
4. [Trust Model & Composio Integration](./10_composio.md) — Progressive trust flows (planned), agent responsibilities, OAuth handling
5. [Chat Experience Guide](./03a_chat_experience.md) — Chat APIs, agent narration, interrupts, telemetry hooks
6. [AGENTS.md](../AGENTS.md) — Quick setup, ADK toolchain, agent scaffolding notes
7. [Capability Roadmap](./05_capability_roadmap.md) — Technical milestones and dependencies
8. [Operations Playbook](./07_operations_playbook.md) — Deployment, agent orchestration, monitoring, runbooks
9. [Backlog](./backlog.md) — Theme 1: ADK Agent Implementation roadmap (TASK-ADK-001 through TASK-ADK-008)

**Key Questions Answered:**

- How do I set up my development environment with scaffolded ADK backend?
- What's the planned ADK agent architecture and how will agents coordinate with Composio? (Foundation: design documented, implementation pending)
- Where will agent capabilities be implemented and what patterns should be followed? (See `docs/backlog.md` Theme 1)
- How will agents manage state across the mission lifecycle? (Design complete, implementation deferred)
- What are the next implementation steps? (See `docs/backlog.md` for ADK agent tasks)

---

### Operations & SRE

**Goal:** Deploy, monitor, and maintain production reliability

**Recommended Path:**

1. [Issue Tracking & Dependency Graph](./11_issue_tracking.md) — `bd` CLI quickstart for operator task tracking (external to product runtime)
2. [Operations Playbook](./07_operations_playbook.md) — Deployment, monitoring, incident response
3. [System Overview](./02_system_overview.md) — Architecture and performance targets
4. [Getting Started](./08_getting_started.md) — Environment setup for troubleshooting
5. [Release Readiness](./09_release_readiness.md) — Pre-release checklists
6. [Data Intelligence](./06_data_intelligence.md) — Telemetry and observability

**Key Questions Answered:**

- How do I capture and sequence operational work in `bd`?
- How do I deploy to different environments?
- What should I monitor and alert on?
- How do I respond to incidents?
- Where are the runbooks and escalation paths?

---

### Governance & Compliance

**Goal:** Ensure safety, auditability, and regulatory compliance

**Recommended Path:**

1. [Product Vision](./01_product_vision.md) — Trust model, safeguards philosophy
2. [User Experience Playbook](./03_user_experience.md) — Approval workflows, evidence generation
3. [System Overview](./02_system_overview.md) — Security architecture, audit trails
4. [Data Intelligence](./06_data_intelligence.md) — Governance dashboards, analytics
5. [Release Readiness](./09_release_readiness.md) — Security and compliance checklists
6. [Operations Playbook](./07_operations_playbook.md) — Security controls, compliance procedures

**Key Questions Answered:**

- How are actions authorized and audited?
- What safeguards prevent unauthorized behavior?
- How do we generate compliance evidence?
- What's the undo/rollback mechanism?

---

### Data & Analytics Teams

**Goal:** Instrument telemetry, build dashboards, enable learning loops

**Recommended Path:**

1. [Data Intelligence](./06_data_intelligence.md) — Event catalog, analytics views, learning loops
2. [User Experience Playbook](./03_user_experience.md) — Stage-to-event matrix
3. [System Overview](./02_system_overview.md) — Data layer architecture
4. [Implementation Guide](./04_implementation_guide.md) — Telemetry client implementation
5. [Capability Roadmap](./05_capability_roadmap.md) — Analytics milestones

**Key Questions Answered:**

- What events are emitted and what do they contain?
- How do I add new telemetry or analytics views?
- What dashboards exist and how are they refreshed?
- How do learning loops improve the system?

---

### UX & Design Teams

**Goal:** Understand user flows, interaction patterns, accessibility requirements

**Recommended Path:**

1. [User Experience Playbook](./03_user_experience.md) — Seven-stage flow, patterns, accessibility
2. [Chat Experience Guide](./03a_chat_experience.md) — Message design, interrupts, accessibility copy
3. [Product Vision](./01_product_vision.md) — Personas, use cases, value proposition
4. [Implementation Guide](./04_implementation_guide.md) — Component catalog, Storybook
5. [System Overview](./02_system_overview.md) — CopilotKit integration patterns
6. [Data Intelligence](./06_data_intelligence.md) — Telemetry for UX insights

**Key Questions Answered:**

- How do the seven mission stages work together and what are the handoffs?
- What interaction patterns should I follow?
- What are the accessibility requirements?
- How do I verify telemetry fires for UX events?

---

### Partner Integration Teams

**Goal:** Understand integration points with Composio, CopilotKit, Gemini ADK, Supabase

**Recommended Path:**

1. [System Overview](./02_system_overview.md) — Integration patterns and data flows
2. [Implementation Guide](./04_implementation_guide.md) — SDK usage, API contracts
3. [Product Vision](./01_product_vision.md) — Strategic partnerships
4. [Capability Roadmap](./05_capability_roadmap.md) — Integration milestones
5. [Getting Started](./08_getting_started.md) — Test integrations locally

**Key Questions Answered:**

- How does the Control Plane integrate with our platform?
- What APIs and patterns are used?
- What are the joint success metrics?
- Where are the reference implementations?

---

## Key Terminology

To maintain consistency across all documentation, use these preferred terms:

**Mission Lifecycle:**

- **Seven-Stage Journey:** Stage 0 (Home Overview) → Stage 1 (Define) → Stage 2 (Prepare) → Stage 3 (Plan) → Stage 4 (Approve) → Stage 5 (Execute) → Stage 6 (Reflect) (user-facing stages)
- **Stage 2 — Prepare (Inspector):** Conducts no-auth discovery, previews anticipated scopes, and—once stakeholders approve—initiates every Connect Link OAuth flow. All granted scopes are logged before planning begins.
- **Stage 3 — Plan (Planner):** Works entirely from established connections to assemble ranked mission plays grounded in tool usage patterns, data investigation output, and library precedent; never requests new scopes.
- **Stage 4 — Approve:** Dedicated approval checkpoint with stakeholder review and audit trail before execution.
- **Four-Layer Architecture:** Presentation → Orchestration → Execution → Data (technical stack layers)

**Trust & Authorization:**

- **No-Auth Inspection:** Read-only, public data exploration and preview generation without requiring OAuth credentials. Used for demos, proof-of-value artifacts, and fast iteration. No write actions or sensitive data access. (Preferred over "zero-privilege" or "OAuth inspection")
- **Governed Execution:** OAuth-authenticated mission execution with user approvals and safeguard enforcement. Required for all write actions, sensitive data access, and production workflows. (Preferred over "governed activation")
- **Progressive Trust:** The model of proving value through no-auth inspection artifacts before requesting OAuth credentials—earning access rather than assuming it

**Agents (Gemini ADK):**

- **Coordinator, Intake, Planner, Inspector, Executor, Validator, Evidence** — Capitalize when referring to specific ADK agent roles
- **Agent State Management** — Shared session state via `ctx.session.state` enables stateful coordination across agents
- **Agent Coordination** — Multi-agent orchestration through ADK's `BaseAgent`, `LlmAgent`, and custom agent patterns

**Integrations:**

- **Composio SDK, CopilotKit, Gemini ADK, Supabase** — Partner technology names (always capitalized)
- **Composio SDK** — The sole supported interface for toolkit execution. Use `ComposioClient` for discovery, Connect Links for OAuth, provider adapters for LLM-specific execution, and triggers/workflows for async orchestration. Mission scoping relies on passing the `user_id` + `tenantId` pair to every call—no presigned URLs required.

---

## Documentation Standards

### Structure

- **Version & Audience** — Every doc declares version, target audience, and status
- **Table of Contents** — Long docs include navigation aids
- **Cross-References** — Links use relative paths and reference line numbers where helpful
- **Examples** — Concrete scenarios, code snippets, and diagrams support concepts
- **Appendices** — Supporting material (matrices, checklists, contact info) at end

### Maintenance

- **Quarterly Reviews** — Product, Engineering, and Operations leads review for accuracy
- **Change Control** — Major updates require RFC and stakeholder review
- **Evidence Artifacts** — Link to `docs/readiness/*` for milestone proof
- **Feedback** — Submit issues to `docs/readiness/feedback/` or tag `@ai-agent-team`

---

## Additional Resources

### Partner SDK References

- **[CopilotKit](../libs_docs/copilotkit/llms-full.txt)** — CoAgents, streaming, interrupts, frontend action patterns
- **[Composio SDK](../libs_docs/composio/llms.txt)** — Quickstart, Providers, Authenticating Tools, Executing Tools, Triggers, and Connect Links for end-to-end mission workflows using native APIs.
- **[Gemini ADK](../libs_docs/adk/llms-full.txt)** — Agent orchestration, multi-agent coordination, evaluation frameworks
- **[Supabase](../libs_docs/supabase/llms_docs.txt)** — Database, storage, edge functions, real-time subscriptions

### Diagrams

Located in `diagrams/` (Mermaid format):

- `seven_stage_journey.mmd` — Mission workflow visualization
- `adaptive_safeguards_lifecycle.mmd` — Safeguard generation and enforcement
- `end_to_end_data_flow.mmd` — System-wide data movement
- `library_learning_loop.mmd` — Play reuse and learning
- `partner_integration_map.mmd` — External integration points

### Examples

Real-world case studies and narrative examples live in `docs/examples/`:

- `coder.md` — Professional AI programmer delivering an authentication refactor mission
- `revops.md` — Revenue operations case study with seven-stage walkthrough
- `support_leader.md` — Support leader navigating incident triage
- `compliance_audit.md` — Governance lead conducting quarterly review

### Evidence Artifacts

Located in `docs/readiness/`:

- Milestone acceptance reports
- Performance benchmarks
- Security audits
- Compliance checklists
- Runbooks for incident response

---

## Frequently Asked Questions

### Where do I start if I'm new to the project?

1. Read [Product Vision](./01_product_vision.md) to understand the "why"
2. Follow [Getting Started](./08_getting_started.md) to run the system locally
3. Walk through a mission end-to-end using [User Experience Playbook](./03_user_experience.md)
4. Dive into [System Overview](./02_system_overview.md) and [Implementation Guide](./04_implementation_guide.md) based on your role

### How do I find specific technical details?

- **Architecture & Data Flows:** [System Overview](./02_system_overview.md)
- **Component Implementation:** [Implementation Guide](./04_implementation_guide.md)
- **API Contracts:** [System Overview](./02_system_overview.md) § Control Plane APIs
- **Agent Logic:** [Implementation Guide](./04_implementation_guide.md) § Backend Agents

### Where are the runbooks for production incidents?

- Primary location: [Operations Playbook](./07_operations_playbook.md) § Incident Response
- Detailed runbooks: `docs/readiness/runbooks/*.md`
- Quick reference: [AGENTS.md](../AGENTS.md) § Troubleshooting Cheatsheet

### How do I propose changes to the documentation?

1. Create an RFC in `docs/rfcs/` if major conceptual change
2. Submit PR with updates to affected docs
3. Tag Product, UX, Engineering, and Trust leads for review
4. Update `Last Updated` date and version if substantial
5. Add entry to weekly changelog

### Where can I get help?

- **Internal:** Slack `#ai-control-plane` or tag `@ai-agent-team`
- **Partners:** Contact details in [Operations Playbook](./07_operations_playbook.md) § Contacts
- **External:** GitHub issues at repository (if public) or partner support channels

---

## Document Change Log

| Date     | Version | Changes                                                                                                                                                                                                                                                        | Author                        |
| -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Oct 2025 | 3.2     | Added Chat Experience Guide (03a); wove chat narrative into System Overview, User Experience, and Trust Model docs; updated navigation paths and changelog                                                                                                     | Documentation Team            |
| Oct 2025 | 3.1     | Documentation audit: Added Operations Playbook (07) and Release Readiness (09); renumbered Getting Started to 08; fixed examples directory references; added Inspector agent documentation; enhanced library docs cross-references; improved AGENTS.md clarity | AI Agent + Documentation Team |
| Oct 2025 | 3.0     | Seven-stage mission journey migration — consolidated docs, updated diagrams, created narrative examples                                                                                                                                                         | Product & Engineering         |
| Aug 2025 | 2.0     | Unified documentation overhaul — removed gate terminology, added milestone-based roadmap, created navigation guide                                                                                                                                             | Product & Engineering         |

---

**Document Owner:** Documentation Team
**Last Updated:** October 2025
**Next Review:** January 2026
**Feedback:** Submit to `docs/readiness/feedback/` or tag `@ai-agent-team`
