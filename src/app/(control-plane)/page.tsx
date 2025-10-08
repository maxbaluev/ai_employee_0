import { cookies } from "next/headers";

import { ControlPlaneWorkspace } from "./ControlPlaneWorkspace";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import type { Database } from "@supabase/types";

type MissionState = {
  objective: string;
  audience: string;
  timeframe: string;
  guardrails: string;
  plannerNotes: string[];
};

const DEFAULT_MISSION: MissionState = {
  objective: "Prove value in dry-run mode",
  audience: "Pilot revenue team",
  timeframe: "Next 14 days",
  guardrails: "Follow quiet hours, tone policy, undo-first mindset",
  plannerNotes: ["Gate G-A baseline initialised"],
};

function normaliseGuardrails(guardrails: unknown): string {
  if (!guardrails) {
    return DEFAULT_MISSION.guardrails;
  }
  if (typeof guardrails === "string") {
    return guardrails;
  }
  try {
    return JSON.stringify(guardrails, null, 2);
  } catch (error) {
    console.warn("Unable to serialise guardrails payload", error);
    return DEFAULT_MISSION.guardrails;
  }
}

type ObjectiveRow = Database["public"]["Tables"]["objectives"]["Row"];
type ArtifactRow = Database["public"]["Tables"]["artifacts"]["Row"];

export default async function ControlPlanePage() {
  const supabase = getServiceSupabaseClient();

  const { data: objectiveRecord } = await supabase
    .from("objectives")
    .select("id, tenant_id, goal, audience, timeframe, guardrails, metadata")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const objective = (objectiveRecord as ObjectiveRow | null) ?? null;

  const defaultTenant = process.env.GATE_GA_DEFAULT_TENANT_ID ?? "00000000-0000-0000-0000-000000000000";
  const tenantId = objective?.tenant_id ?? defaultTenant;

  const metadata = (objective?.metadata ?? {}) as Record<string, unknown>;

  const mission: MissionState = {
    objective: objective?.goal ?? DEFAULT_MISSION.objective,
    audience: objective?.audience ?? DEFAULT_MISSION.audience,
    timeframe: objective?.timeframe ?? DEFAULT_MISSION.timeframe,
    guardrails: normaliseGuardrails(objective?.guardrails),
    plannerNotes: DEFAULT_MISSION.plannerNotes,
  };

  const maybeNotes = metadata?.plannerNotes;
  if (Array.isArray(maybeNotes)) {
    const cleanedNotes = maybeNotes.filter((note): note is string => typeof note === "string");
    if (cleanedNotes.length) {
      mission.plannerNotes = cleanedNotes;
    }
  }

  const artifactsQuery = supabase
    .from("artifacts")
    .select("id, title, content, status")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(4);

  if (objective?.id) {
    artifactsQuery.eq("play_id", objective.id);
  }

  const { data: artifactsRows } = await artifactsQuery;

  const initialArtifacts =
    artifactsRows?.map((artifact) => {
      const row = artifact as ArtifactRow;
      return {
        artifact_id: row.id,
        title: row.title,
        summary:
          row.content && typeof row.content === "object"
            ? JSON.stringify(row.content)
            : "Agent will populate this evidence card during dry-run proofs.",
        status: row.status ?? "draft",
      };
    }) ?? [];

  if (!initialArtifacts.length) {
    initialArtifacts.push({
      artifact_id: "dry-run-outline",
      title: "Dry-run Planning Outline",
      summary: "Sequenced steps for zero-privilege proof pack generation.",
      status: "draft",
    });
  }

  let catalogSummary: { total_entries: number; toolkits: number; categories: string[] } | undefined;
  const cookieStore = await cookies();
  const catalogCookie = cookieStore.get("composio_catalog_summary");
  if (catalogCookie) {
    try {
      const parsed = JSON.parse(catalogCookie.value) as { total_entries: number; toolkits: number; categories: string[] };
      catalogSummary = parsed;
    } catch (error) {
      console.warn("Failed to parse catalog summary cookie", error);
    }
  }

  return (
    <ControlPlaneWorkspace
      tenantId={tenantId}
      initialMission={mission}
      initialObjectiveId={objective?.id ?? null}
      initialArtifacts={initialArtifacts}
      catalogSummary={catalogSummary}
    />
  );
}
