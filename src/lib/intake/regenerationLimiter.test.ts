import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RegenerationLimiter,
  InMemoryRegenerationStore,
  RedisRegenerationStore,
  PostgresRegenerationStore,
  createRegenerationLimiterStore,
} from './regenerationLimiter';

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
    const store = createRegenerationLimiterStore('redis');
    expect(store).toBeInstanceOf(RedisRegenerationStore);
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

describe('RedisRegenerationStore', () => {
  let store: RedisRegenerationStore;

  beforeEach(() => {
    store = new RedisRegenerationStore();
  });

  it('throws NotImplemented error on get', async () => {
    await expect(store.get('key')).rejects.toThrow('NotImplemented: Redis backend not yet implemented');
  });

  it('throws NotImplemented error on set', async () => {
    await expect(store.set('key', { count: 1, firstAttemptAt: Date.now() })).rejects.toThrow(
      'NotImplemented: Redis backend not yet implemented'
    );
  });

  it('throws NotImplemented error on reset', async () => {
    await expect(store.reset('key')).rejects.toThrow('NotImplemented: Redis backend not yet implemented');
  });

  it('throws NotImplemented error on clear', async () => {
    await expect(store.clear()).rejects.toThrow('NotImplemented: Redis backend not yet implemented');
  });
});
