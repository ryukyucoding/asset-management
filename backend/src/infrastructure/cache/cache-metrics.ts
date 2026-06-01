/**
 * In-memory hit/miss counters per cache namespace.
 *
 * Lives in the Cloud Run instance — Memorystore restart doesn't reset it, but
 * a backend revision swap does. That's fine: this is for trend visibility,
 * not billing. For cross-instance aggregation use Cloud Monitoring.
 */
export type CacheNamespace =
  | 'assets'
  | 'asset'
  | 'assetStats'
  | 'user'
  | 'userByRole'
  | 'unread'
  | 'notifications';

interface Counter {
  hit: number;
  miss: number;
}

const counters: Record<CacheNamespace, Counter> = {
  assets:        { hit: 0, miss: 0 },
  asset:         { hit: 0, miss: 0 },
  assetStats:    { hit: 0, miss: 0 },
  user:          { hit: 0, miss: 0 },
  userByRole:    { hit: 0, miss: 0 },
  unread:        { hit: 0, miss: 0 },
  notifications: { hit: 0, miss: 0 },
};

export function recordCacheHit(ns: CacheNamespace): void {
  counters[ns].hit += 1;
}

export function recordCacheMiss(ns: CacheNamespace): void {
  counters[ns].miss += 1;
}

export interface CacheMetricsSnapshot {
  namespace: CacheNamespace;
  hit: number;
  miss: number;
  hitRate: number; // 0 .. 1, NaN when no samples
}

export function getCacheMetrics(): CacheMetricsSnapshot[] {
  return (Object.keys(counters) as CacheNamespace[]).map((ns) => {
    const { hit, miss } = counters[ns];
    const total = hit + miss;
    return {
      namespace: ns,
      hit,
      miss,
      hitRate: total === 0 ? Number.NaN : hit / total,
    };
  });
}

export function resetCacheMetrics(): void {
  for (const ns of Object.keys(counters) as CacheNamespace[]) {
    counters[ns] = { hit: 0, miss: 0 };
  }
}
