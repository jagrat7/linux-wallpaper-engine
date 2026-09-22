export function stripVersionPrefix(version: string): string {
  return version.replace(/^v/, '')
}

function parseVersionParts(version: string): number[] | null {
  const normalized = stripVersionPrefix(version).split('-')[0]
  const parts = normalized.split('.')

  if (parts.length === 0 || parts.some((part) => part === '' || Number.isNaN(Number(part)))) {
    return null
  }

  return parts.map((part) => Number(part))
}

function compareVersions(a: string, b: string): number | null {
  const aParts = parseVersionParts(a)
  const bParts = parseVersionParts(b)

  if (!aParts || !bParts) return null

  const length = Math.max(aParts.length, bParts.length)
  for (let i = 0; i < length; i++) {
    const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0)
    if (diff !== 0) return diff
  }

  return 0
}

export function isNewerVersion(latest: string, current: string): boolean {
  const result = compareVersions(latest, current)
  return result !== null && result > 0
}
