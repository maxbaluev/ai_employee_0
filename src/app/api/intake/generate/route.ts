/**
 * POST /api/intake/generate
 *
 * Generates mission intake chips from freeform user input.
 * Supports Gemini AI with deterministic fallback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateIntake } from '@/lib/intake/service';
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

    if (typeof body.rawText !== 'string' || !body.rawText.trim()) {
      return NextResponse.json({ error: "'rawText' must be a non-empty string" }, { status: 400 });
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

    const links = Array.isArray(body.links)
      ? body.links.filter((item: unknown): item is string => typeof item === 'string')
      : undefined;

    const missionId = typeof body.missionId === 'string' ? body.missionId : undefined;

    const result = await generateIntake({
      rawText: body.rawText,
      links,
      tenantId,
      missionId,
    });

    return NextResponse.json({
      missionId: result.missionId,
      chips: result.chips,
    });
  } catch (error) {
    console.error('[api:intake/generate] error', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
