import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useGlass } from '@/hooks/use-glass'

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
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="text-foreground placeholder:text-muted-foreground/50 h-9 w-full rounded-xl border-0 bg-transparent pr-4 pl-10 text-sm font-medium tracking-wide transition-all duration-200 focus:ring-0"
        />
        {searchQuery && (
          <X
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3.5 size-3 -translate-y-1/2 cursor-pointer transition-colors"
            onClick={() => setSearchQuery('')}
          />
        )}
      </div>
    </div>
  )
}
