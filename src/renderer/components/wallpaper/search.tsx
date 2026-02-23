import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useSearchQuery } from "@/contexts/search-context"

interface SearchInputProps {
    placeholder?: string
    className?: string
}

export function SearchInput({ 
    placeholder = "Search wallpapers...",
    className 
}: SearchInputProps) {
    const { searchQuery, setSearchQuery } = useSearchQuery()

    return (
        <div className={className}>
            <div className="group relative flex-1 rounded-xl ring-1 ring-foreground/10 hover:ring-foreground/30 focus-within:ring-foreground/40 focus-within:shadow-sm glass">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60 transition-colors duration-200 group-focus-within:text-foreground" />
                <Input
                    type="text"
                    placeholder={placeholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 w-full rounded-xl border-0 bg-transparent pl-10 pr-4 text-sm font-medium tracking-wide text-foreground placeholder:text-muted-foreground/50 transition-all duration-200 focus:ring-0"
                />
            </div>
        </div>
    )
}
