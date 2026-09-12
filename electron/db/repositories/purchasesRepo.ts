import { getDb } from '../index'
import type { ItemPurchaseWithName } from '../../../shared/types'

export const purchasesRepo = {
  recordPurchase(
    itemId: number,
    quantity: number,
    costCents: number,
    date: string,
    createdBy: number | null,
    opts: { unit?: string; yieldItemId?: number | null; expectedYield?: number } = {}
  ): ItemPurchaseWithName {
    const db = getDb()
    const unit = opts.unit || 'kg'
    const yieldItemId = opts.yieldItemId ?? null
    const expectedYield = opts.expectedYield ?? Math.max(1, quantity)
    return db.transaction(() => {
      const result = db.prepare(
        'INSERT INTO item_purchases (item_id, purchase_date, quantity_kg, cost_cents, expected_yield, created_by, unit, yield_item_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(itemId, date, quantity, costCents, expectedYield, createdBy, unit, yieldItemId)

      if (quantity > 0 && costCents > 0) {
        db.prepare('UPDATE menu_items SET cost_price_cents = ? WHERE id = ?').run(
          Math.round(costCents / quantity),
          itemId
        )
        if (yieldItemId != null && expectedYield > 0) {
          db.prepare('UPDATE menu_items SET cost_price_cents = ? WHERE id = ?').run(
            Math.round(costCents / (quantity * expectedYield)),
            yieldItemId
          )
        }
      }

      const row = db.prepare(`
        SELECT ip.*, mi.name as item_name, mi.cost_price_cents as unit_cost_cents, y.name as yield_item_name
        FROM item_purchases ip
        JOIN menu_items mi ON mi.id = ip.item_id
        LEFT JOIN menu_items y ON y.id = ip.yield_item_id
        WHERE ip.id = ?
      `).get(result.lastInsertRowid) as ItemPurchaseWithName
      return row
    })()
  },

  getByDate(date: string): ItemPurchaseWithName[] {
    return getDb().prepare(`
      SELECT ip.*, mi.name as item_name, mi.cost_price_cents as unit_cost_cents, y.name as yield_item_name
      FROM item_purchases ip
      JOIN menu_items mi ON mi.id = ip.item_id
      LEFT JOIN menu_items y ON y.id = ip.yield_item_id
      WHERE ip.purchase_date = ?
      ORDER BY ip.id DESC
    `).all(date) as ItemPurchaseWithName[]
  },

  getByDateRange(start: string, end: string): ItemPurchaseWithName[] {
    return getDb().prepare(`
      SELECT ip.*, mi.name as item_name, mi.cost_price_cents as unit_cost_cents, y.name as yield_item_name
      FROM item_purchases ip
      JOIN menu_items mi ON mi.id = ip.item_id
      LEFT JOIN menu_items y ON y.id = ip.yield_item_id
      WHERE ip.purchase_date >= ? AND ip.purchase_date <= ?
      ORDER BY ip.purchase_date DESC, ip.id DESC
    `).all(start, end) as ItemPurchaseWithName[]
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
