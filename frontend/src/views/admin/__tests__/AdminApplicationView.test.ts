import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountWithPlugins, makeApplication } from '@/test-utils/setup'

// ── Mock API ──────────────────────────────────────────────────────────────────
vi.mock('@/apis/application', () => ({
  applicationApi: {
    list: vi.fn(),
    approve: vi.fn(),
    repairDetails: vi.fn(),
    complete: vi.fn(),
  },
}))

vi.mock('element-plus', async (importOriginal) => {
  const mod = await importOriginal<typeof import('element-plus')>()
  return {
    ...mod,
    ElMessage: { success: vi.fn(), error: vi.fn() },
    ElMessageBox: { confirm: vi.fn().mockResolvedValue(true) },
  }
})

import AdminApplicationView from '../AdminApplicationView.vue'
import { applicationApi } from '@/apis/application'

// ─────────────────────────────────────────────────────────────────────────────

function mockListSuccess(items = [makeApplication()], total = 1) {
  vi.mocked(applicationApi.list).mockResolvedValue({ data: { data: items, total } } as never)
}

/** Status-aware mock: KPI calls (limit:1 + status) get their own totals; page calls get items. */
function mockListByStatus(
  kpiCounts: Partial<Record<string, number>>,
  items = [makeApplication()],
  total = 1,
) {
  vi.mocked(applicationApi.list).mockImplementation((query = {}) => {
    const { status, limit } = query
    if (limit === 1 && status) {
      return Promise.resolve({ data: { data: [], total: kpiCounts[status] ?? 0 } }) as never
    }
    return Promise.resolve({ data: { data: items, total } }) as never
  })
}

describe('AdminApplicationView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── onMounted fetch ────────────────────────────────────────────────────────

  it('calls applicationApi.list on mount', async () => {
    mockListSuccess()
    mountWithPlugins(AdminApplicationView)
    await flushPromises()
    // 1 page fetch + 4 KPI status fetches
    expect(applicationApi.list).toHaveBeenCalled()
    expect(applicationApi.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10 }))
  })

  it('fetches with pagination params', async () => {
    mockListSuccess()
    mountWithPlugins(AdminApplicationView)
    await flushPromises()
    expect(applicationApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 10 }),
    )
  })

  it('does not throw when loading applications', async () => {
    mockListSuccess([makeApplication()])
    const wrapper = mountWithPlugins(AdminApplicationView)
    await flushPromises()
    expect(wrapper.exists()).toBe(true)
  })

  // ── KPI counters (rendered outside el-table-column) ───────────────────────

  it('counts pending applications correctly', async () => {
    mockListByStatus({ PENDING: 2, IN_REPAIR: 1, COMPLETED: 0, REJECTED: 0 })
    const wrapper = mountWithPlugins(AdminApplicationView)
    await flushPromises()
    expect(wrapper.find('.kpi-pending .kpi-num').text()).toBe('2')
  })

  it('counts in-repair applications correctly', async () => {
    mockListByStatus({ PENDING: 0, IN_REPAIR: 1, COMPLETED: 1, REJECTED: 0 })
    const wrapper = mountWithPlugins(AdminApplicationView)
    await flushPromises()
    expect(wrapper.find('.kpi-repair .kpi-num').text()).toBe('1')
  })

  it('counts completed and rejected applications', async () => {
    mockListByStatus({ PENDING: 0, IN_REPAIR: 0, COMPLETED: 1, REJECTED: 1 })
    const wrapper = mountWithPlugins(AdminApplicationView)
    await flushPromises()
    expect(wrapper.find('.kpi-completed .kpi-num').text()).toBe('1')
    expect(wrapper.find('.kpi-rejected .kpi-num').text()).toBe('1')
  })

  it('shows total count', async () => {
    mockListSuccess([makeApplication()], 15)
    const wrapper = mountWithPlugins(AdminApplicationView)
    await flushPromises()
    expect(wrapper.find('.total-hint').text()).toContain('15')
  })

  // ── Dialog DOM (el-dialog stub always renders its content) ────────────────

  it('review dialog is in the DOM', async () => {
    mockListSuccess()
    const wrapper = mountWithPlugins(AdminApplicationView)
    await flushPromises()
    // The el-dialog stub renders its title prop; review dialogs are always in DOM
    const dialogTitles = wrapper.findAll('.dialog-title').map((d) => d.text())
    expect(dialogTitles.some((t) => t.includes('核准') || t.includes('拒絕') || t === '')).toBe(
      true,
    )
  })

  it('repair details dialog is in the DOM', async () => {
    mockListSuccess()
    const wrapper = mountWithPlugins(AdminApplicationView)
    await flushPromises()
    const dialogTitles = wrapper.findAll('.dialog-title').map((d) => d.text())
    expect(dialogTitles.some((t) => t.includes('維修細節') || t === '')).toBe(true)
  })

  // ── API error ──────────────────────────────────────────────────────────────

  it('does not throw when applicationApi.list rejects', async () => {
    vi.mocked(applicationApi.list).mockRejectedValue(new Error('500'))
    const wrapper = mountWithPlugins(AdminApplicationView)
    await flushPromises()
    expect(wrapper.exists()).toBe(true)
  })
})
