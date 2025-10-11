import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getRouteHandlerSupabaseClient } from '@/lib/supabase/server';

const payloadSchema = z.object({
  missionId: z.string().uuid('Invalid mission ID format'),
  tenantId: z.string().uuid('Invalid tenant ID format').optional(),
  findingType: z.string().trim().optional(),
  payload: z.record(z.unknown()).optional(),
  readiness: z.number().int().min(0).max(100),
});

function resolveTenantId(
  sessionTenantId: string | undefined,
  bodyTenantId: string | undefined,
) {
  if (sessionTenantId) {
    return sessionTenantId;
  }
  if (bodyTenantId) {
    return bodyTenantId;
  }
  if (process.env.GATE_GA_DEFAULT_TENANT_ID) {
    return process.env.GATE_GA_DEFAULT_TENANT_ID;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid inspection preview payload',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    return NextResponse.json(
      {
        error: 'Failed to resolve session context',
        hint: sessionError.message,
      },
      { status: 500 },
    );
  }

  const tenantId = resolveTenantId(session?.user?.id, parsed.data.tenantId);
  if (!tenantId) {
    return NextResponse.json(
      {
        error: 'Missing tenant context',
        hint: 'Authenticate, provide tenantId, or configure GATE_GA_DEFAULT_TENANT_ID',
      },
      { status: 400 },
    );
  }

  try {
    const { data, error } = await supabase
      .from('inspection_findings')
      .insert({
        tenant_id: tenantId,
        mission_id: parsed.data.missionId,
        finding_type: parsed.data.findingType ?? null,
        payload: (parsed.data.payload ?? {}) as unknown,
        readiness: parsed.data.readiness,
      })
      .select('id, tenant_id, mission_id, finding_type, payload, readiness, created_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to persist inspection finding');
    }

    return NextResponse.json({ finding: data }, { status: 201 });
  } catch (error) {
    console.error('[api:inspect/preview] persist failed', error);

    return NextResponse.json(
      {
        error: 'Failed to persist inspection preview',
        hint: error instanceof Error ? error.message : 'Unknown persistence error',
      },
      { status: 500 },
    );
  }
}
