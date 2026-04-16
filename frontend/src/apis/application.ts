import { http } from './http'

export interface ApplicationQuery {
  status?: string
  assetId?: string
  page?: number
  limit?: number
}

export interface CreateApplicationData {
  assetId: string
  faultDescription: string
  imageUrls?: string[]
}

export interface RepairDetailsData {
  repairDate?: string
  repairContent?: string
  repairSolution?: string
  repairCost?: number
  repairVendor?: string
}

export const applicationApi = {
  list: (query: ApplicationQuery = {}) => http.get('/applications', { params: query }),
  get: (id: string) => http.get(`/applications/${id}`),
  create: (data: CreateApplicationData) => http.post('/applications', data),
  approve: (id: string, data: { action: 'APPROVED' | 'REJECTED'; comment?: string }) =>
    http.patch(`/applications/${id}/approve`, data),
  repairDetails: (id: string, data: RepairDetailsData) =>
    http.patch(`/applications/${id}/repair-details`, data),
  complete: (id: string) => http.patch(`/applications/${id}/complete`),
}
