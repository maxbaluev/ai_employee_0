"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCoAgent, useCopilotAction } from "@copilotkit/react-core";
import { CopilotKitCSSProperties, CopilotSidebar } from "@copilotkit/react-ui";

type MissionState = {
  objective: string;
  audience: string;
  timeframe: string;
  guardrails: string;
  planner_notes: string[];
};

type Artifact = {
  artifact_id: string;
  title: string;
  summary: string;
  status: string;
};

type ComposioSummary = {
  total_entries: number;
  categories: string[];
  toolkits: number;
};

type AgentState = {
  mission_state: MissionState;
  mission_artifacts: Record<string, Artifact>;
  composio_catalog?: {
    summary?: ComposioSummary;
  };
};

const INITIAL_STATE: AgentState = {
  mission_state: {
    objective: "Prove value in dry-run mode",
    audience: "Pilot revenue team",
    timeframe: "Next 14 days",
    guardrails: "Follow quiet hours, tone policy, undo-first mindset",
    planner_notes: ["Gate G-A baseline initialised"],
  },
  mission_artifacts: {
    "dry-run-outline": {
      artifact_id: "dry-run-outline",
      title: "Dry-run Planning Outline",
      summary: "Sequenced steps for zero-privilege proof pack generation.",
      status: "draft",
    },
  },
};

