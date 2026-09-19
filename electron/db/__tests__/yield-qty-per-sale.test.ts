import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migrations/001_initial'
import { runSalesExtrasMigration } from '../migrations/002_sales_extras'
import { runWasteMigration } from '../migrations/006_waste_table'
import { runCategoriesMigration } from '../migrations/007_categories'
import { runSetupMigration } from '../migrations/012_setup'
import { runItemStockMovementsMigration } from '../migrations/024_item_stock_movements'
import { runPerLineCaptainMigration } from '../migrations/026_per_line_captain'
import { runYieldQtyPerSaleMigration } from '../migrations/027_yield_qty_per_sale'
import { runKitchenStatusMigration } from '../migrations/029_kitchen_status'

let db: Database.Database
let catId = 0

vi.mock('../index', () => ({
  getDb: () => db,
}))

import { salesRepo } from '../repositories/salesRepo'
import { stockRepo } from '../repositories/stockRepo'

function seedItem(name: string, price: number): number {
  return Number(db.prepare(
    `INSERT INTO menu_items (category_id, name, selling_price_cents, cost_price_cents, out_of_stock, active)
     VALUES (?, ?, ?, 0, 0, 1)`
  ).run(catId, name, price).lastInsertRowid)
}

function seedRaw(name: string): number {
  return Number(db.prepare(
    `INSERT INTO menu_items (category_id, name, selling_price_cents, cost_price_cents, out_of_stock, active)
     VALUES (?, ?, 0, 0, 0, 1)`
  ).run(catId, name).lastInsertRowid)
}

function sellMeal(itemId: number, price: number, qty = 1): number {
  return salesRepo.create({
    subtotal_cents: price * qty,
    discount_cents: 0,
    total_cents: price * qty,
    debt_cents: 0,
    payment_method: 'cash',
    till_session_id: null,
    created_by: 1,
    items: [{ item_id: itemId, price_cents: price, quantity: qty }],
  })
}

describe('yield qty_per_sale stock deduction', () => {
  beforeAll(() => {
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    db.prepare(`INSERT INTO users (name, role, pin_hash) VALUES ('User', 'cashier', '1234')`).run()
    runSalesExtrasMigration(db)
    runWasteMigration(db)
    runCategoriesMigration(db)
    runSetupMigration(db)
    runItemStockMovementsMigration(db)
    runPerLineCaptainMigration(db)
    runYieldQtyPerSaleMigration(db)
    runKitchenStatusMigration(db)
    catId = (db.prepare(`SELECT id FROM categories WHERE kind = 'priced' LIMIT 1`).get() as { id: number }).id
  })

  afterAll(() => db.close())

  test('migration adds qty_per_sale defaulting to 1', () => {
    const cols = db.prepare('PRAGMA table_info(item_yield_defaults)').all() as { name: string; dflt_value: unknown }[]
    const col = cols.find(c => c.name === 'qty_per_sale')
    expect(col).toBeDefined()
    expect(String(col!.dflt_value)).toBe('1')
  })

  test('meal with qty_per_sale=2 deducts two servings per plate', () => {
    const flour = seedRaw('Flour')
    const combo = seedItem('ChapatiBeef', 5000)
    db.prepare('INSERT INTO item_yield_defaults (raw_input_id, meal_id, portions, qty_per_sale) VALUES (?, ?, ?, ?)')
      .run(flour, combo, 20, 2)
    stockRepo.recordMovement({ item_id: flour, movement_type: 'purchase_in', quantity: 20, created_by: 1 })
    expect(stockRepo.getAvailability(combo)).toBe(20)

    sellMeal(combo, 5000)
    expect(stockRepo.getBalance(flour)).toBe(18)
    expect(stockRepo.getAvailability(combo)).toBe(18)
  })

  test('link without explicit qty_per_sale deducts one serving (legacy behavior)', () => {
    const chicken = seedRaw('ChickenRaw')
    const boiled = seedItem('Boiled', 10000)
    db.prepare('INSERT INTO item_yield_defaults (raw_input_id, meal_id, portions) VALUES (?, ?, ?)')
      .run(chicken, boiled, 4)
    stockRepo.recordMovement({ item_id: chicken, movement_type: 'purchase_in', quantity: 8, created_by: 1 })

    sellMeal(boiled, 10000)
    expect(stockRepo.getBalance(chicken)).toBe(7)
    expect(stockRepo.getAvailability(boiled)).toBe(7)
  })

  test('multi-raw meal availability is the min across raws and each deducts its own qty', () => {
    const beef = seedRaw('BeefRaw')
    const flour2 = seedRaw('Flour2')
    const combo2 = seedItem('ChapatiBeef2', 5000)
    db.prepare('INSERT INTO item_yield_defaults (raw_input_id, meal_id, portions, qty_per_sale) VALUES (?, ?, ?, ?)')
      .run(beef, combo2, 10, 1)
    db.prepare('INSERT INTO item_yield_defaults (raw_input_id, meal_id, portions, qty_per_sale) VALUES (?, ?, ?, ?)')
      .run(flour2, combo2, 20, 2)
    stockRepo.recordMovement({ item_id: beef, movement_type: 'purchase_in', quantity: 5, created_by: 1 })
    stockRepo.recordMovement({ item_id: flour2, movement_type: 'purchase_in', quantity: 20, created_by: 1 })
    expect(stockRepo.getAvailability(combo2)).toBe(5)

    sellMeal(combo2, 5000)
    expect(stockRepo.getBalance(beef)).toBe(4)
    expect(stockRepo.getBalance(flour2)).toBe(18)
    expect(stockRepo.getAvailability(combo2)).toBe(4)
  })
})
