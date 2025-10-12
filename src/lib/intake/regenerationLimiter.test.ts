import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RegenerationLimiter,
  InMemoryRegenerationStore,
  RedisRegenerationStore,
  createRegenerationLimiterStore,
} from './regenerationLimiter';
import {
  buildRedisLimiterKey,
  closeRedisLimiterClient,
  getRedisLimiterClient,
} from './stores/redisStore';

const TENANT_ID = 'tenant-1';
const MISSION_ID = 'mission-1';

describe('RegenerationLimiter', () => {
  let limiter: RegenerationLimiter;

  beforeEach(() => {
    limiter = new RegenerationLimiter({ maxAttempts: 3 });
  });

  it('allows up to the configured number of attempts and blocks the next one', async () => {
    expect(await limiter.checkAndIncrement(TENANT_ID, MISSION_ID, 'objective')).toBe(true);
    expect(await limiter.checkAndIncrement(TENANT_ID, MISSION_ID, 'objective')).toBe(true);
    expect(await limiter.checkAndIncrement(TENANT_ID, MISSION_ID, 'objective')).toBe(true);
    expect(await limiter.checkAndIncrement(TENANT_ID, MISSION_ID, 'objective')).toBe(false);
  });

  it('tracks counters independently per tenant, mission, and field', async () => {
    expect(await limiter.checkAndIncrement('tenant-a', 'mission-1', 'audience')).toBe(true);
    expect(await limiter.checkAndIncrement('tenant-a', 'mission-1', 'audience')).toBe(true);
    expect(await limiter.checkAndIncrement('tenant-a', 'mission-2', 'audience')).toBe(true);
    expect(await limiter.checkAndIncrement('tenant-b', 'mission-1', 'audience')).toBe(true);

    // tenant-a & mission-1 should still be below the limit after two attempts
    expect(await limiter.checkAndIncrement('tenant-a', 'mission-1', 'audience')).toBe(true);
    // but the fourth attempt should be blocked
    expect(await limiter.checkAndIncrement('tenant-a', 'mission-1', 'audience')).toBe(false);

    // Other tenant/mission combinations remain unaffected
    expect(await limiter.checkAndIncrement('tenant-a', 'mission-2', 'audience')).toBe(true);
    expect(await limiter.checkAndIncrement('tenant-b', 'mission-1', 'audience')).toBe(true);
  });

  it('clears counters when clearAll is called', async () => {
    expect(await limiter.checkAndIncrement(TENANT_ID, MISSION_ID, 'kpis')).toBe(true);
    expect(await limiter.checkAndIncrement(TENANT_ID, MISSION_ID, 'kpis')).toBe(true);
    await limiter.clearAll();
    expect(await limiter.checkAndIncrement(TENANT_ID, MISSION_ID, 'kpis')).toBe(true);
  });

  it('resets counters after the configured reset window', async () => {
    const now = Date.now();
    const dateNowSpy = vi.spyOn(Date, 'now');
    dateNowSpy.mockReturnValue(now);

    const windowedLimiter = new RegenerationLimiter({ maxAttempts: 2, resetWindowMs: 1_000 });

    expect(await windowedLimiter.checkAndIncrement(TENANT_ID, MISSION_ID, 'safeguards')).toBe(true);
    expect(await windowedLimiter.checkAndIncrement(TENANT_ID, MISSION_ID, 'safeguards')).toBe(true);
    expect(await windowedLimiter.checkAndIncrement(TENANT_ID, MISSION_ID, 'safeguards')).toBe(false);

    // Advance time past the reset window
    dateNowSpy.mockReturnValue(now + 1_500);
    expect(await windowedLimiter.checkAndIncrement(TENANT_ID, MISSION_ID, 'safeguards')).toBe(true);

    dateNowSpy.mockRestore();
  });

  it('uses memory store by default', () => {
    const limiter = new RegenerationLimiter();
    expect(limiter['store']).toBeInstanceOf(InMemoryRegenerationStore);
  });

  it('allows explicit backend selection via constructor', () => {
    const memoryLimiter = new RegenerationLimiter({ backend: 'memory' });
    expect(memoryLimiter['store']).toBeInstanceOf(InMemoryRegenerationStore);
  });

  it('returns correct count via getCount', async () => {
    expect(await limiter.getCount(TENANT_ID, MISSION_ID, 'objective')).toBe(0);

    await limiter.checkAndIncrement(TENANT_ID, MISSION_ID, 'objective');
    expect(await limiter.getCount(TENANT_ID, MISSION_ID, 'objective')).toBe(1);

    await limiter.checkAndIncrement(TENANT_ID, MISSION_ID, 'objective');
    expect(await limiter.getCount(TENANT_ID, MISSION_ID, 'objective')).toBe(2);
  });

  it('resets a specific key via reset method', async () => {
    await limiter.checkAndIncrement(TENANT_ID, MISSION_ID, 'objective');
    await limiter.checkAndIncrement(TENANT_ID, MISSION_ID, 'objective');
    expect(await limiter.getCount(TENANT_ID, MISSION_ID, 'objective')).toBe(2);

    await limiter.reset(TENANT_ID, MISSION_ID, 'objective');
    expect(await limiter.getCount(TENANT_ID, MISSION_ID, 'objective')).toBe(0);
  });
});

