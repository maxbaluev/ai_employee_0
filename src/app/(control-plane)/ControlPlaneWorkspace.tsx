"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { CopilotSidebar, type CopilotKitCSSProperties } from "@copilotkit/react-ui";

import { ApprovalModal } from "@/components/ApprovalModal";
import { MissionIntake } from "@/components/MissionIntake";
import { RecommendedToolkits } from "@/components/RecommendedToolkits";
import { StreamingStatusPanel } from "@/components/StreamingStatusPanel";
import type { TimelineMessage } from "@/hooks/useTimelineEvents";
import { useApprovalFlow } from "@/hooks/useApprovalFlow";
import type { ApprovalSubmission } from "@/hooks/useApprovalFlow";
import { useUndoFlow } from "@/hooks/useUndoFlow";

type Artifact = {
  artifact_id: string;
  title: string;
  summary: string;
  status: string;
};

type CatalogSummary = {
  total_entries: number;
  toolkits: number;
  categories: string[];
};

type ControlPlaneWorkspaceProps = {
  tenantId: string;
  initialObjectiveId?: string | null;
  initialArtifacts: Artifact[];
  catalogSummary?: CatalogSummary;
};

type AcceptedIntakePayload = {
  missionId: string;
  objective?: string;
  audience?: string;
  guardrailSummary?: string;
  kpis?: Array<{ label: string; target?: string }>;
  confidence?: number;
  source?: "gemini" | "fallback";
};

const AGENT_ID = "control_plane_foundation";
const SESSION_RETENTION_MINUTES = 60 * 24 * 7; // 7 days

