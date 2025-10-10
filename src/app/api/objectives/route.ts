import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getRouteHandlerSupabaseClient } from "@/lib/supabase/server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import type { Database, Json } from "@supabase/types";

const payloadSchema = z.object({
  goal: z.string().min(1, "Goal is required"),
  audience: z.string().min(1, "Audience is required"),
  timeframe: z.string().min(1, "Timeframe is required"),
  guardrails: z.union([z.string(), z.record(z.any())]).default(""),
  metadata: z.record(z.any()).optional(),
  tenantId: z.string().uuid().optional(),
  objectiveId: z.string().uuid().optional(),
});

function coerceGuardrails(value: string | Record<string, unknown>) {
  if (typeof value === "string") {
    try {
      return value ? JSON.parse(value) : {};
    } catch {
      throw new Error("Guardrails must be valid JSON");
    }
  }

  return value ?? {};
}

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null);

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid mission payload",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const supabaseRoute = await getRouteHandlerSupabaseClient();
  const {
    data: { session },
  } = await supabaseRoute.auth.getSession();

  const fallbackTenant = process.env.GATE_GA_DEFAULT_TENANT_ID;
  const tenantId = parsed.data.tenantId ?? session?.user?.id ?? fallbackTenant;

  if (!tenantId) {
    return NextResponse.json(
      {
        error: "No tenant context provided",
        hint: "Authenticate with Supabase or supply tenantId in the payload",
      },
      { status: 401 },
    );
  }

  let guardrails: Record<string, unknown>;
  try {
    guardrails = coerceGuardrails(parsed.data.guardrails);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid guardrails JSON",
        hint: (error as Error).message,
      },
      { status: 400 },
    );
  }

  const serviceClient = getServiceSupabaseClient();
  const supabaseDb = serviceClient as unknown as {
    from: typeof serviceClient.from;
  };

  if (parsed.data.objectiveId) {
    const updatePayload: Database['public']['Tables']['objectives']['Update'] = {
      goal: parsed.data.goal,
      audience: parsed.data.audience,
      timeframe: parsed.data.timeframe,
      guardrails: guardrails as Json,
      metadata: (parsed.data.metadata ?? {}) as Json,
    };

    const { data, error } = await supabaseDb
      .from('objectives')
      .update(updatePayload as never)
      .eq('id', parsed.data.objectiveId)
      .eq('tenant_id', tenantId)
      .select('*')
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          error: 'Failed to update objective',
          hint: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { objective: data as Database['public']['Tables']['objectives']['Row'] | null },
      { status: 200 },
    );
  }

  const payload: Database['public']['Tables']['objectives']['Insert'] = {
    tenant_id: tenantId,
    created_by: session?.user?.id ?? null,
    goal: parsed.data.goal,
    audience: parsed.data.audience,
    timeframe: parsed.data.timeframe,
    guardrails: guardrails as Json,
    status: 'draft',
    metadata: (parsed.data.metadata ?? {}) as Json,
  };

  const { data, error } = await supabaseDb
    .from('objectives')
    .insert(payload as never)
    .select('*')
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        error: 'Failed to create objective',
        hint: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { objective: data as Database['public']['Tables']['objectives']['Row'] | null },
    { status: 201 },
  );
}
