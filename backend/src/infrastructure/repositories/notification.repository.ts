import { prisma } from '@infrastructure/database/prisma.client';
import type { INotificationRepository, NotificationEntity } from '@domain/repositories/notification.repository.interface';
import {
  bumpUnreadCount,
  decrementUnreadCount,
  resetUnreadCount,
} from '@infrastructure/cache/unread-count.cache';
import {
  getCachedNotifications,
  setCachedNotifications,
  invalidateNotificationsCache,
} from '@infrastructure/cache/notifications-list.cache';

export class NotificationRepository implements INotificationRepository {
  async findByUserId(userId: string): Promise<NotificationEntity[]> {
    const cached = await getCachedNotifications(userId);
    if (cached) return cached;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    await setCachedNotifications(userId, notifications);
    return notifications;
  }

  async create(data: { userId: string; type: string; message: string }): Promise<NotificationEntity> {
    const notification = await prisma.notification.create({ data });
    await Promise.all([
      bumpUnreadCount(data.userId),
      invalidateNotificationsCache(data.userId),
    ]);
    return notification;
  }

  async markAsRead(id: string, userId: string): Promise<NotificationEntity | null> {
    const notification = await prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) return null;
    if (notification.isRead) return notification;

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    await Promise.all([
      decrementUnreadCount(userId),
      invalidateNotificationsCache(userId),
    ]);
    return updated;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    await Promise.all([
      resetUnreadCount(userId),
      invalidateNotificationsCache(userId),
    ]);
  }
}
