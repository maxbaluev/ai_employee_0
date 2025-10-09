# AI Employee Control Plane — Business PRD

Status: Drafted October 7, 2025 · Author: Growth & Operator Workflow PM · Audience: GTM, Product, Ops

## Executive Summary

The AI Employee Control Plane transforms high-intent objectives into measurable revenue, retention, and efficiency gains by pairing objective-led planning with managed execution through Model Context Protocol (MCP) servers. Teams can prove value in minutes via zero-privilege artifacts, then unlock connected automations once trust is earned, keeping approvals and evidence at the center of every run.

## Market Context & Problem

- Senior operators are under pressure to scale outreach, service, and internal operations without expanding headcount.
- Traditional automations demand full credentials up front, while lightweight copilots lack accountability and ROI data.
- Leadership teams need auditable artifacts, safeguards, and repeatable wins before committing budget to autonomous agents.

## Product Vision & Goals

Deliver an objective-first AI employee that plans, executes, and learns like a top operator: capability-aware, reversible, and always accountable. Success looks like every account describing a goal, seeing the smallest effective workflow, and reviewing evidence-backed results in less than 15 minutes, creating a clear path from pilot to scaled adoption. The UX blueprint (`new_docs/ux.md`) codifies the mission workspace experience that enables this outcome, emphasizing transparency, progressive trust, and accessibility.

## Target Customers & Jobs-to-Be-Done

- **Revenue Expansion Leads (GTM, agencies, growth squads):** Warm dormant accounts, launch tailored campaigns, and document ROI without hiring more SDRs.
- **Customer Operations & Support Leaders:** Compress response times, prevent churn, and uphold SLAs using blended human + agent workflows.
- **Business Operations Owners (SMB to mid-market):** Automate billing nudges, scheduling, and reporting while retaining oversight.
- **Technical Enablement Teams:** Safeguard code and integrations by routing agent-led changes through a code-only MCP with enforced approvals.
- **Executive Sponsors & Governance Officers:** Demand transparent evidence, approvals, and safeguard adherence before expanding budgets.

## Value Proposition & Differentiators

1. **Zero-to-value runway:** Composio’s catalog of 250+ toolkits across CRM, collaboration, finance, e-commerce, and vertical recipes powers artifact-first demos before credentials are shared.
2. **Proven outcomes:** Case studies such as Assista AI’s 90% reduction in go-to-market time and Fabrile’s rapid Google Workspace integrations validate business impact for stakeholders.
3. **Human-centered copilot UX:** CopilotKit-driven workspaces keep planners, reviewers, and agents in the same loop with explainable steps and suggested edits, adhering to the interaction patterns and accessibility guidance captured in `new_docs/ux.md`.
4. **Adaptive safeguards:** Generative safeguard hints (tone, timing, budget, escalation) accompany every mission, are editable in-place, and keep approvals lightweight instead of relying on static policy manuals.
5. **Compounding library:** Successful jobs and plays become a private asset catalog, enabling franchises and agencies to scale repeatable services.
6. **Generative scaffolding:** A single freeform input yields complete objectives, audiences, safeguard hints, toolkits, and plays that are fully editable before execution, accelerating onboarding while preserving oversight.
7. **Curated tool orchestration:** Users receive a visually ranked palette of Composio toolkits (no-auth first, OAuth-ready second) with impact and precedent signals, select the set they trust, and watch the AI employee validate data via MCP before any live action runs.

## Product Scope & Key Experiences (Business Lens)

