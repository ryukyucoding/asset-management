import { http } from './http'

export interface AssetQuery {
  name?: string
  serialNo?: string
  category?: string
  location?: string
  assignedDept?: string
  holderId?: string
  status?: string
  page?: number
  limit?: number
}

export interface AssetStats {
  available: number
  pendingRepair: number
  inRepair: number
}

export const assetApi = {
  list: (query: AssetQuery = {}) => http.get('/assets', { params: query }),
  stats: () => http.get<AssetStats>('/assets/stats'),
  get: (id: string) => http.get(`/assets/${id}`),
  create: (data: unknown) => http.post('/assets', data),
  update: (id: string, data: unknown) => http.patch(`/assets/${id}`, data),
  remove: (id: string) => http.delete(`/assets/${id}`),
}
