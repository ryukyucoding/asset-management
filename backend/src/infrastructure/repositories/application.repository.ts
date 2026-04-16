import { prisma } from '@infrastructure/database/prisma.client';
import type { IApplicationRepository, ApplicationSearchParams, PaginatedResult } from '@domain/repositories/application.repository.interface';
import type { ApplicationEntity } from '@domain/entities/application.entity';

export class ApplicationRepository implements IApplicationRepository {
  async findById(id: string): Promise<ApplicationEntity | null> {
    return prisma.application.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, department: true, createdAt: true, updatedAt: true } },
        asset: true,
        approvals: { orderBy: { step: 'asc' } },
      },
    }) as Promise<ApplicationEntity | null>;
  }

  async findAll(params: ApplicationSearchParams): Promise<PaginatedResult<ApplicationEntity>> {
    const { userId, status, page = 1, limit = 20 } = params;
    const where = {
      ...(userId && { userId }),
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true, department: true, createdAt: true, updatedAt: true } },
          asset: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.application.count({ where }),
    ]);

    return { data: data as ApplicationEntity[], total, page, limit };
  }

  async create(data: Omit<ApplicationEntity, 'id' | 'createdAt' | 'updatedAt' | 'user' | 'asset'>): Promise<ApplicationEntity> {
    return prisma.application.create({ data }) as Promise<ApplicationEntity>;
  }

  async update(id: string, data: Partial<Pick<ApplicationEntity, 'status' | 'returnDate'>>): Promise<ApplicationEntity> {
    return prisma.application.update({ where: { id }, data }) as Promise<ApplicationEntity>;
  }

  async findOverdue(): Promise<ApplicationEntity[]> {
    return prisma.application.findMany({
      where: {
        status: 'APPROVED',
        type: 'BORROW',
        returnDate: { lt: new Date() },
      },
      include: { user: true, asset: true },
    }) as Promise<ApplicationEntity[]>;
  }
}
