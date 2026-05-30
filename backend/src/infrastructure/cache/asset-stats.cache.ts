import { prisma } from '@infrastructure/database/prisma.client';
import { getString, setString, deleteByPattern, getPttl } from './redis.client';
import { redisKeys } from './redis.keys';
import { recordCacheHit, recordCacheMiss } from './cache-metrics';

const ASSET_STATS_TTL_SECONDS = 60;
/** If remaining TTL drops below this threshold, serve stale and refresh in background. */
const STALE_THRESHOLD_MS = 10_000;

export interface AssetStats {
  available: number;
  pendingRepair: number;
  inRepair: number;
}

export interface AssetStatsScope {
  /** When set, count only assets where `holderId = userId` — for non-admin views. */
  holderId?: string;
}

function scopeKey(scope: AssetStatsScope): string {
  return scope.holderId ? `user:${scope.holderId}` : 'all';
}

export async function getAssetStats(scope: AssetStatsScope = {}): Promise<AssetStats> {
  const key = redisKeys.cacheAssetStats(scopeKey(scope));

  const raw = await getString(key);
  if (raw) {
    let stats: AssetStats | null = null;
    try {
      stats = JSON.parse(raw) as AssetStats;
    } catch {
      // Corrupt entry — fall through to recompute.
    }

    if (stats) {
      recordCacheHit('assetStats');
      // Stale-while-revalidate: if TTL is running low, refresh in background
      // so the *next* request hits a warm cache instead of a cold miss.
      const pttl = await getPttl(key);
      if (pttl >= 0 && pttl < STALE_THRESHOLD_MS) {
        void refreshInBackground(key, scope);
      }
      return stats;
    }
  }

  recordCacheMiss('assetStats');
  const stats = await computeFromDb(scope);
  await setString(key, JSON.stringify(stats), ASSET_STATS_TTL_SECONDS);
  return stats;
}

function refreshInBackground(key: string, scope: AssetStatsScope): Promise<void> {
  return computeFromDb(scope)
    .then((stats) => setString(key, JSON.stringify(stats), ASSET_STATS_TTL_SECONDS))
    .catch(() => {
      // background refresh failures are non-fatal
    });
}

async function computeFromDb(scope: AssetStatsScope): Promise<AssetStats> {
  const where = scope.holderId ? { holderId: scope.holderId } : {};
  const grouped = await prisma.asset.groupBy({
    by: ['status'],
    where,
    _count: { _all: true },
  });

  const stats: AssetStats = { available: 0, pendingRepair: 0, inRepair: 0 };
  for (const row of grouped) {
    switch (row.status) {
      case 'AVAILABLE':
        stats.available = row._count._all;
        break;
      case 'PENDING_REPAIR':
        stats.pendingRepair = row._count._all;
        break;
      case 'IN_REPAIR':
        stats.inRepair = row._count._all;
        break;
      default:
        // RETIRED and any future status are intentionally excluded.
        break;
    }
  }
  return stats;
}

/**
 * Drop all scoped stats. Called from {@link CachedAssetRepository} on any
 * write — coarse but always correct, and the recompute cost is one groupBy.
 */
export async function invalidateAssetStatsCache(): Promise<void> {
  try {
    await deleteByPattern('cache:asset-stats:*');
  } catch {
    // ignore
  }
}
