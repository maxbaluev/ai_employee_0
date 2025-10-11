import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { persistMissionFeedback } from '@/lib/feedback/service';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase/server';

const payloadSchema = z.object({
  missionId: z.string().uuid(),
  tenantId: z.string().uuid().optional(),
  artifactId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  feedbackText: z.string().trim().max(5000).optional(),
  learningSignals: z.record(z.unknown()).optional(),
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
        error: 'Invalid feedback payload',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const supabaseRoute = await getRouteHandlerSupabaseClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabaseRoute.auth.getSession();

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
    const feedback = await persistMissionFeedback({
      tenantId,
      missionId: parsed.data.missionId,
      artifactId: parsed.data.artifactId,
      rating: parsed.data.rating,
      feedbackText: parsed.data.feedbackText,
      learningSignals: parsed.data.learningSignals,
    });

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    console.error('[api:feedback/submit] persistMissionFeedback failed', error);

    return NextResponse.json(
      {
        error: 'Failed to persist mission feedback',
        hint: error instanceof Error ? error.message : 'Unknown persistence error',
      },
      { status: 500 },
    );
  }
}
