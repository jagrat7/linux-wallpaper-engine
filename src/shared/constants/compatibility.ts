// Wallpaper compatibility status
export const COMPATIBILITY_STATUSES = ['perfect', 'minor', 'major', 'broken', 'unknown'] as const
export type CompatibilityStatus = (typeof COMPATIBILITY_STATUSES)[number]

export const COMPATIBILITY_CONFIG = {
  perfect: {
    label: 'Perfect',
    severity: 1,
    color: 'green',
    textColor: 'text-green-500',
    bgColor: 'bg-green-500',
  },
  minor: {
    label: 'Minor Issues',
    severity: 2,
    color: 'yellow',
    textColor: 'text-yellow-500',
    bgColor: 'bg-yellow-500',
  },
  major: {
    label: 'Major Issues',
    severity: 3,
    color: 'orange',
    textColor: 'text-orange-500',
    bgColor: 'bg-orange-500',
  },
  broken: {
    label: 'Broken',
    severity: 4,
    color: 'red',
    textColor: 'text-red-500',
    bgColor: 'bg-red-500',
  },
  unknown: {
    label: 'Unknown',
    severity: 0,
    color: 'gray',
    textColor: 'text-muted-foreground',
    bgColor: 'bg-muted-foreground/50',
  },
} as const satisfies Record<
  CompatibilityStatus,
  { label: string; severity: number; color: string; textColor: string; bgColor: string }
>

export const COMPATIBILITY_OPTIONS = COMPATIBILITY_STATUSES.map((value) => ({
  value,
  ...COMPATIBILITY_CONFIG[value],
}))

// Compatibility scan progress
export interface ScanProgress {
  running: boolean
  current: string
  total: number
  scanned: number
  aborted: boolean
}

export const DEFAULT_SCAN_PROGRESS: ScanProgress = {
  running: false,
  current: '',
  total: 0,
  scanned: 0,
  aborted: false,
}

// Patterns used to classify wallpaper stderr output during compatibility scanning
export const BROKEN_PATTERNS = [
  /segmentation fault/i,
  /segfault/i,
  /failed to initialize glfw/i,
  /glfw.*error/i,
  /abort.*core dumped/i,
  /cannot open display/i,
]

export const MINOR_PATTERNS = [
  /missing texture/i,
  /missing shader/i,
  /missing material/i,
  /scenescript/i,
  /cannot find/i,
  /warning/i,
  /not supported/i,
  /failed to load/i,
]

// Known harmless messages that should be ignored during compatibility scanning
// (e.g. Wayland GLFW warnings that don't affect wallpaper functionality)
export const COMPAT_IGNORE_PATTERNS = [
  /the platform does not provide the window position/i,
  /the platform does not support setting the window position/i,
]
