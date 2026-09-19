import { Fragment, useCallback, useEffect, useState } from 'react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { PaginationFooter } from '../../components/PaginationFooter'
import { usePagination } from '../../hooks/usePagination'
import { cn } from '@/lib/utils'
import type { TillSession, TillSummaryData, TillCountData } from '../../../shared/types'

const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)
const fmtDateTime = (s: string) => s.slice(0, 16).replace('T', ' ')

export function TillPage() {
  const [sessions, setSessions] = useState<TillSession[]>([])
  const [standing, setStanding] = useState<TillCountData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [summaries, setSummaries] = useState<Record<number, TillSummaryData | null>>({})
  const [loadingSummary, setLoadingSummary] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, count] = await Promise.all([
        window.api['till:list'](),
        window.api['till:countCash'](),
      ])
      setSessions(list)
      setStanding(count)
    } catch {
      // till data unavailable — leave empty
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (!(id in summaries)) {
      setLoadingSummary(true)
      try {
        const s = await window.api['reports:tillSummary'](id)
        setSummaries(prev => ({ ...prev, [id]: s }))
      } catch {
        setSummaries(prev => ({ ...prev, [id]: null }))
      } finally {
        setLoadingSummary(false)
      }
    }
  }

  const pager = usePagination(sessions)

  const renderDetail = (s: TillSession) => {
    if (loadingSummary && !(s.id in summaries)) {
      return <p className="m-0 py-2 text-sm text-muted-foreground">Loading breakdown…</p>
    }
    const d = summaries[s.id]
    if (!d) return <p className="m-0 py-2 text-sm text-muted-foreground">No breakdown available.</p>
    const expected = d.opening_float_cents + d.cash_sales_cents - d.till_expenses_cents + d.reimbursements_cents
    const rows: Array<[string, number]> = [
      ['Opening float', d.opening_float_cents],
      ['Cash sales', d.cash_sales_cents],
      ['Till expenses', -d.till_expenses_cents],
      ['Reimbursements in', d.reimbursements_cents],
    ]
    return (
      <div className="flex flex-col gap-1 py-2">
        {rows.map(([label, v]) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className={cn('font-bold tabular-nums', v < 0 ? 'text-destructive' : '')}>{fmt(v)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-border pt-1 text-sm">
          <span className="font-semibold">Expected in drawer</span>
          <span className="font-extrabold tabular-nums">{fmt(expected)}</span>
        </div>
        {s.counted_cash_cents != null ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Counted</span>
              <span className="font-bold tabular-nums">{fmt(s.counted_cash_cents)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Variance</span>
              <span className={cn('font-bold tabular-nums', (s.variance_cents ?? 0) === 0 ? 'text-success' : 'text-destructive')}>
                {fmt(s.variance_cents ?? 0)}
              </span>
            </div>
          </>
        ) : (
          <p className="m-0 text-xs text-muted-foreground">Never physically counted — reconstruction from linked sales and expenses.</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Till Sessions</h1>
        <Button onClick={load} variant="outline" className="h-11 border-border bg-card font-semibold">
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-lg)] border border-border bg-card p-4">
          <p className="m-0 text-sm text-muted-foreground">Current drawer</p>
          <p className="m-0 text-2xl font-extrabold tabular-nums">
            {standing ? fmt(standing.expectedClosingCents) : '—'}
          </p>
          {standing && (
            <p className="m-0 text-xs text-muted-foreground">
              Float {fmt(standing.openingFloatCents)} · Sales {fmt(standing.cashSalesCents)} · Expenses {fmt(standing.tillExpensesCents)}
            </p>
          )}
        </div>
        <div className="rounded-[var(--radius-lg)] border border-border bg-card p-4">
          <p className="m-0 text-sm text-muted-foreground">Sessions</p>
          <p className="m-0 text-2xl font-extrabold tabular-nums">{sessions.length}</p>
          <p className="m-0 text-xs text-muted-foreground">
            {sessions.filter(s => s.closed_at == null).length} open
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-border bg-card p-4">
          <p className="m-0 text-sm text-muted-foreground">Total variance (counted)</p>
          <p className="m-0 text-2xl font-extrabold tabular-nums">
            {fmt(sessions.reduce((sum, s) => sum + (s.variance_cents ?? 0), 0))}
          </p>
          <p className="m-0 text-xs text-muted-foreground">Across physically counted sessions</p>
        </div>
      </div>

      <h2 className="text-lg font-bold">Sessions</h2>

      {loading ? (
        <p className="text-center text-muted-foreground">Loading...</p>
      ) : sessions.length === 0 ? (
        <p className="p-12 text-center text-lg text-muted-foreground">No till sessions yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
            <Table className="table-zebra">
              <TableHeader>
                <TableRow className="bg-card hover:bg-card">
                  <TableHead>Opened</TableHead>
                  <TableHead>Closed</TableHead>
                  <TableHead className="text-right">Float</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Counted</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pager.slice.map(s => (
                  <Fragment key={s.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => toggleExpand(s.id)}
                    >
                      <TableCell className="font-semibold">{fmtDateTime(s.opened_at)}</TableCell>
                      <TableCell className="text-muted-foreground">{s.closed_at ? fmtDateTime(s.closed_at) : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(s.opening_float_cents)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.expected_cash_cents != null ? fmt(s.expected_cash_cents) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.counted_cash_cents != null ? fmt(s.counted_cash_cents) : '—'}
                      </TableCell>
                      <TableCell className={cn(
                        'text-right font-bold tabular-nums',
                        (s.variance_cents ?? 0) === 0 ? '' : 'text-destructive'
                      )}>
                        {s.variance_cents != null ? fmt(s.variance_cents) : '—'}
                      </TableCell>
                      <TableCell>
                        {s.closed_at == null ? (
                          <Badge className="border-success/40 bg-success/10 text-success">OPEN</Badge>
                        ) : s.counted_cash_cents == null ? (
                          <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">UNCOUNTED</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">CLOSED</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedId === s.id && (
                      <TableRow className="bg-card hover:bg-card">
                        <TableCell colSpan={7}>{renderDetail(s)}</TableCell>
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
    </div>
  )
}
