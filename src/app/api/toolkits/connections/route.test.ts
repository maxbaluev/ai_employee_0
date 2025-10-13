import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET, POST } from './route';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const logTelemetryEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

vi.mock('@/lib/intake/service', () => ({
  logTelemetryEvent: logTelemetryEventMock,
}));

const tenantId = '3f6e8b42-f739-4dc5-8d55-47a0a9f3185f';
const missionId = '4d4a5c38-5bab-4b2c-8b03-02ad9adfbbe1';

function createNextRequest(url: string, init?: RequestInit): NextRequest {
  const request = new Request(url, init);
  const nextRequest = request as unknown as NextRequest & { nextUrl?: URL };
  nextRequest.nextUrl = new URL(url);
  return nextRequest as NextRequest;
}

describe('/api/toolkits/connections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logTelemetryEventMock.mockResolvedValue(undefined);
  });

  describe('GET', () => {
    it('returns 401 when the tenant context is missing', async () => {
      getRouteHandlerSupabaseClientMock.mockResolvedValue({
        auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) },
        from: vi.fn(),
      });

      const response = await GET(createNextRequest('http://localhost/api/toolkits/connections'));

      expect(response.status).toBe(401);
      const payload = await response.json();
      expect(payload).toEqual({
        error: 'Unable to determine tenant context',
        hint: 'Authenticate or pass tenantId to query connection statuses.',
      });
    });

    it('returns connection statuses for the tenant', async () => {
      const queryData = [
        {
          id: 'conn-1',
          tenant_id: tenantId,
          mission_id: missionId,
          toolkit: 'clearbit',
          connection_id: 'connection-123',
          status: 'pending',
          auth_mode: 'oauth',
          metadata: { scopes: ['connections:read'] },
          created_at: '2025-10-11T00:00:00.000Z',
          updated_at: '2025-10-11T00:00:00.000Z',
        },
      ];

      const queryBuilder: any = {
        eq: vi.fn(),
        order: vi.fn(),
        then: (resolve: (payload: { data: unknown; error: null }) => unknown) =>
          Promise.resolve(resolve({ data: queryData, error: null })),
      };
      queryBuilder.eq.mockReturnValue(queryBuilder);
      queryBuilder.order.mockReturnValue(queryBuilder);

      const selectMock = vi.fn().mockReturnValue(queryBuilder);

      getRouteHandlerSupabaseClientMock.mockResolvedValue({
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { user: { id: tenantId } } },
            error: null,
          }),
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'toolkit_connections') {
            return { select: selectMock };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      });

      const response = await GET(
        createNextRequest(
          `http://localhost/api/toolkits/connections?tenantId=${tenantId}&missionId=${missionId}`,
        ),
      );

      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.connections).toHaveLength(1);
      expect(payload.connections[0]).toMatchObject({
        toolkit: 'clearbit',
        status: 'pending',
        connectionId: 'connection-123',
      });
      expect(selectMock).toHaveBeenCalled();
      expect(queryBuilder.eq).toHaveBeenCalledWith('tenant_id', tenantId);
    });
  });

  describe('POST', () => {
    it('returns 400 when body fails validation', async () => {
      const response = await POST(
        createNextRequest('http://localhost/api/toolkits/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );

      expect(response.status).toBe(400);
      const payload = await response.json();
      expect(payload).toHaveProperty('error', 'Invalid toolkit connection payload');
    });

    it('upserts connection status and syncs selections', async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: {
          id: 'conn-row',
          tenant_id: tenantId,
          mission_id: missionId,
          toolkit: 'clearbit',
          connection_id: 'connection-123',
          status: 'linked',
          auth_mode: 'oauth',
          metadata: {},
          created_at: '2025-10-11T00:00:00.000Z',
          updated_at: '2025-10-11T00:00:00.000Z',
        },
        error: null,
      });
      const selectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const upsertMock = vi.fn().mockReturnValue({ select: selectMock });

      const thirdEqMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const secondEqMock = vi.fn().mockReturnValue({ eq: thirdEqMock });
      const firstEqMock = vi.fn().mockReturnValue({ eq: secondEqMock });
      const updateMock = vi.fn().mockReturnValue({ eq: firstEqMock });

      getRouteHandlerSupabaseClientMock.mockResolvedValue({
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { user: { id: tenantId } } },
            error: null,
          }),
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'toolkit_connections') {
            return { upsert: upsertMock };
          }
          if (table === 'toolkit_selections') {
            return { update: updateMock };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      });

      const response = await POST(
        createNextRequest('http://localhost/api/toolkits/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            missionId,
            toolkit: 'clearbit',
            connectionId: 'connection-123',
            status: 'linked',
            authMode: 'oauth',
            metadata: { scopes: ['connections:read'] },
          }),
        }),
      );

      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.connection).toMatchObject({
        toolkit: 'clearbit',
        status: 'linked',
        tenantId,
      });

      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: tenantId,
          mission_id: missionId,
          toolkit: 'clearbit',
          connection_id: 'connection-123',
          status: 'linked',
        }),
        { onConflict: 'tenant_id,mission_id,toolkit' },
      );

      expect(updateMock).toHaveBeenCalledWith({ connection_status: 'linked' });
      expect(firstEqMock).toHaveBeenCalledWith('tenant_id', tenantId);
      expect(logTelemetryEventMock).toHaveBeenCalledWith({
        tenantId,
        missionId,
        eventName: 'toolkit_connection_status_updated',
        eventData: expect.objectContaining({
          toolkit_slug: 'clearbit',
          status: 'linked',
        }),
      });
    });
  });
});
