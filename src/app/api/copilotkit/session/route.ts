import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getServiceSupabaseClient } from "@/lib/supabase/service";
import type { Database, Json } from "@supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";

type SessionUpsertResult = {
  data: Pick<Database["public"]["Tables"]["copilot_sessions"]["Row"], "id"> | null;
  error: PostgrestError | null;
};

const payloadSchema = z.object({
  agentId: z.string().min(1),
  sessionIdentifier: z.string().min(1),
  tenantId: z.string().uuid().optional(),
  state: z.record(z.any()).default({}),
  retentionMinutes: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid Copilot session payload",
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

  const retentionMinutes = parsed.data.retentionMinutes ?? 60 * 24 * 7;
  const expiresAt = new Date(Date.now() + retentionMinutes * 60 * 1000).toISOString();

  const serviceClient = getServiceSupabaseClient();
  const payload: Database["public"]["Tables"]["copilot_sessions"]["Insert"] = {
    tenant_id: tenantId,
    agent_id: parsed.data.agentId,
    session_identifier: parsed.data.sessionIdentifier,
    state: parsed.data.state as Json,
    expires_at: expiresAt,
  };

  const { data, error } = (await serviceClient
    .from("copilot_sessions")
    .upsert(payload as never, {
      onConflict: "tenant_id,agent_id,session_identifier",
    })
    .select("id")
    .maybeSingle()) as SessionUpsertResult;

  if (error) {
    return NextResponse.json(
      {
        error: "Failed to persist Copilot session",
        hint: error.message,
      },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ sessionId: null }, { status: 200 });
  }

  return NextResponse.json({ sessionId: data.id }, { status: 200 });
}
