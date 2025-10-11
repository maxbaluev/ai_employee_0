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

    const toolkitQueryBuilder = createToolkitSelectionQueryBuilder([
      {
        slug: 'hubspot-crm',
        name: 'HubSpot CRM',
        authType: 'oauth',
        category: 'crm',
      },
      {
        slug: 'slack',
        name: 'Slack',
        authType: 'oauth',
        category: 'collaboration',
        noAuth: false,
      },
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
  });
});

type ToolkitSelectionQueryBuilder = {
  select: vi.Mock;
  eq: vi.Mock;
  order: vi.Mock;
  limit: vi.Mock;
  maybeSingle: vi.Mock;
};

function createToolkitSelectionQueryBuilder(selectedTools: unknown[]): ToolkitSelectionQueryBuilder {
  const builder: ToolkitSelectionQueryBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue({ data: { selected_tools: selectedTools }, error: null });

  return builder;
}
