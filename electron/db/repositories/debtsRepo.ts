import { getDb } from '../index'

export const debtsRepo = {
  listOpen() {
    return getDb().prepare(`
      SELECT s.id as sale_id, s.customer_name, s.debt_cents, s.total_cents, s.created_at,
        COALESCE(SUM(pa.amount_cents), 0) as paid_cents
      FROM sales s
      LEFT JOIN payment_allocations pa ON pa.sale_id = s.id
      WHERE s.debt_cents > 0 AND s.status = 'unpaid'
      GROUP BY s.id
      HAVING paid_cents < s.debt_cents
      ORDER BY s.created_at DESC
    `).all()
  },

  recordPayment(sale_id: number, amount_cents: number, payment_method: string, till_session_id: number | null, created_by: number) {
    const db = getDb()
    db.prepare(`
      INSERT INTO payment_allocations (sale_id, amount_cents, payment_method, till_session_id, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(sale_id, amount_cents, payment_method, till_session_id, created_by)

    const totalPaid = db.prepare('SELECT COALESCE(SUM(amount_cents), 0) as paid FROM payment_allocations WHERE sale_id = ?').get(sale_id) as { paid: number }
    const sale = db.prepare('SELECT debt_cents FROM sales WHERE id = ?').get(sale_id) as { debt_cents: number }
    if (sale && totalPaid.paid >= sale.debt_cents) {
      db.prepare("UPDATE sales SET status = 'completed' WHERE id = ?").run(sale_id)
    }
  },

  getTotalOwed(sale_id: number) {
    const debt = getDb().prepare('SELECT debt_cents FROM sales WHERE id = ?').get(sale_id) as { debt_cents: number }
    if (!debt) return 0
    const paid = getDb().prepare('SELECT COALESCE(SUM(amount_cents), 0) as paid FROM payment_allocations WHERE sale_id = ?').get(sale_id) as { paid: number }
    return debt.debt_cents - paid.paid
  },

  history(sale_id: number) {
    return getDb().prepare('SELECT * FROM payment_allocations WHERE sale_id = ? ORDER BY created_at DESC').all(sale_id)
  }
}
