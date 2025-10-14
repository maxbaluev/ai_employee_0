/// <reference types="vitest" />

import { NextRequest } from 'next/server';
import { describe, expect, it, beforeEach } from 'vitest';

const DEFAULT_TENANT = '11111111-1111-1111-1111-111111111111';
const DEFAULT_MISSION = '22222222-2222-2222-2222-222222222222';

class StubQueryBuilder {
  #data: unknown;
  #error: Error | null;

  constructor(data: unknown, error: Error | null = null) {
    this.#data = data;
    this.#error = error;
  }

  select(): this {
    return this;
  }

  eq(): this {
    return this;
  }

  order(): this {
    return this;
  }

  limit(): this {
    return this;
  }

  in(): this {
    return this;
  }

  insert(payload: unknown) {
    StubServiceClient.lastInsert = payload;
    return new StubQueryBuilder(this.#data, this.#error);
  }

  single() {
    return Promise.resolve({ data: this.#data, error: this.#error });
  }

  // Make the builder thenable so it can be awaited
  then<TResult1 = { data: unknown; error: Error | null }, TResult2 = never>(
    onFulfilled?: ((value: { data: unknown; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.#data, error: this.#error }).then(onFulfilled, onRejected);
  }
}

class StubServiceClient {
  static lastInsert: unknown = null;

  static reset() {
    StubServiceClient.lastInsert = null;
  }

  from(table: string) {
    if (table === 'toolkit_selections') {
      const toolkitSelection = [
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
      ];

      return new StubQueryBuilder(toolkitSelection);
    }

    if (table === 'mission_metadata') {
      return new StubQueryBuilder([
        { field: 'objective', accepted_at: '2025-10-10T00:00:00Z', value: 'Grow pipeline' },
      ]);
    }

    if (table === 'mission_safeguards') {
      return new StubQueryBuilder([
        { hint_type: 'tone', status: 'accepted', accepted_at: '2025-10-10T01:00:00Z' },
      ]);
    }

    if (table === 'planner_runs') {
      return new StubQueryBuilder([
        { candidate_count: 3, pinned_at: null, created_at: '2025-10-11T00:00:00Z' },
      ]);
    }

    if (table === 'plays') {
      return new StubQueryBuilder([
        { id: 'play-123', mission_id: DEFAULT_MISSION, created_at: '2025-10-11T02:00:00Z' },
      ]);
    }

    if (table === 'artifacts') {
      return new StubQueryBuilder([
        { id: 'artifact-1', type: 'draft', status: 'draft', play_id: 'play-123' },
      ]);
    }

    if (table === 'inspection_findings') {
      const findingRow = { id: 'finding-123', created_at: '2025-10-12T00:00:00Z' };
      return new StubQueryBuilder(findingRow);
    }

    throw new Error(`Unexpected table: ${table}`);
  }
}

const routeSupabaseStub = {
  auth: {
    async getSession() {
      return {
        data: { session: { user: { id: DEFAULT_TENANT } } },
        error: null,
      } as const;
    },
  },
};

const serviceClientStub = new StubServiceClient();

vi.mock('@/lib/supabase/server', () => ({
  getRouteHandlerSupabaseClient: async () => routeSupabaseStub,
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabaseClient: () => serviceClientStub,
}));

const { POST } = await import('@/app/api/inspect/preview/route');

describe('POST /api/inspect/preview', () => {
  beforeEach(() => {
    StubServiceClient.reset();
  });

  it('returns readiness categories and gate metadata for inspection gating', async () => {
    const request = new NextRequest('https://example.test/api/inspect/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        missionId: DEFAULT_MISSION,
        tenantId: DEFAULT_TENANT,
        findingType: 'coverage_preview',
        payload: {
          selectedToolkitsCount: 1,
          hasArtifacts: true,
        },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = (await response.json()) as Record<string, unknown>;

    expect(payload.readiness).toBeTypeOf('number');
    expect(payload).toHaveProperty('categories');
    expect(payload).toHaveProperty('gate');

    const categories = payload.categories as Array<Record<string, unknown>>;
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0]).toMatchObject({
      id: expect.any(String),
      label: expect.any(String),
      coverage: expect.any(Number),
      threshold: expect.any(Number),
      status: expect.stringMatching(/pass|fail|warn/),
    });

    const gate = payload.gate as Record<string, unknown>;
    expect(gate).toMatchObject({
      threshold: expect.any(Number),
      canProceed: expect.any(Boolean),
      reason: expect.any(String),
    });
  });
});
