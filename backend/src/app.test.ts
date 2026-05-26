import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  user: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  asset: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  application: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
  notification: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  approval: { create: vi.fn(), deleteMany: vi.fn() },
  $disconnect: vi.fn(),
}));

const redisMock = vi.hoisted(() => ({
  pingRedis: vi.fn(),
  closeRedisClient: vi.fn(),
}));

vi.mock('./infrastructure/database/prisma.client', () => ({
  prisma: prismaMock,
}));

vi.mock('@infrastructure/database/prisma.client', () => ({
  prisma: prismaMock,
}));

vi.mock('./infrastructure/cache/redis.client', () => ({
  pingRedis: redisMock.pingRedis,
  closeRedisClient: redisMock.closeRedisClient,
}));

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    redisMock.pingRedis.mockResolvedValue(true);
    redisMock.closeRedisClient.mockResolvedValue(undefined);
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('200 — db connected', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', db: 'connected', redis: 'connected' });
  });

  it('503 — db disconnected', async () => {
    redisMock.pingRedis.mockResolvedValue(false);
    prismaMock.$queryRaw.mockRejectedValue(new Error('connection refused'));

    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'degraded', db: 'disconnected', redis: 'disconnected' });
  });
});
