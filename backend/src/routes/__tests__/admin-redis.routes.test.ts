import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { signAccessToken } from '@services/auth/auth.service';

// ── Redis client mock ─────────────────────────────────────────────────────────

const redisMocks = vi.hoisted(() => ({
  scan:       vi.fn(),
  type:       vi.fn(),
  ttl:        vi.fn(),
  get:        vi.fn(),
  lrange:     vi.fn(),
  smembers:   vi.fn(),
  zrange:     vi.fn(),
  hgetall:    vi.fn(),
  del:        vi.fn(),
}));

vi.mock('@infrastructure/cache/redis.client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@infrastructure/cache/redis.client')>();
  return { ...actual, getRedisClient: () => redisMocks };
});

vi.mock('@infrastructure/cache/cache-metrics', () => ({
  getCacheMetrics: vi.fn().mockReturnValue([]),
}));

import { adminRedisRoutes } from '../admin-redis.routes';

// ── Tokens ────────────────────────────────────────────────────────────────────

const adminToken       = signAccessToken({ userId: 'admin-1',  role: 'ADMIN' });
const seniorAdminToken = signAccessToken({ userId: 'sadmin-1', role: 'SENIOR_ADMIN' });
const userToken        = signAccessToken({ userId: 'user-1',   role: 'USER' });

// ── App factory ───────────────────────────────────────────────────────────────

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(adminRedisRoutes);
  await app.ready();
  return app;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Single SCAN call that returns no keys and cursor '0'. */
function scanEmpty() {
  redisMocks.scan.mockResolvedValue(['0', []]);
}

/** Single SCAN call that returns the given keys then cursor '0'. */
function scanKeys(keys: string[]) {
  redisMocks.scan.mockResolvedValue(['0', keys]);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/redis/summary
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /admin/redis/summary', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    scanEmpty();
    app = await buildApp();
  });
  afterEach(() => app.close());

  it('401 — unauthenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/redis/summary' });
    expect(res.statusCode).toBe(401);
  });

  it('403 — USER role not allowed', async () => {
    const res = await app.inject({
      method: 'GET', url: '/admin/redis/summary',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('200 — ADMIN gets prefix counts and cache metrics', async () => {
    const res = await app.inject({
      method: 'GET', url: '/admin/redis/summary',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('prefixes');
    expect(body).toHaveProperty('cacheMetrics');
    expect(Array.isArray(body.prefixes)).toBe(true);
  });

  it('200 — SENIOR_ADMIN also allowed', async () => {
    const res = await app.inject({
      method: 'GET', url: '/admin/redis/summary',
      headers: { authorization: `Bearer ${seniorAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/redis/keys
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /admin/redis/keys', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    scanEmpty();
    app = await buildApp();
  });
  afterEach(() => app.close());

  it('401 — unauthenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/redis/keys?pattern=cache:asset:*' });
    expect(res.statusCode).toBe(401);
  });

  it('400 — pattern not in whitelist', async () => {
    const res = await app.inject({
      method: 'GET', url: '/admin/redis/keys?pattern=*',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('400 — cross-namespace pattern rejected', async () => {
    const res = await app.inject({
      method: 'GET', url: '/admin/redis/keys?pattern=refresh:*someother:*',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('200 — valid whitelist pattern returns keys', async () => {
    scanKeys(['cache:asset:id-1', 'cache:asset:id-2']);

    const res = await app.inject({
      method: 'GET', url: '/admin/redis/keys?pattern=cache:asset:*',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.keys).toEqual(['cache:asset:id-1', 'cache:asset:id-2']);
    expect(body.pattern).toBe('cache:asset:*');
  });

  it('200 — default pattern used when none provided', async () => {
    const res = await app.inject({
      method: 'GET', url: '/admin/redis/keys',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/redis/key
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /admin/redis/key', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });
  afterEach(() => app.close());

  it('400 — missing key param', async () => {
    const res = await app.inject({
      method: 'GET', url: '/admin/redis/key',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('403 — key outside allowed namespace', async () => {
    const res = await app.inject({
      method: 'GET', url: '/admin/redis/key?key=secret:password',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('200 — string key returns value', async () => {
    redisMocks.type.mockResolvedValue('string');
    redisMocks.ttl.mockResolvedValue(300);
    redisMocks.get.mockResolvedValue('{"available":5}');

    const res = await app.inject({
      method: 'GET', url: '/admin/redis/key?key=cache:asset:id-1',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.type).toBe('string');
    expect(body.value).toBe('{"available":5}');
    expect(body.ttl).toBe(300);
  });

  it('200 — none type returns null value', async () => {
    redisMocks.type.mockResolvedValue('none');
    redisMocks.ttl.mockResolvedValue(-2);

    const res = await app.inject({
      method: 'GET', url: '/admin/redis/key?key=cache:asset:missing',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ type: 'none', value: null });
  });

  it('200 — list key returns array', async () => {
    redisMocks.type.mockResolvedValue('list');
    redisMocks.ttl.mockResolvedValue(-1);
    redisMocks.lrange.mockResolvedValue(['a', 'b']);

    const res = await app.inject({
      method: 'GET', url: '/admin/redis/key?key=cache:assets:hash',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().value).toEqual(['a', 'b']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/redis/keys
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /admin/redis/keys', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    scanEmpty();
    app = await buildApp();
  });
  afterEach(() => app.close());

  it('400 — missing pattern', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/admin/redis/keys',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('400 — non-whitelisted pattern', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/admin/redis/keys?pattern=*',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('403 — refresh: namespace blocked', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/admin/redis/keys?pattern=refresh:*',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('403 — serial: namespace blocked', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/admin/redis/keys?pattern=serial:*',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('200 — deletes matching cache keys', async () => {
    scanKeys(['cache:asset:id-1', 'cache:asset:id-2']);
    redisMocks.del.mockResolvedValue(2);

    const res = await app.inject({
      method: 'DELETE', url: '/admin/redis/keys?pattern=cache:asset:*',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ pattern: 'cache:asset:*', deleted: 2 });
  });

  it('200 — no keys matched returns deleted 0', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/admin/redis/keys?pattern=cache:asset:*',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().deleted).toBe(0);
  });
});
