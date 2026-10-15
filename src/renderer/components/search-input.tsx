import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useGlass } from '@/hooks/use-glass'
import { useRef } from 'react'

interface SearchInputProps {
  placeholder?: string
  className?: string
  searchQuery: string
  setSearchQuery: (query: string) => void
}

export function SearchInput({
  placeholder = 'Search...',
  className,
  searchQuery,
  setSearchQuery,
}: SearchInputProps) {
  const glass = useGlass()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={className}>
      <div
        className={cn(
          'group ring-foreground/10 hover:ring-foreground/30 focus-within:ring-foreground/40 relative flex-1 rounded-xl ring-1 focus-within:shadow-sm',
          glass,
        )}
      >
        <Search className="text-muted-foreground/60 group-focus-within:text-foreground absolute top-1/2 left-3.5 size-4 -translate-y-1/2 transition-colors duration-200" />
        <Input
          ref={inputRef}
          type="text"
          aria-label={placeholder}
          placeholder={placeholder}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="text-foreground placeholder:text-muted-foreground/50 h-9 w-full rounded-xl border-0 bg-transparent pr-10 pl-10 text-sm font-medium tracking-wide transition-all duration-200 focus:ring-0"
        />
        {searchQuery && (
          <button
            type="button"
            aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
            onClick={() => {
              setSearchQuery('')
              requestAnimationFrame(() => inputRef.current?.focus())
            }}
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    </div>
  )
}
