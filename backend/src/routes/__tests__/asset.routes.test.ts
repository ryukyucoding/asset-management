import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { signAccessToken } from '@services/auth/auth.service';
import type { AssetEntity } from '@domain/entities/asset.entity';

// ─── Hoist mock functions ──────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  findAll:  vi.fn(),
  findById: vi.fn(),
  create:   vi.fn(),
  update:   vi.fn(),
  delete:   vi.fn(),
}));

vi.mock('@infrastructure/repositories/asset.repository', () => ({
  AssetRepository: vi.fn().mockImplementation(() => ({
    findAll:  mocks.findAll,
    findById: mocks.findById,
    create:   mocks.create,
    update:   mocks.update,
    delete:   mocks.delete,
  })),
}));

import { assetRoutes } from '../asset.routes';

// ─── Helpers ───────────────────────────────────────────────────────────────
const userToken  = signAccessToken({ userId: 'user-1', role: 'USER' });
const adminToken = signAccessToken({ userId: 'admin-1', role: 'ADMIN' });

function makeAsset(overrides: Partial<AssetEntity> = {}): AssetEntity {
  return {
    id: 'asset-cuid-1',
    name: 'MacBook Pro',
    serialNo: 'MBP-001',
    category: 'IT設備',
    model: '16-inch 2023',
    spec: 'M3 Pro, 18GB',
    supplier: 'Apple',
    purchaseDate: new Date('2023-01-01'),
    purchaseCost: 80000,
    location: 'Office A',
    assignedDept: 'Engineering',
    startDate: new Date('2023-01-15'),
    warrantyExpiry: new Date('2026-01-01'),
    status: 'AVAILABLE',
    holderId: null,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(assetRoutes);
  await app.ready();
  return app;
}

// ─── GET /assets ───────────────────────────────────────────────────────────

describe('GET /assets', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('401 — unauthenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets' });
    expect(res.statusCode).toBe(401);
  });

  it('200 — returns paginated list', async () => {
    mocks.findAll.mockResolvedValue({ data: [makeAsset()], total: 1, page: 1, limit: 20 });

    const res = await app.inject({
      method: 'GET',
      url: '/assets',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it('200 — passes status filter to repository', async () => {
    mocks.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    await app.inject({
      method: 'GET',
      url: '/assets?status=AVAILABLE',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(mocks.findAll).toHaveBeenCalledWith(expect.objectContaining({ status: 'AVAILABLE' }));
  });

  it('400 — invalid status enum value', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/assets?status=INVALID',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── GET /assets/:id ───────────────────────────────────────────────────────

describe('GET /assets/:id', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('200 — returns asset by id', async () => {
    mocks.findById.mockResolvedValue(makeAsset());

    const res = await app.inject({
      method: 'GET',
      url: '/assets/asset-cuid-1',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('MacBook Pro');
  });

  it('404 — asset not found', async () => {
    mocks.findById.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/assets/nonexistent',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('NOT_FOUND');
  });
});

// ─── POST /assets ──────────────────────────────────────────────────────────

describe('POST /assets', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('403 — USER cannot create assets', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/assets',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: 'Test', serialNo: 'SN-001', category: 'IT設備', location: 'Office A' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('201 — ADMIN creates asset', async () => {
    mocks.create.mockResolvedValue(makeAsset());

    const res = await app.inject({
      method: 'POST',
      url: '/assets',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'MacBook Pro', serialNo: 'MBP-001', category: 'IT設備', location: 'Office A' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().serialNo).toBe('MBP-001');
  });

  it('400 — missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/assets',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Incomplete' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('VALIDATION_ERROR');
  });
});

// ─── PATCH /assets/:id ─────────────────────────────────────────────────────

describe('PATCH /assets/:id', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('200 — ADMIN updates asset name', async () => {
    mocks.findById.mockResolvedValue(makeAsset());
    mocks.update.mockResolvedValue(makeAsset({ name: 'Updated Name' }));

    const res = await app.inject({
      method: 'PATCH',
      url: '/assets/asset-cuid-1',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Updated Name' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Updated Name');
  });

  it('404 — asset not found', async () => {
    mocks.findById.mockResolvedValue(null);

    const res = await app.inject({
      method: 'PATCH',
      url: '/assets/nonexistent',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'X' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('403 — USER cannot update assets', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/assets/asset-cuid-1',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ─── DELETE /assets/:id ────────────────────────────────────────────────────

describe('DELETE /assets/:id', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('204 — ADMIN deletes asset', async () => {
    mocks.findById.mockResolvedValue(makeAsset());
    mocks.delete.mockResolvedValue(undefined);

    const res = await app.inject({
      method: 'DELETE',
      url: '/assets/asset-cuid-1',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(204);
  });

  it('404 — asset not found', async () => {
    mocks.findById.mockResolvedValue(null);

    const res = await app.inject({
      method: 'DELETE',
      url: '/assets/nonexistent',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('403 — USER cannot delete assets', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/assets/asset-cuid-1',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