export function ControlPlaneWorkspace({
  tenantId,
  initialObjectiveId,
  initialArtifacts,
  catalogSummary,
}: ControlPlaneWorkspaceProps) {
  const [themeColor, setThemeColor] = useState("#4f46e5");
  const [artifacts, setArtifacts] = useState<Artifact[]>(initialArtifacts);
  const [objectiveId, setObjectiveId] = useState<string | undefined | null>(initialObjectiveId);
  const [isSidebarReady, setIsSidebarReady] = useState(false);
  const [workspaceAlert, setWorkspaceAlert] = useState<
    { tone: "success" | "error" | "info"; message: string } | null
  >(null);

  const sessionIdentifierRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `mission-${Date.now()}`,
  );
  const sessionIdentifier = sessionIdentifierRef.current;

  const readableState = useMemo(
    () => ({
      artifacts,
      objectiveId: objectiveId ?? null,
    }),
    [artifacts, objectiveId],
  );

  useCopilotReadable({
    description: "Evidence artifacts tracked in the Gate G-A dry-run workspace",
    value: readableState,
  });

  const approvalFlow = useApprovalFlow({
    tenantId,
    missionId: objectiveId ?? null,
    onSuccess: ({ decision }) => {
      const label = decision.replace(/_/g, " ");
      setWorkspaceAlert({
        tone: "success",
        message: `Reviewer decision recorded (${label}).`,
      });
    },
  });

  const undoFlow = useUndoFlow({
    tenantId,
    missionId: objectiveId ?? null,
    onCompleted: (status) => {
      setWorkspaceAlert({
        tone: "success",
        message:
          status === "completed"
            ? "Undo executed for the selected artifact."
            : "Undo request queued for evidence service.",
      });
    },
  });

  const syncCopilotSession = useCallback(
    async (nextArtifacts: Artifact[], newObjectiveId?: string | null) => {
      try {
        await fetch("/api/copilotkit/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: AGENT_ID,
            sessionIdentifier: sessionIdentifierRef.current,
            tenantId,
            state: {
              artifacts: nextArtifacts,
              objectiveId: newObjectiveId ?? objectiveId ?? null,
            },
            retentionMinutes: SESSION_RETENTION_MINUTES,
          }),
        });
      } catch (error) {
        console.error("Failed to sync Copilot session", error);
      }
    },
    [objectiveId, tenantId],
  );

  const persistCopilotMessage = useCallback(
    async ({
      role,
      content,
      metadata,
    }: {
      role: string;
      content: string;
      metadata?: Record<string, unknown>;
    }) => {
      try {
        await fetch("/api/copilotkit/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: AGENT_ID,
            tenantId,
            sessionIdentifier: sessionIdentifierRef.current,
            role,
            content,
            metadata,
          }),
        });
      } catch (error) {
        console.error("Failed to persist Copilot message", error);
      }
    },
    [tenantId],
  );

  useCopilotAction({
    name: "copilotkit_emit_message",
    description: "Persist a message from the Copilot runloop",
    parameters: [
      { name: "role", type: "string", required: true },
      { name: "content", type: "string", required: true },
      { name: "metadata", type: "object", required: false },
    ],
    handler: async ({ role, content, metadata }) => {
      if (!role || !content) {
        return "Missing role or content";
      }
      await persistCopilotMessage({
        role: typeof role === "string" ? role : "assistant",
        content: String(content),
        metadata: (metadata as Record<string, unknown> | undefined) ?? {},
      });
      return "Copilot message stored.";
    },
  });

  useCopilotAction({
    name: "copilotkit_exit",
    description: "Persist a completion event for the active CopilotKit session.",
    parameters: [{ name: "reason", type: "string", required: false }],
    handler: async ({ reason }) => {
      await persistCopilotMessage({
        role: "system",
        content: `Session exited: ${reason ?? "completed"}`,
        metadata: { reason: reason ?? "completed" },
      });
      await syncCopilotSession(artifacts, objectiveId ?? null);
      return "Copilot session marked as completed.";
    },
  });

  useCopilotAction({
    name: "copilotkit_clear_session",
    description: "Clear all persisted CopilotKit messages for this session.",
    parameters: [],
    handler: async () => {
      try {
        await fetch("/api/copilotkit/message", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: AGENT_ID,
            tenantId,
            sessionIdentifier: sessionIdentifierRef.current,
          }),
        });
      } catch (error) {
        console.error("Failed to clear Copilot messages", error);
      }
      await syncCopilotSession([], objectiveId ?? null);
      return "Copilot session cleared.";
    },
  });

  useCopilotAction({
    name: "registerArtifactPreview",
    description: "Publish or update an artifact card for the current mission.",
    parameters: [
      { name: "artifactId", type: "string", required: false },
      { name: "title", type: "string", required: true },
      { name: "summary", type: "string", required: true },
      { name: "status", type: "string", required: false },
    ],
    handler: async ({ artifactId, title, summary, status }) => {
      if (!title || !summary) {
        return "Title and summary are required.";
      }

      const candidateId =
        typeof artifactId === "string" && artifactId.trim()
          ? artifactId
          : typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `artifact-${Date.now()}`;

      try {
        const response = await fetch("/api/artifacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artifactId: candidateId,
            title,
            summary,
            status,
            tenantId,
            playId: objectiveId ?? undefined,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Artifact persistence failed");
        }

        const payload = (await response.json()) as {
          artifact?: {
            id?: string | null;
            title?: string | null;
            content?: { summary?: string } | null;
            status?: string | null;
          } | null;
        };

        const storedId = payload.artifact?.id ?? candidateId;
        const storedSummary =
          payload.artifact?.content && typeof payload.artifact.content === "object"
            ? payload.artifact.content.summary ?? summary
            : summary;

        const nextArtifact: Artifact = {
          artifact_id: storedId,
          title: payload.artifact?.title ?? title,
          summary: storedSummary,
          status: payload.artifact?.status ?? (typeof status === "string" ? status : "draft"),
        };

        const merged = [
          nextArtifact,
          ...artifacts.filter((artifact) => artifact.artifact_id !== storedId),
        ].sort((a, b) => a.title.localeCompare(b.title));

        setArtifacts(merged);
        await syncCopilotSession(merged, objectiveId ?? null);

        return `Artifact ${storedId} registered.`;
      } catch (error) {
        console.error(error);
        return error instanceof Error ? error.message : "Failed to register artifact.";
      }
    },
  });

  useEffect(() => {
    setIsSidebarReady(true);
  }, []);

  useEffect(() => {
    if (!workspaceAlert) {
      return undefined;
    }
    const timer = setTimeout(() => setWorkspaceAlert(null), 6000);
    return () => clearTimeout(timer);
  }, [workspaceAlert]);

  useEffect(() => {
    if (!undoFlow.error) {
      return;
    }
    setWorkspaceAlert({
      tone: "error",
      message: undoFlow.error,
    });
  }, [undoFlow.error]);

  const handleReviewerRequested = useCallback(
    (message: TimelineMessage) => {
      const resolvedToolCall =
        (message.metadata?.tool_call_id as string | undefined) ??
        (message.metadata?.toolCallId as string | undefined) ??
        null;

      if (!resolvedToolCall) {
        setWorkspaceAlert({
          tone: "error",
          message:
            "Validator requested a reviewer decision but the tool call identifier was not provided.",
        });
        return;
      }

      approvalFlow.openApproval({
        toolCallId: resolvedToolCall,
        missionId: objectiveId ?? null,
        stage: message.stage ?? null,
        attempt:
          typeof message.metadata?.attempt === "number"
            ? (message.metadata.attempt as number)
            : null,
        metadata: message.metadata,
      });
    },
    [approvalFlow, objectiveId],
  );

  const submitApproval = useCallback(
    (submission: ApprovalSubmission) => approvalFlow.submitApproval(submission),
    [approvalFlow],
  );

  useEffect(() => {
    void syncCopilotSession(artifacts, objectiveId ?? null);
  }, [artifacts, objectiveId, syncCopilotSession]);

  const handleIntakeAccept = useCallback(
    async ({ missionId }: AcceptedIntakePayload) => {
      setObjectiveId(missionId);
      await syncCopilotSession(artifacts, missionId);
    },
    [artifacts, syncCopilotSession],
  );

  return (
    <main
      style={{ "--copilot-kit-primary-color": themeColor } as CopilotKitCSSProperties}
      className="flex min-h-screen flex-col bg-slate-950 text-slate-50"
    >
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-8 py-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-violet-300">Gate G-A · Foundation ready</p>
            <h1 className="mt-1 text-2xl font-semibold">AI Employee Control Plane</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <span className="hidden sm:inline">Theme</span>
            <input
              aria-label="Workspace accent colour"
              type="color"
              value={themeColor}
              className="h-8 w-10 cursor-pointer rounded border border-white/30 bg-transparent"
              onChange={(event) => setThemeColor(event.target.value)}
            />
          </div>
        </div>
      </header>

      {workspaceAlert && (
        <div className="mx-auto mt-4 w-full max-w-6xl px-6">
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              workspaceAlert.tone === "success"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : workspaceAlert.tone === "error"
                  ? "border-red-500/40 bg-red-500/10 text-red-200"
                  : "border-slate-400/30 bg-slate-500/10 text-slate-200"
            }`}
          >
            {workspaceAlert.message}
          </div>
        </div>
      )}

      <MissionIntake tenantId={tenantId} objectiveId={objectiveId ?? null} onAccept={handleIntakeAccept} />

      <RecommendedToolkits
        tenantId={tenantId}
        missionId={objectiveId ?? null}
        onAlert={setWorkspaceAlert}
      />

      <div className="flex grow flex-col lg:flex-row">
        <section className="flex w-full flex-col gap-6 border-b border-white/10 px-6 py-8 lg:w-2/5 lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Evidence Gallery</h2>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-200 transition hover:bg-white/15"
              onClick={() => {
                const id = `artifact-${Date.now()}`;
                const placeholder: Artifact = {
                  artifact_id: id,
                  title: "Approval summary placeholder",
                  summary: "Use the agent to replace this with a real dry-run asset.",
                  status: "draft",
                };
                const nextArtifacts = [...artifacts, placeholder];
                setArtifacts(nextArtifacts);
                void (async () => {
                  try {
                    await fetch("/api/artifacts", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        artifactId: id,
                        title: placeholder.title,
                        summary: placeholder.summary,
                        status: placeholder.status,
                        tenantId,
                        playId: objectiveId ?? undefined,
                      }),
                    });
                  } catch (error) {
                    console.error("Failed to persist placeholder artifact", error);
                  }
                  await syncCopilotSession(nextArtifacts, objectiveId ?? null);
                })();
              }}
            >
              Add Placeholder
            </button>
          </div>
          <p className="text-sm text-slate-300">
            Artifacts track dry-run proof packs before granting credentials.
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            {artifacts.length ? (
              artifacts.map((artifact) => (
                <article
                  key={artifact.artifact_id}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-900/80 p-5 shadow"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white">{artifact.title}</h3>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-violet-200">
                      {artifact.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{artifact.summary}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void undoFlow.requestUndo({
                          toolCallId: artifact.artifact_id,
                          reason: "User requested dry-run rollback",
                        })
                      }
                      disabled={undoFlow.isRequesting}
                      className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition enabled:hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {undoFlow.isRequesting ? "Undoing…" : "Undo draft"}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/20 p-8 text-center text-sm text-slate-400">
                Ask the agent to generate a draft artifact to populate this area.
              </div>
            )}
          </div>
        </section>

        <StreamingStatusPanel
          tenantId={tenantId}
          agentId={AGENT_ID}
          sessionIdentifier={sessionIdentifier}
          pollIntervalMs={5000}
          onReviewerRequested={handleReviewerRequested}
        />

        <section className="flex w-full flex-col bg-slate-950/70 lg:w-1/5">
          {isSidebarReady ? (
            <CopilotSidebar
              defaultOpen
              clickOutsideToClose={false}
              labels={{
                title: "Mission Copilot",
                initial:
                  "Use the control plane copilot to propose plays, summarise guardrails, and capture dry-run artifacts before requesting OAuth access.",
              }}
            />
          ) : (
            <SidebarSkeleton />
          )}

          <div className="mt-auto border-t border-white/10 bg-slate-950/80 p-5 text-xs text-slate-300">
            <h3 className="mb-2 text-sm font-semibold text-white">Catalog Snapshot</h3>
            {catalogSummary ? (
              <ul className="space-y-1">
                <li>Total entries: {catalogSummary.total_entries}</li>
                <li>Toolkits indexed: {catalogSummary.toolkits}</li>
                <li className="truncate">Categories: {catalogSummary.categories.join(", ")}</li>
              </ul>
            ) : (
              <p>Catalog metadata will load after the agent fetches the Composio cache.</p>
            )}
          </div>
        </section>
      </div>

      <ApprovalModal
        isOpen={approvalFlow.isOpen}
        isSubmitting={approvalFlow.isSubmitting}
        error={approvalFlow.error}
        onClose={approvalFlow.closeApproval}
        onSubmit={submitApproval}
        request={approvalFlow.currentRequest}
        latestDecision={approvalFlow.latestDecision}
      />
    </main>
  );
}

function SidebarSkeleton() {
  return (
    <div className="flex h-full flex-col justify-between gap-4 border-b border-white/10 bg-slate-950/70 p-5">
      <div className="space-y-4">
        <div className="h-3 w-24 rounded-full bg-white/10" />
        <div className="space-y-2 text-xs text-slate-500">
          <div className="h-2 w-full rounded bg-white/10" />
          <div className="h-2 w-3/4 rounded bg-white/10" />
          <div className="h-2 w-2/3 rounded bg-white/10" />
        </div>
        <div className="h-32 rounded-xl border border-dashed border-white/10 bg-slate-900/60" />
      </div>
      <div className="space-y-2 text-[10px] uppercase tracking-wide text-slate-500">
        <div className="h-2 w-1/2 rounded bg-white/10" />
        <div className="h-2 w-2/3 rounded bg-white/10" />
      </div>
    </div>
  );
}
