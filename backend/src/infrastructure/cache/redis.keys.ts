/**
 * Redis key namespaces — single Memorystore instance, logical separation by prefix.
 * @see docs/redis.md
 */
export const redisKeys = {
  rateLimitAuthLogin: (ip: string) => `rate-limit:auth-login:${ip}`,
  refresh: (userId: string, jti: string) => `refresh:${userId}:${jti}`,
  refreshUserPattern: (userId: string) => `refresh:${userId}:*`,
  tokenDeny: (jti: string) => `token-deny:${jti}`,
  cacheAssets: (queryHash: string) => `cache:assets:${queryHash}`,
  serial: (prefix: string) => `serial:${prefix}`,
} as const;

export const REDIS_KEY_PREFIXES = [
  'rate-limit:',
  'refresh:',
  'token-deny:',
  'cache:assets:',
  'serial:',
  'bull:',
] as const;
