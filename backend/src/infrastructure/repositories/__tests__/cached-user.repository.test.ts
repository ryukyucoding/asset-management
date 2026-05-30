import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IUserRepository } from '@domain/repositories/user.repository.interface';
import type { UserEntity } from '@domain/entities/user.entity';
import { CachedUserRepository } from '../cached-user.repository';
import { resetCacheMetrics, getCacheMetrics } from '@infrastructure/cache/cache-metrics';

const memoryStore = new Map<string, string>();

vi.mock('@infrastructure/cache/redis.client', () => ({
  getString: vi.fn(async (key: string) => memoryStore.get(key) ?? null),
  setString: vi.fn(async (key: string, value: string) => {
    memoryStore.set(key, value);
  }),
  deleteKey: vi.fn(async (key: string) => {
    memoryStore.delete(key);
  }),
}));

const sampleUser: UserEntity = {
  id: 'u1',
  name: 'Alice',
  email: 'alice@example.com',
  passwordHash: 'salt:hash',
  role: 'ADMIN',
  department: 'IT',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

function makeInner(overrides: Partial<IUserRepository> = {}): IUserRepository {
  return {
    findById: vi.fn(async () => sampleUser),
    findByEmail: vi.fn(async () => null),
    findIdsByRole: vi.fn(async () => ['u1', 'u2']),
    create: vi.fn(async () => sampleUser),
    update: vi.fn(async () => sampleUser),
    ...overrides,
  };
}

describe('CachedUserRepository', () => {
  beforeEach(() => {
    memoryStore.clear();
    resetCacheMetrics();
  });

  it('caches findById results and only hits inner repo once', async () => {
    const inner = makeInner();
    const repo = new CachedUserRepository(inner);

    const a = await repo.findById('u1');
    const b = await repo.findById('u1');

    expect(a?.email).toBe('alice@example.com');
    expect(b?.email).toBe('alice@example.com');
    expect(inner.findById).toHaveBeenCalledTimes(1);

    const userMetric = getCacheMetrics().find((m) => m.namespace === 'user')!;
    expect(userMetric.hit).toBe(1);
    expect(userMetric.miss).toBe(1);
  });

  it('preserves Date round-trip across cache', async () => {
    const inner = makeInner();
    const repo = new CachedUserRepository(inner);

    await repo.findById('u1');
    const fromCache = await repo.findById('u1');

    expect(fromCache?.createdAt).toBeInstanceOf(Date);
    expect(fromCache?.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('caches findIdsByRole', async () => {
    const inner = makeInner();
    const repo = new CachedUserRepository(inner);

    const a = await repo.findIdsByRole('ADMIN');
    const b = await repo.findIdsByRole('ADMIN');

    expect(a).toEqual(['u1', 'u2']);
    expect(b).toEqual(['u1', 'u2']);
    expect(inner.findIdsByRole).toHaveBeenCalledTimes(1);
  });

  it('does not cache findByEmail (login path requires freshness)', async () => {
    const inner = makeInner();
    const repo = new CachedUserRepository(inner);

    await repo.findByEmail('alice@example.com');
    await repo.findByEmail('alice@example.com');

    expect(inner.findByEmail).toHaveBeenCalledTimes(2);
  });

  it('invalidates the role list when create is called', async () => {
    const inner = makeInner({
      findIdsByRole: vi.fn(async () => ['u1']),
      create: vi.fn(async () => sampleUser),
    });
    const repo = new CachedUserRepository(inner);

    await repo.findIdsByRole('ADMIN');
    await repo.create({ name: 'Bob', email: 'b@example.com', passwordHash: 'h' });
    await repo.findIdsByRole('ADMIN');

    expect(inner.findIdsByRole).toHaveBeenCalledTimes(2);
  });

  it('invalidates both previous and new role lists when role changes', async () => {
    const inner = makeInner({
      findById: vi.fn(async () => ({ ...sampleUser, role: 'USER' as const })),
      update: vi.fn(async () => ({ ...sampleUser, role: 'ADMIN' as const })),
    });
    const repo = new CachedUserRepository(inner);

    await repo.findIdsByRole('USER');
    await repo.findIdsByRole('ADMIN');
    await repo.update('u1', { role: 'ADMIN' });

    // Both role caches were invalidated; next reads hit the inner repo again.
    await repo.findIdsByRole('USER');
    await repo.findIdsByRole('ADMIN');
    expect((inner.findIdsByRole as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('invalidates the user cache when update is called', async () => {
    const inner = makeInner();
    const repo = new CachedUserRepository(inner);

    await repo.findById('u1');
    await repo.update('u1', { name: 'Alice 2' });
    await repo.findById('u1');

    // 2 misses (once before update, once after invalidation) + 0 cache hits
    expect((inner.findById as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
