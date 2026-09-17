import { getDb } from '../index'
import type { OpenDebt, CustomerBalance, CustomerDetail, PaymentHistoryEntry, PayOnAccountResult, DebtWriteOff } from '../../../shared/types'

const writtenOffSubquery = `COALESCE((SELECT COALESCE(SUM(amount_cents), 0) FROM debt_write_offs WHERE sale_id = s.id), 0)`

function openDebtSelect(includeItems = true) {
  const itemNames = includeItems
    ? `,(SELECT GROUP_CONCAT(si.name_snapshot, ', ') FROM sale_items si WHERE si.sale_id = s.id) as item_names`
    : ', NULL as item_names'
  return `
    SELECT s.id as sale_id, s.customer_name, s.debt_cents, s.total_cents, s.created_at,
      COALESCE(SUM(pa.amount_cents), 0) as paid_cents,
      ${writtenOffSubquery} as written_off_cents,
      s.debt_cents - COALESCE(SUM(pa.amount_cents), 0) - ${writtenOffSubquery} as remaining_cents,
      CAST(julianday('now') - julianday(s.created_at) AS INTEGER) as days_open,
      MAX(pa.created_at) as last_payment_at
      ${itemNames}
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
        COALESCE(SUM(w.written_cents), 0) as total_written_off_cents,
        SUM(s.debt_cents) - COALESCE(SUM(p.paid_cents), 0) - COALESCE(SUM(w.written_cents), 0) as remaining_cents,
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
      LEFT JOIN (
        SELECT sale_id, SUM(amount_cents) as written_cents
        FROM debt_write_offs
        GROUP BY sale_id
      ) w ON w.sale_id = s.id
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
        SUM(s.debt_cents) - COALESCE(SUM(p.paid_cents), 0) - COALESCE(SUM(w.written_cents), 0) as remaining_cents
      FROM sales s
      LEFT JOIN (
        SELECT sale_id, SUM(amount_cents) as paid_cents
        FROM payment_allocations
        GROUP BY sale_id
      ) p ON p.sale_id = s.id
      LEFT JOIN (
        SELECT sale_id, SUM(amount_cents) as written_cents
        FROM debt_write_offs
        GROUP BY sale_id
      ) w ON w.sale_id = s.id
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
    const write_offs = getDb().prepare(`
      SELECT dwo.id, dwo.sale_id, dwo.amount_cents, dwo.reason, dwo.written_by, dwo.created_at,
        s.total_cents as sale_total_cents, s.created_at as sale_created_at
      FROM debt_write_offs dwo
      JOIN sales s ON s.id = dwo.sale_id
      WHERE s.customer_name = ?
      ORDER BY dwo.created_at DESC, dwo.id DESC
    `).all(name) as DebtWriteOff[]
    return { customer_name: name, total_owed_cents: total, open_debts: debts, payments, write_offs }
  },

  recordPayment(sale_id: number, amount_cents: number, payment_method: string, till_session_id: number | null, created_by: number): { remaining_cents: number; sale_status: string } {
    const db = getDb()
    return db.transaction(() => {
      const row = db.prepare(`
        SELECT s.debt_cents, COALESCE(SUM(pa.amount_cents), 0) as paid_cents,
          ${writtenOffSubquery} as written_off_cents
        FROM sales s
        LEFT JOIN payment_allocations pa ON pa.sale_id = s.id
        WHERE s.id = ? AND s.status = 'unpaid' AND s.debt_cents > 0
        GROUP BY s.id
      `).get(sale_id) as { debt_cents: number; paid_cents: number; written_off_cents: number } | undefined

      if (!row) throw new Error('Sale is not an open debt')
      if (amount_cents <= 0) throw new Error('Payment amount must be positive')

      const remaining = row.debt_cents - row.paid_cents - row.written_off_cents
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

  writeOff(payload: { sale_id: number; amount_cents: number; reason: string; created_by: number }): { written_off_cents: number; remaining_cents: number } {
    const db = getDb()
    return db.transaction(() => {
      const row = db.prepare(`
        SELECT s.debt_cents, COALESCE(SUM(pa.amount_cents), 0) as paid_cents,
          ${writtenOffSubquery} as written_off_cents
        FROM sales s
        LEFT JOIN payment_allocations pa ON pa.sale_id = s.id
        WHERE s.id = ? AND s.status = 'unpaid' AND s.debt_cents > 0
        GROUP BY s.id
      `).get(payload.sale_id) as { debt_cents: number; paid_cents: number; written_off_cents: number } | undefined

      if (!row) throw new Error('Sale is not an open debt')
      if (payload.amount_cents <= 0) throw new Error('Write-off amount must be positive')
      if (!payload.reason || !payload.reason.trim()) throw new Error('A reason is required to write off debt')

      const remaining = row.debt_cents - row.paid_cents - row.written_off_cents
      if (payload.amount_cents > remaining) throw new Error('Write-off exceeds the remaining balance')

      db.prepare(`
        INSERT INTO debt_write_offs (sale_id, amount_cents, reason, written_by)
        VALUES (?, ?, ?, ?)
      `).run(payload.sale_id, payload.amount_cents, payload.reason.trim(), payload.created_by)

      return { written_off_cents: payload.amount_cents, remaining_cents: remaining - payload.amount_cents }
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
        SELECT s.id as sale_id, s.debt_cents, COALESCE(SUM(pa.amount_cents), 0) as paid_cents,
          ${writtenOffSubquery} as written_off_cents
        FROM sales s
        LEFT JOIN payment_allocations pa ON pa.sale_id = s.id
        WHERE s.customer_name = ? AND s.debt_cents > 0 AND s.status = 'unpaid'
        GROUP BY s.id
        HAVING s.debt_cents - COALESCE(SUM(pa.amount_cents), 0) - ${writtenOffSubquery} > 0
        ORDER BY s.created_at ASC, s.id ASC
      `).all(payload.customer_name) as { sale_id: number; debt_cents: number; paid_cents: number; written_off_cents: number }[]

      const totalOutstanding = open.reduce((s, o) => s + (o.debt_cents - o.paid_cents - o.written_off_cents), 0)
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
        const remaining = sale.debt_cents - sale.paid_cents - sale.written_off_cents
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
    const written = getDb().prepare('SELECT COALESCE(SUM(amount_cents), 0) as written FROM debt_write_offs WHERE sale_id = ?').get(sale_id) as { written: number }
    return Math.max(debt.debt_cents - paid.paid - written.written, 0)
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

  writeOffs(sale_id: number): DebtWriteOff[] {
    return getDb().prepare(`
      SELECT dwo.id, dwo.sale_id, dwo.amount_cents, dwo.reason, dwo.written_by, dwo.created_at,
        s.total_cents as sale_total_cents, s.created_at as sale_created_at
      FROM debt_write_offs dwo
      JOIN sales s ON s.id = dwo.sale_id
      WHERE dwo.sale_id = ?
      ORDER BY dwo.created_at DESC
    `).all(sale_id) as DebtWriteOff[]
  },

  recordFromList(entries: Array<{
    customer_name: string
    date: string
    items: Array<{ name_snapshot: string; unit_price_cents: number; quantity: number }>
    paid_cents?: number
    created_by: number
  }>) {
    const db = getDb()
    const getOrCreateCustomer = db.transaction((name: string) => {
      const existing = db.prepare('SELECT id FROM customers WHERE name = ?').get(name) as { id: number } | undefined
      if (existing) return existing.id
      return Number(db.prepare('INSERT INTO customers (name) VALUES (?)').run(name).lastInsertRowid)
    })

    return db.transaction(() => {
      const results = []
      for (const entry of entries) {
        const subtotal = entry.items.reduce((s, i) => s + i.unit_price_cents * i.quantity, 0)
        const paid = entry.paid_cents ?? 0
        const debtCents = subtotal - paid
        if (debtCents <= 0) continue

        const customerId = getOrCreateCustomer(entry.customer_name)
        const result = db.prepare(`
          INSERT INTO sales (customer_id, customer_name, subtotal_cents, discount_cents, discount_reason,
                             debt_cents, payment_method, status, payment_source, total_cents,
                             till_session_id, created_by, created_at)
          VALUES (?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, NULL, ?, ?)
        `).run(
          customerId,
          entry.customer_name,
          subtotal,
          debtCents,
          'debt',
          'unpaid',
          'unpaid',
          subtotal,
          entry.created_by,
          entry.date + ' 12:00:00',
        )
        const saleId = Number(result.lastInsertRowid)

        const insertItem = db.prepare(`
          INSERT INTO sale_items (sale_id, item_id, free_item_id, name_snapshot, unit_price_cents, quantity, line_total_cents)
          VALUES (?, NULL, NULL, ?, ?, ?, ?)
        `)
        for (const item of entry.items) {
          insertItem.run(saleId, item.name_snapshot, item.unit_price_cents, item.quantity, item.unit_price_cents * item.quantity)
        }

        results.push({ saleId, customer: entry.customer_name, debtCents, subtotal })
      }
      return results
    })()
  },
}