import type { FastifyInstance } from 'fastify';
import { authMiddleware, requireRole } from '@middleware/auth.middleware';
import { getRedisClient } from '@infrastructure/cache/redis.client';
import { REDIS_KEY_PREFIXES } from '@infrastructure/cache/redis.keys';
import { HTTP_STATUS } from '@constants/error.constants';

const MAX_KEYS = 500;

async function scanKeys(pattern: string): Promise<string[]> {
  const redis = getRedisClient();
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = next;
    keys.push(...batch);
    if (keys.length >= MAX_KEYS) break;
  } while (cursor !== '0');
  return keys.slice(0, MAX_KEYS);
}

async function getKeyDetail(key: string): Promise<Record<string, unknown>> {
  const redis = getRedisClient();
  const [type, ttl] = await Promise.all([redis.type(key), redis.ttl(key)]);

  let value: unknown;
  switch (type) {
    case 'string':
      value = await redis.get(key);
      break;
    case 'list':
      value = await redis.lrange(key, 0, 99);
      break;
    case 'hash':
      value = await redis.hgetall(key);
      break;
    case 'set':
      value = await redis.smembers(key);
      break;
    case 'zset':
      value = await redis.zrangebyscore(key, '-inf', '+inf', 'WITHSCORES');
      break;
    default:
      value = null;
  }

  return { key, type, ttl, value };
}

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  const preHandler = [authMiddleware, requireRole('ADMIN', 'SENIOR_ADMIN')];

  // GET /admin/redis/keys?pattern=*
  fastify.get('/admin/redis/keys', { preHandler }, async (request, reply) => {
    const { pattern = '*' } = request.query as { pattern?: string };
    const keys = await scanKeys(pattern);
    return reply.status(HTTP_STATUS.OK).send({ count: keys.length, keys });
  });

  // GET /admin/redis/key/:key
  fastify.get('/admin/redis/key/:key', { preHandler }, async (request, reply) => {
    const { key } = request.params as { key: string };
    const detail = await getKeyDetail(key);
    return reply.status(HTTP_STATUS.OK).send(detail);
  });

  // GET /admin/redis/summary — key counts grouped by prefix
  fastify.get('/admin/redis/summary', { preHandler }, async (_request, reply) => {
    const results = await Promise.all(
      REDIS_KEY_PREFIXES.map(async (prefix) => {
        const keys = await scanKeys(`${prefix}*`);
        return { prefix, count: keys.length };
      }),
    );
    return reply.status(HTTP_STATUS.OK).send({ prefixes: results });
  });
}
