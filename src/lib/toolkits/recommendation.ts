import { createHash } from 'crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@supabase/types';
import type { ToolkitSelectionDetail } from '@/lib/toolkits/persistence';

type Supabase = SupabaseClient<Database, 'public'>;

type Json = Database['public']['Tables']['planner_runs']['Row']['metadata'];

type PlannerRunRow = Pick<
  Database['public']['Tables']['planner_runs']['Row'],
  'id' | 'created_at' | 'impact_score' | 'primary_toolkits' | 'reason_markdown' | 'metadata'
>;

type ToolkitSelectionRow = Pick<
  Database['public']['Tables']['toolkit_selections']['Row'],
  'toolkit_id' | 'metadata' | 'auth_mode' | 'connection_status' | 'undo_token'
>;

type ComposioToolkit = {
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  category?: string | null;
  no_auth?: boolean | null;
  auth_schemes?: unknown;
  meta?: {
    description?: string | null;
    logo?: string | null;
    categories?: Array<{ id?: string | null; name?: string | null } | null> | null;
  } | null;
};

export type ToolkitRecommendation = {
  slug: string;
  name: string;
  description: string;
  category: string;
  noAuth: boolean;
  authSchemes: string[];
  logo?: string | null;
  suggestedByPlanner: boolean;
  requiresConnectLink: boolean;
};

export type PlannerSuggestion = {
  runId: string;
  createdAt: string;
  impactScore: number | null;
  reasonMarkdown: string | null;
  primaryToolkits: string[];
  metadata?: Json;
};

export type ToolkitRecommendationResult = {
  toolkits: ToolkitRecommendation[];
  selectionDetails: ToolkitSelectionDetail[];
  plannerSuggestion: PlannerSuggestion | null;
  requestId: string;
};

export type ToolkitRecommendationOptions = {
  supabase: Supabase;
  tenantId: string;
  missionId?: string | null;
  persona?: string | null;
  industry?: string | null;
  fetchImpl?: typeof fetch;
};

const COMPOSIO_TOOLKIT_ENDPOINT = 'https://backend.composio.dev/api/v3/toolkits';

function normaliseToolkit(record: ComposioToolkit): ToolkitRecommendation {
  const meta = record.meta ?? null;
  const rawCategories = Array.isArray(meta?.categories) ? meta?.categories ?? [] : [];
  const resolvedCategory =
    record.category ??
    rawCategories
      .map((candidate) => {
        if (!candidate) return null;
        if (candidate.name && typeof candidate.name === 'string') {
          return candidate.name;
        }
        if (candidate.id && typeof candidate.id === 'string') {
          return candidate.id;
        }
        return null;
      })
      .filter((value): value is string => Boolean(value))
      .shift() ??
    'general';

  const rawAuthSchemes = Array.isArray(record.auth_schemes)
    ? (record.auth_schemes as unknown[])
    : [];
  const authSchemes = rawAuthSchemes.filter((item): item is string => typeof item === 'string');

  const description =
    (typeof meta?.description === 'string' && meta.description.length > 0
      ? meta.description
      : typeof record.description === 'string'
        ? record.description
        : '') ?? '';

  const logo = typeof meta?.logo === 'string' ? meta.logo : null;

  const noAuth = Boolean(record.no_auth);
  const requiresConnectLink = !noAuth;

  return {
    slug: typeof record.slug === 'string' && record.slug.length > 0 ? record.slug : record.name ?? 'unknown',
    name: typeof record.name === 'string' && record.name.length > 0 ? record.name : 'Unknown toolkit',
    description,
    category: resolvedCategory,
    noAuth,
    authSchemes,
    logo,
    suggestedByPlanner: false,
    requiresConnectLink,
  } satisfies ToolkitRecommendation;
}

function deriveRequestId(tenantId: string, missionId: string | null | undefined, toolkits: ToolkitRecommendation[]) {
  return createHash('sha1')
    .update(`${tenantId}|${missionId ?? ''}|${toolkits.map((toolkit) => toolkit.slug).join(',')}`)
    .digest('hex');
}