export default function ControlPlanePage() {
  const [themeColor, setThemeColor] = useState("#0f172a");
  const { state, setState } = useCoAgent<AgentState>({
    name: "my_agent",
    initialState: INITIAL_STATE,
  });

  const agentState = state ?? INITIAL_STATE;
  const mission = agentState.mission_state;
  const [draft, setDraft] = useState<MissionState>(mission);

  useEffect(() => {
    setDraft(mission);
  }, [mission.objective, mission.audience, mission.timeframe, mission.guardrails, mission.planner_notes.join(",")]);

  const persistMission = useCallback(() => {
    setState({
      ...agentState,
      mission_state: {
        ...mission,
        ...draft,
      },
    });
  }, [agentState, draft, mission, setState]);

  useCopilotAction({
    name: "setThemeColor",
    description: "Change the core accent colour of the mission workspace.",
    parameters: [
      {
        name: "themeColor",
        type: "string",
        description: "Hex colour to apply to the workspace",
        required: true,
      },
    ],
    handler({ themeColor }) {
      setThemeColor(themeColor);
    },
  });

  useCopilotAction({
    name: "updateMissionDraft",
    description: "Update the mission brief fields from agent reasoning.",
    parameters: [
      { name: "objective", type: "string", required: true },
      { name: "audience", type: "string", required: true },
      { name: "timeframe", type: "string", required: true },
      { name: "guardrails", type: "string", required: true },
    ],
    handler({ objective, audience, timeframe, guardrails }) {
      setState({
        ...agentState,
        mission_state: {
          ...mission,
          objective,
          audience,
          timeframe,
          guardrails,
          planner_notes: mission.planner_notes,
        },
      });
    },
  });

  useCopilotAction({
    name: "registerArtifactPreview",
    description: "Publish an artifact preview to the evidence gallery.",
    parameters: [
      { name: "artifactId", type: "string", required: true },
      { name: "title", type: "string", required: true },
      { name: "summary", type: "string", required: true },
      { name: "status", type: "string", required: false },
    ],
    handler({ artifactId, title, summary, status }) {
      setState({
        ...agentState,
        mission_artifacts: {
          ...agentState.mission_artifacts,
          [artifactId]: {
            artifact_id: artifactId,
            title,
            summary,
            status: status ?? "draft",
          },
        },
      });
    },
  });

  const artifacts = useMemo(
    () => Object.values(agentState.mission_artifacts).sort((a, b) => a.title.localeCompare(b.title)),
    [agentState.mission_artifacts],
  );

  const composioSummary = agentState.composio_catalog?.summary;

  return (
    <main
      style={{ "--copilot-kit-primary-color": themeColor } as CopilotKitCSSProperties}
      className="flex h-screen flex-col bg-slate-950 text-slate-50"
    >
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-8 py-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-violet-300">Gate G-A · Foundation Ready</p>
            <h1 className="text-2xl font-semibold">AI Employee Control Plane</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <span className="hidden sm:inline">Theme</span>
            <input
              aria-label="Workspace accent colour"
              type="color"
              value={themeColor}
              className="h-8 w-10 cursor-pointer rounded border border-white/20 bg-transparent"
              onChange={(event) => setThemeColor(event.target.value)}
            />
          </div>
        </div>
      </header>

      <div className="relative flex grow overflow-hidden">
        <section className="flex grow flex-col overflow-y-auto border-r border-white/10 px-8 py-8">
          <h2 className="text-lg font-semibold">Mission Brief</h2>
          <p className="mb-6 text-sm text-slate-300">
            Capture the objective, audience, timeframe, and guardrails to keep the dry-run proof aligned with governance policy.
          </p>
          <MissionField
            label="Objective"
            value={draft.objective}
            placeholder="Revive dormant accounts with no-auth play"
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
            placeholder="Respect quiet hours 22:00-06:00, tone = professional"
            onChange={(value) => setDraft((prev) => ({ ...prev, guardrails: value }))}
            textarea
          />
          <button
            className="mt-6 inline-flex w-fit items-center gap-2 rounded-md bg-violet-500 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-violet-400"
            onClick={persistMission}
          >
            Sync with Agent
          </button>

          <div className="mt-10 rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-base font-semibold">Planner Notes</h3>
            {mission.planner_notes?.length ? (
              <ul className="mt-4 space-y-2 text-sm text-slate-200">
                {mission.planner_notes.map((note, index) => (
                  <li key={`${note}-${index}`} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-violet-400" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-400">No notes yet. Ask the agent to suggest discovery checkpoints.</p>
            )}
          </div>
        </section>

        <section className="flex grow flex-col overflow-y-auto border-r border-white/10 px-8 py-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Evidence Gallery</h2>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-200 transition hover:bg-white/15"
              onClick={() =>
                setState({
                  ...agentState,
                  mission_artifacts: {
                    ...agentState.mission_artifacts,
                    [`artifact-${Date.now()}`]: {
                      artifact_id: `artifact-${Date.now()}`,
                      title: "Approval summary placeholder",
                      summary: "Use the agent to replace this with a real dry-run asset.",
                      status: "draft",
                    },
                  },
                })
              }
            >
              Add Placeholder
            </button>
          </div>
          <p className="mb-6 text-sm text-slate-300">Artifacts track dry-run proof packs before granting credentials.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {artifacts.map((artifact) => (
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
            ))}
            {!artifacts.length && (
              <div className="rounded-xl border border-dashed border-white/20 p-8 text-center text-sm text-slate-400">
                Ask the agent to generate a draft artifact to populate this area.
              </div>
            )}
          </div>
        </section>

        <section className="relative flex w-80 flex-col bg-slate-950/60">
          <CopilotSidebar
            defaultOpen={true}
            clickOutsideToClose={false}
            labels={{
              title: "Mission Copilot",
              initial:
                "Use the control plane copilot to propose plays, summarise guardrails, " +
                "and capture dry-run artifacts before requesting OAuth access.",
            }}
          />

          <div className="mt-auto border-t border-white/10 bg-slate-950/80 p-5 text-xs text-slate-300">
            <h3 className="mb-2 text-sm font-semibold text-white">Catalog Snapshot</h3>
            {composioSummary ? (
              <ul className="space-y-1">
                <li>Total entries: {composioSummary.total_entries}</li>
                <li>Toolkits indexed: {composioSummary.toolkits}</li>
                <li className="truncate">Categories: {composioSummary.categories.join(", ")}</li>
              </ul>
            ) : (
              <p>Catalog metadata is loading from the Composio cache.</p>
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

function MissionField({ label, value, onChange, placeholder, textarea }: MissionFieldProps) {
  const commonClasses =
    "mt-1 w-full rounded-lg border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none";

  return (
    <label className="mb-4 block text-sm font-medium text-slate-200">
      <span>{label}</span>
      {textarea ? (
        <textarea
          rows={3}
          value={value}
          placeholder={placeholder}
          className={commonClasses}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          className={commonClasses}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}