- **Generative intake:** A single freeform input (text + links) is parsed into mission objectives, audiences, KPIs, safeguards, tone guidance, and risk posture, surfaced as editable chips.
- **Capability grounding:** The agent surfaces relevant MCP servers and toolkits, highlighting no-auth vs. OAuth requirements for approval with toolkit carousels, badges, and "Why this?" tooltips, all pre-populated from the generated brief.
- **Connection scaffolding:** Recommended OAuth scopes, quiet hours, and authentication paths are generated automatically with confidence scores and can be edited prior to activation.
- **Semantic tool search:** Mission planners query the Composio catalog in-context using `tools.get(search=..., limit=...)` and `tools.get_raw_composio_tools(...)`, allowing the workspace (or an upstream LLM) to converse about candidate actions (“hubspot organize contacts”, “repository issues”) before permissions are granted.
- **Trigger-ready plays:** Planner recommendations include event-driven workflows by querying Composio trigger types; users can opt into MCP-triggered automations (e.g., “GitHub issue created”, “Slack reaction added”) with the same approval rigor.
- **Plan proposals:** Users receive Top-3 Predicted Jobs and Play candidates with Why, Impact, Risk, Proof, and Undo narratives surfaced as selectable play cards with inline metadata.
- **Collaborative tool palette:** Recommended toolkits appear as a generative carousel with badges for auth state, expected impact, and precedent missions. Users can multi-select to shape the MCP plan, preview inspection results, and iterate before approving execution.
- **Dry-run proof packs:** Zero-privilege mode generates drafts, lists, and schedules for stakeholder review before live permissions, presented through artifact preview cards and evidence bundles.
- **Governed activation:** Connected mode executes the same plays through confirmed MCP toolkits with reviewer approvals and adaptive safeguards enforced per mission, routed through the approval flows defined in the UX blueprint.
- **Evidence & coaching:** Dashboards highlight ROI deltas, artifacts, safeguard feedback, and “next best job” recommendations drawn from the library, matching the analytics storytelling surfaces described in `new_docs/ux.md`.

## Detailed Requirements & Acceptance Criteria

### CopilotKit Experience
- Mission chat, contextual briefs, approval modals, and artifact previews must all run on CopilotKit CoAgents using shared state; persistence is required via Supabase Postgres tables (CopilotKit message/state storage) so reviewers can reload or transfer conversations without losing context. Layout, navigation, and component behavior should follow the mission workspace anatomy in `new_docs/ux.md` (generative intake banner, editable chip stack, mission sidebar, streaming status panel, safeguard drawer).
- The system must parse a single freeform input into structured mission data (objective, audience, KPIs, safeguards, suggested tools) with confidence scores, expose each element as editable chips, and support regenerate/edit/replace actions without leaving the workspace.
- The workspace must render a recommended tool palette that pairs Composio metadata (auth status, scopes, impact heuristics) with narrative summaries so users can curate the toolkit mix before the planner locks a mission plan.
- Each long-running node (planner ranking, executor synthesis, validator audits) must provide interim feedback through `copilotkit_emit_message`, and successful/aborted runs must call `copilotkit_exit` so routers regain control cleanly.
- UI components (Agentic Chat, Generative UI, Frontend Actions) expose reviewer levers for edits, approvals, undo, trigger enrollment, and risk acknowledgements. These surfaces must remain accessible on desktop and tablet breakpoints and comply with the accessibility and keyboard navigation standards in the UX blueprint. Generative outputs require explicit affordances for "Accept", "Edit", "Regenerate", and "Reset to previous".
- Message history hygiene and redaction controls must exist so governance teams can remove sensitive strings while maintaining evidence pointers.

### Agent Orchestration & ADK Expectations
- Coordinator, planner, executor, validator, and evidence agents run on Gemini ADK with deterministic `_run_async_impl` branches for conditional loops (e.g., regenerate plays if tone check fails). Shared state (`ctx.session.state`) stores mission metadata, safeguard hints, and evidence references.
- Intake orchestration must include a generative parser step that converts the single input into structured mission data, writes confidence scores, and tracks user edits/regenerations for observability.
- Checkpointed evaluations (`adk eval`) must replay top missions across dry-run and governed modes, confirming stable outcomes before promotion.
- Orchestration logs capture tool calls, approvals, and undo instructions with IDs that align to Supabase tables and UI events.

