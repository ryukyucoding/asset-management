import { prisma } from '@infrastructure/database/prisma.client';
import type { INotificationRepository, NotificationEntity } from '@domain/repositories/notification.repository.interface';

export class NotificationRepository implements INotificationRepository {
  async findByUserId(userId: string): Promise<NotificationEntity[]> {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: { userId: string; type: string; message: string }): Promise<NotificationEntity> {
    return prisma.notification.create({ data });
  }

  async markAsRead(id: string): Promise<NotificationEntity> {
    return prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  }
}
