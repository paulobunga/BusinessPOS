import { useState } from 'react'
import type { ReactNode } from 'react'
import { useReports, type ViewMode } from '../../hooks/useReports'
import { Button } from '../../components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { DatePicker } from '../../components/ui/date-picker'
import type { DailyReport, MonthlyReport, ItemPerformance, DebtSummaryItem } from '../../../shared/types'

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
  const [page, setPage] = useState(0)
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, totalPages - 1)
  const start = current * pageSize
  const slice = rows.slice(start, start + pageSize)

  return (
    <div>
      <div className="flex flex-col">
        {slice.map(row => renderRow(row))}
      </div>
      {total > pageSize && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Showing {start + 1}–{Math.min(start + pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button onClick={() => setPage(current - 1)} disabled={current === 0} variant="outline" className="h-11 bg-card text-[0.875rem]">
              ◀ Prev
            </Button>
            <Button onClick={() => setPage(current + 1)} disabled={current >= totalPages - 1} variant="outline" className="h-11 bg-card text-[0.875rem]">
              Next ▶
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ItemPerformanceView({ rows }: { rows: ItemPerformance[] }) {
  if (rows.length === 0) {
    return <p className="p-12 text-center text-muted-foreground">No item performance data for this period.</p>
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

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
        <div className="overflow-x-auto">
          <Table className="table-zebra">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Category</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Sold Qty</TableHead>
                <TableHead className="text-right">Price / Item</TableHead>
                <TableHead className="text-right">Amount Sold</TableHead>
                <TableHead className="text-right">Profit Realised</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
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
    </div>
  )
}

function ReceivablesView({ rows }: { rows: DebtSummaryItem[] }) {
  const totalDebt = rows.reduce((sum, d) => sum + d.total_debt_cents, 0)

  if (rows.length === 0) {
    return <p className="p-12 text-center text-muted-foreground">No accounts receivable — everyone has paid.</p>
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
  if (!day) return <p className="p-12 text-center text-muted-foreground">No data for this date.</p>

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
        <StatCard label="Revenue" value={formatUGX(day.sales_revenue_cents)} />
        <StatCard label="Food Cost" value={formatUGX(day.food_purchase_cents)} muted />
        <StatCard label="Waste" value={formatUGX(day.waste_cents)} muted />
        <StatCard label="Expenses" value={formatUGX(day.expense_cents)} muted />
        <StatCard label="Reimbursements" value={formatUGX(day.reimbursement_cents)} muted />
      </div>

      <div className="rounded-[var(--radius-lg)] border border-border bg-card p-6 text-center">
        <span className="text-[0.875rem] font-semibold tracking-[0.05em] text-muted-foreground uppercase">NET PROFIT</span>
        <div className="mt-2"><ProfitText cents={day.net_profit_cents} /></div>
      </div>

      {day.debt_sales_cents > 0 && (
        <div className="rounded-[var(--radius-md)] border border-border bg-muted px-4 py-2.5 text-[0.875rem] text-muted-foreground">
          Accounts Receivable today: <strong className="text-warning">{formatUGX(day.debt_sales_cents)}</strong>
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
  const getFood = (row: DailyReport | MonthlyReport) => row.food_purchase_cents
  const getWaste = (row: DailyReport | MonthlyReport) => row.waste_cents
  const getExpenses = (row: DailyReport | MonthlyReport) => row.expense_cents
  const getProfit = (row: DailyReport | MonthlyReport) => row.net_profit_cents

  if (data.length === 0) return <p className="p-12 text-center text-muted-foreground">No data available.</p>

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
      <div className="overflow-x-auto">
        <Table className="table-zebra">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{label}</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Food Cost</TableHead>
              <TableHead>Waste</TableHead>
              <TableHead>Expenses</TableHead>
              <TableHead className="text-right">Net Profit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map(row => (
              <TableRow key={getKey(row)}>
                <TableCell>{getKey(row)}</TableCell>
                <TableCell>{formatUGX(getRevenue(row))}</TableCell>
                <TableCell>{formatUGX(getFood(row))}</TableCell>
                <TableCell>{formatUGX(getWaste(row))}</TableCell>
                <TableCell>{formatUGX(getExpenses(row))}</TableCell>
                <TableCell className={`text-right font-semibold ${getProfit(row) >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {getProfit(row) >= 0 ? '+' : ''}{formatUGX(getProfit(row))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

type Section = 'pnl' | 'items' | 'receivables'

export function ReportsPage() {
  const {
    viewMode, setViewMode,
    selectedDate, setSelectedDate,
    startDate, setStartDate,
    endDate, setEndDate,
    dailyData, monthlyData, categories,
    itemPerf, debtSummary,
    loading,
    navigateDay,
  } = useReports()

  const [section, setSection] = useState<Section>('pnl')

  return (
    <div className="flex max-w-960 flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports &amp; P&amp;L</h1>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Date controls */}
      {viewMode === 'daily' && (
        <div className="flex flex-wrap items-center gap-3">
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
        </div>
      )}

      {viewMode === 'custom' && (
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex w-44 flex-col gap-1.5 text-[0.875rem] font-semibold">
            From
            <DatePicker value={startDate} onValueChange={setStartDate} />
          </label>
          <label className="flex w-44 flex-col gap-1.5 text-[0.875rem] font-semibold">
            To
            <DatePicker value={endDate} onValueChange={setEndDate} />
          </label>
        </div>
      )}

      {viewMode === 'monthly' && (
        <div className="text-[0.875rem] text-muted-foreground">
          Showing data for <strong>{new Date().getFullYear()}</strong>
        </div>
      )}

      {/* Report section */}
      <div>
        <Tabs value={section} onValueChange={(v) => setSection(v as Section)}>
          <TabsList>
            <TabsTrigger value="pnl">P&amp;L</TabsTrigger>
            <TabsTrigger value="items">Item Performance</TabsTrigger>
            <TabsTrigger value="receivables">Receivables</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <p className="p-12 text-center text-muted-foreground">Loading...</p>
      ) : section === 'pnl' ? (
        viewMode === 'daily' ? (
          <DayView data={dailyData} categories={categories} />
        ) : (
          <div className="flex flex-col gap-5">
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
        )
      ) : section === 'items' ? (
        <ItemPerformanceView rows={itemPerf} />
      ) : (
        <ReceivablesView rows={debtSummary} />
      )}
    </div>
  )
}