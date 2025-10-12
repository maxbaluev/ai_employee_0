import { PostgresRegenerationStore } from './stores/postgresStore';

/**
 * RegenerationLimiter
 *
 * Manages per-tenant-per-mission-per-field regeneration attempt counters
 * with pluggable storage backends (in-memory, Redis, Postgres).
 */

export type RegenerationType = 'objective' | 'audience' | 'kpis' | 'safeguards';

export interface RegenerationLimiterConfig {
  /** Maximum number of regeneration attempts allowed per field */
  maxAttempts?: number;
  /** Time window in milliseconds after which counters reset (default: no reset) */
  resetWindowMs?: number;
  /** Storage backend to use (default: uses INTAKE_LIMITER_BACKEND env var or 'memory') */
  backend?: 'memory' | 'redis' | 'postgres';
}

export interface CounterEntry {
  count: number;
  firstAttemptAt: number;
}

/**
 * Storage interface for regeneration limiter counters.
 * Implementations must handle key-value storage and retrieval.
 */
export interface RegenerationLimiterStore {
  /** Get counter entry for a key, returns undefined if not found */
  get(key: string): Promise<CounterEntry | undefined>;
  /** Set counter entry for a key */
  set(key: string, entry: CounterEntry): Promise<void>;
  /** Delete counter entry for a specific key */
  reset(key: string): Promise<void>;
  /** Clear all counter entries */
  clear(): Promise<void>;
}

/**
 * In-memory implementation of RegenerationLimiterStore.
 * Uses a Map for fast key-value storage. Suitable for single-instance deployments.
 */
export class InMemoryRegenerationStore implements RegenerationLimiterStore {
  private readonly counters = new Map<string, CounterEntry>();

  async get(key: string): Promise<CounterEntry | undefined> {
    return this.counters.get(key);
  }

  async set(key: string, entry: CounterEntry): Promise<void> {
    this.counters.set(key, entry);
  }

  async reset(key: string): Promise<void> {
    this.counters.delete(key);
  }

  async clear(): Promise<void> {
    this.counters.clear();
  }
}

/**
 * Redis-backed implementation of RegenerationLimiterStore.
 * For distributed deployments with shared state across instances.
 */
export class RedisRegenerationStore implements RegenerationLimiterStore {
  async get(key: string): Promise<CounterEntry | undefined> {
    throw new Error('NotImplemented: Redis backend not yet implemented');
  }

  async set(key: string, entry: CounterEntry): Promise<void> {
    throw new Error('NotImplemented: Redis backend not yet implemented');
  }

  async reset(key: string): Promise<void> {
    throw new Error('NotImplemented: Redis backend not yet implemented');
  }

  async clear(): Promise<void> {
    throw new Error('NotImplemented: Redis backend not yet implemented');
  }
}

export { PostgresRegenerationStore } from './stores/postgresStore';

/**
 * Factory function to create the appropriate store based on configuration.
 * @param backend - Backend type ('memory', 'redis', or 'postgres')
 * @returns Instance of the appropriate RegenerationLimiterStore implementation
 */
export function createRegenerationLimiterStore(
  backend?: 'memory' | 'redis' | 'postgres'
): RegenerationLimiterStore {
  const storeType = backend ?? (process.env.INTAKE_LIMITER_BACKEND as 'memory' | 'redis' | 'postgres') ?? 'memory';

  switch (storeType) {
    case 'memory':
      return new InMemoryRegenerationStore();
    case 'redis':
      return new RedisRegenerationStore();
    case 'postgres':
      return new PostgresRegenerationStore();
    default:
      throw new Error(`Unknown limiter backend: ${storeType}`);
  }
}

export class RegenerationLimiter {
  private readonly store: RegenerationLimiterStore;
  private readonly maxAttempts: number;
  private readonly resetWindowMs?: number;

  constructor(config: RegenerationLimiterConfig = {}) {
    this.maxAttempts = config.maxAttempts ?? 3;
    this.resetWindowMs = config.resetWindowMs;
    this.store = createRegenerationLimiterStore(config.backend);
  }

  /**
   * Increment and check if regeneration is allowed for the given key.
   * @returns true if regeneration is allowed, false if limit exceeded
   */
  public async checkAndIncrement(tenantId: string, missionId: string, field: RegenerationType): Promise<boolean> {
    const key = this.buildKey(tenantId, missionId, field);
    const now = Date.now();

    let entry = await this.store.get(key);

    // Reset counter if window has expired
    if (entry && this.resetWindowMs && now - entry.firstAttemptAt > this.resetWindowMs) {
      entry = undefined;
    }

    if (!entry) {
      await this.store.set(key, { count: 1, firstAttemptAt: now });
      return true;
    }

    // Check if we've exceeded the limit BEFORE incrementing
    if (entry.count >= this.maxAttempts) {
      return false;
    }

    // Increment the counter
    entry.count += 1;
    await this.store.set(key, entry);
    return true;
  }

  /**
   * Get the current attempt count for a given key.
   */
  public async getCount(tenantId: string, missionId: string, field: RegenerationType): Promise<number> {
    const key = this.buildKey(tenantId, missionId, field);
    const now = Date.now();
    const entry = await this.store.get(key);

    if (!entry) {
      return 0;
    }

    // Reset counter if window has expired
    if (this.resetWindowMs && now - entry.firstAttemptAt > this.resetWindowMs) {
      await this.store.reset(key);
      return 0;
    }

    return entry.count;
  }

  /**
   * Reset the counter for a specific key.
   */
  public async reset(tenantId: string, missionId: string, field: RegenerationType): Promise<void> {
    const key = this.buildKey(tenantId, missionId, field);
    await this.store.reset(key);
  }

  /**
   * Clear all counters. Primarily for testing.
   */
  public async clearAll(): Promise<void> {
    await this.store.clear();
  }

  private buildKey(tenantId: string, missionId: string, field: string): string {
    return `${tenantId}:${missionId}:${field}`;
  }
}
