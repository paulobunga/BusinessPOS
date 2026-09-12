import { useReports, type ViewMode } from '../../hooks/useReports'
import { Button } from '../../components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { DatePicker } from '../../components/ui/date-picker'
import type { DailyReport, MonthlyReport } from '../../../shared/types'

function formatUGX(cents: number): string {
  return `UGX ${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
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
        <Table>
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

  const totalDebt = debtSummary.reduce((sum, d) => sum + d.total_debt_cents, 0)

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
        <div className="flex items-center gap-3">
          <Button onClick={() => navigateDay(-1)} variant="outline" size="sm" className="bg-card text-[0.875rem]">
            &#9664; Prev
          </Button>
          <DatePicker value={selectedDate} onValueChange={setSelectedDate} />
          <Button onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))} variant="outline" size="sm" className="bg-card text-[0.875rem] font-semibold">
            Today
          </Button>
          <Button onClick={() => navigateDay(1)} variant="outline" size="sm" className="bg-card text-[0.875rem]">
            Next &#9654;
          </Button>
        </div>
      )}

      {viewMode === 'custom' && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold">From</label>
          <DatePicker value={startDate} onValueChange={setStartDate} />
          <label className="text-sm font-semibold">To</label>
          <DatePicker value={endDate} onValueChange={setEndDate} />
        </div>
      )}

      {viewMode === 'monthly' && (
        <div className="text-[0.875rem] text-muted-foreground">
          Showing data for <strong>{new Date().getFullYear()}</strong>
        </div>
      )}

      {loading ? (
        <p className="p-12 text-center text-muted-foreground">Loading...</p>
      ) : viewMode === 'daily' ? (
        <DayView data={dailyData} categories={categories} />
      ) : (
        <TableView
          data={viewMode === 'monthly' ? monthlyData : dailyData}
          label={viewMode === 'monthly' ? 'Month' : 'Date'}
        />
      )}

      {/* Item performance */}
      {itemPerf.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-border bg-card p-4">
          <h3 className="mb-3 text-[0.875rem] font-bold tracking-[0.05em] text-muted-foreground uppercase">
            Item Performance
          </h3>
          <div className="flex flex-col gap-2">
            {itemPerf.map(row => (
              <div key={row.item_name} className="flex items-center justify-between border-b border-border py-1.5">
                <span className="text-[0.875rem]">{row.category_name} · {row.item_name}</span>
                <div className="flex items-center gap-4">
                  <span className="text-[0.875rem] text-muted-foreground">{row.portions_sold} sold</span>
                  <span className="text-[0.875rem] font-semibold">{formatUGX(row.revenue_cents)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accounts Receivable */}
      {debtSummary.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[0.875rem] font-bold tracking-[0.05em] text-muted-foreground uppercase">Accounts Receivable</h3>
            <span className="text-base font-bold text-warning">{formatUGX(totalDebt)}</span>
          </div>
          <div className="flex flex-col gap-2">
            {debtSummary.map(d => (
              <div key={d.sale_id} className="flex items-center justify-between border-b border-border py-1.5">
                <span className="text-[0.875rem]">{d.customer_name ?? `Sale #${d.sale_id}`}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</span>
                  <span className="text-[0.875rem] font-semibold">{formatUGX(d.total_debt_cents)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expense breakdown for multi-day views */}
      {viewMode !== 'daily' && categories.length > 0 && (
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
}