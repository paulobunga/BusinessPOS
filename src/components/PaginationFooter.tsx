import { Button } from './ui/button'
import type { usePagination } from '../hooks/usePagination'

export function PaginationFooter({ pager }: { pager: ReturnType<typeof usePagination> }) {
  if (!pager.hasPages) return null
  return (
    <div className="mt-3 flex items-center justify-between px-1">
      <span className="text-xs text-muted-foreground">
        Showing {pager.start + 1}–{pager.end} of {pager.total}
      </span>
      <div className="flex items-center gap-2">
        <Button onClick={() => pager.setPage(pager.page - 1)} disabled={pager.page === 0} variant="outline" className="h-11 bg-card text-[0.875rem]">
          ◀ Prev
        </Button>
        <Button onClick={() => pager.setPage(pager.page + 1)} disabled={pager.page >= pager.totalPages - 1} variant="outline" className="h-11 bg-card text-[0.875rem]">
          Next ▶
        </Button>
      </div>
    </div>
  )
}