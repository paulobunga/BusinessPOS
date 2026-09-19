import { describe, test, expect } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migrations/001_initial'
import { runKitchenStatusMigration } from '../migrations/029_kitchen_status'
describe('kitchen_status migration', () => {
  test('adds column with default new and CHECK', () => {
    const db = new Database(':memory:')
    runMigrations(db)
    runKitchenStatusMigration(db)
    const cols = db.prepare("PRAGMA table_info(sales)").all() as { name: string }[]
    expect(cols.some(c => c.name === 'kitchen_status')).toBe(true)
    db.exec(`INSERT INTO sales (status, subtotal_cents, total_cents) VALUES ('completed', 100, 100)`)
    const row = db.prepare('SELECT kitchen_status FROM sales').get() as { kitchen_status: string }
    expect(row.kitchen_status).toBe('new')
    expect(() => db.exec(`UPDATE sales SET kitchen_status='foo' WHERE id=1`)).toThrow()
  })
  test('is idempotent', () => {
    const db = new Database(':memory:')
    runMigrations(db)
    runKitchenStatusMigration(db)
    expect(() => runKitchenStatusMigration(db)).not.toThrow()
    const applied = db.prepare('SELECT version FROM schema_migrations WHERE version = 29').all()
    expect(applied).toHaveLength(1)
  })
})
