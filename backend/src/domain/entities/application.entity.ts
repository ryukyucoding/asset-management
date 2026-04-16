import type { AssetEntity } from './asset.entity';
import type { UserEntityPublic } from './user.entity';

export type ApplicationType = 'BORROW' | 'CLAIM';
export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED' | 'CANCELLED';

export interface ApplicationEntity {
  id: string;
  userId: string;
  assetId: string;
  type: ApplicationType;
  status: ApplicationStatus;
  returnDate: Date | null;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: UserEntityPublic;
  asset?: AssetEntity;
}
