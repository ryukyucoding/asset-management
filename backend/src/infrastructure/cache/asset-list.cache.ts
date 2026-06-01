import { createHash } from 'node:crypto';
import type { AssetSearchParams, PaginatedResult } from '@domain/repositories/asset.repository.interface';
import type { AssetEntity } from '@domain/entities/asset.entity';
import { getString, setString, deleteByPattern } from './redis.client';
import { redisKeys } from './redis.keys';
import { recordCacheHit, recordCacheMiss } from './cache-metrics';

const ASSET_LIST_CACHE_TTL_SECONDS = 60;

function hashQuery(params: AssetSearchParams): string {
  const normalized = JSON.stringify(params, Object.keys(params).sort((a, b) => a.localeCompare(b)));
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

export async function getCachedAssetList(
  params: AssetSearchParams,
): Promise<PaginatedResult<AssetEntity> | null> {
  try {
    const raw = await getString(redisKeys.cacheAssets(hashQuery(params)));
    if (!raw) {
      recordCacheMiss('assets');
      return null;
    }
    recordCacheHit('assets');
    return JSON.parse(raw) as PaginatedResult<AssetEntity>;
  } catch {
    recordCacheMiss('assets');
    return null;
  }
}

export async function setCachedAssetList(
  params: AssetSearchParams,
  result: PaginatedResult<AssetEntity>,
): Promise<void> {
  try {
    await setString(
      redisKeys.cacheAssets(hashQuery(params)),
      JSON.stringify(result),
      ASSET_LIST_CACHE_TTL_SECONDS,
    );
  } catch {
    // Cache write failure is non-fatal.
  }
}

export async function invalidateAssetListCache(): Promise<void> {
  try {
    await deleteByPattern('cache:assets:*');
  } catch {
    // Ignore invalidation errors.
  }
}
