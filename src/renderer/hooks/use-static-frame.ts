import { useEffect, useState } from 'react'

const cache = new Map<string, string>()

export function useStaticFrame(src: string | null): string | null {
  const [staticUrl, setStaticUrl] = useState<string | null>(src ? (cache.get(src) ?? null) : null)

  useEffect(() => {
    if (!src) {
      setStaticUrl(null)
      return
    }

    const cached = cache.get(src)
    if (cached) {
      setStaticUrl(cached)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d')?.drawImage(img, 0, 0)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      cache.set(src, dataUrl)
      setStaticUrl(dataUrl)
    }
    img.onerror = () => {
      cache.set(src, src)
      setStaticUrl(src)
    }
    img.src = src
  }, [src])

  return staticUrl
}
