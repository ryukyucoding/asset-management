/**
 * Resolve a stored media URL for use in <img src> and previews.
 *
 * - Relative paths (/uploads/...) → prefixed with VITE_API_URL
 * - Legacy localhost upload URLs → rewritten to match VITE_API_URL (fixes mixed dev/deploy)
 * - GCS / other absolute URLs → returned unchanged
 */
export function resolveMediaUrl(url: string): string {
  if (!url) return url

  const apiBase = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  if (url.startsWith('/')) {
    return `${apiBase}${url}`
  }

  try {
    const parsed = new URL(url)
    const api = new URL(apiBase)
    const isLocalUpload =
      parsed.pathname.startsWith('/uploads/') &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')

    if (isLocalUpload && parsed.origin !== api.origin) {
      return `${api.origin}${parsed.pathname}`
    }
  } catch {
    // not a valid absolute URL
  }

  return url
}

export function resolveMediaUrls(urls: string[]): string[] {
  return urls.map(resolveMediaUrl)
}
