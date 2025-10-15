# AI Employee Control Plane: Operations Playbook

**Version:** 3.1 (October 2025)
**Audience:** Operations Engineers, SRE, DevOps, On-Call Teams, Incident Responders
**Status:** Active operational procedures and runbook reference

---

## Purpose

This playbook provides operational procedures, deployment strategies, monitoring guidance, and incident response protocols for running the AI Employee Control Plane in production. It ensures reliability, observability, and rapid incident resolution while maintaining security and compliance standards.

**Core Responsibilities:**
- Deploy and maintain production infrastructure
- Monitor system health and performance
- Respond to incidents and outages
- Maintain runbooks and escalation procedures
- Ensure compliance with SLAs and operational standards

---

## System Architecture Overview

### Infrastructure Components

**Frontend (Next.js Application):**
- Deployment: Vercel (or self-hosted via Docker)
- CDN: Vercel Edge Network (or CloudFlare)
- Environments: Development, Staging, Production
- Scale: Auto-scaling based on traffic

**Backend (FastAPI Agent Service):**
- Deployment: Fly.io, GKE, or AWS ECS
- Runtime: Python 3.13+ with uv dependency management
- Scale: Horizontal scaling with load balancer
- Health Check: `/health` endpoint

**Database & Storage (Supabase):**
- Postgres: Mission metadata, telemetry, library embeddings
- Storage: Evidence bundles, artifacts, audit logs
- Functions: Edge functions for business logic
- Cron: Scheduled jobs for cleanup and analytics

**Integrations:**
- CopilotKit: Streaming chat and CoAgents
- Composio Tool Router: Production-ready meta-tool interface with six operations (`COMPOSIO_SEARCH_TOOLS`, `COMPOSIO_CREATE_PLAN`, `COMPOSIO_MANAGE_CONNECTIONS`, `COMPOSIO_MULTI_EXECUTE_TOOL`, `COMPOSIO_REMOTE_WORKBENCH`, `COMPOSIO_REMOTE_BASH_TOOL`) providing a discovery→authentication→execution workflow across 500+ toolkits; sessions scoped per mission via `create_session`
- Gemini ADK: Agent coordination framework

---

## Deployment Procedures

### Environment Strategy

| Environment | Purpose | Update Frequency | Data |
|-------------|---------|------------------|------|
| **Local** | Development and testing | On-demand | Seeded test data |
| **Staging** | Pre-production validation | Per PR merge | Sanitized prod snapshot (weekly refresh) |
| **Production** | Live user traffic | Scheduled releases (2-3x/week) | Real user data |

---

### Deployment Workflow

#### Standard Deployment (Tier 1 & 2 Features)

**Pre-Deployment:**
1. Verify all CI/CD checks passing on main branch
2. Review release notes and affected components
3. Check for pending database migrations
4. Alert on-call team of deployment window
5. Confirm rollback plan readiness

**Deployment Steps:**

**Frontend (Next.js):**
```bash
# Automatic via Vercel integration
# Triggered on main branch push
# Monitor: https://vercel.com/<project>/deployments

# Manual deployment (if needed)
vercel deploy --prod
```

**Backend (FastAPI Agent):**
```bash
# Using deployment script
./scripts/deploy-agent.sh production

# Manual steps (if script unavailable)
cd agent
docker build -t ai-employee-agent:latest .
docker tag ai-employee-agent:latest registry/ai-employee-agent:v<version>
docker push registry/ai-employee-agent:v<version>

# Update deployment (Fly.io example)
flyctl deploy --image registry/ai-employee-agent:v<version>

# Verify health
curl https://agent.production.example.com/health
```

**Database Migrations (Supabase):**
```bash
# Link to production project
supabase link --project-ref <production-ref>

# Review pending migrations
supabase db diff

# Apply migrations (with backup)
supabase db push

# Verify migration success
supabase db history

# Regenerate types for frontend
supabase gen types typescript --linked --schema public,storage,graphql_public > supabase/types.ts
```

