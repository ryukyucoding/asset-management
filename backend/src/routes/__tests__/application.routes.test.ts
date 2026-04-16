import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { signAccessToken } from '@services/auth/auth.service';
import type { ApplicationEntity } from '@domain/entities/application.entity';
import type { AssetEntity } from '@domain/entities/asset.entity';

// ─── Hoist mock functions ──────────────────────────────────────────────────
const appMocks = vi.hoisted(() => ({
  findAll:  vi.fn(),
  findById: vi.fn(),
  create:   vi.fn(),
  update:   vi.fn(),
}));

const assetMocks = vi.hoisted(() => ({
  findById: vi.fn(),
  update:   vi.fn(),
}));

const prismaMocks = vi.hoisted(() => ({
  approvalCreate: vi.fn(),
}));

vi.mock('@infrastructure/repositories/application.repository', () => ({
  ApplicationRepository: vi.fn().mockImplementation(() => ({
    findAll:  appMocks.findAll,
    findById: appMocks.findById,
    create:   appMocks.create,
    update:   appMocks.update,
  })),
}));

vi.mock('@infrastructure/repositories/asset.repository', () => ({
  AssetRepository: vi.fn().mockImplementation(() => ({
    findAll:  vi.fn(),
    findById: assetMocks.findById,
    create:   vi.fn(),
    update:   assetMocks.update,
    delete:   vi.fn(),
  })),
}));

vi.mock('@infrastructure/database/prisma.client', () => ({
  prisma: {
    approval: {
      create: prismaMocks.approvalCreate,
    },
  },
}));

import { applicationRoutes } from '../application.routes';

// ─── Helpers ───────────────────────────────────────────────────────────────
// Valid CUID v1 format (required by CreateApplicationDTO.assetId)
const ASSET_ID = 'cltest00000000000000000001';
const APP_ID   = 'cltest00000000000000000002';

const userToken  = signAccessToken({ userId: 'user-1', role: 'USER' });
const adminToken = signAccessToken({ userId: 'admin-1', role: 'ADMIN' });

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
    holderId: null, description: null,
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
    ...overrides,
  };
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(applicationRoutes);
  await app.ready();
  return app;
}

// ─── GET /applications ─────────────────────────────────────────────────────

describe('GET /applications', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('401 — unauthenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/applications' });
    expect(res.statusCode).toBe(401);
  });

  it('200 — USER gets own applications (userId filter injected)', async () => {
    appMocks.findAll.mockResolvedValue({ data: [makeApp()], total: 1, page: 1, limit: 10 });

    const res = await app.inject({
      method: 'GET',
      url: '/applications',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(appMocks.findAll).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
  });

  it('200 — ADMIN gets all applications (no userId filter)', async () => {
    appMocks.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 });

    const res = await app.inject({
      method: 'GET',
      url: '/applications',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(appMocks.findAll).toHaveBeenCalledWith(expect.objectContaining({ userId: undefined }));
  });
});

// ─── GET /applications/:id ─────────────────────────────────────────────────

