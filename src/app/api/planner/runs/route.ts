import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getServiceSupabaseClient } from '@/lib/supabase/service';

const querySchema = z.object({
  tenantId: z.string().uuid(),
  missionId: z.string().uuid().optional(),
  limit: z
    .preprocess((value) => (value === undefined ? undefined : Number(value)), z.number().int().min(1).max(100))
    .default(50),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const rawQuery = Object.fromEntries(url.searchParams.entries());

  const parsed = querySchema.safeParse(rawQuery);
  if (!parsed.success) {
    const issueSummary = parsed.error.issues
      .map((issue) => {
        const path = issue.path.join('.') || 'query';
        return `${path} ${issue.message}`;
      })
      .join('; ');

    return NextResponse.json(
      {
        error: `Invalid query parameters: ${issueSummary}`,
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { tenantId, missionId, limit } = parsed.data;

  const supabase = getServiceSupabaseClient();

  let query = supabase
    .from('planner_runs')
    .select('id, tenant_id, mission_id, latency_ms, candidate_count, embedding_similarity_avg, primary_toolkits, mode, metadata, created_at')
    .eq('tenant_id', tenantId);

  if (missionId) {
    query = query.eq('mission_id', missionId);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);

  if (error) {
    return NextResponse.json(
      {
        error: 'Failed to load planner runs',
        hint: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      runs: data ?? [],
    },
    { status: 200 },
  );
}
