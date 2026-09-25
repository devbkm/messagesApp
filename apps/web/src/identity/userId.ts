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
    const id = crypto.randomUUID()
    window.localStorage.setItem(STORAGE_KEY, id)
    return (cached = id)
  } catch {
    return (cached = crypto.randomUUID())
  }
}
