import { z } from 'zod'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { PROPERTY_CONTROL_TYPES, type WallpaperProperty } from '../../shared/constants/wallpaper'

// Serialize a project.json property value into the string form used for
// `--set-property name=value` (booleans as 1/0, everything else verbatim).
export const serializePropertyValue = (value: unknown): string => {
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (value === null || value === undefined) return ''
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

const projectSchema = z.object({
  general: z.object({ properties: z.record(z.string(), z.unknown()) }),
})

const optionalNumber = z.number().optional().catch(undefined)

const propertySchema = z.object({
  type: z.enum(PROPERTY_CONTROL_TYPES),
  text: z.string().optional().catch(undefined),
  value: z.unknown(),
  min: optionalNumber,
  max: optionalNumber,
  step: optionalNumber,
  order: optionalNumber,
  index: optionalNumber,
  options: z.array(z.unknown()).optional().catch(undefined),
})

const optionSchema = z.object({ label: z.union([z.string(), z.number()]), value: z.unknown() })

// Extract user-settable properties from a parsed project.json. This reads the
// same `general.properties` block the backend's PropertyParser consumes, so it
// works even for wallpapers whose full project the backend fails to load.
export function parseProjectProperties(project: unknown): WallpaperProperty[] {
  const parsedProject = projectSchema.safeParse(project)
  if (!parsedProject.success) return []

  const result: Array<WallpaperProperty & { sortKey: number }> = []

  for (const [name, def] of Object.entries(parsedProject.data.general.properties)) {
    const parsed = propertySchema.safeParse(def)
    if (!parsed.success) continue
    const d = parsed.data

    const options = d.options?.flatMap((option) => {
      const parsedOption = optionSchema.safeParse(option)
      if (!parsedOption.success) return []
      const { label, value } = parsedOption.data
      if (value === undefined) return []
      return [{ label: String(label), value: serializePropertyValue(value) }]
    })

    result.push({
      name,
      type: d.type,
      text: d.text ?? name,
      value: serializePropertyValue(d.value),
      min: d.min,
      max: d.max,
      step: d.step,
      options,
      sortKey: d.order ?? d.index ?? Number.MAX_SAFE_INTEGER,
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
