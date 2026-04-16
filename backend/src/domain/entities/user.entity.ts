export type UserRole = 'USER' | 'ADMIN';

export interface UserEntity {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  department: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserEntityPublic = Omit<UserEntity, 'passwordHash'>;
