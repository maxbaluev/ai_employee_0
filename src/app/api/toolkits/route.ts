import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@supabase/types";
import { getRouteHandlerSupabaseClient } from "@/lib/supabase/server";

type ToolkitMetadata = {
  name: string;
  slug: string;
  description: string;
  category: string;
  no_auth: boolean;
  auth_schemes: string[];
  logo?: string | null;
};

type ComposioToolkitApiItem = {
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  category?: string | null;
  no_auth?: boolean | null;
  auth_schemes?: unknown;
  meta?: {
    description?: string | null;
    logo?: string | null;
    categories?: Array<{ id?: string | null; name?: string | null } | null> | null;
  } | null;
};

function resolveTenantId(candidate: string | null, sessionTenantId: string | undefined) {
  if (candidate && candidate.trim()) {
    return candidate.trim();
  }
  if (sessionTenantId) {
    return sessionTenantId;
  }
  return null;
}

/**
 * GET /api/toolkits
 * Fetches Composio toolkit metadata and existing selections from mission_safeguards
 * Query params: missionId (optional), tenantId (required for auth)
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const supabase = await getRouteHandlerSupabaseClient();
  const dbClient = supabase as unknown as SupabaseClient<Database, "public">;
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const missionId = searchParams.get("missionId");
  const tenantId = resolveTenantId(searchParams.get("tenantId"), session?.user?.id);

  if (!tenantId) {
    return NextResponse.json(
      {
        error: "Unable to determine tenant context",
        hint: "Authenticate with Supabase or supply tenantId in the request",
      },
      { status: 401 },
    );
  }

  try {
    // Fetch toolkits from Composio API
    const composioApiKey = process.env.COMPOSIO_API_KEY;
    if (!composioApiKey) {
      return NextResponse.json(
        { error: "COMPOSIO_API_KEY not configured" },
        { status: 500 }
      );
    }

    const composioUrl = new URL("https://backend.composio.dev/api/v3/toolkits");
    composioUrl.searchParams.set("limit", "24");
    composioUrl.searchParams.set("sort_by", "usage");

    const composioResponse = await fetch(composioUrl, {
      headers: {
        "X-API-KEY": composioApiKey,
      },
      cache: "no-store",
    });

    if (!composioResponse.ok) {
      throw new Error(`Composio API error: ${composioResponse.status}`);
    }

    const composioData = await composioResponse.json();
    const records: ComposioToolkitApiItem[] = Array.isArray(composioData.items)
      ? (composioData.items as ComposioToolkitApiItem[])
      : Array.isArray(composioData.data)
        ? (composioData.data as ComposioToolkitApiItem[])
        : [];

    const toolkits: ToolkitMetadata[] = records.map((item) => {
      const meta = item.meta ?? null;

      const rawCategories = Array.isArray(meta?.categories) ? meta.categories : [];
      const categoryCandidates = rawCategories
        .map((cat) => {
          if (!cat || typeof cat !== "object") {
            return undefined;
          }
          const typed = cat as { id?: string | null; name?: string | null };
          const name = typeof typed.name === "string" ? typed.name : undefined;
          const id = typeof typed.id === "string" ? typed.id : undefined;
          return name ?? id ?? undefined;
        })
        .filter((value): value is string => typeof value === "string" && value.length > 0);

      const resolvedCategory = item.category ?? categoryCandidates[0] ?? "general";

      const rawAuthSchemes = Array.isArray(item.auth_schemes) ? item.auth_schemes : [];
      const authSchemes = rawAuthSchemes.filter((scheme): scheme is string => typeof scheme === "string");

      const description =
        (meta && typeof meta.description === "string" ? meta.description : undefined) ??
        item.description ??
        "";

      const logo = meta && typeof meta.logo === "string" ? meta.logo : null;

      return {
        name: item.name ?? "unknown",
        slug: item.slug ?? item.name ?? "unknown",
        description,
        category: resolvedCategory,
        no_auth: Boolean(item.no_auth),
        auth_schemes: authSchemes,
        logo,
      };
    });

    // Sort: no-auth first, then alphabetically
    toolkits.sort((a, b) => {
      if (a.no_auth && !b.no_auth) return -1;
      if (!a.no_auth && b.no_auth) return 1;
      return a.name.localeCompare(b.name);
    });

    // Fetch existing selections if missionId provided
    let selectedSlugs: string[] = [];
    if (missionId) {
      type ToolkitSelection = Pick<
        Database["public"]["Tables"]["toolkit_selections"]["Row"],
        "toolkit_id"
      >;

      const { data: selectionRows } = await dbClient
        .from("toolkit_selections")
        .select("toolkit_id")
        .eq("mission_id", missionId)
        .eq("tenant_id", tenantId);

      const rows = (selectionRows ?? []) as ToolkitSelection[];
      if (rows.length > 0) {
        selectedSlugs = rows
          .map((row) => row.toolkit_id)
          .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
      }
    }

    try {
      await emitToolkitPaletteTelemetry({
        supabase,
        tenantId,
        missionId,
        toolkits,
        selectedSlugs,
      });
    } catch (telemetryError) {
      console.warn("Failed to emit toolkit_recommendation_viewed telemetry", telemetryError);
    }

    return NextResponse.json({
      toolkits,
      selected: selectedSlugs,
    });
  } catch (error) {
    console.error("Error fetching toolkits:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch toolkits" },
      { status: 500 }
    );
  }
}

function isUuid(value: string | null | undefined) {
  if (!value) {
    return false;
  }
  return /^[0-9a-fA-F-]{36}$/.test(value);
}

async function emitToolkitPaletteTelemetry({
  supabase,
  tenantId,
  missionId,
  toolkits,
  selectedSlugs,
}: {
  supabase: Awaited<ReturnType<typeof getRouteHandlerSupabaseClient>>;
  tenantId: string;
  missionId: string | null;
  toolkits: ToolkitMetadata[];
  selectedSlugs: string[];
}) {
  if (!isUuid(tenantId) || toolkits.length === 0) {
    return;
  }

  const dbClient = supabase as unknown as SupabaseClient<Database, "public">;

  const palette = toolkits.map((toolkit, index) => ({
    slug: toolkit.slug,
    name: toolkit.name,
    category: toolkit.category,
    auth_type: toolkit.no_auth ? "none" : toolkit.auth_schemes[0] ?? "oauth",
    no_auth: toolkit.no_auth,
    position: index + 1,
  }));

  const breakdown = palette.reduce(
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
    .update(`${tenantId}|${missionId ?? ""}|${palette.map((item) => item.slug).join(",")}`)
    .digest("hex");

  await dbClient.from("mission_events").insert({
    tenant_id: tenantId,
    mission_id: isUuid(missionId ?? undefined) ? missionId : null,
    event_name: "toolkit_recommendation_viewed",
    event_payload: {
      request_id: requestId,
      total_toolkits: palette.length,
      auth_breakdown: breakdown,
      selected_count: selectedSlugs.length,
      selected_slugs: selectedSlugs,
      palette,
      source: "planner",
    },
  } as Database["public"]["Tables"]["mission_events"]["Insert"]);
}
