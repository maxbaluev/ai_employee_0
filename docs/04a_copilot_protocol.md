# AI Employee Control Plane: Copilot Communication Protocol (AG-UI)

**Version:** 1.1 (October 17, 2025)
**Audience:** Frontend engineers, Gemini ADK engineers, automation agents, observability teams
**Status:** Canonical reference for how CopilotKit, AG-UI, Gemini ADK, and Composio exchange mission data

---

## 1. Purpose & Scope

This document captures the communication contract that powers the Control Plane’s mission workspace. It explains how **CopilotKit surfaces** talk to **AG-UI protocol endpoints**, how those events are bridged into the **Gemini ADK agent graph**, and how **Composio tool calls** and **Supabase state** are surfaced back to the UI without breaking the progressive trust model.

With this revision the CopilotKit hook integration patterns (formerly `docs/05a_copilotkit_hooks_guide.md`) now live in Sections 6–8, so this file is the single source of truth for both transport flows and React hook usage.

Read this guide before modifying `/src/app/api/copilotkit/route.ts`, wiring new Gemini ADK agents, or extending chat/Runboard behaviour — it keeps UX, safety, and telemetry aligned.

---

## 2. Protocol Stack Overview

| Layer | Control Plane Component | Responsibilities | Reference |
| --- | --- | --- | --- |
| **Presentation** | CopilotKit runtime + React hooks (`useCopilotReadable`, `useCopilotChat`, etc.) | Stage-aware UI, mission UX, accessibility, hook orchestration | `docs/03_user_experience.md`, §§6–8 of this doc |
| **Transport / Protocol** | **AG-UI Protocol** via `@ag-ui/client`’s `HttpAgent` | Normalises streaming events, tool calls, state snapshots | §§3–5 of this doc, AG-UI SDK READMEs under `node_modules/@ag-ui/*` |
| **Agent Orchestration** | Gemini ADK agents bridged by `ag_ui_adk.ADKAgent` | Stateful multi-agent flow, telemetry fan-out | `docs/04_implementation_guide.md` |
| **Execution** | Composio SDK toolkits + Supabase persistence | Tool discovery, OAuth, governed execution, evidence storage | `docs/10_composio.md`, `docs/06_data_intelligence.md` |

The key bridge lives at `/src/app/api/copilotkit/route.ts`: CopilotKit forwards chat and stage events to `@ag-ui/client`’s `HttpAgent`. The AG-UI client speaks the standard Agent-User Interaction protocol, which `ag_ui_adk` converts into Gemini ADK runs (`Runner.run_stream` internally). Returned AG-UI events stream back to CopilotKit, updating mission UI in real time.

---

## 3. Session Lifecycle

1. **Handshake**
   - CopilotKit issues a POST to `/api/copilotkit` with `messages` + metadata.
   - `HttpAgent` serialises the request to AG-UI’s JSON envelope (`RunAgentInput`).
   - `ag_ui_adk.ADKAgent` maps `RunAgentInput` into an ADK `InvocationContext`, instantiates session state, and yields `RUN_STARTED`.

2. **Streaming Phase**
   - ADK agents emit events (`Event` objects). The translator converts them to AG-UI event types:
     - `RUN_STARTED` → UI banner “Stage resumed”.
     - `TEXT_MESSAGE_*` → chat narration / rationale streaming.
     - `TOOL_CALL_START/ARGS/RESULT` → Composio execution cards.
     - `STATE_SNAPSHOT/STATE_DELTA` → CopilotKit readable updates (mission brief, readiness meters, etc.).
     - `STEP_STARTED/FINISHED` → Runboard timeline updates.
   - Each AG-UI event is persisted to Supabase telemetry by the backend (planned) and mirrored by CopilotKit for deterministic replay.

3. **Completion**
   - ADK signals `RUN_FINISHED` after Stage 6 (Reflect) tasks wrap or the coordinator pauses.
   - `HttpAgent` resolves the promise with `newMessages` so CopilotKit can optionally append a summary.