async function fetchSelectionDetails(
  supabase: Supabase,
  tenantId: string,
  missionId?: string | null,
): Promise<ToolkitSelectionDetail[]> {
  const query = supabase
    .from('toolkit_selections')
    .select('toolkit_id, metadata, auth_mode, connection_status, undo_token')
    .eq('tenant_id', tenantId);

  if (missionId) {
    query.eq('mission_id', missionId);
  }

  const { data, error } = (await query) as {
    data: ToolkitSelectionRow[] | null;
    error: unknown;
  };

  if (error) {
    throw new Error('Failed to load toolkit selections');
  }

  const rows = Array.isArray(data) ? data : [];

  return rows
    .map((row) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const name = typeof metadata.name === 'string' ? metadata.name : undefined;
      const category = typeof metadata.category === 'string' ? metadata.category : undefined;
      const noAuth =
        typeof metadata.noAuth === 'boolean'
          ? metadata.noAuth
          : typeof (metadata as { no_auth?: unknown }).no_auth === 'boolean'
            ? Boolean((metadata as { no_auth?: unknown }).no_auth)
            : undefined;

      const selection: ToolkitSelectionDetail = {
        slug: row.toolkit_id ?? '',
        name: name ?? row.toolkit_id ?? 'unknown',
        category: category ?? 'general',
        authMode: row.auth_mode ?? (noAuth ? 'none' : 'oauth'),
        noAuth: noAuth ?? false,
        undoToken: row.undo_token ?? null,
        connectionStatus: row.connection_status ?? undefined,
      };

      return selection;
    })
    .filter((detail) => detail.slug.length > 0);
}

async function fetchPlannerSuggestion(
  supabase: Supabase,
  tenantId: string,
  missionId?: string | null,
): Promise<PlannerSuggestion | null> {
  if (!missionId) {
    return null;
  }

  const { data, error } = (await supabase
    .from('planner_runs')
    .select('id, created_at, impact_score, primary_toolkits, reason_markdown, metadata')
    .eq('tenant_id', tenantId)
    .eq('mission_id', missionId)
    .order('created_at', { ascending: false })
    .limit(1)) as { data: PlannerRunRow[] | null; error: unknown };

  if (error) {
    throw new Error('Failed to load planner suggestion');
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (!row) {
    return null;
  }

  const primaryToolkits = Array.isArray(row.primary_toolkits)
    ? row.primary_toolkits.filter((slug): slug is string => typeof slug === 'string' && slug.length > 0)
    : [];

  return {
    runId: row.id,
    createdAt: row.created_at,
    impactScore: row.impact_score ?? null,
    reasonMarkdown: row.reason_markdown ?? null,
    primaryToolkits,
    metadata: row.metadata ?? undefined,
  } satisfies PlannerSuggestion;
}

export async function fetchToolkitRecommendations(
  options: ToolkitRecommendationOptions,
): Promise<ToolkitRecommendationResult> {
  const { supabase, tenantId, missionId = null, persona, industry, fetchImpl = fetch } = options;

  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    throw new Error('COMPOSIO_API_KEY is not configured');
  }

  const selectionDetailsPromise = fetchSelectionDetails(supabase, tenantId, missionId);
  const plannerSuggestionPromise = fetchPlannerSuggestion(supabase, tenantId, missionId);

  const endpoint = new URL(COMPOSIO_TOOLKIT_ENDPOINT);
  endpoint.searchParams.set('limit', '24');
  endpoint.searchParams.set('sort_by', 'usage');
  if (persona) {
    endpoint.searchParams.set('persona', persona);
  }
  if (industry) {
    endpoint.searchParams.set('industry', industry);
  }
  if (missionId) {
    endpoint.searchParams.set('mission_id', missionId);
  }

  const response = await fetchImpl(endpoint, {
    headers: {
      'X-API-KEY': apiKey,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch toolkits from Composio (status ${response.status})`);
  }

  const payload = (await response.json().catch(() => ({}))) as {
    items?: ComposioToolkit[];
    data?: ComposioToolkit[];
  };

  const rawToolkits = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.data)
      ? payload.data
      : [];

  const plannerSuggestion = await plannerSuggestionPromise.catch(() => null);
  const plannerToolkitSet = new Set(plannerSuggestion?.primaryToolkits ?? []);

  const toolkits = rawToolkits
    .map((record, index) => {
      const toolkit = normaliseToolkit(record);
      const suggestedByPlanner = plannerToolkitSet.has(toolkit.slug);
      return {
        ...toolkit,
        suggestedByPlanner,
        _index: index,
      };
    })
    .sort((a, b) => {
      if (a.suggestedByPlanner === b.suggestedByPlanner) {
        return a._index - b._index;
      }
      return a.suggestedByPlanner ? -1 : 1;
    })
    .map(({ _index: _ignored, ...toolkit }) => toolkit);

  const selectionDetails = await selectionDetailsPromise;

  const requestId = deriveRequestId(tenantId, missionId, toolkits);

  return {
    toolkits,
    selectionDetails,
    plannerSuggestion,
    requestId,
  } satisfies ToolkitRecommendationResult;
}
