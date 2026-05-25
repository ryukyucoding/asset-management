import type { UserEntity, UserRole } from '@domain/entities/user.entity';

export interface IUserRepository {
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  findIdsByRole(role: UserRole): Promise<string[]>;
  create(data: {
    name: string;
    email: string;
    passwordHash: string;
    department?: string;
  }): Promise<UserEntity>;
  update(id: string, data: Partial<Pick<UserEntity, 'name' | 'department' | 'role'>>): Promise<UserEntity>;
}