4. **Error / Interrupt Handling**
   - ADK `RUN_ERROR` events map to AG-UI error cards. `ag_ui_adk` ensures `rawEvent` stays attached for debugging.
   - Validator/Inspector-triggered interrupts surface as `CUSTOM` events with `metadata.stage` so CopilotKit routes back to Prepare.

---

## 4. Event Taxonomy & Mapping

| AG-UI Event | Typical Producer | Mission Stage Usage | CopilotKit Handling | Telemetry |
| --- | --- | --- | --- | --- |
| `RUN_STARTED` / `RUN_FINISHED` | CoordinatorAgent | Stage transitions | Stage banner + heartbeat reset | `mission_stage_transition` |
| `TEXT_MESSAGE_START/CONTENT/END` | Intake, Planner, Evidence agents | Define, Plan, Reflect narration | Streams into chat rail | `planner_candidate_generated`, `mission_summary_streamed` |
| `TOOL_CALL_START/ARGS/RESULT` | ExecutorAgent | Execute stage governed calls | Live Runboard entries | `composio_tool_call` |
| `STATE_SNAPSHOT` | Coordinator / Evidence | Stage readiness, undo countdowns | Updates CopilotKit Readables | `readiness_status_changed` |
| `STATE_DELTA` | Validator, Inspector | Scope approvals, safeguard status | Lightweight store patches | `safeguard_reviewed`, `composio_auth_flow` |
| `MESSAGES_SNAPSHOT` | Coordinator on resume | Stage resume after refresh | Chat hydration | `workspace_stream_open` |
| `STEP_STARTED/FINISHED` | Planner / Executor | Multi-step plays | Runboard progress bars | `execution_step_completed` |
| `RUN_ERROR` | Any agent | Safeguard block, scope failures | Alert card + undo CTA | `validator_alert_raised` |
| `CUSTOM` | Undo orchestration | Undo window countdown, manual interventions | Chat countdown bubble | `undo_triggered` |

> **Binary streaming:** When latency matters, switch `HttpAgent` to `contentType: AGUI_MEDIA_TYPE` from `@ag-ui/proto` for protobuf payloads. CopilotKit still receives decoded JSON.

---

## 5. Stage-Specific Communication Patterns

- **Define:** IntakeAgent emits `TEXT_MESSAGE_*` for chip rationale + `STATE_SNAPSHOT` once the mission brief locks. CopilotKit keeps additional instructions pinned so ADK knows the brief is editable until `STATE_DELTA.available === "locked"`.
- **Prepare:** InspectorAgent streams `STATE_DELTA` for readiness meters and `CUSTOM` events for Connect Link URLs. Approvals must be acknowledged by CopilotKit before Inspector proceeds (front-end sets `acknowledged` metadata which ADK stores in session state).
- **Plan:** PlannerAgent batches ranked play cards via `TEXT_MESSAGE_CHUNK` to reduce flicker. ValidatorAgent emits `STATE_DELTA` when safeguards fail, prompting UI interrupts.
- **Approve:** Coordinator waits for `user_decision` metadata coming from CopilotKit `useCopilotAction` handlers; once stored in session state the backend emits `STEP_FINISHED` for audit.
- **Execute:** ExecutorAgent produces alternating `TOOL_CALL_*` and `STATE_DELTA` heartbeats. EvidenceAgent listens for `TOOL_CALL_RESULT` to attach hashes before `RUN_FINISHED`.
- **Reflect:** EvidenceAgent finalises with `TEXT_MESSAGE_*` summarising outcomes and `STATE_SNAPSHOT` pointing to Supabase artifact IDs. Feedback drawer actions are routed back as new RunAgent invocations.

---

## 6. Hook Integration Patterns

Concentrate hook usage around predictable payloads so AG-UI deltas translate cleanly into CopilotKit state. The sections below consolidate the former `docs/05a_copilotkit_hooks_guide.md` content.

### 6.1 Quick Reference

