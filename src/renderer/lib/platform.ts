import { DEV_MEDIA_PATH } from '../../shared/constants/development'

export const isElectronRenderer = () => Boolean(Reflect.get(globalThis, 'electronTRPC'))

export function mediaUrl(value: string | undefined | null): string {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  const filePath = value.startsWith('local-file://')
    ? decodeURIComponent(value.slice('local-file://'.length))
    : value
  return isElectronRenderer()
    ? `local-file://${encodeURI(filePath).replaceAll('#', '%23').replaceAll('?', '%3F')}`
    : `${DEV_MEDIA_PATH}?path=${encodeURIComponent(filePath)}`
}
