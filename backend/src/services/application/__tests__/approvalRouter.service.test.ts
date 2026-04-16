import { describe, it, expect } from 'vitest';
import { resolveApprovalSteps } from '../approvalRouter.service';
import type { ApplicationEntity } from '@domain/entities/application.entity';

function makeApplication(overrides: Partial<ApplicationEntity> = {}): ApplicationEntity {
  return {
    id: 'app-1',
    userId: 'user-1',
    assetId: 'asset-1',
    type: 'BORROW',
    status: 'PENDING',
    returnDate: new Date(),
    reason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id: 'user-1', name: 'User', email: 'u@x.com', role: 'USER', department: 'Engineering', createdAt: new Date(), updatedAt: new Date() },
    asset: { id: 'asset-1', name: 'Laptop', serialNo: 'LP-001', category: 'LAPTOP', location: 'Engineering', status: 'AVAILABLE', holderId: null, description: null, createdAt: new Date(), updatedAt: new Date() },
    ...overrides,
  };
}

describe('resolveApprovalSteps', () => {
  it('returns single ADMIN step for normal request', () => {
    const app = makeApplication();
    const steps = resolveApprovalSteps(app);
    expect(steps).toHaveLength(1);
    expect(steps[0].role).toBe('ADMIN');
  });

  it('adds SENIOR_ADMIN step for HIGH_VALUE category', () => {
    const app = makeApplication({
      asset: { id: 'a', name: 'Switch', serialNo: 'SW-001', category: 'HIGH_VALUE', location: 'Engineering', status: 'AVAILABLE', holderId: null, description: null, createdAt: new Date(), updatedAt: new Date() },
    });
    const steps = resolveApprovalSteps(app);
    expect(steps).toHaveLength(2);
    expect(steps.map(s => s.role)).toContain('SENIOR_ADMIN');
  });

  it('adds SENIOR_ADMIN step for SERVER category', () => {
    const app = makeApplication({
      asset: { id: 'a', name: 'Server', serialNo: 'SV-001', category: 'SERVER', location: 'Engineering', status: 'AVAILABLE', holderId: null, description: null, createdAt: new Date(), updatedAt: new Date() },
    });
    const steps = resolveApprovalSteps(app);
    expect(steps.map(s => s.role)).toContain('SENIOR_ADMIN');
  });

  it('adds DEPT_MANAGER step for cross-department request', () => {
    const app = makeApplication({
      user: { id: 'u', name: 'U', email: 'u@x.com', role: 'USER', department: 'Sales', createdAt: new Date(), updatedAt: new Date() },
      asset: { id: 'a', name: 'Monitor', serialNo: 'MN-001', category: 'MONITOR', location: 'IT', status: 'AVAILABLE', holderId: null, description: null, createdAt: new Date(), updatedAt: new Date() },
    });
    const steps = resolveApprovalSteps(app);
    expect(steps.map(s => s.role)).toContain('DEPT_MANAGER');
  });

  it('same department does NOT trigger DEPT_MANAGER', () => {
    const app = makeApplication({
      user: { id: 'u', name: 'U', email: 'u@x.com', role: 'USER', department: 'IT', createdAt: new Date(), updatedAt: new Date() },
      asset: { id: 'a', name: 'Monitor', serialNo: 'MN-001', category: 'MONITOR', location: 'IT', status: 'AVAILABLE', holderId: null, description: null, createdAt: new Date(), updatedAt: new Date() },
    });
    const steps = resolveApprovalSteps(app);
    expect(steps.map(s => s.role)).not.toContain('DEPT_MANAGER');
  });

  it('HIGH_VALUE + cross-department = 3 steps', () => {
    const app = makeApplication({
      user: { id: 'u', name: 'U', email: 'u@x.com', role: 'USER', department: 'Sales', createdAt: new Date(), updatedAt: new Date() },
      asset: { id: 'a', name: 'Server', serialNo: 'SV-001', category: 'HIGH_VALUE', location: 'IT', status: 'AVAILABLE', holderId: null, description: null, createdAt: new Date(), updatedAt: new Date() },
    });
    const steps = resolveApprovalSteps(app);
    expect(steps).toHaveLength(3);
  });
});
