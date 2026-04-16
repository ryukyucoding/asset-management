import { prisma } from '@infrastructure/database/prisma.client';
import type { IAssetRepository, AssetSearchParams, PaginatedResult } from '@domain/repositories/asset.repository.interface';
import type { AssetEntity } from '@domain/entities/asset.entity';

export class AssetRepository implements IAssetRepository {
  async findById(id: string): Promise<AssetEntity | null> {
    return prisma.asset.findUnique({ where: { id } });
  }

  async findAll(params: AssetSearchParams): Promise<PaginatedResult<AssetEntity>> {
    const { name, category, location, status, page = 1, limit = 20 } = params;
    const where = {
      ...(name && { name: { contains: name, mode: 'insensitive' as const } }),
      ...(category && { category }),
      ...(location && { location }),
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.asset.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async create(data: Omit<AssetEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<AssetEntity> {
    return prisma.asset.create({ data });
  }

  async update(id: string, data: Partial<Omit<AssetEntity, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AssetEntity> {
    return prisma.asset.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await prisma.asset.update({ where: { id }, data: { status: 'RETIRED' } });
  }
}
