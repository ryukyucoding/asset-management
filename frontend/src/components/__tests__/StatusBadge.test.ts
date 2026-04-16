import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge from '../StatusBadge.vue'

function mountBadge(status: string, label: string) {
  return mount(StatusBadge, { props: { status, label } })
}

describe('StatusBadge', () => {
  describe('renders label text', () => {
    it('displays the label prop', () => {
      const wrapper = mountBadge('AVAILABLE', '正常使用')
      expect(wrapper.text()).toContain('正常使用')
    })

    it('renders badge element for any status', () => {
      const wrapper = mountBadge('PENDING', '待審核')
      expect(wrapper.find('.badge').exists()).toBe(true)
    })
  })

  describe('variant class mapping', () => {
    it.each([
      ['AVAILABLE', 'badge--success'],
      ['APPROVED', 'badge--success'],
      ['COMPLETED', 'badge--success'],
      ['IN_REPAIR', 'badge--warning'],
      ['PENDING', 'badge--pending'],
      ['BORROWED', 'badge--warning'],
      ['CLAIMED', 'badge--info'],
      ['RETURNED', 'badge--neutral'],
      ['REJECTED', 'badge--danger'],
      ['CANCELLED', 'badge--neutral'],
      ['RETIRED', 'badge--danger'],
    ])('status "%s" maps to class "%s"', (status, expectedClass) => {
      const wrapper = mountBadge(status, status)
      expect(wrapper.find('.badge').classes()).toContain(expectedClass)
    })

    it('falls back to badge--neutral for unknown status', () => {
      const wrapper = mountBadge('SOME_UNKNOWN_STATUS', 'Unknown')
      expect(wrapper.find('.badge').classes()).toContain('badge--neutral')
    })
  })

  describe('DOM structure', () => {
    it('renders a badge-dot element', () => {
      const wrapper = mountBadge('AVAILABLE', '正常使用')
      expect(wrapper.find('.badge-dot').exists()).toBe(true)
    })

    it('renders as a span element', () => {
      const wrapper = mountBadge('AVAILABLE', '正常使用')
      expect(wrapper.element.tagName.toLowerCase()).toBe('span')
    })

    it('has exactly one dot and one text node', () => {
      const wrapper = mountBadge('PENDING', '待審核')
      expect(wrapper.findAll('.badge-dot')).toHaveLength(1)
    })
  })
})
