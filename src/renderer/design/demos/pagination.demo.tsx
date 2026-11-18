import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

import { Rows, type DemoMeta } from '../demo'

export const meta: DemoMeta = { title: 'Pagination', components: ['pagination'] }

export default function PaginationDemo() {
  return (
    <Rows>
      <Pagination className="justify-start">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#pagination" />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#pagination">1</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#pagination">4</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#pagination" isActive>
              5
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#pagination">6</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#pagination" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </Rows>
  )
}
