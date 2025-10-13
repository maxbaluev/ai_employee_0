import { randomUUID } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireTenantId, TenantResolutionError } from '@/app/api/_shared/tenant';
import { logTelemetryEvent } from '@/lib/intake/service';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase/server';

const connectionStatusSchema = z.enum([
  'pending',
  'linked',
  'failed',
  'revoked',
  'not_linked',
  'not_required',
]);

const postSchema = z.object({
  tenantId: z.string().uuid('tenantId must be a UUID'),
  missionId: z.string().uuid('missionId must be a UUID').nullable().optional(),
  toolkit: z.string().min(1, 'toolkit slug is required'),
  connectionId: z.string().min(1).optional(),
  status: connectionStatusSchema,
  authMode: z.string().min(1).nullable().optional(),
  metadata: z.record(z.any()).optional(),
});

type ConnectionRow = {
  id: string;
  tenant_id: string;
  mission_id: string | null;
  toolkit: string;
  connection_id: string;
  status: string;
  auth_mode: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function sanitizeUuid(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return /^[0-9a-fA-F-]{36}$/.test(value) ? value : null;
}

function mapRow(row: ConnectionRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    missionId: row.mission_id,
    toolkit: row.toolkit,
    connectionId: row.connection_id,
    status: row.status,
    authMode: row.auth_mode,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const searchParams = request.nextUrl.searchParams;
  const providedTenantId = searchParams.get('tenantId') ?? undefined;

  let tenantId: string;
  try {
    tenantId = requireTenantId({
      providedTenantId,
      session,
      missingTenantHint: 'Authenticate or pass tenantId to query connection statuses.',
    });
  } catch (error) {
    if (error instanceof TenantResolutionError) {
      const body: { error: string; hint?: string } = { error: error.message };
      if (error.hint) {
        body.hint = error.hint;
      }
      return NextResponse.json(body, { status: error.status });
    }
    throw error;
  }

  const missionId = sanitizeUuid(searchParams.get('missionId'));
  const toolkitSlug = searchParams.get('toolkit');

  let query = supabase
    .from('toolkit_connections')
    .select(
      'id, tenant_id, mission_id, toolkit, connection_id, status, auth_mode, metadata, created_at, updated_at',
    )
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false });

  if (missionId) {
    query = query.eq('mission_id', missionId);
  }

  if (toolkitSlug) {
    query = query.eq('toolkit', toolkitSlug);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[api:toolkits/connections] fetch failed', error);
    return NextResponse.json(
      {
        error: 'Failed to load toolkit connection statuses',
        hint: error.message,
      },
      { status: 500 },
    );
  }

  const rows = Array.isArray(data) ? (data as ConnectionRow[]) : [];

  return NextResponse.json({
    connections: rows.map(mapRow),
  });
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid toolkit connection payload',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let tenantId: string;
  try {
    tenantId = requireTenantId({
      providedTenantId: parsed.data.tenantId,
      session,
      missingTenantHint: 'Authenticate or provide tenantId to update connection status.',
    });
  } catch (error) {
    if (error instanceof TenantResolutionError) {
      const body: { error: string; hint?: string } = { error: error.message };
      if (error.hint) {
        body.hint = error.hint;
      }
      return NextResponse.json(body, { status: error.status });
    }
    throw error;
  }

  const missionId = parsed.data.missionId ?? null;
  const connectionId = parsed.data.connectionId ?? `pending:${randomUUID()}`;
  const status = parsed.data.status;

  const upsertPayload = {
    tenant_id: tenantId,
    mission_id: missionId,
    toolkit: parsed.data.toolkit,
    connection_id: connectionId,
    status,
    auth_mode: parsed.data.authMode ?? null,
    metadata: parsed.data.metadata ?? {},
  } as Record<string, unknown>;

  const { data, error } = await supabase
    .from('toolkit_connections')
    .upsert(upsertPayload as never, { onConflict: 'tenant_id,mission_id,toolkit' })
    .select(
      'id, tenant_id, mission_id, toolkit, connection_id, status, auth_mode, metadata, created_at, updated_at',
    )
    .maybeSingle();

  if (error) {
    console.error('[api:toolkits/connections] upsert failed', error);
    return NextResponse.json(
      {
        error: 'Failed to update connection status',
        hint: error.message,
      },
      { status: 500 },
    );
  }

  if (missionId) {
    const { error: selectionError } = await supabase
      .from('toolkit_selections')
      .update({ connection_status: status })
      .eq('tenant_id', tenantId)
      .eq('mission_id', missionId)
      .eq('toolkit_id', parsed.data.toolkit);

    if (selectionError) {
      console.warn('[api:toolkits/connections] failed to sync selection status', selectionError);
    }
  }

  try {
    await logTelemetryEvent({
      tenantId,
      missionId: missionId ?? undefined,
      eventName: 'toolkit_connection_status_updated',
      eventData: {
        toolkit_slug: parsed.data.toolkit,
        status,
        connection_id: connectionId,
      },
    });
  } catch (telemetryError) {
    console.warn('[api:toolkits/connections] telemetry failed', telemetryError);
  }

  const row = data as ConnectionRow | null;
  if (!row) {
    return NextResponse.json(
      {
        error: 'Connection status not found after update',
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ connection: mapRow(row) });
}
