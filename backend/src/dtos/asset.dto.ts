import { z } from 'zod';

export const CreateAssetDTO = z.object({
  name:          z.string().min(1),
  serialNo:      z.string().min(1),
  category:      z.string().min(1),
  model:         z.string().optional(),
  spec:          z.string().optional(),
  supplier:      z.string().optional(),
  purchaseDate:  z.string().datetime().optional(),
  purchaseCost:  z.number().nonnegative().optional(),
  location:      z.string().min(1),
  assignedDept:  z.string().optional(),
  startDate:     z.string().datetime().optional(),
  warrantyExpiry: z.string().datetime().optional(),
  holderId:      z.string().cuid().optional(),
  description:   z.string().optional(),
  imageUrls:     z.array(z.string().url()).optional(),
});

export const UpdateAssetDTO = z.object({
  name:          z.string().min(1).optional(),
  category:      z.string().min(1).optional(),
  model:         z.string().optional(),
  spec:          z.string().optional(),
  supplier:      z.string().optional(),
  purchaseDate:  z.string().datetime().optional(),
  purchaseCost:  z.number().nonnegative().optional(),
  location:      z.string().min(1).optional(),
  assignedDept:  z.string().optional(),
  startDate:     z.string().datetime().optional(),
  warrantyExpiry: z.string().datetime().optional(),
  holderId:      z.string().cuid().nullable().optional(),
  status:        z.enum(['AVAILABLE', 'IN_REPAIR', 'RETIRED']).optional(),
  description:   z.string().optional(),
  imageUrls:     z.array(z.string().url()).optional(),
});

export const AssetQueryDTO = z.object({
  name:        z.string().optional(),
  serialNo:    z.string().optional(),
  category:    z.string().optional(),
  location:    z.string().optional(),
  assignedDept: z.string().optional(),
  holderId:    z.string().optional(),
  status:      z.enum(['AVAILABLE', 'IN_REPAIR', 'RETIRED']).optional(),
  page:        z.coerce.number().int().positive().default(1),
  limit:       z.coerce.number().int().positive().max(100).default(20),
});

export type CreateAssetDTOType  = z.infer<typeof CreateAssetDTO>;
export type UpdateAssetDTOType  = z.infer<typeof UpdateAssetDTO>;
export type AssetQueryDTOType   = z.infer<typeof AssetQueryDTO>;
