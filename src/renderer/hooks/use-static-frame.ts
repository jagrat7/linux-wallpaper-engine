import { useEffect, useState } from 'react'

const cache = new Map<string, string>()

export function useStaticFrame(src: string | null): string | null {
  const [staticUrl, setStaticUrl] = useState<string | null>(src ? (cache.get(src) ?? null) : null)

  useEffect(() => {
    if (!src) {
      setStaticUrl(null)
      return undefined
    }

    const cached = cache.get(src)
    if (cached) {
      setStaticUrl(cached)
      return undefined
    }

    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d')?.drawImage(img, 0, 0)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      // Decode the generated frame before starting the background fade. Loading
      // the source alone does not make the new data URL ready to paint.
      const frame = new Image()
      frame.src = dataUrl
      await frame.decode().catch(() => {})
      cache.set(src, dataUrl)
      if (!cancelled) setStaticUrl(dataUrl)
    }
    img.onerror = () => {
      cache.set(src, src)
      if (!cancelled) setStaticUrl(src)
    }
    img.src = src
    return () => {
      cancelled = true
      img.onload = null
      img.onerror = null
    }
  }, [src])

  return staticUrl
}