describe('GET /applications/:id', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('200 — owner can access own application', async () => {
    appMocks.findById.mockResolvedValue(makeApp({ userId: 'user-1' }));

    const res = await app.inject({
      method: 'GET',
      url: `/applications/${APP_ID}`,
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('403 — USER cannot access another user\'s application', async () => {
    appMocks.findById.mockResolvedValue(makeApp({ userId: 'other-user' }));

    const res = await app.inject({
      method: 'GET',
      url: `/applications/${APP_ID}`,
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('200 — ADMIN can access any application', async () => {
    appMocks.findById.mockResolvedValue(makeApp({ userId: 'other-user' }));

    const res = await app.inject({
      method: 'GET',
      url: `/applications/${APP_ID}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('404 — application not found', async () => {
    appMocks.findById.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/applications/nonexistent',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ─── POST /applications ────────────────────────────────────────────────────

describe('POST /applications', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('201 — creates repair request for available asset', async () => {
    assetMocks.findById.mockResolvedValue(makeAsset({ status: 'AVAILABLE' }));
    appMocks.create.mockResolvedValue(makeApp());

    const res = await app.inject({
      method: 'POST',
      url: '/applications',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { assetId: ASSET_ID, faultDescription: 'Screen has dead pixels' },
    });

    expect(res.statusCode).toBe(201);
    expect(appMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        assetId: ASSET_ID,
        status: 'PENDING',
        faultDescription: 'Screen has dead pixels',
      }),
    );
  });

  it('409 — asset is already IN_REPAIR', async () => {
    assetMocks.findById.mockResolvedValue(makeAsset({ status: 'IN_REPAIR' }));

    const res = await app.inject({
      method: 'POST',
      url: '/applications',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { assetId: ASSET_ID, faultDescription: 'Broken keyboard' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('CONFLICT');
  });

  it('404 — asset not found', async () => {
    assetMocks.findById.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/applications',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { assetId: 'cltest00000000000000099999', faultDescription: 'Some fault here' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('400 — faultDescription too short (< 5 chars)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/applications',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { assetId: ASSET_ID, faultDescription: 'X' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('401 — unauthenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/applications',
      payload: { assetId: ASSET_ID, faultDescription: 'Test fault here' },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ─── PATCH /applications/:id/approve ──────────────────────────────────────

describe('PATCH /applications/:id/approve', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    prismaMocks.approvalCreate.mockResolvedValue({});
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('403 — USER cannot approve', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/applications/${APP_ID}/approve`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { action: 'APPROVED' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('200 — ADMIN approves: status → IN_REPAIR, asset → IN_REPAIR', async () => {
    appMocks.findById.mockResolvedValue(makeApp({ status: 'PENDING' }));
    appMocks.update.mockResolvedValue(makeApp({ status: 'IN_REPAIR' }));

    const res = await app.inject({
      method: 'PATCH',
      url: `/applications/${APP_ID}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { action: 'APPROVED' },
    });

    expect(res.statusCode).toBe(200);
    expect(assetMocks.update).toHaveBeenCalledWith(ASSET_ID, { status: 'IN_REPAIR' });
  });

  it('200 — ADMIN rejects: status → REJECTED, asset NOT updated', async () => {
    appMocks.findById.mockResolvedValue(makeApp({ status: 'PENDING' }));
    appMocks.update.mockResolvedValue(makeApp({ status: 'REJECTED' }));

    const res = await app.inject({
      method: 'PATCH',
      url: `/applications/${APP_ID}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { action: 'REJECTED', comment: 'Not eligible' },
    });

    expect(res.statusCode).toBe(200);
    expect(assetMocks.update).not.toHaveBeenCalled();
  });

  it('409 — application is not PENDING', async () => {
    appMocks.findById.mockResolvedValue(makeApp({ status: 'IN_REPAIR' }));

    const res = await app.inject({
      method: 'PATCH',
      url: `/applications/${APP_ID}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { action: 'APPROVED' },
    });

    expect(res.statusCode).toBe(409);
  });

  it('404 — application not found', async () => {
    appMocks.findById.mockResolvedValue(null);

    const res = await app.inject({
      method: 'PATCH',
      url: '/applications/nonexistent/approve',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { action: 'APPROVED' },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ─── PATCH /applications/:id/repair-details ────────────────────────────────

describe('PATCH /applications/:id/repair-details', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('200 — ADMIN fills repair details', async () => {
    appMocks.findById.mockResolvedValue(makeApp({ status: 'IN_REPAIR' }));
    appMocks.update.mockResolvedValue(makeApp({ status: 'IN_REPAIR', repairVendor: 'TechFix Co.' }));

    const res = await app.inject({
      method: 'PATCH',
      url: `/applications/${APP_ID}/repair-details`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { repairVendor: 'TechFix Co.', repairCost: 5000 },
    });

    expect(res.statusCode).toBe(200);
    expect(appMocks.update).toHaveBeenCalledWith(
      APP_ID,
      expect.objectContaining({ repairVendor: 'TechFix Co.', repairCost: 5000 }),
    );
  });

  it('409 — application is not IN_REPAIR', async () => {
    appMocks.findById.mockResolvedValue(makeApp({ status: 'PENDING' }));

    const res = await app.inject({
      method: 'PATCH',
      url: `/applications/${APP_ID}/repair-details`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { repairVendor: 'TechFix Co.' },
    });

    expect(res.statusCode).toBe(409);
  });

  it('403 — USER cannot update repair details', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/applications/${APP_ID}/repair-details`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
  });
});

// ─── PATCH /applications/:id/complete ─────────────────────────────────────

describe('PATCH /applications/:id/complete', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('200 — ADMIN completes repair; asset status resets to AVAILABLE', async () => {
    appMocks.findById.mockResolvedValue(makeApp({ status: 'IN_REPAIR' }));
    appMocks.update.mockResolvedValue(makeApp({ status: 'COMPLETED' }));

    const res = await app.inject({
      method: 'PATCH',
      url: `/applications/${APP_ID}/complete`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(appMocks.update).toHaveBeenCalledWith(APP_ID, { status: 'COMPLETED' });
    expect(assetMocks.update).toHaveBeenCalledWith(ASSET_ID, { status: 'AVAILABLE' });
  });

  it('409 — application is not IN_REPAIR', async () => {
    appMocks.findById.mockResolvedValue(makeApp({ status: 'PENDING' }));

    const res = await app.inject({
      method: 'PATCH',
      url: `/applications/${APP_ID}/complete`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(409);
  });

  it('403 — USER cannot complete repair', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/applications/${APP_ID}/complete`,
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
