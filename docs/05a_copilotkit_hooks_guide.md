# CopilotKit Hooks Integration Guide

**Version:** 1.0 (October 16, 2025)
**Audience:** Frontend engineers, mission designers, Gemini ADK integrators
**Purpose:** Document how the Control Plane applies CopilotKit's React hooks to deliver mission-aware copilots that respect our progressive trust contract.

---

## Why this guide exists

- **Single source of truth:** Consolidates how `src/app/(control-plane)` wires CopilotKit into each mission stage.
- **Progressive trust alignment:** Reinforces the Inspect → Connect → Execute pattern we share with Composio and Gemini ADK.
- **Faster onboarding:** Gives new contributors a checklist for choosing between context hooks, action hooks, chat affordances, and CoAgent helpers.
- **Avoid duplicated experiments:** Captures learnings from `libs_docs/copilotkit/llms-full.txt` and internal prototypes so teams reuse the winning patterns.

---

## Quick reference

| Hook                               | What it exposes                                         | Control Plane usage                                                       |
| ---------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `useCopilotReadable`               | Declarative read-only context objects                   | Mission brief, readiness signals, artifact metadata                       |
| `useCopilotAdditionalInstructions` | Prompt augmentation & guardrails                        | Stage-specific tone, compliance reminders, fallback persona rules         |
| `useCopilotAction`                 | Executable functions & optional generative UI renderers | Intent chip edits, Connect Link launchers, undo flows                     |
| `useCopilotChat`                   | Programmatic chat APIs (append, replace, reset)         | Streaming rationale, ADK event mirroring, mission timeline banners        |
| `useCopilotChatHeadless`           | Headless chat driver for custom UI                      | Side panel recaps, runway cards in `MissionWorkspaceLayout`               |
| `useCopilotChatSuggestions`        | Inline suggestion provider                              | Stage-specific quick replies (“Request scopes”, “Summarize undo plan”)    |
| `useCoAgent`                       | Bidirectional ADK state hook                            | Coordinator session state, Inspector readiness, Planner scorecards        |
| `useCoAgentStateRender`            | Reactive renderer for CoAgent state                     | Chat cards for inspection progress, planner rankings, execution heartbeat |

---

## Stage pairing playbook

| Stage       | Primary surfaces                   | Hook pairing                                                                                          | Notes                                                                                                                                      |
| ----------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Home**    | Mission list, approvals queue      | `useCopilotReadable`, `useCopilotAdditionalInstructions`                                              | Feed summary counts + instruct the copilot to triage blocked missions first.                                                               |
| **Define**  | Mission Intake Panel               | `useCopilotReadable`, `useCopilotAction`, `useCopilotAdditionalInstructions`, `useCopilotChat`        | Keep editable fields live via Readables, register chip updates as actions, inject tone guardrails (“stay in plain language”).              |
| **Prepare** | Inspection Drawer                  | `useCopilotReadable`, `useCopilotAction`, `useCopilotChat`, `useCopilotChatSuggestions`               | Stream no-auth findings as Readables, surface Connect Links as actions, offer “Explain scope” quick replies.                               |
| **Plan**    | Planner rail                       | `useCopilotReadable`, `useCoAgent`, `useCoAgentStateRender`, `useCopilotChatHeadless`                 | Mirror PlannerAgent state, render ranking cards in headless chat pane, keep reads lightweight for streaming.                               |
| **Approve** | Approval timeline & modal          | `useCopilotAction`, `useCopilotChat`, `useCopilotAdditionalInstructions`, `useCopilotChatSuggestions` | Actions capture approval decisions, Additional Instructions freeze verbiage (“no new scopes”), chat suggestions speed stakeholder replies. |
| **Execute** | Runboard & undo bar                | `useCoAgent`, `useCopilotChat`, `useCopilotAction`, `useCoAgentStateRender`                           | Stream ExecutorAgent heartbeat, register pause/undo actions, render audit entries inline.                                                  |
| **Reflect** | Artifact gallery & feedback drawer | `useCopilotReadable`, `useCopilotAction`, `useCopilotChat`, `useCopilotChatHeadless`                  | Provide evidence metadata, allow follow-up actions (“Open in Supabase”), run headless recap for leadership.                                |

---

## Choosing between `useCopilotReadable` and `useCopilotAdditionalInstructions`

| Scenario              | Prefer Readable when…                                                      | Prefer Additional Instructions when…                                                                             |
| --------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Mission data**      | You need the LLM to cite structured fields (brief, coverage %, audit IDs). | You must enforce behavior regardless of current readable data (e.g., “Never propose scopes outside CRM tenant”). |
| **Real-time updates** | Data changes frequently during a stage and should stream to the model.     | Behavioral cues vary by stage (“During Approve, only summarize risk deltas”).                                    |
| **Compliance**        | Exposing sanitized values is enough (no extra wording).                    | Legal/compliance copy must appear verbatim in system prompt (e.g., regulator disclaimers).                       |
| **Performance**       | Values can be serialized cheaply (small JSON).                             | Instructions are short strings; overuse leads to prompt bloat, so keep terse.                                    |

