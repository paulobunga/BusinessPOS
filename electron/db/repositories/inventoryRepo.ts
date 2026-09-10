import { getDb } from '../index'

export const inventoryRepo = {
  recordPurchase(proteinId: number, quantity: number, costCents: number, date: string, createdBy: number | null) {
    const result = getDb().prepare(
      'INSERT INTO protein_purchases (protein_id, purchase_date, quantity_kg, cost_cents, expected_yield, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(proteinId, date, quantity, costCents, quantity, createdBy)
    return getDb().prepare('SELECT * FROM protein_purchases WHERE id = ?').get(result.lastInsertRowid)
  },

  getByDate(date: string) {
    return getDb().prepare(`
      SELECT pp.*, p.name as protein_name, p.cost_price_cents as unit_cost_cents
      FROM protein_purchases pp
      JOIN proteins p ON p.id = pp.protein_id
      WHERE pp.purchase_date = ?
      ORDER BY pp.id DESC
    `).all(date)
  },

  getByDateRange(start: string, end: string) {
    return getDb().prepare(`
      SELECT pp.*, p.name as protein_name, p.cost_price_cents as unit_cost_cents
      FROM protein_purchases pp
      JOIN proteins p ON p.id = pp.protein_id
      WHERE pp.purchase_date >= ? AND pp.purchase_date <= ?
      ORDER BY pp.purchase_date DESC, pp.id DESC
    `).all(start, end)
  },

  getLatestByProtein(proteinId: number) {
    return getDb().prepare(
      'SELECT * FROM protein_purchases WHERE protein_id = ? ORDER BY purchase_date DESC, id DESC LIMIT 1'
    ).get(proteinId)
  },

  dailyTotal(date: string) {
    const row = getDb().prepare(
      'SELECT COALESCE(SUM(cost_cents), 0) as total FROM protein_purchases WHERE purchase_date = ?'
    ).get(date) as { total: number }
    return row.total
  },
}
