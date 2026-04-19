import { prisma } from '@infrastructure/database/prisma.client';
import type { IUserRepository } from '@domain/repositories/user.repository.interface';
import type { UserEntity } from '@domain/entities/user.entity';

export class UserRepository implements IUserRepository {
  async findById(id: string): Promise<UserEntity | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async create(data: { name: string; email: string; passwordHash: string; department?: string }): Promise<UserEntity> {
    return prisma.user.create({ data });
  }

  async update(id: string, data: Partial<Pick<UserEntity, 'name' | 'department' | 'role'>>): Promise<UserEntity> {
    return prisma.user.update({ where: { id }, data });
  }

  async findAll(): Promise<Omit<UserEntity, 'passwordHash'>[]> {
    return prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, department: true, createdAt: true, updatedAt: true },
      orderBy: { name: 'asc' },
    });
  }
}