### Tooling & Integrations
- Composio usage follows the official SDK guidance: limit tool payloads, scope searches, avoid mixing filters, and capture auth evidence (`redirectUrl`, `connectedAccountId`, scopes).
- Generative recommendations for toolkits and scopes must include rationale and align with Composio's available metadata; suggestions default to `no_auth` where possible and highlight required OAuth upgrades.
- MCP inspection passes must run after tool selection and before live execution so users can validate sample data and safeguard implications without committing credentials.
- Trigger lifecycle (list/get/create/subscribe/disable) is first-class; proof packs expose event-based automations with required payload templates and reviewer toggles.
- Supabase hosts objectives, plays, tool calls, approvals, artifacts, triggers, and library embeddings. Vector search leverages pgvector with indexes sized per tenant. PostgREST and Edge Functions provide the API surfaces consumed by the frontend.
- Supabase Cron handles analytics rollups; Edge Functions deliver streaming evidence search and ROI calculations without exposing secrets client-side.

### Adaptive Safeguards
- Intake must generate safeguard hints (tone guidance, suggested quiet windows, escalation contacts, optional spend caps) with confidence scores; reviewers can accept, edit, or regenerate.
- Accepted hints are stored alongside the mission and become part of validator context; their adoption rate feeds the analytics views documented in the architecture blueprint.
- Approvals surface only the safeguards relevant to the pending action, offering one-click fixes where possible (e.g., auto-soften tone, schedule later, request escalation).
- Safeguard feedback (accepted, edited, rejected, auto-fixed) is logged so product teams can tune prompts and highlight common patterns.

### Evidence, Analytics & Governance
- Each mission generates an evidence bundle: mission brief, tool outputs (redacted), ROI estimates, risk notes, undo plan, and telemetry summary. Bundles are reviewable in CopilotKit and exportable via Supabase APIs.
- Dashboards present dry-run conversion, approval throughput, safeguard feedback, and library reuse. Data must be filterable by tenant, persona, and checkpoint state.
- Safeguard telemetry (hint adoption, auto-fixes, reviewer overrides, undo outcomes) must sync with Supabase analytics views and appear in weekly governance reports.

### Non-Functional Requirements
- **Latency:** Dry-run loop ≤15 minutes end-to-end; streaming updates surface within 5 seconds of agent emission.
- **Generative Intake Latency:** Initial mission brief generation ≤3 seconds p95 for 1k-character inputs; regeneration ≤2 seconds p95.
- **Reliability:** Daily Cron sync success rate ≥99%; trigger subscription health monitored with automated alerts.
- **Security:** Row Level Security on all Supabase tables; OAuth tokens encrypted, rotated, and never serialized to prompts or logs.
- **Guardrail Overhead:** Validator checks and interrupt handling add <200ms p95 latency per governed tool call.
- **Observability:** Unified log correlation across CopilotKit, ADK, Composio, and Supabase with run IDs accessible to operations.
- **Scalability:** Support 20 concurrent governed missions with maintained latency targets by Gate G-D.

### Stakeholder Sign-Off Criteria
- Governance officers can audit any mission’s approvals, toolkits, and undo plans via UI or API.
- GTM leads can demonstrate at least three dry-run wins per persona during pilots, using evidence packs as collateral.
- Technical enablement validates MCP-triggered workflows and repo-safe change management before expanding scope.

## Metrics & Success Criteria

- **North Star:** Weekly approved agent jobs per active account.
- **Adoption:** ≥70% of new tenants complete a Dry Run within Day 1; median time from objective to evidence under 15 minutes.
- **Expansion:** 60% of zero-privilege tenants connect at least two MCP servers within 30 days; average of three plays reused per tenant per month.
- **Retention & Advocacy:** Library reuse rate, reviewer NPS, and governance satisfaction (caps honored, rollback clarity).
- **Operational Safety:** Guardrail incident rate <5% of governed runs; override closure time <24 hours; undo success rate ≥95%.
- **Generative Quality:** ≥80% of generated brief items accepted without regeneration (or edited with <3 interactions); confidence scores align with edit behavior.

