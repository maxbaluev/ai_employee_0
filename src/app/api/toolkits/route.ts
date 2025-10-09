import { NextRequest, NextResponse } from "next/server";
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
  if (process.env.GATE_GA_DEFAULT_TENANT_ID) {
    return process.env.GATE_GA_DEFAULT_TENANT_ID;
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
      const { data: safeguards } = await supabase
        .from("mission_safeguards")
        .select(
          "suggested_value" as const,
        )
        .eq("mission_id", missionId)
        .eq("tenant_id", tenantId)
        .eq("hint_type", "toolkit_recommendation")
        .eq("status", "accepted");

      if (safeguards) {
        selectedSlugs = safeguards
          .map((s) => {
            const value = s.suggested_value as { slug?: unknown } | null;
            return typeof value?.slug === "string" ? value.slug : undefined;
          })
          .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
      }
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
