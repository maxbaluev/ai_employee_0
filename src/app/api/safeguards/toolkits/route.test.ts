/// <reference types="vitest" />

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

function createRequest(body: unknown): NextRequest {
  const request = new Request('http://localhost/api/safeguards/toolkits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return request as unknown as NextRequest;
}

type QueryResult = {
  data: unknown;
  error: unknown;
};

function createSelectQuery(result: QueryResult) {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.then = (resolve: (value: QueryResult) => unknown) => resolve(result);
  return builder;
}

function createDeleteQuery(result: QueryResult) {
  const builder: any = {};
  builder.delete = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.then = (resolve: (value: QueryResult) => unknown) => resolve(result);
  return builder;
}

function createInsertQuery(result: QueryResult) {
  const builder: any = {};
  builder.insert = vi.fn(() => Promise.resolve(result));
  return builder;
}

describe('POST /api/safeguards/toolkits', () => {
  const missionId = 'mission-abc-123';

  it('returns 401 when tenant missing', async () => {
    vi.clearAllMocks();

    // Mock Supabase session to null
    const getSessionMock = vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    });

    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getSession: getSessionMock,
      },
    } as unknown as Record<string, unknown>);

    const request = createRequest({
      missionId,
      selections: [
        {
          slug: 'test-toolkit',
          name: 'Test Toolkit',
          authType: 'oauth',
          category: 'security',
          noAuth: false,
        },
      ],
      // Explicitly don't provide tenantId (leave it undefined in the body)
    });

    const response = await POST(request);

    // When tenantId is not in body and session is null, should get 401
    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload).toEqual({
      error: 'Unable to determine tenant context',
      hint: 'Authenticate with Supabase or include tenantId in the request body',
    });
  });

  it('persists selections when session provides tenant', async () => {
    vi.clearAllMocks();

    const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    // Mock Supabase session with user id
    const getSessionMock = vi.fn().mockResolvedValue({
      data: {
        session: {
          user: { id: tenantId },
        },
      },
      error: null,
    });

    // Create query builders
    const selectBuilder = createSelectQuery({ data: [], error: null });
    const deleteBuilder = createDeleteQuery({ data: null, error: null });
    const insertBuilder = createInsertQuery({ error: null });

    const fromMock = vi.fn((table: string) => {
      if (table === 'mission_safeguards') {
        // First call is select, second is delete
        if (selectBuilder.select.mock.calls.length === 0) {
          return selectBuilder;
        }
        return deleteBuilder;
      }
      if (table === 'mission_events') {
        return insertBuilder;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getSession: getSessionMock,
      },
      from: fromMock,
    } as unknown as Record<string, unknown>);

    const request = createRequest({
      missionId,
      selections: [],
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      success: true,
      count: 0,
    });

    // Verify delete builder was called with tenant/mission
    expect(deleteBuilder.eq).toHaveBeenCalledWith('mission_id', missionId);
    expect(deleteBuilder.eq).toHaveBeenCalledWith('tenant_id', tenantId);

    // Verify mission_events insert was called
    expect(insertBuilder.insert).toHaveBeenCalledTimes(1);
  });
});
