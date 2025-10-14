/**
 * RegenerationLimiter
 *
 * Manages per-tenant-per-mission-per-field regeneration attempt counters.
 */

export type RegenerationType =
  | 'objective'
  | 'audience'
  | 'kpis'
  | 'safeguards'
  | 'toolkits_recommend';

export interface RegenerationLimiterConfig {
  /** Maximum number of regeneration attempts allowed per field */
  maxAttempts?: number;
  /** Time window in milliseconds after which counters reset (default: no reset) */
  resetWindowMs?: number;
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
  /**
   * Persist a counter entry for a key. Primarily used in tests and maintenance flows.
   * Implementations may ignore the reset window hint.
   */
  set(key: string, entry: CounterEntry, resetWindowMs?: number): Promise<void>;
  /** Delete counter entry for a specific key */
  reset(key: string): Promise<void>;
  /** Clear all counter entries */
  clear(): Promise<void>;
  /**
   * Atomically increment the counter while respecting the configured attempt limit.
   * Returns the resulting entry alongside whether the increment was allowed.
   */
  increment(
    key: string,
    maxAttempts: number,
    now: number,
    resetWindowMs?: number,
  ): Promise<{ allowed: boolean; entry: CounterEntry }>;
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

  async set(key: string, entry: CounterEntry, _resetWindowMs?: number): Promise<void> {
    this.counters.set(key, entry);
  }

  async reset(key: string): Promise<void> {
    this.counters.delete(key);
  }

  async clear(): Promise<void> {
    this.counters.clear();
  }

  async increment(
    key: string,
    maxAttempts: number,
    now: number,
    resetWindowMs?: number,
  ): Promise<{ allowed: boolean; entry: CounterEntry }>
  {
    let entry = this.counters.get(key);

    if (entry && resetWindowMs && now - entry.firstAttemptAt > resetWindowMs) {
      entry = undefined;
      this.counters.delete(key);
    }

    if (!entry) {
      const fresh: CounterEntry = { count: 1, firstAttemptAt: now };
      this.counters.set(key, fresh);
      return { allowed: true, entry: fresh };
    }

    if (entry.count >= maxAttempts) {
      return { allowed: false, entry };
    }

    const updated: CounterEntry = { count: entry.count + 1, firstAttemptAt: entry.firstAttemptAt };
    this.counters.set(key, updated);
    return { allowed: true, entry: updated };
  }
}

/**
 * Factory function to create the appropriate store based on configuration.
 */
export function createRegenerationLimiterStore(): RegenerationLimiterStore {
  return new InMemoryRegenerationStore();
}

export class RegenerationLimiter {
  private readonly store: RegenerationLimiterStore;
  private readonly maxAttempts: number;
  private readonly resetWindowMs?: number;

  constructor(config: RegenerationLimiterConfig = {}) {
    this.maxAttempts = config.maxAttempts ?? 3;
    this.resetWindowMs = config.resetWindowMs;
    this.store = createRegenerationLimiterStore();
  }

  /**
   * Increment and check if regeneration is allowed for the given key.
   * @returns true if regeneration is allowed, false if limit exceeded
   */
  public async checkAndIncrement(tenantId: string, missionId: string, field: RegenerationType): Promise<boolean> {
    const key = this.buildKey(tenantId, missionId, field);
    const now = Date.now();
    const { allowed } = await this.store.increment(key, this.maxAttempts, now, this.resetWindowMs);
    return allowed;
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
