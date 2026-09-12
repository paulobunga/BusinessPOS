import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/migrations/001_initial'
import { runSalesExtrasMigration } from '../db/migrations/002_sales_extras'
import { runExpensesMigration } from '../db/migrations/003_expenses_add_date_mpesa'
import { runDebtsMigration } from '../db/migrations/004_debts_payment_allocations'
import { runReimbursementsMigration } from '../db/migrations/005_reimbursements_add_columns'
import { runWasteMigration } from '../db/migrations/006_waste_table'
import { runCategoriesMigration } from '../db/migrations/007_categories'

let db: Database.Database

vi.mock('../db/index', () => ({
  getDb: () => db,
}))

import { categoriesRepo } from '../db/repositories/categoriesRepo'
import { itemsRepo } from '../db/repositories/itemsRepo'
import { usersRepo } from '../db/repositories/usersRepo'
import { tillRepo } from '../db/repositories/tillRepo'
import { salesRepo } from '../db/repositories/salesRepo'
import { expensesRepo } from '../db/repositories/expensesRepo'
import { purchasesRepo } from '../db/repositories/purchasesRepo'
import { reportsRepo } from '../db/repositories/reportsRepo'

describe('Full day at the restaurant (integration)', () => {
  const today = new Date().toISOString().slice(0, 10)
  const reportDate = new Date(today + 'T00:00:00').toISOString().slice(0, 10)
  let userId: number
  let tillId: number
  let goat: any
  let chicken: any
  let bananaId: number

  beforeAll(() => {
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    runSalesExtrasMigration(db)
    runExpensesMigration(db)
    runDebtsMigration(db)
    runReimbursementsMigration(db)
    runWasteMigration(db)
    runCategoriesMigration(db)

    const user = usersRepo.create('Test Manager', 'manager', '1234')
    userId = user.id as number

    const meatCat = categoriesRepo.upsert({ name: 'Test Meats', kind: 'priced', sort_order: 0 })
    const sideCat = categoriesRepo.upsert({ name: 'Test Sides', kind: 'free', sort_order: 1 })

    goat = itemsRepo.upsert({ category_id: meatCat.id, name: 'Goat Meat', selling_price_cents: 10000, cost_price_cents: 6000 })
    chicken = itemsRepo.upsert({ category_id: meatCat.id, name: 'Chicken', selling_price_cents: 8000, cost_price_cents: 5000 })
    const banana = itemsRepo.upsert({ category_id: sideCat.id, name: 'Banana' })
    bananaId = banana.id
  })

  afterAll(() => {
    db.close()
  })

  test('1. Open till with 0 float', () => {
    tillId = tillRepo.open(0) as number
    expect(tillId).toBeGreaterThan(0)
    const current = tillRepo.current()
    expect(current).not.toBeNull()
    expect(current!.opening_float_cents).toBe(0)
  })

  test('2. Create a cash sale: 2 goat meat + 1 chicken with banana add-on', () => {
    const saleId = salesRepo.create({
      subtotal_cents: 10000 + 10000 + 8000,
      discount_cents: 0,
      total_cents: 28000,
      debt_cents: 0,
      payment_method: 'cash',
      till_session_id: tillId,
      created_by: userId,
      items: [
        { item_id: goat.id, free_item_id: bananaId, price_cents: 10000 },
        { item_id: goat.id, free_item_id: bananaId, price_cents: 10000 },
        { item_id: chicken.id, free_item_id: bananaId, price_cents: 8000 },
      ],
    })
    expect(saleId).toBeGreaterThan(0)

    db.prepare("UPDATE sales SET created_at = ? WHERE id = ?").run(reportDate + ' 12:00:00', saleId)

    const sale = salesRepo.getById(saleId as number) as any
    expect(sale.status).toBe('completed')
    expect(sale.total_cents).toBe(28000)
    expect(sale.till_session_id).toBe(tillId)
  })

  test('3. Record a food purchase', () => {
    const purchase = purchasesRepo.recordPurchase(goat.id, 5, 30000, reportDate, userId) as any
    expect(purchase.id).toBeGreaterThan(0)
    expect(purchase.cost_cents).toBe(30000)
    expect(purchase.quantity_kg).toBe(5)
  })

  test('4. Record an expense paid from till', () => {
    const expenseId = expensesRepo.create({
      till_session_id: tillId,
      date: reportDate,
      category: 'Transport',
      description: 'Delivery fare',
      amount_cents: 5000,
      payment_source: 'till',
      created_by: userId,
    })
    expect(expenseId).toBeGreaterThan(0)
  })

  test('5. Till countCash matches expected formula', () => {
    const count = tillRepo.countCash()
    expect(count).not.toBeNull()
    expect(count!.openingFloatCents).toBe(0)
    expect(count!.cashSalesCents).toBe(28000)
    expect(count!.tillExpensesCents).toBe(5000)
    expect(count!.expectedClosingCents).toBe(0 + 28000 - 5000)
  })

  test('6. Close till with expected amount', () => {
    const expected = 0 + 28000 - 5000
    tillRepo.close(tillId, expected)
    const current = tillRepo.current()
    expect(current).toBeNull()
  })

  test('7. Daily report matches all figures', () => {
    const reports = reportsRepo.getDaily(today, today)
    expect(reports).toHaveLength(1)
    const r = reports[0]
    expect(r.sales_revenue_cents).toBe(28000)
    expect(r.food_purchase_cents).toBe(30000)
    expect(r.expense_cents).toBe(5000)
    expect(r.net_profit_cents).toBe(28000 - 30000 - 5000)
  })

  test('8. Item performance returns correct data', () => {
    const perf = reportsRepo.getItemPerformance(reportDate, reportDate)
    expect(perf.length).toBeGreaterThan(0)
    const goatRow = perf.find((p: any) => p.item_name === 'Goat Meat')
    expect(goatRow).toBeDefined()
    expect(goatRow!.portions_sold).toBe(2)
    expect(goatRow!.revenue_cents).toBe(20000)
    expect(goatRow!.category_name).toBe('Test Meats')
  })

  test('9. Sale with quantity>1 writes a single line with correct totals', () => {
    const saleId = salesRepo.create({
      subtotal_cents: 24000,
      discount_cents: 0,
      total_cents: 24000,
      debt_cents: 0,
      payment_method: 'cash',
      created_by: userId,
      items: [{ item_id: chicken.id, price_cents: 8000, quantity: 3 }],
    })
    expect(saleId).toBeGreaterThan(0)
    const rows = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId) as any[]
    expect(rows).toHaveLength(1)
    expect(rows[0].quantity).toBe(3)
    expect(rows[0].unit_price_cents).toBe(8000)
    expect(rows[0].line_total_cents).toBe(24000)
    expect(rows[0].name_snapshot).toBe('Chicken')
  })
})
