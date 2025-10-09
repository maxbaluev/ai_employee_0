# CopilotKit Streaming Contract — Gate G-B

**Updated:** October 9, 2025  
**Owners:** Runtime Steward, CopilotKit Squad

This document captures the payload schema emitted by the Gemini ADK coordinator and sub-agents via the new `CopilotKitStreamer`. These events persist to `/api/copilotkit/session` and `/api/copilotkit/message` so the mission timeline rail can display live status for dry-run proof loops.

## Session Resolution

- `sessionIdentifier`: Defaults to the mission id but can be overridden by `MissionContext.metadata.session_identifier`.
- `tenantId`: Only included when the value is a UUID. When omitted, the Next.js handler falls back to `GATE_GA_DEFAULT_TENANT_ID`.
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

Each lifecycle event is recorded with `role="assistant"` (system exit events use `role="system"`). All messages contain a `stage` key within metadata so the UI can group items.

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

### Planner

```json
{
  "metadata": {
    "stage": "planner_rank_complete",
    "mode": "dry_run",
    "candidate_count": 3,
    "toolkits": {"slack": 2, "hubspot": 1}
  }
}
```

### Execution Loop

- `executor_stage_started`, `validator_stage_started`, `validator_retry`, `validator_reviewer_requested`, `evidence_stage_started`, `execution_loop_completed`, `execution_loop_exhausted`
- Metadata keys: `attempt`, `play_title`, `status`, `violations`, `attempts`

### Executor Artifact

```json
{
  "metadata": {
    "stage": "executor_artifact_created",
    "artifact_id": "artifact-alpha",
    "play_title": "Re-engagement email sequence",
    "status": "draft"
  }
}
```

### Validator Outcome

Metadata includes `violations` array and `reviewer_required` flag.

### Evidence Bundle

Metadata contains `artifact_id` and `play_title` for linking to Supabase artifacts.

## Exit Events

The coordinator emits a final `system` message when the sequential run completes or aborts:

```json
{
  "role": "system",
  "content": "Session exited: completed",
  "metadata": {
    "event": "copilotkit_exit",
    "reason": "completed",
    "stage": "execution_loop_completed"
  }
}
```

## Observability

- All HTTP failures are logged at `DEBUG` without throwing, preserving ADK execution even if CopilotKit persistence is unavailable.
- Session caching prevents duplicate session upserts when multiple agents emit events in the same run.
- The streamer uses a shared instance injected by the coordinator so messages remain ordered and reuse a single HTTP client.

## Follow-up

- Hook the mission timeline rail to `/api/copilotkit/message` using these metadata keys.
- During Gate G-B QA, capture `docs/readiness/copilotkit_session_G-B.mp4` to verify message ordering and latency (<5 s heartbeat).
