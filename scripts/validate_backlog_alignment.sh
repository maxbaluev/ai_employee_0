#!/usr/bin/env bash
set -euo pipefail

python3 <<'PY'
import json
import re
import sys
from pathlib import Path

errors: list[str] = []
warnings: list[str] = []

repo_root = Path.cwd()

backlog_path = repo_root / "docs" / "backlog.md"
alignment_path = repo_root / "docs" / "BACKLOG_ALIGNMENT.md"
todo_path = repo_root / "docs" / "todo.md"
issues_path = repo_root / ".beads" / "issues.jsonl"

backlog = backlog_path.read_text()

mapping_backlog: dict[str, str] = {}
blocks = backlog.split('#### ')[1:]
for block in blocks:
    header, rest = block.split('\n', 1)
    task_id = header.split(':', 1)[0].strip()
    match = re.search(r"\*\*bd Issue:\*\* (code-claude-goal--populate-beads-\d+)", rest)
    if not match:
        errors.append(f"Missing bd reference for {task_id} in docs/backlog.md")
        continue
    mapping_backlog[task_id] = match.group(1)

if not mapping_backlog:
    errors.append("No TASK sections detected in docs/backlog.md")

alignment = alignment_path.read_text()
table_section = []
capture = False
for line in alignment.splitlines():
    if line.startswith('| Task ID'):
        capture = True
    if capture:
        table_section.append(line)
        if line.strip() == '':
            break

mapping_alignment: dict[str, str] = {}
for line in table_section[2:]:  # skip header + divider
    if not line.startswith('|'):
        continue
    parts = [part.strip() for part in line.strip('|').split('|')]
    if len(parts) < 5:
        continue
    task_id, bd_issue = parts[0], parts[1]
    if task_id and bd_issue:
        mapping_alignment[task_id] = bd_issue

if mapping_backlog and set(mapping_backlog) != set(mapping_alignment):
    missing = sorted(set(mapping_backlog) - set(mapping_alignment))
    extra = sorted(set(mapping_alignment) - set(mapping_backlog))
    if missing:
        errors.append(f"BACKLOG_ALIGNMENT.md missing mappings for: {', '.join(missing)}")
    if extra:
        errors.append(f"BACKLOG_ALIGNMENT.md lists unknown tasks: {', '.join(extra)}")

issues: dict[str, dict] = {}
if issues_path.exists():
    with issues_path.open() as fh:
        for raw in fh:
            raw = raw.strip()
            if not raw:
                continue
            if ':' in raw and raw.split(':', 1)[0].isdigit():
                raw = raw.split(':', 1)[1]
            data = json.loads(raw)
            issues[data['id']] = data

if issues:
    missing_bd = sorted(set(mapping_alignment.values()) - set(issues))
    if missing_bd:
        errors.append(f".beads/issues.jsonl missing issue(s): {', '.join(missing_bd)}")

    missing_refs = [issue_id for issue_id, bd in mapping_alignment.items()
                    if issue_id in mapping_backlog and bd in issues and
                    'docs/backlog.md' not in issues[bd].get('description', '')]
    if missing_refs:
        warnings.append("Tracker descriptions missing docs/backlog.md reference for: " + ', '.join(missing_refs))
else:
    warnings.append("No .beads/issues.jsonl file found; skipping tracker cross-checks")

todo = todo_path.read_text()
todo_tasks = set(re.findall(r'\b(TASK-[A-Z0-9-]+)\b', todo))
unknown_todo = sorted(todo_tasks - set(mapping_backlog))
if unknown_todo:
    errors.append(f"docs/todo.md references unknown tasks: {', '.join(unknown_todo)}")

todo_bd = set(re.findall(r'(code-claude-goal--populate-beads-\d+)', todo))
unknown_bd_refs = sorted(todo_bd - set(mapping_alignment.values()))
if unknown_bd_refs:
    errors.append(f"docs/todo.md references unknown bd issues: {', '.join(unknown_bd_refs)}")

print("Backlog alignment validation summary:\n")
print(f"  • TASK blocks found: {len(mapping_backlog)}")
print(f"  • Mapping entries (alignment doc): {len(mapping_alignment)}")
print(f"  • Tracker issues loaded: {len(issues)}")

if warnings:
    print("\nWarnings:")
    for message in warnings:
        print(f"  - {message}")

if errors:
    print("\nErrors:")
    for message in errors:
        print(f"  - {message}")
    sys.exit(1)

print("\nAll required alignment checks passed.")
PY
