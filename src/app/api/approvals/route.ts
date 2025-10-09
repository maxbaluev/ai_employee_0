import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logTelemetryEvent } from '@/lib/intake/service';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import type { Database, Json } from '@supabase/types';

const payloadSchema = z.object({
  tenantId: z.string().uuid().optional(),
  missionId: z.string().uuid().optional(),
  toolCallId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected', 'needs_changes']),
  justification: z.string().trim().max(2000).optional(),
  reviewerId: z.string().uuid().optional(),
  guardrailViolation: z
    .object({
      violated: z.boolean(),
      notes: z.string().trim().max(2000).optional(),
    })
    .optional(),
  metadata: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid approval payload',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const defaultTenant = process.env.GATE_GA_DEFAULT_TENANT_ID ?? '00000000-0000-0000-0000-000000000000';
  const tenantId = parsed.data.tenantId ?? defaultTenant;

  if (!tenantId) {
    return NextResponse.json(
      {
        error: 'Missing tenant identifier',
        hint: 'Provide tenantId or configure GATE_GA_DEFAULT_TENANT_ID',
      },
      { status: 400 },
    );
  }

  const supabase = getServiceSupabaseClient();
  const insertPayload: Database['public']['Tables']['approvals']['Insert'] = {
    tenant_id: tenantId,
    tool_call_id: parsed.data.toolCallId,
    reviewer_id: parsed.data.reviewerId ?? null,
    decision: parsed.data.decision,
    justification: parsed.data.justification ?? null,
    guardrail_violation: parsed.data.guardrailViolation
      ? ({
          violated: parsed.data.guardrailViolation.violated,
          notes: parsed.data.guardrailViolation.notes ?? null,
        } as Json)
      : null,
    metadata: (parsed.data.metadata ?? {}) as Json,
  };

  const { data, error } = await supabase
    .from<Database['public']['Tables']['approvals']['Row']>('approvals')
    .insert(insertPayload)
    .select('id, decision, decision_at, justification')
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        error: 'Failed to persist approval decision',
        hint: error.message,
      },
      { status: 500 },
    );
  }

  try {
    await logTelemetryEvent({
      tenantId,
      missionId: parsed.data.missionId,
      eventName: 'approval_decision',
      eventData: {
        tool_call_id: parsed.data.toolCallId,
        decision: parsed.data.decision,
        has_guardrail_violation: parsed.data.guardrailViolation?.violated ?? false,
      },
    });
  } catch (telemetryError) {
    console.warn('[api:approvals] telemetry failed', telemetryError);
  }

  return NextResponse.json(
    {
      approval: data,
    },
    { status: 201 },
  );
}
