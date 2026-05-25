import type { INotificationRepository, NotificationEntity } from '@domain/repositories/notification.repository.interface';
import type { IUserRepository } from '@domain/repositories/user.repository.interface';

export class NotificationService {
  constructor(
    private readonly notificationRepo: INotificationRepository,
    private readonly userRepo: IUserRepository,
  ) {}

  async listForUser(userId: string): Promise<NotificationEntity[]> {
    return this.notificationRepo.findByUserId(userId);
  }

  async markAsRead(id: string): Promise<NotificationEntity> {
    return this.notificationRepo.markAsRead(id);
  }

  async markAllAsRead(userId: string): Promise<void> {
    return this.notificationRepo.markAllAsRead(userId);
  }

  async notifyApplicationSubmitted(assetName: string): Promise<void> {
    const adminIds = await this.userRepo.findIdsByRole('ADMIN');
    await Promise.all(
      adminIds.map((userId) =>
        this.notificationRepo.create({
          userId,
          type: 'APPLICATION_SUBMITTED',
          message: `「${assetName}」有新的維修申請待審核`,
        }),
      ),
    );
  }

  async notifyApplicationRejected(userId: string, assetName: string, comment?: string): Promise<void> {
    await this.notificationRepo.create({
      userId,
      type: 'APPLICATION_REJECTED',
      message: `你的「${assetName}」維修申請已被拒絕${comment ? `：${comment}` : ''}`,
    });
  }

  async notifyPendingSeniorApproval(assetName: string): Promise<void> {
    const seniorAdminIds = await this.userRepo.findIdsByRole('SENIOR_ADMIN');
    await Promise.all(
      seniorAdminIds.map((userId) =>
        this.notificationRepo.create({
          userId,
          type: 'APPLICATION_PENDING_SENIOR_APPROVAL',
          message: `「${assetName}」維修申請需要您的最終審核`,
        }),
      ),
    );
  }

  async notifyApplicationApproved(userId: string, assetName: string): Promise<void> {
    await this.notificationRepo.create({
      userId,
      type: 'APPLICATION_APPROVED',
      message: `你的「${assetName}」維修申請已通過審核，進入維修中`,
    });
  }

  async notifyRepairCompleted(userId: string, assetName: string): Promise<void> {
    await this.notificationRepo.create({
      userId,
      type: 'REPAIR_COMPLETED',
      message: `你的「${assetName}」已維修完成，可正常使用`,
    });
  }
}
