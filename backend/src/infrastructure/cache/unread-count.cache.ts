import { getRedisClient } from './redis.client';
import { redisKeys } from './redis.keys';
import { recordCacheHit, recordCacheMiss } from './cache-metrics';
import { prisma } from '@infrastructure/database/prisma.client';

/**
 * Per-user unread notification count.
 *
 * Strategy: lazy init from DB on first read, then maintain via INCR/DECR on
 * notification create / mark-read. On INCR/DECR failure we delete the key so
 * the next read forces a re-seed from DB — counter can never drift permanently.
 *
 * Redis is again the accelerator, not the source of truth.
 */
const UNREAD_TTL_SECONDS = 24 * 60 * 60; // 24h — re-seed from DB at least daily

export async function getUnreadCount(userId: string): Promise<number> {
  const key = redisKeys.unread(userId);
  try {
    const cached = await getRedisClient().get(key);
    if (cached !== null) {
      recordCacheHit('unread');
      return Number(cached);
    }
  } catch {
    // fall through
  }
  recordCacheMiss('unread');
  const count = await prisma.notification.count({ where: { userId, isRead: false } });
  try {
    await getRedisClient().set(key, String(count), 'EX', UNREAD_TTL_SECONDS);
  } catch {
    // best-effort
  }
  return count;
}

export async function bumpUnreadCount(userId: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const key = redisKeys.unread(userId);
    // Only INCR if the key exists — otherwise the next read will lazy-init from DB.
    const exists = await redis.exists(key);
    if (exists === 1) {
      await redis.incr(key);
    }
  } catch {
    await invalidateUnreadCount(userId);
  }
}

export async function decrementUnreadCount(userId: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const key = redisKeys.unread(userId);
    const exists = await redis.exists(key);
    if (exists === 1) {
      const after = await redis.decr(key);
      if (after < 0) {
        // Counter drifted below 0 — force re-seed from DB on next read.
        await redis.del(key);
      }
    }
  } catch {
    await invalidateUnreadCount(userId);
  }
}

export async function resetUnreadCount(userId: string): Promise<void> {
  try {
    await getRedisClient().set(redisKeys.unread(userId), '0', 'EX', UNREAD_TTL_SECONDS);
  } catch {
    await invalidateUnreadCount(userId);
  }
}

export async function invalidateUnreadCount(userId: string): Promise<void> {
  try {
    await getRedisClient().del(redisKeys.unread(userId));
  } catch {
    // ignore
  }
}
