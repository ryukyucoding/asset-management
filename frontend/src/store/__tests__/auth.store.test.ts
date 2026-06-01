import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ── Mock router so logout() doesn't blow up in jsdom ────────────────────────
vi.mock('@/router', () => ({ default: { push: vi.fn() } }))

// ── Mock authApi ─────────────────────────────────────────────────────────────
vi.mock('@/apis/auth', () => ({
  authApi: {
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  },
}))

import { useAuthStore } from '../auth'
import { authApi } from '@/apis/auth'
import router from '@/router'

// ─────────────────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'u-1',
  name: '王小明',
  email: 'user@example.com',
  role: 'USER' as const,
  department: '工程部',
}

type LoginApiResult = Awaited<ReturnType<typeof authApi.login>>
type RefreshApiResult = Awaited<ReturnType<typeof authApi.refresh>>

function mockLoginResponse(data: LoginApiResult['data']): LoginApiResult {
  return { data } as LoginApiResult
}

function mockRefreshResponse(data: RefreshApiResult['data']): RefreshApiResult {
  return { data } as RefreshApiResult
}

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  // ── initial state ──────────────────────────────────────────────────────────

  it('starts with null state when localStorage is empty', () => {
    const store = useAuthStore()
    expect(store.user).toBeNull()
    expect(store.accessToken).toBeNull()
    expect(store.isLoggedIn).toBe(false)
    expect(store.isAdmin).toBe(false)
  })

  it('hydrates from localStorage on creation', () => {
    localStorage.setItem('accessToken', 'tok-abc')
    localStorage.setItem('user', JSON.stringify(mockUser))
    const store = useAuthStore()
    expect(store.accessToken).toBe('tok-abc')
    expect(store.user?.name).toBe('王小明')
    expect(store.isLoggedIn).toBe(true)
  })

  // ── login ──────────────────────────────────────────────────────────────────

  it('login() stores tokens and user in state + localStorage', async () => {
    vi.mocked(authApi.login).mockResolvedValue(
      mockLoginResponse({ accessToken: 'at-1', refreshToken: 'rt-1', user: mockUser }),
    )

    const store = useAuthStore()
    await store.login('user@example.com', 'User1234')

    expect(store.accessToken).toBe('at-1')
    expect(store.refreshToken).toBe('rt-1')
    expect(store.user).toEqual(mockUser)
    expect(store.isLoggedIn).toBe(true)
    expect(localStorage.getItem('accessToken')).toBe('at-1')
    expect(localStorage.getItem('refreshToken')).toBe('rt-1')
    const storedUser = localStorage.getItem('user')
    expect(storedUser).not.toBeNull()
    expect(JSON.parse(storedUser!)).toEqual(mockUser)
  })

  it('login() propagates API errors to the caller', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error('401'))

    const store = useAuthStore()
    await expect(store.login('bad@example.com', 'wrong')).rejects.toThrow('401')
    expect(store.isLoggedIn).toBe(false)
  })

  // ── isAdmin ────────────────────────────────────────────────────────────────

  it('isAdmin is true when role is ADMIN', async () => {
    vi.mocked(authApi.login).mockResolvedValue(
      mockLoginResponse({
        accessToken: 'at',
        refreshToken: 'rt',
        user: { ...mockUser, role: 'ADMIN' },
      }),
    )

    const store = useAuthStore()
    await store.login('admin@example.com', 'Admin1234')
    expect(store.isAdmin).toBe(true)
  })

  // ── logout ─────────────────────────────────────────────────────────────────

  it('logout() clears state, localStorage and redirects to /login', async () => {
    vi.mocked(authApi.login).mockResolvedValue(
      mockLoginResponse({ accessToken: 'at', refreshToken: 'rt', user: mockUser }),
    )

    const store = useAuthStore()
    await store.login('user@example.com', 'User1234')
    store.logout()

    expect(store.user).toBeNull()
    expect(store.accessToken).toBeNull()
    expect(store.isLoggedIn).toBe(false)
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(vi.mocked(router.push)).toHaveBeenCalledWith('/login')
  })

  // ── refresh ────────────────────────────────────────────────────────────────

  it('refresh() updates accessToken from API response', async () => {
    localStorage.setItem('accessToken', 'old-at')
    localStorage.setItem('refreshToken', 'rt-valid')
    vi.mocked(authApi.refresh).mockResolvedValue(mockRefreshResponse({ accessToken: 'new-at' }))

    const store = useAuthStore()
    await store.refresh()

    expect(store.accessToken).toBe('new-at')
    expect(localStorage.getItem('accessToken')).toBe('new-at')
  })

  it('refresh() throws when no refreshToken is present', async () => {
    const store = useAuthStore()
    await expect(store.refresh()).rejects.toThrow('No refresh token')
  })
})
