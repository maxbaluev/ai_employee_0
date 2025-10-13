// Tests for /api/toolkits/selections tenant enforcement.

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

function createRequest(body: unknown): NextRequest {
  const request = new Request('http://localhost/api/toolkits/selections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return request as unknown as NextRequest;
}

describe('POST /api/toolkits/selections', () => {
  it('returns 401 when tenant context missing', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) },
      from: vi.fn(),
    });

    const response = await POST(
      createRequest({
        missionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        selections: [],
      }),
    );

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload).toEqual({
      error: 'Unable to determine tenant context',
      hint: 'Authenticate with Supabase or include tenantId in the request body',
    });
  });

  it('persists selections when session provides tenant', async () => {
    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    const insertedRows = [
      {
        id: 'selection-1',
        tenant_id: 'tenant-123',
        mission_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        toolkit_id: 'alpha',
        auth_mode: 'oauth',
        connection_status: 'not_linked',
        undo_token: 'token-123',
        metadata: {
          name: 'Alpha',
          category: 'general',
          logo: null,
          noAuth: false,
          authType: 'oauth',
        },
        rationale: null,
        created_at: '2025-10-09T19:30:00.000Z',
        updated_at: '2025-10-09T19:30:00.000Z',
      },
    ];

    const insertSelectMock = vi.fn().mockResolvedValue({ data: insertedRows, error: null });
    const insertMock = vi.fn().mockReturnValue({ select: insertSelectMock });

    const selectSingleMock = vi.fn().mockResolvedValue({ data: { id: 'mission-1' }, error: null });
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: selectSingleMock }),
      }),
    });

    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'tenant-123' } } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'objectives') {
          return { select: selectMock };
        }
        if (table === 'toolkit_selections') {
          return {
            delete: deleteMock,
            insert: insertMock,
          };
        }
        throw new Error('Unexpected table');
      }),
    });

    const response = await POST(
      createRequest({
        missionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        selections: [
          {
            slug: 'alpha',
            name: 'Alpha',
            authType: 'oauth',
            category: 'general',
            logo: null,
            noAuth: false,
          },
        ],
      }),
    );

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.count).toBe(insertedRows.length);
    expect(payload.selections).toMatchObject([
      {
        id: 'selection-1',
        toolkitId: 'alpha',
        connectionStatus: 'not_linked',
        undoToken: 'token-123',
        metadata: expect.objectContaining({ name: 'Alpha', noAuth: false }),
      },
    ]);

    const insertedPayload = insertMock.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(insertedPayload).toHaveLength(1);
    expect(insertedPayload[0]).toMatchObject({
      tenant_id: 'tenant-123',
      mission_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      toolkit_id: 'alpha',
      auth_mode: 'oauth',
      connection_status: 'not_linked',
    });
    expect(typeof insertedPayload[0].undo_token).toBe('string');
  });
});
