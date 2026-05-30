import type { FastifyInstance } from 'fastify';
import { getRedisClient } from '@infrastructure/cache/redis.client';
import { REDIS_KEY_PREFIXES } from '@infrastructure/cache/redis.keys';
import { getCacheMetrics } from '@infrastructure/cache/cache-metrics';
import { authMiddleware, requireRole } from '@middleware/auth.middleware';
import { ERROR_CODES, HTTP_STATUS } from '@constants/error.constants';
import { sendApiError } from '@domain/errors/error-response';

const ALLOWED_PREFIXES = new Set<string>(REDIS_KEY_PREFIXES);
const SCAN_BATCH = 200;
const MAX_KEYS_PER_REQUEST = 500;

/**
 * Reject patterns that escape the allowed prefixes or contain glob characters
 * outside of a trailing `*`. Stops abuse like `?pattern=*` or `?pattern=re*sh:*`.
 */
function isWhitelistedPattern(pattern: string): boolean {
  for (const prefix of ALLOWED_PREFIXES) {
    if (pattern === prefix || pattern === `${prefix}*`) return true;
    if (pattern.startsWith(prefix)) {
      const tail = pattern.slice(prefix.length);
      if (/^[A-Za-z0-9:_\-.]*\*?$/.test(tail)) return true;
    }
  }
  return false;
}

async function countByPrefix(prefix: string): Promise<number> {
  const redis = getRedisClient();
  let cursor = '0';
  let count = 0;
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', SCAN_BATCH);
    cursor = next;
    count += keys.length;
  } while (cursor !== '0');
  return count;
}

async function listByPattern(
  pattern: string,
  startCursor: string,
): Promise<{ cursor: string; keys: string[] }> {
  const redis = getRedisClient();
  let cursor = startCursor;
  const keys: string[] = [];
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', SCAN_BATCH);
    cursor = next;
    keys.push(...batch);
    if (keys.length >= MAX_KEYS_PER_REQUEST) break;
  } while (cursor !== '0');
  return { cursor, keys: keys.slice(0, MAX_KEYS_PER_REQUEST) };
}

export async function adminRedisRoutes(fastify: FastifyInstance): Promise<void> {
  const adminGuard = [authMiddleware, requireRole('ADMIN', 'SENIOR_ADMIN')];

  fastify.get('/admin/redis/summary', { preHandler: adminGuard }, async (request, reply) => {
    request.log.info(
      { actor: request.user?.userId, action: 'redis.summary' },
      'admin redis summary',
    );

    const prefixes = await Promise.all(
      REDIS_KEY_PREFIXES.map(async (prefix) => ({
        prefix,
        count: await countByPrefix(prefix),
      })),
    );

    return reply.send({
      prefixes,
      cacheMetrics: getCacheMetrics(),
    });
  });

  fastify.get('/admin/redis/keys', { preHandler: adminGuard }, async (request, reply) => {
    const query = request.query as { pattern?: string; cursor?: string };
    const pattern = query.pattern ?? `${REDIS_KEY_PREFIXES[0]}*`;
    const cursor = query.cursor ?? '0';

    if (!isWhitelistedPattern(pattern)) {
      return sendApiError(
        reply,
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST,
        `Pattern must match one of the allowed prefixes: ${[...ALLOWED_PREFIXES].join(', ')}`,
      );
    }

    request.log.info(
      { actor: request.user?.userId, action: 'redis.keys', pattern },
      'admin redis keys list',
    );

    const result = await listByPattern(pattern, cursor);
    return reply.send({ pattern, ...result });
  });

  fastify.get('/admin/redis/key', { preHandler: adminGuard }, async (request, reply) => {
    const query = request.query as { key?: string };
    const key = query.key;
    if (!key) {
      return sendApiError(
        reply,
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST,
        'Missing required query parameter: key',
      );
    }

    const matchesAllowedPrefix = [...ALLOWED_PREFIXES].some((p) => key.startsWith(p));
    if (!matchesAllowedPrefix) {
      return sendApiError(
        reply,
        ERROR_CODES.FORBIDDEN,
        HTTP_STATUS.FORBIDDEN,
        'Key is not in an allowed namespace',
      );
    }

    request.log.info(
      { actor: request.user?.userId, action: 'redis.key.read', key },
      'admin redis key read',
    );

    const redis = getRedisClient();
    const [type, ttl] = await Promise.all([redis.type(key), redis.ttl(key)]);

    let value: unknown = null;
    switch (type) {
      case 'string':
        value = await redis.get(key);
        break;
      case 'list':
        value = await redis.lrange(key, 0, 99);
        break;
      case 'set':
        value = await redis.smembers(key);
        break;
      case 'zset':
        value = await redis.zrange(key, 0, 99, 'WITHSCORES');
        break;
      case 'hash':
        value = await redis.hgetall(key);
        break;
      case 'none':
        return reply.send({ key, type: 'none', ttl: -2, value: null });
      default:
        value = `Unsupported type: ${type}`;
    }

    return reply.send({ key, type, ttl, value });
  });

  /**
   * Operational cache flush. Allowed only against safe namespaces — never
   * `refresh:` (session integrity) or `serial:` (would force a DB reseed).
   */
  fastify.delete('/admin/redis/keys', { preHandler: adminGuard }, async (request, reply) => {
    const query = request.query as { pattern?: string };
    const pattern = query.pattern;
    if (!pattern) {
      return sendApiError(
        reply,
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST,
        'Missing required query parameter: pattern',
      );
    }
    if (!isWhitelistedPattern(pattern)) {
      return sendApiError(
        reply,
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST,
        'Pattern must match an allowed prefix',
      );
    }
    if (pattern.startsWith('refresh:') || pattern.startsWith('serial:')) {
      return sendApiError(
        reply,
        ERROR_CODES.FORBIDDEN,
        HTTP_STATUS.FORBIDDEN,
        'Deleting refresh: or serial: keys via admin API is not allowed',
      );
    }

    request.log.warn(
      { actor: request.user?.userId, action: 'redis.keys.delete', pattern },
      'admin redis pattern delete',
    );

    const redis = getRedisClient();
    let cursor = '0';
    let deleted = 0;
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', SCAN_BATCH);
      cursor = next;
      if (keys.length > 0) {
        deleted += await redis.del(...keys);
      }
    } while (cursor !== '0');

    return reply.send({ pattern, deleted });
  });
}
