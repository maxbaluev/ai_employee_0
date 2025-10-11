import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { emitMissionEvent, emitSafeguardEvent } from '@/lib/telemetry/server';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import type { Database, Json } from '@supabase/types';

type SupabaseClient = ReturnType<typeof getServiceSupabaseClient>;
type MissionSafeguardRow = Database['public']['Tables']['mission_safeguards']['Row'];
type MissionSafeguardUpdate = Database['public']['Tables']['mission_safeguards']['Update'];

const acceptAllSchema = z.object({
  action: z.literal('accept_all'),
  hintIds: z.array(z.string().uuid()).optional(),
});

const acceptSchema = z.object({
  action: z.literal('accept'),
  hintId: z.string().uuid(),
});

const editSchema = z.object({
  action: z.literal('edit'),
  hintId: z.string().uuid(),
  text: z.string().trim().min(1).max(2000),
});

const regenerateSchema = z.object({
  action: z.literal('regenerate'),
  hintId: z.string().uuid(),
});

const togglePinSchema = z.object({
  action: z.literal('toggle_pin'),
  hintId: z.string().uuid(),
  pinned: z.boolean(),
});

const actionSchema = z.discriminatedUnion('action', [
  acceptAllSchema,
  acceptSchema,
  editSchema,
  regenerateSchema,
  togglePinSchema,
]);

const payloadSchema = z
  .object({
    tenantId: z.string().uuid().optional(),
    missionId: z.string().uuid(),
  })
  .and(actionSchema);

type SafeguardPayload = z.infer<typeof payloadSchema>;

type MutationResult = {
  ids: string[];
  metadata?: Record<string, unknown>;
};

class SafeguardNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SafeguardNotFoundError';
  }
}

