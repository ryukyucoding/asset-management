import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/apis/auth'
import router from '@/router'

interface User {
  id: string
  name: string
  email: string
  role: 'USER' | 'ADMIN'
  department: string | null
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(JSON.parse(localStorage.getItem('user') ?? 'null'))
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'))
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'))

  const isLoggedIn = computed(() => !!accessToken.value)
  const isAdmin = computed(() => user.value?.role === 'ADMIN')

  async function login(email: string, password: string): Promise<void> {
    const res = await authApi.login({ email, password })
    accessToken.value = res.data.accessToken
    refreshToken.value = res.data.refreshToken
    user.value = res.data.user
    localStorage.setItem('accessToken', res.data.accessToken)
    localStorage.setItem('refreshToken', res.data.refreshToken)
    localStorage.setItem('user', JSON.stringify(res.data.user))
  }

  async function refresh(): Promise<void> {
    if (!refreshToken.value) throw new Error('No refresh token')
    const res = await authApi.refresh(refreshToken.value)
    accessToken.value = res.data.accessToken
    localStorage.setItem('accessToken', res.data.accessToken)
  }

  function logout(): void {
    user.value = null
    accessToken.value = null
    refreshToken.value = null
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    router.push('/login')
  }

  return { user, accessToken, refreshToken, isLoggedIn, isAdmin, login, refresh, logout }
})
