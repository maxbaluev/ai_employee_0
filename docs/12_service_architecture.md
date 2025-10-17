# AI Employee Control Plane: Service Architecture Foundation

**Version:** 1.0 (October 17, 2025)  
**Audience:** Backend engineers, automation agents, product operations  
**Status:** Foundation document – code scaffolding landed, production wiring pending

---

## 1. Purpose

The Gemini ADK backend now exposes three dedicated service modules under
`agent/services/`:

1. `composio.py` — discovery, OAuth, and governed execution via
   `composio==0.8.20`
2. `supabase.py` — mission persistence, readiness evidence, and library helpers
   via `supabase==2.22.0`
3. `telemetry.py` — structured event emission with future redaction hooks

This document captures the contract for each service, references downstream
agents, and enumerates follow-up tasks required before production rollout.

---

## 2. Repository Layout

| Path                       | Role                                                     |
| -------------------------- | -------------------------------------------------------- |
| `agent/services/composio.py` | Composio SDK wrapper (discovery, OAuth, execution)       |
| `agent/services/supabase.py` | Supabase client wrapper (mission state, evidence, plays) |
| `agent/services/telemetry.py` | Telemetry client placeholder                             |
| `agent/services/session.py` | Supabase-backed session persistence (already implemented) |
| `agent/services/__init__.py` | Public exports consumed by agents and API routes         |

Each module is currently a typed placeholder. Methods delegate to dynamic
attribute lookups so unit tests can run without live dependencies. Follow-up
work replaces these stubs with explicit SDK calls, error handling, and
telemetry.

---

## 3. Composio Service (Stage 2 → Stage 6)

**File:** `agent/services/composio.py`  
**SDK Pin:** `composio==0.8.20`

### Responsibilities

- `tools_search()` — InspectorAgent discovery (Stage 2 — Prepare)
- `toolkits_authorize()` + `wait_for_connection()` — OAuth Connect Links after
  stakeholder approval
- `connected_accounts_status()` — Planner/Validator scope validation (Stage 3)
- `execute_tool_call()` — ExecutorAgent governed execution (Stage 5)
- `audit_list_events()` — EvidenceAgent undo plans (Stage 5/6)

### Next Steps

- Replace placeholder attribute lookups with real Composio SDK calls
- Emit telemetry hooks (`composio_discovery`, `composio_auth_flow`,
  `composio_tool_call`)
- Implement retry/backoff helpers and error mapping to ADK events

---

## 4. Supabase Service (Cross-Stage)

**File:** `agent/services/supabase.py`  
**SDK Pin:** `supabase==2.22.0`

### Responsibilities

- Mission metadata (`mission_metadata`, `mission_safeguards`, `mission_stage_status`)
- OAuth audit trail (`mission_connections`)
- Planner outputs (`mission_plays`, `mission_undo_plans`)
- Evidence pipeline (`mission_artifacts`, `mission_evidence`)
- Feedback, library reuse, and readiness telemetry views

### Next Steps

- Replace dynamic table lookups with typed Supabase calls
- Implement optimistic locking and retry handling aligned with
  `SupabaseSessionService`
- Ensure payload redaction aligns with `docs/06_data_intelligence.md`

---

## 5. Telemetry Service

**File:** `agent/services/telemetry.py`

### Responsibilities

- Centralise telemetry emission for agents and API routes
- Apply PII redaction helpers (`src/lib/telemetry/redaction.ts` parity)
- Validate event payloads against catalog in `docs/06_data_intelligence.md`

### Next Steps

- Implement schema validation + redaction pipeline
- Provide async batching + retry strategy (leveraging Supabase queue or in-app buffer)

---

## 6. Integration Touchpoints

| Agent / Route                                | Service Usage                                          |
| -------------------------------------------- | ------------------------------------------------------ |
| `agent/agents/inspector.py`                  | Composio discovery/OAuth, Supabase connections table   |
| `agent/agents/planner.py`                    | Supabase plays + library search                        |
| `agent/agents/executor.py`                   | Composio execution, telemetry alerts                   |
| `agent/agents/evidence.py`                   | Composio audit, Supabase artifacts/evidence            |
| `agent/agents/validator.py`                  | Composio scopes, Supabase safeguards                   |
| `src/app/api/*` (future)                     | Supabase persistence + telemetry emission              |
| `agent/services/session.py`                  | Shares Supabase client for mission session storage     |

---

## 7. Migration Checklist

1. ✅ Split service scaffolding into dedicated modules (this change)
2. 📄 Update documentation (`docs/04_implementation_guide.md`, this file)
3. 🧾 Track follow-up implementation tasks in Beads (`bd create`)
4. 🔐 Configure environment secrets (`COMPOSIO_API_KEY`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`) before swapping in real SDK logic
5. ✅ Keep `agent/requirements.txt` pinned to `composio==0.8.20` and
   `supabase==2.22.0`
6. 🧪 Add integration tests gated behind secrets once services are wired

---

## 8. Beads Tasks (Tracked Work)

| Task ID        | Priority | Description |
| -------------- | -------- | ----------- |
| `ai_eployee_0-1` | P0       | Implement Composio service with real SDK + telemetry |
| `ai_eployee_0-2` | P0       | Implement Supabase service with typed calls + retries |
| `ai_eployee_0-3` | P1       | Build telemetry service with redaction + validation |

> Use `bd dep add` to link these tasks to downstream agent work (Inspector,
> Planner, Executor, Evidence) when implementation begins.

---

## 9. References

- `docs/04_implementation_guide.md` — Backend agents & integration patterns
- `docs/06_data_intelligence.md` — Telemetry catalog + redaction expectations
- `docs/10_composio.md` — Progressive trust + Connect Link workflow
- `supabase/migrations/0001_init.sql` — Mission persistence schema
- `agent/services/session.py` — Supabase-backed session persistence reference

---

## 10. Owner Notes

- **Engineering lead:** Owns SDK integration, retries, and telemetry coverage
- **Trust engineering:** Reviews redaction + audit logging before rollout
- **Automation agents:** Use this guide as the source of truth for service
  expectations when implementing follow-up tasks