**Post-Deployment:**
1. Monitor error rates and latency for 30 minutes
2. Verify critical user flows (login, mission creation, execution)
3. Check telemetry ingestion rate
4. Review monitoring dashboards for anomalies
5. Update deployment log and notify stakeholders

---

#### Canary Deployment (Tier 2+ Features with Feature Flags)

**Strategy:** Progressive rollout to minimize blast radius

**Steps:**
1. Deploy feature with flag disabled to 100% of infrastructure
2. Enable flag for 10% of users (monitor for 30 minutes)
3. Increase to 50% (monitor for 30 minutes)
4. Increase to 100% (monitor for 1 hour)
5. Document success metrics and remove flag (after stabilization)

**Rollback Trigger:** Error rate >2%, latency >2x baseline, or safeguard violations

**Rollback Action:**
```bash
# Instant rollback via feature flag
# Update in Supabase or environment config
UPDATE feature_flags SET enabled = false WHERE flag_name = '<feature_name>';

# Or disable via admin panel
curl -X POST https://api.production.example.com/admin/flags/<feature_name>/disable \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

#### Emergency Hotfix Deployment

**Trigger:** Critical bug, security vulnerability, or production outage

**Fast-Track Process:**
1. Create hotfix branch from `main`
2. Implement fix with minimal scope
3. Run automated tests (skip extended validation if time-critical)
4. Deploy directly to production with on-call engineer monitoring
5. Create incident retrospective and backfill missing evidence

**Approval:** Engineering Lead or on-call senior engineer

**Documentation:** Required within 24 hours post-deployment

---

## Monitoring & Observability

### Key Metrics & Dashboards

#### System Health Dashboard

**URL:** `https://monitoring.example.com/dashboards/system-health`

**Metrics:**
- **Uptime:** 99.9% target (measured per service)
- **Error Rate:** <1% of requests
- **Latency (p95):** <200ms for API calls, <150ms for stage transitions
- **Throughput:** Requests per second, mission completion rate
- **Resource Utilization:** CPU (<70%), Memory (<80%), Disk (<85%)

**Panels:**
- Service status overview (green/yellow/red indicators)
- Error rate trend (last 24 hours)
- Latency percentiles (p50, p95, p99)
- Active users and concurrent missions
- Database connection pool status
- Queue depth (background jobs)

---

#### Mission Lifecycle Dashboard

**URL:** `https://monitoring.example.com/dashboards/mission-lifecycle`

**Metrics:**
- **Stage Completion Rate:** % of missions completing each stage
- **Stage Duration:** Median time per stage (Define, Prepare, Plan, Execute, Reflect)
- **Conversion Funnel:** Intent → Brief → Toolkits → Plan → Execution → Reflection
- **Safeguard Compliance:** Auto-fix adoption rate, validator alerts, overrides
- **Undo Success Rate:** % of rollbacks completing successfully

**Alerts:**
- Stage completion rate drops below 85%
- Median stage duration >2x baseline
- Safeguard violation rate >5%
- Undo failure rate >5%

---

#### Agent Performance Dashboard

**URL:** `https://monitoring.example.com/dashboards/agent-performance`

**Metrics:**
- **Coordinator:** Orchestration latency, session state sync time
- **Planner:** Play generation time, library retrieval accuracy
- **Executor:** Tool call success rate, execution step duration
- **Validator:** Safeguard check latency, auto-fix application rate
- **Evidence:** Artifact packaging time, hash generation duration
- **Inspector:** Data preview generation time, coverage calculation

**Alerts:**
- Any agent latency >5s (p95)
- Agent error rate >3%
- Session state inconsistencies detected

---

#### Integration Health Dashboard

**URL:** `https://monitoring.example.com/dashboards/integrations`

