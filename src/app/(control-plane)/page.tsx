import { cookies } from "next/headers";

import { ControlPlaneWorkspace } from "./ControlPlaneWorkspace";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import type { Database } from "@supabase/types";

export const dynamic = "force-dynamic";

type ObjectiveRow = Database["public"]["Tables"]["objectives"]["Row"];
type ArtifactRow = Database["public"]["Tables"]["artifacts"]["Row"];

export default async function ControlPlanePage() {
  const supabase = getServiceSupabaseClient();

  const { data: objectiveRecord } = await supabase
    .from("objectives")
    .select("id, tenant_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const objective = (objectiveRecord as ObjectiveRow | null) ?? null;

  // Gate G-B: Require explicit tenant context - no fallback
  const tenantId = objective?.tenant_id;

  if (!tenantId) {
    throw new Error(
      "No tenant context available. Ensure authenticated user or objectives table has tenant_id populated."
    );
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
      initialObjectiveId={objective?.id ?? null}
      initialArtifacts={initialArtifacts}
      catalogSummary={catalogSummary}
    />
  );
}
