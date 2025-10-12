# Gate G‑B Follow-ups

- **Redis limiter backend**: implement `RegenerationLimiterStore` using Redis (respect `REDIS_URL`, atomic INCR/PEXPIRE, env-guarded tests).
- **Telemetry audit in CI**: add workflow step invoking `scripts/audit_telemetry_events.py --gate G-B` once Supabase secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) are available.
- **ADK eval runs**: ensure `mise run test-agent` (smoke + dry run configs) is incorporated into Gate G‑B regression sweeps.
- **todo.md alignment**: verify remaining Gate G‑B checklist items in `new_docs/todo.md` and close/document gaps after the above actions.
