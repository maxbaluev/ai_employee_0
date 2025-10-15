# Operational Runbooks

**Purpose:** Incident response procedures, troubleshooting guides, and operational playbooks

**Status:** Structure defined, runbooks pending creation

---

## Runbook Index

### Critical Incident Response
- [ ] **incident_response.md** — General incident response protocol (SEV1/SEV2/SEV3)
- [ ] **rollback_procedure.md** — Deployment rollback steps for UI, agent, and database
- [ ] **data_breach_response.md** — Security incident containment and notification

### Authentication & Authorization
- [ ] **oauth_token_rotation.md** — OAuth token expiry and refresh procedures
- [ ] **oauth_connection_failure.md** — Troubleshooting Composio Connect Link issues
- [ ] **rls_policy_debugging.md** — Supabase Row-Level Security troubleshooting

### Execution & Performance
- [ ] **heartbeat_failure_recovery.md** — SSE streaming heartbeat restoration
- [ ] **inspection_timeout.md** — Handling inspection mode timeouts and retries
- [ ] **undo_failure_handling.md** — Undo plan execution errors and manual rollback
- [ ] **rate_limit_mitigation.md** — Composio rate limit handling and backoff strategies

### Data & Storage
- [ ] **supabase_backup_restore.md** — Database backup verification and recovery
- [ ] **evidence_bundle_corruption.md** — Hash verification failures and artifact recovery
- [ ] **library_embedding_degradation.md** — pgvector index rebuild and quality validation

### Partner Integrations
- [ ] **composio_api_outage.md** — Fallback procedures when Composio is unavailable
- [ ] **copilotkit_session_recovery.md** — Multi-tab session state reconciliation
- [ ] **gemini_api_quota_exhaustion.md** — LLM provider failover and quota management

### Monitoring & Alerting
- [ ] **telemetry_ingestion_stall.md** — Event pipeline recovery and backfill
- [ ] **dashboard_metric_anomalies.md** — Investigating unexpected metric spikes/drops
- [ ] **alert_fatigue_reduction.md** — Alert threshold tuning and escalation optimization

---

## Runbook Template

Each runbook should follow this structure:

```markdown
# [Runbook Title] — Operational Procedure

**Scenario:** [Brief description of when to use this runbook]
**Severity:** [SEV1 | SEV2 | SEV3 | Maintenance]
**Owner:** [Team responsible for this procedure]
**Last Updated:** YYYY-MM-DD
**Last Validated:** YYYY-MM-DD

---

## Symptoms

- Symptom 1 (e.g., "Mission completion rate drops below 90%")
- Symptom 2 (e.g., "Alert fires: 'SSE heartbeat >8s p95'")

---

## Immediate Actions

1. **Triage** — [Quick diagnostic steps]
   ```bash
   # Example command
   mise run health-check
   ```

2. **Containment** — [Stop the bleeding]
   - Disable feature flag if applicable
   - Pause automated missions
   - Notify stakeholders via status page

3. **Communication** — [Who to notify and how]
   - Slack: `#incidents` channel
   - PagerDuty: Escalate to on-call
   - Status page: Update with ETA

---

## Diagnosis

### Check 1: [Diagnostic name]
```bash
# Commands to run
```

**Expected Output:** [What healthy state looks like]
**If Failed:** [Next steps or alternate check]

### Check 2: [Another diagnostic]
...

---

## Resolution Steps

### Option A: [Primary fix]
1. Step 1
   ```bash
   # Command
   ```
2. Step 2
3. Verification step
   ```bash
   # Verification command
   ```

### Option B: [Fallback if Option A fails]
1. Step 1
2. Step 2

---

## Verification

After applying fix, verify:
- [ ] Check 1 passes
- [ ] Check 2 passes
- [ ] Monitoring dashboards return to normal
- [ ] User-reported issues resolved

---

## Post-Incident

1. **Update Status** — Mark incident resolved in PagerDuty and status page
2. **Document Timeline** — Record key events in incident tracker
3. **Schedule Postmortem** — Within 48 hours, include timeline, root cause, corrective actions
4. **Update Runbook** — Capture any deviations or learnings

---

## Related Runbooks

- [Related Runbook 1]
- [Related Runbook 2]

---

## Contacts

- **Incident Commander:** `ops-oncall@company.com`
- **Engineering Escalation:** `engineering@company.com`
- **Partner Support:** [Partner-specific contacts]

---

## Validation Log

| Date | Validator | Environment | Result | Notes |
|------|-----------|-------------|--------|-------|
| YYYY-MM-DD | Name | Staging | ✅ Pass | [Notes] |
```

---

## Runbook Maintenance

- **Quarterly Validation:** Test runbooks in staging using chaos experiments
- **Incident Review:** Update runbooks after every incident based on learnings
- **Ownership Review:** Verify runbook owners and escalation paths quarterly
- **Archival:** Outdated runbooks moved to `archived/` with deprecation notice

---

## Getting Started

**Priority Runbooks to Create First:**
1. `incident_response.md` — General protocol needed immediately
2. `rollback_procedure.md` — Deployment safety net
3. `heartbeat_failure_recovery.md` — Most common operational issue
4. `oauth_token_rotation.md` — Auth failures are high-impact

**Creation Process:**
1. Copy template above
2. Draft procedure based on system knowledge and past incidents
3. Validate in staging environment
4. Review with Operations and Engineering leads
5. Publish and socialize with on-call rotation

---

**Related Documents:**
- [Operations Playbook](../07_operations_playbook.md) — Operational charter and workflows
- [Release Readiness](../09_release_readiness.md) — Runbook requirements for releases
- [System Overview](../02_system_overview.md) — Architecture context for troubleshooting
