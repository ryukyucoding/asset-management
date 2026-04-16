export type AssetStatus = 'AVAILABLE' | 'IN_REPAIR' | 'RETIRED';

export interface AssetEntity {
  id: string;
  name: string;
  serialNo: string;
  category: string;
  model: string | null;
  spec: string | null;
  supplier: string | null;
  purchaseDate: Date | null;
  purchaseCost: number | null;
  location: string;
  assignedDept: string | null;
  startDate: Date | null;
  warrantyExpiry: Date | null;
  status: AssetStatus;
  holderId: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}
