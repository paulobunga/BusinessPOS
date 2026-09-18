import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migrations/001_initial'
import { runSalesExtrasMigration } from '../migrations/002_sales_extras'
import { runDebtsMigration } from '../migrations/004_debts_payment_allocations'
import { runWasteMigration } from '../migrations/006_waste_table'
import { runCategoriesMigration } from '../migrations/007_categories'
import { runRemovePaymentIdMigration } from '../migrations/014_debt_allocations_cleanup'
import { runDebtWriteOffsMigration } from '../migrations/017_debt_write_offs'

let db: Database.Database

vi.mock('../index', () => ({
  getDb: () => db,
}))

import { salesRepo } from '../repositories/salesRepo'

describe('sales history (list/get/void)', () => {
  let itemId: number

  beforeAll(() => {
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    db.prepare(`INSERT INTO users (name, role, pin_hash) VALUES ('User', 'cashier', '1234')`).run()
    runSalesExtrasMigration(db)
    runDebtsMigration(db)
    runWasteMigration(db)
    runCategoriesMigration(db)
    runRemovePaymentIdMigration(db)
    runDebtWriteOffsMigration(db)

    const catId = Number(db.prepare(`INSERT INTO categories (name, kind, sort_order) VALUES ('Food', 'priced', 0)`).run().lastInsertRowid)
    itemId = Number(
      db.prepare(`INSERT INTO menu_items (category_id, name, selling_price_cents) VALUES (?, 'Pilau', 5000)`).run(catId).lastInsertRowid
    )
  })

  afterAll(() => db.close())

  test('list returns sales with items, newest first, with filters', () => {
    const a = salesRepo.create({
      subtotal_cents: 10000,
      discount_cents: 0,
      total_cents: 10000,
      debt_cents: 0,
      payment_method: 'cash',
      till_session_id: null,
      created_by: 1,
      items: [{ item_id: itemId, price_cents: 5000, quantity: 2 }],
    })
    db.prepare('UPDATE sales SET created_at = ? WHERE id = ?').run('2026-05-01 10:00:00', a)

    const b = salesRepo.create({
      customer_name: 'Sara',
      subtotal_cents: 5000,
      discount_cents: 0,
      total_cents: 5000,
      debt_cents: 5000,
      payment_method: 'debt',
      till_session_id: null,
      created_by: 1,
      items: [{ item_id: itemId, price_cents: 5000 }],
    })
    db.prepare('UPDATE sales SET created_at = ? WHERE id = ?').run('2026-05-02 10:00:00', b)

    const all = salesRepo.list({})
    expect(all).toHaveLength(2)
    expect(all[0].id).toBe(b)
    expect(all[0].items).toHaveLength(1)
    expect(all[0].items[0].quantity).toBe(1)
    expect(all[0].items[0].name_snapshot).toBe('Pilau')

    expect(salesRepo.list({ status: 'completed' }).map(s => s.id)).toEqual([a])
    expect(salesRepo.list({ date_from: '2026-05-02', date_to: '2026-05-02' }).map(s => s.id)).toEqual([b])
    expect(salesRepo.list({ status: 'voided' })).toHaveLength(0)
  })

  test('getWithItems returns one sale with lines', () => {
    const [first] = salesRepo.list({})
    const one = salesRepo.getWithItems(first.id)
    expect(one.items.length).toBeGreaterThan(0)
    expect(() => salesRepo.getWithItems(999999)).toThrow()
  })

  test('voidSale marks voided, requires reason, blocks double void', () => {
    const [first] = salesRepo.list({ status: 'completed' })
    expect(() => salesRepo.voidSale(first.id, '   ')).toThrow()
    salesRepo.voidSale(first.id, 'Entered twice')
    const row = db.prepare('SELECT status, void_reason FROM sales WHERE id = ?').get(first.id) as {
      status: string
      void_reason: string
    }
    expect(row.status).toBe('voided')
    expect(row.void_reason).toBe('Entered twice')
    expect(() => salesRepo.voidSale(first.id, 'again')).toThrow()
    expect(salesRepo.list({ status: 'voided' }).map(s => s.id)).toContain(first.id)
    expect(() => salesRepo.voidSale(999999, 'x')).toThrow()
  })
})
