import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '../notification.service';
import type { INotificationRepository } from '@domain/repositories/notification.repository.interface';
import type { IUserRepository } from '@domain/repositories/user.repository.interface';

const mockNotificationRepo: INotificationRepository = {
  findByUserId: vi.fn(),
  create: vi.fn().mockResolvedValue({}),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
};

const mockUserRepo: IUserRepository = {
  findById: vi.fn(),
  findByEmail: vi.fn(),
  findIdsByRole: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationService(mockNotificationRepo, mockUserRepo);
  });

  it('listForUser delegates to repository', async () => {
    vi.mocked(mockNotificationRepo.findByUserId).mockResolvedValue([]);

    await service.listForUser('user-1');

    expect(mockNotificationRepo.findByUserId).toHaveBeenCalledWith('user-1');
  });

  it('markAsRead delegates to repository with user scope', async () => {
    vi.mocked(mockNotificationRepo.markAsRead).mockResolvedValue({
      id: 'n-1', userId: 'user-1', type: 'TEST', message: 'msg', isRead: true, createdAt: new Date(),
    });

    await service.markAsRead('n-1', 'user-1');

    expect(mockNotificationRepo.markAsRead).toHaveBeenCalledWith('n-1', 'user-1');
  });

  it('markAsRead throws when notification is not owned by user', async () => {
    vi.mocked(mockNotificationRepo.markAsRead).mockResolvedValue(null);

    await expect(service.markAsRead('n-1', 'user-1')).rejects.toThrow('Notification not found');
  });

  it('markAllAsRead delegates to repository', async () => {
    await service.markAllAsRead('user-1');

    expect(mockNotificationRepo.markAllAsRead).toHaveBeenCalledWith('user-1');
  });

  it('notifyApplicationSubmitted notifies all admins', async () => {
    vi.mocked(mockUserRepo.findIdsByRole).mockResolvedValue(['admin-1', 'admin-2']);

    await service.notifyApplicationSubmitted('MacBook Pro');

    expect(mockUserRepo.findIdsByRole).toHaveBeenCalledWith('ADMIN');
    expect(mockNotificationRepo.create).toHaveBeenCalledTimes(2);
  });

  it('notifyApplicationRejected sends message to applicant', async () => {
    await service.notifyApplicationRejected('user-1', 'MacBook Pro', 'Not eligible');

    expect(mockNotificationRepo.create).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'APPLICATION_REJECTED',
      message: '你的「MacBook Pro」維修申請已被拒絕：Not eligible',
    });
  });

  it('notifyApplicationApproved sends message to applicant', async () => {
    await service.notifyApplicationApproved('user-1', 'MacBook Pro');

    expect(mockNotificationRepo.create).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'APPLICATION_APPROVED',
      message: '你的「MacBook Pro」維修申請已通過審核，進入維修中',
    });
  });

  it('notifyRepairCompleted sends message to applicant', async () => {
    await service.notifyRepairCompleted('user-1', 'MacBook Pro');

    expect(mockNotificationRepo.create).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'REPAIR_COMPLETED',
      message: '你的「MacBook Pro」已維修完成，可正常使用',
    });
  });
});
