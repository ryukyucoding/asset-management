import { describe, it, expect } from 'vitest';
import { redisKeys } from '../redis.keys';

describe('redisKeys', () => {
  it('builds namespaced keys', () => {
    expect(redisKeys.rateLimitAuthLogin('1.2.3.4')).toBe('rate-limit:auth-login:1.2.3.4');
    expect(redisKeys.refresh('u1', 'jti-abc')).toBe('refresh:u1:jti-abc');
    expect(redisKeys.tokenDeny('jti-abc')).toBe('token-deny:jti-abc');
    expect(redisKeys.cacheAssets('abc123')).toBe('cache:assets:abc123');
    expect(redisKeys.serial('IT')).toBe('serial:IT');
  });
});
