import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGlass } from '@/hooks/use-glass'

const DEFAULT_THRESHOLD = 400

type ScrollTarget = HTMLElement | Window

interface ScrollToTopButtonProps {
  threshold?: number
  className?: string
}

export function ScrollToTopButton({
  threshold = DEFAULT_THRESHOLD,
  className,
}: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false)
  const glass = useGlass()
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const scrollTargetRef = useRef<ScrollTarget | null>(null)

  useEffect(() => {
    let current = buttonRef.current?.parentElement ?? null
    let scrollTarget: ScrollTarget = window

    while (current) {
      const { overflow, overflowY } = window.getComputedStyle(current)
      const canScroll = /(auto|scroll)/.test(`${overflow} ${overflowY}`)

      if (canScroll && current.scrollHeight > current.clientHeight) {
        scrollTarget = current
        break
      }

      current = current.parentElement
    }

    scrollTargetRef.current = scrollTarget

    const handleScroll = () => {
      const scrollTop =
        scrollTarget instanceof HTMLElement ? scrollTarget.scrollTop : window.scrollY
      setIsVisible(scrollTop > threshold)
    }

    handleScroll()
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true })

    return () => scrollTarget.removeEventListener('scroll', handleScroll)
  }, [threshold])

  const handleClick = useCallback(() => {
    const scrollTarget = scrollTargetRef.current ?? window
    scrollTarget.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      className={cn(
        'fixed right-4 bottom-[calc(var(--status-bar-h,0rem)_+_0.5rem)] z-50',
        'flex items-center justify-center',
        'size-10 rounded-full',
        glass,
        'text-foreground',
        'shadow-lg',
        'transition-all duration-300 ease-out',
        'hover:-translate-y-1 hover:scale-110 hover:shadow-xl',
        'active:scale-95 active:shadow-md',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        isVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
        className,
      )}
      aria-label="Scroll to top"
      title="Scroll to top"
    >
      <ArrowUp className="size-5" />
    </button>
  )
}
