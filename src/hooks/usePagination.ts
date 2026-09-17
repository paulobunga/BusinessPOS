import { useEffect, useState } from 'react'

export function usePagination<T>(rows: T[], pageSize = 50) {
  const [page, setPage] = useState(0)
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.max(0, Math.min(page, totalPages - 1))
  const start = current * pageSize
  const end = Math.min(start + pageSize, total)

  useEffect(() => {
    if (page > 0 && totalPages <= page) setPage(0)
  }, [totalPages, page])

  const slice = rows.slice(start, end)

  return {
    page: current,
    setPage,
    total,
    totalPages,
    start,
    end,
    hasPages: total > pageSize,
    slice,
  }
}