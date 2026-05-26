import type { IAssetRepository, AssetSearchParams, PaginatedResult } from '@domain/repositories/asset.repository.interface';
import type { AssetEntity } from '@domain/entities/asset.entity';
import {
  getCachedAssetList,
  setCachedAssetList,
  invalidateAssetListCache,
} from '@infrastructure/cache/asset-list.cache';

export class CachedAssetRepository implements IAssetRepository {
  constructor(private readonly inner: IAssetRepository) {}

  async findById(id: string): Promise<AssetEntity | null> {
    return this.inner.findById(id);
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
    await invalidateAssetListCache();
    return asset;
  }

  async update(
    id: string,
    data: Partial<Omit<AssetEntity, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<AssetEntity> {
    const asset = await this.inner.update(id, data);
    await invalidateAssetListCache();
    return asset;
  }

  async delete(id: string): Promise<void> {
    await this.inner.delete(id);
    await invalidateAssetListCache();
  }
}
