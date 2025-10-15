# AI Employee Control Plane — Example Missions & Telemetry

**Purpose:** Reference mission scenarios, telemetry samples, and integration examples

**Status:** Structure defined, examples pending creation

---

## Example Mission Files

Mission examples demonstrate the eight-stage flow for different personas and use cases.

### Revenue Use Cases
- [ ] **mission_example_revenue.json** — Dormant account win-back campaign
  - Persona: Revenue Expansion Lead
  - Toolkits: HubSpot (enrichment), Gmail (outreach)
  - Key Features: Tone safeguards, quiet window enforcement, undo plan

### Customer Operations Use Cases
- [ ] **mission_example_support.json** — Churn-risk ticket triage and response
  - Persona: Customer Operations Leader
  - Toolkits: Zendesk (ticket fetch), Slack (escalation)
  - Key Features: SLA tracking, warm tone validation, approval checkpoints

### Governance Use Cases
- [ ] **mission_example_governance.json** — Weekly compliance review
  - Persona: Governance Officer
  - Toolkits: Supabase (audit logs), Evidence bundles (export)
  - Key Features: Evidence export, safeguard override tracking, incident summaries

### Technical Enablement Use Cases
- [ ] **mission_example_code_review.json** — Automated PR review and merge
  - Persona: Technical Enablement Lead
  - Toolkits: GitHub (code MCP), Git (version control)
  - Key Features: Diff previews, reviewer checkpoints, revert plans

---

## Mission Example Template

```json
{
  "mission": {
    "id": "mission_uuid",
    "title": "Example Mission Title",
    "persona": "Revenue | Support | Governance | Technical",
    "objective": "Brief objective statement",
    "audience": "Target audience or scope",
    "timeline": "Expected completion timeframe",
    "success_metric": "Key performance indicator"
  },
  "chips": {
    "objective_chip": {
      "value": "Detailed objective text",
      "confidence": "high | medium | needs_review",
      "source": "generated | edited | accepted"
    },
    "audience_chip": { "value": "...", "confidence": "...", "source": "..." },
    "kpis_chip": { "value": "...", "confidence": "...", "source": "..." },
    "safeguards_chip": { "value": "...", "confidence": "...", "source": "..." },
    "timeline_chip": { "value": "...", "confidence": "...", "source": "..." }
  },
  "toolkits": [
    {
      "toolkit_id": "hubspot",
      "toolkit_name": "HubSpot",
      "auth_mode": "no_auth",
      "capabilities": ["contact_enrichment", "list_management"],
      "rationale": "Enrichment for dormant account identification"
    }
  ],
  "inspection": {
    "coverage_metrics": {
      "objectives": 100,
      "contacts": 87,
      "safeguards": 100,
      "automation_readiness": 85
    },
    "findings": [
      {
        "type": "gap",
        "severity": "medium",
        "description": "Missing recent activity data for 13 contacts"
      }
    ]
  },
  "plays": [
    {
      "play_id": "play_1",
      "title": "Targeted Q2 Win-Back Campaign",
      "rationale": "Similar to 5 successful missions in library",
      "confidence": 0.87,
      "impact_estimate": "3-5% reply rate, 4-7 meetings projected",
      "safeguards": [
        { "type": "tone", "value": "warm, consultative" },
        { "type": "timing", "value": "9am-5pm EST, Tue-Thu only" }
      ],
      "toolkit_sequence": [
        { "step": 1, "toolkit": "hubspot", "action": "fetch_contacts" },
        { "step": 2, "toolkit": "gmail", "action": "draft_emails" },
        { "step": 3, "toolkit": "gmail", "action": "send_batch" }
      ]
    }
  ],
  "execution": {
    "mode": "dry_run | governed",
    "started_at": "2025-10-15T10:30:00Z",
    "completed_at": "2025-10-15T10:45:00Z",
    "duration_seconds": 900,
    "tool_calls": [
      {
        "tool_call_id": "tc_1",
        "toolkit": "hubspot",
        "tool": "fetch_contacts",
        "status": "success",
        "latency_ms": 1234,
        "result_summary": "87 contacts fetched"
      }
    ]
  },
  "evidence": {
    "artifacts": [
      {
        "artifact_id": "art_1",
        "type": "contact_list",
        "title": "Enriched Contact List (87 records)",
        "hash": "sha256:abc123...",
        "size_bytes": 45678
      },
      {
        "artifact_id": "art_2",
        "type": "email_drafts",
        "title": "Personalized Email Drafts (87 messages)",
        "hash": "sha256:def456...",
        "size_bytes": 123456
      }
    ],
    "undo_plan": {
      "available": true,
      "expiry": "2025-10-15T11:00:00Z",
      "actions": [
        { "step": 1, "action": "unsend_emails", "reversibility": "complete" }
      ]
    }
  },
  "feedback": {
    "satisfaction": 5,
    "effort_saved_hours": 3,
    "notes": "Love the tone safeguard auto-fix!",
    "tags": ["revenue", "win-back", "q2-dormant"]
  }
}
```

