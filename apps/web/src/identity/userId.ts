const STORAGE_KEY = 'inbox.userId'

let cached: string | null = null

/**
 * The id this browser uses to identify its user to the API (sent as `X-User-Id`).
 *
 * Generated once and kept in localStorage, so the same inbox is shown across visits.
 * If storage is unavailable (private mode, blocked site data) the id lasts for this
 * page session only. With real authentication this would return a token instead.
 */
export function getUserId(): string {
  if (cached) return cached
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) return (cached = stored)
    const id = newUuid()
    window.localStorage.setItem(STORAGE_KEY, id)
    return (cached = id)
  } catch {
    return (cached = newUuid())
  }
}

/**
 * Random v4 UUID. `crypto.randomUUID` only exists in secure contexts (https or
 * localhost), so opening the dev server via a LAN address (http://192.168.x.x) falls
 * back to `getRandomValues`, which is available everywhere.
 */
export function newUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC 4122 variant
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