**Best practice:** use both hooks together—Readable carries the facts, Additional Instructions nudge tone & guardrails. Keep instruction payloads under 600 chars to protect latency.

---

## Hook details

### `useCopilotReadable`

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

### `useCopilotAdditionalInstructions`

- **Purpose:** Append stage-aware behavioral guardrails to the Copilot system prompt.
- **When to use:**
  - Stage transitions (“In PREPARE, never promise execution before approval”).
  - Persona nudges (RevOps tone vs Governance tone).
  - Safety disclaimers (PII redaction reminder).
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

### `useCopilotAction`

- **Purpose:** Register executable affordances the copilot can trigger.
- **Patterns we rely on:**
  - **Command handlers:** Launch Connect Links, lock briefs, schedule retries.
  - **Generative UI:** Render inline callouts (e.g., preview OAuth scopes before execution).
  - **Undo plans:** Pair with Composio audit events for rollback instructions.
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

### `useCopilotChat` & `useCopilotChatHeadless`

- **`useCopilotChat`:** Use when we embed CopilotKit's provided UI (`CopilotSidebar`, `CopilotPopup`). Grants `appendMessage`, `replaceMessage`, `clearMessages`, and loading state.
- **`useCopilotChatHeadless`:** Use inside our bespoke mission panels to consume the same chat session without rendering the default UI. Perfect for timeline banners and hybrid layouts.
- **Control Plane usage:**
  - Append planner rationale as Assistant messages.
  - Echo ADK events (Inspector findings, Executor heartbeats).
  - Headless mode drives the Runboard ticker while keeping chat history synced with the sidebar.
- **Implementation sketch:**

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

### `useCopilotChatSuggestions`

- **Purpose:** Generate contextual quick replies for operators.
- **Pattern:** Provide an array of suggestions keyed to mission stage and readiness state. Support dynamic availability so we avoid stale prompts.
- **Implementation sketch:**

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

### `useCoAgent`

- **Purpose:** Mirror ADK agent state into the UI and push updates back into the runloop.
- **Control Plane usage:**
  - Coordinator session state (mission id, tenant, user).
  - Inspector progress (toolkit coverage, outstanding scopes).
  - Planner rankings and confidence scores.
  - Executor heartbeat and failure state.
- **Implementation sketch:**

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

### `useCoAgentStateRender`

- **Purpose:** Render agent state transitions directly into the chat or headless timeline without manually wiring React state listeners.
- **Control Plane usage:**
  - Inspector checklist cards when coverage hits milestones.
  - Planner scoring cards with undo plan references.
  - Executor failure alerts tied to Composio audit IDs.
- **Implementation sketch:**

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

## Progressive trust choreography

1. **Inspect (PREPARE):**
   - Readables expose discovery output.
   - Additional Instructions keep the copilot in “observation only” mode.
   - Actions gated to Connect Link requests.
   - CoAgent state holds anticipated scopes before approval.
2. **Connect (PLAN → APPROVE):**
   - Readables store validated scopes + session IDs.
   - Additional Instructions forbid new OAuth prompts unless Inspector flags missing coverage.
   - Chat suggestions surface “Confirm scopes” and “Escalate for approval”.
   - CoAgent renderers announce approval receipts using Composio audit references.
3. **Execute:**
   - CoAgent + StateRender stream execution heartbeat.
   - Actions handle pause/undo and log telemetry (`composio_tool_call`).
   - Chat headless ticker keeps UI in sync with Supabase audit log.
4. **Reflect:**
   - Readables share outcomes, Additional Instructions switch to reflection prompts.
   - Actions let operators reopen missions or share evidence bundles.

---

## Testing & telemetry checklist

- **UI tests:** Add Vitest coverage to assert hook wrappers mount/unmount per stage and suggestions appear when expected.
- **ADK eval parity:** When updating CoAgent schemas, mirror changes in `agent/evals/control_plane/*` to avoid stale state renders.
- **Telemetry:** Hook handlers must emit `composio_discovery`, `composio_auth_flow`, and `composio_tool_call` with mission identifiers. Use shared helpers in `src/lib/telemetry`.
- **Performance:** Keep Readable payloads < 10 KB; large objects should pass references (IDs) and let actions fetch details on demand.

---

## Troubleshooting

- **Missing context in chat:** Ensure Readable `available` flag is set to `"enabled"`; disabled readables are ignored even if values change.
- **Prompt bloat:** Consolidate Additional Instructions by stage; remove redundant copies on nested components.
- **Action not callable:** Confirm `parameters` schema matches what Gemini ADK emits. For undo flows include `toolCallId` so ValidatorAgent can reconcile.
- **CoAgent state stale:** Verify agent `name` matches ADK registration and that `setState` mutations are immutable (clone arrays/objects).
- **Headless chat desync:** Mount `useCopilotChatHeadless` once per layout; multiple instances without memoization can interleave history.

---

## Related reading

- `docs/03_user_experience.md` — Stage-by-stage UX guardrails.
- `docs/03a_chat_experience.md` — Mission chat choreography.
- `docs/04_implementation_guide.md` — Architectural context and testing workflows.
- `libs_docs/copilotkit/llms-full.txt` — Upstream CopilotKit reference material.
