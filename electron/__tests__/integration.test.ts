import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/migrations/001_initial'
import { runSalesExtrasMigration } from '../db/migrations/002_sales_extras'
import { runExpensesMigration } from '../db/migrations/003_expenses_add_date_mpesa'
import { runDebtsMigration } from '../db/migrations/004_debts_payment_allocations'
import { runReimbursementsMigration } from '../db/migrations/005_reimbursements_add_columns'
import { runWasteMigration } from '../db/migrations/006_waste_table'

let db: Database.Database

vi.mock('../db/index', () => ({
  getDb: () => db,
}))

import { proteinsRepo } from '../db/repositories/proteinsRepo'
import { starchesRepo } from '../db/repositories/starchesRepo'
import { usersRepo } from '../db/repositories/usersRepo'
import { tillRepo } from '../db/repositories/tillRepo'
import { salesRepo } from '../db/repositories/salesRepo'
import { expensesRepo } from '../db/repositories/expensesRepo'
import { inventoryRepo } from '../db/repositories/inventoryRepo'
import { reportsRepo } from '../db/repositories/reportsRepo'

describe('Full day at the restaurant (integration)', () => {
  const today = new Date().toISOString().slice(0, 10)
  // reportsRepo.getDaily processes dates through new Date(date+'T00:00:00').toISOString()
  // which may shift the date due to timezone. Compute the actual query date.
  const reportDate = new Date(today + 'T00:00:00').toISOString().slice(0, 10)
  let userId: number
  let tillId: number
  let goatProtein: any
  let chickenProtein: any
  let starchId: number

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

    const user = usersRepo.create('Test Manager', 'manager', '1234')
    userId = user.id as number

    starchesRepo.upsert({ name: 'Banana' })
    starchesRepo.upsert({ name: 'Cassava' })
    const starches = starchesRepo.listAll() as any[]
    starchId = starches[0].id

    goatProtein = proteinsRepo.upsert({ name: 'Goat Meat', selling_price_cents: 10000, cost_price_cents: 6000, category: 'Goat' })
    chickenProtein = proteinsRepo.upsert({ name: 'Chicken', selling_price_cents: 8000, cost_price_cents: 5000, category: 'Chicken' })
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

  test('2. Create a cash sale: 2 goat meat + 1 chicken with starches', () => {
    const saleId = salesRepo.create({
      subtotal_cents: 10000 + 10000 + 8000,
      discount_cents: 0,
      total_cents: 28000,
      debt_cents: 0,
      payment_method: 'cash',
      till_session_id: tillId,
      created_by: userId,
      items: [
        { protein_id: goatProtein.id, starch_id: starchId, price_cents: 10000 },
        { protein_id: goatProtein.id, starch_id: starchId, price_cents: 10000 },
        { protein_id: chickenProtein.id, starch_id: starchId, price_cents: 8000 },
      ],
    })
    expect(saleId).toBeGreaterThan(0)

    db.prepare("UPDATE sales SET created_at = ? WHERE id = ?").run(reportDate + ' 12:00:00', saleId)

    const sale = salesRepo.getById(saleId as number) as any
    expect(sale.status).toBe('completed')
    expect(sale.total_cents).toBe(28000)
    expect(sale.till_session_id).toBe(tillId)
  })

  test('3. Record a food purchase (protein purchase)', () => {
    const purchase = inventoryRepo.recordPurchase(goatProtein.id, 5, 30000, reportDate, userId) as any
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
})
