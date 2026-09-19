import { getDb } from '../index'
import type { ItemPurchaseWithName } from '../../../shared/types'

const PURCHASE_SELECT = `
  SELECT ip.*, mi.name as item_name, mi.cost_price_cents as unit_cost_cents
  FROM item_purchases ip
  JOIN menu_items mi ON mi.id = ip.item_id
`

export const purchasesRepo = {
  recordPurchase(
    itemId: number,
    quantity: number,
    costCents: number,
    date: string,
    createdBy: number | null,
    totalYield: number,
    opts: { unit?: string; notes?: string } = {},
  ): ItemPurchaseWithName {
    const db = getDb()
    const unit = opts.unit || 'kg'

    const result = db.prepare(
      'INSERT INTO item_purchases (item_id, purchase_date, quantity_kg, cost_cents, total_yield, created_by, unit, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(itemId, date, quantity, costCents, totalYield, createdBy, unit, opts.notes ?? null)

    if (quantity > 0 && costCents > 0) {
      db.prepare('UPDATE menu_items SET cost_price_cents = ? WHERE id = ?').run(
        Math.round(costCents / quantity),
        itemId,
      )
    }

    return this.getById(result.lastInsertRowid as number)
  },

  getById(id: number): ItemPurchaseWithName {
    const db = getDb()
    const row = db.prepare(`${PURCHASE_SELECT} WHERE ip.id = ?`).get(id) as ItemPurchaseWithName
    if (!row) throw new Error(`Purchase ${id} not found`)
    return row
  },

  getByDate(date: string): ItemPurchaseWithName[] {
    const db = getDb()
    const rows = db.prepare(`${PURCHASE_SELECT} WHERE ip.purchase_date = ? ORDER BY ip.id DESC`).all(date) as ItemPurchaseWithName[]
    return rows
  },

  getByDateRange(start: string, end: string): ItemPurchaseWithName[] {
    const db = getDb()
    const rows = db.prepare(`${PURCHASE_SELECT} WHERE ip.purchase_date >= ? AND ip.purchase_date <= ? ORDER BY ip.purchase_date DESC, ip.id DESC`).all(start, end) as ItemPurchaseWithName[]
    return rows
  },

  getLatestByItem(itemId: number) {
    return getDb().prepare(
      'SELECT * FROM item_purchases WHERE item_id = ? ORDER BY purchase_date DESC, id DESC LIMIT 1',
    ).get(itemId)
  },

  dailyTotal(date: string) {
    const row = getDb().prepare(
      'SELECT COALESCE(SUM(cost_cents), 0) as total FROM item_purchases WHERE purchase_date = ?',
    ).get(date) as { total: number }
    return row.total
  },
}
