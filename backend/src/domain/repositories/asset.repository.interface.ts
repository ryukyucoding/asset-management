import type { AssetEntity, AssetStatus } from '@domain/entities/asset.entity';

export interface AssetSearchParams {
  name?: string;
  serialNo?: string;
  category?: string;
  location?: string;
  assignedDept?: string;
  holderId?: string;
  status?: AssetStatus;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface IAssetRepository {
  findById(id: string): Promise<AssetEntity | null>;
  findAll(params: AssetSearchParams): Promise<PaginatedResult<AssetEntity>>;
  create(data: Omit<AssetEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<AssetEntity>;
  update(id: string, data: Partial<Omit<AssetEntity, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AssetEntity>;
  delete(id: string): Promise<void>;
}
