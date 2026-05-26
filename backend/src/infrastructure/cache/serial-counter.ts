import { increment } from './redis.client';
import { redisKeys } from './redis.keys';

/**
 * Atomically increment serial number counter for a category prefix.
 * Returns null if Redis is unavailable (caller should fall back to DB scan).
 */
export async function nextSerialNumber(prefix: string): Promise<number | null> {
  try {
    return await increment(redisKeys.serial(prefix));
  } catch {
    return null;
  }
}

export function formatSerialNo(prefix: string, num: number): string {
  return `${prefix}-${String(num).padStart(8, '0')}`;
}
