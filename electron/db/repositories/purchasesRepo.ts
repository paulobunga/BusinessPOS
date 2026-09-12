import { getDb } from '../index'
import type { ItemPurchaseWithName, PurchaseYield } from '../../../shared/types'

type Database = ReturnType<typeof getDb>

function attachYields(db: Database, rows: ItemPurchaseWithName[]): ItemPurchaseWithName[] {
  if (rows.length === 0) return rows
  const ids = rows.map(r => r.id)
  const placeholders = ids.map(() => '?').join(',')
  const yieldRows = db.prepare(`
    SELECT ipy.purchase_id, ipy.id, ipy.item_id, ipy.portions, ipy.cost_cents, mi.name
    FROM item_purchase_yields ipy
    JOIN menu_items mi ON mi.id = ipy.item_id
    WHERE ipy.purchase_id IN (${placeholders})
    ORDER BY ipy.id ASC
  `).all(...ids) as (PurchaseYield & { purchase_id: number })[]

  const byPurchase = new Map<number, PurchaseYield[]>()
  for (const y of yieldRows) {
    const list = byPurchase.get(y.purchase_id) ?? []
    list.push({ id: y.id, item_id: y.item_id, name: y.name, portions: y.portions, cost_cents: y.cost_cents })
    byPurchase.set(y.purchase_id, list)
  }
  return rows.map(r => ({ ...r, yields: byPurchase.get(r.id) ?? [] }))
}

const PURCHASE_SELECT = `
  SELECT ip.*, mi.name as item_name, mi.cost_price_cents as unit_cost_cents, y.name as yield_item_name
  FROM item_purchases ip
  JOIN menu_items mi ON mi.id = ip.item_id
  LEFT JOIN menu_items y ON y.id = ip.yield_item_id
`

export interface PurchaseYieldInput {
  itemId: number
  portions: number
}

export const purchasesRepo = {
  recordPurchase(
    itemId: number,
    quantity: number,
    costCents: number,
    date: string,
    createdBy: number | null,
    opts: { unit?: string; yieldItemId?: number | null; expectedYield?: number; yields?: PurchaseYieldInput[] } = {}
  ): ItemPurchaseWithName {
    const db = getDb()
    const unit = opts.unit || 'kg'
    const yieldItemId = opts.yieldItemId ?? null

    const yields: PurchaseYieldInput[] = opts.yields ?? (
      yieldItemId != null
        ? [{ itemId: yieldItemId, portions: Math.max(1, Math.round((opts.expectedYield ?? quantity) * quantity)) }]
        : []
    )
    const totalPortions = yields.reduce((sum, y) => sum + (y.portions > 0 ? y.portions : 0), 0)

    return db.transaction(() => {
      const legacyExpectedYield = yields.length > 0 && quantity > 0
        ? Math.max(1, Math.round(yields[0].portions / quantity))
        : opts.expectedYield ?? Math.max(1, quantity)

      const result = db.prepare(
        'INSERT INTO item_purchases (item_id, purchase_date, quantity_kg, cost_cents, expected_yield, created_by, unit, yield_item_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(itemId, date, quantity, costCents, legacyExpectedYield, createdBy, unit, yields.length > 0 ? yields[0].itemId : null)

      if (quantity > 0 && costCents > 0) {
        db.prepare('UPDATE menu_items SET cost_price_cents = ? WHERE id = ?').run(
          Math.round(costCents / quantity),
          itemId
        )
        if (yields.length > 0 && totalPortions > 0) {
          const costPerPortion = Math.round(costCents / totalPortions)
          const insertYield = db.prepare(
            'INSERT INTO item_purchase_yields (purchase_id, item_id, portions, cost_cents) VALUES (?, ?, ?, ?)'
          )
          for (const y of yields) {
            const yieldCost = Math.round((costCents * y.portions) / totalPortions)
            insertYield.run(result.lastInsertRowid, y.itemId, y.portions, yieldCost)
            db.prepare('UPDATE menu_items SET cost_price_cents = ? WHERE id = ?').run(costPerPortion, y.itemId)
          }
        }
      }

      return this.getById(result.lastInsertRowid as number)
    })()
  },

  getById(id: number): ItemPurchaseWithName {
    const db = getDb()
    const row = db.prepare(`${PURCHASE_SELECT} WHERE ip.id = ?`).get(id) as ItemPurchaseWithName
    if (!row) throw new Error(`Purchase ${id} not found`)
    return attachYields(db, [row])[0]
  },

  getByDate(date: string): ItemPurchaseWithName[] {
    const db = getDb()
    const rows = db.prepare(`${PURCHASE_SELECT} WHERE ip.purchase_date = ? ORDER BY ip.id DESC`).all(date) as ItemPurchaseWithName[]
    return attachYields(db, rows)
  },

  getByDateRange(start: string, end: string): ItemPurchaseWithName[] {
    const db = getDb()
    const rows = db.prepare(`${PURCHASE_SELECT} WHERE ip.purchase_date >= ? AND ip.purchase_date <= ? ORDER BY ip.purchase_date DESC, ip.id DESC`).all(start, end) as ItemPurchaseWithName[]
    return attachYields(db, rows)
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