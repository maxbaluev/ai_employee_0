import { NextRequest, NextResponse } from 'next/server';
import { logTelemetryEvent } from '@/lib/intake/service';
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

    if (typeof body.eventName !== 'string' || !body.eventName.trim()) {
      return NextResponse.json({ error: "'eventName' is required" }, { status: 400 });
    }

    const supabaseRoute = getRouteHandlerSupabaseClient();
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

    await logTelemetryEvent({
      tenantId,
      missionId: typeof body.missionId === 'string' ? body.missionId : undefined,
      eventName: body.eventName,
      eventData: body.eventData && typeof body.eventData === 'object' ? body.eventData : {},
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api:intake/events] error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
