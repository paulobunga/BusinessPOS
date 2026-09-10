import { useReports, type ViewMode } from '../../hooks/useReports'
import type { DailyReport, MonthlyReport } from '../../../shared/types'

function formatUGX(cents: number): string {
  return `UGX ${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function ProfitText({ cents }: { cents: number }) {
  const color = cents >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
  const sign = cents >= 0 ? '+' : ''
  return <span style={{ color, fontWeight: 700, fontSize: '1.25rem' }}>{sign}{formatUGX(cents)}</span>
}

function StatCard({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      minWidth: 140,
    }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: '1rem', fontWeight: 700, color: muted ? 'var(--color-text-secondary)' : 'var(--color-text-primary)' }}>{value}</span>
    </div>
  )
}

function DayView({ data, categories }: { data: DailyReport[]; categories: { category: string; amount_cents: number }[] }) {
  const day = data[0]
  if (!day) return <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 48 }}>No data for this date.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <StatCard label="Revenue" value={formatUGX(day.sales_revenue_cents)} />
        <StatCard label="Food Cost" value={formatUGX(day.food_purchase_cents)} muted />
        <StatCard label="Waste" value={formatUGX(day.waste_cents)} muted />
        <StatCard label="Expenses" value={formatUGX(day.expense_cents)} muted />
        <StatCard label="Reimbursements" value={formatUGX(day.reimbursement_cents)} muted />
      </div>

      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 24,
        textAlign: 'center',
      }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>NET PROFIT</span>
        <div style={{ marginTop: 8 }}><ProfitText cents={day.net_profit_cents} /></div>
      </div>

      {day.debt_sales_cents > 0 && (
        <div style={{
          background: 'var(--color-surface-alt)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 16px',
          fontSize: '0.875rem',
          color: 'var(--color-text-secondary)',
        }}>
          Accounts Receivable today: <strong style={{ color: 'var(--color-warning)' }}>{formatUGX(day.debt_sales_cents)}</strong>
        </div>
      )}

      {categories.length > 0 && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 16,
        }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 12 }}>Expense Breakdown</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {categories.map(c => (
              <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem' }}>{c.category}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{formatUGX(c.amount_cents)}</span>
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

  if (data.length === 0) return <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 48 }}>No data available.</p>

  const thStyle: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)' }
  const tdStyle: React.CSSProperties = { padding: '10px 12px', fontSize: '0.875rem', borderBottom: '1px solid var(--color-border)' }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <thead>
          <tr>
            <th style={thStyle}>{label}</th>
            <th style={thStyle}>Revenue</th>
            <th style={thStyle}>Food Cost</th>
            <th style={thStyle}>Waste</th>
            <th style={thStyle}>Expenses</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Net Profit</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={getKey(row)}>
              <td style={tdStyle}>{getKey(row)}</td>
              <td style={tdStyle}>{formatUGX(getRevenue(row))}</td>
              <td style={tdStyle}>{formatUGX(getFood(row))}</td>
              <td style={tdStyle}>{formatUGX(getWaste(row))}</td>
              <td style={tdStyle}>{formatUGX(getExpenses(row))}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: getProfit(row) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {getProfit(row) >= 0 ? '+' : ''}{formatUGX(getProfit(row))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
    debtSummary,
    loading,
    navigateDay,
  } = useReports()

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: active ? 'var(--color-primary)' : 'var(--color-surface-alt)',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    fontWeight: 600,
    fontSize: '0.875rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
  })

  const totalDebt = debtSummary.reduce((sum, d) => sum + d.total_debt_cents, 0)

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Reports & P&L</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={tabStyle(viewMode === 'daily')} onClick={() => setViewMode('daily')}>Daily</button>
          <button style={tabStyle(viewMode === 'monthly')} onClick={() => setViewMode('monthly')}>Monthly</button>
          <button style={tabStyle(viewMode === 'custom')} onClick={() => setViewMode('custom')}>Custom</button>
        </div>
      </div>

      {/* Date controls */}
      {viewMode === 'daily' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigateDay(-1)} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: '0.875rem' }}>&#9664; Prev</button>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={inputStyle} />
          <button onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>Today</button>
          <button onClick={() => navigateDay(1)} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: '0.875rem' }}>Next &#9654;</button>
        </div>
      )}

      {viewMode === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
          <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
        </div>
      )}

      {viewMode === 'monthly' && (
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          Showing data for <strong>{new Date().getFullYear()}</strong>
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 48 }}>Loading...</p>
      ) : viewMode === 'daily' ? (
        <DayView data={dailyData} categories={categories} />
      ) : (
        <TableView
          data={viewMode === 'monthly' ? monthlyData : dailyData}
          label={viewMode === 'monthly' ? 'Month' : 'Date'}
        />
      )}

      {/* Accounts Receivable */}
      {debtSummary.length > 0 && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accounts Receivable</h3>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-warning)' }}>{formatUGX(totalDebt)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {debtSummary.map(d => (
              <div key={d.sale_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.875rem' }}>{d.customer_name ?? `Sale #${d.sale_id}`}</span>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{new Date(d.created_at).toLocaleDateString()}</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{formatUGX(d.total_debt_cents)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expense breakdown for multi-day views */}
      {viewMode !== 'daily' && categories.length > 0 && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 16,
        }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 12 }}>Expense Breakdown by Category</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {categories.map(c => (
              <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem' }}>{c.category}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{formatUGX(c.amount_cents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
