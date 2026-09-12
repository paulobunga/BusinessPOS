import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../db/migrations/001_initial'
import { runSalesExtrasMigration } from '../db/migrations/002_sales_extras'
import { runExpensesMigration } from '../db/migrations/003_expenses_add_date_mpesa'
import { runDebtsMigration } from '../db/migrations/004_debts_payment_allocations'
import { runReimbursementsMigration } from '../db/migrations/005_reimbursements_add_columns'
import { runWasteMigration } from '../db/migrations/006_waste_table'
import { runCategoriesMigration } from '../db/migrations/007_categories'
import { runMoneyWholeUgxMigration } from '../db/migrations/008_money_whole_ugx'
import { runMenuSeedMigration } from '../db/migrations/009_menu_seed'
import { runPurchaseYieldMigration } from '../db/migrations/010_purchase_yield'
import { runPurchaseYieldsMigration } from '../db/migrations/011_purchase_yields'
import { runUserRolesMigration } from '../db/migrations/013_user_roles'

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
  let wholeChicken: any
  let boiled: any

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
    runMoneyWholeUgxMigration(db)
    runMenuSeedMigration(db)
    runPurchaseYieldMigration(db)
    runPurchaseYieldsMigration(db)
    runUserRolesMigration(db)

    const user = usersRepo.create('Test Manager', 'cashier', '1234')
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
    expect(goatRow!.quantity_sold).toBe(2)
    expect(goatRow!.price_per_item_cents).toBe(10000)
    expect(goatRow!.amount_sold_cents).toBe(20000)
    expect(goatRow!.cost_cents).toBe(12000)
    expect(goatRow!.profit_cents).toBe(8000)
    expect(goatRow!.category_name).toBe('Test Meats')
  })

  test('8b. Item performance allocates sale discounts and includes debt sales', () => {
    const saleId = salesRepo.create({
      subtotal_cents: 24000,
      discount_cents: 4000,
      total_cents: 20000,
      debt_cents: 20000,
      payment_method: 'debt',
      created_by: userId,
      items: [
        { item_id: goat.id, price_cents: 10000 },
        { item_id: goat.id, price_cents: 10000 },
        { item_id: chicken.id, price_cents: 8000 },
      ],
    })
    expect(saleId).toBeGreaterThan(0)
    db.prepare("UPDATE sales SET created_at = ? WHERE id = ?").run(reportDate + ' 15:00:00', saleId)

    const perf = reportsRepo.getItemPerformance(reportDate, reportDate)
    const goatRow = perf.find((p: any) => p.item_name === 'Goat Meat')!
    const chickenRow = perf.find((p: any) => p.item_name === 'Chicken')!

    expect(goatRow.quantity_sold).toBe(4)
    expect(goatRow.price_per_item_cents).toBe(10000)
    expect(goatRow.amount_sold_cents).toBe(36667)
    expect(goatRow.cost_cents).toBe(24000)
    expect(goatRow.profit_cents).toBe(12667)

    expect(chickenRow.quantity_sold).toBe(2)
    expect(chickenRow.price_per_item_cents).toBe(8000)
    expect(chickenRow.amount_sold_cents).toBe(14667)
    expect(chickenRow.cost_cents).toBe(10000)
    expect(chickenRow.profit_cents).toBe(4667)
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

  test('10. Purchase-only category + whole chicken purchase backs out dish cost to portions', () => {
    const stockCat = categoriesRepo.upsert({ name: 'Test Stock', kind: 'priced', purchase_only: 1 })
    const stockRow = categoriesRepo.list().find(c => c.id === stockCat.id)!
    expect(stockRow.purchase_only).toBe(1)

    wholeChicken = itemsRepo.upsert({ category_id: stockCat.id, name: 'Whole Chicken', purchase_unit: 'whole' })
    boiled = itemsRepo.upsert({ category_id: chicken.category_id, name: 'Chicken (Boiled)', selling_price_cents: 10000, cost_price_cents: 5000 })

    const purchase = purchasesRepo.recordPurchase(wholeChicken.id, 1, 17000, reportDate, userId, {
      unit: 'whole',
      yieldItemId: boiled.id,
      expectedYield: 4,
    }) as any
    expect(purchase.cost_cents).toBe(17000)
    expect(purchase.unit).toBe('whole')
    expect(purchase.yield_item_id).toBe(boiled.id)
    expect(purchase.yield_item_name).toBe('Chicken (Boiled)')

    const wholeAfter = itemsRepo.getById(wholeChicken.id)!
    expect(wholeAfter.cost_price_cents).toBe(17000)
    expect(wholeAfter.purchase_unit).toBe('whole')

    const boiledAfter = itemsRepo.getById(boiled.id)!
    expect(boiledAfter.cost_price_cents).toBe(4250)
  })

  test('11. Purchase list surfaces yield dish via getByDate', () => {
    const rows = purchasesRepo.getByDate(reportDate) as any[]
    const whole = rows.find((r: any) => r.item_name === 'Whole Chicken')
    expect(whole).toBeDefined()
    expect(whole!.unit).toBe('whole')
    expect(whole!.yield_item_name).toBe('Chicken (Boiled)')
  })

  test('12. One purchase splits cost across multiple yielded meals by portions', () => {
    const fried = itemsRepo.upsert({ category_id: chicken.category_id, name: 'Chicken (Fried)', selling_price_cents: 11000, cost_price_cents: 0 })

    const purchase = purchasesRepo.recordPurchase(wholeChicken.id, 1, 17000, reportDate, userId, {
      unit: 'whole',
      yields: [
        { itemId: boiled.id, portions: 3 },
        { itemId: fried.id, portions: 2 },
      ],
    }) as any
    expect(purchase.cost_cents).toBe(17000)

    const byMeal = new Map(purchase.yields.map((y: any) => [y.name, y]))
    const boiledYield = byMeal.get('Chicken (Boiled)')
    const friedYield = byMeal.get('Chicken (Fried)')
    expect(boiledYield).toBeDefined()
    expect(friedYield).toBeDefined()
    expect(boiledYield.portions).toBe(3)
    expect(boiledYield.cost_cents).toBe(10200)
    expect(friedYield.portions).toBe(2)
    expect(friedYield.cost_cents).toBe(6800)

    expect(itemsRepo.getById(boiled.id)!.cost_price_cents).toBe(3400)
    expect(itemsRepo.getById(fried.id)!.cost_price_cents).toBe(3400)
  })

  test('13. Sales ledger groups items per order for the period', () => {
    const sales = reportsRepo.getSales(reportDate, reportDate)
    expect(sales).toHaveLength(2)

    const debtSale = sales[0]
    expect(debtSale.total_cents).toBe(20000)
    expect(debtSale.discount_cents).toBe(4000)
    expect(debtSale.payment_method).toBe('debt')
    expect(debtSale.debt_cents).toBe(20000)
    expect(debtSale.items).toHaveLength(3)
    expect(debtSale.items[0].name_snapshot).toBe('Goat Meat')
    expect(debtSale.items[2].name_snapshot).toBe('Chicken')
    expect(debtSale.items[2].quantity).toBe(1)
    expect(debtSale.created_at.slice(11, 16)).toBe('15:00')

    const cashSale = sales[1]
    expect(cashSale.total_cents).toBe(28000)
    expect(cashSale.payment_method).toBe('cash')
    expect(cashSale.items).toHaveLength(3)
    expect(cashSale.items[0].free_item_id).toBe(bananaId)
    expect(cashSale.created_at.slice(11, 16)).toBe('12:00')
  })
})
