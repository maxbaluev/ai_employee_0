# Gate G-A — Nightly Cron Scheduling

The following cron jobs are configured for the Gate G-A environment. All
jobs are defined as Supabase scheduled tasks and should be enabled only in
staging or higher environments with the correct service credentials.

| Job ID | Schedule (UTC) | Description | Observability |
| ------ | -------------- | ----------- | ------------- |
| `cp_mission_session_expiry` | `0 * * * *` (hourly) | Purges expired CopilotKit sessions and messages older than the configured retention window. | Logs to `mission_events` with `event_name = 'session_cleanup'`. |
| `cp_safeguard_rollup` | `30 2 * * *` (daily) | Aggregates safeguard hint adoption metrics into a rollup table for reporting. | Writes summary rows to `mission_safeguards` with `status = 'rollup'`. |
| `cp_telemetry_snapshot` | `0 6 * * *` (daily) | Captures mission telemetry counters for Gate G-A readiness dashboards. | Persists JSON payloads to `mission_events` under `event_name = 'telemetry_snapshot'`. |

## Validation Checklist

- [x] Cron specifications captured in source control (`docs/readiness/cron_scheduling_G-A.md`).
- [x] Each job records a telemetry event for auditability.
- [ ] Jobs deployed to the Supabase project (requires operations access).
- [ ] Alerts configured for failures (configure via Supabase monitoring once deployed).

> The outstanding operational steps require an environment with Supabase
> access. No code changes are needed once the jobs are scheduled.

