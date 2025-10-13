import { NextRequest, NextResponse } from 'next/server';
import { acceptIntake } from '@/lib/intake/service';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase/server';

type SafeguardStatusPayload = {
  id: string;
  status?: 'accepted' | 'edited' | 'rejected';
};

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
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (typeof body.missionId !== 'string' || !body.missionId) {
      return NextResponse.json({ error: "'missionId' is required" }, { status: 400 });
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

    const fields = Array.isArray(body.fields)
      ? body.fields.filter((field: unknown): field is 'objective' | 'audience' | 'kpis' =>
          field === 'objective' || field === 'audience' || field === 'kpis',
        )
      : undefined;

    const safeguards = Array.isArray(body.safeguards)
      ? body.safeguards
          .filter((candidate: unknown): candidate is SafeguardStatusPayload => {
            return (
              candidate != null &&
              typeof candidate === 'object' &&
              typeof (candidate as SafeguardStatusPayload).id === 'string'
            );
          })
          .map((entry: SafeguardStatusPayload) => ({
            id: entry.id,
            status: entry.status,
          }))
      : undefined;

    await acceptIntake({
      missionId: body.missionId,
      tenantId,
      fields,
      safeguards,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api:intake/accept] error', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
