# AI Employee Control Plane: Operations Playbook

**Version:** 2.0 (October 2025)
**Audience:** Site Reliability, Support, Incident Response, Security
**Status:** Active handbook for running the unified system

---

## 1. Operational Charter

Ensure the Control Plane remains observable, reliable, and compliant while enabling rapid iteration. Key mandates:

1. **Reliability:** Maintain mission completion success ≥99% (inspection and governed runs)
2. **Latency:** Streaming heartbeat ≤5s p95, API latency ≤300ms p95
3. **Security:** Zero unauthorized actions; immediate containment on anomaly
4. **Compliance:** Evidence bundles ready for audit within 24 hours
5. **Supportability:** Clear runbooks, escalation paths, and communication protocols

---

## 2. Environment Matrix

| Environment | Purpose                   | Deployment Cadence         | Data                      | Access                  |
| ----------- | ------------------------- | -------------------------- | ------------------------- | ----------------------- |
| Local       | Developer sandbox         | On demand                  | Mock + developer accounts | Engineers               |
| Dev         | Integrated testing        | Daily                      | Synthetic                 | Engineering, QA         |
| Staging     | Pre-production validation | Twice weekly               | Anonymized                | Engineering, Operations |
| Production  | Customer-facing           | Continuous (feature flags) | Live                      | Operations, On-call     |

Secrets managed via `.env` locally and vault-backed environment variables in shared environments.

---

## 3. Deployment Workflows

- **Frontend (Next.js):** Vercel or containerized; use blue/green or canary releases; monitor error and performance dashboards post-deploy.
- **Agent (FastAPI):** Fly.io/GKE; `scripts/deploy-agent.sh`; ensure health checks cover SSE endpoints and Composio connectivity.
- **Supabase:** Migrate via CI job; run `supabase db reset --seed supabase/seed.sql` in staging before production rollout; regenerate types.

All deployments require:

- Tests + lint + agent evals green
- Evidence artifacts updated (if applicable)
- Rollback plan documented (git revert, Supabase migration down script, agent rollback instructions)

---

## 4. Monitoring & Alerting

### Metrics (Datadog or equivalent)

- `mission.success_rate`
- `planner.latency.p95`
- `executor.heartbeat.latency`
- `undo.success_rate`
- `safeguard.overrides.count`
- `telemetry.events.ingested`

### Logs

- Structured JSON (mission id, stage, actor, error code)
- Forward to SIEM for anomaly detection
- Retention: 30 days hot, 180 days cold storage

### Alerts

- Critical: Mission success <97% (5m window), SSE heartbeat >8s, undo failures >1% in hour, telemetry ingestion stalled >15m
- High: OAuth failure rate >5%, planner retry spikes, Composio rate-limit warnings
- Informational: Library reuse drops below rolling average

Alerts route to PagerDuty schedule: Primary on-call → Secondary on-call → Incident Commander.

---

## 5. Incident Response

### Severity Levels

- **SEV1:** Customer data at risk, widespread failure, trust breach
- **SEV2:** Major feature outage, SLA breach, repeated undo failure
- **SEV3:** Degraded experience, partial functionality, non-blocking errors

### Response Flow

1. **Detection:** Alert fires or customer report
2. **Triage:** Incident Commander (IC) assigns roles (Comms, Ops, Scribe)
3. **Containment:** Disable affected flows (feature flag, circuit breaker), pause automation
4. **Remediation:** Apply fix, monitor metrics, run regression tests
5. **Communication:** Update status page, customer success channels, internal Slack
6. **Postmortem:** Within 48 hours; include timeline, root cause, corrective actions

Runbooks stored under `docs/readiness/runbooks/` with command snippets, dashboards, and fallbacks.

---

## 6. Security & Compliance

- **Access Control:** Principle of least privilege, scoped tokens, rotating credentials quarterly
- **Audit Trail:** Every mission action, safeguard edit, and undo stored with timestamp, actor, before/after state
- **Data Protection:** Encrypt at rest (Supabase), TLS in transit, redact PII before logging
- **Vulnerability Management:** Monthly scans, dependency audits (`pnpm audit`, `pip-audit`), patch SLAs
- **Compliance:** SOC2, GDPR readiness via evidence bundles, data export tools, consent tracking

### Security Checks Before Release

- Static analysis (ESLint, Ruff, Bandit)
- Dependency updates reviewed for CVEs
- Pen test findings triaged and tracked in risk register
- Secret scanning enforced in CI (Git leaks, environment variables)

---

## 7. Maintenance Operations

- **Backups:** Supabase nightly backups + weekly verification restore
- **Library Embeddings:** Weekly re-embedding job; verify metrics before/after
- **Telemetry Vacuum:** Purge expired raw events via scheduled job
- **Composio Sync:** Weekly check for new toolkits, metadata refresh
- **CopilotKit Updates:** Track SDK releases; validate compatibility before upgrade

---

## 8. Support Playbook

- **Tier 0:** In-product guidance, tooltips, contextual help
- **Tier 1:** Support desk triage (known issues, runbook references)
- **Tier 2:** Specialist escalation (product engineer or agent owner)
- **Tier 3:** On-call/incident response (follow incident flow)

Collect support tickets in CRM tagged with mission stage; feed insights into backlog prioritization.

---

## 9. Change Calendar

- **Weekly Release Review:** Tuesdays — new features, risks, mitigation plans
- **Maintenance Window:** Saturdays 02:00-04:00 UTC (staging), Sundays 03:00-05:00 UTC (production)
- **Freeze Periods:** End-of-quarter (Q4 weeks 12-13) — critical fixes only
- **Partner Updates:** Coordinate with Composio/CopilotKit/Gemini teams for breaking changes

Track changes in shared calendar; notify stakeholders 48 hours prior to high-impact updates.

---

## 10. Documentation & Training

- Keep `docs/` synced with operational truths; review quarterly
- Record incident drills; store recordings and notes in knowledge base
- Onboard new operators via shadow program + certification checklist

---

## 11. Continuous Improvement

- Quarterly game days (chaos experiments, rollback drills)
- Monthly metric review to identify trends (latency, success rate, override spikes)
- Feedback loop from support, product, and analytics into roadmap
- Publish operational scorecard; celebrate successes and address gaps transparently

---

## 12. Contacts & Escalations

- **Incident Commander:** on-call rotation (`ops-oncall@company.com`)
- **Security Lead:** `security@company.com`
- **Product & UX Leads:** `product@company.com`, `ux@company.com`
- **Partner Liaisons:** Composio (`integration@composio`), CopilotKit (`partnerships@copilotkit`), Gemini (`adk-support@google.com`)

Maintain updated roster in shared directory; verify quarterly.
