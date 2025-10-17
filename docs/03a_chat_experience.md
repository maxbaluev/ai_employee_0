# AI Employee Control Plane: Chat Experience Guide

**Version:** 3.0 (October 2025)
**Audience:** Product Design, UX Engineering, Frontend, Agent Runtime
**Status:** Canonical reference for CopilotKit chat behaviour across the mission workspace

---

## 1. Purpose

The CopilotKit-powered chat rail is the **primary collaboration surface** for the mission workspace. It:

- Narrates stages 0–6 (Home → Define → Prepare → Plan → Approve → Execute → Reflect) in real time.
- Collects approvals, interrupts, and undo confirmations without modal fatigue.
- Mirrors Composio SDK telemetry so trust decisions stay transparent.
- Persists conversational context, letting agents resume work with zero loss of state.

This guide explains what users see, how the chat reacts to system events, and why it is central to the progressive trust model.

---

## 2. Layout & Presence

| Component             | Placement                                                  | Purpose                                                                     | Notes                                                       |
| --------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Mission Thread**    | Right rail on desktop (30% width), drawer on tablet/mobile | Streams stage narration, user replies, and agent updates                    | Collapsible; persists across route refreshes                |
| **System Banner**     | Top of mission thread                                      | Announces stage transitions, blockers, undo countdowns                      | Uses CopilotKit `useCopilotReadable` to stay accessible     |
| **Action Cards**      | Inline within thread                                       | Display approvals, Connect Links, evidence artifacts                        | Cards expose primary CTA + secondary “Review Evidence” link |
| **Quick Actions**     | Footer slot                                                | Offers context-aware suggestions (e.g., “Approve plan”, “Request revision”) | Derived from stage state + safeguard status                 |
| **Transcript Export** | Thread overflow menu                                       | Generates redacted mission transcript for audit                             | Links to generated artifact in Evidence Gallery             |

---

## 3. Stage Walkthrough

| Stage                  | Chat Narrative                                                                                                                                                    | Typical Messages                                                                                                                                                | Telemetry Hook                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **0. Home (Overview)** | Mission feed surfaces pending approvals, recent outcomes, and nudges to continue in-progress work.                                                                | "Approval needed for Mission X", "Riley resumed Plan stage", link chips to open mission workspace.                                                              | `mission_viewed`, `approval_opened`, `mission_resumed`                                           |
| **1. Define**          | Agent summarises brief chips, prompts for edits, confirms acceptance.                                                                                             | `Intent captured`, chip regeneration previews, "Lock brief?" CTA.                                                                                               | `intent_submitted`, `brief_generated`, `mission_brief_locked`                                    |
| **2. Prepare**         | Inspector posts coverage card, highlights missing toolkits, previews anticipated scopes, presents Connect Link approval modals upon stakeholder review.           | Discovery cards with readiness meter, scope preview callouts, Connect Link approval requests, granted scope confirmations, "Open toolkit details" quick action. | `toolkit_recommended`, `composio_discovery`, `safeguard_reviewed`, `composio_auth_flow`          |
| **3. Plan**            | Planner streams ranked plays (mission playbooks) based on tool usage patterns and data investigation insights; user selects a preferred strategy before approval. | Play cards with confidence badges, tool usage pattern highlights, safeguard recap, undo plans, scope alignment confirmations, "Request revision" buttons.       | `planner_candidate_generated`, `plan_ranked`, `plan_selected`                                    |
| **4. Approve**         | Stakeholder reviews selected play, confirms or rejects with rationale, and logs the decision in-chat.                                                             | Approval modal card, audit summary, "Approve" / "Request changes" buttons, delegation prompts.                                                                  | `approval_requested`, `approval_granted`, `approval_rejected`                                    |
| **5. Execute**         | Executor streams tool invocations line-by-line using established connections; validator injects alerts; evidence agent posts hashes.                              | Streaming log chip, validator alert threads, undo countdown message, artifact card with SHA badge.                                                              | `execution_started`, `composio_tool_call`, `validator_alert_raised`, `evidence_bundle_generated` |
| **6. Reflect**         | Evidence agent summarises outcomes, prompts for feedback, suggests library reuse.                                                                                 | "Mission complete" summary, feedback form card, library suggestion chips, follow-up checklist.                                                                  | `feedback_submitted`, `mission_retrospective_logged`, `library_contribution`                     |

### Interrupts

- **Scope Interruption:** When an executor attempts to call a toolkit without approved scopes, the chat posts an interrupt, pauses streaming, and reroutes to Inspector (Prepare stage) to request additional authorization.
- **Safeguard Breach:** Validator interruptions render as red warning cards with suggested fixes and quick replies (`Retry with fix`, `Escalate to human`).
- **Undo Confirmation:** Undo bar triggers a chat countdown; if timer expires the thread posts completion and links to rollback evidence.

---

## 4. Message Types & Copy Guidelines

