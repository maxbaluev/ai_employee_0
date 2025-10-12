import { randomUUID } from 'node:crypto';

import { describe, it, expect } from 'vitest';

import { RegenerationLimiter } from '@/lib/intake/regenerationLimiter';
import { PostgresRegenerationStore } from '@/lib/intake/stores/postgresStore';

const hasSupabaseEnv =
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
  Boolean(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL);

let tableAvailable = hasSupabaseEnv;

if (tableAvailable) {
  const probeKey = `${randomUUID()}:${randomUUID()}:objective`;
  const probeStore = new PostgresRegenerationStore();
  try {
    await probeStore.reset(probeKey);
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('relation')) {
      console.warn('[postgres limiter tests] mission_regeneration_limits table not found, skipping tests.');
      tableAvailable = false;
    } else {
      throw error;
    }
  }
}

const describePostgres = tableAvailable ? describe : describe.skip;

const buildKey = (tenantId: string, missionId: string, field: string) => `${tenantId}:${missionId}:${field}`;

describePostgres('PostgresRegenerationStore', () => {
  it('returns undefined for missing counters and persists values', async () => {
    const store = new PostgresRegenerationStore();
    const tenantId = `tenant-${randomUUID()}`;
    const missionId = `mission-${randomUUID()}`;
    const field = 'objective';
    const key = buildKey(tenantId, missionId, field);

    await store.reset(key);

    expect(await store.get(key)).toBeUndefined();

    const firstAttemptAt = Date.now();
    await store.set(key, { count: 2, firstAttemptAt });

    const entry = await store.get(key);
    expect(entry?.count).toBe(2);
    expect(entry?.firstAttemptAt).toBeGreaterThan(0);
    expect(entry?.firstAttemptAt).toBeLessThanOrEqual(Date.now());

    await store.reset(key);
    expect(await store.get(key)).toBeUndefined();
  });

  it('enforces limiter thresholds via RegenerationLimiter', async () => {
    const limiter = new RegenerationLimiter({ backend: 'postgres', maxAttempts: 3 });
    const tenantId = `tenant-${randomUUID()}`;
    const missionId = `mission-${randomUUID()}`;

    expect(await limiter.checkAndIncrement(tenantId, missionId, 'objective')).toBe(true);
    expect(await limiter.checkAndIncrement(tenantId, missionId, 'objective')).toBe(true);
    expect(await limiter.checkAndIncrement(tenantId, missionId, 'objective')).toBe(true);
    expect(await limiter.checkAndIncrement(tenantId, missionId, 'objective')).toBe(false);
  });
});

describePostgres('PostgresRegenerationStore (environment check)', () => {
  it('requires SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars', () => {
    expect(hasSupabaseEnv).toBe(true);
  });
});
