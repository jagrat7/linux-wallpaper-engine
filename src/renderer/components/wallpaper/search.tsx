import { SearchInput as SharedSearchInput } from "@/components/search-input"
import { useWallpaperSearchQuery } from "@/contexts/wallpaper-search-context"

interface SearchInputProps {
    placeholder?: string
    className?: string
}

export function SearchInput({
    placeholder = "Search wallpapers...",
    className
}: SearchInputProps) {
    const { searchQuery, setSearchQuery } = useWallpaperSearchQuery()

    return (
        <SharedSearchInput
            placeholder={placeholder}
            className={className}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
        />
    )
}