describe('InMemoryRegenerationStore', () => {
  let store: InMemoryRegenerationStore;

  beforeEach(() => {
    store = new InMemoryRegenerationStore();
  });

  it('returns undefined for non-existent keys', async () => {
    const result = await store.get('non-existent-key');
    expect(result).toBeUndefined();
  });

  it('stores and retrieves counter entries', async () => {
    const key = 'test-key';
    const entry = { count: 5, firstAttemptAt: Date.now() };

    await store.set(key, entry);
    const retrieved = await store.get(key);

    expect(retrieved).toEqual(entry);
  });

  it('resets a specific key', async () => {
    const key = 'test-key';
    await store.set(key, { count: 3, firstAttemptAt: Date.now() });

    await store.reset(key);
    const result = await store.get(key);

    expect(result).toBeUndefined();
  });

  it('clears all entries', async () => {
    await store.set('key1', { count: 1, firstAttemptAt: Date.now() });
    await store.set('key2', { count: 2, firstAttemptAt: Date.now() });

    await store.clear();

    expect(await store.get('key1')).toBeUndefined();
    expect(await store.get('key2')).toBeUndefined();
  });
});

describe('createRegenerationLimiterStore factory', () => {
  it('creates an InMemoryRegenerationStore by default', () => {
    const store = createRegenerationLimiterStore();
    expect(store).toBeInstanceOf(InMemoryRegenerationStore);
  });

  it('creates an InMemoryRegenerationStore when explicitly requested', () => {
    const store = createRegenerationLimiterStore('memory');
    expect(store).toBeInstanceOf(InMemoryRegenerationStore);
  });

  it('creates a RedisRegenerationStore when requested', () => {
    const originalRedisUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = originalRedisUrl ?? 'redis://localhost:6379';

    const store = createRegenerationLimiterStore('redis');
    expect(store).toBeInstanceOf(RedisRegenerationStore);

    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  it('throws an error for unsupported backend types', () => {
    expect(() => createRegenerationLimiterStore('invalid' as any)).toThrow(
      'Unknown limiter backend: invalid'
    );
  });

  it('reads backend from INTAKE_LIMITER_BACKEND env variable', () => {
    const originalEnv = process.env.INTAKE_LIMITER_BACKEND;

    process.env.INTAKE_LIMITER_BACKEND = 'memory';
    const store = createRegenerationLimiterStore();
    expect(store).toBeInstanceOf(InMemoryRegenerationStore);

    process.env.INTAKE_LIMITER_BACKEND = originalEnv;
  });
});

const describeIfRedis = process.env.REDIS_URL ? describe : describe.skip;

describeIfRedis('RedisRegenerationStore (integration)', () => {
  const testKey = `tenant-${Math.random().toString(36).slice(2)}:mission:test:objective`;
  let store: RedisRegenerationStore;

  beforeAll(async () => {
    store = new RedisRegenerationStore();
    const client = await getRedisLimiterClient();
    await client.del(buildRedisLimiterKey(testKey));
  });

  afterAll(async () => {
    await store.reset(testKey);
    await store.reset('redisTenant:mission-ttl:objective');
    await closeRedisLimiterClient();
  });

  it('stores and retrieves counter entries', async () => {
    const now = Date.now();
    await store.set(testKey, { count: 2, firstAttemptAt: now }, 5_000);

    const value = await store.get(testKey);
    expect(value).toEqual({ count: 2, firstAttemptAt: now });
  });

  it('respects reset windows via TTL when configured', async () => {
    const limiter = new RegenerationLimiter({ backend: 'redis', maxAttempts: 1, resetWindowMs: 100 });

    expect(await limiter.checkAndIncrement('redisTenant', 'mission-ttl', 'objective')).toBe(true);
    expect(await limiter.checkAndIncrement('redisTenant', 'mission-ttl', 'objective')).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(await limiter.checkAndIncrement('redisTenant', 'mission-ttl', 'objective')).toBe(true);
  });
});
