/**
 * Shared test helpers for integration tests.
 *
 * Provides:
 *  - mountWithPlugins()  — mounts a component with Pinia + Vue Router + i18n + Element Plus stubs
 *  - makeAsset()         — factory for Asset fixtures
 *  - makeApplication()   — factory for Application fixtures
 */

import { mount, type MountingOptions } from '@vue/test-utils'
import { createTestingPinia, type TestingOptions } from '@pinia/testing'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { vi } from 'vitest'
import type { Component } from 'vue'

// ── Minimal router (no real routes needed for view-level tests) ─────────────
export function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
}

// ── Minimal i18n (empty messages — views use $t() but we don't assert on text) ─
export function makeI18n() {
  return createI18n({ legacy: false, locale: 'zh-TW', messages: { 'zh-TW': {} } })
}

// ── Stub all Element Plus components so jsdom doesn't need to render them ────
//
// el-table-column intentionally renders NO slots — the real el-table passes
// `row` as a scoped slot prop, but our stub cannot replicate that.  Rendering
// the slot without row would throw "Cannot read properties of undefined".
// Tests that need to see table cell text should check .total-hint / KPI nodes
// or verify the API call instead of asserting on slot-rendered text.
const EP_SLOT_STUB = { template: '<div><slot /><slot name="default" /></div>' }
const EP_EMPTY_STUB = { template: '<span />' }

// el-button renders as <button> so wrapper.findAll('button') can locate it
const EP_BTN_STUB = { template: '<button type="button"><slot /></button>' }

// el-dialog renders its title prop + default slot + footer slot so
// dialog text is assertable without needing to open/close dialogs
const EP_DIALOG_STUB = {
  props: ['title', 'modelValue'],
  template:
    '<div><span class="dialog-title">{{ title }}</span><slot /><slot name="default" /><slot name="footer" /></div>',
}

const EP_STUBS: Record<string, object> = {
  ...Object.fromEntries(
    [
      'el-table',
      'el-form',
      'el-form-item',
      'el-input',
      'el-select',
      'el-option',
      'el-pagination',
      'el-tag',
      'el-row',
      'el-col',
      'el-divider',
      'el-descriptions',
      'el-descriptions-item',
      'el-date-picker',
      'el-input-number',
      'el-image',
      'el-icon',
      'el-message-box',
      'el-loading',
    ].map((name) => [name, EP_SLOT_STUB]),
  ),
  // Render as real <button> so tests can find/click them
  'el-button': EP_BTN_STUB,
  // Render title + slots so dialog text is assertable
  'el-dialog': EP_DIALOG_STUB,
  // el-table-column must NOT render slots to avoid "row is undefined" errors
  // (the real el-table calls column slots with row context, the stub can't replicate this)
  'el-table-column': EP_EMPTY_STUB,
}

// ── Mount helper ─────────────────────────────────────────────────────────────
export function mountWithPlugins(
  component: Component,
  options: {
    piniaOptions?: TestingOptions
    mountOptions?: MountingOptions<Record<string, unknown>>
  } = {},
) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: false, // let actions run so we can verify side-effects
    ...options.piniaOptions,
  })

  return mount(component as Parameters<typeof mount>[0], {
    global: {
      plugins: [pinia, makeRouter(), makeI18n()],
      stubs: { ...EP_STUBS, 'el-message': true, StatusBadge: true, ImageUploader: true },
    },
    ...options.mountOptions,
  })
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
export function makeAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: 'asset-1',
    name: '測試筆電',
    serialNo: 'SN-001',
    category: 'IT設備',
    model: 'ThinkPad X1',
    spec: '16GB RAM',
    supplier: '聯想',
    purchaseDate: '2024-01-01T00:00:00.000Z',
    purchaseCost: 30000,
    location: 'A棟 101',
    assignedDept: '工程部',
    startDate: '2024-01-15T00:00:00.000Z',
    warrantyExpiry: '2027-01-01T00:00:00.000Z',
    status: 'AVAILABLE',
    holderId: 'user-1',
    description: null,
    imageUrls: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function makeApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: 'app-1',
    userId: 'user-1',
    assetId: 'asset-1',
    status: 'PENDING',
    faultDescription: '螢幕閃爍，無法正常使用',
    imageUrls: [],
    repairDate: null,
    repairContent: null,
    repairSolution: null,
    repairCost: null,
    repairVendor: null,
    createdAt: '2024-04-01T00:00:00.000Z',
    updatedAt: '2024-04-01T00:00:00.000Z',
    user: {
      id: 'user-1',
      name: '王小明',
      email: 'user@example.com',
      department: '工程部',
      role: 'USER',
    },
    asset: makeAsset(),
    ...overrides,
  }
}
