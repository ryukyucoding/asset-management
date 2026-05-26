import type { AssetEntity } from './asset.entity';
import type { UserEntityPublic } from './user.entity';

export type ApplicationStatus = 'PENDING' | 'IN_REPAIR' | 'COMPLETED' | 'REJECTED';

export interface ApplicationEntity {
  id: string;
  userId: string;
  assetId: string;
  status: ApplicationStatus;
  // 申請者填寫
  faultDescription: string;
  imageUrls: string[];
  // 維修人員填寫
  repairDate: Date | null;
  repairContent: string | null;
  repairSolution: string | null;
  repairCost: number | null;
  repairVendor: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: UserEntityPublic;
  asset?: AssetEntity;
}
