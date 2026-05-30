import type { NotificationEntity } from '@domain/repositories/notification.repository.interface';
import { getString, setString, deleteKey } from './redis.client';
import { redisKeys } from './redis.keys';
import { recordCacheHit, recordCacheMiss } from './cache-metrics';

const NOTIFICATIONS_TTL_SECONDS = 120; // 2 min — notifications evolve faster than other lists

interface CachedNotification extends Omit<NotificationEntity, 'createdAt'> {
  createdAt: string;
}

export async function getCachedNotifications(
  userId: string,
): Promise<NotificationEntity[] | null> {
  const raw = await getString(redisKeys.cacheNotifications(userId));
  if (!raw) {
    recordCacheMiss('notifications');
    return null;
  }
  try {
    recordCacheHit('notifications');
    const parsed = JSON.parse(raw) as CachedNotification[];
    return parsed.map((n) => ({ ...n, createdAt: new Date(n.createdAt) }));
  } catch {
    recordCacheMiss('notifications');
    return null;
  }
}

export async function setCachedNotifications(
  userId: string,
  notifications: NotificationEntity[],
): Promise<void> {
  const serialized: CachedNotification[] = notifications.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
  }));
  await setString(
    redisKeys.cacheNotifications(userId),
    JSON.stringify(serialized),
    NOTIFICATIONS_TTL_SECONDS,
  );
}

export async function invalidateNotificationsCache(userId: string): Promise<void> {
  await deleteKey(redisKeys.cacheNotifications(userId));
}
