# CopilotKit Streaming Contract — Gate G-B

**Updated:** October 9, 2025  
**Owners:** Runtime Steward, CopilotKit Squad

This document captures the payload schema emitted by the Gemini ADK coordinator and sub-agents via the new `CopilotKitStreamer`. These events persist to `/api/copilotkit/session` and `/api/copilotkit/message` so the mission timeline rail can display live status for dry-run proof loops.

## Session Resolution

- `sessionIdentifier`: Defaults to the mission id but can be overridden by `MissionContext.metadata.session_identifier`.
- `tenantId`: **Required** - must be a valid UUID. Gate G-B requires explicit tenant context; no fallback is supported.
- `agentId`: `control_plane_foundation` unless overridden via `NEXT_PUBLIC_COPILOT_AGENT_ID`.

The streamer first upserts the session payload:

```json
{
  "agentId": "control_plane_foundation",
  "sessionIdentifier": "mission-123",
  "tenantId": "3c33212c-d119-4ef1-8db0-2ca93cd3b2dd"
}
```

## Message Payloads

Each lifecycle event is recorded with `role="assistant"` (system exit events use `role="system"`). All messages include both a `stage` key (legacy timeline identifier) and an `event` discriminator (`stage_started`, `status_update`, `rank_complete`, `toolkit_simulation`, `completion`, `artifact_ready`, etc.) so the UI can render context-specific affordances.

### Intake

```json
{
  "role": "assistant",
  "content": "intake_stage_completed: Revive dormant accounts",
  "metadata": {
    "stage": "intake_stage_completed",
    "objective": "Revive dormant accounts",
    "safeguards": ["tone", "quiet_window", "undo_plan"]
  }
}
```

### Planner (stage prefix `planner_*`)

| Stage | `event` | Description | Key metadata |
| ----- | ------- | ----------- | ------------ |
| `planner_stage_started` | `stage_started` | Planner begins ranking candidates. | `mode`, `objective`, `audience` |
| `planner_status` | `status_update` | Progress updates (library query, Composio discovery, candidate ranked, fallback). | `status_type`, `toolkit_count`, `toolkits`, `position`, `similarity`, `confidence` |
| `planner_rank_complete` | `rank_complete` | Ranking completed with summary stats. | `candidate_count`, `average_similarity`, `primary_toolkits`, `toolkit_counts` |
| `planner_candidate_summary` | `candidate_summary` | Markdown rationale for the top-ranked play. | `title`, `impact`, `risk`, `confidence`, `toolkits`, `reason_markdown` |

Example rank complete payload:

```json
{
  "role": "assistant",
  "content": "Ranking complete: 3 candidate plays prepared",
  "metadata": {
    "stage": "planner_rank_complete",
    "event": "rank_complete",
    "mode": "dry_run",
    "candidate_count": 3,
    "average_similarity": 0.74,
    "primary_toolkits": ["slack", "sheets"],
    "toolkit_counts": {"slack": 2, "sheets": 1}
  }
}
```

### Execution Loop

`ExecutionLoopAgent` now uses `emit_stage` for all lifecycle transitions, emitting structured stage + event metadata with consistent schema. All execution loop events include `mission_id`, `mission_status`, and play identifiers.

| Stage | `event` | Description | Key metadata |
| ----- | ------- | ----------- | ------------ |
| `executor_stage_started` | `stage_started` | Executor stage begins. | `attempt`, `play_id`, `play_title`, `mission_id`, `mission_status` (`in_progress`) |
| `validator_stage_started` | `stage_started` | Validator stage begins. | `attempt`, `play_id`, `play_title`, `mission_id`, `mission_status` (`in_progress`) |
| `validator_retry` | `retry` | Validator scheduled retry. | `attempt`, `status`, `play_id`, `play_title`, `mission_id`, `mission_status` (`in_progress`) |
| `validator_reviewer_requested` | `reviewer_requested` | Validator requested reviewer intervention. | `attempt`, `status`, `play_id`, `play_title`, `mission_id`, `mission_status` (`needs_reviewer`) |
| `evidence_stage_started` | `stage_started` | Evidence bundling begins. | `attempt`, `play_id`, `play_title`, `mission_id`, `mission_status` (`in_progress`) |
| `execution_loop_completed` | `completed` | Execution loop succeeded. | `attempts`, `status`, `play_id`, `play_title`, `mission_id`, `mission_status` (`completed`) |
| `execution_loop_exhausted` | `exhausted` | Execution loop exhausted retries. | `attempts`, `status`, `play_id`, `play_title`, `mission_id`, `mission_status` (`exhausted`) |

