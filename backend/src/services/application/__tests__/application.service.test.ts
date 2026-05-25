import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApplicationService } from '../application.service';
import type { IApplicationRepository } from '@domain/repositories/application.repository.interface';
import type { IAssetRepository } from '@domain/repositories/asset.repository.interface';
import type { IApprovalRepository } from '@domain/repositories/approval.repository.interface';
import type { NotificationService } from '@services/notification/notification.service';
import type { ApplicationEntity } from '@domain/entities/application.entity';
import type { AssetEntity } from '@domain/entities/asset.entity';
import { AppError } from '@domain/errors/app.errors';

const APP_ID = 'cltest00000000000000000002';
const ASSET_ID = 'cltest00000000000000000001';

function makeAsset(overrides: Partial<AssetEntity> = {}): AssetEntity {
  return {
    id: ASSET_ID,
    name: 'MacBook Pro',
    serialNo: 'MBP-001',
    category: 'IT設備',
    model: null, spec: null, supplier: null,
    purchaseDate: null, purchaseCost: null,
    location: 'Office A', assignedDept: null,
    startDate: null, warrantyExpiry: null,
    status: 'AVAILABLE',
    holderId: null, description: null, imageUrls: [],
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

function makeApp(overrides: Partial<ApplicationEntity> = {}): ApplicationEntity {
  return {
    id: APP_ID,
    userId: 'user-1',
    assetId: ASSET_ID,
    status: 'PENDING',
    faultDescription: 'Screen has dead pixels',
    imageUrls: [],
    repairDate: null, repairContent: null,
    repairSolution: null, repairCost: null, repairVendor: null,
    createdAt: new Date(), updatedAt: new Date(),
    asset: makeAsset(),
    ...overrides,
  };
}

const mockApplicationRepo: IApplicationRepository = {
  findById: vi.fn(),
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

const mockAssetRepo: IAssetRepository = {
  findById: vi.fn(),
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockApprovalRepo: IApprovalRepository = {
  create: vi.fn().mockResolvedValue({}),
};

const mockNotificationService = {
  notifyApplicationSubmitted: vi.fn().mockResolvedValue(undefined),
  notifyApplicationRejected: vi.fn().mockResolvedValue(undefined),
  notifyPendingSeniorApproval: vi.fn().mockResolvedValue(undefined),
  notifyApplicationApproved: vi.fn().mockResolvedValue(undefined),
  notifyRepairCompleted: vi.fn().mockResolvedValue(undefined),
} as unknown as NotificationService;

describe('ApplicationService', () => {
  let service: ApplicationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ApplicationService(
      mockApplicationRepo,
      mockAssetRepo,
      mockApprovalRepo,
      mockNotificationService,
    );
  });

  describe('list', () => {
    it('scopes USER queries to own userId', async () => {
      vi.mocked(mockApplicationRepo.findAll).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

      await service.list({ page: 1, limit: 20 }, { userId: 'user-1', role: 'USER' });

      expect(mockApplicationRepo.findAll).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
    });

    it('allows ADMIN to query all applications', async () => {
      vi.mocked(mockApplicationRepo.findAll).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

      await service.list({ page: 1, limit: 20 }, { userId: 'admin-1', role: 'ADMIN' });

      expect(mockApplicationRepo.findAll).toHaveBeenCalledWith(expect.objectContaining({ userId: undefined }));
    });
  });

  describe('getById', () => {
    it('throws NOT_FOUND when application does not exist', async () => {
      vi.mocked(mockApplicationRepo.findById).mockResolvedValue(null);

      await expect(
        service.getById(APP_ID, { userId: 'user-1', role: 'USER' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws FORBIDDEN when USER accesses another user application', async () => {
      vi.mocked(mockApplicationRepo.findById).mockResolvedValue(makeApp({ userId: 'other-user' }));

      await expect(
        service.getById(APP_ID, { userId: 'user-1', role: 'USER' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('submit', () => {
    it('creates application and marks asset as PENDING_REPAIR', async () => {
      vi.mocked(mockAssetRepo.findById).mockResolvedValue(makeAsset());
      vi.mocked(mockApplicationRepo.create).mockResolvedValue(makeApp());

      const result = await service.submit('user-1', {
        assetId: ASSET_ID,
        faultDescription: 'Screen has dead pixels',
        imageUrls: [],
      });

      expect(result.status).toBe('PENDING');
      expect(mockAssetRepo.update).toHaveBeenCalledWith(ASSET_ID, { status: 'PENDING_REPAIR' });
      expect(mockNotificationService.notifyApplicationSubmitted).toHaveBeenCalledWith('MacBook Pro');
    });

    it('throws NOT_FOUND when asset does not exist', async () => {
      vi.mocked(mockAssetRepo.findById).mockResolvedValue(null);

      await expect(service.submit('user-1', {
        assetId: ASSET_ID,
        faultDescription: 'Screen has dead pixels',
        imageUrls: [],
      })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws CONFLICT when asset is not available', async () => {
      vi.mocked(mockAssetRepo.findById).mockResolvedValue(makeAsset({ status: 'IN_REPAIR' }));

      await expect(service.submit('user-1', {
        assetId: ASSET_ID,
        faultDescription: 'Screen has dead pixels',
        imageUrls: [],
      })).rejects.toMatchObject({ code: 'CONFLICT' });
    });
  });

  describe('update', () => {
    it('updates PENDING application for owner', async () => {
      vi.mocked(mockApplicationRepo.findById).mockResolvedValue(makeApp({ userId: 'user-1', status: 'PENDING' }));
      vi.mocked(mockApplicationRepo.update).mockResolvedValue(makeApp({ faultDescription: 'Updated fault' }));

      const result = await service.update(APP_ID, 'user-1', { faultDescription: 'Updated fault description' });

      expect(result.faultDescription).toBe('Updated fault');
    });

    it('throws CONFLICT when application is not PENDING', async () => {
      vi.mocked(mockApplicationRepo.findById).mockResolvedValue(makeApp({ status: 'IN_REPAIR' }));

      await expect(
        service.update(APP_ID, 'user-1', { faultDescription: 'Updated fault description' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });
  });

  describe('approve', () => {
    it('ADMIN approves general asset → IN_REPAIR', async () => {
      vi.mocked(mockApplicationRepo.findById).mockResolvedValue(makeApp({ status: 'PENDING' }));
      vi.mocked(mockApplicationRepo.update).mockResolvedValue(makeApp({ status: 'IN_REPAIR' }));

      const result = await service.approve(APP_ID, { userId: 'admin-1', role: 'ADMIN' }, { action: 'APPROVED' });

      expect(result.status).toBe('IN_REPAIR');
      expect(mockAssetRepo.update).toHaveBeenCalledWith(ASSET_ID, { status: 'IN_REPAIR' });
      expect(mockNotificationService.notifyApplicationApproved).toHaveBeenCalledWith('user-1', 'MacBook Pro');
    });

    it('ADMIN approves high-value asset → PENDING_SENIOR_APPROVAL', async () => {
      vi.mocked(mockApplicationRepo.findById).mockResolvedValue(makeApp({
        status: 'PENDING',
        asset: makeAsset({ category: 'HIGH_VALUE' }),
      }));
      vi.mocked(mockApplicationRepo.update).mockResolvedValue(makeApp({ status: 'PENDING_SENIOR_APPROVAL' }));

      await service.approve(APP_ID, { userId: 'admin-1', role: 'ADMIN' }, { action: 'APPROVED' });

      expect(mockApplicationRepo.update).toHaveBeenCalledWith(APP_ID, { status: 'PENDING_SENIOR_APPROVAL' });
      expect(mockNotificationService.notifyPendingSeniorApproval).toHaveBeenCalledWith('MacBook Pro');
      expect(mockAssetRepo.update).not.toHaveBeenCalled();
    });

    it('ADMIN rejects → REJECTED and asset restored to AVAILABLE', async () => {
      vi.mocked(mockApplicationRepo.findById).mockResolvedValue(makeApp({ status: 'PENDING' }));
      vi.mocked(mockApplicationRepo.update).mockResolvedValue(makeApp({ status: 'REJECTED' }));

      await service.approve(APP_ID, { userId: 'admin-1', role: 'ADMIN' }, { action: 'REJECTED', comment: 'No budget' });

      expect(mockAssetRepo.update).toHaveBeenCalledWith(ASSET_ID, { status: 'AVAILABLE' });
      expect(mockNotificationService.notifyApplicationRejected).toHaveBeenCalledWith('user-1', 'MacBook Pro', 'No budget');
    });

    it('throws FORBIDDEN when role does not match approval step', async () => {
      vi.mocked(mockApplicationRepo.findById).mockResolvedValue(makeApp({ status: 'PENDING' }));

      await expect(
        service.approve(APP_ID, { userId: 'user-1', role: 'USER' }, { action: 'APPROVED' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('updateRepairDetails', () => {
    it('updates repair fields when application is IN_REPAIR', async () => {
      vi.mocked(mockApplicationRepo.findById).mockResolvedValue(makeApp({ status: 'IN_REPAIR' }));
      vi.mocked(mockApplicationRepo.update).mockResolvedValue(makeApp({
        status: 'IN_REPAIR',
        repairVendor: 'TechFix Co.',
      }));

      const result = await service.updateRepairDetails(APP_ID, { repairVendor: 'TechFix Co.', repairCost: 5000 });

      expect(result.repairVendor).toBe('TechFix Co.');
      expect(mockApplicationRepo.update).toHaveBeenCalledWith(APP_ID, expect.objectContaining({
        repairVendor: 'TechFix Co.',
        repairCost: 5000,
      }));
    });

    it('throws CONFLICT when application is not IN_REPAIR', async () => {
      vi.mocked(mockApplicationRepo.findById).mockResolvedValue(makeApp({ status: 'PENDING' }));

      await expect(
        service.updateRepairDetails(APP_ID, { repairVendor: 'TechFix Co.' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });
  });

  describe('complete', () => {
    it('marks application COMPLETED and asset AVAILABLE', async () => {
      vi.mocked(mockApplicationRepo.findById).mockResolvedValue(makeApp({ status: 'IN_REPAIR' }));
      vi.mocked(mockApplicationRepo.update).mockResolvedValue(makeApp({ status: 'COMPLETED' }));

      const result = await service.complete(APP_ID);

      expect(result.status).toBe('COMPLETED');
      expect(mockAssetRepo.update).toHaveBeenCalledWith(ASSET_ID, { status: 'AVAILABLE' });
      expect(mockNotificationService.notifyRepairCompleted).toHaveBeenCalledWith('user-1', 'MacBook Pro');
    });

    it('throws CONFLICT when application is not IN_REPAIR', async () => {
      vi.mocked(mockApplicationRepo.findById).mockResolvedValue(makeApp({ status: 'PENDING' }));

      await expect(service.complete(APP_ID)).rejects.toBeInstanceOf(AppError);
    });
  });
});
