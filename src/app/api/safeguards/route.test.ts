/// <reference types="vitest" />

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const emitSafeguardEventMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const emitMissionEventMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/lib/telemetry/server', () => ({
  emitSafeguardEvent: emitSafeguardEventMock,
  emitMissionEvent: emitMissionEventMock,
}));

type QueryResult = {
  data: unknown;
  error: unknown;
};

function createRequest(body: unknown): NextRequest {
  const request = new Request('http://localhost/api/safeguards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return request as unknown as NextRequest;
}

function createSelectQuery(result: QueryResult) {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (value: QueryResult) => unknown) => resolve(result);
  return builder;
}

function createUpdateQuery(result: QueryResult) {
  const selectAfterIn = vi.fn(() => Promise.resolve(result));
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => ({ select: selectAfterIn }));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.selectAfterIn = selectAfterIn;
  return builder;
}

function createSupabaseClient(queue: Array<Record<string, unknown>>) {
  const fromMock = vi.fn((table: string) => {
    if (table !== 'mission_safeguards') {
      throw new Error(`Unexpected table requested: ${table}`);
    }
    const next = queue.shift();
    if (!next) {
      throw new Error('No query builder mocked for mission_safeguards');
    }
    return next;
  });

  return { from: fromMock } as const;
}

describe('POST /api/safeguards', () => {
  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const missionId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GATE_GA_DEFAULT_TENANT_ID = tenantId;
  });

  afterEach(() => {
    delete process.env.GATE_GA_DEFAULT_TENANT_ID;
  });

  it('returns 400 when payload fails validation', async () => {
    const request = createRequest({});

    const response = await POST(request);

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toHaveProperty('error', 'Invalid safeguard payload');
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(emitSafeguardEventMock).not.toHaveBeenCalled();
  });

  describe('action: accept_all', () => {
    it('accepts safeguards and emits telemetry', async () => {
      const hintIds = [
        '3f9e8d6a-9b2b-4f3a-9a54-a2a968d50111',
        '4cb9f717-1f0c-4f3e-84b4-3ac42fcd6b22',
      ];

      const resolveBuilder = createSelectQuery({
        data: hintIds.map((id) => ({ id })),
        error: null,
      });

      const updateBuilder = createUpdateQuery({
        data: hintIds.map((id) => ({ id })),
        error: null,
      });

      const fetchBuilder = createSelectQuery({ data: [], error: null });

      const supabaseClient = createSupabaseClient([resolveBuilder, updateBuilder, fetchBuilder]);
      getServiceSupabaseClientMock.mockReturnValue(supabaseClient);

      const response = await POST(
        createRequest({
          action: 'accept_all',
          tenantId,
          missionId,
          hintIds,
        }),
      );

      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload).toEqual({ success: true, hintIds });

      expect(resolveBuilder.select).toHaveBeenCalledWith('id');
      expect(resolveBuilder.eq).toHaveBeenNthCalledWith(1, 'tenant_id', tenantId);
      expect(resolveBuilder.eq).toHaveBeenNthCalledWith(2, 'mission_id', missionId);
      expect(resolveBuilder.in).toHaveBeenCalledWith('id', hintIds);

      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'accepted',
          accepted_at: expect.any(String),
        }),
      );
      expect(updateBuilder.eq).toHaveBeenNthCalledWith(1, 'tenant_id', tenantId);
      expect(updateBuilder.eq).toHaveBeenNthCalledWith(2, 'mission_id', missionId);
      expect(updateBuilder.in).toHaveBeenCalledWith('id', hintIds);

      expect(emitSafeguardEventMock).toHaveBeenCalledWith({
        tenantId,
        missionId,
        eventType: 'safeguard_hint_accept_all',
        details: {
          hint_ids: hintIds,
          hint_count: hintIds.length,
        },
      });

      expect(emitMissionEventMock).toHaveBeenCalledWith({
        tenantId,
        missionId,
        eventName: 'safeguard_modified',
        eventPayload: expect.objectContaining({
          action: 'accept_all',
          hint_count: hintIds.length,
        }),
      });
    });

    it('returns 500 when selecting safeguards fails', async () => {
      const resolveBuilder = createSelectQuery({ data: null, error: { message: 'select failed' } });
      getServiceSupabaseClientMock.mockReturnValue(createSupabaseClient([resolveBuilder]));

      const response = await POST(
        createRequest({
          action: 'accept_all',
          tenantId,
          missionId,
          hintIds: ['3f9e8d6a-9b2b-4f3a-9a54-a2a968d50111'],
        }),
      );

      expect(response.status).toBe(500);
      const payload = await response.json();
      expect(payload).toMatchObject({
        error: 'Failed to resolve safeguard targets',
        hint: 'select failed',
      });
      expect(emitSafeguardEventMock).not.toHaveBeenCalled();
    });
  });

  describe('action: accept', () => {
    it('accepts individual safeguard and returns ids', async () => {
      const hintId = 'd5a3f08f-c1e7-4f7d-9f59-4a949e2650b3';

      const resolveBuilder = createSelectQuery({ data: [{ id: hintId }], error: null });
      const updateBuilder = createUpdateQuery({ data: [{ id: hintId }], error: null });
      const fetchBuilder = createSelectQuery({ data: [], error: null });

      getServiceSupabaseClientMock.mockReturnValue(
        createSupabaseClient([resolveBuilder, updateBuilder, fetchBuilder]),
      );

      const response = await POST(
        createRequest({
          action: 'accept',
          tenantId,
          missionId,
          hintId,
        }),
      );

      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload).toEqual({ success: true, hintIds: [hintId] });

      expect(emitSafeguardEventMock).toHaveBeenCalledWith({
        tenantId,
        missionId,
        eventType: 'safeguard_hint_applied',
        details: {
          hint_ids: [hintId],
          hint_count: 1,
        },
      });
    });

    it('returns 404 when safeguard id is unknown', async () => {
      const resolveBuilder = createSelectQuery({ data: [], error: null });
      getServiceSupabaseClientMock.mockReturnValue(createSupabaseClient([resolveBuilder]));

      const response = await POST(
        createRequest({
          action: 'accept',
          tenantId,
          missionId,
          hintId: '4977ecf7-5c6f-45d4-80f6-90f60ef4e441',
        }),
      );

      expect(response.status).toBe(404);
      const payload = await response.json();
      expect(payload).toMatchObject({ error: expect.stringContaining('Unknown safeguard ids') });
      expect(emitSafeguardEventMock).not.toHaveBeenCalled();
    });
  });

  describe('action: edit', () => {
    it('updates safeguard text and emits telemetry', async () => {
      const hintId = 'ab2c5737-9240-4a01-92e0-66305bc8c6f4';
      const existingValue = { text: 'Old text', pinned: true };

      const fetchBuilder = createSelectQuery({
        data: {
          id: hintId,
          suggested_value: existingValue,
          generation_count: 0,
        },
        error: null,
      });
      const updateBuilder = createUpdateQuery({ data: [{ id: hintId }], error: null });
      const fetchUpdatedBuilder = createSelectQuery({ data: [], error: null });

      getServiceSupabaseClientMock.mockReturnValue(
        createSupabaseClient([fetchBuilder, updateBuilder, fetchUpdatedBuilder]),
      );

      const text = 'Revised safeguard text';
      const response = await POST(
        createRequest({
          action: 'edit',
          tenantId,
          missionId,
          hintId,
          text,
        }),
      );

      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload).toEqual({ success: true, hintIds: [hintId] });

      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          suggested_value: { ...existingValue, text },
          status: 'edited',
          accepted_at: expect.any(String),
        }),
      );

      expect(emitSafeguardEventMock).toHaveBeenCalledWith({
        tenantId,
        missionId,
        eventType: 'safeguard_hint_edited',
        details: {
          hint_ids: [hintId],
          hint_count: 1,
          text_length: text.length,
        },
      });
    });

    it('returns 500 when update fails', async () => {
      const fetchBuilder = createSelectQuery({
        data: {
          id: '42c8f68e-1846-4c5a-a655-57c7f82766cc',
          suggested_value: { text: 'Existing' },
          generation_count: 0,
        },
        error: null,
      });
      const updateBuilder = createUpdateQuery({ data: null, error: { message: 'update failed' } });

      getServiceSupabaseClientMock.mockReturnValue(createSupabaseClient([fetchBuilder, updateBuilder]));

      const response = await POST(
        createRequest({
          action: 'edit',
          tenantId,
          missionId,
          hintId: '42c8f68e-1846-4c5a-a655-57c7f82766cc',
          text: 'Next text',
        }),
      );

      expect(response.status).toBe(500);
      const payload = await response.json();
      expect(payload).toMatchObject({
        error: 'Failed to update safeguards',
        hint: 'update failed',
      });
    });
  });

  describe('action: regenerate', () => {
    it('increments generation count and resets status', async () => {
      const hintId = 'f0c2680a-5a82-4ab5-bc37-88d95e6f2f74';

      const fetchBuilder = createSelectQuery({
        data: {
          id: hintId,
          suggested_value: { text: 'Existing safeguard' },
          generation_count: 2,
        },
        error: null,
      });
      const updateBuilder = createUpdateQuery({ data: [{ id: hintId }], error: null });
      const fetchUpdatedBuilder = createSelectQuery({ data: [], error: null });

      getServiceSupabaseClientMock.mockReturnValue(
        createSupabaseClient([fetchBuilder, updateBuilder, fetchUpdatedBuilder]),
      );

      const response = await POST(
        createRequest({
          action: 'regenerate',
          tenantId,
          missionId,
          hintId,
        }),
      );

      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload).toEqual({ success: true, hintIds: [hintId] });

      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          generation_count: 3,
          status: 'suggested',
          accepted_at: null,
        }),
      );

      expect(emitSafeguardEventMock).toHaveBeenCalledWith({
        tenantId,
        missionId,
        eventType: 'safeguard_hint_regenerated',
        details: {
          hint_ids: [hintId],
          hint_count: 1,
          generation_count: 3,
        },
      });
    });

    it('returns 500 when existing safeguard cannot be fetched', async () => {
      const fetchBuilder = createSelectQuery({ data: null, error: { message: 'fetch failed' } });
      getServiceSupabaseClientMock.mockReturnValue(createSupabaseClient([fetchBuilder]));

      const response = await POST(
        createRequest({
          action: 'regenerate',
          tenantId,
          missionId,
          hintId: 'f0c2680a-5a82-4ab5-bc37-88d95e6f2f74',
        }),
      );

      expect(response.status).toBe(500);
      const payload = await response.json();
      expect(payload).toMatchObject({
        error: 'Failed to fetch safeguard',
        hint: 'fetch failed',
      });
    });
  });

  describe('action: toggle_pin', () => {
    it('toggles pinned state to true', async () => {
      const hintId = '0f494b7d-8f1a-4ff3-90f1-2750cf78f4cd';

      const fetchBuilder = createSelectQuery({
        data: {
          id: hintId,
          suggested_value: { text: 'Guardrail', pinned: false },
          generation_count: 0,
        },
        error: null,
      });
      const updateBuilder = createUpdateQuery({ data: [{ id: hintId }], error: null });
      const fetchUpdatedBuilder = createSelectQuery({ data: [], error: null });

      getServiceSupabaseClientMock.mockReturnValue(
        createSupabaseClient([fetchBuilder, updateBuilder, fetchUpdatedBuilder]),
      );

      const response = await POST(
        createRequest({
          action: 'toggle_pin',
          tenantId,
          missionId,
          hintId,
          pinned: true,
        }),
      );

      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload).toEqual({ success: true, hintIds: [hintId] });

      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          suggested_value: { text: 'Guardrail', pinned: true },
        }),
      );

      expect(emitSafeguardEventMock).toHaveBeenCalledWith({
        tenantId,
        missionId,
        eventType: 'safeguard_hint_toggle_pin',
        details: {
          hint_ids: [hintId],
          hint_count: 1,
          pinned: true,
        },
      });
    });

    it('returns 404 when safeguard lookup fails', async () => {
      const fetchBuilder = createSelectQuery({ data: null, error: null });
      getServiceSupabaseClientMock.mockReturnValue(createSupabaseClient([fetchBuilder]));

      const response = await POST(
        createRequest({
          action: 'toggle_pin',
          tenantId,
          missionId,
          hintId: '9d1f4f0a-1234-4f7a-9b3f-2f9c5f2d0000',
          pinned: false,
        }),
      );

      expect(response.status).toBe(404);
      const payload = await response.json();
      expect(payload).toMatchObject({
        error: expect.stringContaining('Safeguard 9d1f4f0a-1234-4f7a-9b3f-2f9c5f2d0000 not found'),
      });
      expect(emitSafeguardEventMock).not.toHaveBeenCalled();
    });
  });

  describe('tenant resolution', () => {
    it('returns 400 when tenant context is missing without fallback', async () => {
      delete process.env.GATE_GA_DEFAULT_TENANT_ID;

      const response = await POST(
        createRequest({
          action: 'accept_all',
          missionId,
        }),
      );

      expect(response.status).toBe(400);
      const payload = await response.json();
      expect(payload).toMatchObject({ error: 'Missing tenant context' });
    });
  });
});
