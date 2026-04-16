import { http } from './http'

export interface LoginPayload {
  email: string
  password: string
}
export interface RegisterPayload {
  name: string
  email: string
  password: string
  department?: string
}

export const authApi = {
  login: (payload: LoginPayload) => http.post('/auth/login', payload),
  register: (payload: RegisterPayload) => http.post('/auth/register', payload),
  refresh: (refreshToken: string) => http.post('/auth/refresh', { refreshToken }),
  logout: () => http.post('/auth/logout'),
}
