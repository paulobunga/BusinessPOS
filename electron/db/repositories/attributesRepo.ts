import { getDb } from '../index'
import type { AttributeDef, AttributeValue } from '../../../shared/types'

interface AttributeDefInput {
  id?: number
  category_id: number | null
  name: string
  type: 'text' | 'number' | 'boolean'
  sort_order?: number
}

export const attributesRepo = {
  list(categoryId?: number | null): AttributeDef[] {
    const db = getDb()
    if (categoryId == null) {
      return db.prepare('SELECT * FROM attribute_defs ORDER BY sort_order, name').all() as AttributeDef[]
    }
    return db.prepare('SELECT * FROM attribute_defs WHERE category_id IS NULL OR category_id = ? ORDER BY sort_order, name')
      .all(categoryId) as AttributeDef[]
  },

  upsert(input: AttributeDefInput): AttributeDef {
    const db = getDb()
    if (input.id) {
      db.prepare('UPDATE attribute_defs SET category_id=?, name=?, type=?, sort_order=? WHERE id=?')
        .run(input.category_id, input.name, input.type, input.sort_order ?? 0, input.id)
      return db.prepare('SELECT * FROM attribute_defs WHERE id = ?').get(input.id) as AttributeDef
    }
    const result = db.prepare('INSERT INTO attribute_defs (category_id, name, type, sort_order) VALUES (?, ?, ?, ?)')
      .run(input.category_id, input.name, input.type, input.sort_order ?? 0)
    return db.prepare('SELECT * FROM attribute_defs WHERE id = ?').get(result.lastInsertRowid) as AttributeDef
  },

  del(id: number): void {
    const db = getDb()
    db.prepare('DELETE FROM item_attribute_values WHERE attr_def_id = ?').run(id)
    db.prepare('DELETE FROM attribute_defs WHERE id = ?').run(id)
  },

  saveValues(itemId: number, values: Array<{ attr_def_id: number; value_text?: string; value_number?: number; value_boolean?: boolean }>): void {
    const db = getDb()
    for (const v of values) {
      const def = db.prepare('SELECT * FROM attribute_defs WHERE id = ?').get(v.attr_def_id) as AttributeDef | undefined
      if (!def) throw new Error(`Attribute def ${v.attr_def_id} not found`)
      if (def.type === 'text' && v.value_text == null) throw new Error('Value type mismatch for attribute ' + def.name)
      if (def.type === 'number' && v.value_number == null) throw new Error('Value type mismatch for attribute ' + def.name)
      if (def.type === 'boolean' && v.value_boolean == null) throw new Error('Value type mismatch for attribute ' + def.name)
      db.prepare(`
        INSERT INTO item_attribute_values (item_id, attr_def_id, value_text, value_number, value_boolean)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(item_id, attr_def_id) DO UPDATE SET
          value_text = excluded.value_text,
          value_number = excluded.value_number,
          value_boolean = excluded.value_boolean
      `).run(itemId, v.attr_def_id, v.value_text ?? null, v.value_number ?? null, v.value_boolean ?? null)
    }
  },

  getValuesForItem(itemId: number): AttributeValue[] {
    return getDb().prepare(`
      SELECT v.attr_def_id, d.name, d.type, v.value_text, v.value_number, v.value_boolean
      FROM item_attribute_values v
      JOIN attribute_defs d ON d.id = v.attr_def_id
      WHERE v.item_id = ?
    `).all(itemId) as AttributeValue[]
  }
}
