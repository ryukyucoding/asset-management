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

export async function closeRedisClient(): Promise<void> {
  if (!redisClient) return;
  await redisClient.quit();
  redisClient = null;
}
