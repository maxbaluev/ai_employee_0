import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireTenantId, TenantResolutionError } from '@/app/api/_shared/tenant';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase/server';

const selectionSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  authType: z.string().optional(),
  category: z.string().optional(),
  logo: z.string().nullable().optional(),
  noAuth: z.boolean().optional(),
});

type ToolkitSelectionRow = {
  id: string;
  tenant_id: string;
  mission_id: string;
  toolkit_id: string;
  auth_mode: string | null;
  connection_status: string;
  undo_token: string | null;
  metadata: Record<string, unknown> | null;
  rationale: string | null;
  created_at: string;
  updated_at: string;
};

const requestSchema = z.object({
  missionId: z.string().uuid('Invalid mission ID format'),
  tenantId: z.string().uuid('Invalid tenant ID format').optional(),
  selections: z.array(selectionSchema),
});

export async function POST(request: NextRequest) {
  const rawBody = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid toolkit selection payload',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    return NextResponse.json(
      {
        error: 'Failed to resolve session context',
        hint: sessionError.message,
      },
      { status: 500 },
    );
  }

  let tenantId: string;
  try {
    tenantId = requireTenantId({
      providedTenantId: parsed.data.tenantId,
      session,
      missingTenantHint: 'Authenticate with Supabase or include tenantId in the request body',
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

  try {
    const { data: missionRow, error: missionError } = await supabase
      .from('objectives')
      .select('id')
      .eq('id', parsed.data.missionId)
      .eq('tenant_id', tenantId)
      .single();

    if (missionError || !missionRow) {
      return NextResponse.json(
        {
          error: 'Mission not found or access denied',
        },
        { status: 404 },
      );
    }

    await supabase
      .from('toolkit_selections')
      .delete()
      .eq('mission_id', parsed.data.missionId)
      .eq('tenant_id', tenantId);

    let insertedRows: ToolkitSelectionRow[] = [];
    const sessionUserId = session?.user?.id ?? null;

    let connectionStatusMap = new Map<string, string>();
    if (parsed.data.selections.length > 0) {
      const { data: existingConnections } = await supabase
        .from('toolkit_connections')
        .select('toolkit, status')
        .eq('tenant_id', tenantId)
        .eq('mission_id', parsed.data.missionId);

      if (Array.isArray(existingConnections)) {
        connectionStatusMap = new Map(
          existingConnections
            .filter((row): row is { toolkit: string; status: string } =>
              typeof row?.toolkit === 'string' && typeof row?.status === 'string',
            )
            .map((row) => [row.toolkit, row.status]),
        );
      }

      const rows = parsed.data.selections.map((selection) => {
        const slug = selection.slug.trim();
        const authMode = selection.noAuth ? 'none' : selection.authType?.toLowerCase() ?? 'oauth';
        const connectionStatus = selection.noAuth
          ? 'not_required'
          : connectionStatusMap.get(slug) ?? 'not_linked';

        const undoToken = randomUUID();

        return {
          tenant_id: tenantId,
          mission_id: parsed.data.missionId,
          toolkit_id: slug,
          auth_mode: authMode,
          connection_status: connectionStatus,
          undo_token: undoToken,
          metadata: {
            name: selection.name,
            category: selection.category ?? null,
            logo: selection.logo ?? null,
            noAuth: selection.noAuth ?? false,
            authType: selection.authType ?? null,
          },
          rationale: null,
          created_by: sessionUserId,
        } as Record<string, unknown>;
      });

      const { data, error } = await supabase
        .from('toolkit_selections')
        .insert(rows as never)
        .select(
          'id, tenant_id, mission_id, toolkit_id, auth_mode, connection_status, undo_token, metadata, rationale, created_at, updated_at',
        );

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to persist toolkit selections');
      }

      insertedRows = data as ToolkitSelectionRow[];
    }

    return NextResponse.json(
      {
        success: true,
        count: insertedRows.length,
        selections: insertedRows.map((row) => ({
          id: row.id,
          tenantId: row.tenant_id,
          missionId: row.mission_id,
          toolkitId: row.toolkit_id,
          authMode: row.auth_mode,
          connectionStatus: row.connection_status,
          undoToken: row.undo_token,
          metadata: row.metadata ?? {},
          rationale: row.rationale,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[api:toolkits/selections] persist failed', error);

    return NextResponse.json(
      {
        error: 'Failed to persist toolkit selections',
        hint: error instanceof Error ? error.message : 'Unknown persistence error',
      },
      { status: 500 },
    );
  }
}
