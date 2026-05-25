export interface NotificationEntity {
  id: string;
  userId: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export interface INotificationRepository {
  findByUserId(userId: string): Promise<NotificationEntity[]>;
  create(data: { userId: string; type: string; message: string }): Promise<NotificationEntity>;
  markAsRead(id: string, userId: string): Promise<NotificationEntity | null>;
  markAllAsRead(userId: string): Promise<void>;
}
