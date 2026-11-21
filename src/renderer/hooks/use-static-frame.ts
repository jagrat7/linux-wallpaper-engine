import { useEffect, useState } from 'react'

const cache = new Map<string, string>()

export function useStaticFrame(src: string | null): string | null {
  // undefined while the frame for src is still loading
  const current = src ? cache.get(src) : null
  // The last resolved frame, held while the next one loads so the background crossfades
  const [staticUrl, setStaticUrl] = useState<string | null>(current ?? null)
  if (current !== undefined && current !== staticUrl) setStaticUrl(current)

  useEffect(() => {
    if (!src || cache.has(src)) return undefined

    const controller = new AbortController()
    const { signal } = controller
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.addEventListener(
      'load',
      async () => {
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
        if (!signal.aborted) setStaticUrl(dataUrl)
      },
      { signal },
    )
    img.addEventListener(
      'error',
      () => {
        cache.set(src, src)
        if (!signal.aborted) setStaticUrl(src)
      },
      { signal },
    )
    img.src = src
    return () => controller.abort()
  }, [src])

  return staticUrl
}
