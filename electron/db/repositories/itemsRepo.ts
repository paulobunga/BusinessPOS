import { getDb } from '../index'
import type { MenuItemWithCategory } from '../../../shared/types'

function joinItemRow(row: any): MenuItemWithCategory {
  const attrValues = getDb().prepare(`
    SELECT v.attr_def_id, d.name, d.type, v.value_text, v.value_number, v.value_boolean
    FROM item_attribute_values v
    JOIN attribute_defs d ON d.id = v.attr_def_id
    WHERE v.item_id = ?
  `).all(row.id) as MenuItemWithCategory['attribute_values']
  return { ...row, attribute_values: attrValues }
}

export const itemsRepo = {
  listActive(): MenuItemWithCategory[] {
    const rows = getDb().prepare(`
      SELECT mi.*, c.name AS category_name, c.kind AS category_kind
      FROM menu_items mi
      JOIN categories c ON c.id = mi.category_id
      WHERE mi.active = 1
      ORDER BY c.sort_order, c.name, mi.name
    `).all() as any[]
    return rows.map(joinItemRow)
  },

  listAll(): MenuItemWithCategory[] {
    const rows = getDb().prepare(`
      SELECT mi.*, c.name AS category_name, c.kind AS category_kind
      FROM menu_items mi
      JOIN categories c ON c.id = mi.category_id
      ORDER BY mi.active DESC, c.sort_order, c.name, mi.name
    `).all() as any[]
    return rows.map(joinItemRow)
  },

  listByCategory(categoryId: number, activeOnly?: boolean): MenuItemWithCategory[] {
    const where = activeOnly ? 'AND mi.active = 1' : ''
    const rows = getDb().prepare(`
      SELECT mi.*, c.name AS category_name, c.kind AS category_kind
      FROM menu_items mi
      JOIN categories c ON c.id = mi.category_id
      WHERE mi.category_id = ? ${where}
      ORDER BY mi.name
    `).all(categoryId) as any[]
    return rows.map(joinItemRow)
  },

  listByKind(kind: 'priced' | 'free', activeOnly?: boolean): MenuItemWithCategory[] {
    const where = activeOnly ? 'AND mi.active = 1' : ''
    const rows = getDb().prepare(`
      SELECT mi.*, c.name AS category_name, c.kind AS category_kind
      FROM menu_items mi
      JOIN categories c ON c.id = mi.category_id
      WHERE c.kind = ? ${where}
      ORDER BY c.sort_order, mi.name
    `).all(kind) as any[]
    return rows.map(joinItemRow)
  },

  getById(id: number): MenuItemWithCategory | undefined {
    const row = getDb().prepare(`
      SELECT mi.*, c.name AS category_name, c.kind AS category_kind
      FROM menu_items mi
      JOIN categories c ON c.id = mi.category_id
      WHERE mi.id = ?
    `).get(id) as any
    return row ? joinItemRow(row) : undefined
  },

  upsert(data: { id?: number; category_id: number; name: string; selling_price_cents?: number; cost_price_cents?: number; out_of_stock?: number; active?: number; purchase_unit?: string }): MenuItemWithCategory {
    const db = getDb()
    if (data.id) {
      const existing = db.prepare('SELECT category_id, purchase_unit FROM menu_items WHERE id = ?').get(data.id) as { category_id: number; purchase_unit?: string } | undefined
      if (existing && existing.category_id !== data.category_id) {
        const defsToDelete = db.prepare(`
          SELECT v.id FROM item_attribute_values v
          JOIN attribute_defs d ON d.id = v.attr_def_id
          WHERE v.item_id = ? AND d.category_id IS NOT NULL AND d.category_id != ?
        `).all(data.id, data.category_id) as { id: number }[]
        if (defsToDelete.length > 0) {
          const ids = defsToDelete.map(d => d.id)
          db.prepare(`DELETE FROM item_attribute_values WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids)
        }
      }
      db.prepare('UPDATE menu_items SET category_id=?, name=?, selling_price_cents=?, cost_price_cents=?, purchase_unit=?, out_of_stock=?, active=? WHERE id=?')
        .run(data.category_id, data.name, data.selling_price_cents ?? 0, data.cost_price_cents ?? 0, data.purchase_unit ?? existing?.purchase_unit ?? 'kg', data.out_of_stock ?? 0, data.active ?? 1, data.id)
      return this.getById(data.id)!
    }
    const result = db.prepare('INSERT INTO menu_items (category_id, name, selling_price_cents, cost_price_cents, purchase_unit, out_of_stock, active) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(data.category_id, data.name, data.selling_price_cents ?? 0, data.cost_price_cents ?? 0, data.purchase_unit ?? 'kg', data.out_of_stock ?? 0, data.active ?? 1)
    return this.getById(result.lastInsertRowid as number)!
  },

  setOutOfStock(id: number, outOfStock: boolean): void {
    getDb().prepare('UPDATE menu_items SET out_of_stock = ? WHERE id = ?').run(outOfStock ? 1 : 0, id)
  },

  del(id: number): void {
    const db = getDb()
    const hasStock = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'item_stock_movements'").get()
    const refCount = (db.prepare("SELECT COUNT(*) as c FROM sale_items WHERE item_id = ? OR free_item_id = ?").get(id, id) as { c: number }).c
      + (db.prepare('SELECT COUNT(*) as c FROM item_purchases WHERE item_id = ?').get(id) as { c: number }).c
      + (db.prepare('SELECT COUNT(*) as c FROM waste WHERE item_id = ?').get(id) as { c: number }).c
      + (db.prepare('SELECT COUNT(*) as c FROM cook_events WHERE item_id = ?').get(id) as { c: number }).c
      + (hasStock ? (db.prepare('SELECT COUNT(*) as c FROM item_stock_movements WHERE item_id = ?').get(id) as { c: number }).c : 0)
    if (refCount === 0) {
      db.prepare('DELETE FROM item_attribute_values WHERE item_id = ?').run(id)
      db.prepare('DELETE FROM menu_items WHERE id = ?').run(id)
    } else {
      db.prepare('UPDATE menu_items SET active = 0 WHERE id = ?').run(id)
    }
  },

  seed(): void {
    const count = getDb().prepare('SELECT COUNT(*) as c FROM menu_items').get() as { c: number }
    if (count.c === 0) {
      const db = getDb()
      const catProteins = db.prepare("SELECT id FROM categories WHERE name = 'Proteins'").get() as { id: number } | undefined
      const catStarches = db.prepare("SELECT id FROM categories WHERE name = 'Starches'").get() as { id: number } | undefined
      if (!catProteins || !catStarches) return
      const insert = db.prepare('INSERT INTO menu_items (category_id, name, selling_price_cents, cost_price_cents) VALUES (?, ?, ?, ?)')
      insert.run(catProteins.id, 'Goat Meat', 10000, 6000)
      insert.run(catProteins.id, 'Chicken', 8000, 5000)
      insert.run(catProteins.id, 'Fish', 7000, 4000)
      const insertFree = db.prepare('INSERT INTO menu_items (category_id, name, selling_price_cents, cost_price_cents) VALUES (?, ?, ?, ?)')
      insertFree.run(catStarches.id, 'Banana', 0, 0)
      insertFree.run(catStarches.id, 'Cassava', 0, 0)
      insertFree.run(catStarches.id, 'Plantain', 0, 0)
      insertFree.run(catStarches.id, 'Irish Potatoes', 0, 0)
    }
  }
}
