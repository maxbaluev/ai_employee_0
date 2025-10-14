import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { SupabaseClient } from '@supabase/supabase-js';

import { logTelemetryEvent } from '@/lib/intake/service';
import { RegenerationLimiter } from '@/lib/intake/regenerationLimiter';
import { fetchToolkitRecommendations } from '@/lib/toolkits/recommendation';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@supabase/types';

const limiter = new RegenerationLimiter({ maxAttempts: 5, resetWindowMs: 10_000 });

const querySchema = z.object({
  tenantId: z.string().uuid().optional(),
  missionId: z.string().uuid().optional(),
  persona: z.string().min(1).max(64).optional(),
  industry: z.string().min(1).max(64).optional(),
});

function resolveTenantId(provided: string | undefined, sessionTenantId: string | undefined) {
  if (provided && provided.trim()) {
    return provided.trim();
  }
  if (sessionTenantId) {
    return sessionTenantId;
  }
  return null;
}

export async function __resetToolkitRecommendationLimiter() {
  await limiter.clearAll();
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const searchParams = request.nextUrl.searchParams;
  const rawPersona = searchParams.get('persona');
  const rawIndustry = searchParams.get('industry');

  const parsed = querySchema.safeParse({
    tenantId: searchParams.get('tenantId') ?? undefined,
    missionId: searchParams.get('missionId') ?? undefined,
    persona: rawPersona && rawPersona.trim().length > 0 ? rawPersona.trim() : undefined,
    industry: rawIndustry && rawIndustry.trim().length > 0 ? rawIndustry.trim() : undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid query parameters',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const tenantId = resolveTenantId(parsed.data.tenantId, session?.user?.id);
  if (!tenantId) {
    return NextResponse.json(
      {
        error: 'Unable to determine tenant context',
        hint: 'Authenticate or provide tenantId to request toolkit recommendations.',
      },
      { status: 401 },
    );
  }

  const missionId = parsed.data.missionId ?? null;

  if (missionId) {
    const allowed = await limiter.checkAndIncrement(tenantId, missionId, 'toolkits_recommend');
    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Too many recommendation requests. Please wait a few seconds before retrying.',
        },
        { status: 429 },
      );
    }
  }

  try {
    const recommendation = await fetchToolkitRecommendations({
      supabase: supabase as unknown as SupabaseClient<Database, 'public'>,
      tenantId,
      missionId,
      persona: parsed.data.persona ?? null,
      industry: parsed.data.industry ?? null,
    });

    const latencyMs = Date.now() - startedAt;

    try {
      await logTelemetryEvent({
        tenantId,
        missionId: missionId ?? undefined,
        eventName: 'api_toolkits_recommend_hit',
        eventData: {
          latency_ms: latencyMs,
          mission_id: missionId,
          persona: parsed.data.persona ?? null,
          industry: parsed.data.industry ?? null,
          toolkits_returned: recommendation.toolkits.length,
          planner_suggestion: recommendation.plannerSuggestion
            ? {
                run_id: recommendation.plannerSuggestion.runId,
                primary_toolkits: recommendation.plannerSuggestion.primaryToolkits,
              }
            : null,
        },
      });
    } catch (telemetryError) {
      console.warn('[api:toolkits/recommend] telemetry failed', telemetryError);
    }

    return NextResponse.json(recommendation);
  } catch (error) {
    console.error('[api:toolkits/recommend] failed to load recommendations', error);
    return NextResponse.json(
      {
        error: 'Failed to load toolkit recommendations',
      },
      { status: 500 },
    );
  }
}
