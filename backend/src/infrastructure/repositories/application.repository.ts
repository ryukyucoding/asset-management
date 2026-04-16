import { prisma } from '@infrastructure/database/prisma.client';
import type { IApplicationRepository, ApplicationSearchParams, PaginatedResult, ApplicationUpdateData } from '@domain/repositories/application.repository.interface';
import type { ApplicationEntity } from '@domain/entities/application.entity';

const includeRelations = {
  user: { select: { id: true, name: true, email: true, department: true, role: true, createdAt: true, updatedAt: true } },
  asset: true,
} as const;

export class ApplicationRepository implements IApplicationRepository {
  async findById(id: string): Promise<ApplicationEntity | null> {
    return prisma.application.findUnique({
      where: { id },
      include: includeRelations,
    }) as Promise<ApplicationEntity | null>;
  }

  async findAll(params: ApplicationSearchParams): Promise<PaginatedResult<ApplicationEntity>> {
    const { userId, assetId, status, page = 1, limit = 20 } = params;

    const where = {
      ...(userId  && { userId }),
      ...(assetId && { assetId }),
      ...(status  && { status }),
    };

    const [data, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: includeRelations,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.application.count({ where }),
    ]);

    return { data: data as ApplicationEntity[], total, page, limit };
  }

  async create(data: Omit<ApplicationEntity, 'id' | 'createdAt' | 'updatedAt' | 'user' | 'asset'>): Promise<ApplicationEntity> {
    return prisma.application.create({
      data,
      include: includeRelations,
    }) as Promise<ApplicationEntity>;
  }

  async update(id: string, data: ApplicationUpdateData): Promise<ApplicationEntity> {
    return prisma.application.update({
      where: { id },
      data,
      include: includeRelations,
    }) as Promise<ApplicationEntity>;
  }
}
