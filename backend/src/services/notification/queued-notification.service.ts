import type { NotificationEntity } from '@domain/repositories/notification.repository.interface';
import type { IUserRepository } from '@domain/repositories/user.repository.interface';
import type { INotificationRepository } from '@domain/repositories/notification.repository.interface';
import { NotificationService } from './notification.service';
import { enqueueNotification } from '@infrastructure/queue/notification.queue';

/**
 * Enqueues notification side-effects via BullMQ; falls back to sync on Redis failure.
 */
export class QueuedNotificationService extends NotificationService {
  constructor(
    notificationRepo: INotificationRepository,
    userRepo: IUserRepository,
  ) {
    super(notificationRepo, userRepo);
  }

  override async notifyApplicationSubmitted(assetName: string): Promise<void> {
    await enqueueNotification({ type: 'APPLICATION_SUBMITTED', assetName });
  }

  override async notifyApplicationRejected(
    userId: string,
    assetName: string,
    comment?: string,
  ): Promise<void> {
    await enqueueNotification({ type: 'APPLICATION_REJECTED', userId, assetName, comment });
  }

  override async notifyApplicationApproved(userId: string, assetName: string): Promise<void> {
    await enqueueNotification({ type: 'APPLICATION_APPROVED', userId, assetName });
  }

  override async notifyRepairCompleted(userId: string, assetName: string): Promise<void> {
    await enqueueNotification({ type: 'REPAIR_COMPLETED', userId, assetName });
  }

  // list / markAsRead remain synchronous (read from PG)
  override listForUser(userId: string): Promise<NotificationEntity[]> {
    return super.listForUser(userId);
  }
}
