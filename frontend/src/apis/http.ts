import axios from 'axios'
import { useAuthStore } from '@/store/auth'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  timeout: 10000,
})

http.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`
  }
  return config
})

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const auth = useAuthStore()
    if (error.response?.status === 401 && auth.refreshToken) {
      try {
        await auth.refresh()
        error.config.headers.Authorization = `Bearer ${auth.accessToken}`
        return http.request(error.config)
      } catch {
        auth.logout()
      }
    }
    return Promise.reject(error)
  },
)
