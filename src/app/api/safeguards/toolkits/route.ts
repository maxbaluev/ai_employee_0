import { NextRequest, NextResponse } from "next/server";
import { getRouteHandlerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@supabase/types";

type ToolkitSelection = {
  slug: string;
  name: string;
  authType: string;
  category: string;
  logo?: string | null;
  noAuth: boolean;
};

function resolveTenantId(candidate: string | null, sessionTenantId: string | undefined) {
  if (candidate && candidate.trim()) {
    return candidate.trim();
  }
  if (sessionTenantId) {
    return sessionTenantId;
  }
  if (process.env.GATE_GA_DEFAULT_TENANT_ID) {
    return process.env.GATE_GA_DEFAULT_TENANT_ID;
  }
  return null;
}

/**
 * POST /api/safeguards/toolkits
 * Persists toolkit selections to mission_safeguards
 * Body: { missionId, tenantId, selections: ToolkitSelection[] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { missionId, tenantId: tenantFromBody, selections } = body as {
      missionId: string;
      tenantId?: string;
      selections: ToolkitSelection[];
    };

    if (!missionId) {
      return NextResponse.json(
        { error: "missionId is required" },
        { status: 400 },
      );
    }

    if (!Array.isArray(selections)) {
      return NextResponse.json({ error: "selections must be an array" }, { status: 400 });
    }

    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const tenantId = resolveTenantId(tenantFromBody ?? null, session?.user?.id);

    if (!tenantId) {
      return NextResponse.json(
        {
          error: "Unable to determine tenant context",
          hint: "Authenticate with Supabase or include tenantId in the request body",
        },
        { status: 401 },
      );
    }

    // Delete existing toolkit_recommendation rows for this mission
    await supabase
      .from("mission_safeguards")
      .delete()
      .eq("mission_id", missionId)
      .eq("tenant_id", tenantId)
      .eq("hint_type", "toolkit_recommendation");

    // Insert new selections
    if (selections.length > 0) {
      const rows = selections.map((sel) => ({
        mission_id: missionId,
        tenant_id: tenantId,
        hint_type: "toolkit_recommendation",
        suggested_value: {
          slug: sel.slug,
          name: sel.name,
          authType: sel.authType,
          category: sel.category,
          logo: sel.logo,
          noAuth: sel.noAuth,
        },
        status: "accepted",
        source: "user_selection",
        generation_count: 0,
        accepted_at: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from("mission_safeguards")
        .insert(rows as Database["public"]["Tables"]["mission_safeguards"]["Insert"][]);

      if (insertError) {
        console.error("Insert error:", insertError);
        throw new Error("Failed to persist toolkit selections");
      }
    }

    // Emit telemetry event
    try {
      await supabase.from("mission_events").insert({
        mission_id: missionId,
        tenant_id: tenantId,
        event_name: "toolkit_suggestion_applied",
        event_payload: {
          selections: selections.map((s) => s.slug),
          count: selections.length,
        },
      });
    } catch (telemetryError) {
      // Non-critical: log but don't fail the request
      console.warn("Failed to emit telemetry:", telemetryError);
    }

    return NextResponse.json({
      success: true,
      count: selections.length,
    });
  } catch (error) {
    console.error("Error persisting toolkit selections:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to persist selections" },
      { status: 500 }
    );
  }
}
