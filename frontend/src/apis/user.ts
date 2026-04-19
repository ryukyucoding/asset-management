import { http } from './http'

export interface UserSummary {
  id: string
  name: string
  email: string
  role: 'USER' | 'ADMIN'
  department: string | null
}

export const userApi = {
  list: () => http.get<UserSummary[]>('/users'),
}
