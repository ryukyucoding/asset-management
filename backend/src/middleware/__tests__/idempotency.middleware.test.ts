import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { signAccessToken } from '@services/auth/auth.service';

// ── Redis mock ────────────────────────────────────────────────────────────────

const redisMocks = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@infrastructure/cache/redis.client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@infrastructure/cache/redis.client')>();
  return { ...actual, getRedisClient: () => redisMocks };
});

import { idempotencyMiddleware, idempotencyOnSend } from '../idempotency.middleware';
import { authMiddleware } from '../auth.middleware';

// ── Tokens ────────────────────────────────────────────────────────────────────

const token = signAccessToken({ userId: 'user-1', role: 'USER' });

// ── App factory ───────────────────────────────────────────────────────────────

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.addHook('onSend', idempotencyOnSend);

  app.post('/test', { preHandler: [authMiddleware, idempotencyMiddleware] }, async (_req, reply) => {
    return reply.status(201).send({ created: true });
  });

  await app.ready();
  return app;
}

// ─────────────────────────────────────────────────────────────────────────────
// idempotencyMiddleware
// ─────────────────────────────────────────────────────────────────────────────

describe('idempotencyMiddleware', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });
  afterEach(() => app.close());

  it('proceeds normally when no Idempotency-Key header is provided', async () => {
    const res = await app.inject({
      method: 'POST', url: '/test',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
  });

  it('proceeds on first request, sets in-flight marker', async () => {
    redisMocks.set.mockResolvedValue('OK'); // NX succeeded → first request

    const res = await app.inject({
      method: 'POST', url: '/test',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'key-abc' },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    expect(redisMocks.set).toHaveBeenCalledWith(
      expect.stringContaining('idem:'),
      '__in_flight__',
      'EX',
      expect.any(Number),
      'NX',
    );
  });

  it('409 — in-flight duplicate request', async () => {
    redisMocks.set.mockResolvedValue(null);         // NX failed — key exists
    redisMocks.get.mockResolvedValue('__in_flight__'); // still in-flight

    const res = await app.inject({
      method: 'POST', url: '/test',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'key-dup' },
      payload: {},
    });
    expect(res.statusCode).toBe(409);
  });

  it('replays cached response on duplicate', async () => {
    const cached = JSON.stringify({ statusCode: 201, body: '{"created":true}', contentType: 'application/json' });
    redisMocks.set.mockResolvedValue(null); // NX failed
    redisMocks.get.mockResolvedValue(cached);

    const res = await app.inject({
      method: 'POST', url: '/test',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'key-replay' },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    expect(res.headers['idempotency-replayed']).toBe('true');
  });

  it('400 — key with invalid characters is rejected', async () => {
    const res = await app.inject({
      method: 'POST', url: '/test',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'bad key!' },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('400 — key exceeding 128 chars is rejected', async () => {
    const res = await app.inject({
      method: 'POST', url: '/test',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'a'.repeat(129) },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('falls open when Redis is unavailable', async () => {
    redisMocks.set.mockRejectedValue(new Error('Redis down'));

    const res = await app.inject({
      method: 'POST', url: '/test',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'key-redis-down' },
      payload: {},
    });
    // Falls open → handler runs normally
    expect(res.statusCode).toBe(201);
  });

  it('deletes corrupt cache entry and falls through to handler', async () => {
    redisMocks.set.mockResolvedValue(null);
    redisMocks.get.mockResolvedValue('not-valid-json{{{');
    redisMocks.del.mockResolvedValue(1);

    const res = await app.inject({
      method: 'POST', url: '/test',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'key-corrupt' },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    expect(redisMocks.del).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// idempotencyOnSend
// ─────────────────────────────────────────────────────────────────────────────

describe('idempotencyOnSend', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });
  afterEach(() => app.close());

  it('stores the response body in Redis after a first request', async () => {
    redisMocks.set
      .mockResolvedValueOnce('OK')   // NX → in-flight marker
      .mockResolvedValueOnce('OK');  // onSend → cache response

    await app.inject({
      method: 'POST', url: '/test',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'key-store' },
      payload: {},
    });

    // Second set call should store the JSON response
    expect(redisMocks.set).toHaveBeenCalledTimes(2);
    const [, storedValue] = redisMocks.set.mock.calls[1]!;
    const parsed = JSON.parse(storedValue as string);
    expect(parsed.statusCode).toBe(201);
  });

  it('does not store response when no idempotency key on request', async () => {
    await app.inject({
      method: 'POST', url: '/test',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(redisMocks.set).not.toHaveBeenCalled();
  });
});