| Hook | What it exposes | Control Plane usage |
| --- | --- | --- |
| `useCopilotReadable` | Declarative read-only context objects | Mission brief, readiness signals, artifact metadata |
| `useCopilotAdditionalInstructions` | Prompt augmentation & guardrails | Stage-specific tone, compliance reminders, fallback guardrails (no persona lock) |
| `useCopilotAction` | Executable functions & optional generative UI renderers | Intent chip edits, Connect Link launchers, undo flows |
| `useCopilotChat` | Programmatic chat APIs (append, replace, reset) | Streaming rationale, ADK event mirroring, mission timeline banners |
| `useCopilotChatHeadless` | Headless chat driver for custom UI | Side panel recaps, runway cards in `MissionWorkspaceLayout` |
| `useCopilotChatSuggestions` | Inline suggestion provider | Stage-specific quick replies (“Request scopes”, “Summarize undo plan”) |
| `useCoAgent` | Bidirectional ADK state hook | Coordinator session state, Inspector readiness, Planner scorecards |
| `useCoAgentStateRender` | Reactive renderer for CoAgent state | Chat cards for inspection progress, planner rankings, execution heartbeat |

### 6.2 Choosing between `useCopilotReadable` and `useCopilotAdditionalInstructions`

| Scenario | Prefer Readable when… | Prefer Additional Instructions when… |
| --- | --- | --- |
| **Mission data** | You need the LLM to cite structured fields (brief, coverage %, audit IDs). | You must enforce behaviour regardless of current readable data (e.g., “Never propose scopes outside CRM tenant”). |
| **Real-time updates** | Data changes frequently during a stage and should stream to the model. | Behavioural cues vary by stage (“During Approve, only summarise risk deltas”). |
| **Compliance** | Exposing sanitised values is enough (no extra wording). | Legal/compliance copy must appear verbatim in system prompt (e.g., regulator disclaimers). |
| **Performance** | Values can be serialised cheaply (small JSON). | Instructions are short strings; overuse leads to prompt bloat, so keep terse. |

**Best practice:** use both hooks together—Readable carries the facts, Additional Instructions nudge tone & guardrails. Keep instruction payloads under 600 chars to protect latency.

### 6.3 Hook Details & Patterns

#### `useCopilotReadable`

- **Purpose:** Stream mission context into the model safely and incrementally.
- **Pattern:** Register one Readable per logical domain (brief, readiness, evidence) so downstream actions can reference stable IDs.
- **Lifecycle:** Mount at component render, update when mission store changes, unmount automatically as component leaves stage.
- **Implementation sketch:**

```tsx
"use client";
import { useCopilotReadable } from "@copilotkit/react-core";
import { useMissionWorkspaceStore } from "@/src/app/(control-plane)/stores";

export function MissionBriefReadable() {
  const brief = useMissionWorkspaceStore((state) => state.brief);

  useCopilotReadable({
    id: "mission-brief",
    description: "Mission brief with objective, audience, KPIs, safeguards",
    value: brief,
    available: brief.locked ? "enabled" : "disabled",
  });

  return null; // purely side-effect for CopilotKit
}
```

#### `useCopilotAdditionalInstructions`

- **Purpose:** Append stage-aware behavioural guardrails to the Copilot system prompt.
- **When to use:** stage transitions (“In PREPARE, never promise execution before approval”), persona nudges, safety disclaimers.
- **Implementation sketch:**

```tsx
import { useCopilotAdditionalInstructions } from "@copilotkit/react-core";
import { useMissionStage } from "@/src/app/(control-plane)/hooks";

export function StageInstructionHints() {
  const stage = useMissionStage();

  useCopilotAdditionalInstructions({
    id: `copilot-stage-${stage}`,
    instructions:
      stage === "APPROVE"
        ? "Only surface differences between latest plan and prior approved scope."
        : "Keep summaries in first-person plural and cite readiness sources.",
  });

  return null;
}
```

#### `useCopilotAction`

- **Purpose:** Register executable affordances the copilot can trigger.
- **Patterns we rely on:** command handlers (Connect Links, brief locking), generative UI previews, undo plans paired with Composio audit events.
- **Implementation sketch:**

