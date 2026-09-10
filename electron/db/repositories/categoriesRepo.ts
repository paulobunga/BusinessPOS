import { getDb } from '../index'
import type { Category } from '../../../shared/types'

export const categoriesRepo = {
  list(): Category[] {
    return getDb().prepare('SELECT * FROM categories ORDER BY sort_order, name').all() as Category[]
  },

  listActive(): Category[] {
    return getDb().prepare('SELECT * FROM categories WHERE active = 1 ORDER BY sort_order, name').all() as Category[]
  },

  upsert(data: { id?: number; name: string; kind?: 'priced' | 'free'; sort_order?: number; active?: number }): Category {
    const db = getDb()
    if (data.id) {
      db.prepare('UPDATE categories SET name=?, kind=?, sort_order=?, active=? WHERE id=?')
        .run(data.name, data.kind ?? 'priced', data.sort_order ?? 0, data.active ?? 1, data.id)
      return db.prepare('SELECT * FROM categories WHERE id = ?').get(data.id) as Category
    }
    try {
      const result = db.prepare('INSERT INTO categories (name, kind, sort_order, active) VALUES (?, ?, ?, ?)')
        .run(data.name, data.kind ?? 'priced', data.sort_order ?? 0, data.active ?? 1)
      return db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid) as Category
    } catch (e: any) {
      if (e.message?.includes('UNIQUE constraint failed')) {
        throw new Error('A category with this name already exists')
      }
      throw e
    }
  },

  del(id: number): void {
    const db = getDb()
    const count = db.prepare('SELECT COUNT(*) as c FROM menu_items WHERE category_id = ?').get(id) as { c: number }
    if (count.c > 0) {
      db.prepare('UPDATE categories SET active = 0 WHERE id = ?').run(id)
    } else {
      db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    }
  },

  seedIfEmpty(): void {
    const count = getDb().prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number }
    if (count.c === 0) {
      this.upsert({ name: 'Proteins', kind: 'priced', sort_order: 0 })
      this.upsert({ name: 'Starches', kind: 'free', sort_order: 1 })
    }
  }
}
