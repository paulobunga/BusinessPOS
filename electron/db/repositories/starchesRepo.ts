import { getDb } from '../index'

export const starchesRepo = {
  list() {
    return getDb().prepare('SELECT * FROM starches WHERE active = 1 ORDER BY name').all()
  },
  listAll() {
    return getDb().prepare('SELECT * FROM starches ORDER BY active DESC, name').all()
  },
  upsert(data: { id?: number; name: string; active?: number }) {
    if (data.id) {
      getDb().prepare('UPDATE starches SET name=?, active=? WHERE id=?').run(data.name, data.active ?? 1, data.id)
      return getDb().prepare('SELECT * FROM starches WHERE id = ?').get(data.id)
    }
    const result = getDb().prepare('INSERT INTO starches (name) VALUES (?)').run(data.name)
    return getDb().prepare('SELECT * FROM starches WHERE id = ?').get(result.lastInsertRowid)
  },
  delete(id: number) {
    const used = getDb().prepare('SELECT COUNT(*) as c FROM sales WHERE starch_id = ?').get(id) as { c: number }
    if (used.c > 0) {
      getDb().prepare('UPDATE starches SET active = 0 WHERE id = ?').run(id)
    } else {
      getDb().prepare('DELETE FROM starches WHERE id = ?').run(id)
    }
  },
  seed() {
    const count = getDb().prepare('SELECT COUNT(*) as c FROM starches').get() as { c: number }
    if (count.c === 0) {
      const insert = getDb().prepare('INSERT INTO starches (name) VALUES (?)')
      insert.run('Banana')
      insert.run('Cassava')
      insert.run('Plantain')
      insert.run('Irish Potatoes')
    }
  }
}