**Metrics:**
- **Composio Tool Router:** Meta-tool call success rate for all six operations (`COMPOSIO_SEARCH_TOOLS`, `COMPOSIO_CREATE_PLAN`, `COMPOSIO_MANAGE_CONNECTIONS`, `COMPOSIO_MULTI_EXECUTE_TOOL`, `COMPOSIO_REMOTE_WORKBENCH`, `COMPOSIO_REMOTE_BASH_TOOL`), OAuth refresh failures, rate limit hits, session creation latency
- **CopilotKit:** SSE connection uptime, message delivery rate, session persistence
- **Gemini ADK:** Agent invocation success rate, token usage, quota remaining
- **Supabase:** Query latency, connection pool health, storage upload success

**Alerts:**
- Integration error rate >5%
- OAuth refresh failure rate >10%
- Rate limit hits >100/hour
- SSE disconnection rate >2%

---

### Logging Strategy

**Log Aggregation:** All services ship structured JSON logs to centralized logging (e.g., Datadog, Grafana Loki, CloudWatch)

**Log Levels:**
- **DEBUG:** Detailed execution traces (disabled in production)
- **INFO:** Normal operational events (mission lifecycle, tool calls)
- **WARN:** Recoverable errors, degraded performance, auto-fixes applied
- **ERROR:** Failures requiring attention (tool call failures, validation errors)
- **CRITICAL:** System-wide failures, data integrity issues

**Required Fields:**
- `timestamp` (ISO 8601)
- `level` (DEBUG/INFO/WARN/ERROR/CRITICAL)
- `service` (frontend/agent/database)
- `correlation_id` (trace requests across services)
- `user_id` (for user-scoped events, redacted)
- `mission_id` (for mission-scoped events)
- `message` (human-readable description)
- `context` (additional structured data)

**Example Log Entry:**
```json
{
  "timestamp": "2025-10-15T14:32:18.457Z",
  "level": "ERROR",
  "service": "agent",
  "correlation_id": "req_abc123xyz",
  "mission_id": "mission_789",
  "user_id": "user_***redacted***",
  "agent": "executor",
  "message": "Tool Router execution failed: rate limit exceeded",
  "context": {
    "meta_tool": "COMPOSIO_MULTI_EXECUTE_TOOL",
    "toolkit": "gmail",
    "action": "send",
    "error_code": "RATE_LIMIT_EXCEEDED",
    "retry_after_seconds": 60
  }
}
```

---

### Alerting Rules

#### Critical Alerts (Page On-Call Immediately)

| Alert | Condition | Action |
|-------|-----------|--------|
| **Service Down** | Health check failing for >2 minutes | Page on-call, escalate to Engineering Lead if >10 min |
| **Database Outage** | Supabase connection failures >50% | Page on-call + Database Lead, check Supabase status |
| **High Error Rate** | Error rate >5% for >5 minutes | Page on-call, investigate logs, prepare rollback |
| **Security Breach** | Unauthorized access detected | Page on-call + Security Lead, lock down affected accounts |
| **Data Loss** | Evidence bundle upload failures >10% | Page on-call + Data Lead, verify backups |

---

#### Warning Alerts (Notify Team, Investigate Within 1 Hour)

| Alert | Condition | Action |
|-------|-----------|--------|
| **Elevated Latency** | p95 latency >500ms for >10 minutes | Investigate slow queries, check load |
| **Memory Leak** | Heap growth >30% per hour | Restart affected service, investigate leak |
| **Integration Degradation** | Tool Router/CopilotKit error rate >10% | Check partner status, implement circuit breaker |
| **Queue Backlog** | Background job queue depth >100 | Scale workers, investigate stuck jobs |
| **Disk Space Low** | Disk usage >90% | Clean up logs, evidence archives; scale storage |

---

#### Info Alerts (Monitor, No Immediate Action)

