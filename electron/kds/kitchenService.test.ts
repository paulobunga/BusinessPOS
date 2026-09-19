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
import { runSetupMigration } from '../db/migrations/012_setup'
import { runUserRolesMigration } from '../db/migrations/013_user_roles'
import { runRemovePaymentIdMigration } from '../db/migrations/014_debt_allocations_cleanup'
import { runDebtWriteOffsMigration } from '../db/migrations/017_debt_write_offs'
import { runTotalYieldMigration } from '../db/migrations/022_total_yield'
import { runItemStockMovementsMigration } from '../db/migrations/024_item_stock_movements'
import { runYieldCleanupMigration } from '../db/migrations/025_yield_cleanup'
import { runPerLineCaptainMigration } from '../db/migrations/026_per_line_captain'
import { runYieldQtyPerSaleMigration } from '../db/migrations/027_yield_qty_per_sale'
import { runItemPurchaseNotesMigration } from '../db/migrations/028_item_purchase_notes'
import { runKitchenStatusMigration } from '../db/migrations/029_kitchen_status'

let db: Database.Database

vi.mock('../db/index', () => ({
  getDb: () => db,
}))

import { salesRepo } from '../db/repositories/salesRepo'
import { usersRepo } from '../db/repositories/usersRepo'
import { listActiveKitchenOrders, setKitchenStatus } from './kitchenService'

describe('kitchenService', () => {
  let userId: number

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
    runSetupMigration(db)
    runTotalYieldMigration(db)
    runItemStockMovementsMigration(db)
    runYieldCleanupMigration(db)
    runPerLineCaptainMigration(db)
    runYieldQtyPerSaleMigration(db)
    runItemPurchaseNotesMigration(db)
    runRemovePaymentIdMigration(db)
    runUserRolesMigration(db)
    runDebtWriteOffsMigration(db)
    runKitchenStatusMigration(db)
    userId = (usersRepo.create('KDS Test', 'admin', '9999') as any).id as number
  })

  afterAll(() => {
    db.close()
  })

  test('created sale lists as new oldest-first', () => {
    const a = salesRepo.create({
      subtotal_cents: 1000,
      discount_cents: 0,
      total_cents: 1000,
      debt_cents: 0,
      payment_method: 'cash',
      created_by: userId,
      items: [],
    })
    const b = salesRepo.create({
      subtotal_cents: 2000,
      discount_cents: 0,
      total_cents: 2000,
      debt_cents: 0,
      payment_method: 'cash',
      created_by: userId,
      items: [],
    })
    const list = listActiveKitchenOrders()
    expect(list.length).toBeGreaterThanOrEqual(2)
    const ids = list.map((o: any) => o.id)
    expect(ids.indexOf(a as number)).toBeLessThan(ids.indexOf(b as number))
    expect((list[0] as any).kitchen_status).toBe('new')
  })

  test('setStatus new->preparing ok', () => {
    const id = salesRepo.create({
      subtotal_cents: 500,
      discount_cents: 0,
      total_cents: 500,
      debt_cents: 0,
      payment_method: 'cash',
      created_by: userId,
      items: [],
    }) as number
    const updated = setKitchenStatus(id, 'preparing') as any
    expect(updated.kitchen_status).toBe('preparing')
  })

  test('preparing->new throws Invalid transition', () => {
    const id = salesRepo.create({
      subtotal_cents: 500,
      discount_cents: 0,
      total_cents: 500,
      debt_cents: 0,
      payment_method: 'cash',
      created_by: userId,
      items: [],
    }) as number
    setKitchenStatus(id, 'preparing')
    expect(() => setKitchenStatus(id, 'new')).toThrow(/Invalid transition/)
  })

  test('unknown status throws Invalid status', () => {
    const id = salesRepo.create({
      subtotal_cents: 500,
      discount_cents: 0,
      total_cents: 500,
      debt_cents: 0,
      payment_method: 'cash',
      created_by: userId,
      items: [],
    }) as number
    expect(() => setKitchenStatus(id, 'foo')).toThrow(/Invalid status/)
  })

  test('missing order throws not found', () => {
    expect(() => setKitchenStatus(99999, 'preparing')).toThrow(/not found/)
  })
})
