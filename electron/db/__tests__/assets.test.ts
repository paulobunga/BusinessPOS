import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migrations/001_initial'
import { runSalesExtrasMigration } from '../migrations/002_sales_extras'
import { runExpensesMigration } from '../migrations/003_expenses_add_date_mpesa'
import { runDebtsMigration } from '../migrations/004_debts_payment_allocations'
import { runReimbursementsMigration } from '../migrations/005_reimbursements_add_columns'
import { runWasteMigration } from '../migrations/006_waste_table'
import { runCategoriesMigration } from '../migrations/007_categories'
import { runMenuSeedMigration } from '../migrations/009_menu_seed'
import { runPurchaseYieldMigration } from '../migrations/010_purchase_yield'
import { runUserRolesMigration } from '../migrations/013_user_roles'
import { runAssetsMigration } from '../migrations/015_assets'

let db: Database.Database

vi.mock('../index', () => ({
  getDb: () => db,
}))

import { assetsRepo } from '../repositories/assetsRepo'

describe('assets repo', () => {
  let freezerId: number
  let platesId: number

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
    runMenuSeedMigration(db)
    runPurchaseYieldMigration(db)
    runUserRolesMigration(db)
    runAssetsMigration(db)

    freezerId = assetsRepo.create({
      name: 'Freezer',
      category: 'Kitchen Equipment',
      purchase_date: '2024-01-10',
      purchase_cost_cents: 1200000,
      salvage_cents: 0,
      useful_life_months: 120,
    })
    platesId = assetsRepo.create({
      name: 'Plates',
      category: 'Utensils / Smallware',
      quantity: 50,
      purchase_date: '2025-07-15',
      purchase_cost_cents: 200000,
      useful_life_months: 24,
    })
  })

  afterAll(() => {
    db.close()
  })

  test('create applies defaults (quantity 1, salvage 0) and stores a row', () => {
    const id = assetsRepo.create({
      name: 'Gas Stove',
      category: 'Kitchen Equipment',
      purchase_date: '2026-01-01',
      purchase_cost_cents: 350000,
      useful_life_months: 120,
    })
    const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as any
    expect(row.quantity).toBe(1)
    expect(row.salvage_cents).toBe(0)
    expect(row.active).toBe(1)
  })

  test('getById returns computed straight-line values (freezer, asOf 2026-01-10)', () => {
    const a = assetsRepo.getById(freezerId, '2026-01-10')!
    expect(a.months_elapsed).toBe(24)
    expect(a.monthly_depreciation_cents).toBe(10000)
    expect(a.accumulated_depreciation_cents).toBe(240000)
    expect(a.net_book_value_cents).toBe(960000)
  })

  test('lot quantity is a display field; depreciation scales off total cost (plates)', () => {
    const a = assetsRepo.getById(platesId, '2026-09-15')!
    expect(a.quantity).toBe(50)
    expect(a.months_elapsed).toBe(14)
    expect(a.accumulated_depreciation_cents).toBe(116666)
    expect(a.net_book_value_cents).toBe(83334)
  })

  test('update recomputes derived values after changing cost/life', () => {
    const a = assetsRepo.update(platesId, { purchase_cost_cents: 240000 })
    const re = assetsRepo.getById(platesId, '2026-09-15')!
    expect(re.monthly_depreciation_cents).toBe(10000)
    expect(re.net_book_value_cents).toBe(240000 - 140000)
    assetsRepo.update(platesId, { purchase_cost_cents: 200000 })
  })

  test('dispose sets active=0, records reason/proceeds, caps depreciation at disposed date', () => {
    const disposed = assetsRepo.dispose(freezerId, '2025-07-20', 'sold', 900000)
    expect(disposed.active).toBe(0)
    expect(disposed.disposed_at).toBe('2025-07-20')
    expect(disposed.disposed_reason).toBe('sold')
    expect(disposed.sold_proceeds_cents).toBe(900000)
    const re = assetsRepo.getById(freezerId, '2026-09-15')!
    expect(re.months_elapsed).toBe(18)
    expect(re.net_book_value_cents).toBe(1200000 - (10000 * 18))
  })

  test('list orders active first then purchase_date desc; summary distinguishes active vs disposed', () => {
    const all = assetsRepo.list('2026-01-10')
    expect(all[0].active).toBe(1)
    const firstDisposedIdx = all.findIndex(a => a.active === 0)
    expect(firstDisposedIdx).toBeGreaterThan(0)
    expect(all.slice(firstDisposedIdx).every(a => a.active === 0)).toBe(true)

    const s = assetsRepo.summary('2026-01-10')
    expect(s.disposed_count).toBe(1)
    expect(s.active_count).toBeGreaterThanOrEqual(2)
    const activeBook = assetsRepo.list('2026-01-10').filter(a => a.active === 1).reduce((sum, a) => sum + a.net_book_value_cents, 0)
    expect(s.total_book_value_cents).toBe(activeBook)
  })

  test('validation rejects bad input', () => {
    expect(() => assetsRepo.create({ name: '', category: 'Other', purchase_date: '2026-01-01', purchase_cost_cents: 1000, useful_life_months: 12 })).toThrow('Asset name is required')
    expect(() => assetsRepo.create({ name: 'X', category: 'Other', purchase_date: '2026-01-01', purchase_cost_cents: -5, useful_life_months: 12 })).toThrow('Purchase cost')
    expect(() => assetsRepo.create({ name: 'X', category: 'Other', purchase_date: '2026-01-01', purchase_cost_cents: 1000, useful_life_months: 0 })).toThrow('Useful life')
    expect(() => assetsRepo.dispose(platesId, '', 'sold')).toThrow('Disposal date')
  })
})