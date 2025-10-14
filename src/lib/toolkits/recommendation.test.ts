import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '@supabase/types';

import { fetchToolkitRecommendations } from './recommendation';

type SelectionRow = Database['public']['Tables']['toolkit_selections']['Row'];
type PlannerRow = Database['public']['Tables']['planner_runs']['Row'];

const originalEnv = { ...process.env };

afterAll(() => {
  process.env = originalEnv;
});

function createSelectionBuilder(rows: SelectionRow[] | null) {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: (resolve: (payload: { data: SelectionRow[] | null; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: rows, error: null })),
  };

  return builder;
}

function createPlannerBuilder(rows: PlannerRow[] | null) {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: (payload: { data: PlannerRow[] | null; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: rows, error: null })),
  };

  return builder;
}

describe('fetchToolkitRecommendations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv, COMPOSIO_API_KEY: 'test-key' };
  });

  it('returns merged toolkit recommendations with planner suggestion and selections', async () => {
    const selectionRows: SelectionRow[] = [
      {
        id: 'sel-1',
        tenant_id: 'a6e5dcf4-7db8-4b83-8fe1-54ab3f3e5a34',
        mission_id: '5bc564ff-0f9f-4d3c-849b-1a9052d2a2a5',
        toolkit_id: 'github',
        auth_mode: 'oauth',
        connection_status: 'linked',
        metadata: { name: 'GitHub', category: 'devtools' },
        undo_token: 'undo-123',
        created_at: '2025-10-13T12:00:00Z',
        updated_at: '2025-10-13T12:00:00Z',
      },
    ];

    const plannerRows: PlannerRow[] = [
      {
        id: 'planner-1',
        tenant_id: 'a6e5dcf4-7db8-4b83-8fe1-54ab3f3e5a34',
        mission_id: '5bc564ff-0f9f-4d3c-849b-1a9052d2a2a5',
        created_at: '2025-10-13T12:01:00Z',
        updated_at: '2025-10-13T12:01:00Z',
        impact_score: 0.84,
        reason_markdown: 'Use GitHub to manage issues.',
        metadata: { rank: 1 },
        primary_toolkits: ['github'],
        candidate_count: 3,
        embedding_similarity_avg: null,
        latency_ms: 1200,
        mode: 'dry-run',
        pinned_at: null,
      },
    ];

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'toolkit_selections') {
          return createSelectionBuilder(selectionRows);
        }
        if (table === 'planner_runs') {
          return createPlannerBuilder(plannerRows);
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            name: 'GitHub',
            slug: 'github',
            description: 'Manage repositories and issues.',
            category: 'devtools',
            no_auth: false,
            auth_schemes: ['oauth'],
            meta: {
              description: 'Developer tooling',
              logo: 'https://example.com/github.png',
              categories: [{ id: 'devtools', name: 'Developer Tools' }],
            },
          },
          {
            name: 'Slack',
            slug: 'slack',
            description: 'Team collaboration platform.',
            category: 'communications',
            no_auth: true,
            auth_schemes: [],
            meta: {
              description: 'Messaging',
              logo: 'https://example.com/slack.png',
              categories: [{ name: 'Collaboration' }],
            },
          },
        ],
      }),
    });

    const result = await fetchToolkitRecommendations({
      supabase: supabaseMock as unknown as Parameters<typeof fetchToolkitRecommendations>[0]['supabase'],
      tenantId: 'a6e5dcf4-7db8-4b83-8fe1-54ab3f3e5a34',
      missionId: '5bc564ff-0f9f-4d3c-849b-1a9052d2a2a5',
      persona: 'growth',
      industry: 'saas',
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.toolkits).toHaveLength(2);
    expect(result.toolkits[0]).toMatchObject({ slug: 'github', suggestedByPlanner: true, requiresConnectLink: true });
    expect(result.toolkits[1]).toMatchObject({ slug: 'slack', noAuth: true, requiresConnectLink: false });
    expect(result.selectionDetails).toEqual([
      expect.objectContaining({ slug: 'github', connectionStatus: 'linked', undoToken: 'undo-123' }),
    ]);
    expect(result.plannerSuggestion).toMatchObject({
      runId: 'planner-1',
      primaryToolkits: ['github'],
    });
    expect(result.requestId).toMatch(/^[a-f0-9]{40}$/);
  });

  it('throws when COMPOSIO_API_KEY is missing', async () => {
    delete process.env.COMPOSIO_API_KEY;

    const supabaseMock = {
      from: vi.fn(() => createSelectionBuilder([])),
    };

    await expect(
      fetchToolkitRecommendations({
        supabase: supabaseMock as unknown as Parameters<typeof fetchToolkitRecommendations>[0]['supabase'],
        tenantId: 'a6e5dcf4-7db8-4b83-8fe1-54ab3f3e5a34',
      }),
    ).rejects.toThrow('COMPOSIO_API_KEY is not configured');
  });

  it('propagates Composio fetch failures', async () => {
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'toolkit_selections') {
          return createSelectionBuilder([]);
        }
        if (table === 'planner_runs') {
          return createPlannerBuilder([]);
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });

    await expect(
      fetchToolkitRecommendations({
        supabase: supabaseMock as unknown as Parameters<typeof fetchToolkitRecommendations>[0]['supabase'],
        tenantId: 'a6e5dcf4-7db8-4b83-8fe1-54ab3f3e5a34',
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow('Failed to fetch toolkits from Composio');
  });
});
