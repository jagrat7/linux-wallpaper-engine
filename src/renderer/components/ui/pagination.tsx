import * as React from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
} from "lucide-react"

import { cn } from "~/lib/utils"
import { buttonVariants, type Button } from "~/components/ui/button"

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  )
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = {
  isActive?: boolean
} & Partial<Pick<React.ComponentProps<typeof Button>, "size">> &
  React.ComponentProps<"button">

function PaginationLink({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) {
  return (
    <button
      type="button"
      aria-current={isActive ? "page" : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(
        buttonVariants({
          variant: isActive ? "outline" : "ghost",
          size,
        }),
        className
      )}
      {...props}
    />
  )
}

function PaginationCurrent({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-current="page"
      data-slot="pagination-link"
      data-active="true"
      className={cn(buttonVariants({ variant: "outline", size: "icon" }), className)}
      {...props}
    />
  )
}

function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size="default"
      className={cn("gap-1 px-2.5 sm:pl-2.5", className)}
      {...props}
    >
      <ChevronLeftIcon />
      <span className="hidden sm:block">Previous</span>
    </PaginationLink>
  )
}

function PaginationNext({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      size="default"
      className={cn("gap-1 px-2.5 sm:pr-2.5", className)}
      {...props}
    >
      <span className="hidden sm:block">Next</span>
      <ChevronRightIcon />
    </PaginationLink>
  )
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  )
}

interface PaginationRange {
  nearbyPages: number[]
  totalPages: number
  showFirstPage: boolean
  showLastPage: boolean
  showStartEllipsis: boolean
  showEndEllipsis: boolean
}

function getPaginationRange(page: number, totalResults: number, resultsPerPage: number): PaginationRange {
  const totalPages = Math.ceil(totalResults / resultsPerPage)
  const nearbyPages = Array.from(
    { length: 5 },
    (_, i) => page - 2 + i,
  ).filter(p => p >= 1 && p <= totalPages && p !== page)
  const firstNearby = nearbyPages[0]
  const lastNearby = nearbyPages[nearbyPages.length - 1]

  return {
    nearbyPages,
    totalPages,
    showFirstPage: page > 1 && firstNearby !== undefined && firstNearby > 1,
    showLastPage: page < totalPages && lastNearby !== undefined && lastNearby < totalPages,
    showStartEllipsis: firstNearby !== undefined && firstNearby > 2,
    showEndEllipsis: lastNearby !== undefined && lastNearby < totalPages - 1,
  }
}

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationCurrent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
  getPaginationRange,
}
