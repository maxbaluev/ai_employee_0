# Gate G-B Documentation Rewrite Roadmap

This file catalogs the updates required to align `new_docs/` with the final Gate G-B mission workspace. Treat it as the living source of truth while editing. Check off items as they are completed.

---

## 0. Reference Inputs

- Final plan captured during the Oct 10, 2025 session: **Intake → Mission Brief → Toolkits (Connect) → Data Inspect → Plan → Dry-Run → Evidence → Feedback**.
- Current UI still shows Gate G-A fallback chips (see screenshot). All docs must remove that language.
- Partner packs in `libs_docs/` for terminology:
  - `libs_docs/composio/llms.txt`
  - `libs_docs/copilotkit/llms-full.txt`
  - `libs_docs/adk/llms-full.txt`
  - `libs_docs/supabase/llms_docs.txt`

---

## 1. Canonical Gate G-B Flow

1. **Intake** – Single-input banner generates chips via Gemini (no fallback state).
2. **Mission Brief** – Accepted chips persist in Supabase; brief card remains pinned.
3. **Toolkits & Connect** – User-curated Composio palette with inspection preview and Connect Link auth.
4. **Data Inspect** – MCP draft calls validate coverage/freshness; coverage meter communicates readiness.
5. **Plan** – Planner insight rail streams rationale; user selects ranked plays with impact/risk/undo.
6. **Dry-Run** – Streaming status panel narrates planner → executor → validator loop; heartbeat + logs.
7. **Evidence** – Artifact gallery surfaces proof pack, ROI, undo bar.
8. **Feedback** – Per-artifact ratings, mission feedback, learning signals feeding next runs.

Every documentation file must reflect this flow and remove Gate G-A references.

---

## 2. File-by-File Tasks

### 2.1 `new_docs/architecture.md`

- [x] §3.3 Orchestration: describe Coordinator → Planner → Validator → Evidence loop, planner insight rail, safeguard enforcement, learning signals.
- [x] §3.4 Execution & Composio Integration: document managed auth (`toolkits.authorize`, `waitForConnection`), toolkit inspection previews, coverage meter, undo plans.
- [x] §4 Runtime Flows: replace diagrams with eight-stage sequences (include inspection + feedback loops).
- [x] Cross-check removal of fallback/Gate G-A terminology.

### 2.2 `new_docs/ux.md`

- [x] §3 Journey Map: rewrite for eight stages, success criteria, telemetry, time budgets.
- [x] §4 Workspace Anatomy: mission brief card, toolkit palette, coverage meter, planner insight rail, streaming panel, artifact gallery, feedback drawer.
- [x] §5 Interaction Patterns: toolkit inspect/connect flow, streaming logs, undo bar, accessibility, keyboard shortcuts.
- [x] §6 Metrics: update KPIs (chip acceptance ≥70 %, inspection pass ≥85 %, dry-run <15 min, feedback adoption ≥60 %).
- [x] §7 Safeguards: adaptive hints, validator/reviewer loop, undo rehearsal.

### 2.3 `new_docs/workflow.md`

- [x] §3 Generative Intake Workflow: document persistence schema (`mission_metadata`, `mission_safeguards`), no fallback.
- [x] §4 Planning & Capability Grounding: toolkit selection, inspection APIs, coverage meter, validator gate, telemetry.
- [x] §5 Dry-Run Execution: streaming status panel, artifact pipeline, undo bar, telemetry events.
- [x] §6 Governed Activation: managed auth, evidence-first OAuth, safeguard enforcement, telemetry.
- [x] Add telemetry table mapping events to stages.

### 2.4 `new_docs/todo.md`

- [x] Gate G-B checklist: summarize eight-stage flow, add cleanup checkpoints (remove fallback code paths, update Supabase schema, retire old status beacon references).
- [x] Add readiness evidence tasks (screenshots, telemetry exports, inspection transcripts, evidence hash report).
- [x] Add documentation QA steps (Prettier run, terminology audit against libs_docs).

---

## 3. Cleanup & Alignment Checklist

- [x] Update badge references to “Gate G-B · Dry-Run Proof”.
- [x] Document Supabase tables: `mission_metadata`, `mission_safeguards`, `toolkit_selections`, `inspection_findings`, `plays`, `tool_calls`, `artifacts`, `oauth_tokens`, `mission_feedback`.
- [x] Telemetry list: `mission_brief_generated`, `mission_brief_accepted`, `toolkit_recommendation_viewed`, `toolkit_selected`, `inspection_preview_rendered`, `plan_validated`, `dry_run_stage_completed`, `artifact_feedback_submitted`, `learning_signals_emitted`, `oauth_initiated`, `oauth_completed`.
- [x] Accessibility: WCAG 2.1 AA, keyboard navigation, ARIA live regions, reduced-motion mode.

---

## 4. Execution Sequence

1. Update `architecture.md` sections (per 2.1). — _Next step_
2. Update `ux.md` sections (per 2.2).
3. Update `workflow.md` sections (per 2.3).
4. Update `todo.md` Gate G-B checklist (per 2.4).
5. Run `pnpm exec prettier --write new_docs/**/*.md ARCHITECTURE_UPDATES.md`.
6. Perform cross-file QA, remove TODOs, finalize summary.

---

## 5. Status Log

- 2025-10-10: Roadmap drafted; architecture.md §§3.1-3.2 already modernized in earlier pass; remaining sections pending.
- 2025-10-10: Gate G-B documentation rewrite complete; eight-stage flow reflected across `architecture.md`, `ux.md`, `workflow.md`, `todo.md`; cleanup checklist satisfied.
