import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationLink,
  PaginationCurrent,
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
            disabled={isPrevDisabled}
            className="cursor-pointer"
          />
        </PaginationItem>
        {showFirstPage && (
          <PaginationItem>
            <PaginationLink aria-label="Go to page 1" onClick={() => onPageChange(1)} className="cursor-pointer">1</PaginationLink>
          </PaginationItem>
        )}
        {showStartEllipsis && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}
        {nearbyPages.filter(p => p < page).map(p => (
          <PaginationItem key={p}>
            <PaginationLink aria-label={`Go to page ${p}`} onClick={() => onPageChange(p)} className="cursor-pointer">{p}</PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationCurrent aria-label={`Page ${page}, current page`}>{page}</PaginationCurrent>
        </PaginationItem>
        {nearbyPages.filter(p => p > page).map(p => (
          <PaginationItem key={p}>
            <PaginationLink aria-label={`Go to page ${p}`} onClick={() => onPageChange(p)} className="cursor-pointer">{p}</PaginationLink>
          </PaginationItem>
        ))}
        {showEndEllipsis && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}
        {showLastPage && (
          <PaginationItem>
            <PaginationLink aria-label={`Go to page ${totalPages}`} onClick={() => onPageChange(totalPages)} className="cursor-pointer">{totalPages}</PaginationLink>
          </PaginationItem>
        )}
        <PaginationItem>
          <PaginationNext
            onClick={() => onPageChange(page + 1)}
            disabled={isNextDisabled}
            className="cursor-pointer"
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
