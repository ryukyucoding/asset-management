import { prisma } from '@infrastructure/database/prisma.client';
import type { IApprovalRepository, CreateApprovalData } from '@domain/repositories/approval.repository.interface';
import type { ApprovalEntity } from '@domain/entities/approval.entity';

export class ApprovalRepository implements IApprovalRepository {
  async create(data: CreateApprovalData): Promise<ApprovalEntity> {
    return prisma.approval.create({ data });
  }
}
