import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migrations/001_initial'
import { runSalesExtrasMigration } from '../migrations/002_sales_extras'
import { runDebtsMigration } from '../migrations/004_debts_payment_allocations'
import { runWasteMigration } from '../migrations/006_waste_table'
import { runRemovePaymentIdMigration } from '../migrations/014_debt_allocations_cleanup'
import { runDebtWriteOffsMigration } from '../migrations/017_debt_write_offs'
import { runCategoriesMigration } from '../migrations/007_categories'
import { runPerLineCaptainMigration } from '../migrations/026_per_line_captain'
import { runSetupMigration } from '../migrations/012_setup'
import { runYieldQtyPerSaleMigration } from '../migrations/027_yield_qty_per_sale'
import { runKitchenStatusMigration } from '../migrations/029_kitchen_status'

let db: Database.Database
let catId = 0

vi.mock('../index', () => ({
  getDb: () => db,
}))

import { salesRepo } from '../repositories/salesRepo'

function seedItem(name: string, price: number): number {
  return Number(db.prepare(
    `INSERT INTO menu_items (category_id, name, selling_price_cents, cost_price_cents, out_of_stock, active)
     VALUES (?, ?, ?, 0, 0, 1)`
  ).run(catId, name, price).lastInsertRowid)
}

describe('per-line captain sale creation', () => {
  beforeAll(() => {
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    db.prepare(`INSERT INTO users (name, role, pin_hash) VALUES ('User', 'cashier', '1234')`).run()
    runSalesExtrasMigration(db)
    runDebtsMigration(db)
    runWasteMigration(db)
    runRemovePaymentIdMigration(db)
    runDebtWriteOffsMigration(db)
    runCategoriesMigration(db)
    runSetupMigration(db)
    runPerLineCaptainMigration(db)
    runYieldQtyPerSaleMigration(db)
    runKitchenStatusMigration(db)
    catId = (db.prepare(`SELECT id FROM categories WHERE name = 'Proteins'`).get() as { id: number }).id
  })

  afterAll(() => db.close())

  test('captain line stores menu value with zero total and flag; payable math untouched', () => {
    const chicken = seedItem('Chicken', 10000)
    const chips = seedItem('Chips', 3000)
    const saleId = salesRepo.create({
      subtotal_cents: 3000,
      discount_cents: 0,
      total_cents: 3000,
      debt_cents: 0,
      payment_method: 'cash',
      till_session_id: null,
      created_by: 1,
      items: [
        { item_id: chicken, price_cents: 0, quantity: 1, is_captain: true },
        { item_id: chips, price_cents: 3000, quantity: 1 },
      ],
    })
    const rows = db.prepare(
      'SELECT item_id, unit_price_cents, quantity, line_total_cents, is_captain FROM sale_items WHERE sale_id = ? ORDER BY id'
    ).all(saleId) as { item_id: number; unit_price_cents: number; quantity: number; line_total_cents: number; is_captain: number }[]
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ unit_price_cents: 10000, quantity: 1, line_total_cents: 0, is_captain: 1 })
    expect(rows[1]).toMatchObject({ unit_price_cents: 3000, quantity: 1, line_total_cents: 3000, is_captain: 0 })
    const sale = db.prepare('SELECT total_cents, debt_cents, status FROM sales WHERE id = ?').get(saleId) as { total_cents: number; debt_cents: number; status: string }
    expect(sale).toMatchObject({ total_cents: 3000, debt_cents: 0, status: 'completed' })
  })

  test('captain lines consume stock as captain_out, paid lines as sale_out', () => {
    const chicken = seedItem('Chicken2', 10000)
    const chips = seedItem('Chips2', 3000)
    const saleId = salesRepo.create({
      subtotal_cents: 3000,
      discount_cents: 0,
      total_cents: 3000,
      debt_cents: 0,
      payment_method: 'cash',
      till_session_id: null,
      created_by: 1,
      items: [
        { item_id: chicken, price_cents: 0, quantity: 2, is_captain: true },
        { item_id: chips, price_cents: 3000, quantity: 1 },
      ],
    })
    const moves = db.prepare(
      'SELECT item_id, movement_type, quantity FROM item_stock_movements WHERE reference_table = ? AND reference_id = ? ORDER BY id'
    ).all('sales', saleId) as { item_id: number; movement_type: string; quantity: number }[]
    expect(moves).toHaveLength(2)
    expect(moves[0]).toMatchObject({ item_id: chicken, movement_type: 'captain_out', quantity: 2 })
    expect(moves[1]).toMatchObject({ item_id: chips, movement_type: 'sale_out', quantity: 1 })
  })
})
