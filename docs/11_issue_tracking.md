# AI Employee Control Plane: Issue Tracking & Dependency Graph

**Version:** 1.0 (October 16, 2025)
**Audience:** Engineering Leads, Product Operations, Automation Agents
**Status:** Canonical guidance for `bd` usage inside this repo

---

## Purpose

The Control Plane relies on the lightweight `bd` CLI to capture operational work, express
dependencies, and surface "ready" tasks for both humans and agents. This
document explains how to bootstrap the tracker, keep dependency data healthy,
and plug the graph into automations without breaking repo hygiene.

> `bd` is not part of the product runtime. It is an external CLI issue tracker (Beads) that
> lives alongside the repo and helps teams coordinate deployments, incidents, and follow-up work.
> Mission functionality inside the AI Employee Control Plane operates independently.

For the upstream CLI reference see the official Beads quickstart: <https://github.com/steveyegge/beads>.

### Quick Reference

| Task | Command |
| ---- | ------- |
| Initialise local database (per clone) | `bd init` |
| Create work item | `bd create "Task title" -p 1 -t task -l "ops"` |
| List work | `bd list --status open` |
| Find ready tasks (no blockers) | `bd ready --limit 10` |
| Update status/assignee | `bd update <ISSUE_ID> --status in_progress --assignee you@example.com` |
| Close with reason | `bd close <ISSUE_ID> --reason "Completed via PR #123"` |
| Link dependency | `bd dep add <blocked> <blocker>` |
| Visualise dependencies | `bd dep tree <ISSUE_ID>` |
| Check for cycles | `bd dep cycles` |

---

## 1. Getting Started

- Run `bd init` in the repository root after every fresh clone. This seeds the
  `.beads/` workspace database expected by project automation.
- `bd init --prefix <slug>` overrides the default issue key if you need a custom
  prefix (the default is derived from the repo name).
- Database discovery order: explicit `--db` flag → `$BEADS_DB` → repo
  `.beads/*.db` → `~/.beads/default.db`. Use a custom path only when you
  intentionally share a board across repos.

> **Tip:** The repo assumes the local `.beads/` database exists; avoid deleting
> it or automation dashboards will fail to sync.

---

## 2. Core Workflow

1. **Capture work immediately**
   - `bd create "Fix login bug" -p 1 -t task -d "..."` logs new operator work.
   - Add `--assignee <email>` if ownership is known.
2. **Stay oriented**
   - `bd list --status open` or `bd list --priority 0` filters work queues.
3. **Update status**
   - `bd update BD-123 --status in_progress --assignee you@company.com` keeps
     the tracker accurate.
4. **Close with context**
    - `bd close BD-123 --reason "Fixed in PR #42"` writes the audit trail.

Use `bd ready` when triaging: it only returns tasks without blockers so
operators (human or agent) can pick safe starting points.

---

## 3. Dependency Management

- `bd dep add <blocked> <blocker>` encodes relationships. Supported dependency
  types are `blocks`, `related`, `parent-child`, and `discovered-from` (the
  latter is emitted automatically by agents).
- `bd dep tree <issue>` prints upstream blockers for quick reviews.
- `bd dep cycles` guards against circular dependencies before work begins.

Keep dependency graphs tidy so governance reviews can prove every automation was
unblocked before execution.

---

## 4. Automation & Integrations

- Append `--json` to any command (for example, `bd ready --json`) to emit
  machine-readable output for agents or dashboards.
- Automation scripts rely on the short debounce that exports/imports JSONL
  snapshots. Suppress syncing with `--no-auto-flush` or `--no-auto-import` when
  running experiments that should not touch the shared backlog.
- Use `mise exec -- bd …` if you need to load secrets from `.env` for scripts
  that bridge Supabase or Composio telemetry.

---

## 5. Operational Hygiene Checklist

- Keep the `.beads/` directory under version control and avoid manual edits
      to the database file.
- Record blockers the moment you discover them so `bd ready` remains
      trustworthy for agents.
- Review `bd dep tree` during release readiness checks alongside
      `docs/09_release_readiness.md`.
- Archive or close stale issues during Stage 6 (Reflect) to
      keep velocity reports accurate.

---

### Related Docs

- `AGENTS.md` — tl;dr for automation agents touching `bd`
- `docs/09_release_readiness.md` — evidence expectations before closing issues
- `docs/00_README.md` — navigation guide for the full documentation suite
