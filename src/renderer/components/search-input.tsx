import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useGlass } from "@/hooks/use-glass"
import { useRef } from "react"
import { KeyboardShortcut } from "@/components/keyboard-shortcut"
import { getAriaKeyShortcut } from "@/lib/keyboard-shortcuts"

interface SearchInputProps {
  placeholder?: string
  className?: string
  searchQuery: string
  setSearchQuery: (query: string) => void
}

export function SearchInput({
  placeholder = "Search...",
  className,
  searchQuery,
  setSearchQuery,
}: SearchInputProps) {
  const glass = useGlass()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={className}>
      <div className={cn("group relative flex-1 rounded-xl ring-1 ring-foreground/10 hover:ring-foreground/30 focus-within:ring-foreground/40 focus-within:shadow-sm", glass)}>
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60 transition-colors duration-200 group-focus-within:text-foreground" />
        <Input
          ref={inputRef}
          type="text"
          aria-label={placeholder}
          aria-keyshortcuts={getAriaKeyShortcut("search")}
          data-shortcut-search
          placeholder={placeholder}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="h-9 w-full rounded-xl border-0 bg-transparent pl-10 pr-10 text-sm font-medium tracking-wide text-foreground placeholder:text-muted-foreground/50 transition-all duration-200 focus:ring-0"
        />
        {!searchQuery && <KeyboardShortcut shortcut="search" className="absolute right-2 top-1/2 -translate-y-1/2" />}
        {searchQuery && (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              setSearchQuery("")
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
