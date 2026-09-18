import { useState, useEffect, useMemo } from 'react'
import { DateRangeFilter } from '../../components/DateRangeFilter'
import { PaginationFooter } from '../../components/PaginationFooter'
import { usePagination } from '../../hooks/usePagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import type { SaleWithItems } from '../../../shared/types'

const PAGE_SIZE = 10

const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

export function SalesReportPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sales, setSales] = useState<SaleWithItems[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await window.api['reports:sales'](dateFrom, dateTo)
        setSales(data)
      } catch {
        setSales([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [dateFrom, dateTo])

  const pager = usePagination(sales, PAGE_SIZE)
  const totalCents = useMemo(() => sales.reduce((sum, s) => sum + s.total_cents, 0), [sales])
  const totalCount = sales.length

  const handleReset = () => {
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sales Report</h1>
        <span className="text-[0.9375rem] font-bold">
          {totalCount} sale{totalCount !== 1 ? 's' : ''} · Total: {fmt(totalCents)}
        </span>
      </div>

      <DateRangeFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onReset={handleReset}
      />

      {loading ? (
        <p className="text-center text-muted-foreground">Loading...</p>
      ) : sales.length === 0 ? (
        <p className="p-12 text-center text-lg text-muted-foreground">No sales in this period</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
            <Table className="table-zebra">
              <TableHeader>
                <TableRow className="bg-card hover:bg-card">
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pager.slice.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-muted-foreground">{sale.created_at.slice(0, 10)}</TableCell>
                    <TableCell className="font-semibold">{sale.customer_name ?? '—'}</TableCell>
                    <TableCell className="text-center">{sale.items.length}</TableCell>
                    <TableCell className="text-right font-bold">{fmt(sale.total_cents)}</TableCell>
                    <TableCell>{sale.status}</TableCell>
                    <TableCell>{sale.payment_method ?? sale.payment_source ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationFooter pager={pager} />
        </div>
      )}
    </div>
  )
}