| Alert | Condition | Action |
|-------|-----------|--------|
| **Traffic Spike** | Requests >2x baseline | Monitor for abuse, verify capacity |
| **Feature Flag Change** | Flag enabled/disabled | Log change, notify stakeholders |
| **Deployment Event** | New version deployed | Monitor error rate and latency |
| **Scheduled Maintenance** | Supabase maintenance window | Notify users, prepare for degraded performance |

---

## Incident Response

### Incident Severity Levels

| Level | Definition | Response Time | Escalation |
|-------|------------|---------------|------------|
| **SEV-1 (Critical)** | Complete service outage, data loss, security breach | <5 minutes | Immediate: On-call + Engineering Lead + Security Lead |
| **SEV-2 (High)** | Partial outage, major feature broken, >25% users affected | <15 minutes | On-call + Engineering Lead |
| **SEV-3 (Medium)** | Degraded performance, <25% users affected, workaround available | <1 hour | On-call engineer |
| **SEV-4 (Low)** | Minor bug, isolated issue, cosmetic problem | <4 hours | Async investigation |

---

### Incident Response Process

#### Phase 1: Detection & Triage (0-5 minutes)

1. **Alert Received:** On-call engineer receives page/alert
2. **Acknowledge:** Confirm receipt, silence duplicate alerts
3. **Initial Assessment:**
   - Check monitoring dashboards
   - Review recent deployments
   - Assess blast radius (% users affected)
4. **Classify Severity:** Assign SEV level
5. **Create Incident:** Open incident ticket (PagerDuty, Jira, etc.)
6. **Notify Stakeholders:** Alert team in `#incidents` Slack channel

---

#### Phase 2: Mitigation & Containment (5-30 minutes)

**Immediate Actions:**
- **Rollback:** If recent deployment, rollback to previous version
- **Feature Flag:** Disable broken feature if isolated
- **Scale Resources:** Add capacity if load-related
- **Circuit Breaker:** Disable failing integration if external
- **Rate Limit:** Apply temporary limits if abuse detected

**Communication:**
- Post updates every 15 minutes in incident channel
- Notify affected customers (for SEV-1/SEV-2)
- Update status page (if public-facing)

**Escalation Criteria:**
- Incident duration >30 minutes (SEV-1) or >1 hour (SEV-2)
- Mitigation unsuccessful
- Data integrity concerns
- Legal/compliance implications

---

#### Phase 3: Resolution & Verification (30-120 minutes)

1. **Implement Fix:** Deploy hotfix or permanent resolution
2. **Validate:** Test critical user flows, verify metrics return to baseline
3. **Monitor:** Observe system for 1-2 hours post-resolution
4. **Document:** Capture timeline, root cause, mitigation steps
5. **Close Incident:** Mark incident resolved, notify stakeholders

---

#### Phase 4: Post-Incident Review (Within 48 Hours)

**Retrospective Meeting:**
- **Attendees:** Incident responders, Engineering Lead, Product Manager, affected teams
- **Agenda:**
  1. Timeline reconstruction
  2. Root cause analysis (5 Whys)
  3. What went well / What could improve
  4. Action items (preventive measures, monitoring improvements, runbook updates)

**Deliverables:**
- Incident report (public or internal)
- Updated runbook with learnings
- Action items logged and assigned

**Template:** See `docs/readiness/runbooks/incident_template.md`

---

### Common Incident Scenarios & Runbooks

#### Runbook 1: Frontend Deployment Failure

**Symptoms:** Vercel deployment fails, users see outdated UI

**Diagnosis:**
```bash
# Check deployment status
vercel deployments list --project <project-name>

# View deployment logs
vercel logs <deployment-url>

# Check build errors
cat .next/build-error.log
```

**Resolution:**
```bash
# Rollback to previous deployment
vercel rollback <previous-deployment-url> --yes

# Or redeploy from last known good commit
git checkout <good-commit-sha>
vercel deploy --prod
```

