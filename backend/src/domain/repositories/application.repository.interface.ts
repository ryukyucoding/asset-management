import type { ApplicationEntity, ApplicationStatus } from '@domain/entities/application.entity';

export interface ApplicationSearchParams {
  userId?: string;
  assetId?: string;
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

export type ApplicationUpdateData = Partial<
  Pick<ApplicationEntity,
    | 'status'
    | 'repairDate'
    | 'repairContent'
    | 'repairSolution'
    | 'repairCost'
    | 'repairVendor'
  >
>;

export interface IApplicationRepository {
  findById(id: string): Promise<ApplicationEntity | null>;
  findAll(params: ApplicationSearchParams): Promise<PaginatedResult<ApplicationEntity>>;
  create(data: Omit<ApplicationEntity, 'id' | 'createdAt' | 'updatedAt' | 'user' | 'asset'>): Promise<ApplicationEntity>;
  update(id: string, data: ApplicationUpdateData): Promise<ApplicationEntity>;
}
