import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

import type { Database } from "@supabase/types";
import { getRouteHandlerSupabaseClient } from "@/lib/supabase/server";

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

    const { data: existingRows } = await supabase
      .from("mission_safeguards")
      .select("suggested_value")
      .eq("mission_id", missionId)
      .eq("tenant_id", tenantId)
      .eq("hint_type", "toolkit_recommendation")
      .eq("status", "accepted");

    const previousSelections = normaliseSelections(existingRows ?? []);

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

    const appliedSelections = selections.map((sel) => ({
      slug: sel.slug,
      name: sel.name,
      auth_type: sel.noAuth ? "none" : sel.authType || "oauth",
      category: sel.category,
      no_auth: sel.noAuth,
    }));

    const added = appliedSelections.filter(
      (item) => !previousSelections.some((prev) => prev.slug === item.slug),
    );
    const removed = previousSelections.filter(
      (item) => !appliedSelections.some((current) => current.slug === item.slug),
    );

    const authBreakdown = appliedSelections.reduce(
      (acc, item) => {
        if (item.no_auth) {
          acc.no_auth += 1;
        } else {
          acc.oauth += 1;
        }
        return acc;
      },
      { no_auth: 0, oauth: 0 },
    );

    const requestId = createHash("sha1")
      .update(
        `${tenantId}|${missionId}|${appliedSelections
          .map((item) => item.slug)
          .sort()
          .join(",")}`,
      )
      .digest("hex");

    if (isUuid(tenantId)) {
      const payload = {
        request_id: requestId,
        applied_count: appliedSelections.length,
        selections: appliedSelections,
        added,
        removed,
        auth_breakdown: authBreakdown,
        selected_slugs: appliedSelections.map((item) => item.slug),
      };

      const missionValue = isUuid(missionId) ? missionId : null;

      try {
        await supabase.from("mission_events").insert([
          {
            tenant_id: tenantId,
            mission_id: missionValue,
            event_name: "toolkit_selected",
            event_payload: {
              ...payload,
              total_selected: appliedSelections.length,
              timestamp: new Date().toISOString(),
            },
          },
          {
            tenant_id: tenantId,
            mission_id: missionValue,
            event_name: "toolkit_suggestion_applied",
            event_payload: payload,
          },
        ] as Database["public"]["Tables"]["mission_events"]["Insert"][]);
      } catch (telemetryError) {
        console.warn("Failed to emit toolkit selection telemetry", telemetryError);
      }
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

function normaliseSelections(rows: Array<{ suggested_value: unknown }>): Array<{
  slug: string;
  name: string;
  auth_type: string;
  category: string;
  no_auth: boolean;
}> {
  const fallback = [] as Array<{
    slug: string;
    name: string;
    auth_type: string;
    category: string;
    no_auth: boolean;
  }>;

  return rows.reduce((acc, row) => {
    const value = row.suggested_value as Record<string, unknown> | null;
    if (!value) {
      return acc;
    }
    const slug = typeof value.slug === "string" ? value.slug : undefined;
    const name = typeof value.name === "string" ? value.name : slug;
    if (!slug || !name) {
      return acc;
    }
    const authType = typeof value.authType === "string" ? value.authType : "oauth";
    const category = typeof value.category === "string" ? value.category : "general";
    const noAuth = typeof value.noAuth === "boolean" ? value.noAuth : authType === "none";
    acc.push({
      slug,
      name,
      auth_type: noAuth ? "none" : authType,
      category,
      no_auth: noAuth,
    });
    return acc;
  }, fallback);
}

function isUuid(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }
  return /^[0-9a-fA-F-]{36}$/.test(value);
}
