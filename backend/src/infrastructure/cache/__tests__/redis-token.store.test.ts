import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisTokenStore } from '../redis-token.store';

const mocks = vi.hoisted(() => ({
  setString: vi.fn(),
  getString: vi.fn(),
  deleteKey: vi.fn(),
  deleteByPattern: vi.fn(),
}));

vi.mock('../redis.client', () => ({
  setString: mocks.setString,
  getString: mocks.getString,
  deleteKey: mocks.deleteKey,
  deleteByPattern: mocks.deleteByPattern,
}));

describe('RedisTokenStore', () => {
  const store = new RedisTokenStore();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores refresh token with TTL', async () => {
    await store.storeRefreshToken('user-1', 'jti-1', 604800);
    expect(mocks.setString).toHaveBeenCalledWith('refresh:user-1:jti-1', '1', 604800);
  });

  it('checks refresh token existence', async () => {
    mocks.getString.mockResolvedValue('1');
    await expect(store.hasRefreshToken('user-1', 'jti-1')).resolves.toBe(true);
    mocks.getString.mockResolvedValue(null);
    await expect(store.hasRefreshToken('user-1', 'jti-1')).resolves.toBe(false);
  });

  it('denies access token with TTL', async () => {
    await store.denyAccessToken('jti-a', 900);
    expect(mocks.setString).toHaveBeenCalledWith('token-deny:jti-a', '1', 900);
  });

  it('revokes all refresh tokens for user', async () => {
    await store.revokeAllRefreshTokens('user-1');
    expect(mocks.deleteByPattern).toHaveBeenCalledWith('refresh:user-1:*');
  });
});
