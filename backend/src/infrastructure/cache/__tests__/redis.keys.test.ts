import { describe, it, expect } from 'vitest';
import { redisKeys, REDIS_KEY_PREFIXES } from '../redis.keys';

describe('redisKeys', () => {
  it('builds namespaced keys', () => {
    expect(redisKeys.rateLimitAuthLogin('1.2.3.4')).toBe('rate-limit:auth-login:1.2.3.4');
    expect(redisKeys.refresh('u1', 'jti-abc')).toBe('refresh:u1:jti-abc');
    expect(redisKeys.tokenDeny('jti-abc')).toBe('token-deny:jti-abc');
    expect(redisKeys.cacheAssets('abc123')).toBe('cache:assets:abc123');
    expect(redisKeys.cacheAsset('asset-1')).toBe('cache:asset:asset-1');
    expect(redisKeys.cacheAssetStats('all')).toBe('cache:asset-stats:all');
    expect(redisKeys.cacheNotifications('u1')).toBe('cache:notifications:u1');
    expect(redisKeys.cacheUser('u1')).toBe('cache:user:u1');
    expect(redisKeys.cacheUserByRole('ADMIN')).toBe('cache:user-by-role:ADMIN');
    expect(redisKeys.serial('IT')).toBe('serial:IT');
    expect(redisKeys.unread('u1')).toBe('unread:u1');
    expect(redisKeys.idempotency('u1', 'key-x')).toBe('idem:u1:key-x');
  });

  it('exposes a registered prefix for every builder', () => {
    const sample = [
      redisKeys.rateLimitAuthLogin('x'),
      redisKeys.refresh('u', 'j'),
      redisKeys.tokenDeny('j'),
      redisKeys.cacheAssets('h'),
      redisKeys.cacheAsset('a'),
      redisKeys.cacheAssetStats('all'),
      redisKeys.cacheNotifications('u'),
      redisKeys.cacheUser('u'),
      redisKeys.cacheUserByRole('USER'),
      redisKeys.serial('IT'),
      redisKeys.unread('u'),
      redisKeys.idempotency('u', 'k'),
    ];
    for (const key of sample) {
      expect(REDIS_KEY_PREFIXES.some((p) => key.startsWith(p))).toBe(true);
    }
  });
});
