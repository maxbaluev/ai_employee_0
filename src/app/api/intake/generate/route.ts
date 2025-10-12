/**
 * POST /api/intake/generate
 *
 * Generates mission intake chips from freeform user input using Gemini AI.
 * Throws an error if Gemini generation fails.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateIntake } from '@/lib/intake/service';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase/server';
import { requireTenantId, TenantResolutionError } from '@/app/api/_shared/tenant';

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

    let tenantId: string;
    try {
      tenantId = requireTenantId({
        providedTenantId: body.tenantId,
        session,
        missingTenantHint: 'Authenticate with Supabase or supply tenantId in the request body',
      });
    } catch (err) {
      if (err instanceof TenantResolutionError) {
        const responseBody: { error: string; hint?: string } = { error: err.message };
        if (err.hint !== undefined) {
          responseBody.hint = err.hint;
        }
        return NextResponse.json(responseBody, { status: err.status });
      }
      throw err;
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