---

## Telemetry Samples

Telemetry event payload examples for reference and testing.

### Event Catalog Samples
- [ ] **telemetry_sample_traces.json** — Complete event traces for mission lifecycle
  - Intake events (`intent_submitted`, `brief_generated`, `brief_item_modified`)
  - Toolkit events (`toolkit_selected`, `connect_link_completed`)
  - Planning events (`play_generated`, `play_selected`)
  - Execution events (`dry_run_started`, `dry_run_completed`)
  - Evidence events (`artifact_published`, `undo_requested`)
  - Feedback events (`feedback_submitted`, `satisfaction_recorded`)

### Telemetry Event Template

```json
{
  "event_id": "evt_uuid",
  "event_type": "intent_submitted | brief_generated | ...",
  "mission_id": "mission_uuid",
  "user_id": "user_uuid",
  "timestamp": "2025-10-15T10:30:00Z",
  "stage": "intake | brief | toolkits | inspect | plan | dry_run | evidence | feedback",
  "payload": {
    "field_1": "value_1",
    "field_2": "value_2"
  },
  "metadata": {
    "source": "ui | agent",
    "session_id": "session_uuid",
    "correlation_id": "correlation_uuid"
  }
}
```

---

## Integration Examples

Code snippets and configuration examples for partner integrations.

### CopilotKit Integration
- [ ] **copilotkit_mission_workspace.tsx** — React component with CoAgents
- [ ] **copilotkit_streaming_updates.ts** — Streaming message handling

### Composio Integration
- [ ] **composio_toolkit_discovery.py** — Toolkit recommendation logic
- [ ] **composio_oauth_flow.py** — Connect Link authorization

### Gemini ADK Integration
- [ ] **adk_coordinator_agent.py** — Multi-agent orchestration
- [ ] **adk_eval_suite.json** — Evaluation configuration

### Supabase Integration
- [ ] **supabase_mission_schema.sql** — Core table definitions
- [ ] **supabase_analytics_views.sql** — Dashboard query examples
- [ ] **supabase_edge_function.ts** — Edge function for evidence export

---

## Creating Examples

**Process:**
1. Identify persona and use case from [Product Vision](../docs/01_product_vision.md)
2. Draft mission scenario following template above
3. Validate JSON schema against actual data models
4. Test mission flow in development environment
5. Capture telemetry trace for reference
6. Add to examples directory with descriptive README entry

**Quality Criteria:**
- [ ] JSON is well-formed and validated
- [ ] All required fields populated
- [ ] Realistic data (no placeholder text like "TODO")
- [ ] Includes full eight-stage flow
- [ ] Telemetry events match actual schema

---

## Usage

**For Developers:**
- Use examples as fixtures for integration tests
- Reference telemetry payloads for event schema validation
- Copy mission structures for new use case prototypes

**For Product Teams:**
- Demonstrate mission flows in stakeholder demos
- Generate mockups and user stories
- Validate UX flows against realistic scenarios

**For Partners:**
- Understand integration patterns and data contracts
- Test toolkit implementations with realistic missions
- Validate API responses against expected formats

---

**Related Documents:**
- [User Experience Blueprint](../docs/03_user_experience.md) — Eight-stage flow details
- [Data Intelligence](../docs/06_data_intelligence.md) — Telemetry event catalog
- [Implementation Guide](../docs/04_implementation_guide.md) — Integration patterns