### Executor (`executor_*`)

| Stage | `event` | Description | Key metadata |
| ----- | ------- | ----------- | ------------ |
| `executor_stage_started` | `stage_started` | Execution attempt begins. | `attempt`, `play_title`, `toolkit_count`, `play_id` |
| `executor_status` | `toolkit_simulation` | Toolkit simulation progress per Composio recommendation. | `toolkit`, `position`, `total`, `play_id` |
| `executor_artifact_created` | `artifact_ready` | Draft artifact stored for review. | `artifact_id`, `play_title`, `status`, `undo_plan`, `hash` |

Example artifact payload:

```json
{
  "metadata": {
    "stage": "executor_artifact_created",
    "event": "artifact_ready",
    "artifact_id": "artifact-alpha",
    "play_title": "Re-engagement email sequence",
    "status": "draft",
    "undo_plan": "Document manual rollback",
    "hash": "991c1cfb…"
  }
}
```

### Validator (`validator_*`)

| Stage | `event` | Description | Key metadata |
| ----- | ------- | ----------- | ------------ |
| `validator_stage_started` | `stage_started` | Validator begins safeguard audit. | `attempt`, `safeguard_count` |
| `validator_feedback` | `completion` | Validator outcome ready for the execution loop. | `status` (`auto_fix`/`retry_later`/`ask_reviewer`), `violations`, `reviewer_required`, `notes`, `attempt` |
| `validator_retry` | `retry` | Retry scheduled due to safeguard miss. | `attempt`, `status`, `violations` |
| `validator_reviewer_requested` | `escalation` | Reviewer intervention required. | `status`, `violations`, `tool_call_id` |

### Validator Outcome

Metadata includes `violations` array and `reviewer_required` flag.

### Evidence Bundle

`EvidenceAgent` emits `evidence_bundle_created` via `emit_stage` with expanded metadata for timeline richness.

| Stage | `event` | Description | Key metadata |
| ----- | ------- | ----------- | ------------ |
| `evidence_bundle_created` | `bundle_created` | Evidence bundle persisted to Supabase. | `artifact_id`, `play_title`, `hash`, `safeguard_count`, `undo_plan_present`, `validation_status`, `mission_id`, `mission_status` |

Example payload:

```json
{
  "role": "assistant",
  "content": "Evidence bundle created for Re-engagement email sequence (artifact=artifact-alpha, safeguards=3)",
  "metadata": {
    "stage": "evidence_bundle_created",
    "event": "bundle_created",
    "artifact_id": "artifact-alpha",
    "play_title": "Re-engagement email sequence",
    "hash": "991c1cfb12345678",
    "safeguard_count": 3,
    "undo_plan_present": true,
    "validation_status": "auto_fix",
    "mission_id": "mission-123",
    "tenant_id": "3c33212c-d119-4ef1-8db0-2ca93cd3b2dd",
    "mission_status": "completed"
  }
}
```

## Exit Events

The coordinator guarantees a final `system` message when the sequential run completes, pauses for review, exhausts retries, or aborts with an error. The payload now includes a `mission_status` field so the UI can close the timeline intelligently:

```json
{
  "role": "system",
  "content": "Session exited: completed",
  "metadata": {
    "event": "copilotkit_exit",
    "reason": "completed",
    "mission_status": "completed",
    "stage": "execution_loop_completed",
    "attempts": 1
  }
}
```

`mission_status` values:

- `completed` — dry-run loop produced an evidence bundle.
- `needs_reviewer` — validator escalated; timeline pauses until reviewers act.
- `exhausted` — retry budget consumed without passing safeguards.
- `error` — unexpected exception during executor/validator/evidence stages.

The same payload is emitted even when retries are paused (`stage=validator_reviewer_requested`) so the front-end can surface “Why waiting?” hints.

## Observability

- All HTTP failures are logged at `DEBUG` without throwing, preserving ADK execution even if CopilotKit persistence is unavailable.
- Session caching prevents duplicate session upserts when multiple agents emit events in the same run.
- The streamer uses a shared instance injected by the coordinator so messages remain ordered and reuse a single HTTP client.

## Follow-up

- Hook the mission timeline rail to `/api/copilotkit/message` using these metadata keys.
- During Gate G-B QA, capture `docs/readiness/copilotkit_session_G-B.mp4` to verify message ordering and latency (<5 s heartbeat).
