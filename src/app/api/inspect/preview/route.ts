import crypto from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getRouteHandlerSupabaseClient } from '@/lib/supabase/server';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import type { Database } from '@supabase/types';

const payloadSchema = z.object({
  missionId: z.string().uuid('Invalid mission ID format'),
  tenantId: z.string().uuid('Invalid tenant ID format').optional(),
  findingType: z.string().trim().optional(),
  payload: z.record(z.unknown()).optional(),
  readiness: z.number().int().min(0).max(100).optional(),
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
        error: 'Invalid inspection preview payload',
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

  const serviceClient = getServiceSupabaseClient();

  try {
    const preview = await buildInspectionPreview({
      serviceClient,
      tenantId,
      missionId: parsed.data.missionId,
      payload: parsed.data.payload ?? undefined,
      providedReadiness: parsed.data.readiness ?? undefined,
      findingType: parsed.data.findingType ?? 'coverage_preview',
    });

    return NextResponse.json(preview, { status: 200 });
  } catch (error) {
    console.error('[api:inspect/preview] preview failed', error);

    return NextResponse.json(
      {
        error: 'Failed to generate inspection preview',
        hint: error instanceof Error ? error.message : 'Unknown preview error',
      },
      { status: 500 },
    );
  }
}

type ServiceClient = ReturnType<typeof getServiceSupabaseClient>;

type PreviewRequestContext = {
  serviceClient: ServiceClient;
  tenantId: string;
  missionId: string;
  payload?: Record<string, unknown>;
  providedReadiness?: number;
  findingType: string;
};

type ToolkitSelectionRow = {
  toolkit_id: string;
  metadata: Record<string, unknown> | null;
  auth_mode: string | null;
  connection_status: string;
};

type ToolkitPreview = {
  slug: string;
  name: string;
  authType: string;
  category: string;
  noAuth: boolean;
  sampleCount: number;
  sampleRows: string[];
};

type InspectionCategory = {
  id: string;
  label: string;
  coverage: number;
  threshold: number;
  status: 'pass' | 'warn' | 'fail';
  description?: string;
};

type GateSummary = {
  threshold: number;
  canProceed: boolean;
  reason: string;
  overrideAvailable: boolean;
};

type PreviewResponse = {
  readiness: number;
  canProceed: boolean;
  categories: InspectionCategory[];
  gate: GateSummary;
  summary: string;
  toolkits: ToolkitPreview[];
  findingId: string;
  findingCreatedAt: string;
};

async function buildInspectionPreview(context: PreviewRequestContext): Promise<PreviewResponse> {
  const { serviceClient, tenantId, missionId, payload, providedReadiness, findingType } = context;

  const { data: toolkitRows, error: toolkitError } = await serviceClient
    .from('toolkit_selections')
    .select('toolkit_id, metadata, auth_mode, connection_status')
    .eq('tenant_id', tenantId)
    .eq('mission_id', missionId)
    .order('created_at', { ascending: false });

  if (toolkitError) {
    throw new Error(toolkitError.message);
  }

  const toolkits = ((toolkitRows ?? []) as ToolkitSelectionRow[])
    .map(normalizeToolkitPreview)
    .filter((preview): preview is ToolkitPreview => preview !== null);

  const selectedToolkitsCount = toolkits.length || extractNumeric(payload?.selectedToolkitsCount);
  const hasArtifacts = Boolean(payload?.hasArtifacts);

  const computedReadiness = computeReadiness({
    selectedToolkitsCount,
    hasArtifacts,
    providedReadiness,
  });
  const categories = buildInspectionCategories({
    selectedToolkitsCount,
    hasArtifacts,
    readiness: computedReadiness,
  });

  const gate = buildGateSummary({
    readiness: computedReadiness,
    threshold: 85,
    categories,
  });

  const summary = toolkits.length
    ? `${toolkits.length} toolkit${toolkits.length === 1 ? '' : 's'} ready (${toolkits
        .slice(0, 3)
        .map((tool) => tool.name)
        .join(', ')}${toolkits.length > 3 ? ', …' : ''})`
    : 'Add recommended toolkits to improve inspection readiness.';

  const findingInsert: Database['public']['Tables']['inspection_findings']['Insert'] = {
    tenant_id: tenantId,
    mission_id: missionId,
    finding_type: findingType,
    payload: {
      summary,
      toolkits,
      hasArtifacts,
      selectedToolkitsCount,
      categories,
      gate,
    } as unknown as Database['public']['Tables']['inspection_findings']['Insert']['payload'],
    readiness: computedReadiness,
  };

  const { data: finding, error: findingError } = await serviceClient
    .from('inspection_findings')
    .insert(findingInsert)
    .select('id, created_at')
    .single();

  if (findingError || !finding) {
    throw new Error(findingError?.message ?? 'Failed to persist inspection finding');
  }

  return {
    readiness: computedReadiness,
    canProceed: gate.canProceed,
    categories,
    gate,
    summary,
    toolkits,
    findingId: finding.id,
    findingCreatedAt: finding.created_at,
  };
}

function normalizeToolkitPreview(entry: ToolkitSelectionRow): ToolkitPreview | null {
  const slug = typeof entry.toolkit_id === 'string' ? entry.toolkit_id.trim() : '';
  if (!slug) {
    return null;
  }

  const metadata = entry.metadata ?? {};
  const rawName = typeof metadata.name === 'string' && metadata.name.trim() ? metadata.name.trim() : null;
  const name = rawName ?? slug;
  const rawAuthType = typeof metadata.authType === 'string' && metadata.authType.trim()
    ? metadata.authType.trim()
    : entry.auth_mode ?? 'oauth';
  const category = typeof metadata.category === 'string' && metadata.category?.trim()
    ? metadata.category.trim()
    : 'general';
  const noAuthFlag = typeof metadata.noAuth === 'boolean' ? metadata.noAuth : entry.auth_mode === 'none';
  const noAuth = Boolean(noAuthFlag || entry.connection_status === 'not_required');
  const authType = noAuth ? 'none' : rawAuthType ?? 'oauth';

  const sampleCount = deriveSampleCount(slug);
  const sampleRows = Array.from({ length: sampleCount }, (_, index) =>
    `${name} preview ${index + 1}`,
  );

  return {
    slug,
    name,
    authType: noAuth ? 'none' : authType,
    category,
    noAuth,
    sampleCount,
    sampleRows,
  };
}

function deriveSampleCount(slug: string): number {
  const digest = crypto.createHash('sha1').update(slug).digest('hex');
  return 2 + (parseInt(digest.slice(0, 2), 16) % 3);
}

function extractNumeric(value: unknown): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return 0;
}

