# Readiness Artifact Schemas

This reference defines the machine-generated evidence packages required by the capability gates documented in `new_docs/architecture.md` (Section 9) and `new_docs/implementation_plan.md` (Sections 3, 5, and 8). Each artifact must be produced by the owning agent, validated automatically where possible, saved inside the repository under `docs/readiness/`, and attached to the Supabase storage bucket `artifacts/control-plane-readiness/`.

## 1. Foundation Bundle (`foundation_readiness.json`)
- **Owner:** Runtime Steward Agent.
- **Format:** JSON document (UTF-8).
- **Schema:**
  ```json
  {
    "supabase": {
      "migration_hash": "sha256",
      "pgvector_enabled": true,
      "rls_policy_checks": [
        {"table": "objectives", "status": "pass"},
        {"table": "plays", "status": "pass"}
      ]
    },
    "adk": {
      "coordinator_health": "ok|warn|fail",
      "planner_health": "ok|warn|fail",
      "langgraph_endpoint": "https://..."
    },
    "copilotkit": {
      "smoke_test_transcript_path": "artifacts/.../copilotkit_smoke.md",
      "shared_state_checksum": "sha256"
    },
    "composio": {
      "catalog_checksum": "sha256",
      "toolkit_count": 0
    },
    "generated_at": "ISO-8601 timestamp"
  }
  ```

## 2. Dry-Run Verification (`dry_run_verification.md`)
- **Owner:** Product Orchestrator Agent.
- **Format:** Markdown document with the following headings:
  1. `# Objective Summary`
  2. `## Planner Ranking Evidence` — include table of play candidates with scores and referenced toolkits.
  3. `## Executor Outputs` — link to stored artifacts (draft emails, research syntheses, schedules).
  4. `## Latency Metrics` — report total cycle time and component breakdown.
  5. `## Reviewer Feedback (Synthetic or Human)` — capture structured feedback.

## 3. Governed Activation Report (`governed_activation_report.csv`)
- **Owner:** Governance Sentinel.
- **Format:** CSV with header row; delimiter `,`.
- **Columns:** `action_id`, `toolkit`, `tool_name`, `auth_mode`, `approval_id`, `approver`, `decision`, `undo_available`, `undo_status`, `validator_checkpoint`, `timestamp`.
- **Notes:** All timestamps must be ISO-8601 in UTC.

## 4. Insight Snapshot (`insight_snapshot.parquet`)
- **Owner:** Data Lead Agent.
- **Content:** Parquet file containing rows per tenant with metrics: `tenant_id`, `objectives_completed`, `dry_run_to_activation_conversion`, `average_approval_latency_ms`, `guardrail_incidents`, `roi_delta_percent`.
- **Validation:** Include companion checksum file `insight_snapshot.sha256`.

## 5. Library Recommendations (`library_recommendations.json`)
- **Owner:** Data Lead Agent.
- **Schema:**
  ```json
  {
    "generated_at": "ISO-8601 timestamp",
    "recommendations": [
      {
        "tenant_id": "...",
        "objective_embedding_id": "uuid",
        "plays": [
          {
            "play_id": "uuid",
            "title": "string",
            "confidence": 0.0,
            "evidence_refs": ["artifacts/..."],
            "required_auth": ["hubspot.oauth", "gmail.oauth"],
            "guardrail_flags": ["quiet_hours"],
            "reasons": ["vector_similarity", "recent_success"]
          }
        ]
      }
    ]
  }
  ```

## 6. Trust Review Pack (`trust_review.pdf`)
- **Owner:** Governance Sentinel with Security Sub-Agent support.
- **Content Checklist:**
  - Security test outcomes (token rotation, PII redaction, audit export).
  - Performance load test summary referencing `load_test_results.json`.
  - Compliance sign-off (SOC 2 control mapping, GDPR checkpoints).
- **Companion Files:**
  - `load_test_results.json` containing metrics per scenario (fields: `scenario`, `requests_per_minute`, `p95_latency_ms`, `error_rate`, `status`).
  - `enablement_bundle.zip` with customer-facing collateral.

## 7. Stabilisation Digest (`stabilisation_digest.md`)
- **Owner:** Runtime Steward Agent.
- **Structure:**
  1. `# KPI Rollup` — include table referencing Supabase dashboard metrics.
  2. `## Incident Ledger` — list incident IDs, severity, resolution status, link to runbooks.
  3. `## Backlog Seeds` — bullet list of follow-up items ordered by impact.
  4. `## Guardrail Observations` — summarise approvals, overrides, quiet-hour exceptions.

## 8. Communication Artifacts
- **`status_beacon.json`** (emitted after each bundle):
  ```json
  {
    "bundle_id": "A|B|C|D|E|F",
    "gate_target": "G-A",
    "completed_steps": ["step_id"],
    "risks": [
      {"id": "risk-001", "severity": "medium", "mitigation": "string"}
    ],
    "decisions_pending": ["decision_id"],
    "timestamp": "ISO-8601"
  }
  ```
- **`governance_digest.md`** (generated ad hoc by Governance Sentinel): sections for Risk Summary, Required Decisions, Compliance Alerts.

## 9. Storage & Retention Rules
- Store all artifacts under `supabase://storage/artifacts/control-plane-readiness/<gate-id>/`.
- Retain JSON/Markdown/CSV/Parquet artifacts for ≥ 365 days; retain PDFs and ZIPs for ≥ 730 days.
- Include SHA-256 checksum sidecar files for all binary artifacts (.parquet, .pdf, .zip).
- Grant read access to Product Orchestrator, Governance Sentinel, and GTM Enablement agents; enforce RLS for tenant-specific data within Parquet files.

## 10. Automation Hooks
- Upon uploading any readiness artifact, trigger Supabase Edge Function `notify_gate_progress` to update dashboards and emit optional Slack notifications via Composio (if permitted).
- Validation failures should be logged to the `gate_validation_failures` table with references to offending artifact paths.

This schema reference enables autonomous agents to produce consistent, audit-ready evidence without relying on human-driven timelines.