## Go-to-Market & Packaging Outline

- **Private Preview (Weeks 1–6):** Co-design with three anchor customers (GTM, support, technical enablement) emphasizing zero-privilege proof packs and ROI capture.
- **Limited GA (Weeks 7–12):** Open to 20 paying tenants, launch curated play bundles (outreach, research, support), and publish evidence dashboards.
- **Scale Push (Post-Quarter):** Introduce vertical playpacks, outcome-linked pricing pilots, and joint marketing moments with Composio and CopilotKit.
- **Packaging:**
  - _Starter:_ One objective stream, limited toolkits, shared analytics snapshot for rapid pilots.
  - _Growth:_ Multiple objectives, higher job credits, library ranking, and governance routing.
  - _Scale:_ Pooled credits, executive analytics, compliance reviews, and outcome-based add-ons.

## Dependencies & Partnerships

- **Composio:** Tooling breadth, OAuth flows, and case-study storytelling to anchor proof-of-value narratives.
- **CopilotKit:** Human-in-the-loop surfaces (workspace, approvals, library) that mirror operator workflows and reinforce trust.
- **ADK & Agent Frameworks:** Objective-first orchestration, multi-agent coordination, and consistent audit trails that align with governance requirements.
- **Supabase Analytics:** Centralized queueing, evidence storage, and ROI dashboards backing enterprise reporting needs.

## Risks & Mitigations

- **Value proof stalls without credentials:** Ship polished zero-privilege plays (campaign prep, competitor briefs, scheduling proposals) and spotlight upgrade pathways with case-study benchmarks.
- **Scope creep toward unsupervised automation:** Keep approvals mandatory by default, surface rollback instructions, and offer opt-in autopilot windows.
- **Tool discovery overwhelm:** Curate recommended toolkits per persona, leverage cookbook recipes, and surface relevant success stories in-product.
- **Partner dependency drift:** Schedule quarterly alignment with Composio, CopilotKit, and ADK teams on roadmap, branding, and co-marketing commitments.

## Open Questions & Assumptions

- **Pricing evolution:** Outcome-based pricing pilots may require additional telemetry beyond current scope; assume pricing experiments start Gate G-D unless GTM revises.
- **Multi-tenant analytics:** Assumes Supabase project per control-plane instance; if shared, RLS rules and anon key scopes must be revisited.
- **LLM provider mix:** Primary guidance targets Gemini via ADK; assume OpenAI fallback remains allowable but requires prompt/telemetry alignment work.
- **Trigger coverage:** Initial trigger catalog based on Composio availability as of October 8, 2025; expansion cadence depends on partner roadmap syncs.

## User Stories

- **Revenue Lead:** As a director of business development, I want to submit a quarterly pipeline goal and receive three ready-to-run outreach plays so I can revive dormant accounts without expanding headcount.
- **Marketing Ops Manager:** As the owner of lifecycle campaigns, I want zero-privilege plays that return enriched lead lists and draft nurture sequences so I can demonstrate lift before granting send permissions.
- **Customer Support Leader:** As a head of support, I want safeguarded automations that surface churn-risk cases, propose responses, and log evidence so my team meets SLAs confidently.
- **Finance & Admin Owner:** As an operations manager, I want approved billing nudges and scheduling workflows so I can reduce manual follow-up and missed payments.
- **Technical Enablement Lead:** As a platform engineer, I want code changes routed through a code MCP with reviewer checkpoints so I can enable agent-led fixes without compromising repo hygiene.
- **Executive Sponsor:** As a COO, I want dashboards summarizing ROI, approvals, and safeguard outcomes so I can justify expansion and maintain compliance posture.
- **Security & Governance Officer:** As a compliance lead, I want visibility into who approved each automation, what toolkits were used, and how rollback works so I can greenlight broader usage.
- **Agency Partner:** As a service provider, I want to clone top-performing plays across clients and track performance deltas so I can package AI-led services efficiently.
