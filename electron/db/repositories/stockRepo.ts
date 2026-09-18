import { getDb } from '../index'

export type StockMovementType = 'purchase_in' | 'sale_out' | 'discount_out' | 'captain_out' | 'waste'

const TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS item_stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES menu_items(id),
    movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase_in', 'sale_out', 'discount_out', 'captain_out', 'waste')),
    quantity INTEGER NOT NULL DEFAULT 1,
    is_discount INTEGER NOT NULL DEFAULT 0,
    reference_table TEXT,
    reference_id INTEGER,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    notes TEXT
  );
`

function ensureTable(db: ReturnType<typeof getDb>) {
  db.exec(TABLE_SQL)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON item_stock_movements(item_id, created_at);`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON item_stock_movements(reference_table, reference_id);`)
}

export const stockRepo = {
  recordMovement(data: {
    item_id: number
    movement_type: StockMovementType
    quantity: number
    is_discount?: number
    reference_table?: string
    reference_id?: number
    created_by?: number | null
    notes?: string
  }): number {
    const db = getDb()
    ensureTable(db)
    const result = db.prepare(`
      INSERT INTO item_stock_movements (item_id, movement_type, quantity, is_discount, reference_table, reference_id, created_by, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.item_id,
      data.movement_type,
      data.quantity,
      data.is_discount ?? 0,
      data.reference_table ?? null,
      data.reference_id ?? null,
      data.created_by ?? null,
      data.notes ?? null,
    )
    return result.lastInsertRowid as number
  },

  /**
   * Record consumption for a sold meal.
   * If the meal has recipe links (item_yield_defaults), deduct `qty` servings
   * from each linked raw input. Otherwise deduct from the item itself.
   * Purchases add servings via `purchase_in` with quantity = total_yield, so
   * buy 1 chicken (yields 4) then sell 1 meal leaves 3 in stock.
   */
  consumeForSale(
    mealId: number,
    qty: number,
    opts: {
      movement_type: 'sale_out' | 'discount_out' | 'captain_out'
      is_discount?: number
      reference_table?: string
      reference_id?: number
      created_by?: number | null
    },
  ): void {
    const db = getDb()
    ensureTable(db)
    const hasDefaults = db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'item_yield_defaults'",
    ).get()
    const raws = hasDefaults
      ? (db.prepare('SELECT raw_input_id FROM item_yield_defaults WHERE meal_id = ?').all(mealId) as { raw_input_id: number }[])
      : []
    if (raws.length === 0) {
      this.recordMovement({ item_id: mealId, quantity: qty, ...opts })
      return
    }
    for (const r of raws) {
      this.recordMovement({ item_id: r.raw_input_id, quantity: qty, ...opts })
    }
  },

  getBalance(itemId: number): number {
    const db = getDb()
    ensureTable(db)
    const row = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN movement_type = 'purchase_in' THEN quantity ELSE 0 END), 0)
           - COALESCE(SUM(CASE WHEN movement_type IN ('sale_out', 'discount_out', 'captain_out', 'waste') THEN quantity ELSE 0 END), 0) AS balance
      FROM item_stock_movements
      WHERE item_id = ?
    `).get(itemId) as { balance: number }
    return row.balance
  },

  hasHistory(itemId: number): boolean {
    const db = getDb()
    ensureTable(db)
    const row = db.prepare(
      'SELECT COUNT(*) as c FROM item_stock_movements WHERE item_id = ?',
    ).get(itemId) as { c: number }
    return row.c > 0
  },

  /**
   * Servings available for a POS meal. Returns null when the item has no
   * stock history (unlimited — e.g. seeded items never purchased).
   */
  getAvailability(mealId: number): number | null {
    const db = getDb()
    ensureTable(db)
    const hasDefaults = db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'item_yield_defaults'",
    ).get()
    const raws = hasDefaults
      ? (db.prepare('SELECT raw_input_id FROM item_yield_defaults WHERE meal_id = ?').all(mealId) as { raw_input_id: number }[])
      : []
    if (raws.length > 0) {
      let min: number | null = null
      for (const r of raws) {
        if (!this.hasHistory(r.raw_input_id)) continue
        const bal = this.getBalance(r.raw_input_id)
        min = min == null ? bal : Math.min(min, bal)
      }
      return min
    }
    if (!this.hasHistory(mealId)) return null
    return this.getBalance(mealId)
  },

  getAvailabilityMany(mealIds: number[]): Record<number, number | null> {
    const out: Record<number, number | null> = {}
    if (mealIds.length === 0) return out
    const db = getDb()
    ensureTable(db)
    const hasDefaults = db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'item_yield_defaults'",
    ).get()
    const links = new Map<number, number[]>()
    if (hasDefaults) {
      const placeholders = mealIds.map(() => '?').join(',')
      const rows = db.prepare(
        `SELECT meal_id, raw_input_id FROM item_yield_defaults WHERE meal_id IN (${placeholders})`,
      ).all(...mealIds) as { meal_id: number; raw_input_id: number }[]
      for (const r of rows) {
        const arr = links.get(r.meal_id) ?? []
        arr.push(r.raw_input_id)
        links.set(r.meal_id, arr)
      }
    }
    const watch = new Set<number>(mealIds)
    for (const raws of links.values()) for (const id of raws) watch.add(id)
    const ids = [...watch]
    const placeholders = ids.map(() => '?').join(',')
    const balances = db.prepare(`
      SELECT item_id,
        COALESCE(SUM(CASE WHEN movement_type = 'purchase_in' THEN quantity ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN movement_type IN ('sale_out', 'discount_out', 'captain_out', 'waste') THEN quantity ELSE 0 END), 0) AS balance,
        COUNT(*) as c
      FROM item_stock_movements
      WHERE item_id IN (${placeholders})
      GROUP BY item_id
    `).all(...ids) as { item_id: number; balance: number; c: number }[]
    const byId = new Map(balances.map(b => [b.item_id, b]))
    for (const mealId of mealIds) {
      const raws = links.get(mealId) ?? []
      if (raws.length > 0) {
        let min: number | null = null
        for (const rawId of raws) {
          const b = byId.get(rawId)
          if (!b) continue
          min = min == null ? b.balance : Math.min(min, b.balance)
        }
        out[mealId] = min
      } else {
        const b = byId.get(mealId)
        out[mealId] = b ? b.balance : null
      }
    }
    return out
  },

  getMovements(itemId: number, limit = 20) {
    const db = getDb()
    ensureTable(db)
    return db.prepare(`
      SELECT * FROM item_stock_movements
      WHERE item_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `).all(itemId, limit)
  },
}
