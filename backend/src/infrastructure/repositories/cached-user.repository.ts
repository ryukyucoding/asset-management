import type { IUserRepository } from '@domain/repositories/user.repository.interface';
import type { UserEntity, UserRole } from '@domain/entities/user.entity';
import { getString, setString, deleteKey } from '@infrastructure/cache/redis.client';
import { redisKeys } from '@infrastructure/cache/redis.keys';
import { recordCacheHit, recordCacheMiss } from '@infrastructure/cache/cache-metrics';

const USER_TTL_SECONDS = 300; // 5 min — short enough to pick up role changes
const USER_BY_ROLE_TTL_SECONDS = 300;
const USERS_ALL_TTL_SECONDS = 300;

interface CachedUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  department: string | null;
  createdAt: string; // ISO
  updatedAt: string;
}

function toCached(user: UserEntity): CachedUser {
  return {
    ...user,
    department: user.department ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function fromCached(cached: CachedUser): UserEntity {
  return {
    ...cached,
    createdAt: new Date(cached.createdAt),
    updatedAt: new Date(cached.updatedAt),
  };
}

/**
 * Read-through cache wrapper for {@link UserRepository}.
 *
 * Caches:
 *   - `findById`        → `cache:user:{id}`         TTL 5min
 *   - `findIdsByRole`   → `cache:user-by-role:{r}`  TTL 5min
 *
 * Invalidation on `create` / `update` covers both keys.
 * `findByEmail` is intentionally not cached — login path needs fresh state.
 */
export class CachedUserRepository implements IUserRepository {
  constructor(private readonly inner: IUserRepository) {}

  async findById(id: string): Promise<UserEntity | null> {
    const key = redisKeys.cacheUser(id);
    const raw = await getString(key);
    if (raw) {
      try {
        recordCacheHit('user');
        return fromCached(JSON.parse(raw) as CachedUser);
      } catch {
        // Corrupt entry — fall through to DB.
      }
    }
    recordCacheMiss('user');
    const user = await this.inner.findById(id);
    if (user) {
      await setString(key, JSON.stringify(toCached(user)), USER_TTL_SECONDS);
    }
    return user;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.inner.findByEmail(email);
  }

  async findIdsByRole(role: UserRole): Promise<string[]> {
    const key = redisKeys.cacheUserByRole(role);
    const raw = await getString(key);
    if (raw) {
      try {
        recordCacheHit('userByRole');
        return JSON.parse(raw) as string[];
      } catch {
        // fall through
      }
    }
    recordCacheMiss('userByRole');
    const ids = await this.inner.findIdsByRole(role);
    await setString(key, JSON.stringify(ids), USER_BY_ROLE_TTL_SECONDS);
    return ids;
  }

  async findAll(): Promise<Omit<UserEntity, 'passwordHash'>[]> {
    const key = redisKeys.cacheUsersAll();
    const raw = await getString(key);
    if (raw) {
      try {
        recordCacheHit('user');
        const parsed = JSON.parse(raw) as Array<Omit<CachedUser, 'passwordHash'>>;
        return parsed.map((u) => ({
          ...u,
          createdAt: new Date(u.createdAt),
          updatedAt: new Date(u.updatedAt),
        }));
      } catch {
        // fall through
      }
    }
    recordCacheMiss('user');
    const users = await this.inner.findAll();
    const serialized = users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }));
    await setString(key, JSON.stringify(serialized), USERS_ALL_TTL_SECONDS);
    return users;
  }

  async create(data: {
    name: string;
    email: string;
    passwordHash: string;
    department?: string;
  }): Promise<UserEntity> {
    const user = await this.inner.create(data);
    await Promise.all([
      this.invalidateRole(user.role),
      deleteKey(redisKeys.cacheUsersAll()),
    ]);
    return user;
  }

  async update(
    id: string,
    data: Partial<Pick<UserEntity, 'name' | 'department' | 'role'>>,
  ): Promise<UserEntity> {
    const previous = await this.inner.findById(id);
    const user = await this.inner.update(id, data);
    await Promise.all([
      deleteKey(redisKeys.cacheUser(id)),
      deleteKey(redisKeys.cacheUsersAll()),
      previous && previous.role !== user.role ? this.invalidateRole(previous.role) : Promise.resolve(),
      this.invalidateRole(user.role),
    ]);
    return user;
  }

  private async invalidateRole(role: UserRole): Promise<void> {
    await deleteKey(redisKeys.cacheUserByRole(role));
  }
}
