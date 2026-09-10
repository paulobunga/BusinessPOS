import { getDb } from '../index'

export const purchasesRepo = {
  recordPurchase(itemId: number, quantity: number, costCents: number, date: string, createdBy: number | null) {
    const result = getDb().prepare(
      'INSERT INTO item_purchases (item_id, purchase_date, quantity_kg, cost_cents, expected_yield, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(itemId, date, quantity, costCents, quantity, createdBy)
    return getDb().prepare('SELECT * FROM item_purchases WHERE id = ?').get(result.lastInsertRowid)
  },

  getByDate(date: string) {
    return getDb().prepare(`
      SELECT ip.*, mi.name as item_name, mi.cost_price_cents as unit_cost_cents
      FROM item_purchases ip
      JOIN menu_items mi ON mi.id = ip.item_id
      WHERE ip.purchase_date = ?
      ORDER BY ip.id DESC
    `).all(date)
  },

  getByDateRange(start: string, end: string) {
    return getDb().prepare(`
      SELECT ip.*, mi.name as item_name, mi.cost_price_cents as unit_cost_cents
      FROM item_purchases ip
      JOIN menu_items mi ON mi.id = ip.item_id
      WHERE ip.purchase_date >= ? AND ip.purchase_date <= ?
      ORDER BY ip.purchase_date DESC, ip.id DESC
    `).all(start, end)
  },

  getLatestByItem(itemId: number) {
    return getDb().prepare(
      'SELECT * FROM item_purchases WHERE item_id = ? ORDER BY purchase_date DESC, id DESC LIMIT 1'
    ).get(itemId)
  },

  dailyTotal(date: string) {
    const row = getDb().prepare(
      'SELECT COALESCE(SUM(cost_cents), 0) as total FROM item_purchases WHERE purchase_date = ?'
    ).get(date) as { total: number }
    return row.total
  },
}
