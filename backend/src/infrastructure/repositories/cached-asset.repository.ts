import type { IAssetRepository, AssetSearchParams, PaginatedResult } from '@domain/repositories/asset.repository.interface';
import type { AssetEntity } from '@domain/entities/asset.entity';
import {
  getCachedAssetList,
  setCachedAssetList,
  invalidateAssetListCache,
} from '@infrastructure/cache/asset-list.cache';
import { invalidateAssetStatsCache } from '@infrastructure/cache/asset-stats.cache';
import { getString, setString, deleteKey } from '@infrastructure/cache/redis.client';
import { redisKeys } from '@infrastructure/cache/redis.keys';
import { recordCacheHit, recordCacheMiss } from '@infrastructure/cache/cache-metrics';

const ASSET_DETAIL_TTL_SECONDS = 300; // 5 min

interface CachedAsset extends Omit<AssetEntity, 'createdAt' | 'updatedAt' | 'purchaseDate' | 'startDate' | 'warrantyExpiry'> {
  createdAt: string;
  updatedAt: string;
  purchaseDate: string | null;
  startDate: string | null;
  warrantyExpiry: string | null;
}

function toCached(asset: AssetEntity): CachedAsset {
  return {
    ...asset,
    createdAt:      asset.createdAt.toISOString(),
    updatedAt:      asset.updatedAt.toISOString(),
    purchaseDate:   asset.purchaseDate   ? asset.purchaseDate.toISOString()   : null,
    startDate:      asset.startDate      ? asset.startDate.toISOString()      : null,
    warrantyExpiry: asset.warrantyExpiry ? asset.warrantyExpiry.toISOString() : null,
  };
}

function fromCached(cached: CachedAsset): AssetEntity {
  return {
    ...cached,
    createdAt:      new Date(cached.createdAt),
    updatedAt:      new Date(cached.updatedAt),
    purchaseDate:   cached.purchaseDate   ? new Date(cached.purchaseDate)   : null,
    startDate:      cached.startDate      ? new Date(cached.startDate)      : null,
    warrantyExpiry: cached.warrantyExpiry ? new Date(cached.warrantyExpiry) : null,
  };
}

async function invalidateAllAssetCaches(id?: string): Promise<void> {
  await Promise.all([
    invalidateAssetListCache(),
    invalidateAssetStatsCache(),
    id ? deleteKey(redisKeys.cacheAsset(id)) : Promise.resolve(),
  ]);
}

export class CachedAssetRepository implements IAssetRepository {
  constructor(private readonly inner: IAssetRepository) {}

  async findById(id: string): Promise<AssetEntity | null> {
    const key = redisKeys.cacheAsset(id);
    const raw = await getString(key);
    if (raw) {
      try {
        recordCacheHit('asset');
        return fromCached(JSON.parse(raw) as CachedAsset);
      } catch {
        // Corrupt entry — fall through to DB.
      }
    }
    recordCacheMiss('asset');
    const asset = await this.inner.findById(id);
    if (asset) {
      await setString(key, JSON.stringify(toCached(asset)), ASSET_DETAIL_TTL_SECONDS);
    }
    return asset;
  }

  async findAll(params: AssetSearchParams): Promise<PaginatedResult<AssetEntity>> {
    const cached = await getCachedAssetList(params);
    if (cached) return cached;

    const result = await this.inner.findAll(params);
    await setCachedAssetList(params, result);
    return result;
  }

  async create(data: Omit<AssetEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<AssetEntity> {
    const asset = await this.inner.create(data);
    await invalidateAllAssetCaches();
    return asset;
  }

  async update(
    id: string,
    data: Partial<Omit<AssetEntity, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<AssetEntity> {
    const asset = await this.inner.update(id, data);
    await invalidateAllAssetCaches(id);
    return asset;
  }

  async delete(id: string): Promise<void> {
    await this.inner.delete(id);
    await invalidateAllAssetCaches(id);
  }
}
