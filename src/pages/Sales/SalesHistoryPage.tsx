import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { DateRangeFilter } from '../../components/DateRangeFilter'
import { PaginationFooter } from '../../components/PaginationFooter'
import { usePagination } from '../../hooks/usePagination'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { FilterBar, FilterSelect } from '../../components/FilterBar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { cn } from '@/lib/utils'
import type { SaleWithItems } from '../../../shared/types'

const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'voided', label: 'Voided' },
]

function statusBadge(status: string) {
  return cn(
    'rounded-full border px-2 py-0.5 text-[0.75rem] font-bold',
    status === 'completed' && 'border-success/40 bg-success/10 text-success',
    status === 'unpaid' && 'border-warning/40 bg-warning/10 text-warning',
    status === 'voided' && 'border-border bg-muted text-muted-foreground',
  )
}

export function SalesHistoryPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [status, setStatus] = useState('all')
  const [sales, setSales] = useState<SaleWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const [voidTarget, setVoidTarget] = useState<SaleWithItems | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidError, setVoidError] = useState<string | null>(null)
  const [voiding, setVoiding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api['sales:list']({
        status: status === 'all' ? undefined : status,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      })
      setSales(data)
    } catch (err) {
      setError((err as Error).message || 'Failed to load sales')
      setSales([])
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, status])

  useEffect(() => {
    void load()
  }, [load])

  const pager = usePagination(sales)
  const activeTotal = useMemo(
    () => sales.filter(s => s.status !== 'voided').reduce((sum, s) => sum + s.total_cents, 0),
    [sales]
  )

  const handleVoid = async () => {
    if (!voidTarget) return
    if (!voidReason.trim()) {
      setVoidError('Enter a reason for voiding this sale')
      return
    }
    setVoidError(null)
    setVoiding(true)
    try {
      await window.api['sales:void'](voidTarget.id, voidReason.trim())
      setVoidTarget(null)
      setVoidReason('')
      await load()
    } catch (err) {
      setVoidError((err as Error).message || 'Failed to void sale')
    } finally {
      setVoiding(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sales History</h1>
        <span className="text-[0.9375rem] font-bold">
          {sales.length} sale{sales.length !== 1 ? 's' : ''} · Total: {fmt(activeTotal)}
        </span>
      </div>

      <FilterBar>
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onReset={() => { setDateFrom(today); setDateTo(today); setStatus('all') }}
        >
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
          />
        </DateRangeFilter>
      </FilterBar>

      {loading ? (
        <p className="text-center text-muted-foreground">Loading...</p>
      ) : error ? (
        <p className="text-center font-semibold text-destructive">{error}</p>
      ) : sales.length === 0 ? (
        <p className="p-12 text-center text-lg text-muted-foreground">No sales in this period</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
            <Table className="table-zebra">
              <TableHeader>
                <TableRow className="bg-card hover:bg-card">
                  <TableHead>Time</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pager.slice.map(sale => (
                  <Fragment key={sale.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpandedId(cur => (cur === sale.id ? null : sale.id))}
                    >
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {sale.created_at.slice(0, 10)} · {sale.created_at.slice(11, 16)}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {sale.customer_name ?? 'Walk-in'}
                        {sale.sale_kind === 'captain' ? ' · Captain' : ''}
                      </TableCell>
                      <TableCell className="text-center">{sale.items.reduce((n, i) => n + i.quantity, 0)}</TableCell>
                      <TableCell className="text-right font-bold">{fmt(sale.total_cents)}</TableCell>
                      <TableCell className="text-muted-foreground">{sale.payment_method ?? sale.payment_source ?? '—'}</TableCell>
                      <TableCell>
                        <span className={statusBadge(sale.status)}>{sale.status.toUpperCase()}</span>
                      </TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        {sale.status !== 'voided' ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 border-destructive/40 px-3 text-[0.8125rem] font-semibold text-destructive hover:bg-destructive/10"
                            onClick={() => { setVoidTarget(sale); setVoidReason(''); setVoidError(null) }}
                          >
                            Void
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">{sale.void_reason ?? ''}</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedId === sale.id && (
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell colSpan={7}>
                          <div className="flex flex-col gap-1 py-1 pl-2">
                            {sale.items.map(item => (
                              <div key={item.id} className="flex items-center gap-2 text-sm">
                                <span className="font-semibold">{item.quantity}×</span>
                                <span>{item.name_snapshot}</span>
                                {item.free_item_id != null && (
                                  <span className="text-muted-foreground">+ free add-on</span>
                                )}
                                <span className="ml-auto font-semibold">{fmt(item.line_total_cents)}</span>
                              </div>
                            ))}
                            {sale.discount_cents > 0 && (
                              <div className="flex items-center gap-2 text-sm text-destructive">
                                <span>Discount{sale.discount_reason ? ` (${sale.discount_reason})` : ''}</span>
                                <span className="ml-auto font-semibold">-{fmt(sale.discount_cents)}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationFooter pager={pager} />
        </div>
      )}

      <Dialog open={voidTarget != null} onOpenChange={o => { if (!o) { setVoidTarget(null); setVoidError(null) } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Void sale #{voidTarget?.id}?</DialogTitle>
            <DialogDescription>
              This removes {voidTarget ? fmt(voidTarget.total_cents) : ''} from reports and outstanding debts. Stock is left as-is since served items can't be restocked.
            </DialogDescription>
          </DialogHeader>
          {voidError && <p className="m-0 font-semibold text-destructive">{voidError}</p>}
          <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
            Reason
            <Input
              autoFocus
              value={voidReason}
              onChange={e => setVoidReason(e.target.value)}
              placeholder="e.g. Entered twice"
              className="h-11 rounded-[var(--radius-md)] bg-background text-[0.875rem]"
            />
          </Label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-border bg-card font-semibold"
              onClick={() => { setVoidTarget(null); setVoidError(null) }}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" className="font-semibold" disabled={voiding} onClick={handleVoid}>
              {voiding ? 'Voiding...' : 'Void Sale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
