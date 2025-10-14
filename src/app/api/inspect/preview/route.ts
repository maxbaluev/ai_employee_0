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
        hint: 'Authenticate with Supabase or provide tenantId in request body',
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

type MissionMetadataRow = Pick<
  Database['public']['Tables']['mission_metadata']['Row'],
  'field' | 'accepted_at' | 'value'
>;

type MissionSafeguardRow = Pick<
  Database['public']['Tables']['mission_safeguards']['Row'],
  'hint_type' | 'status' | 'accepted_at'
>;

type PlannerRunRow = Pick<
  Database['public']['Tables']['planner_runs']['Row'],
  'candidate_count' | 'pinned_at' | 'created_at'
>;

type PlayRow = Pick<Database['public']['Tables']['plays']['Row'], 'id' | 'created_at'>;

type ArtifactRow = Pick<Database['public']['Tables']['artifacts']['Row'], 'id' | 'type' | 'status'>;

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

  const [metadataResult, safeguardsResult, plannerRunResult, playsResult] = await Promise.all([
    serviceClient
      .from('mission_metadata')
      .select('field, accepted_at, value')
      .eq('mission_id', missionId)
      .eq('tenant_id', tenantId),
    serviceClient
      .from('mission_safeguards')
      .select('hint_type, status, accepted_at')
      .eq('mission_id', missionId)
      .eq('tenant_id', tenantId),
    serviceClient
      .from('planner_runs')
      .select('candidate_count, pinned_at, created_at')
      .eq('mission_id', missionId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1),
    serviceClient
      .from('plays')
      .select('id, created_at')
      .eq('objective_id', missionId)
      .eq('tenant_id', tenantId),
  ]);

  if (metadataResult.error) {
    console.warn('[api:inspect/preview] failed to load mission metadata', metadataResult.error);
  }

  if (safeguardsResult.error) {
    console.warn('[api:inspect/preview] failed to load mission safeguards', safeguardsResult.error);
  }

  if (plannerRunResult.error) {
    console.warn('[api:inspect/preview] failed to load planner runs', plannerRunResult.error);
  }

  if (playsResult.error) {
    console.warn('[api:inspect/preview] failed to load plays', playsResult.error);
  }

  const plannerRun = plannerRunResult.data?.[0] as PlannerRunRow | undefined;
  const plays = (playsResult.data ?? []) as PlayRow[];

  let artifactRows: ArtifactRow[] = [];
  if (plays.length > 0) {
    const playIds = plays
      .map((entry) => entry.id)
      .filter((value): value is string => Boolean(value));

    if (playIds.length > 0) {
      const artifactResult = await serviceClient
        .from('artifacts')
        .select('id, type, status, play_id')
        .in('play_id', playIds);

      if (artifactResult.error) {
        console.warn('[api:inspect/preview] failed to load artifacts for plays', artifactResult.error);
      } else if (artifactResult.data) {
        artifactRows = (artifactResult.data as ArtifactRow[]) ?? [];
      }
    }
  }

  const computedReadiness = computeReadiness({
    selectedToolkitsCount,
    hasArtifacts,
    providedReadiness,
  });
  const categories = buildInspectionCategories({
    selectedToolkitsCount,
    hasArtifacts,
    readiness: computedReadiness,
    missionMetadata: (metadataResult.data ?? []) as MissionMetadataRow[],
    safeguards: (safeguardsResult.data ?? []) as MissionSafeguardRow[],
    plannerRun: plannerRun ?? null,
    plays,
    toolkits,
    artifacts: artifactRows,
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
  missionMetadata: MissionMetadataRow[];
  safeguards: MissionSafeguardRow[];
  plannerRun: PlannerRunRow | null;
  plays: PlayRow[];
  toolkits: ToolkitPreview[];
  artifacts: ArtifactRow[];
}): InspectionCategory[] {
  const {
    selectedToolkitsCount,
    hasArtifacts,
    readiness,
    missionMetadata,
    safeguards,
    plannerRun,
    plays,
    toolkits,
    artifacts,
  } = options;

  const objectivesCoverage = calculateObjectivesCoverage(missionMetadata);
  const safeguardsCoverage = calculateSafeguardsCoverage(safeguards);
  const playsCoverage = calculatePlaysCoverage({ plannerRun, plays });
  const datasetsCoverage = calculateDatasetsCoverage({ toolkits, artifacts, hasArtifacts });

  const categories: InspectionCategory[] = [
    {
      id: 'objectives',
      label: 'Objectives & KPIs',
      coverage: objectivesCoverage,
      threshold: 85,
      status: resolveStatus(objectivesCoverage, 85),
      description:
        objectivesCoverage >= 85
          ? 'Objective, audience, and KPIs accepted.'
          : 'Accept objective, audience, and KPI chips to lock the brief.',
    },
    {
      id: 'safeguards',
      label: 'Safeguards',
      coverage: safeguardsCoverage,
      threshold: 80,
      status: resolveStatus(safeguardsCoverage, 80),
      description:
        safeguardsCoverage >= 80
          ? 'Safeguard guardrails approved for this mission.'
          : 'Accept at least one safeguard hint before proceeding.',
    },
    {
      id: 'plays',
      label: 'Planner Plays',
      coverage: playsCoverage,
      threshold: 80,
      status: resolveStatus(playsCoverage, 80),
      description:
        playsCoverage >= 80
          ? 'Planner run pinned with viable plays.'
          : 'Generate a planner dry-run and pin a play to reach gate readiness.',
    },
    {
      id: 'datasets',
      label: 'Datasets & Evidence',
      coverage: datasetsCoverage,
      threshold: 70,
      status: resolveStatus(datasetsCoverage, 70),
      description:
        datasetsCoverage >= 70
          ? 'Evidence artifacts and data sources linked.'
          : 'Attach datasets or evidence artifacts before executing the plan.',
    },
  ];

  // Legacy fallback for older inspection findings that still rely on toolkit/evidence IDs.
  if (!categories.some((category) => category.id === 'objectives')) {
    const toolkitCoverage = Math.max(0, Math.min(100, selectedToolkitsCount >= 3 ? 100 : selectedToolkitsCount === 2 ? 88 : selectedToolkitsCount === 1 ? 72 : 25));
    const evidenceCoverage = hasArtifacts ? 80 : 30;

    categories.push(
      {
        id: 'toolkits',
        label: 'Toolkit coverage',
        coverage: toolkitCoverage,
        threshold: 85,
        status: resolveStatus(toolkitCoverage, 85),
        description:
          selectedToolkitsCount > 0
            ? 'Recommended toolkit mix locked in.'
            : 'Select at least one mission toolkit before planning.',
      },
      {
        id: 'evidence',
        label: 'Evidence history',
        coverage: evidenceCoverage,
        threshold: 70,
        status: resolveStatus(evidenceCoverage, 70),
        description: hasArtifacts
          ? 'Previous artifacts available for validator review.'
          : 'Run a dry-run to generate evidence before planning.',
      },
    );
  }

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

function calculateObjectivesCoverage(rows: MissionMetadataRow[]): number {
  const EXPECTED_FIELDS: Array<{ key: string; weight: number }> = [
    { key: 'objective', weight: 1 },
    { key: 'audience', weight: 1 },
    { key: 'kpis', weight: 1 },
  ];

  const totalWeight = EXPECTED_FIELDS.reduce((acc, entry) => acc + entry.weight, 0);
  let score = 0;

  for (const entry of EXPECTED_FIELDS) {
    const row = rows.find((candidate) => candidate.field === entry.key);
    if (!row) {
      continue;
    }

    if (row.accepted_at) {
      score += entry.weight;
      continue;
    }

    const hasValue = entry.key === 'kpis' ? hasKpiItems(row.value) : hasTextValue(row.value);
    if (hasValue) {
      score += entry.weight * 0.5;
    }
  }

  return clampPercentage((score / totalWeight) * 100, 0);
}

function calculateSafeguardsCoverage(rows: MissionSafeguardRow[]): number {
  if (!rows.length) {
    return 0;
  }

  const accepted = rows.filter((row) => row.status === 'accepted').length;
  const suggested = rows.filter((row) => row.status === 'suggested').length;
  const total = rows.length;

  if (accepted === 0 && suggested === 0) {
    return 0;
  }

  const baseScore = (accepted / total) * 100;
  const bonus = accepted > 0 && suggested > 0 ? 10 : 0;

  return clampPercentage(baseScore + bonus, 0);
}

function calculatePlaysCoverage(options: { plannerRun: PlannerRunRow | null; plays: PlayRow[] }): number {
  const { plannerRun, plays } = options;

  if (!plannerRun && plays.length === 0) {
    return 0;
  }

  if (plannerRun?.pinned_at) {
    return 100;
  }

  let score = 0;
  const candidateCount = plannerRun?.candidate_count ?? 0;

  if (candidateCount >= 3) {
    score += 60;
  } else if (candidateCount > 0) {
    score += 45;
  }

  const playContribution = Math.min(40, plays.length * 20);
  score += playContribution;

  return clampPercentage(score, 0);
}

const DATASET_CATEGORY_KEYWORDS = new Set([
  'data',
  'dataset',
  'analytics',
  'warehouse',
  'storage',
  'database',
  'bi',
]);

const DATASET_ARTIFACT_TYPES = new Set(['dataset', 'data_source', 'data', 'report']);

function calculateDatasetsCoverage(options: {
  toolkits: ToolkitPreview[];
  artifacts: ArtifactRow[];
  hasArtifacts: boolean;
}): number {
  const { toolkits, artifacts, hasArtifacts } = options;

  const datasetToolkitCount = toolkits.filter((toolkit) => {
    const category = toolkit.category?.toLowerCase?.() ?? '';
    return Array.from(DATASET_CATEGORY_KEYWORDS).some((keyword) => category.includes(keyword));
  }).length;

  const datasetArtifactCount = artifacts.filter((artifact) => {
    const type = artifact.type?.toLowerCase?.() ?? '';
    return DATASET_ARTIFACT_TYPES.has(type);
  }).length;

  let score = 0;

  if (datasetToolkitCount > 0) {
    score += Math.min(50, datasetToolkitCount * 25);
  }

  if (datasetArtifactCount > 0) {
    score += Math.min(40, datasetArtifactCount * 20);
  }

  if (hasArtifacts) {
    score += 10;
  }

  return clampPercentage(score, 0);
}

function hasTextValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (!value || typeof value !== 'object') {
    return false;
  }

  if ('text' in value && typeof (value as Record<string, unknown>).text === 'string') {
    return ((value as Record<string, string>).text ?? '').trim().length > 0;
  }

  return false;
}

function hasKpiItems(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const container = Array.isArray(value)
    ? value
    : 'items' in value
      ? (value as Record<string, unknown>).items
      : [];

  if (!Array.isArray(container)) {
    return false;
  }

  return container.some((item) => item && typeof item === 'object' && typeof (item as Record<string, unknown>).label === 'string');
}

function clampPercentage(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.min(100, numeric));
  }
  return fallback;
}