class SafeguardOperationError extends Error {
  constructor(message: string, public readonly hint?: string) {
    super(message);
    this.name = 'SafeguardOperationError';
  }
}

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid safeguard payload',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const tenantId = resolveTenant(parsed.data.tenantId);
  if (!tenantId) {
    return NextResponse.json(
      {
        error: 'Missing tenant context',
        hint: 'Provide tenantId or configure GATE_GA_DEFAULT_TENANT_ID',
      },
      { status: 400 },
    );
  }

  const supabase = getServiceSupabaseClient();
  const missionId = parsed.data.missionId;

  try {
    const mutation = await executeSafeguardAction(supabase, tenantId, missionId, parsed.data);

    await emitTelemetry(tenantId, missionId, parsed.data, mutation);

    return NextResponse.json(
      {
        success: true,
        hintIds: mutation.ids,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof SafeguardNotFoundError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 404 },
      );
    }

    if (error instanceof SafeguardOperationError) {
      return NextResponse.json(
        {
          error: error.message,
          hint: error.hint,
        },
        { status: 500 },
      );
    }

    console.error('[api:safeguards] mutation failed', error);

    return NextResponse.json(
      {
        error: 'Failed to process safeguard action',
        hint: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

function resolveTenant(tenantId?: string): string | null {
  if (tenantId) {
    return tenantId;
  }
  if (process.env.GATE_GA_DEFAULT_TENANT_ID) {
    return process.env.GATE_GA_DEFAULT_TENANT_ID;
  }
  return null;
}

async function executeSafeguardAction(
  supabase: SupabaseClient,
  tenantId: string,
  missionId: string,
  payload: SafeguardPayload,
): Promise<MutationResult> {
  switch (payload.action) {
    case 'accept_all':
      return handleAcceptAll(supabase, tenantId, missionId, payload.hintIds ?? []);
    case 'accept':
      return handleAccept(supabase, tenantId, missionId, payload.hintId);
    case 'edit':
      return handleEdit(supabase, tenantId, missionId, payload.hintId, payload.text);
    case 'regenerate':
      return handleRegenerate(supabase, tenantId, missionId, payload.hintId);
    case 'toggle_pin':
      return handleTogglePin(supabase, tenantId, missionId, payload.hintId, payload.pinned);
    default:
      throw new SafeguardOperationError('Unsupported safeguard action');
  }
}

async function handleAcceptAll(
  supabase: SupabaseClient,
  tenantId: string,
  missionId: string,
  candidateIds: string[],
): Promise<MutationResult> {
  const ids = await resolveTargetIds(supabase, tenantId, missionId, candidateIds);
  if (ids.length === 0) {
    throw new SafeguardNotFoundError('No safeguards available to accept');
  }

  const update: MissionSafeguardUpdate = {
    status: 'accepted',
    accepted_at: new Date().toISOString(),
  };

  const updatedIds = await updateSafeguards(supabase, tenantId, missionId, ids, update);

  return {
    ids: updatedIds,
    metadata: { hint_count: updatedIds.length },
  };
}

async function handleAccept(
  supabase: SupabaseClient,
  tenantId: string,
  missionId: string,
  hintId: string,
): Promise<MutationResult> {
  const ids = await resolveTargetIds(supabase, tenantId, missionId, [hintId]);
  const update: MissionSafeguardUpdate = {
    status: 'accepted',
    accepted_at: new Date().toISOString(),
  };

  const updatedIds = await updateSafeguards(supabase, tenantId, missionId, ids, update);

  return { ids: updatedIds };
}

async function handleEdit(
  supabase: SupabaseClient,
  tenantId: string,
  missionId: string,
  hintId: string,
  text: string,
): Promise<MutationResult> {
  const existing = await fetchSafeguard(supabase, tenantId, missionId, hintId);
  const suggestedValue = normalizeSuggestedValue(existing?.suggested_value);
  suggestedValue.text = text;

  const update: MissionSafeguardUpdate = {
    suggested_value: suggestedValue as Json,
    status: 'edited',
    accepted_at: new Date().toISOString(),
  };

  const updatedIds = await updateSafeguards(supabase, tenantId, missionId, [hintId], update);

  return {
    ids: updatedIds,
    metadata: { text_length: text.length },
  };
}

async function handleRegenerate(
  supabase: SupabaseClient,
  tenantId: string,
  missionId: string,
  hintId: string,
): Promise<MutationResult> {
  const existing = await fetchSafeguard(supabase, tenantId, missionId, hintId);
  const nextGeneration = (existing?.generation_count ?? 0) + 1;

  const update: MissionSafeguardUpdate = {
    generation_count: nextGeneration,
    status: 'suggested',
    accepted_at: null,
  };

  const updatedIds = await updateSafeguards(supabase, tenantId, missionId, [hintId], update);

  return {
    ids: updatedIds,
    metadata: { generation_count: nextGeneration },
  };
}

async function handleTogglePin(
  supabase: SupabaseClient,
  tenantId: string,
  missionId: string,
  hintId: string,
  pinned: boolean,
): Promise<MutationResult> {
  const existing = await fetchSafeguard(supabase, tenantId, missionId, hintId);
  const suggestedValue = normalizeSuggestedValue(existing?.suggested_value);
  suggestedValue.pinned = pinned;

  const update: MissionSafeguardUpdate = {
    suggested_value: suggestedValue as Json,
  };

  const updatedIds = await updateSafeguards(supabase, tenantId, missionId, [hintId], update);

  return {
    ids: updatedIds,
    metadata: { pinned },
  };
}

async function resolveTargetIds(
  supabase: SupabaseClient,
  tenantId: string,
  missionId: string,
  candidateIds: string[],
): Promise<string[]> {
  if (candidateIds.length === 0) {
    const { data, error } = await supabase
      .from('mission_safeguards')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('mission_id', missionId);

    if (error) {
      throw new SafeguardOperationError('Failed to resolve safeguard targets', error.message);
    }

    return (data ?? []).map((row) => row.id);
  }

  const { data, error } = await supabase
    .from('mission_safeguards')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('mission_id', missionId)
    .in('id', candidateIds);

  if (error) {
    throw new SafeguardOperationError('Failed to resolve safeguard targets', error.message);
  }

  const resolvedIds = (data ?? []).map((row) => row.id);
  const missing = candidateIds.filter((id) => !resolvedIds.includes(id));

  if (missing.length > 0) {
    throw new SafeguardNotFoundError(`Unknown safeguard ids: ${missing.join(', ')}`);
  }

  return resolvedIds;
}

async function updateSafeguards(
  supabase: SupabaseClient,
  tenantId: string,
  missionId: string,
  ids: string[],
  update: MissionSafeguardUpdate,
): Promise<string[]> {
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('mission_safeguards')
    .update(update as never)
    .eq('tenant_id', tenantId)
    .eq('mission_id', missionId)
    .in('id', ids)
    .select('id');

  if (error) {
    throw new SafeguardOperationError('Failed to update safeguards', error.message);
  }

  const updated = (data ?? []).map((row) => row.id);
  if (updated.length === 0) {
    throw new SafeguardNotFoundError('Safeguards not found for update');
  }

  return updated;
}

async function fetchSafeguard(
  supabase: SupabaseClient,
  tenantId: string,
  missionId: string,
  hintId: string,
): Promise<MissionSafeguardRow | null> {
  const { data, error } = await supabase
    .from('mission_safeguards')
    .select('id, suggested_value, generation_count')
    .eq('tenant_id', tenantId)
    .eq('mission_id', missionId)
    .eq('id', hintId)
    .maybeSingle();

  if (error) {
    throw new SafeguardOperationError('Failed to fetch safeguard', error.message);
  }

  if (!data) {
    throw new SafeguardNotFoundError(`Safeguard ${hintId} not found`);
  }

  return data;
}

function normalizeSuggestedValue(value: MissionSafeguardRow['suggested_value']): Record<string, unknown> {
  if (value && typeof value === 'object') {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

async function emitTelemetry(
  tenantId: string,
  missionId: string,
  payload: SafeguardPayload,
  mutation: MutationResult,
): Promise<void> {
  if (mutation.ids.length === 0) {
    return;
  }

  const details = {
    hint_ids: mutation.ids,
    hint_count: mutation.ids.length,
    ...(mutation.metadata ?? {}),
  };

  const eventType = resolveSafeguardEventType(payload);

  try {
    await Promise.all([
      emitSafeguardEvent({
        tenantId,
        missionId,
        eventType,
        details,
      }),
      emitMissionEvent({
        tenantId,
        missionId,
        eventName: 'safeguard_modified',
        eventPayload: {
          action: payload.action,
          ...details,
        },
      }),
    ]);
  } catch (error) {
    console.warn('[api:safeguards] telemetry emission failed', error);
  }
}

function resolveSafeguardEventType(payload: SafeguardPayload): string {
  switch (payload.action) {
    case 'accept_all':
      return 'safeguard_hint_accept_all';
    case 'accept':
      return 'safeguard_hint_applied';
    case 'edit':
      return 'safeguard_hint_edited';
    case 'regenerate':
      return 'safeguard_hint_regenerated';
    case 'toggle_pin':
      return 'safeguard_hint_toggle_pin';
    default:
      return 'safeguard_hint_unknown';
  }
}
