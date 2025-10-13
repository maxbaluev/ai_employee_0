# CopilotKit QA — Gate G-A

# CopilotKit QA — Gate G-A

This directory contains evidence that the CopilotKit workspace persists
sessions, messages, and exit events during Gate G-A dry runs.

## Automated Verification

- `scripts/test_copilotkit_persistence.py` exercises the Supabase client in
  offline mode, simulating mission updates, streaming messages, and
  completion events. The script writes results to
  `test_results.txt` for reproducibility.
- `scripts/test_supabase_persistence.py` complements this by verifying that
  schema checksums are stable and that mission telemetry falls back to
  offline buffering when direct writes are disabled.

Run both scripts from the repository root:

```bash
python scripts/test_supabase_persistence.py
python scripts/test_copilotkit_persistence.py | tee docs/readiness/copilotkit_qa_G-A/test_results.txt
```

## Manual Evidence (optional)

Add screenshots demonstrating the following once the UI is wired to a live
Supabase instance:

- Mission intake before refresh
- Database rows created in `objectives`, `copilot_sessions`, and
  `copilot_messages`
- Workspace state after refresh confirming restored mission brief
