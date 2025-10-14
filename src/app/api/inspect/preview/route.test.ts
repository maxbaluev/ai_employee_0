import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { POST } from './route';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

const DEFAULT_TENANT_ID = '7ae75a5c-0aed-4bd0-9c71-9d30e5bb6e08';

function createRequest(body: unknown): NextRequest {
  const request = new Request('http://localhost/api/inspect/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return request as NextRequest;
}

describe('POST /api/inspect/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const getSessionMock = vi.fn().mockResolvedValue({
      data: { session: { user: { id: DEFAULT_TENANT_ID } } },
      error: null,
    });

    const selectBuilder = (rows: unknown[]) => createToolkitSelectionQueryBuilder(rows);

    const toolkitQueryBuilder = selectBuilder([
      {
        toolkit_id: 'hubspot-crm',
        auth_mode: 'oauth',
        connection_status: 'not_linked',
        metadata: {
          name: 'HubSpot CRM',
          category: 'crm',
          noAuth: false,
          authType: 'oauth',
        },
      },
      {
        toolkit_id: 'slack',
        auth_mode: 'oauth',
        connection_status: 'not_required',
        metadata: {
          name: 'Slack',
          category: 'collaboration',
          noAuth: true,
          authType: 'none',
        },
      },
    ]);

    const missionMetadataBuilder = selectBuilder([
      { field: 'objective', accepted_at: '2025-10-10T00:00:00Z', value: 'Grow pipeline' },
    ]);

    const missionSafeguardsBuilder = selectBuilder([
      { hint_type: 'tone', status: 'accepted', accepted_at: '2025-10-10T01:00:00Z' },
    ]);

    const plannerRunBuilder = selectBuilder([
      { candidate_count: 3, pinned_at: null, created_at: '2025-10-11T00:00:00Z' },
    ]);

    const playsBuilder = selectBuilder([
      { id: 'play-123', mission_id: '67ab22f9-0f06-4ac4-9710-4a1ddcb915d2', created_at: '2025-10-11T02:00:00Z' },
    ]);

    const artifactsBuilder = selectBuilder([
      { id: 'artifact-1', type: 'draft', status: 'draft', play_id: 'play-123' },
    ]);

    const insertSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'finding-123',
        created_at: '2025-10-11T00:00:00Z',
      },
      error: null,
    });

    const inspectionInsertBuilder = {
      insert: vi.fn(() => ({
        select: vi.fn(() => ({ single: insertSingleMock })),
      })),
    };

    const serviceFromMock = vi.fn((table: string) => {
      if (table === 'toolkit_selections') {
        return toolkitQueryBuilder;
      }
      if (table === 'inspection_findings') {
        return inspectionInsertBuilder;
      }
      if (table === 'mission_metadata') {
        return missionMetadataBuilder;
      }
      if (table === 'mission_safeguards') {
        return missionSafeguardsBuilder;
      }
      if (table === 'planner_runs') {
        return plannerRunBuilder;
      }
      if (table === 'plays') {
        return playsBuilder;
      }
      if (table === 'artifacts') {
        return artifactsBuilder;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: { getSession: getSessionMock },
    } as unknown as Awaited<ReturnType<typeof getRouteHandlerSupabaseClientMock>>);

    getServiceSupabaseClientMock.mockReturnValue({
      from: serviceFromMock,
    } as unknown as ReturnType<typeof getServiceSupabaseClientMock>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when payload fails validation', async () => {
    const request = createRequest({});

    const response = await POST(request);

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toHaveProperty('error');
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('returns preview payload with toolkits and persists finding', async () => {
    const body = {
      missionId: '67ab22f9-0f06-4ac4-9710-4a1ddcb915d2',
      findingType: 'coverage_preview',
      payload: { selectedToolkitsCount: 2, hasArtifacts: true },
    };

    const request = createRequest(body);

    const response = await POST(request);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;

    expect(payload).toMatchObject({
      readiness: expect.any(Number),
      canProceed: expect.any(Boolean),
      summary: expect.any(String),
      toolkits: expect.any(Array),
      findingId: 'finding-123',
    });

    const serviceClient = getServiceSupabaseClientMock.mock.results[0]?.value;
    await expect(serviceClient).toBeDefined();

    const serviceResolved = await serviceClient;
    const fromMock = serviceResolved?.from as vi.Mock;
    expect(fromMock).toHaveBeenCalledWith('toolkit_selections');
    expect(fromMock).toHaveBeenCalledWith('inspection_findings');
    expect(fromMock).toHaveBeenCalledWith('mission_metadata');
    expect(fromMock).toHaveBeenCalledWith('mission_safeguards');
    expect(fromMock).toHaveBeenCalledWith('planner_runs');
    expect(fromMock).toHaveBeenCalledWith('plays');
  });
});

type ToolkitSelectionQueryBuilder = {
  select: vi.Mock;
  eq: vi.Mock;
  order: vi.Mock;
  limit: vi.Mock;
  in: vi.Mock;
  single: vi.Mock;
  then: vi.Mock;
};

function createToolkitSelectionQueryBuilder(rows: unknown[]): ToolkitSelectionQueryBuilder {
  const resolve = () => Promise.resolve({ data: rows, error: null });

  const builder: ToolkitSelectionQueryBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    in: vi.fn(),
    single: vi.fn(),
    then: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.single.mockImplementation(resolve);

  // Make the builder thenable so it can be awaited
  builder.then.mockImplementation((onFulfilled: (value: { data: unknown[]; error: null }) => unknown) => {
    return Promise.resolve({ data: rows, error: null }).then(onFulfilled);
  });

  return builder;
}
