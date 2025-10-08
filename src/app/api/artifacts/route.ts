import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getServiceSupabaseClient } from "@/lib/supabase/service";
import type { Database, Json } from "@supabase/types";

const payloadSchema = z.object({
  artifactId: z.string().optional(),
  title: z.string().min(1),
  summary: z.string().min(1),
  status: z.string().optional(),
  tenantId: z.string().uuid().optional(),
  playId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid artifact payload",
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
        hint: "Provide tenantId or set GATE_GA_DEFAULT_TENANT_ID",
      },
      { status: 400 },
    );
  }

  const serviceClient = getServiceSupabaseClient();
  const payload: Database["public"]["Tables"]["artifacts"]["Insert"] = {
    id: parsed.data.artifactId,
    tenant_id: tenantId,
    play_id: parsed.data.playId ?? null,
    type: "evidence",
    title: parsed.data.title,
    content: { summary: parsed.data.summary } as Json,
    status: parsed.data.status ?? "draft",
  };

  const { data, error } = await serviceClient
    .from("artifacts")
    .upsert(payload, { onConflict: "id" })
    .select("id, title, content, status")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        error: "Failed to upsert artifact",
        hint: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ artifact: data });
}
