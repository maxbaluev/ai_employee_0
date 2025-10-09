import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logTelemetryEvent } from '@/lib/intake/service';

const payloadSchema = z.object({
  tenantId: z.string().uuid().optional(),
  missionId: z.string().uuid().optional(),
  toolCallId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid undo payload',
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

  try {
    await logTelemetryEvent({
      tenantId,
      missionId: parsed.data.missionId,
      eventName: 'undo_requested',
      eventData: {
        tool_call_id: parsed.data.toolCallId,
        reason: parsed.data.reason ?? null,
      },
    });

    await logTelemetryEvent({
      tenantId,
      missionId: parsed.data.missionId,
      eventName: 'undo_completed',
      eventData: {
        tool_call_id: parsed.data.toolCallId,
        success: true,
        mode: 'dry_run_stub',
      },
    });

    return NextResponse.json(
      {
        status: 'completed',
        message: 'Undo executed (dry-run stub).',
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[api:undo] failed to persist telemetry', error);
    return NextResponse.json(
      {
        error: 'Failed to record undo telemetry',
      },
      { status: 500 },
    );
  }
}