| Message Type        | Examples                                                                                                           | Tone & Content Rules                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **Stage Banner**    | “Prepare stage ready – review recommended toolkits.”                                                               | Imperative, ≤120 characters, include stage icon.                       |
| **Narration**       | “Proposed Play #2 increases pipeline coverage by 18%. Awaiting approval.”                                          | Present tense, cite metric deltas, link to artifact when available.    |
| **Blocking Alert**  | “Validator blocked `salesforce.update_records`: Missing required safeguard `Budget cap`.”                          | Red badge, explicit cause, next step CTA.                              |
| **Evidence Card**   | “Artifact `CampaignPlan_v3.pdf` saved • SHA256 9ad3… • View in gallery.”                                           | Neutral tone, include hash, embed download.                            |
| **Prompt to Human** | “Need approval to request Slack scopes (`channels:read`, `chat:write`). Approve in 2 minutes to stay on schedule.” | Deadline focused, list scopes inline, provide Approve/Decline buttons. |

### Accessibility

- All streaming copy uses polite ARIA live regions to avoid overwhelming screen readers.
- Buttons on cards map to keyboard shortcuts (displayed as helper text).
- Stage banners expose semantic headings (`<h3>`) for quick navigation.

---

## 5. Telemetry & Storage

- Chat events map 1:1 with Supabase `telemetry_events` to keep the conversational log auditable.
- Each evidence card stores `mission_id`, `artifact_id`, `hash`, `source_stage`, and `display_message` in Supabase for replay.
- Transcript exports push a summary to `mission_artifacts` with type `chat_transcript`; retention defaults to 180 days.

| Event                   | Chat Trigger                                                  |
| ----------------------- | ------------------------------------------------------------- |
| `inspection_viewed`     | User opens inspector drawer via chat link.                    |
| `approval_granted`      | Stakeholder taps Approve CTA inside chat modal.               |
| `undo_triggered`        | User confirms rollback from chat countdown bubble.            |
| `workspace_stream_open` | Chat opens streaming session (used for heartbeat monitoring). |

---

## 6. Implementation Pointers

- Wrap mission layouts with `<CopilotKit runtimeUrl="/api/copilotkit">` so CopilotKit state flows across the entire workspace.
- In Define, pair `useCopilotReadable` with `useCopilotAction` and `useCopilotAdditionalInstructions` so intent edits stay live while tone guardrails remain enforced.
- In Prepare, reuse `useCopilotReadable`, `useCopilotAction`, `useCopilotChat`, and `useCopilotChatSuggestions` to surface discovery updates, launch Connect Links post-approval, and offer “Explain scope” quick replies.
- In Plan & Approve, combine `useCopilotAction`, `useCopilotChat`, `useCopilotChatHeadless`, `useCopilotChatSuggestions`, and `useCopilotAdditionalInstructions` to stream ranked plays, capture approvals, and summarize deltas without triggering additional OAuth.
- In Execute, mirror Composio checkpoints via `useCopilotChat`/`useCopilotChatHeadless`, stream ExecutorAgent state through `useCoAgent` + `useCoAgentStateRender`, and let undo controls route back through `useCopilotAction` handlers.
- In Reflect, publish evidence bundles through `useCopilotReadable` + `useCopilotChat`, surface leadership recaps with `useCopilotChatHeadless`, and allow reuse prompts via `useCopilotAction` tied to Supabase artifacts.
- For long-running executions, maintain heartbeats with incremental `copilotkit_emit_message` payloads every 20 seconds.
- Interrupt flows rely on `copilotkit_interrupt` – ensure each interrupt message acknowledges the prior action and states whether work is paused or cancelled.
- Reference `docs/04a_copilot_protocol.md` §§6–12 for stage-specific hook payload examples, troubleshooting tips, and telemetry expectations.

---

## 7. Testing Checklist

- **Unit:** Vitest stories cover message rendering, quick action state, and ARIA attributes.
- **Integration:** Playwright flows validate approval modals, undo flows, and reconnect behaviour after refresh.
- **Accessibility:** Run `pnpm run test:a11y` plus manual VoiceOver/NVDA sweeps on chat cards.
- **Telemetry:** Execute `scripts/audit_telemetry_events.ts` to confirm mission-stage + chat events remain in sync.

---

## 8. Roadmap Considerations

- **Threaded Replies:** Explore lightweight threading for multi-team collaboration while keeping mission timeline linear.
- **Adaptive Summaries:** Introduce stage recap TL;DR messages after long execution runs.
- **Multi-Mission View:** Investigate merged chat timeline when operators oversee multiple active missions simultaneously.

---

### Related Documents

- `docs/03_user_experience.md` — Workspace blueprint with chat annotations.
- `docs/02_system_overview.md` — Architecture overview including chat message flow.
- `docs/04a_copilot_protocol.md` — AG-UI transport contract, hook integration patterns, and streaming guidance.
- `docs/10_composio.md` — Progressive trust alignment with chat touchpoints.