```tsx
import { useCopilotAction } from "@copilotkit/react-core";
import { launchConnectLink } from "@/src/lib/composio/connect-link";

export function PrepareActions({ toolkitId }: { toolkitId: string }) {
  useCopilotAction({
    id: `connect-${toolkitId}`,
    name: "Request OAuth approval",
    parameters: [{ name: "reason", type: "string" }],
    handler: async ({ reason }) => launchConnectLink({ toolkitId, reason }),
    render: ({ status }) =>
      status === "running" ? "Launching OAuth link…" : null,
  });

  return null;
}
```

#### `useCopilotChat` & `useCopilotChatHeadless`

- **`useCopilotChat`:** Use when embedding CopilotKit UI (`CopilotSidebar`, `CopilotPopup`). Grants `appendMessage`, `replaceMessage`, `clearMessages`, and loading state.
- **`useCopilotChatHeadless`:** Use inside bespoke mission panels to consume the same chat session without rendering the default UI. Perfect for timeline banners and hybrid layouts.
- **Control Plane usage:** append planner rationale, echo ADK events, drive Runboard ticker while keeping history synced.

```tsx
import { useCopilotChat } from "@copilotkit/react-core";

export function PlannerStreamBridge({ event }: { event: PlannerEvent }) {
  const { appendMessage } = useCopilotChat();

  useEffect(() => {
    if (!event) return;
    appendMessage({
      role: "assistant",
      content: `Planner ranked ${event.playName} (${event.score}%)`,
      metadata: { stage: "PLAN", playId: event.playId },
    });
  }, [appendMessage, event]);

  return null;
}
```

```tsx
import { useCopilotChatHeadless } from "@copilotkit/react-core/headless";

export function RunboardTicker() {
  const { messages, isLoading } = useCopilotChatHeadless();

  return (
    <Timeline
      loading={isLoading}
      entries={messages.filter((msg) => msg.metadata?.stage === "EXECUTE")}
    />
  );
}
```

#### `useCopilotChatSuggestions`

- **Purpose:** Generate contextual quick replies for operators.
- **Pattern:** Provide an array of suggestions keyed to mission stage and readiness state; avoid stale prompts by returning an empty array when no suggestions apply.

```tsx
import { useCopilotChatSuggestions } from "@copilotkit/react-ui";
import { useMissionStage, useReadiness } from "@/src/app/(control-plane)/hooks";

export function StageSuggestions() {
  const stage = useMissionStage();
  const readiness = useReadiness();

  useCopilotChatSuggestions(() => {
    if (stage === "PREPARE" && readiness === "needs-auth") {
      return [
        {
          label: "Request Connect Link",
          prompt: "Ask stakeholders to approve OAuth scopes.",
        },
      ];
    }
    if (stage === "EXECUTE") {
      return [
        {
          label: "Show undo plan",
          prompt: "Summarize the current undo strategy and timers.",
        },
      ];
    }
    return [];
  });

  return null;
}
```

#### `useCoAgent`

- **Purpose:** Mirror ADK agent state into the UI and push updates back into the runloop.
- **Control Plane usage:** coordinator session metadata, inspector coverage, planner rankings, executor heartbeat.

```tsx
import { useCoAgent } from "@copilotkit/react-core";

type PlannerState = {
  plays: Array<{
    id: string;
    score: number;
    status: "pending" | "ready" | "blocked";
  }>;
};

export function PlannerStateBridge() {
  const { state, setState } = useCoAgent<PlannerState>({
    name: "planner_agent",
  });

  return (
    <PlannerPanel
      plays={state?.plays ?? []}
      onPrioritize={(playId) =>
        setState((draft) => ({
          ...draft,
          plays: draft.plays.map((play) =>
            play.id === playId ? { ...play, status: "ready" } : play,
          ),
        }))
      }
    />
  );
}
```

#### `useCoAgentStateRender`

- **Purpose:** Render agent state transitions directly into the chat or headless timeline without manually wiring React state listeners.

