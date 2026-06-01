import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { prisma } from '@infrastructure/database/prisma.client';
import { hashPassword } from '@services/auth/auth.service';
import { deleteByPattern } from '@infrastructure/cache/redis.client';

const TEST_PREFIX = 'integration-test';

async function resetWorkflowData(): Promise<void> {
  await prisma.approval.deleteMany({
    where: { application: { asset: { serialNo: { startsWith: TEST_PREFIX } } } },
  });
  await prisma.notification.deleteMany({
    where: { user: { email: { contains: TEST_PREFIX } } },
  });
  await prisma.application.deleteMany({
    where: { asset: { serialNo: { startsWith: TEST_PREFIX } } },
  });
  await prisma.asset.deleteMany({ where: { serialNo: { startsWith: TEST_PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { contains: TEST_PREFIX } } });
  // Flush user-role cache so stale IDs from deleted test users don't survive between tests.
  await Promise.allSettled([
    deleteByPattern('cache:user-by-role:*'),
    deleteByPattern('cache:user:*'),
    deleteByPattern('cache:users:*'),
  ]);
}

async function seedBasicUsers() {
  const user = await prisma.user.upsert({
    where: { email: `${TEST_PREFIX}-user@example.com` },
    update: {},
    create: {
      name: 'Integration User',
      email: `${TEST_PREFIX}-user@example.com`,
      passwordHash: hashPassword('User1234'),
      role: 'USER',
      department: 'QA',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: `${TEST_PREFIX}-admin@example.com` },
    update: {},
    create: {
      name: 'Integration Admin',
      email: `${TEST_PREFIX}-admin@example.com`,
      passwordHash: hashPassword('Admin1234'),
      role: 'ADMIN',
      department: 'IT',
    },
  });

  return { user, admin };
}

async function seedAsset(category = 'IT設備') {
  return prisma.asset.create({
    data: {
      name: `${TEST_PREFIX} Laptop`,
      serialNo: `${TEST_PREFIX}-${randomUUID()}`,
      category,
      location: 'Lab',
      status: 'AVAILABLE',
    },
  });
}

async function login(app: FastifyInstance, email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password },
  });
  expect(res.statusCode).toBe(200);
  return res.json().accessToken as string;
}

describe('Application workflow (integration)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.STORAGE_DRIVER = 'local';
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await resetWorkflowData();
  });

  afterAll(async () => {
    await resetWorkflowData();
    await app.close();
    await prisma.$disconnect();
  });

  it('Apply → Admin approve → complete restores asset to AVAILABLE', async () => {
    const { user, admin } = await seedBasicUsers();
    const asset = await seedAsset();

    const userToken = await login(app, user.email, 'User1234');
    const adminToken = await login(app, admin.email, 'Admin1234');

    const createRes = await app.inject({
      method: 'POST',
      url: '/applications',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        assetId: asset.id,
        faultDescription: 'Keyboard keys are stuck',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const applicationId = createRes.json().id as string;

    const assetPending = await prisma.asset.findUnique({ where: { id: asset.id } });
    expect(assetPending?.status).toBe('PENDING_REPAIR');

    const approveRes = await app.inject({
      method: 'PATCH',
      url: `/applications/${applicationId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { action: 'APPROVED', comment: 'Approved for repair' },
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().status).toBe('IN_REPAIR');

    const repairRes = await app.inject({
      method: 'PATCH',
      url: `/applications/${applicationId}/repair-details`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        repairVendor: 'TechFix Co.',
        repairCost: 1200,
        repairContent: 'Replaced keyboard module',
      },
    });
    expect(repairRes.statusCode).toBe(200);

    const completeRes = await app.inject({
      method: 'PATCH',
      url: `/applications/${applicationId}/complete`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.json().status).toBe('COMPLETED');

    const assetFinal = await prisma.asset.findUnique({ where: { id: asset.id } });
    expect(assetFinal?.status).toBe('AVAILABLE');

    const approvals = await prisma.approval.count({ where: { applicationId } });
    expect(approvals).toBe(1);

    const userNotifications = await prisma.notification.findMany({ where: { userId: user.id } });
    expect(userNotifications.some((n) => n.type === 'APPLICATION_APPROVED')).toBe(true);
    expect(userNotifications.some((n) => n.type === 'REPAIR_COMPLETED')).toBe(true);
  });

  it('Admin reject restores asset to AVAILABLE', async () => {
    const { user, admin } = await seedBasicUsers();
    const asset = await seedAsset();

    const userToken = await login(app, user.email, 'User1234');
    const adminToken = await login(app, admin.email, 'Admin1234');

    const createRes = await app.inject({
      method: 'POST',
      url: '/applications',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        assetId: asset.id,
        faultDescription: 'Screen flickering intermittently',
      },
    });
    const applicationId = createRes.json().id as string;

    const rejectRes = await app.inject({
      method: 'PATCH',
      url: `/applications/${applicationId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { action: 'REJECTED', comment: 'User error, not hardware fault' },
    });
    expect(rejectRes.statusCode).toBe(200);
    expect(rejectRes.json().status).toBe('REJECTED');

    const assetFinal = await prisma.asset.findUnique({ where: { id: asset.id } });
    expect(assetFinal?.status).toBe('AVAILABLE');
  });

  it('High-value asset now uses single ADMIN approval', async () => {
    const { user, admin } = await seedBasicUsers();
    const asset = await seedAsset('HIGH_VALUE');

    const userToken = await login(app, user.email, 'User1234');
    const adminToken = await login(app, admin.email, 'Admin1234');

    const createRes = await app.inject({
      method: 'POST',
      url: '/applications',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        assetId: asset.id,
        faultDescription: 'Power supply failure detected',
      },
    });
    const applicationId = createRes.json().id as string;

    const adminApproveRes = await app.inject({
      method: 'PATCH',
      url: `/applications/${applicationId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { action: 'APPROVED' },
    });
    expect(adminApproveRes.statusCode).toBe(200);
    expect(adminApproveRes.json().status).toBe('IN_REPAIR');

    const assetInRepair = await prisma.asset.findUnique({ where: { id: asset.id } });
    expect(assetInRepair?.status).toBe('IN_REPAIR');

    const approvalSteps = await prisma.approval.findMany({
      where: { applicationId },
      orderBy: { step: 'asc' },
    });
    expect(approvalSteps).toHaveLength(1);
    expect(approvalSteps[0]?.step).toBe(1);
  });
});
