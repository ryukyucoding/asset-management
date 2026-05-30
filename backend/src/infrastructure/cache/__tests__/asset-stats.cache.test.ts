import { describe, it, expect, vi, beforeEach } from 'vitest';

const memoryStore = new Map<string, string>();

vi.mock('../redis.client', () => ({
  getString: vi.fn(async (key: string) => memoryStore.get(key) ?? null),
  setString: vi.fn(async (key: string, value: string) => {
    memoryStore.set(key, value);
  }),
  deleteByPattern: vi.fn(async (pattern: string) => {
    const prefix = pattern.replace(/\*$/, '');
    for (const key of memoryStore.keys()) {
      if (key.startsWith(prefix)) memoryStore.delete(key);
    }
  }),
  // -1 means no expiry → SWR threshold not met → no background refresh in tests
  getPttl: vi.fn(async () => -1),
}));

const prismaMocks = vi.hoisted(() => ({ groupBy: vi.fn() }));
vi.mock('@infrastructure/database/prisma.client', () => ({
  prisma: { asset: { groupBy: prismaMocks.groupBy } },
}));
const { groupBy } = prismaMocks;

import {
  getAssetStats,
  invalidateAssetStatsCache,
} from '../asset-stats.cache';
import { resetCacheMetrics, getCacheMetrics } from '../cache-metrics';

describe('asset-stats.cache', () => {
  beforeEach(() => {
    memoryStore.clear();
    resetCacheMetrics();
    groupBy.mockReset();
  });

  it('groups status counts from prisma on first call', async () => {
    groupBy.mockResolvedValue([
      { status: 'AVAILABLE',      _count: { _all: 12 } },
      { status: 'PENDING_REPAIR', _count: { _all: 3 } },
      { status: 'IN_REPAIR',      _count: { _all: 1 } },
      { status: 'RETIRED',        _count: { _all: 99 } }, // intentionally ignored
    ]);

    const stats = await getAssetStats();

    expect(stats).toEqual({ available: 12, pendingRepair: 3, inRepair: 1 });
    expect(groupBy).toHaveBeenCalledTimes(1);
  });

  it('caches results and returns from cache on second call', async () => {
    groupBy.mockResolvedValue([{ status: 'AVAILABLE', _count: { _all: 5 } }]);

    await getAssetStats();
    await getAssetStats();

    expect(groupBy).toHaveBeenCalledTimes(1);

    const metric = getCacheMetrics().find((m) => m.namespace === 'assetStats')!;
    expect(metric.hit).toBe(1);
    expect(metric.miss).toBe(1);
  });

  it('uses a separate cache key per holderId', async () => {
    groupBy.mockResolvedValue([{ status: 'AVAILABLE', _count: { _all: 7 } }]);

    await getAssetStats();
    await getAssetStats({ holderId: 'user-1' });
    await getAssetStats();
    await getAssetStats({ holderId: 'user-1' });

    // 2 cold misses (all, user-1), 2 hits
    expect(groupBy).toHaveBeenCalledTimes(2);
  });

  it('passes holderId into prisma groupBy where filter', async () => {
    groupBy.mockResolvedValue([]);
    await getAssetStats({ holderId: 'user-99' });
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { holderId: 'user-99' } }),
    );
  });

  it('uses an empty where filter for global scope', async () => {
    groupBy.mockResolvedValue([]);
    await getAssetStats();
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('invalidates the cache so the next call hits the DB again', async () => {
    groupBy.mockResolvedValue([{ status: 'AVAILABLE', _count: { _all: 1 } }]);

    await getAssetStats();
    await invalidateAssetStatsCache();
    await getAssetStats();

    expect(groupBy).toHaveBeenCalledTimes(2);
  });
});
