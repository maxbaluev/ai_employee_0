import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { normalizeMissionBrief } from "@/lib/mission/normalizeBrief";
import type { Database } from "@supabase/types";

const paramsSchema = z.object({
  missionId: z.string().uuid(),
});

const querySchema = z.object({
  tenantId: z.string().uuid(),
});

type MissionMetadataRow = Pick<
  Database["public"]["Tables"]["mission_metadata"]["Row"],
  "field" | "value" | "confidence"
>;
type MissionSafeguardRow = Pick<
  Database["public"]["Tables"]["mission_safeguards"]["Row"],
  "hint_type" | "suggested_value" | "status"
>;

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: { missionId?: string } }) {
  const parsedParams = paramsSchema.safeParse({ missionId: context.params?.missionId });
  if (!parsedParams.success) {
    return NextResponse.json(
      {
        error: "Invalid mission identifier",
        details: parsedParams.error.flatten(),
      },
      { status: 400 },
    );
  }

  const searchParams = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!searchParams.success) {
    return NextResponse.json(
      {
        error: "Invalid query parameters",
        details: searchParams.error.flatten(),
      },
      { status: 400 },
    );
  }

  const missionId = parsedParams.data.missionId;
  const tenantId = searchParams.data.tenantId;

  if (!tenantId) {
    return NextResponse.json(
      {
        error: "Tenant context required",
        hint: "Supply tenantId (UUID) in the query string or authenticate with Supabase",
      },
      { status: 401 },
    );
  }

  const supabase = getServiceSupabaseClient();

  const [{ data: metadataRows, error: metadataError }, { data: safeguardsRows, error: safeguardsError }] =
    await Promise.all([
      supabase
        .from("mission_metadata")
        .select("field,value,confidence")
        .eq("mission_id", missionId)
        .eq("tenant_id", tenantId),
      supabase
        .from("mission_safeguards")
        .select("hint_type,suggested_value,status")
        .eq("mission_id", missionId)
        .eq("tenant_id", tenantId)
        .eq("status", "accepted"),
    ]);

  if (metadataError) {
    return NextResponse.json(
      { error: "Failed to load mission metadata", hint: metadataError.message },
      { status: 500 },
    );
  }

  if (safeguardsError) {
    console.warn("[api:missions/brief] safeguards query failed", safeguardsError);
  }

  if (!metadataRows || metadataRows.length === 0) {
    return NextResponse.json({ brief: null }, { status: 200 });
  }

  const brief = normalizeMissionBrief(metadataRows, safeguardsRows ?? []);
  return NextResponse.json({ brief }, { status: 200 });
}
