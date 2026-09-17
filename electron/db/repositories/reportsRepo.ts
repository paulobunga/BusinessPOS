import { getDb } from '../index'
import type { ItemPerformance, SaleWithItems, SaleItem, DebtSummaryItem } from '../../../shared/types'

export interface DailyReport {
  date: string
  sales_revenue_cents: number
  debt_sales_cents: number
  barter_cents: number
  bad_debt_cents: number
  food_purchase_cents: number
  waste_cents: number
  expense_cents: number
  reimbursement_cents: number
  net_profit_cents: number
}

export interface MonthlyReport {
  month: string
  sales_revenue_cents: number
  debt_sales_cents: number
  barter_cents: number
  bad_debt_cents: number
  food_purchase_cents: number
  waste_cents: number
  expense_cents: number
  reimbursement_cents: number
  net_profit_cents: number
}

export interface CategoryBreakdown {
  category: string
  amount_cents: number
}

export interface TillSummaryData {
  till_session_id: number
  opening_float_cents: number
  cash_sales_cents: number
  till_expenses_cents: number
  reimbursements_cents: number
  expected_cash_cents: number
  closed_at: string | null
}

function getDailyRow(date: string): DailyReport {
  const db = getDb()

  const salesRow = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status IN ('completed','unpaid') THEN total_cents ELSE 0 END), 0) AS sales_revenue_cents,
      COALESCE(SUM(CASE WHEN status IN ('completed','unpaid') AND sale_kind = 'captain' THEN total_cents ELSE 0 END), 0) AS barter_cents,
      COALESCE(SUM(
        CASE WHEN status IN ('completed','unpaid') AND payment_method IN ('debt','mixed')
          AND s.debt_cents - (SELECT COALESCE(SUM(amount_cents), 0) FROM payment_allocations WHERE sale_id = s.id) - (SELECT COALESCE(SUM(amount_cents), 0) FROM debt_write_offs WHERE sale_id = s.id) > 0
          THEN s.debt_cents - (SELECT COALESCE(SUM(amount_cents), 0) FROM payment_allocations WHERE sale_id = s.id) - (SELECT COALESCE(SUM(amount_cents), 0) FROM debt_write_offs WHERE sale_id = s.id)
        ELSE 0 END
      ), 0) AS debt_sales_cents
    FROM sales s
    WHERE DATE(s.created_at) = ?
  `).all(date) as { sales_revenue_cents: number; barter_cents: number; debt_sales_cents: number }[]

  const revenue = salesRow.reduce((sum, r) => sum + r.sales_revenue_cents, 0)
  const barter = salesRow.reduce((sum, r) => sum + r.barter_cents, 0)
  const outstandingDebt = salesRow.reduce((sum, r) => sum + r.debt_sales_cents, 0)

  const badDebtRow = db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) AS bad_debt_cents
    FROM debt_write_offs
    WHERE DATE(created_at) = ?
  `).get(date) as { bad_debt_cents: number }

  const purchaseRow = db.prepare(`
    SELECT COALESCE(SUM(cost_cents), 0) AS food_purchase_cents
    FROM item_purchases
    WHERE purchase_date = ?
  `).get(date) as { food_purchase_cents: number }

  const wasteRow = db.prepare(`
    SELECT COALESCE(SUM(estimated_value_cents), 0) AS waste_cents
    FROM waste
    WHERE waste_date = ?
  `).get(date) as { waste_cents: number }

  const expenseRow = db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) AS expense_cents
    FROM expenses
    WHERE date = ?
  `).get(date) as { expense_cents: number }

  const reimbursementRow = db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) AS reimbursement_cents
    FROM reimbursements
    WHERE date = ?
  `).get(date) as { reimbursement_cents: number }

  const foodCost = purchaseRow.food_purchase_cents
  const waste = wasteRow.waste_cents
  const expenses = expenseRow.expense_cents
  const badDebt = badDebtRow.bad_debt_cents

  return {
    date,
    sales_revenue_cents: revenue,
    debt_sales_cents: outstandingDebt,
    barter_cents: barter,
    bad_debt_cents: badDebt,
    food_purchase_cents: foodCost,
    waste_cents: waste,
    expense_cents: expenses,
    reimbursement_cents: reimbursementRow.reimbursement_cents,
    net_profit_cents: revenue - foodCost - waste - expenses - badDebt,
  }
}

