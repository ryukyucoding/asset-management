import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { buildApp } from './app';

const prismaMock = vi.hoisted(() => ({
  queryRaw: vi.fn(),
}));

vi.mock('./infrastructure/database/prisma.client', () => ({
  prisma: {
    $queryRaw: prismaMock.queryRaw,
  },
}));

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('200 — db connected', async () => {
    prismaMock.queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', db: 'connected' });
  });

  it('503 — db disconnected', async () => {
    prismaMock.queryRaw.mockRejectedValue(new Error('connection refused'));

    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'degraded', db: 'disconnected' });
  });
});
