"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { CopilotSidebar, type CopilotKitCSSProperties } from "@copilotkit/react-ui";
import { MissionIntake } from "@/components/MissionIntake";

type MissionState = {
  objective: string;
  audience: string;
  timeframe: string;
  guardrails: string;
  plannerNotes: string[];
};

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
  initialMission: MissionState;
  initialObjectiveId?: string | null;
  initialArtifacts: Artifact[];
  catalogSummary?: CatalogSummary;
};

type AcceptedIntakePayload = {
  missionId: string;
  objective: string;
  audience: string;
  guardrailSummary: string;
  kpis: Array<{ label: string; target?: string }>;
  confidence: number;
  source: 'gemini' | 'fallback';
};

const AGENT_ID = "control_plane_foundation";
const SESSION_RETENTION_MINUTES = 60 * 24 * 7; // 7 days

export function ControlPlaneWorkspace({
  tenantId,
  initialMission,
  initialObjectiveId,
  initialArtifacts,
  catalogSummary,
}: ControlPlaneWorkspaceProps) {
  const [themeColor, setThemeColor] = useState("#4f46e5");
  const [mission, setMission] = useState<MissionState>(initialMission);
  const [draft, setDraft] = useState<MissionState>(initialMission);
  const [artifacts, setArtifacts] = useState<Artifact[]>(initialArtifacts);
  const [objectiveId, setObjectiveId] = useState<string | undefined | null>(initialObjectiveId);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSidebarReady, setIsSidebarReady] = useState(false);

  const sessionIdentifierRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `mission-${Date.now()}`,
  );

  const copilotSnapshot = useMemo(
    () => ({
      mission,
      artifacts,
      guardrails: mission.guardrails,
    }),
    [mission, artifacts],
  );

  useCopilotReadable({
    description: "Mission brief, guardrails, and artifacts for Gate G-A dry-run workspace",
    value: copilotSnapshot,
  });

  const syncCopilotSession = useCallback(
    async (nextMission: MissionState, nextArtifacts: Artifact[], newObjectiveId?: string | null) => {
      try {
        await fetch("/api/copilotkit/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: AGENT_ID,
            sessionIdentifier: sessionIdentifierRef.current,
            tenantId,
            state: {
              mission: nextMission,
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

  const persistObjective = useCallback(
    async (nextMission: MissionState, overrideObjectiveId?: string | null) => {
      setIsSyncing(true);
      try {
        const response = await fetch("/api/objectives", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal: nextMission.objective,
            audience: nextMission.audience,
            timeframe: nextMission.timeframe,
            guardrails: { notes: nextMission.guardrails },
            metadata: { plannerNotes: nextMission.plannerNotes },
            tenantId,
            objectiveId: overrideObjectiveId ?? objectiveId ?? undefined,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Failed to create objective");
        }

        const payload = (await response.json()) as { objective: { id: string } };
        setObjectiveId(payload.objective?.id);
        await syncCopilotSession(nextMission, artifacts, payload.objective?.id ?? null);
      } catch (error) {
        console.error(error);
      } finally {
        setIsSyncing(false);
      }
    },
    [artifacts, objectiveId, syncCopilotSession, tenantId],
  );

  const handleMissionSync = useCallback(async () => {
    setMission(draft);
    await persistObjective(draft);
  }, [draft, persistObjective]);

  useEffect(() => {
    setIsSidebarReady(true);
    void syncCopilotSession(mission, artifacts, objectiveId ?? null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useCopilotAction({
    name: "setMissionDetails",
    description: "Update the mission objective, audience, timeframe, and guardrails.",
    parameters: [
      { name: "objective", type: "string", required: true },
      { name: "audience", type: "string", required: true },
      { name: "timeframe", type: "string", required: true },
      { name: "guardrails", type: "string", required: true },
    ],
    handler: async ({ objective, audience, timeframe, guardrails }) => {
      const updated: MissionState = {
        objective,
        audience,
        timeframe,
        guardrails,
        plannerNotes: mission.plannerNotes,
      };
      setDraft(updated);
      setMission(updated);
      await persistObjective(updated);
      return `Mission details updated for tenant ${tenantId}`;
    },
  });

  useCopilotAction({
    name: "appendPlannerNote",
    description: "Attach a short planner note to the workspace sidebar.",
    parameters: [{ name: "note", type: "string", required: true }],
    handler: async ({ note }) => {
      if (!note) {
        return "No note provided.";
      }
      const updated: MissionState = {
        ...mission,
        plannerNotes: [...new Set([...mission.plannerNotes, note.trim()])],
      };
      setMission(updated);
      setDraft(updated);
      await persistObjective(updated);
      return "Planner note recorded.";
    },
  });

  useCopilotAction({
    name: "registerArtifactPreview",
    description: "Publish or update an artifact card for the current mission.",
    parameters: [
      { name: "artifactId", type: "string", required: true },
      { name: "title", type: "string", required: true },
      { name: "summary", type: "string", required: true },
      { name: "status", type: "string", required: false },
    ],
    handler: async ({ artifactId, title, summary, status }) => {
      const candidateId = artifactId || (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `artifact-${Date.now()}`);

      try {
        const response = await fetch("/api/artifacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artifactId,
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

        const payload = (await response.json()) as { artifact: { id: string; title: string; content: { summary?: string } | null; status?: string | null } };
        const storedId = payload.artifact?.id ?? candidateId;
        const storedSummary = payload.artifact?.content && typeof payload.artifact.content === "object"
          ? (payload.artifact.content.summary ?? summary)
          : summary;

        const nextArtifacts = {
          ...artifacts.reduce<Record<string, Artifact>>((acc, artifact) => {
            acc[artifact.artifact_id] = artifact;
            return acc;
          }, {}),
          [storedId]: {
            artifact_id: storedId,
            title,
            summary: storedSummary,
            status: payload.artifact?.status ?? status ?? "draft",
          },
        };

        const artifactList = Object.values(nextArtifacts).sort((a, b) => a.title.localeCompare(b.title));
        setArtifacts(artifactList);
        await syncCopilotSession(mission, artifactList, objectiveId ?? null);
        return `Artifact ${storedId} registered.`;
      } catch (error) {
        console.error(error);
        return (error as Error).message;
      }
    },
  });

  useCopilotAction({
    name: "copilotkit_emit_message",
    description: "Persist a streaming CopilotKit message for the current session.",
    parameters: [
      { name: "role", type: "string", required: true },
      { name: "content", type: "string", required: true },
      { name: "metadata", type: "object", required: false },
    ],
    handler: async ({ role, content, metadata }) => {
      if (!content) {
        return "No content to persist.";
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
      await syncCopilotSession(mission, artifacts, objectiveId ?? null);
      return "Copilot session marked as completed.";
    },
  });

  const guardrailLines = mission.guardrails.split("\n").filter(Boolean);

  const handleIntakeAccept = useCallback(
    async (payload: AcceptedIntakePayload) => {
      const updated: MissionState = {
        objective: payload.objective,
        audience: payload.audience,
        timeframe: mission.timeframe,
        guardrails: payload.guardrailSummary,
        plannerNotes: mission.plannerNotes,
      };

      setMission(updated);
      setDraft(updated);
      setObjectiveId(payload.missionId);

      await persistObjective(updated, payload.missionId);
    },
    [mission.timeframe, mission.plannerNotes, persistObjective],
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

      {/* Mission Intake Component */}
      <MissionIntake tenantId={tenantId} objectiveId={objectiveId ?? null} onAccept={handleIntakeAccept} />

      <div className="flex grow flex-col lg:flex-row">
        <section className="flex w-full flex-col border-b border-white/10 px-6 py-8 lg:w-2/5 lg:border-r">
          <h2 className="text-lg font-semibold">Mission Brief</h2>
          <p className="mb-6 text-sm text-slate-300">
            Capture the objective, audience, timeframe, and guardrails to keep the dry-run proof aligned with governance policy.
          </p>

          <MissionField
            label="Objective"
            value={draft.objective}
            placeholder="Revive dormant accounts with a no-auth play"
            onChange={(value) => setDraft((prev) => ({ ...prev, objective: value }))}
          />
          <MissionField
            label="Audience"
            value={draft.audience}
            placeholder="Pilot revenue pod or cohort"
            onChange={(value) => setDraft((prev) => ({ ...prev, audience: value }))}
          />
          <MissionField
            label="Timeframe"
            value={draft.timeframe}
            placeholder="Next 2 weeks / by Oct 21"
            onChange={(value) => setDraft((prev) => ({ ...prev, timeframe: value }))}
          />
          <MissionField
            label="Guardrails"
            value={draft.guardrails}
            textarea
            placeholder="Respect quiet hours 22:00-06:00, tone = professional"
            onChange={(value) => setDraft((prev) => ({ ...prev, guardrails: value }))}
          />
          <button
            className="mt-4 inline-flex w-fit items-center gap-2 rounded-md bg-violet-500 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-violet-400"
            onClick={handleMissionSync}
            disabled={isSyncing}
          >
            {isSyncing ? "Syncing…" : "Sync with Agent"}
          </button>

          <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-base font-semibold">Guardrail Summary</h3>
            {guardrailLines.length ? (
              <ul className="mt-4 space-y-2 text-sm text-slate-200">
                {guardrailLines.map((line, index) => (
                  <li key={`${line}-${index}`} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-violet-400" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-400">Add guardrail bullet points to surface governance policies.</p>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-base font-semibold">Planner Notes</h3>
            {mission.plannerNotes.length ? (
              <ul className="mt-4 space-y-2 text-sm text-slate-200">
                {mission.plannerNotes.map((note, index) => (
                  <li key={`${note}-${index}`} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-400" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-400">No notes yet. Ask the agent to suggest discovery checkpoints.</p>
            )}
          </div>
        </section>

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
                  await syncCopilotSession(mission, nextArtifacts, objectiveId ?? null);
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
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/20 p-8 text-center text-sm text-slate-400">
                Ask the agent to generate a draft artifact to populate this area.
              </div>
            )}
          </div>
        </section>

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
    </main>
  );
}

type MissionFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  textarea?: boolean;
  onChange: (value: string) => void;
};

function MissionField({ label, value, placeholder, textarea, onChange }: MissionFieldProps) {
  const classes =
    "mt-1 w-full rounded-lg border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none";

  return (
    <label className="mb-4 block text-sm font-medium text-slate-200">
      <span>{label}</span>
      {textarea ? (
        <textarea
          rows={4}
          value={value}
          placeholder={placeholder}
          className={classes}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          className={classes}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
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
