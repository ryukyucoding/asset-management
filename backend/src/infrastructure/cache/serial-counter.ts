import { getRedisClient } from './redis.client';
import { redisKeys } from './redis.keys';
import { prisma } from '@infrastructure/database/prisma.client';

/**
 * Allocate the next serial number for a category prefix.
 *
 * Redis is an accelerator, not the source of truth. On cache miss (cold start,
 * Memorystore restart, eviction) the counter is seeded from `MAX(serialNo)` in
 * Postgres so subsequent INCRs cannot collide with existing rows.
 *
 * Returns null only when Redis is unreachable — caller should fall back to a
 * DB scan.
 */
export async function nextSerialNumber(prefix: string): Promise<number | null> {
  try {
    const redis = getRedisClient();
    const key = redisKeys.serial(prefix);

    const exists = await redis.exists(key);
    if (exists === 0) {
      const seed = await readMaxSerialFromDb(prefix);
      // SET NX is atomic: only one concurrent caller wins the seed write.
      await redis.set(key, String(seed), 'NX');
    }

    return await redis.incr(key);
  } catch {
    return null;
  }
}

async function readMaxSerialFromDb(prefix: string): Promise<number> {
  const existing = await prisma.asset.findMany({
    where: { serialNo: { startsWith: `${prefix}-` } },
    select: { serialNo: true },
  });
  let maxNum = 0;
  for (const a of existing) {
    const num = Number.parseInt(a.serialNo.split('-')[1] ?? '0', 10);
    if (!Number.isNaN(num) && num > maxNum) maxNum = num;
  }
  return maxNum;
}

export function formatSerialNo(prefix: string, num: number): string {
  return `${prefix}-${String(num).padStart(8, '0')}`;
}

/**
 * Force-reseed the counter from DB. Use when a unique-constraint collision on
 * `serialNo` is detected — most likely Redis drifted behind existing rows.
 */
export async function reseedSerialCounter(prefix: string): Promise<number | null> {
  try {
    const redis = getRedisClient();
    const seed = await readMaxSerialFromDb(prefix);
    await redis.set(redisKeys.serial(prefix), String(seed));
    return seed;
  } catch {
    return null;
  }
}
