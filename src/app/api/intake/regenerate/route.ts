/**
 * POST /api/intake/regenerate
 *
 * Regenerates a specific mission intake field (objective, audience, or safeguard).
 */

import { NextRequest, NextResponse } from 'next/server';
import { regenerateField, RegenerationLimitError } from '@/lib/intake/service';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase/server';

function resolveTenantId(
  bodyTenantId: unknown,
  sessionTenantId: string | undefined,
): string | null {
  if (typeof bodyTenantId === 'string' && bodyTenantId.trim()) {
    return bodyTenantId;
  }
  if (sessionTenantId) {
    return sessionTenantId;
  }
  if (process.env.GATE_GA_DEFAULT_TENANT_ID) {
    return process.env.GATE_GA_DEFAULT_TENANT_ID;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (typeof body.missionId !== 'string' || !body.missionId) {
      return NextResponse.json({ error: "'missionId' is required" }, { status: 400 });
    }

    if (!['objective', 'audience', 'kpis', 'safeguards'].includes(body.field)) {
      return NextResponse.json(
        { error: "'field' must be one of objective, audience, kpis, safeguards" },
        { status: 400 },
      );
    }

    const supabaseRoute = await getRouteHandlerSupabaseClient();
    const {
      data: { session },
    } = await supabaseRoute.auth.getSession();

    const tenantId = resolveTenantId(body.tenantId, session?.user?.id);
    if (!tenantId) {
      return NextResponse.json(
        {
          error: 'Unable to determine tenant context',
          hint: 'Authenticate with Supabase or supply tenantId in the request body',
        },
        { status: 401 },
      );
    }

    const chips = await regenerateField({
      missionId: body.missionId,
      tenantId,
      field: body.field,
      context: typeof body.context === 'string' ? body.context : undefined,
    });

    return NextResponse.json({ chips });
  } catch (error) {
    if (error instanceof RegenerationLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          field: error.field,
          limit: error.limit,
        },
        { status: 429 },
      );
    }

    console.error('[api:intake/regenerate] error', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
