import { getDb } from '../index'

export const tillRepo = {
  current(): { id: number; opened_at: string; opening_float_cents: number } | null {
    const row = getDb().prepare('SELECT id, opened_at, opening_float_cents FROM till_sessions WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1').get() as any
    return row ?? null
  },

  open(openingFloatCents: number) {
    const result = getDb().prepare("INSERT INTO till_sessions (opening_float_cents, opened_at) VALUES (?, datetime('now'))").run(openingFloatCents)
    return result.lastInsertRowid
  },

  close(id: number, closingBalanceCents: number) {
    const till = getDb().prepare('SELECT opening_float_cents FROM till_sessions WHERE id = ?').get(id) as { opening_float_cents: number } | undefined
    if (!till) return

    const countData = this.countCash()
    const expected = countData?.expectedClosingCents ?? till.opening_float_cents
    const variance = closingBalanceCents - expected

    getDb().prepare(
      'UPDATE till_sessions SET closed_at = CURRENT_TIMESTAMP, counted_cash_cents = ?, expected_cash_cents = ?, variance_cents = ? WHERE id = ?'
    ).run(closingBalanceCents, expected, variance, id)
  },

  countCash() {
    const till = this.current()
    if (!till) return null

    const sales = getDb().prepare(`
      SELECT COALESCE(SUM(s.total_cents - s.debt_cents), 0) as cash_sales_cents
      FROM sales s
      WHERE s.till_session_id = ? AND s.payment_method IN ('cash', 'mixed')
    `).get(till.id) as { cash_sales_cents: number }

    const expenses = getDb().prepare(`
      SELECT COALESCE(SUM(e.amount_cents), 0) as till_expenses_cents
      FROM expenses e
      WHERE e.till_session_id = ? AND e.payment_source = 'till' AND e.deleted_at IS NULL
    `).get(till.id) as { till_expenses_cents: number }

    return {
      openingFloatCents: till.opening_float_cents,
      cashSalesCents: sales.cash_sales_cents,
      tillExpensesCents: expenses.till_expenses_cents,
      expectedClosingCents: till.opening_float_cents + sales.cash_sales_cents - expenses.till_expenses_cents,
    }
  },
}