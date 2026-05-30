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
  cacheAsset: (id: string) => `cache:asset:${id}`,
  cacheAssetStats: (scope: string) => `cache:asset-stats:${scope}`,
  cacheUser: (userId: string) => `cache:user:${userId}`,
  cacheUserByRole: (role: string) => `cache:user-by-role:${role}`,
  serial: (prefix: string) => `serial:${prefix}`,
  unread: (userId: string) => `unread:${userId}`,
  cacheNotifications: (userId: string) => `cache:notifications:${userId}`,
  cacheUsersAll: () => `cache:users:all`,
  idempotency: (userId: string, key: string) => `idem:${userId}:${key}`,
} as const;

export const REDIS_KEY_PREFIXES = [
  'rate-limit:',
  'refresh:',
  'token-deny:',
  'cache:assets:',
  'cache:asset:',
  'cache:asset-stats:',
  'cache:user:',
  'cache:user-by-role:',
  'cache:users:',
  'serial:',
  'unread:',
  'cache:notifications:',
  'idem:',
  'bull:',
] as const;