**Prevention:**
- Ensure preview deployments pass before merging
- Add pre-deployment smoke tests to CI/CD

---

#### Runbook 2: Agent Service Unresponsive

**Symptoms:** `/health` endpoint times out, missions stuck in "executing" state

**Diagnosis:**
```bash
# Check agent service status
curl https://agent.production.example.com/health

# View agent logs
tail -f /var/log/agent.log
# Or via cloud provider
flyctl logs --app ai-employee-agent

# Check resource usage
top -p $(pgrep -f "uvicorn agent.agent:app")
```

**Resolution:**
```bash
# Restart agent service
flyctl restart --app ai-employee-agent

# Or via systemd (self-hosted)
sudo systemctl restart ai-employee-agent

# Scale horizontally if load issue
flyctl scale count 3 --app ai-employee-agent
```

**Prevention:**
- Implement auto-restart on health check failure
- Add memory leak detection and alerts
- Configure horizontal auto-scaling

---

#### Runbook 3: Database Connection Pool Exhausted

**Symptoms:** "Connection pool exhausted" errors, slow queries, missions failing to save

**Diagnosis:**
```bash
# Check Supabase connection pool status
# Via Supabase dashboard: Project Settings → Database → Connection Pooling

# Query active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

# Check long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '5 minutes';
```

**Resolution:**
```bash
# Terminate long-running queries (if safe)
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '10 minutes';

# Increase connection pool size (Supabase settings)
# Or scale database tier if consistently hitting limits

# Restart services to clear stale connections
flyctl restart --app ai-employee-agent
```

**Prevention:**
- Implement connection pooling with pgBouncer
- Add query timeout limits
- Optimize slow queries (use EXPLAIN ANALYZE)
- Monitor connection usage and alert at 80% capacity

---

#### Runbook 4: Tool Router Rate Limit Exceeded

**Symptoms:** Tool Router operations failing with "RATE_LIMIT_EXCEEDED", missions stuck in execution

**Diagnosis:**
```bash
# Check Tool Router usage patterns
SELECT
  context->>'meta_tool' as operation,
  count(*) as call_count
FROM telemetry_events
WHERE event_type = 'tool_router_call'
  AND timestamp > now() - interval '1 hour'
GROUP BY context->>'meta_tool'
ORDER BY call_count DESC;

# Check specific toolkit call volume
SELECT
  context->>'toolkit' as toolkit,
  count(*) as call_count
FROM telemetry_events
WHERE event_type = 'tool_router_call'
  AND context->>'meta_tool' = 'COMPOSIO_MULTI_EXECUTE_TOOL'
  AND timestamp > now() - interval '1 hour'
GROUP BY context->>'toolkit'
ORDER BY call_count DESC;
```

**Resolution:**
```bash
# Implement exponential backoff (already in code, verify)
# Temporarily disable non-critical missions
UPDATE feature_flags SET enabled = false
WHERE flag_name = 'mission_type_<low_priority>';

# Contact Composio support for quota increase (if legitimate usage)

# Implement circuit breaker for Tool Router operations
```

**Prevention:**
- Cache `COMPOSIO_SEARCH_TOOLS` results (1-hour TTL recommended)
- Batch discovery queries where possible
- Add quota monitoring and proactive alerts
- Implement toolkit call throttling per mission
- Monitor token usage as Tool Router operations consume ~20k tokens/session

---

#### Runbook 5: Evidence Bundle Upload Failures

**Symptoms:** Missions completing but evidence not saved, "upload failed" errors

**Diagnosis:**
```bash
# Check Supabase Storage status
# Via Supabase dashboard: Storage → Buckets

# Verify storage quota
SELECT sum(size) FROM storage.objects WHERE bucket_id = 'evidence';

# Check for failed uploads in logs
grep "evidence_upload_failed" /var/log/agent.log

# Test manual upload
curl -X POST https://<project-ref>.supabase.co/storage/v1/object/evidence/test.txt \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  --data-binary @test.txt
```

