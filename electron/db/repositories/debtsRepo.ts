import { getDb } from '../index'
import type { OpenDebt, CustomerBalance, CustomerDetail, PaymentHistoryEntry, PayOnAccountResult } from '../../../shared/types'

function openDebtSelect() {
  return `
    SELECT s.id as sale_id, s.customer_name, s.debt_cents, s.total_cents, s.created_at,
      COALESCE(SUM(pa.amount_cents), 0) as paid_cents,
      s.debt_cents - COALESCE(SUM(pa.amount_cents), 0) as remaining_cents,
      CAST(julianday('now') - julianday(s.created_at) AS INTEGER) as days_open,
      MAX(pa.created_at) as last_payment_at
    FROM sales s
    LEFT JOIN payment_allocations pa ON pa.sale_id = s.id
  `
}

export const debtsRepo = {
  listOpen(): OpenDebt[] {
    return getDb().prepare(`
      ${openDebtSelect()}
      WHERE s.debt_cents > 0 AND s.status = 'unpaid'
      GROUP BY s.id
      HAVING remaining_cents > 0
      ORDER BY s.created_at DESC
    `).all() as OpenDebt[]
  },

  customerBalances(): CustomerBalance[] {
    return getDb().prepare(`
      SELECT
        s.customer_name,
        SUM(s.debt_cents) as total_owed_cents,
        COALESCE(SUM(p.paid_cents), 0) as total_paid_cents,
        SUM(s.debt_cents) - COALESCE(SUM(p.paid_cents), 0) as remaining_cents,
        COUNT(*) as unpaid_orders,
        MIN(s.created_at) as oldest_open_date,
        MAX(s.created_at) as newest_open_date,
        MAX(p.last_payment_at) as last_payment_at
      FROM sales s
      LEFT JOIN (
        SELECT sale_id, SUM(amount_cents) as paid_cents, MAX(created_at) as last_payment_at
        FROM payment_allocations
        GROUP BY sale_id
      ) p ON p.sale_id = s.id
      WHERE s.debt_cents > 0 AND s.status = 'unpaid'
        AND s.customer_name IS NOT NULL AND TRIM(s.customer_name) != ''
      GROUP BY s.customer_name
      HAVING remaining_cents > 0
      ORDER BY remaining_cents DESC, s.customer_name COLLATE NOCASE
    `).all() as CustomerBalance[]
  },

  balanceByName(name: string): number {
    const row = getDb().prepare(`
      SELECT
        SUM(s.debt_cents) - COALESCE(SUM(p.paid_cents), 0) as remaining_cents
      FROM sales s
      LEFT JOIN (
        SELECT sale_id, SUM(amount_cents) as paid_cents
        FROM payment_allocations
        GROUP BY sale_id
      ) p ON p.sale_id = s.id
      WHERE s.customer_name = ? AND s.debt_cents > 0 AND s.status = 'unpaid'
      GROUP BY s.customer_name
      HAVING remaining_cents > 0
    `).get(name) as { remaining_cents: number } | undefined
    return row?.remaining_cents ?? 0
  },

  customerDetail(name: string): CustomerDetail {
    const debts = getDb().prepare(`
      ${openDebtSelect()}
      WHERE s.customer_name = ? AND s.debt_cents > 0 AND s.status = 'unpaid'
      GROUP BY s.id
      HAVING remaining_cents > 0
      ORDER BY s.created_at DESC
    `).all(name) as OpenDebt[]
    const total = debts.reduce((s, d) => s + d.remaining_cents, 0)
    const payments = getDb().prepare(`
      SELECT pa.id, pa.sale_id, pa.amount_cents, pa.payment_method,
        pa.till_session_id, pa.created_by, pa.created_at,
        s.total_cents as sale_total_cents, s.created_at as sale_created_at
      FROM payment_allocations pa
      JOIN sales s ON s.id = pa.sale_id
      WHERE s.customer_name = ?
      ORDER BY pa.created_at DESC, pa.id DESC
    `).all(name) as PaymentHistoryEntry[]
    return { customer_name: name, total_owed_cents: total, open_debts: debts, payments }
  },

  recordPayment(sale_id: number, amount_cents: number, payment_method: string, till_session_id: number | null, created_by: number): { remaining_cents: number; sale_status: string } {
    const db = getDb()
    return db.transaction(() => {
      const row = db.prepare(`
        SELECT s.debt_cents, COALESCE(SUM(pa.amount_cents), 0) as paid_cents
        FROM sales s
        LEFT JOIN payment_allocations pa ON pa.sale_id = s.id
        WHERE s.id = ? AND s.status = 'unpaid' AND s.debt_cents > 0
        GROUP BY s.id
      `).get(sale_id) as { debt_cents: number; paid_cents: number } | undefined

      if (!row) throw new Error('Sale is not an open debt')
      if (amount_cents <= 0) throw new Error('Payment amount must be positive')

      const remaining = row.debt_cents - row.paid_cents
      if (amount_cents > remaining) throw new Error('Payment exceeds the remaining balance')

      db.prepare(`
        INSERT INTO payment_allocations (sale_id, amount_cents, payment_method, till_session_id, created_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(sale_id, amount_cents, payment_method, till_session_id, created_by)

      const newRemaining = remaining - amount_cents
      const sale_status = newRemaining <= 0 ? 'completed' : 'unpaid'
      if (sale_status === 'completed') {
        db.prepare("UPDATE sales SET status = 'completed' WHERE id = ?").run(sale_id)
      }
      return { remaining_cents: newRemaining, sale_status }
    })()
  },

  payOnAccount(payload: {
    customer_name: string
    amount_cents: number
    till_session_id: number | null
    created_by: number
    payment_method?: string
  }): PayOnAccountResult {
    const db = getDb()
    const paymentMethod = payload.payment_method ?? 'cash'
    return db.transaction(() => {
      if (payload.amount_cents <= 0) throw new Error('Payment amount must be positive')

      const open = db.prepare(`
        SELECT s.id as sale_id, s.debt_cents, COALESCE(SUM(pa.amount_cents), 0) as paid_cents
        FROM sales s
        LEFT JOIN payment_allocations pa ON pa.sale_id = s.id
        WHERE s.customer_name = ? AND s.debt_cents > 0 AND s.status = 'unpaid'
        GROUP BY s.id
        HAVING s.debt_cents - COALESCE(SUM(pa.amount_cents), 0) > 0
        ORDER BY s.created_at ASC, s.id ASC
      `).all(payload.customer_name) as { sale_id: number; debt_cents: number; paid_cents: number }[]

      const totalOutstanding = open.reduce((s, o) => s + (o.debt_cents - o.paid_cents), 0)
      if (payload.amount_cents > totalOutstanding) {
        throw new Error('Payment exceeds the total outstanding balance')
      }

      const insert = db.prepare(`
        INSERT INTO payment_allocations (sale_id, amount_cents, payment_method, till_session_id, created_by)
        VALUES (?, ?, ?, ?, ?)
      `)
      const setCompleted = db.prepare("UPDATE sales SET status = 'completed' WHERE id = ?")

      let toApply = payload.amount_cents
      const allocations: { sale_id: number; amount_cents: number }[] = []
      const settled: number[] = []

      for (const sale of open) {
        if (toApply <= 0) break
        const remaining = sale.debt_cents - sale.paid_cents
        const applied = Math.min(toApply, remaining)
        insert.run(sale.sale_id, applied, paymentMethod, payload.till_session_id, payload.created_by)
        allocations.push({ sale_id: sale.sale_id, amount_cents: applied })
        toApply -= applied
        if (remaining - applied <= 0) {
          settled.push(sale.sale_id)
          setCompleted.run(sale.sale_id)
        }
      }

      return {
        total_applied_cents: allocations.reduce((s, a) => s + a.amount_cents, 0),
        allocations,
        settled_sale_ids: settled,
      }
    })()
  },

  getTotalOwed(sale_id: number): number {
    const debt = getDb().prepare('SELECT debt_cents FROM sales WHERE id = ?').get(sale_id) as { debt_cents: number } | undefined
    if (!debt) return 0
    const paid = getDb().prepare('SELECT COALESCE(SUM(amount_cents), 0) as paid FROM payment_allocations WHERE sale_id = ?').get(sale_id) as { paid: number }
    return debt.debt_cents - paid.paid
  },

  history(sale_id: number): PaymentHistoryEntry[] {
    return getDb().prepare(`
      SELECT pa.id, pa.sale_id, pa.amount_cents, pa.payment_method,
        pa.till_session_id, pa.created_by, pa.created_at,
        s.total_cents as sale_total_cents, s.created_at as sale_created_at
      FROM payment_allocations pa
      JOIN sales s ON s.id = pa.sale_id
      WHERE pa.sale_id = ?
      ORDER BY pa.created_at DESC
    `).all(sale_id) as PaymentHistoryEntry[]
  },
}