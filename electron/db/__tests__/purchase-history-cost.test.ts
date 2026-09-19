import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migrations/001_initial'
import { runSalesExtrasMigration } from '../migrations/002_sales_extras'
import { runWasteMigration } from '../migrations/006_waste_table'
import { runExpensesMigration } from '../migrations/003_expenses_add_date_mpesa'
import { runDebtsMigration } from '../migrations/004_debts_payment_allocations'
import { runReimbursementsMigration } from '../migrations/005_reimbursements_add_columns'
import { runCategoriesMigration } from '../migrations/007_categories'
import { runSetupMigration } from '../migrations/012_setup'
import { runPurchaseYieldMigration } from '../migrations/010_purchase_yield'
import { runPurchaseYieldsMigration } from '../migrations/011_purchase_yields'
import { runTotalYieldMigration } from '../migrations/022_total_yield'
import { runItemStockMovementsMigration } from '../migrations/024_item_stock_movements'
import { runPerLineCaptainMigration } from '../migrations/026_per_line_captain'
import { runDebtWriteOffsMigration } from '../migrations/017_debt_write_offs'
import { runYieldQtyPerSaleMigration } from '../migrations/027_yield_qty_per_sale'
import { runItemPurchaseNotesMigration } from '../migrations/028_item_purchase_notes'
import { runKitchenStatusMigration } from '../migrations/029_kitchen_status'

let db: Database.Database
let catId = 0

vi.mock('../index', () => ({
  getDb: () => db,
}))

import { salesRepo } from '../repositories/salesRepo'
import { purchasesRepo } from '../repositories/purchasesRepo'
import { reportsRepo } from '../repositories/reportsRepo'

function seedItem(name: string, price: number): number {
  return Number(db.prepare(
    `INSERT INTO menu_items (category_id, name, selling_price_cents, cost_price_cents, out_of_stock, active)
     VALUES (?, ?, ?, 0, 0, 1)`
  ).run(catId, name, price).lastInsertRowid)
}

function sellOn(itemId: number, price: number, date: string): number {
  const id = salesRepo.create({
    subtotal_cents: price,
    discount_cents: 0,
    total_cents: price,
    debt_cents: 0,
    payment_method: 'cash',
    till_session_id: null,
    created_by: 1,
    items: [{ item_id: itemId, price_cents: price }],
  })
  db.prepare('UPDATE sales SET created_at = ? WHERE id = ?').run(`${date} 10:00:00`, id)
  return id
}

describe('purchase notes and historical costing', () => {
  beforeAll(() => {
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    db.prepare(`INSERT INTO users (name, role, pin_hash) VALUES ('User', 'cashier', '1234')`).run()
    runSalesExtrasMigration(db)
    runExpensesMigration(db)
    runDebtsMigration(db)
    runReimbursementsMigration(db)
    runWasteMigration(db)
    runCategoriesMigration(db)
    runSetupMigration(db)
    runPurchaseYieldMigration(db)
    runPurchaseYieldsMigration(db)
    runTotalYieldMigration(db)
    runItemStockMovementsMigration(db)
    runPerLineCaptainMigration(db)
    runDebtWriteOffsMigration(db)
    runYieldQtyPerSaleMigration(db)
    runItemPurchaseNotesMigration(db)
    runKitchenStatusMigration(db)
    catId = (db.prepare(`SELECT id FROM categories WHERE kind = 'priced' LIMIT 1`).get() as { id: number }).id
  })

  afterAll(() => db.close())

  test('recordPurchase stores brand notes and lists them back', () => {
    const flour = seedItem('FlourNote', 0)
    const p = purchasesRepo.recordPurchase(flour, 1, 8000, '2026-09-18', 1, 20, { unit: 'pack', notes: 'Supreme 2KG' }) as any
    expect(p.notes).toBe('Supreme 2KG')
    const rows = purchasesRepo.getByDate('2026-09-18') as any[]
    expect(rows.find(r => r.id === p.id)?.notes).toBe('Supreme 2KG')
  })

  test('item performance costs each sale at the latest purchase on or before its date', () => {
    const beans = seedItem('BeansHist', 5000)
    purchasesRepo.recordPurchase(beans, 1, 7000, '2026-09-18', 1, 10, { unit: 'pack' })
    sellOn(beans, 5000, '2026-09-18')
    // Price changes the next day; live cost becomes 8000.
    purchasesRepo.recordPurchase(beans, 1, 8000, '2026-09-19', 1, 10, { unit: 'pack', notes: 'Premium' })
    sellOn(beans, 5000, '2026-09-19')

    const rows = reportsRepo.getItemPerformance('2026-09-18', '2026-09-19')
    const row = rows.find(r => r.item_name === 'BeansHist')!
    expect(row.quantity_sold).toBe(2)
    // 7000 + 8000, NOT 8000 + 8000.
    expect(row.cost_cents).toBe(15000)
    expect(row.profit_cents).toBe(10000 - 15000)
  })

  test('item performance falls back to live cost when no purchase exists', () => {
    const tea = seedItem('TeaNoBuy', 2000)
    db.prepare('UPDATE menu_items SET cost_price_cents = 500 WHERE id = ?').run(tea)
    sellOn(tea, 2000, '2026-09-19')

    const rows = reportsRepo.getItemPerformance('2026-09-19', '2026-09-19')
    const row = rows.find(r => r.item_name === 'TeaNoBuy')!
    expect(row.cost_cents).toBe(500)
  })

  test('daily P&L counts food buys once: purchases as food, Supplies excluded from expenses', () => {
    const stock = seedItem('BackfillBean', 0)
    db.prepare(`INSERT INTO expenses (date, category, description, amount_cents, payment_source) VALUES (?, ?, ?, ?, ?)`).run(
      '2026-09-20', 'Supplies', 'BackfillBean', 3000, 'till')
    db.prepare(`INSERT INTO expenses (date, category, description, amount_cents, payment_source) VALUES (?, ?, ?, ?, ?)`).run(
      '2026-09-20', 'Transport', 'Trip', 2000, 'till')
    db.prepare(`INSERT INTO item_purchases (item_id, purchase_date, quantity_kg, cost_cents, total_yield, created_by, unit) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      stock, '2026-09-20', 1, 3000, 0, 1, 'lot')

    const [day] = reportsRepo.getDaily('2026-09-20', '2026-09-20')
    expect(day.food_purchase_cents).toBe(3000)
    expect(day.expense_cents).toBe(2000)
    expect(day.net_profit_cents).toBe(0 - 3000 - 0 - 2000 - 0)
  })
})
