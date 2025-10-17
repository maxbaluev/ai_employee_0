type RateLimiterCheckResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  resetAt: number;
};

/**
 * Sliding-window rate limiter keyed by a tenant identifier.
 *
 * The limiter keeps timestamps for the most recent requests within the
 * configured window. The implementation intentionally stays in-memory because
 * API routes run on the server and share process state.
 */
export class SlidingWindowRateLimiter {
  private readonly limit: number;

  private readonly windowMs: number;

  private readonly entries = new Map<string, number[]>();

  constructor(options: { limit: number; windowMs: number }) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
  }

  check(key: string): RateLimiterCheckResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = this.entries.get(key) ?? [];
    const recent = timestamps.filter((ts) => ts > windowStart);

    if (recent.length >= this.limit) {
      const retryAfterMs = this.windowMs - (now - recent[0]);
      this.entries.set(key, recent);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(retryAfterMs, 0),
        resetAt: recent[0] + this.windowMs,
      };
    }

    recent.push(now);
    this.entries.set(key, recent);

    return {
      allowed: true,
      remaining: Math.max(this.limit - recent.length, 0),
      retryAfterMs: 0,
      resetAt: recent[0] + this.windowMs,
    };
  }

  reset(key?: string) {
    if (typeof key === "string") {
      this.entries.delete(key);
      return;
    }

    this.entries.clear();
  }
}

export const intakeRateLimiter = new SlidingWindowRateLimiter({
  limit: 5,
  windowMs: 60_000,
});

export type { RateLimiterCheckResult };
