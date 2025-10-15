# AI Employee Control Plane: Documentation Guide

**Version:** 3.0 (October 2025)
**Purpose:** Navigate the AI Employee Control Plane documentation suite
**Audience:** All stakeholders — Product, Engineering, Operations, Governance, Partners

> **Five-Stage Mission Journey:** All docs align to the consolidated lifecycle — **Define, Prepare, Plan & Approve, Execute & Observe, Reflect & Improve**.

---

## How to Use This Documentation

This documentation is organized as a **sequential knowledge base** that enables understanding and building the AI Employee Control Plane from scratch. Documents are numbered for suggested reading order, but you can jump to specific topics based on your role.

---

## Quick Navigation

### Core Documentation (Read in Order)

1. **[Product Vision](./01_product_vision.md)** — Strategic direction, value proposition, personas, use cases
2. **[System Overview](./02_system_overview.md)** — Architecture, data flows, technical specifications
3. **[User Experience Blueprint](./03_user_experience.md)** — Five-stage journey, interaction patterns, accessibility
4. **[Implementation Guide](./04_implementation_guide.md)** — Development setup, component catalog, integration patterns
5. **[Capability Roadmap](./05_capability_roadmap.md)** — Milestone-based roadmap with evidence requirements
6. **[Data Intelligence](./06_data_intelligence.md)** — Telemetry, analytics, learning loops
7. **[Operations Playbook](./07_operations_playbook.md)** — Deployment, monitoring, incident response, runbooks
8. **[Getting Started](./08_getting_started.md)** — Environment setup, running the stack, first mission walkthrough
9. **[Release Readiness](./09_release_readiness.md)** — Cross-functional checklists, evidence artifacts, sign-off process

### Special Purpose Documents

- **[AI Agent Guide (AGENTS.md)](../AGENTS.md)** — Quick reference for AI agents working with this codebase
- **[Todo List (todo.md)](./todo.md)** — Actionable next steps referencing the unified documentation

---

## Reading Paths by Role

### Product Managers & Leadership

**Goal:** Understand vision, strategy, metrics, and customer value

**Recommended Path:**
1. [Product Vision](./01_product_vision.md) — Market context, value prop, GTM strategy
2. [User Experience Blueprint](./03_user_experience.md) — Five-stage journey, personas
3. [Capability Roadmap](./05_capability_roadmap.md) — Milestone plan with dependencies
4. [Release Readiness](./09_release_readiness.md) — Launch criteria and sign-off process
5. [Data Intelligence](./06_data_intelligence.md) — Analytics dashboards and success metrics

**Key Questions Answered:**
- What problem does this solve and for whom?
- What are the strategic differentiators?
- How do we measure success?
- What's the roadmap and when do capabilities ship?

---

### Engineering Teams

**Goal:** Build, extend, and maintain the Control Plane

**Recommended Path:**
1. [Getting Started](./08_getting_started.md) — Setup environment and run first mission
2. [System Overview](./02_system_overview.md) — Architecture, layers, data flows
3. [Implementation Guide](./04_implementation_guide.md) — Component catalog, patterns, testing
4. [AGENTS.md](../AGENTS.md) — Quick setup, toolchain, workflows
5. [Capability Roadmap](./05_capability_roadmap.md) — Technical milestones and dependencies
6. [Operations Playbook](./07_operations_playbook.md) — Deployment, monitoring, runbooks

**Key Questions Answered:**
- How do I set up my development environment?
- What's the system architecture and how do components interact?
- Where do I add new features and what patterns should I follow?
- How do I test, deploy, and monitor changes?

---

### Operations & SRE

**Goal:** Deploy, monitor, and maintain production reliability

**Recommended Path:**
1. [Operations Playbook](./07_operations_playbook.md) — Deployment, monitoring, incident response
2. [System Overview](./02_system_overview.md) — Architecture and performance targets
3. [Getting Started](./08_getting_started.md) — Environment setup for troubleshooting
4. [Release Readiness](./09_release_readiness.md) — Pre-release checklists
5. [Data Intelligence](./06_data_intelligence.md) — Telemetry and observability

**Key Questions Answered:**
- How do I deploy to different environments?
- What should I monitor and alert on?
- How do I respond to incidents?
- Where are the runbooks and escalation paths?

---

### Governance & Compliance

**Goal:** Ensure safety, auditability, and regulatory compliance

**Recommended Path:**
1. [Product Vision](./01_product_vision.md) — Trust model, safeguards philosophy
2. [User Experience Blueprint](./03_user_experience.md) — Approval workflows, evidence generation
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
2. [User Experience Blueprint](./03_user_experience.md) — Stage-to-event matrix
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
1. [User Experience Blueprint](./03_user_experience.md) — Five-stage flow, patterns, accessibility
2. [Product Vision](./01_product_vision.md) — Personas, use cases, value proposition
3. [Implementation Guide](./04_implementation_guide.md) — Component catalog, Storybook
4. [System Overview](./02_system_overview.md) — CopilotKit integration patterns
5. [Data Intelligence](./06_data_intelligence.md) — Telemetry for UX insights

**Key Questions Answered:**
- How do the five mission stages work together and what are the handoffs?
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

- **[CopilotKit](../libs_docs/copilotkit/llms-full.txt)** — CoAgents, streaming, interrupts
- **[Composio](../libs_docs/composio/llms.txt)** — Discovery, auth, execution, triggers
- **[Gemini ADK](../libs_docs/adk/llms-full.txt)** — Agent orchestration, evaluation
- **[Supabase](../libs_docs/supabase/llms_docs.txt)** — Database, storage, edge functions

### Diagrams

Located in `diagrams/` (Mermaid format):
- `five_stage_journey.mmd` — Mission workflow visualization
- `adaptive_safeguards_lifecycle.mmd` — Safeguard generation and enforcement
- `end_to_end_data_flow.mmd` — System-wide data movement
- `library_learning_loop.mmd` — Play reuse and learning
- `partner_integration_map.mmd` — External integration points

### Examples

Canonical narratives live in `docs/new_examples/`:
- `coder.md` — Professional AI programmer delivering an authentication refactor mission

Legacy narratives are still available in `docs/new_exampels/` (retained for backward compatibility):
- `revops.md` — Revenue operations case study with five-stage walkthrough
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
3. Walk through a mission end-to-end using [User Experience Blueprint](./03_user_experience.md)
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

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| Oct 2025 | 3.0 | Five-stage mission journey migration — consolidated docs, updated diagrams, created narrative examples | Product & Engineering |
| Aug 2025 | 2.0 | Unified documentation overhaul — removed gate terminology, added milestone-based roadmap, created navigation guide | Product & Engineering |
| (Future) | | | |

---

**Document Owner:** Documentation Team
**Last Updated:** October 2025
**Next Review:** January 2026
**Feedback:** Submit to `docs/readiness/feedback/` or tag `@ai-agent-team`