function getMonthlyAggregated(year: number): MonthlyReport[] {
  const db = getDb()

  const salesRows = db.prepare(`
    SELECT month,
      SUM(sales_revenue_cents) as sales_revenue_cents,
      SUM(barter_cents) as barter_cents,
      SUM(debt_sales_cents) as debt_sales_cents
    FROM (
      SELECT
        strftime('%Y-%m', s.created_at) AS month,
        COALESCE(SUM(CASE WHEN s.status IN ('completed','unpaid') THEN s.total_cents ELSE 0 END), 0) AS sales_revenue_cents,
        COALESCE(SUM(CASE WHEN s.status IN ('completed','unpaid') AND s.sale_kind = 'captain' THEN s.total_cents ELSE 0 END), 0) AS barter_cents,
        COALESCE(SUM(
          CASE WHEN s.status IN ('completed','unpaid') AND s.payment_method IN ('debt','mixed')
            AND s.debt_cents - (SELECT COALESCE(SUM(amount_cents), 0) FROM payment_allocations WHERE sale_id = s.id) - (SELECT COALESCE(SUM(amount_cents), 0) FROM debt_write_offs WHERE sale_id = s.id) > 0
            THEN s.debt_cents - (SELECT COALESCE(SUM(amount_cents), 0) FROM payment_allocations WHERE sale_id = s.id) - (SELECT COALESCE(SUM(amount_cents), 0) FROM debt_write_offs WHERE sale_id = s.id)
          ELSE 0 END
        ), 0) AS debt_sales_cents
      FROM sales s
      WHERE strftime('%Y', s.created_at) = ?
      GROUP BY month
    )
    GROUP BY month
  `).all(String(year)) as { month: string; sales_revenue_cents: number; barter_cents: number; debt_sales_cents: number }[]

  const purchaseRows = db.prepare(`
    SELECT
      strftime('%Y-%m', purchase_date) AS month,
      COALESCE(SUM(cost_cents), 0) AS food_purchase_cents
    FROM item_purchases
    WHERE strftime('%Y', purchase_date) = ?
    GROUP BY month
  `).all(String(year)) as { month: string; food_purchase_cents: number }[]

  const wasteRows = db.prepare(`
    SELECT
      strftime('%Y-%m', waste_date) AS month,
      COALESCE(SUM(estimated_value_cents), 0) AS waste_cents
    FROM waste
    WHERE strftime('%Y', waste_date) = ?
    GROUP BY month
  `).all(String(year)) as { month: string; waste_cents: number }[]

  const expenseRows = db.prepare(`
    SELECT
      strftime('%Y-%m', date) AS month,
      COALESCE(SUM(amount_cents), 0) AS expense_cents
    FROM expenses
    WHERE strftime('%Y', date) = ?
    GROUP BY month
  `).all(String(year)) as { month: string; expense_cents: number }[]

  const reimbursementRows = db.prepare(`
    SELECT
      strftime('%Y-%m', date) AS month,
      COALESCE(SUM(amount_cents), 0) AS reimbursement_cents
    FROM reimbursements
    WHERE strftime('%Y', date) = ?
    GROUP BY month
  `).all(String(year)) as { month: string; reimbursement_cents: number }[]

  const badDebtRows = db.prepare(`
    SELECT
      strftime('%Y-%m', created_at) AS month,
      COALESCE(SUM(amount_cents), 0) AS bad_debt_cents
    FROM debt_write_offs
    WHERE strftime('%Y', created_at) = ?
    GROUP BY month
  `).all(String(year)) as { month: string; bad_debt_cents: number }[]

  const map = new Map<string, MonthlyReport>()
  const months = [
    ...salesRows.map(r => r.month),
    ...purchaseRows.map(r => r.month),
    ...wasteRows.map(r => r.month),
    ...expenseRows.map(r => r.month),
    ...reimbursementRows.map(r => r.month),
    ...badDebtRows.map(r => r.month),
  ]
  for (const m of months) {
    if (!m) continue
    if (!map.has(m)) {
      map.set(m, {
        month: m,
        sales_revenue_cents: 0,
        debt_sales_cents: 0,
        barter_cents: 0,
        bad_debt_cents: 0,
        food_purchase_cents: 0,
        waste_cents: 0,
        expense_cents: 0,
        reimbursement_cents: 0,
        net_profit_cents: 0,
      })
    }
  }

  for (const r of salesRows) {
    const row = map.get(r.month!)
    if (row) {
      row.sales_revenue_cents = r.sales_revenue_cents
      row.debt_sales_cents = r.debt_sales_cents
      row.barter_cents = r.barter_cents
    }
  }
  for (const r of purchaseRows) {
    const row = map.get(r.month!)
    if (row) row.food_purchase_cents = r.food_purchase_cents
  }
  for (const r of wasteRows) {
    const row = map.get(r.month!)
    if (row) row.waste_cents = r.waste_cents
  }
  for (const r of expenseRows) {
    const row = map.get(r.month!)
    if (row) row.expense_cents = r.expense_cents
  }
  for (const r of reimbursementRows) {
    const row = map.get(r.month!)
    if (row) row.reimbursement_cents = r.reimbursement_cents
  }
  for (const r of badDebtRows) {
    const row = map.get(r.month!)
    if (row) row.bad_debt_cents = r.bad_debt_cents
  }

  const result = Array.from(map.values())
  for (const row of result) {
    row.net_profit_cents = row.sales_revenue_cents - row.food_purchase_cents - row.waste_cents - row.expense_cents - row.bad_debt_cents
  }
  result.sort((a, b) => a.month.localeCompare(b.month))
  return result
}

