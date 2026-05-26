import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { hashPassword, signAccessToken, signRefreshToken } from '@services/auth/auth.service';
import type { UserEntity } from '@domain/entities/user.entity';

// ─── Hoist mock functions so they're available inside vi.mock factory ───────
const mocks = vi.hoisted(() => ({
  findByEmail: vi.fn(),
  findById:    vi.fn(),
  create:      vi.fn(),
  update:      vi.fn(),
  incrementWithTtl: vi.fn(),
}));

vi.mock('@infrastructure/repositories/user.repository', () => ({
  UserRepository: vi.fn().mockImplementation(() => ({
    findByEmail: mocks.findByEmail,
    findById:    mocks.findById,
    create:      mocks.create,
    update:      mocks.update,
  })),
}));

vi.mock('@infrastructure/cache/redis.client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@infrastructure/cache/redis.client')>();
  return {
    ...actual,
    incrementWithTtl: mocks.incrementWithTtl,
    getString: vi.fn().mockResolvedValue(null),
    setString: vi.fn().mockResolvedValue(undefined),
    deleteKey: vi.fn().mockResolvedValue(undefined),
    deleteByPattern: vi.fn().mockResolvedValue(undefined),
    pingRedis: vi.fn().mockResolvedValue(true),
    closeRedisClient: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@infrastructure/cache/redis-token.store', () => ({
  RedisTokenStore: vi.fn().mockImplementation(() => ({
    storeRefreshToken: vi.fn().mockResolvedValue(undefined),
    hasRefreshToken: vi.fn().mockResolvedValue(true),
    revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
    revokeAllRefreshTokens: vi.fn().mockResolvedValue(undefined),
    denyAccessToken: vi.fn().mockResolvedValue(undefined),
    isAccessTokenDenied: vi.fn().mockResolvedValue(false),
  })),
}));

import { authRoutes } from '../auth.routes';

// ─── Helpers ───────────────────────────────────────────────────────────────
function makeUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-cuid-1',
    name: 'Alice',
    email: 'alice@example.com',
    passwordHash: hashPassword('password123'),
    role: 'USER',
    department: 'IT',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(authRoutes);
  await app.ready();
  return app;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.incrementWithTtl.mockResolvedValue(1);
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('201 — creates user with valid data', async () => {
    const user = makeUser();
    mocks.findByEmail.mockResolvedValue(null);
    mocks.create.mockResolvedValue(user);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: 'Alice', email: 'alice@example.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.email).toBe('alice@example.com');
    expect(body.user.passwordHash).toBeUndefined();
  });

  it('400 — invalid email format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: 'Bob', email: 'not-an-email', password: 'password123' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(res.json().error.statusCode).toBe(400);
  });

  it('400 — password too short (< 6 chars)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: 'Bob', email: 'bob@example.com', password: 'abc' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('409 — email already registered', async () => {
    mocks.findByEmail.mockResolvedValue(makeUser());

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { name: 'Alice', email: 'alice@example.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
    expect(res.json().error.statusCode).toBe(409);
  });
});

describe('POST /auth/login', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.incrementWithTtl.mockResolvedValue(1);
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('200 — returns tokens on valid credentials', async () => {
    mocks.findByEmail.mockResolvedValue(makeUser());

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'alice@example.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.user.email).toBe('alice@example.com');
  });

  it('401 — wrong password', async () => {
    mocks.findByEmail.mockResolvedValue(makeUser());

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'alice@example.com', password: 'wrong-password' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('401 — unknown email', async () => {
    mocks.findByEmail.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody@example.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('400 — missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('429 — too many login attempts from same IP', async () => {
    mocks.incrementWithTtl.mockResolvedValue(11);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'alice@example.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe('TOO_MANY_REQUESTS');
  });
});

describe('POST /auth/refresh', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.incrementWithTtl.mockResolvedValue(1);
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('200 — returns new access token', async () => {
    const token = signRefreshToken({ userId: 'user-cuid-1' });
    mocks.findById.mockResolvedValue(makeUser());

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: token },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeTruthy();
  });

  it('401 — invalid refresh token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: 'bad.token.value' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('400 — missing refreshToken field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /auth/logout', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.incrementWithTtl.mockResolvedValue(1);
    app = await buildApp();
  });

  afterEach(() => app.close());

  it('401 — no authorization header', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/logout' });
    expect(res.statusCode).toBe(401);
  });

  it('204 — success with valid Bearer token', async () => {
    const token = signAccessToken({ userId: 'user-cuid-1', role: 'USER' });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(204);
  });
});
