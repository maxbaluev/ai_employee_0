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

  const { data: existing, error: fetchError } = await supabase
    .from<Database['public']['Tables']['approvals']['Row']>('approvals')
    .select('id, decision, decision_at, reviewer_id, justification')
    .eq('tenant_id', tenantId)
    .eq('tool_call_id', parsed.data.toolCallId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      {
        error: 'Failed to evaluate approval state',
        hint: fetchError.message,
      },
      { status: 500 },
    );
  }

  const guardrailViolationPayload = parsed.data.guardrailViolation
    ? ({
        violated: parsed.data.guardrailViolation.violated,
        notes: parsed.data.guardrailViolation.notes ?? null,
      } as Json)
    : null;

  const basePayload = {
    decision: parsed.data.decision,
    justification: parsed.data.justification ?? null,
    guardrail_violation: guardrailViolationPayload,
    metadata: (parsed.data.metadata ?? {}) as Json,
    reviewer_id: parsed.data.reviewerId ?? null,
  } satisfies Partial<Database['public']['Tables']['approvals']['Insert']>;

  let approvalRow: Pick<Database['public']['Tables']['approvals']['Row'], 'id' | 'decision' | 'decision_at' | 'justification'> | null = null;

  if (existing) {
    const sameReviewer = !existing.reviewer_id || !parsed.data.reviewerId
      ? true
      : existing.reviewer_id === parsed.data.reviewerId;

    if (!sameReviewer && existing.decision !== parsed.data.decision) {
      return NextResponse.json(
        {
          error: 'Approval already recorded by another reviewer',
          existingApproval: {
            decision: existing.decision,
            decisionAt: existing.decision_at,
            reviewerId: existing.reviewer_id,
            justification: existing.justification,
          },
        },
        { status: 409 },
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from<Database['public']['Tables']['approvals']['Row']>('approvals')
      .update(basePayload)
      .eq('id', existing.id)
      .select('id, decision, decision_at, justification')
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        {
          error: 'Failed to update approval decision',
          hint: updateError.message,
        },
        { status: 500 },
      );
    }

    approvalRow = updated ?? null;
  } else {
    const insertPayload: Database['public']['Tables']['approvals']['Insert'] = {
      tenant_id: tenantId,
      tool_call_id: parsed.data.toolCallId,
      reviewer_id: parsed.data.reviewerId ?? null,
      decision: basePayload.decision!,
      justification: basePayload.justification,
      guardrail_violation: basePayload.guardrail_violation ?? null,
      metadata: basePayload.metadata as Json,
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

    approvalRow = data ?? null;
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
      approval: approvalRow,
    },
    { status: 201 },
  );
}
