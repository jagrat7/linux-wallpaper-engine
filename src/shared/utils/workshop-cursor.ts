import { FIRST_PAGE } from '../constants/workshop'

// Opaque cursor used as the wire format for Workshop pagination.
// Kept isomorphic (btoa/atob) so both renderer and main encode/decode the same way,
// and kept extensible (JSON payload) so we can pin more query state into the cursor later.
export function encodeWorkshopCursor(page: number): string {
  return btoa(JSON.stringify({ p: page }))
}

export function decodeWorkshopCursor(cursor: string | undefined | null): number {
  if (!cursor) return FIRST_PAGE

  try {
    const decoded = JSON.parse(atob(cursor)) as { p?: unknown }
    const page = Number(decoded?.p)
    return Number.isFinite(page) && page >= FIRST_PAGE ? Math.floor(page) : FIRST_PAGE
  } catch {
    return FIRST_PAGE
  }
}
