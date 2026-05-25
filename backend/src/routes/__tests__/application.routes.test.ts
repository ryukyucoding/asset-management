import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { signAccessToken } from '@services/auth/auth.service';
import type { ApplicationEntity } from '@domain/entities/application.entity';
import { AppError } from '@domain/errors/app.errors';

const serviceMocks = vi.hoisted(() => ({
  list:               vi.fn(),
  getById:            vi.fn(),
  submit:             vi.fn(),
  update:             vi.fn(),
  approve:            vi.fn(),
  updateRepairDetails: vi.fn(),
  complete:           vi.fn(),
}));

vi.mock('@services/application/application.service', () => ({
  ApplicationService: vi.fn().mockImplementation(() => serviceMocks),
}));

import { applicationRoutes } from '../application.routes';

const ASSET_ID = 'cltest00000000000000000001';
const APP_ID   = 'cltest00000000000000000002';

const userToken  = signAccessToken({ userId: 'user-1', role: 'USER' });
const adminToken = signAccessToken({ userId: 'admin-1', role: 'ADMIN' });

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

  it('200 — USER gets own applications', async () => {
    serviceMocks.list.mockResolvedValue({ data: [makeApp()], total: 1, page: 1, limit: 10 });

    const res = await app.inject({
      method: 'GET',
      url: '/applications',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(serviceMocks.list).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ userId: 'user-1', role: 'USER' }),
    );
  });
});

describe('GET /applications/:id', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('200 — returns application', async () => {
    serviceMocks.getById.mockResolvedValue(makeApp());

    const res = await app.inject({
      method: 'GET',
      url: `/applications/${APP_ID}`,
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('403 — forbidden', async () => {
    serviceMocks.getById.mockRejectedValue(new AppError('Forbidden', 'FORBIDDEN'));

    const res = await app.inject({
      method: 'GET',
      url: `/applications/${APP_ID}`,
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('404 — not found', async () => {
    serviceMocks.getById.mockRejectedValue(new AppError('Application not found', 'NOT_FOUND'));

    const res = await app.inject({
      method: 'GET',
      url: `/applications/${APP_ID}`,
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('POST /applications', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('201 — creates repair request', async () => {
    serviceMocks.submit.mockResolvedValue(makeApp());

    const res = await app.inject({
      method: 'POST',
      url: '/applications',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { assetId: ASSET_ID, faultDescription: 'Screen has dead pixels' },
    });

    expect(res.statusCode).toBe(201);
    expect(serviceMocks.submit).toHaveBeenCalledWith('user-1', expect.objectContaining({ assetId: ASSET_ID }));
  });

  it('409 — asset not available', async () => {
    serviceMocks.submit.mockRejectedValue(new AppError('Asset is not available for repair request', 'CONFLICT'));

    const res = await app.inject({
      method: 'POST',
      url: '/applications',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { assetId: ASSET_ID, faultDescription: 'Broken keyboard' },
    });

    expect(res.statusCode).toBe(409);
  });

  it('400 — validation error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/applications',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { assetId: ASSET_ID, faultDescription: 'X' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('PATCH /applications/:id/approve', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
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

  it('200 — ADMIN approves', async () => {
    serviceMocks.approve.mockResolvedValue(makeApp({ status: 'IN_REPAIR' }));

    const res = await app.inject({
      method: 'PATCH',
      url: `/applications/${APP_ID}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { action: 'APPROVED' },
    });

    expect(res.statusCode).toBe(200);
    expect(serviceMocks.approve).toHaveBeenCalled();
  });

  it('409 — not pending review', async () => {
    serviceMocks.approve.mockRejectedValue(new AppError('Application is not pending review', 'CONFLICT'));

    const res = await app.inject({
      method: 'PATCH',
      url: `/applications/${APP_ID}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { action: 'APPROVED' },
    });

    expect(res.statusCode).toBe(409);
  });
});

describe('PATCH /applications/:id', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('200 — owner updates pending application', async () => {
    serviceMocks.update.mockResolvedValue(makeApp({ faultDescription: 'Updated description' }));

    const res = await app.inject({
      method: 'PATCH',
      url: `/applications/${APP_ID}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { faultDescription: 'Updated description here' },
    });

    expect(res.statusCode).toBe(200);
    expect(serviceMocks.update).toHaveBeenCalledWith(APP_ID, 'user-1', expect.any(Object));
  });

  it('409 — cannot update non-pending application', async () => {
    serviceMocks.update.mockRejectedValue(new AppError('Only PENDING applications can be edited', 'CONFLICT'));

    const res = await app.inject({
      method: 'PATCH',
      url: `/applications/${APP_ID}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { faultDescription: 'Updated description here' },
    });

    expect(res.statusCode).toBe(409);
  });
});

describe('PATCH /applications/:id/repair-details', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('200 — ADMIN updates repair details', async () => {
    serviceMocks.updateRepairDetails.mockResolvedValue(makeApp({ status: 'IN_REPAIR', repairVendor: 'TechFix Co.' }));

    const res = await app.inject({
      method: 'PATCH',
      url: `/applications/${APP_ID}/repair-details`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { repairVendor: 'TechFix Co.', repairCost: 5000 },
    });

    expect(res.statusCode).toBe(200);
    expect(serviceMocks.updateRepairDetails).toHaveBeenCalled();
  });

  it('403 — USER cannot update repair details', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/applications/${APP_ID}/repair-details`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { repairVendor: 'TechFix Co.' },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('PATCH /applications/:id/complete', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('200 — ADMIN completes repair', async () => {
    serviceMocks.complete.mockResolvedValue(makeApp({ status: 'COMPLETED' }));

    const res = await app.inject({
      method: 'PATCH',
      url: `/applications/${APP_ID}/complete`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it('403 — USER cannot complete', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/applications/${APP_ID}/complete`,
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