```tsx
import { useCoAgentStateRender } from "@copilotkit/react-core";

export function InspectorStateToChat() {
  useCoAgentStateRender<InspectorState>({
    agentName: "inspector_agent",
    render: ({ coverage, nextAction }) => ({
      role: "assistant",
      content: `Coverage at ${coverage}% — next action: ${nextAction}`,
      metadata: { stage: "PREPARE" },
    }),
  });

  return null;
}
```

---

## 7. Stage Pairing Playbook

| Stage | Primary surfaces | Hook pairing | Notes |
| --- | --- | --- | --- |
| **Home** | Mission list, approvals queue | `useCopilotReadable`, `useCopilotAdditionalInstructions` | Feed summary counts + instruct the copilot to triage blocked missions first. |
| **Define** | Mission Intake Panel | `useCopilotReadable`, `useCopilotAction`, `useCopilotAdditionalInstructions`, `useCopilotChat` | Keep editable fields live via Readables, register chip updates as actions, inject tone guardrails (“stay in plain language”). |
| **Prepare** | Inspection Drawer | `useCopilotReadable`, `useCopilotAction`, `useCopilotChat`, `useCopilotChatSuggestions` | Stream no-auth findings as Readables, surface Connect Links as actions, offer “Explain scope” quick replies. |
| **Plan** | Planner rail | `useCopilotReadable`, `useCoAgent`, `useCoAgentStateRender`, `useCopilotChatHeadless` | Mirror PlannerAgent state, render ranking cards in headless chat pane, keep reads lightweight for streaming. |
| **Approve** | Approval timeline & modal | `useCopilotAction`, `useCopilotChat`, `useCopilotAdditionalInstructions`, `useCopilotChatSuggestions` | Actions capture approval decisions, Additional Instructions freeze verbiage (“no new scopes”), chat suggestions speed stakeholder replies. |
| **Execute** | Runboard & undo bar | `useCoAgent`, `useCopilotChat`, `useCopilotAction`, `useCoAgentStateRender` | Stream ExecutorAgent heartbeat, register pause/undo actions, render audit entries inline. |
| **Reflect** | Artifact gallery & feedback drawer | `useCopilotReadable`, `useCopilotAction`, `useCopilotChat`, `useCopilotChatHeadless` | Provide evidence metadata, allow follow-up actions (“Open in Supabase”), run headless recap for leadership. |

---

## 8. Progressive Trust Choreography

1. **Inspect (PREPARE):** Readables expose discovery output, Additional Instructions keep the copilot in observation mode, Actions gate Connect Link requests, CoAgent state holds anticipated scopes before approval.
2. **Connect (PLAN → APPROVE):** Readables store validated scopes and session IDs, Additional Instructions forbid new OAuth prompts unless Inspector flags missing coverage, chat suggestions surface “Confirm scopes” and “Escalate for approval”, CoAgent renderers announce approval receipts using Composio audit references.
3. **Execute:** CoAgent + StateRender stream execution heartbeat, Actions handle pause/undo and log telemetry (`composio_tool_call`), headless chat ticker keeps UI in sync with Supabase audit log.
4. **Reflect:** Readables share outcomes, Additional Instructions switch to reflection prompts, Actions let operators reopen missions or share evidence bundles.

---

## 9. Implementation Checklist

### Frontend (`src/app/(control-plane)`)
- Keep `CopilotRuntime` agent IDs stable (`control_plane_coordinator`) — backend uses them to route to the right ADK agent.
- Register CopilotKit Readables **before** streaming begins so AG-UI deltas patch real stores; ensure `available` flags flip to `"enabled"` when data is ready.
- When rendering Connect Links or undo timers triggered via `CUSTOM` events, always confirm receipt with `useCopilotAction` responses so the backend can advance the session.
- Mount `useCopilotChatHeadless` once per layout to avoid duplicated history streams; memoise consumers that filter messages by stage.