export const reportsRepo = {
  getDaily(start: string, end: string): DailyReport[] {
    const days: DailyReport[] = []
    const current = new Date(start + 'T00:00:00')
    const endDate = new Date(end + 'T00:00:00')
    while (current <= endDate) {
      const dateStr =
        `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
      days.push(getDailyRow(dateStr))
      current.setDate(current.getDate() + 1)
    }
    return days
  },

  getMonthly(year: number): MonthlyReport[] {
    return getMonthlyAggregated(year)
  },

  getCategoryBreakdown(start: string, end: string): CategoryBreakdown[] {
    return getDb().prepare(`
      SELECT category, SUM(amount_cents) AS amount_cents
      FROM expenses
      WHERE date >= ? AND date <= ?
      GROUP BY category
      ORDER BY amount_cents DESC
    `).all(start, end) as CategoryBreakdown[]
  },

  getItemPerformance(start: string, end: string): ItemPerformance[] {
    return getDb().prepare(`
      SELECT
        COALESCE(c.name, '') AS category_name,
        COALESCE(mi.name, si.name_snapshot) AS item_name,
        SUM(si.quantity) AS quantity_sold,
        CAST(ROUND(SUM(si.line_total_cents * 1.0) / SUM(si.quantity)) AS INTEGER) AS price_per_item_cents,
        CAST(ROUND(SUM(si.line_total_cents * CASE WHEN s.subtotal_cents > 0 THEN s.total_cents * 1.0 / s.subtotal_cents ELSE 1 END)) AS INTEGER) AS amount_sold_cents,
        SUM(COALESCE(mi.cost_price_cents, 0) * si.quantity) AS cost_cents,
        CAST(ROUND(SUM(
          si.line_total_cents * CASE WHEN s.subtotal_cents > 0 THEN s.total_cents * 1.0 / s.subtotal_cents ELSE 1 END
          - COALESCE(mi.cost_price_cents, 0) * si.quantity
        )) AS INTEGER) AS profit_cents
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      LEFT JOIN menu_items mi ON mi.id = si.item_id
      LEFT JOIN categories c ON c.id = mi.category_id
      WHERE s.status IN ('completed','unpaid')
        AND DATE(s.created_at) >= ? AND DATE(s.created_at) <= ?
      GROUP BY c.name, mi.name
      ORDER BY amount_sold_cents DESC
    `).all(start, end) as ItemPerformance[]
  },

  getSales(start: string, end: string): SaleWithItems[] {
    const db = getDb()

    const saleRows = db.prepare(`
      SELECT
        id, till_session_id, created_at, status, subtotal_cents, discount_cents,
        tax_cents, total_cents, payment_source, customer_id, customer_name,
        created_by, voided_at, voided_by, void_reason, discount_reason,
        debt_cents, payment_method, sale_kind, service_description
      FROM sales
      WHERE status IN ('completed','unpaid')
        AND DATE(created_at) >= ? AND DATE(created_at) <= ?
      ORDER BY id DESC
    `).all(start, end) as SaleWithItems[]

    const saleIds = saleRows.map(r => r.id)

    const itemRows: SaleItem[] = saleIds.length
      ? db.prepare(`
          SELECT id, sale_id, item_id, free_item_id, name_snapshot, unit_price_cents, quantity, line_total_cents
          FROM sale_items
          WHERE sale_id IN (${saleIds.map(() => '?').join(',')})
          ORDER BY id ASC
        `).all(...saleIds) as SaleItem[]
      : []

    const bySale = new Map<number, SaleItem[]>()
    for (const it of itemRows) {
      const arr = bySale.get(it.sale_id) ?? []
      arr.push(it)
      bySale.set(it.sale_id, arr)
    }

    return saleRows.map(s => ({ ...s, items: bySale.get(s.id) ?? [] }))
  },

  getDebtSummary(): DebtSummaryItem[] {
    return getDb().prepare(`
      SELECT
        s.customer_name,
        s.id AS sale_id,
        s.debt_cents,
        COALESCE(SUM(pa.amount_cents), 0) AS paid_cents,
        COALESCE((SELECT COALESCE(SUM(amount_cents), 0) FROM debt_write_offs WHERE sale_id = s.id), 0) AS written_off_cents,
        s.debt_cents - COALESCE(SUM(pa.amount_cents), 0) - COALESCE((SELECT COALESCE(SUM(amount_cents), 0) FROM debt_write_offs WHERE sale_id = s.id), 0) AS total_debt_cents,
        CAST(julianday('now') - julianday(s.created_at) AS INTEGER) AS days_open,
        MAX(pa.created_at) AS last_payment_at,
        s.created_at
      FROM sales s
      LEFT JOIN payment_allocations pa ON pa.sale_id = s.id
      WHERE s.status IN ('unpaid') AND s.debt_cents > 0
      GROUP BY s.id
      HAVING total_debt_cents > 0
      ORDER BY s.created_at DESC
    `).all() as DebtSummaryItem[]
  },

  getTillSummary(tillSessionId: number): TillSummaryData | null {
    const session = getDb().prepare(`
      SELECT
        ts.id AS till_session_id,
        ts.opening_float_cents,
        ts.expected_cash_cents,
        ts.closed_at
      FROM till_sessions ts
      WHERE ts.id = ?
    `).get(tillSessionId) as { till_session_id: number; opening_float_cents: number; expected_cash_cents: number | null; closed_at: string | null } | undefined

    if (!session) return null

    const salesRow = getDb().prepare(`
      SELECT COALESCE(SUM(total_cents - debt_cents), 0) AS cash_sales_cents
      FROM sales
      WHERE till_session_id = ? AND status IN ('completed','unpaid')
    `).get(tillSessionId) as { cash_sales_cents: number }

    const expensesRow = getDb().prepare(`
      SELECT COALESCE(SUM(amount_cents), 0) AS till_expenses_cents
      FROM expenses
      WHERE till_session_id = ?
    `).get(tillSessionId) as { till_expenses_cents: number }

    const reimbursementRow = getDb().prepare(`
      SELECT COALESCE(SUM(amount_cents), 0) AS reimbursements_cents
      FROM reimbursements
      WHERE till_session_id = ?
    `).get(tillSessionId) as { reimbursements_cents: number }

    return {
      till_session_id: session.till_session_id,
      opening_float_cents: session.opening_float_cents,
      cash_sales_cents: salesRow.cash_sales_cents,
      till_expenses_cents: expensesRow.till_expenses_cents,
      reimbursements_cents: reimbursementRow.reimbursements_cents,
      expected_cash_cents: session.expected_cash_cents ?? (session.opening_float_cents + salesRow.cash_sales_cents - expensesRow.till_expenses_cents),
      closed_at: session.closed_at,
    }
  },
}