function computeReadiness(options: {
  selectedToolkitsCount: number;
  hasArtifacts: boolean;
  providedReadiness?: number;
}): number {
  const { selectedToolkitsCount, hasArtifacts, providedReadiness } = options;

  if (typeof providedReadiness === 'number' && providedReadiness >= 0 && providedReadiness <= 100) {
    return providedReadiness;
  }

  const base = selectedToolkitsCount > 0 ? 55 : 40;
  const toolkitBonus = Math.min(35, Math.max(0, selectedToolkitsCount - 1) * 12 + 15);
  const artifactBonus = hasArtifacts ? 15 : 0;
  return Math.max(0, Math.min(100, base + toolkitBonus + artifactBonus));
}

function buildInspectionCategories(options: {
  selectedToolkitsCount: number;
  hasArtifacts: boolean;
  readiness: number;
}): InspectionCategory[] {
  const { selectedToolkitsCount, hasArtifacts, readiness } = options;

  const toolkitCoverage = Math.max(0, Math.min(100, selectedToolkitsCount >= 3 ? 100 : selectedToolkitsCount === 2 ? 88 : selectedToolkitsCount === 1 ? 72 : 25));
  const toolkitThreshold = 85;

  const evidenceCoverage = hasArtifacts ? 80 : 30;
  const evidenceThreshold = 70;

  const categories: InspectionCategory[] = [
    {
      id: 'toolkits',
      label: 'Toolkit coverage',
      coverage: toolkitCoverage,
      threshold: toolkitThreshold,
      status: resolveStatus(toolkitCoverage, toolkitThreshold),
      description:
        selectedToolkitsCount > 0
          ? 'Recommended toolkit mix locked in.'
          : 'Select at least one mission toolkit before planning.',
    },
    {
      id: 'evidence',
      label: 'Evidence history',
      coverage: evidenceCoverage,
      threshold: evidenceThreshold,
      status: resolveStatus(evidenceCoverage, evidenceThreshold),
      description: hasArtifacts
        ? 'Previous artifacts available for validator review.'
        : 'Run a dry-run to generate evidence before planning.',
    },
    {
      id: 'readiness',
      label: 'Overall readiness',
      coverage: readiness,
      threshold: 85,
      status: resolveStatus(readiness, 85),
    },
  ];

  return categories;
}

function buildGateSummary(options: {
  readiness: number;
  threshold: number;
  categories: InspectionCategory[];
}): GateSummary {
  const { readiness, threshold, categories } = options;
  const canProceed = readiness >= threshold;
  const reason = canProceed
    ? 'Inspection readiness meets threshold.'
    : 'Coverage below inspection requirement.';

  const overrideAvailable = !canProceed;

  return {
    threshold,
    canProceed,
    reason,
    overrideAvailable,
  };
}

function resolveStatus(coverage: number, threshold: number): InspectionCategory['status'] {
  if (coverage >= threshold) {
    return 'pass';
  }
  if (coverage >= threshold * 0.6) {
    return 'warn';
  }
  return 'fail';
}
