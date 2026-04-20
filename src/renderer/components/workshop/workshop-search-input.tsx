import { SearchInput } from "@/components/search-input"
import { useWorkshopSearchQuery } from "@/contexts/workshop-search-context"

interface WorkshopSearchInputProps {
  placeholder?: string
  className?: string
}

export function WorkshopSearchInput({
  placeholder = "Search workshop...",
  className,
}: WorkshopSearchInputProps) {
  const { searchQuery, setSearchQuery } = useWorkshopSearchQuery()

  return (
    <SearchInput
      placeholder={placeholder}
      className={className}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
    />
  )
}
