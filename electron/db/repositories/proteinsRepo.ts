import { getDb } from '../index'

export const proteinsRepo = {
  list() {
    return getDb().prepare('SELECT * FROM proteins WHERE active = 1 ORDER BY category, name').all()
  },
  listAll() {
    return getDb().prepare('SELECT * FROM proteins ORDER BY active DESC, category, name').all()
  },
  getById(id: number) {
    return getDb().prepare('SELECT * FROM proteins WHERE id = ?').get(id)
  },
  upsert(data: { id?: number; name: string; selling_price_cents: number; cost_price_cents: number; category: string; active?: number }) {
    if (data.id) {
      getDb().prepare('UPDATE proteins SET name=?, selling_price_cents=?, cost_price_cents=?, category=?, active=? WHERE id=?')
        .run(data.name, data.selling_price_cents, data.cost_price_cents, data.category, data.active ?? 1, data.id)
      return this.getById(data.id)
    }
    const result = getDb().prepare('INSERT INTO proteins (name, selling_price_cents, cost_price_cents, category) VALUES (?, ?, ?, ?)')
      .run(data.name, data.selling_price_cents, data.cost_price_cents, data.category)
    return this.getById(result.lastInsertRowid as number)
  },
  setOutOfStock(id: number, outOfStock: boolean) {
    getDb().prepare('UPDATE proteins SET out_of_stock = ? WHERE id = ?').run(outOfStock ? 1 : 0, id)
  },
  seed() {
    const count = getDb().prepare('SELECT COUNT(*) as c FROM proteins').get() as { c: number }
    if (count.c === 0) {
      const insert = getDb().prepare('INSERT INTO proteins (name, selling_price_cents, cost_price_cents, category) VALUES (?, ?, ?, ?)')
      insert.run('Goat Meat', 10000, 6000, 'Goat')
      insert.run('Chicken', 8000, 5000, 'Chicken')
      insert.run('Fish', 7000, 4000, 'Fish')
    }
  }
}
