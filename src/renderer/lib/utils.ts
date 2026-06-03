import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { BASE_FPS_OPTIONS } from "../../shared/constants/display"
import type { PlaylistTimeUnit } from "../../shared/constants/playlist"
import { WorkshopItem } from "src/main/services/workshop/workshop.types"
import { Wallpaper } from "src/shared/constants/wallpaper"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
// Format bytes to human-readable file size
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/**
 * Generate FPS options based on the maximum refresh rate
 * @param maxRefreshRate - Maximum refresh rate from displays
 * @param currentFps - Current FPS value to ensure it's included in options
 * @returns Array of FPS options that don't exceed the max refresh rate, with max as final option
 */
export function getFpsOptions(maxRefreshRate: number, currentFps?: number): number[] {
  const filtered = BASE_FPS_OPTIONS.filter(fps => fps <= maxRefreshRate)
  const options: Set<number> = new Set(filtered)

  // Add the max refresh rate if it's not already included
  if (maxRefreshRate > 0) {
    options.add(maxRefreshRate)
  }

  // Ensure current FPS is always included (important for maintaining selection)
  if (currentFps && currentFps > 0) {
    options.add(currentFps)
  }

  return Array.from(options).sort((a, b) => a - b)
}

// ── Playlist delay conversion ──────────────────────────────────────────

const MS_PER_SECOND = 1_000
const MS_PER_MINUTE = 60 * MS_PER_SECOND
const MS_PER_HOUR = 60 * MS_PER_MINUTE

const UNIT_TO_MS: Record<PlaylistTimeUnit, number> = {
  seconds: MS_PER_SECOND,
  minutes: MS_PER_MINUTE,
  hours: MS_PER_HOUR,
}

/** Convert a UI delay value + unit into engine-compatible minutes */
export function delayToMinutes(value: number, unit: PlaylistTimeUnit): number {
  const ms = value * UNIT_TO_MS[unit]
  return Math.max(ms / MS_PER_MINUTE, 1 / 60)
}

/** Convert engine minutes into the best-fit UI value + unit */
export function minutesToDelay(minutes: number): { value: number, unit: PlaylistTimeUnit } {
  const totalMs = minutes * MS_PER_MINUTE
  if (totalMs >= MS_PER_HOUR && totalMs % MS_PER_HOUR === 0) return { value: totalMs / MS_PER_HOUR, unit: "hours" }
  if (totalMs >= MS_PER_MINUTE) return { value: totalMs / MS_PER_MINUTE, unit: "minutes" }
  return { value: Math.round(totalMs / MS_PER_SECOND), unit: "seconds" }
}


export function toWallpaper(item: WorkshopItem): Wallpaper {
  return {
    id: item.id,
    workshopId: item.id,
    title: item.title,
    author: item.author,
    ageRating: item.ageRating,
    type: item.type,
    thumbnail: item.previewUrl ?? "",
    previewUrl: item.previewUrl,
    resolution: { width: 0, height: 0 },
    fileSize: 0,
    dateAdded: 0,
    tags: item.tags,
    installed: false,
    path: "",
  }
}

/** Walk up the DOM to the nearest scrollable ancestor (the app-shell <main>). */
export function findScrollParent(node: HTMLElement | null): HTMLElement | null {
    let el = node?.parentElement ?? null
    while (el) {
        const { overflowY } = getComputedStyle(el)
        if (overflowY === "auto" || overflowY === "scroll") return el
        el = el.parentElement
    }
    return null
}