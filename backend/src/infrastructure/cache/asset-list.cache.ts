import { createHash } from 'crypto';
import type { AssetSearchParams, PaginatedResult } from '@domain/repositories/asset.repository.interface';
import type { AssetEntity } from '@domain/entities/asset.entity';
import { getString, setString, deleteByPattern } from './redis.client';
import { redisKeys } from './redis.keys';

const ASSET_LIST_CACHE_TTL_SECONDS = 60;

function hashQuery(params: AssetSearchParams): string {
  const normalized = JSON.stringify(params, Object.keys(params).sort());
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

export async function getCachedAssetList(
  params: AssetSearchParams,
): Promise<PaginatedResult<AssetEntity> | null> {
  try {
    const raw = await getString(redisKeys.cacheAssets(hashQuery(params)));
    if (!raw) return null;
    return JSON.parse(raw) as PaginatedResult<AssetEntity>;
  } catch {
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
