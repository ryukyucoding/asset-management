import { describe, it, expect } from 'vitest';
import { resolveApprovalSteps } from '../approvalRouter.service';
import type { ApplicationEntity } from '@domain/entities/application.entity';
import type { AssetEntity } from '@domain/entities/asset.entity';

function makeAsset(category: string): AssetEntity {
  return {
    id: 'asset-1',
    name: 'Test Asset',
    serialNo: 'SN-001',
    category,
    model: null,
    spec: null,
    supplier: null,
    purchaseDate: null,
    purchaseCost: null,
    location: 'Office A',
    assignedDept: null,
    startDate: null,
    warrantyExpiry: null,
    status: 'AVAILABLE',
    holderId: null,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeApp(asset?: AssetEntity): ApplicationEntity {
  return {
    id: 'app-1',
    userId: 'user-1',
    assetId: asset?.id ?? 'asset-1',
    status: 'PENDING',
    faultDescription: 'Screen is cracked',
    imageUrls: [],
    repairDate: null,
    repairContent: null,
    repairSolution: null,
    repairCost: null,
    repairVendor: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    asset,
  };
}

describe('resolveApprovalSteps', () => {
  describe('standard assets — single ADMIN step', () => {
    it('returns one ADMIN step for IT設備', () => {
      const steps = resolveApprovalSteps(makeApp(makeAsset('IT設備')));
      expect(steps).toHaveLength(1);
      expect(steps[0]).toEqual({ role: 'ADMIN', step: 1 });
    });

    it('returns one ADMIN step for 辦公設備', () => {
      const steps = resolveApprovalSteps(makeApp(makeAsset('辦公設備')));
      expect(steps).toHaveLength(1);
    });

    it('returns one ADMIN step for 實驗器材', () => {
      const steps = resolveApprovalSteps(makeApp(makeAsset('實驗器材')));
      expect(steps).toHaveLength(1);
    });

    it('returns one ADMIN step for 交通工具', () => {
      const steps = resolveApprovalSteps(makeApp(makeAsset('交通工具')));
      expect(steps).toHaveLength(1);
    });

    it('returns one ADMIN step when asset is undefined', () => {
      const steps = resolveApprovalSteps(makeApp(undefined));
      expect(steps).toHaveLength(1);
      expect(steps[0].role).toBe('ADMIN');
    });
  });

  describe('high-value assets — two steps (ADMIN + SENIOR_ADMIN)', () => {
    it.each(['HIGH_VALUE', 'SERVER', 'EQUIPMENT'])(
      'adds SENIOR_ADMIN second step for category "%s"',
      (category) => {
        const steps = resolveApprovalSteps(makeApp(makeAsset(category)));
        expect(steps).toHaveLength(2);
        expect(steps[0]).toEqual({ role: 'ADMIN', step: 1 });
        expect(steps[1]).toEqual({ role: 'SENIOR_ADMIN', step: 2 });
      },
    );
  });

  describe('step ordering and immutability', () => {
    it('always starts with ADMIN at step 1', () => {
      const steps = resolveApprovalSteps(makeApp(makeAsset('SERVER')));
      expect(steps[0].step).toBe(1);
      expect(steps[1].step).toBe(2);
    });

    it('returns a new array on every call (no shared state)', () => {
      const app = makeApp(makeAsset('IT設備'));
      const a = resolveApprovalSteps(app);
      const b = resolveApprovalSteps(app);
      expect(a).not.toBe(b);
    });
  });
});