**Resolution:**
```bash
# Retry failed uploads (if transient)
# Trigger evidence regeneration via admin endpoint
curl -X POST https://api.production.example.com/admin/missions/<mission-id>/regenerate-evidence \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Scale storage tier if quota exceeded
# Or clean up old evidence bundles (per retention policy)

# Verify RLS policies not blocking uploads
```

**Prevention:**
- Implement retry logic with exponential backoff
- Add storage quota alerts at 80%
- Automate evidence archive cleanup (>90 days retention)
- Use Supabase webhooks for upload verification

---

## Security & Compliance

### Access Control

**Production Access:**
- **SSH/Server Access:** On-call engineers only, logged and audited
- **Database Access:** Read-only for engineers, write access via service accounts only
- **Admin Panel:** Multi-factor authentication required, role-based permissions
- **Secrets:** Stored in Vault/1Password, rotated quarterly

**Audit Trail:**
- All production access logged with timestamp, user, action
- Logs retained for 1 year (compliance requirement)
- Weekly audit review by Security Lead

---

### Data Protection

**Encryption:**
- **At Rest:** Database and storage encrypted (AES-256)
- **In Transit:** TLS 1.3 for all external communication
- **Secrets:** Application secrets encrypted with KMS

**PII Redaction:**
- Telemetry scrubbed before storage (see `src/lib/telemetry/redaction.ts`)
- Logs sanitized (emails, phone numbers, account IDs replaced with `***redacted***`)
- Evidence bundles redacted before external sharing

**Backup & Recovery:**
- **Database:** Daily automated backups (Supabase), retained 30 days
- **Storage:** Versioned with 30-day retention
- **Disaster Recovery:** RTO 4 hours, RPO 24 hours

---

### Compliance Procedures

**SOC 2 Requirements:**
- Quarterly access review and certification
- Incident response documentation
- Change management approval process
- Annual penetration testing

**GDPR/CCPA:**
- User data export functionality (`/api/users/export`)
- Data deletion within 30 days of request
- Privacy policy and consent tracking

**Audit Preparation:**
- Maintain evidence artifacts in `docs/readiness/compliance/`
- Quarterly compliance checklist review
- Automated compliance report generation

---

## Maintenance Windows

### Scheduled Maintenance

**Frequency:** Quarterly (unless emergency)

**Typical Tasks:**
- Database upgrades and reindexing
- Certificate renewals
- Infrastructure scaling adjustments
- Dependency updates (security patches)

**Process:**
1. Schedule maintenance 2 weeks in advance
2. Notify customers 1 week and 24 hours before
3. Create rollback plan and test in staging
4. Execute during low-traffic window (Sundays 2-6 AM UTC)
5. Monitor for 4 hours post-maintenance
6. Send completion notification

**Communication:**
- Email to active users
- Status page update
- In-app banner notification

---

### Emergency Maintenance

**Trigger:** Critical security vulnerability, data integrity issue, or partner-mandated upgrade

**Process:**
1. Assess urgency and impact
2. Notify Engineering Lead and Product Manager
3. Schedule soonest safe window (may be immediate)
4. Notify customers with minimal notice (if user-facing impact)
5. Execute with on-call engineer monitoring
6. Post-incident review required

---

## Performance Optimization

### Database Optimization

**Query Performance:**
- Use EXPLAIN ANALYZE for slow queries (>100ms)
- Add indexes for frequently queried fields
- Implement connection pooling (pgBouncer)
- Partition large tables (telemetry_events, mission_artifacts)

**Monitoring:**
- Track slow query log (>50ms threshold)
- Monitor connection pool utilization
- Alert on table bloat (>20% wasted space)

**Maintenance:**
- VACUUM ANALYZE weekly (automated via Supabase cron)
- Reindex quarterly or when performance degrades
- Purge old telemetry per retention policy (180 days)

