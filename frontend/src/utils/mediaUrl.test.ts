import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveMediaUrl, resolveMediaUrls } from './mediaUrl'

describe('resolveMediaUrl', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('prefixes relative upload paths with VITE_API_URL', () => {
    expect(resolveMediaUrl('/uploads/abc.jpg')).toBe('https://api.example.com/uploads/abc.jpg')
  })

  it('rewrites legacy localhost URLs to VITE_API_URL', () => {
    expect(resolveMediaUrl('http://localhost:3000/uploads/abc.jpg')).toBe(
      'https://api.example.com/uploads/abc.jpg',
    )
  })

  it('leaves GCS URLs unchanged', () => {
    const gcs = 'https://storage.googleapis.com/bucket/uploads/abc.jpg'
    expect(resolveMediaUrl(gcs)).toBe(gcs)
  })

  it('resolveMediaUrls maps all entries', () => {
    expect(resolveMediaUrls(['/uploads/a.jpg', '/uploads/b.jpg'])).toEqual([
      'https://api.example.com/uploads/a.jpg',
      'https://api.example.com/uploads/b.jpg',
    ])
  })
})
