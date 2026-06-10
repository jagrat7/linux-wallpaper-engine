import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { PROPERTY_CONTROL_TYPES, type WallpaperProperty } from '../../../shared/constants/wallpaper'

// Serialize a project.json property value into the string form used for
// `--set-property name=value` (booleans as 1/0, everything else verbatim).
export const serializePropertyValue = (value: unknown): string => {
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (value === null || value === undefined) return ''
  return String(value)
}

const isControlType = (type: unknown): type is WallpaperProperty['type'] =>
  typeof type === 'string' && (PROPERTY_CONTROL_TYPES as readonly string[]).includes(type)

// Extract user-settable properties from a parsed project.json. This reads the
// same `general.properties` block the backend's PropertyParser consumes, so it
// works even for wallpapers whose full project the backend fails to load.
export function parseProjectProperties(project: unknown): WallpaperProperty[] {
  const general = (project as { general?: { properties?: unknown } } | null)?.general
  const props = general?.properties
  if (!props || typeof props !== 'object') return []

  const result: Array<WallpaperProperty & { sortKey: number }> = []

  for (const [name, def] of Object.entries(props as Record<string, unknown>)) {
    if (!def || typeof def !== 'object') continue
    const d = def as Record<string, unknown>
    if (!isControlType(d.type)) continue

    const options = Array.isArray(d.options)
      ? (d.options as Array<Record<string, unknown>>)
          .filter(o => o && typeof o === 'object' && o.label !== undefined && o.value !== undefined)
          .map(o => ({ label: String(o.label), value: serializePropertyValue(o.value) }))
      : undefined

    result.push({
      name,
      type: d.type,
      text: typeof d.text === 'string' ? d.text : name,
      value: serializePropertyValue(d.value),
      min: typeof d.min === 'number' ? d.min : undefined,
      max: typeof d.max === 'number' ? d.max : undefined,
      step: typeof d.step === 'number' ? d.step : undefined,
      options,
      sortKey: typeof d.order === 'number' ? d.order : typeof d.index === 'number' ? d.index : Number.MAX_SAFE_INTEGER,
    })
  }

  result.sort((a, b) => a.sortKey - b.sortKey)
  return result.map(({ sortKey: _sortKey, ...prop }) => prop)
}

// List a wallpaper's customizable properties by reading its project.json.
// Returns an empty array when the file is missing or malformed.
export async function listProperties(wallpaperPath: string): Promise<WallpaperProperty[]> {
  try {
    const raw = await fs.readFile(path.join(wallpaperPath, 'project.json'), 'utf-8')
    return parseProjectProperties(JSON.parse(raw))
  } catch {
    return []
  }
}
