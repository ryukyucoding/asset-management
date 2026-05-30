import type { FastifyReply, FastifyRequest, preHandlerHookHandler, onSendHookHandler } from 'fastify';
import { getRedisClient } from '@infrastructure/cache/redis.client';
import { redisKeys } from '@infrastructure/cache/redis.keys';
import { ERROR_CODES, HTTP_STATUS } from '@constants/error.constants';
import { sendApiError } from '@domain/errors/error-response';

const IDEMPOTENCY_TTL_SECONDS = 10 * 60; // 10 min
const IN_FLIGHT_MARKER = '__in_flight__';

interface CachedResponse {
  statusCode: number;
  body: string;
  contentType: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    idempotencyKey?: string;
  }
}

/**
 * Idempotency-Key support for state-changing endpoints (RFC draft semantics).
 *
 * - Client sends `Idempotency-Key: <opaque-string>` header.
 * - First request: lock the key with TTL 10 min, store the final response on `onSend`.
 * - Replay with same key: replay the cached response.
 * - Replay while the original is still in-flight: respond 409 Conflict.
 *
 * Keyed per-user to avoid cross-tenant collisions. Falls open if Redis is
 * unavailable — better to allow duplicate-but-rare writes than to block.
 */
export const idempotencyMiddleware: preHandlerHookHandler = async (request, reply) => {
  const headerKey = request.headers['idempotency-key'];
  if (!headerKey || typeof headerKey !== 'string') return;
  if (!request.user?.userId) return;

  if (headerKey.length > 128 || !/^[A-Za-z0-9._:\-]+$/.test(headerKey)) {
    return sendApiError(
      reply,
      ERROR_CODES.VALIDATION_ERROR,
      HTTP_STATUS.BAD_REQUEST,
      'Idempotency-Key must be 1-128 chars matching [A-Za-z0-9._:\\-]',
    );
  }

  const redisKey = redisKeys.idempotency(request.user.userId, headerKey);
  request.idempotencyKey = redisKey;

  try {
    const redis = getRedisClient();
    const ok = await redis.set(redisKey, IN_FLIGHT_MARKER, 'EX', IDEMPOTENCY_TTL_SECONDS, 'NX');

    if (ok === 'OK') {
      // First request — proceed and let the onSend hook record the response.
      return;
    }

    // Key existed: either still in-flight or response cached.
    const existing = await redis.get(redisKey);
    if (!existing || existing === IN_FLIGHT_MARKER) {
      return sendApiError(
        reply,
        ERROR_CODES.CONFLICT,
        HTTP_STATUS.CONFLICT,
        'A request with this Idempotency-Key is already in flight',
      );
    }

    try {
      const cached = JSON.parse(existing) as CachedResponse;
      return reply
        .status(cached.statusCode)
        .header('content-type', cached.contentType)
        .header('idempotency-replayed', 'true')
        .send(cached.body);
    } catch {
      // Corrupted cache entry — let the handler run again rather than 500.
      await redis.del(redisKey);
    }
  } catch (err: unknown) {
    request.log.warn({ err }, 'Idempotency cache unavailable; falling open');
  }
};

export const idempotencyOnSend: onSendHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
) => {
  if (!request.idempotencyKey) return payload;
  // Only cache successful responses — failures should be retryable.
  if (reply.statusCode >= 500) return payload;

  let bodyString: string | undefined;
  if (typeof payload === 'string') {
    bodyString = payload;
  } else if (payload instanceof Buffer) {
    bodyString = payload.toString('utf8');
  }
  if (bodyString === undefined) return payload;

  const cached: CachedResponse = {
    statusCode: reply.statusCode,
    body: bodyString,
    contentType: String(reply.getHeader('content-type') ?? 'application/json'),
  };

  try {
    await getRedisClient().set(
      request.idempotencyKey,
      JSON.stringify(cached),
      'EX',
      IDEMPOTENCY_TTL_SECONDS,
    );
  } catch (err: unknown) {
    request.log.warn({ err }, 'Failed to persist idempotent response');
  }
  return payload;
};
