import type { ApplicationEntity, ApplicationStatus } from '@domain/entities/application.entity';

export interface ApplicationSearchParams {
  userId?: string;
  status?: ApplicationStatus;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface IApplicationRepository {
  findById(id: string): Promise<ApplicationEntity | null>;
  findAll(params: ApplicationSearchParams): Promise<PaginatedResult<ApplicationEntity>>;
  create(data: Omit<ApplicationEntity, 'id' | 'createdAt' | 'updatedAt' | 'user' | 'asset'>): Promise<ApplicationEntity>;
  update(id: string, data: Partial<Pick<ApplicationEntity, 'status' | 'returnDate'>>): Promise<ApplicationEntity>;
  findOverdue(): Promise<ApplicationEntity[]>;
}
