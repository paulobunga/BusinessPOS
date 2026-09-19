import { useState } from 'react'
import type { ReactNode } from 'react'
import { useReports, type ViewMode } from '../../hooks/useReports'
import { Button } from '../../components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { DatePicker } from '../../components/ui/date-picker'
import { DateRangeFilter } from '../../components/DateRangeFilter'
import { FilterBar, FilterCard } from '../../components/FilterBar'
import { PaginationFooter } from '../../components/PaginationFooter'
import { usePagination } from '../../hooks/usePagination'
import type { DailyReport, MonthlyReport, ItemPerformance, DebtSummaryItem, SaleWithItems } from '../../../shared/types'

function formatUGX(cents: number): string {
  return `UGX ${cents.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function ProfitText({ cents }: { cents: number }) {
  const sign = cents >= 0 ? '+' : ''
  return (
    <span className={`text-xl font-bold ${cents >= 0 ? 'text-success' : 'text-destructive'}`}>
      {sign}{formatUGX(cents)}
    </span>
  )
}

function StatCard({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex min-w-[140px] flex-col gap-1 rounded-[var(--radius-md)] border border-border bg-card p-3 px-4">
      <span className="text-xs font-semibold tracking-[0.05em] text-muted-foreground uppercase">{label}</span>
      <span className={`text-base font-bold ${muted ? 'text-muted-foreground' : 'text-foreground'}`}>{value}</span>
    </div>
  )
}

function PagedList<T>({ rows, renderRow, pageSize = 50 }: { rows: T[]; renderRow: (row: T) => ReactNode; pageSize?: number }) {
  const pager = usePagination(rows, pageSize)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        {pager.slice.map(row => renderRow(row))}
      </div>
      <PaginationFooter pager={pager} />
    </div>
  )
}

function ItemPerformanceView({ rows }: { rows: ItemPerformance[] }) {
  const pager = usePagination(rows)

  if (rows.length === 0) {
    return <p className="p-12 text-center text-lg text-muted-foreground">No item performance data for this period.</p>
  }

  const totals = rows.reduce(
    (acc, r) => ({
      qty: acc.qty + r.quantity_sold,
      amount: acc.amount + r.amount_sold_cents,
      cost: acc.cost + r.cost_cents,
      profit: acc.profit + r.profit_cents,
    }),
    { qty: 0, amount: 0, cost: 0, profit: 0 }
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--radius-md)] border border-border bg-muted px-4 py-2.5 text-[0.8125rem] text-muted-foreground">
        Profit uses each item's purchase cost (updated by recorded purchases); sale discounts are allocated across items; debt sales are included.
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
        <StatCard label="Sold Qty" value={String(totals.qty)} />
        <StatCard label="Amount Sold" value={formatUGX(totals.amount)} />
        <StatCard label="Cost" value={formatUGX(totals.cost)} muted />
        <StatCard label="Profit Realised" value={(totals.profit >= 0 ? '+' : '') + formatUGX(totals.profit)} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
          <div className="overflow-x-auto">
            <Table className="table-zebra">
              <TableHeader>
                <TableRow className="bg-card hover:bg-card">
                  <TableHead>Category</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Sold Qty</TableHead>
                  <TableHead className="text-right">Price / Item</TableHead>
                  <TableHead className="text-right">Amount Sold</TableHead>
                  <TableHead className="text-right">Profit Realised</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pager.slice.map(r => (
                  <TableRow key={r.item_name}>
                    <TableCell className="text-muted-foreground">{r.category_name}</TableCell>
                    <TableCell className="font-medium">{r.item_name}</TableCell>
                    <TableCell className="text-right">{r.quantity_sold}</TableCell>
                    <TableCell className="text-right">{formatUGX(r.price_per_item_cents)}</TableCell>
                    <TableCell className="text-right">{formatUGX(r.amount_sold_cents)}</TableCell>
                    <TableCell className={`text-right font-semibold ${r.profit_cents >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {r.profit_cents >= 0 ? '+' : ''}{formatUGX(r.profit_cents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <PaginationFooter pager={pager} />
      </div>
    </div>
  )
}

function SalesView({ sales }: { sales: SaleWithItems[] }) {
  if (sales.length === 0) {
    return <p className="p-12 text-center text-lg text-muted-foreground">No sales in this period.</p>
  }

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

  const byDate = new Map<string, SaleWithItems[]>()
  for (const s of sales) {
    const d = s.created_at.slice(0, 10)
    const arr = byDate.get(d) ?? []
    arr.push(s)
    byDate.set(d, arr)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--radius-md)] border border-border bg-muted px-4 py-2.5 text-[0.8125rem] text-muted-foreground">
        Each order shows its items at the price charged, the discount and the total. Debt sales also show the amount owed.
      </div>

      {Array.from(byDate.keys()).map(date => {
        const daySales = byDate.get(date)!
        const dayTotal = daySales.reduce((sum, s) => sum + s.total_cents, 0)
        return (
          <div key={date} className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <h3 className="text-[0.875rem] font-bold tracking-[0.05em] text-muted-foreground uppercase">
                {new Date(date + 'T00:00:00').toLocaleDateString()}
              </h3>
              <span className="text-[0.875rem] font-bold">{formatUGX(dayTotal)}</span>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {daySales.map(s => (
                <div key={s.id} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">{fmtTime(s.created_at)}</span>
                      <span className="text-[0.875rem] font-bold">Sale #{s.id}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-bold uppercase ${
                          s.sale_kind === 'captain'
                            ? 'border border-success/40 bg-success/10 text-success'
                            : s.payment_method === 'debt'
                              ? 'border border-warning/40 bg-warning/10 text-warning'
                              : s.payment_method === 'mixed'
                                ? 'border border-primary/40 bg-primary/10 text-primary'
                                : 'border border-border bg-background text-muted-foreground'
                        }`}
                      >
                        {s.sale_kind === 'captain' ? 'service (captain)' : s.payment_method ?? 'cash'}
                      </span>
                      {s.sale_kind === 'captain' && s.service_description && (
                        <span className="text-[0.8125rem] text-muted-foreground italic">“{s.service_description}”</span>
                      )}
                      {s.customer_name && (
                        <span className="text-[0.8125rem] text-muted-foreground">{s.customer_name}</span>
                      )}
                    </div>
                    <span className="text-[0.9375rem] font-bold">{formatUGX(s.total_cents)}</span>
                  </div>

                  <div className="flex flex-col gap-0.5 pl-1 text-[0.8125rem]">
                    {s.items.map(it => (
                      <div key={it.id} className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          {it.quantity} × {it.name_snapshot}
                          {it.free_item_id != null ? ' (free)' : ''}
                        </span>
                        <span>{formatUGX(it.line_total_cents)}</span>
                      </div>
                    ))}
                    {s.discount_cents > 0 && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Discount{s.discount_reason ? ` (${s.discount_reason})` : ''}</span>
                        <span>-{formatUGX(s.discount_cents)}</span>
                      </div>
                    )}
                    {(s.debt_cents ?? 0) > 0 && s.sale_kind !== 'captain' && (
                      <div className="flex items-center justify-between font-semibold text-warning">
                        <span>Debt owed</span>
                        <span>{formatUGX(s.debt_cents!)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ReceivablesView({ rows }: { rows: DebtSummaryItem[] }) {
  const totalDebt = rows.reduce((sum, d) => sum + d.total_debt_cents, 0)

  if (rows.length === 0) {
    return <p className="p-12 text-center text-lg text-muted-foreground">No accounts receivable — everyone has paid.</p>
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[0.875rem] font-bold tracking-[0.05em] text-muted-foreground uppercase">Accounts Receivable</h3>
        <span className="text-base font-bold text-warning">{formatUGX(totalDebt)}</span>
      </div>
      <PagedList
        rows={rows}
        renderRow={(d) => (
          <div key={d.sale_id} className="flex items-center justify-between border-b border-border py-1.5">
            <span className="text-[0.875rem]">{d.customer_name ?? `Sale #${d.sale_id}`}</span>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</span>
              <span className="text-[0.875rem] font-semibold">{formatUGX(d.total_debt_cents)}</span>
            </div>
          </div>
        )}
      />
    </div>
  )
}

function DayView({ data, categories }: { data: DailyReport[]; categories: { category: string; amount_cents: number }[] }) {
  const day = data[0]
  if (!day) return <p className="p-12 text-center text-lg text-muted-foreground">No data for this date.</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
        <StatCard label="Revenue" value={formatUGX(day.sales_revenue_cents)} />
        <StatCard label="Food Cost" value={formatUGX(day.food_purchase_cents)} muted />
        <StatCard label="Waste" value={formatUGX(day.waste_cents)} muted />
        <StatCard label="Expenses (non-food)" value={formatUGX(day.expense_cents)} muted />
        <StatCard label="Reimbursements" value={formatUGX(day.reimbursement_cents)} muted />
        {day.barter_cents > 0 && <StatCard label="Barter (Captains)" value={formatUGX(day.barter_cents)} />}
        {day.bad_debt_cents > 0 && <StatCard label="Bad Debt" value={formatUGX(day.bad_debt_cents)} muted />}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-border bg-card p-6 text-center">
        <span className="text-[0.875rem] font-semibold tracking-[0.05em] text-muted-foreground uppercase">NET PROFIT</span>
        <div className="mt-2"><ProfitText cents={day.net_profit_cents} /></div>
      </div>

      {(day.debt_sales_cents > 0 || day.barter_cents > 0 || day.bad_debt_cents > 0) && (
        <div className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-border bg-muted px-4 py-2.5 text-[0.875rem] text-muted-foreground">
          {day.debt_sales_cents > 0 && (
            <p className="m-0">
              Still owed by customers: <strong className="text-warning">{formatUGX(day.debt_sales_cents)}</strong>
            </p>
          )}
          {day.barter_cents > 0 && (
            <p className="m-0">
              Barter (Captain Orders): <strong>{formatUGX(day.barter_cents)}</strong> — already counted in revenue above.
            </p>
          )}
          {day.bad_debt_cents > 0 && (
            <p className="m-0">
              Bad debt written off: <strong className="text-destructive">{formatUGX(day.bad_debt_cents)}</strong> — deducted from profit above.
            </p>
          )}
        </div>
      )}

      {categories.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-border bg-card p-4">
          <h3 className="mb-3 text-[0.875rem] font-bold text-muted-foreground">Expense Breakdown</h3>
          <div className="flex flex-col gap-2">
            {categories.map(c => (
              <div key={c.category} className="flex items-center justify-between">
                <span className="text-[0.875rem]">{c.category}</span>
                <span className="text-[0.875rem] font-semibold">{formatUGX(c.amount_cents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TableView({ data, label }: { data: (DailyReport | MonthlyReport)[]; label: string }) {
  const getKey = (row: DailyReport | MonthlyReport) => 'date' in row ? row.date : row.month
  const getRevenue = (row: DailyReport | MonthlyReport) => row.sales_revenue_cents
  const getBarter = (row: DailyReport | MonthlyReport) => row.barter_cents
  const getBadDebt = (row: DailyReport | MonthlyReport) => row.bad_debt_cents
  const getFood = (row: DailyReport | MonthlyReport) => row.food_purchase_cents
  const getWaste = (row: DailyReport | MonthlyReport) => row.waste_cents
  const getExpenses = (row: DailyReport | MonthlyReport) => row.expense_cents
  const getDebt = (row: DailyReport | MonthlyReport) => row.debt_sales_cents
  const getProfit = (row: DailyReport | MonthlyReport) => row.net_profit_cents
  const pager = usePagination(data)

  if (data.length === 0) return <p className="p-12 text-center text-lg text-muted-foreground">No data available.</p>

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
        <div className="overflow-x-auto">
          <Table className="table-zebra">
            <TableHeader>
              <TableRow className="bg-card hover:bg-card">
                <TableHead>{label}</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Food Cost</TableHead>
                <TableHead>Waste</TableHead>
                <TableHead>Expenses (non-food)</TableHead>
                <TableHead>Still Owed</TableHead>
                <TableHead>Barter</TableHead>
                <TableHead>Bad Debt</TableHead>
                <TableHead className="text-right">Net Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pager.slice.map(row => (
                <TableRow key={getKey(row)}>
                  <TableCell>{getKey(row)}</TableCell>
                  <TableCell>{formatUGX(getRevenue(row))}</TableCell>
                  <TableCell>{formatUGX(getFood(row))}</TableCell>
                  <TableCell>{formatUGX(getWaste(row))}</TableCell>
                  <TableCell>{formatUGX(getExpenses(row))}</TableCell>
                  <TableCell>{getDebt(row) > 0 ? <span className="font-semibold text-warning">{formatUGX(getDebt(row))}</span> : '—'}</TableCell>
                  <TableCell>{getBarter(row) > 0 ? formatUGX(getBarter(row)) : '—'}</TableCell>
                  <TableCell>{getBadDebt(row) > 0 ? <span className="font-semibold text-destructive">{formatUGX(getBadDebt(row))}</span> : '—'}</TableCell>
                  <TableCell className={`text-right font-semibold ${getProfit(row) >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {getProfit(row) >= 0 ? '+' : ''}{formatUGX(getProfit(row))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <PaginationFooter pager={pager} />
    </div>
  )
}

type Section = 'pnl' | 'items' | 'receivables' | 'sales'

export function ReportsPage() {
  const {
    viewMode, setViewMode,
    selectedDate, setSelectedDate,
    startDate, setStartDate,
    endDate, setEndDate,
    dailyData, monthlyData, categories,
    itemPerf, debtSummary, sales,
    loading,
    navigateDay,
  } = useReports()

  const [section, setSection] = useState<Section>('pnl')

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports &amp; P&amp;L</h1>
      </div>

      {/* Period picker */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-full">
        <TabsList>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <FilterBar>
            <FilterCard>
              <Button onClick={() => navigateDay(-1)} variant="outline" size="sm" className="bg-card text-[0.875rem]">
                ◀ Prev
              </Button>
              <DatePicker className="w-44" value={selectedDate} onValueChange={setSelectedDate} />
              <Button onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))} variant="outline" size="sm" className="bg-card text-[0.875rem] font-semibold">
                Today
              </Button>
              <Button onClick={() => navigateDay(1)} variant="outline" size="sm" className="bg-card text-[0.875rem]">
                Next ▶
              </Button>
            </FilterCard>
          </FilterBar>
        </TabsContent>

        <TabsContent value="custom">
          <DateRangeFilter
            dateFrom={startDate}
            dateTo={endDate}
            onDateFromChange={setStartDate}
            onDateToChange={setEndDate}
            onReset={() => {
              const t = new Date().toISOString().slice(0, 10)
              setStartDate(t)
              setEndDate(t)
            }}
          />
        </TabsContent>

        <TabsContent value="monthly">
          <p className="m-0 text-[0.875rem] text-muted-foreground">
            Showing data for <strong>{new Date().getFullYear()}</strong>
          </p>
        </TabsContent>
      </Tabs>

      {/* Report section */}
      <Tabs value={section} onValueChange={(v) => setSection(v as Section)} className="w-full">
        <TabsList>
          <TabsTrigger value="pnl">P&amp;L</TabsTrigger>
          <TabsTrigger value="items">Item Performance</TabsTrigger>
          <TabsTrigger value="receivables">Receivables</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
        </TabsList>

        <TabsContent value="pnl">
          {loading ? (
            <p className="text-center text-muted-foreground">Loading...</p>
          ) : viewMode === 'daily' ? (
            <DayView data={dailyData} categories={categories} />
          ) : (
            <div className="flex flex-col gap-4">
              <TableView
                data={viewMode === 'monthly' ? monthlyData : dailyData}
                label={viewMode === 'monthly' ? 'Month' : 'Date'}
              />
              {categories.length > 0 && (
                <div className="rounded-[var(--radius-lg)] border border-border bg-card p-4">
                  <h3 className="mb-3 text-[0.875rem] font-bold text-muted-foreground">Expense Breakdown by Category</h3>
                  <div className="flex flex-col gap-2">
                    {categories.map(c => (
                      <div key={c.category} className="flex items-center justify-between">
                        <span className="text-[0.875rem]">{c.category}</span>
                        <span className="text-[0.875rem] font-semibold">{formatUGX(c.amount_cents)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="items">
          {loading ? (
            <p className="text-center text-muted-foreground">Loading...</p>
          ) : (
            <ItemPerformanceView rows={itemPerf} />
          )}
        </TabsContent>

        <TabsContent value="receivables">
          {loading ? (
            <p className="text-center text-muted-foreground">Loading...</p>
          ) : (
            <ReceivablesView rows={debtSummary} />
          )}
        </TabsContent>

        <TabsContent value="sales">
          {loading ? (
            <p className="text-center text-muted-foreground">Loading...</p>
          ) : (
            <SalesView sales={sales} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}