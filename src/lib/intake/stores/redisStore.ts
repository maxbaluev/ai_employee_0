import { createClient, type RedisClientType } from '@redis/client';

import type { CounterEntry, RegenerationLimiterStore } from '../regenerationLimiter';

const KEY_PREFIX = 'regen:';

const INCREMENT_SCRIPT = `
local key = KEYS[1]
local maxAttempts = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

local payload = redis.call('GET', key)
local count = 0
local firstAttemptAt = now

if payload then
  local decoded = cjson.decode(payload)
  count = tonumber(decoded["count"]) or 0
  firstAttemptAt = tonumber(decoded["firstAttemptAt"]) or now
end

if count >= maxAttempts then
  return {0, count, firstAttemptAt}
end

if payload == false or payload == nil then
  firstAttemptAt = now
end

count = count + 1
local newPayload = cjson.encode({count = count, firstAttemptAt = firstAttemptAt})

if ttl > 0 then
  if payload then
    redis.call('SET', key, newPayload, 'KEEPTTL')
  else
    redis.call('SET', key, newPayload, 'PX', ttl)
  end
else
  redis.call('SET', key, newPayload)
end

return {1, count, firstAttemptAt}
`;

let client: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType> | null = null;

function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url || url.trim().length === 0) {
    throw new Error('REDIS_URL must be set to use the redis limiter backend');
  }
  return url;
}

async function getClient(): Promise<RedisClientType> {
  if (client?.isOpen) {
    return client;
  }

  if (!connectPromise) {
    client = createClient({ url: getRedisUrl() });
    client.on('error', (error) => {
      console.error('[redis limiter] client error', error);
    });

    connectPromise = client
      .connect()
      .then(() => client as RedisClientType)
      .catch((error) => {
        connectPromise = null;
        client = null;
        throw error;
      });
  }

  return connectPromise as Promise<RedisClientType>;
}

function wrapRedisError(action: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`[redis limiter] failed to ${action}: ${message}`);
}

export function buildRedisLimiterKey(rawKey: string): string {
  return `${KEY_PREFIX}${rawKey}`;
}

export async function getRedisLimiterClient(): Promise<RedisClientType> {
  return getClient();
}

export async function closeRedisLimiterClient(): Promise<void> {
  if (client && client.isOpen) {
    await client.quit();
  }

  client = null;
  connectPromise = null;
}

export class RedisRegenerationStore implements RegenerationLimiterStore {
  async get(key: string): Promise<CounterEntry | undefined> {
    try {
      const redisKey = buildRedisLimiterKey(key);
      const redisClient = await getClient();
      const payload = await redisClient.get(redisKey);

      if (!payload) {
        return undefined;
      }

      const parsed = JSON.parse(payload) as Partial<CounterEntry>;

      if (typeof parsed.count !== 'number' || typeof parsed.firstAttemptAt !== 'number') {
        throw new Error(`invalid counter payload for key ${redisKey}`);
      }

      return { count: parsed.count, firstAttemptAt: parsed.firstAttemptAt };
    } catch (error) {
      throw wrapRedisError('read counter', error);
    }
  }

  async set(key: string, entry: CounterEntry, resetWindowMs?: number): Promise<void> {
    try {
      const redisKey = buildRedisLimiterKey(key);
      const redisClient = await getClient();
      const payload = JSON.stringify(entry);

      if (typeof resetWindowMs === 'number' && resetWindowMs > 0) {
        await redisClient.set(redisKey, payload, { PX: resetWindowMs });
      } else {
        await redisClient.set(redisKey, payload);
      }
    } catch (error) {
      throw wrapRedisError('write counter', error);
    }
  }

  async reset(key: string): Promise<void> {
    try {
      const redisKey = buildRedisLimiterKey(key);
      const redisClient = await getClient();
      await redisClient.del(redisKey);
    } catch (error) {
      throw wrapRedisError('reset counter', error);
    }
  }

  async clear(): Promise<void> {
    try {
      const redisClient = await getClient();
      const keysToDelete: string[] = [];

      for await (const key of redisClient.scanIterator({ MATCH: `${KEY_PREFIX}*`, COUNT: 100 })) {
        keysToDelete.push(key as string);

        if (keysToDelete.length >= 100) {
          // TODO: remove cast once @redis/client adds variadic typings for del.
          await (redisClient as any).del(...keysToDelete);
          keysToDelete.length = 0;
        }
      }

      if (keysToDelete.length > 0) {
        await (redisClient as any).del(...keysToDelete);
      }
    } catch (error) {
      throw wrapRedisError('clear counters', error);
    }
  }

  async increment(
    key: string,
    maxAttempts: number,
    now: number,
    resetWindowMs?: number,
  ): Promise<{ allowed: boolean; entry: CounterEntry }>
  {
    try {
      const redisKey = buildRedisLimiterKey(key);
      const redisClient = await getClient();

      const ttl = typeof resetWindowMs === 'number' && resetWindowMs > 0 ? resetWindowMs : 0;
      const result = await redisClient.eval(INCREMENT_SCRIPT, {
        keys: [redisKey],
        arguments: [String(maxAttempts), String(now), String(ttl)],
      });

      if (!Array.isArray(result) || result.length < 3) {
        throw new Error('unexpected script response');
      }

      const allowed = Number(result[0]) === 1;
      const count = Number(result[1]);
      const firstAttemptAt = Number(result[2]);

      if (Number.isNaN(count) || Number.isNaN(firstAttemptAt)) {
        throw new Error('invalid script response payload');
      }

      return { allowed, entry: { count, firstAttemptAt } };
    } catch (error) {
      throw wrapRedisError('increment counter', error);
    }
  }
}
