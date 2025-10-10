import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getServiceSupabaseClient } from "@/lib/supabase/service";
import type { Database, Json } from "@supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";

const payloadSchema = z.object({
  agentId: z.string().min(1).default("control_plane_foundation"),
  tenantId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  sessionIdentifier: z.string().optional(),
  missionId: z.string().uuid().optional(),
  role: z.enum(["system", "user", "assistant"]).default("assistant"),
  content: z.string().min(1),
  payloadType: z.string().min(1).optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  telemetryEventIds: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveSessionId(
  supabase: ReturnType<typeof getServiceSupabaseClient>,
  agentId: string,
  tenantId: string,
  sessionIdentifier?: string,
) {
  if (!sessionIdentifier) return null;

  type SessionLookupResult = {
    data: Pick<Database["public"]["Tables"]["copilot_sessions"]["Row"], "id"> | null;
    error: PostgrestError | null;
  };

  const { data, error } = (await supabase
    .from("copilot_sessions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("agent_id", agentId)
    .eq("session_identifier", sessionIdentifier)
    .maybeSingle()) as SessionLookupResult;

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
}

function parseLimit(value: string | null): number {
  if (!value) {
    return 50;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 50;
  }
  return Math.min(Math.max(parsed, 1), 200);
}

function parseSince(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid Copilot message payload",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const defaultTenant = process.env.GATE_GA_DEFAULT_TENANT_ID ?? "00000000-0000-0000-0000-000000000000";
  const tenantId = parsed.data.tenantId ?? defaultTenant;

  if (!tenantId) {
    return NextResponse.json(
      {
        error: "Missing tenant identifier",
        hint: "Provide tenantId or configure GATE_GA_DEFAULT_TENANT_ID",
      },
      { status: 400 },
    );
  }

  const supabase = getServiceSupabaseClient();
  const sessionId =
    parsed.data.sessionId ??
    (await resolveSessionId(supabase, parsed.data.agentId, tenantId, parsed.data.sessionIdentifier));

  if (!sessionId) {
    return NextResponse.json(
      {
        error: "Session not found",
        hint: "Create the session via /api/copilotkit/session before storing messages",
      },
      { status: 404 },
    );
  }

  const metadataPayload = (parsed.data.metadata ?? {}) as Json;
  const missionIdFromMetadata =
    typeof parsed.data.metadata?.mission_id === "string" && uuidPattern.test(parsed.data.metadata.mission_id)
      ? parsed.data.metadata.mission_id
      : null;

  const messagePayload: Database["public"]["Tables"]["copilot_messages"]["Insert"] = {
    tenant_id: tenantId,
    session_id: sessionId,
    mission_id: parsed.data.missionId ?? missionIdFromMetadata,
    role: parsed.data.role,
    content: { text: parsed.data.content } as Json,
    metadata: metadataPayload,
    payload_type: parsed.data.payloadType ?? null,
    latency_ms: parsed.data.latencyMs ?? null,
    telemetry_event_ids: parsed.data.telemetryEventIds ?? null,
  };

  type MessageInsertResult = {
    data: Pick<Database["public"]["Tables"]["copilot_messages"]["Row"], "id" | "created_at"> | null;
    error: PostgrestError | null;
  };

  const { data, error } = (await supabase
    .from("copilot_messages")
    .insert(messagePayload as never)
    .select("id, created_at")
    .maybeSingle()) as MessageInsertResult;

  if (error) {
    return NextResponse.json(
      {
        error: "Failed to persist Copilot message",
        hint: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      messageId: data?.id ?? null,
      storedAt: data?.created_at ?? null,
    },
    { status: 200 },
  );
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const agentId = url.searchParams.get("agentId")?.trim() || "control_plane_foundation";
  const tenantQuery = url.searchParams.get("tenantId");
  const sessionQuery = url.searchParams.get("sessionId");
  const sessionIdentifier = url.searchParams.get("sessionIdentifier") ?? undefined;
  const stageFilter = url.searchParams.get("stage") ?? undefined;
  const orderParam = url.searchParams.get("order")?.toLowerCase() ?? undefined;
  const ascending = orderParam ? orderParam !== "desc" : true;
  const limit = parseLimit(url.searchParams.get("limit"));
  const since = parseSince(url.searchParams.get("since"));

  const defaultTenant = process.env.GATE_GA_DEFAULT_TENANT_ID ?? "00000000-0000-0000-0000-000000000000";
  const tenantId = tenantQuery && uuidPattern.test(tenantQuery) ? tenantQuery : defaultTenant;

  if (!tenantId) {
    return NextResponse.json(
      {
        error: "Missing tenant identifier",
        hint: "Provide tenantId or configure GATE_GA_DEFAULT_TENANT_ID",
      },
      { status: 400 },
    );
  }

  const supabase = getServiceSupabaseClient();

  let sessionId: string | null = sessionQuery && uuidPattern.test(sessionQuery) ? sessionQuery : null;

  if (!sessionId && sessionIdentifier) {
    sessionId = await resolveSessionId(supabase, agentId, tenantId, sessionIdentifier);
  }

  if (!sessionId) {
    return NextResponse.json(
      {
        agentId,
        tenantId,
        sessionId: null,
        messages: [],
        count: 0,
        fetchedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }

  let query = supabase
    .from("copilot_messages")
    .select("id, role, content, metadata, created_at")
    .eq("tenant_id", tenantId)
    .eq("session_id", sessionId);

  if (stageFilter) {
    query = query.contains("metadata", { stage: stageFilter } as Record<string, unknown>);
  }

  if (since) {
    query = query.gt("created_at", since);
  }

  type MessageListRow = Pick<
    Database["public"]["Tables"]["copilot_messages"]["Row"],
    "id" | "role" | "content" | "metadata" | "created_at"
  >;

  type MessageListResult = {
    data: MessageListRow[] | null;
    error: PostgrestError | null;
  };

  const { data, error } = (await query.order("created_at", { ascending }).limit(limit)) as MessageListResult;

  if (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch Copilot messages",
        hint: error.message,
      },
      { status: 500 },
    );
  }

  const messages = (data ?? []).map((row) => {
    const contentValue = row.content;
    let contentText = "";
    if (typeof contentValue === "string") {
      contentText = contentValue;
    } else if (contentValue && typeof contentValue === "object" && "text" in contentValue) {
      const textValue = (contentValue as Record<string, unknown>).text;
      contentText = typeof textValue === "string" ? textValue : JSON.stringify(contentValue);
    } else {
      contentText = JSON.stringify(contentValue ?? "");
    }

    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {};

    const stage = typeof metadata.stage === "string" ? metadata.stage : null;

    return {
      id: row.id,
      role: row.role,
      content: contentText,
      metadata,
      stage,
      createdAt: row.created_at,
    };
  });

  const nextCursor = messages.length ? messages[messages.length - 1]?.createdAt ?? null : null;

  return NextResponse.json(
    {
      agentId,
      tenantId,
      sessionId,
      messages,
      count: messages.length,
      fetchedAt: new Date().toISOString(),
      order: ascending ? "asc" : "desc",
      nextCursor,
    },
    { status: 200 },
  );
}
