import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationLink,
  PaginationEllipsis,
  getPaginationRange,
} from "@/components/ui/pagination"

interface WorkshopPaginationProps {
  page: number
  totalResults: number
  resultsPerPage: number
  hasNextPage: boolean
  isFetching: boolean
  onPageChange: (page: number) => void
}

export function WorkshopPagination({
  page,
  totalResults,
  resultsPerPage,
  hasNextPage,
  isFetching,
  onPageChange,
}: WorkshopPaginationProps) {
  const { nearbyPages, totalPages, showFirstPage, showLastPage, showStartEllipsis, showEndEllipsis } = getPaginationRange(page, totalResults, resultsPerPage)
  const isPrevDisabled = page <= 1 || isFetching
  const isNextDisabled = !hasNextPage || isFetching

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={() => onPageChange(Math.max(page - 1, 1))}
            aria-disabled={isPrevDisabled}
            className={isPrevDisabled ? "pointer-events-none opacity-50" : "cursor-pointer"}
          />
        </PaginationItem>
        {showFirstPage && (
          <PaginationItem>
            <PaginationLink onClick={() => onPageChange(1)} className="cursor-pointer">1</PaginationLink>
          </PaginationItem>
        )}
        {showStartEllipsis && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}
        {nearbyPages.filter(p => p < page).map(p => (
          <PaginationItem key={p}>
            <PaginationLink onClick={() => onPageChange(p)} className="cursor-pointer">{p}</PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationLink isActive className="cursor-default">{page}</PaginationLink>
        </PaginationItem>
        {nearbyPages.filter(p => p > page).map(p => (
          <PaginationItem key={p}>
            <PaginationLink onClick={() => onPageChange(p)} className="cursor-pointer">{p}</PaginationLink>
          </PaginationItem>
        ))}
        {showEndEllipsis && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}
        {showLastPage && (
          <PaginationItem>
            <PaginationLink onClick={() => onPageChange(totalPages)} className="cursor-pointer">{totalPages}</PaginationLink>
          </PaginationItem>
        )}
        <PaginationItem>
          <PaginationNext
            onClick={() => onPageChange(page + 1)}
            aria-disabled={isNextDisabled}
            className={isNextDisabled ? "pointer-events-none opacity-50" : "cursor-pointer"}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
