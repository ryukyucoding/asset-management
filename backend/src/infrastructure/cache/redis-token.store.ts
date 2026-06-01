import type { ITokenStore } from '@domain/repositories/token-store.interface';
import {
  deleteKey,
  deleteByPattern,
  getString,
  setString,
} from './redis.client';
import { redisKeys } from './redis.keys';

export class RedisTokenStore implements ITokenStore {
  async storeRefreshToken(userId: string, jti: string, ttlSeconds: number): Promise<void> {
    await setString(redisKeys.refresh(userId, jti), '1', ttlSeconds);
  }

  async hasRefreshToken(userId: string, jti: string): Promise<boolean> {
    const value = await getString(redisKeys.refresh(userId, jti));
    return value !== null;
  }

  async revokeRefreshToken(userId: string, jti: string): Promise<void> {
    await deleteKey(redisKeys.refresh(userId, jti));
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await deleteByPattern(redisKeys.refreshUserPattern(userId));
  }

  async denyAccessToken(jti: string, ttlSeconds: number): Promise<void> {
    await setString(redisKeys.tokenDeny(jti), '1', ttlSeconds);
  }

  async isAccessTokenDenied(jti: string): Promise<boolean> {
    const value = await getString(redisKeys.tokenDeny(jti));
    return value !== null;
  }
}

/** No-op store when Redis is unavailable in tests without mock. */
export class NoOpTokenStore implements ITokenStore {
  async storeRefreshToken(): Promise<void> {
    await Promise.resolve();
  }

  async hasRefreshToken(): Promise<boolean> {
    return true;
  }

  async revokeRefreshToken(): Promise<void> {
    await Promise.resolve();
  }

  async revokeAllRefreshTokens(): Promise<void> {
    await Promise.resolve();
  }

  async denyAccessToken(): Promise<void> {
    await Promise.resolve();
  }

  async isAccessTokenDenied(): Promise<boolean> {
    return false;
  }
}
