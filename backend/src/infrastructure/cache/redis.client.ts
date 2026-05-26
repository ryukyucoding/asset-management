import Redis from 'ioredis';

let redisClient: Redis | null = null;

function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
  });
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
}

export async function pingRedis(): Promise<boolean> {
  try {
    const result = await getRedisClient().ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

export async function incrementWithTtl(key: string, ttlSeconds: number): Promise<number> {
  const redis = getRedisClient();
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, ttlSeconds);
  }
  return current;
}

export async function getString(key: string): Promise<string | null> {
  try {
    return await getRedisClient().get(key);
  } catch {
    return null;
  }
}

export async function setString(key: string, value: string, ttlSeconds?: number): Promise<void> {
  try {
    const redis = getRedisClient();
    if (ttlSeconds !== undefined) {
      await redis.set(key, value, 'EX', ttlSeconds);
    } else {
      await redis.set(key, value);
    }
  } catch {
    // Non-fatal when Redis is unavailable.
  }
}

export async function deleteKey(key: string): Promise<void> {
  try {
    await getRedisClient().del(key);
  } catch {
    // Non-fatal when Redis is unavailable.
  }
}

export async function deleteByPattern(pattern: string): Promise<void> {
  try {
    const redis = getRedisClient();
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch {
    // Non-fatal when Redis is unavailable.
  }
}

export async function increment(key: string): Promise<number> {
  return getRedisClient().incr(key);
}

export async function closeRedisClient(): Promise<void> {
  if (!redisClient) return;
  try {
    await redisClient.quit();
  } catch {
    // Ignore shutdown errors when the client was never connected.
  }
  redisClient = null;
}

/** Parse JWT-style duration (e.g. 15m, 7d) to seconds for Redis TTL. */
export function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) return 900;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * (multipliers[unit] ?? 60);
}
