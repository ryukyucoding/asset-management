import { z } from 'zod';

export const CreateAssetDTO = z.object({
  name: z.string().min(1),
  serialNo: z.string().min(1),
  category: z.string().min(1),
  location: z.string().min(1),
  description: z.string().optional(),
});

export const UpdateAssetDTO = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  description: z.string().optional(),
});

export const AssetQueryDTO = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(['AVAILABLE', 'BORROWED', 'CLAIMED', 'RETIRED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateAssetDTOType = z.infer<typeof CreateAssetDTO>;
export type UpdateAssetDTOType = z.infer<typeof UpdateAssetDTO>;
export type AssetQueryDTOType = z.infer<typeof AssetQueryDTO>;