---

### Caching Strategy

**Frontend:**
- CDN caching for static assets (Vercel Edge)
- Service worker for offline UI (mission drafts)
- React Query for API response caching

**Backend:**
- Redis cache for library embeddings (24-hour TTL)
- Tool Router discovery results cached (1-hour TTL via `COMPOSIO_SEARCH_TOOLS`)
- Mission metadata cached during active session

**Invalidation:**
- On-demand: Mission updates, library contributions
- Time-based: Discovery cache, embedding refresh
- Event-driven: Feature flag changes, toolkit updates

---

### Load Testing

**Frequency:** Before major releases, quarterly

**Scenarios:**
- Baseline load: 100 concurrent users, 1,000 missions/day
- Peak load: 500 concurrent users, 5,000 missions/day
- Stress test: 1,000 concurrent users until failure

**Tools:** k6, Artillery, or JMeter

**Success Criteria:**
- p95 latency <200ms at 2x baseline load
- Zero errors at baseline load
- Graceful degradation at peak load (no crashes)

---

## Contacts & Escalation

### On-Call Rotation

**Primary On-Call:** Responds to all alerts, triages incidents
**Secondary On-Call:** Backup for primary, escalation point
**Rotation:** Weekly rotation, published in PagerDuty

**Expectations:**
- Acknowledge alerts within 5 minutes
- Begin mitigation within 15 minutes
- Escalate if unable to resolve within SLA

---

### Escalation Path

**Level 1:** On-Call Engineer
- Handles SEV-3/SEV-4 incidents independently
- Escalates SEV-1/SEV-2 immediately

**Level 2:** Engineering Lead
- Coordinates SEV-1/SEV-2 response
- Authorizes emergency hotfixes
- Decides on customer communication

**Level 3:** VP Engineering + Product VP
- Involved for prolonged outages (>1 hour)
- Makes business continuity decisions
- Interfaces with executive team and customers

**Specialized Escalations:**
- **Security Issues:** Security Lead (immediately for breaches)
- **Database Issues:** Database/Supabase Lead
- **Partner Integrations:** Partner Success Manager
- **Legal/Compliance:** Legal Counsel + Compliance Lead

---

### Key Contacts

| Role | Name | Contact | Availability |
|------|------|---------|--------------|
| **Engineering Lead** | [Name] | [Email, Phone, Slack] | Business hours + On-call backup |
| **Security Lead** | [Name] | [Email, Phone] | 24/7 for critical issues |
| **Database Lead** | [Name] | [Email, Slack] | Business hours |
| **Product Manager** | [Name] | [Email, Slack] | Business hours |
| **VP Engineering** | [Name] | [Email, Phone] | Escalations only |

**Partner Contacts:**
- **Composio Tool Router Support:** support@composio.dev, Slack: #composio-support (for all six meta-tool operations, rate limits, OAuth, presigned URLs, Remote Workbench issues)
- **CopilotKit Support:** support@copilotkit.ai, Slack: #copilotkit-community
- **Supabase Support:** support@supabase.com, Dashboard support chat
- **Gemini ADK:** Google AI support portal

---

## Related Documents

- **[System Overview](./02_system_overview.md)** — Architecture and component details
- **[Implementation Guide](./04_implementation_guide.md)** — Development and deployment patterns
- **[Release Readiness](./09_release_readiness.md)** — Deployment checklists and evidence requirements
- **[Data Intelligence](./06_data_intelligence.md)** — Telemetry and monitoring specifications
- **[Getting Started](./08_getting_started.md)** — Environment setup for troubleshooting
- **[AGENTS.md](../AGENTS.md)** — Quick troubleshooting cheatsheet

---

**Document Owner:** Operations Team
**Last Updated:** October 2025
**Next Review:** January 2026
**Feedback:** Submit to `docs/readiness/feedback/` or tag `@ai-agent-team`
