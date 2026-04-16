export type AssetStatus = 'AVAILABLE' | 'BORROWED' | 'CLAIMED' | 'RETIRED';

export interface AssetEntity {
  id: string;
  name: string;
  serialNo: string;
  category: string;
  location: string;
  status: AssetStatus;
  holderId: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}
