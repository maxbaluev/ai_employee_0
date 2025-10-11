import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getRouteHandlerSupabaseClient } from '@/lib/supabase/server';

const selectionSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  authType: z.string().optional(),
  category: z.string().optional(),
  logo: z.string().nullable().optional(),
  noAuth: z.boolean(),
});

const requestSchema = z.object({
  missionId: z.string().uuid('Invalid mission ID format'),
  tenantId: z.string().uuid('Invalid tenant ID format').optional(),
  selections: z.array(selectionSchema),
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

    let insertedRows: unknown[] = [];

    if (parsed.data.selections.length > 0) {
      const rows = parsed.data.selections.map((selection) => ({
        tenant_id: tenantId,
        mission_id: parsed.data.missionId,
        selected_tools: [selection] as unknown,
        rationale: null,
      }));

      const { data, error } = await supabase
        .from('toolkit_selections')
        .insert(rows as never)
        .select('id, tenant_id, mission_id, selected_tools, rationale, created_at');

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to persist toolkit selections');
      }

      insertedRows = data;
    }

    return NextResponse.json(
      {
        success: true,
        count: insertedRows.length,
        selections: insertedRows,
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