### Backend (`agent/`)
- Wrap every Gemini ADK agent inside `ag_ui_adk.ADKAgent` or `add_adk_fastapi_endpoint` to guarantee protocol compliance.
- Populate `metadata.stage`, `metadata.mission_id`, and `metadata.play_id` on emitted events — CopilotKit uses these for filtering.
- Persist AG-UI event logs to Supabase (`mission_events`) for replay. Use `EventTranslator.to_json(event)` for consistent shape.
- When Composio calls fail, emit `RUN_ERROR` **and** a `STATE_DELTA` declaring the stage paused; CopilotKit will surface a retry CTA.

### Agent Services
- Session IDs come from `ag_ui_adk.SessionManager`. Persist them if you swap `InMemorySessionService` for Supabase.
- Keep execution timeouts aligned (`execution_timeout_seconds` in ADKAgent vs chat undo countdown) to avoid race conditions.
- Ensure telemetry helpers emit `composio_discovery`, `composio_auth_flow`, and `composio_tool_call` with mission identifiers.

---

## 10. Observability & Telemetry

- Mirror the AG-UI event stream into Supabase via the telemetry service. Suggested table schema: `event_type`, `stage`, `mission_id`, `payload`, `timestamp`, `latency_ms`.
- Attach `timestamp` and `rawEvent` for every error — the AG-UI client already surfaces these, so store them for incident forensics.
- Emit `workspace_stream_open` when CopilotKit subscribes to the stream and `workspace_stream_closed` when the session ends; use it to detect orphaned runs.
- Correlate Composio tool calls by reusing `metadata.tool_execution_id` in both AG-UI events and Supabase `mission_tool_calls`.
- Keep Readable payloads under 10 KB; large objects should pass references (IDs) and let actions fetch details on demand.

---

## 11. Testing Strategy

| Layer | Test | Command |
| --- | --- | --- |
| Protocol translation | Unit-test `ag_ui_adk.EventTranslator` for every event type | `pytest agent/tests/test_agui_translator.py` *(planned)* |
| Hooks & UI contracts | Vitest components asserting hook wrappers mount/unmount per stage, chat suggestions appear when expected | `pnpm run test:ui` (add cases under mission workspace stories) |
| End-to-end streaming | Playwright mission flow observing chat + Runboard | `pnpm run test:ui` (extend to assert AG-UI events) |
| Contract checks | JSON schema validation of emitted events vs `@ag-ui/core` | `node scripts/verify-agui-contract.mjs` *(planned)* |
| Performance | Ensure SSE heartbeat ≤ 5s, binary mode < 50% payload overhead | `scripts/benchmark_agui_transport.sh` *(planned)* |
| Telemetry parity | Cross-check ADK eval stubs (`agent/evals/control_plane/*`) after hook schema changes | `mise run test-agent` once evals land |

---

## 12. Troubleshooting

- **Missing context in chat:** Ensure Readable `available` flag is set to `"enabled"`; disabled readables are ignored even if values change.
- **Prompt bloat:** Consolidate Additional Instructions by stage; remove redundant copies on nested components.
- **Action not callable:** Confirm `parameters` schema matches what Gemini ADK emits. For undo flows include `toolCallId` so ValidatorAgent can reconcile.
- **CoAgent state stale:** Verify agent `name` matches ADK registration and that `setState` mutations are immutable (clone arrays/objects).
- **Headless chat desync:** Mount `useCopilotChatHeadless` once per layout; multiple instances without memoisation can interleave history.
- **Telemetry gaps:** Fire `workspace_stream_open/closed` events and tie `tool_execution_id` across Composio + AG-UI to avoid orphaned traces.

---

## 13. Related Documents

- `docs/03a_chat_experience.md` — UX rules for chat rail that consumes AG-UI events
- `docs/03_user_experience.md` — Stage-by-stage UX guardrails and mission workspace layout
- `docs/04_implementation_guide.md` — Backend agent architecture using `ag_ui_adk`
- `libs_docs/copilotkit/llms-full.txt` — Upstream CopilotKit reference material
- `node_modules/@ag-ui/{client,core,proto}/README.md` — Upstream protocol references

---

**Document Owner:** Platform Experience Team  
**Next Review:** January 2026  
**Feedback:** Tag `@ai-agent-team` or file an entry in `docs/readiness/feedback/`
