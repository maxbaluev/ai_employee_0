import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getServiceSupabaseClient } from "@/lib/supabase/service";
import type { Database, Json } from "@supabase/types";

const payloadSchema = z.object({
  agentId: z.string().min(1).default("control_plane_foundation"),
  tenantId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  sessionIdentifier: z.string().optional(),
  role: z.enum(["system", "user", "assistant"]).default("assistant"),
  content: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

async function resolveSessionId(
  supabase: ReturnType<typeof getServiceSupabaseClient>,
  agentId: string,
  tenantId: string,
  sessionIdentifier?: string,
) {
  if (!sessionIdentifier) return null;

  const { data, error } = await supabase
    .from<Database["public"]["Tables"]["copilot_sessions"]["Row"]>("copilot_sessions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("agent_id", agentId)
    .eq("session_identifier", sessionIdentifier)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
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

  const messagePayload: Database["public"]["Tables"]["copilot_messages"]["Insert"] = {
    tenant_id: tenantId,
    session_id: sessionId,
    role: parsed.data.role,
    content: { text: parsed.data.content } as Json,
    metadata: (parsed.data.metadata ?? {}) as Json,
  };

  const { data, error } = await supabase
    .from<Database["public"]["Tables"]["copilot_messages"]["Row"]>("copilot_messages")
    .insert(messagePayload)
    .select("id, created_at")
    .maybeSingle();

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

