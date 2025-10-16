# Runbook: Beads Database Corruption or Missing

**Audience:** On-call engineers, SRE, automation owners  
**Last Updated:** October 16, 2025

---

## Purpose

Restore the Beads (`bd`) operational database when commands fail because `.beads/` is missing, corrupted, or locked. Keeping this workspace healthy is mandatory for deployments, incidents, and maintenance windows.

---

## Common Symptoms

- `bd init` returns errors about existing metadata or permission denied.
- `bd list` / `bd ready` exit with `database is locked` or `no such table: issues`.
- Automation bots fail with messages indicating Beads cannot export JSONL snapshots.
- `.beads/` missing entirely after a fresh checkout.

---

## Immediate Actions

1. Pause ongoing operational work and announce in `#ai-control-plane` that Beads is unavailable. Note the active `bd` issue IDs.
2. Capture the failure for audit:
   ```bash
   mkdir -p logs
   bd list --status open 2> logs/bd_failure_$(date +%s).log || true
   ```
3. Identify who last wrote to `.beads/` via git history:
   ```bash
   git log -n 5 -- .beads/
   ```

---

## Recovery Procedure

1. **Check for locks**
   ```bash
   lsof .beads/*.db || true
   ```
   - If a process is holding the database, terminate it gracefully or wait for completion.

2. **Re-initialise (missing database)**
   ```bash
   rm -rf .beads/
   bd init
   ```
   - Re-run `bd list` to confirm the schema is back.

3. **Restore from git (corruption)**
   ```bash
   git checkout -- .beads/
   bd import --format jsonl .beads/issues.jsonl
   bd list --status open
   ```

4. **Validate operational readiness**
   ```bash
   bd ready --limit 5
   bd dep cycles
   ```
   - Update the active deployment/incident issue with a comment noting the recovery steps.

---

## Post-Recovery

- Resume the paused workflow and re-run any automation that depends on Beads (daily summaries, CI updates).
- Attach the recovery log and commands to the root operational issue using `bd comment <ISSUE>`.
- If the database was corrupted twice within a sprint, open a `bd` maintenance task to investigate root cause.

---

## Prevention

- Ensure all shells source the repo-local `.env` so `bd` picks the correct database path.
- Avoid manual edits to files under `.beads/`; use `bd export/import` instead.
- During multi-machine work, pull latest git changes before running `bd ready` to avoid diverging JSONL snapshots.
- Add `bd init` to any onboarding or CI scripts that create new worktrees.

---

## References

- `docs/11_issue_tracking.md`
- `docs/07_operations_playbook.md` (Beads Operational Foundation)
- `AGENTS.md` deployment automation notes
