import { http } from './http'

export interface ApplicationQuery {
  status?: string
  page?: number
  limit?: number
}

export const applicationApi = {
  list: (query: ApplicationQuery = {}) => http.get('/applications', { params: query }),
  get: (id: string) => http.get(`/applications/${id}`),
  create: (data: unknown) => http.post('/applications', data),
  approve: (id: string, data: { action: 'APPROVED' | 'REJECTED'; comment?: string }) =>
    http.patch(`/applications/${id}/approve`, data),
  return: (id: string) => http.patch(`/applications/${id}/return`),
}
