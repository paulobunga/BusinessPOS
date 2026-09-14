import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { runMigrations } from '../migrations/001_initial'
import { runSalesExtrasMigration } from '../migrations/002_sales_extras'
import { runExpensesMigration } from '../migrations/003_expenses_add_date_mpesa'
import { runDebtsMigration } from '../migrations/004_debts_payment_allocations'
import { runReimbursementsMigration } from '../migrations/005_reimbursements_add_columns'
import { runWasteMigration } from '../migrations/006_waste_table'
import { runCategoriesMigration } from '../migrations/007_categories'
import { runUserRolesMigration } from '../migrations/013_user_roles'
import { runRemovePaymentIdMigration } from '../migrations/014_debt_allocations_cleanup'
import { itemsRepo } from '../repositories/itemsRepo'

const TEST_DB_PATH = path.join(__dirname, '..', '__test.sqlite')

describe('Database initialization', () => {
  let db: Database.Database

  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
    db = new Database(TEST_DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    runSalesExtrasMigration(db)
    runExpensesMigration(db)
    runDebtsMigration(db)
    runReimbursementsMigration(db)
    runWasteMigration(db)
    runCategoriesMigration(db)
    runUserRolesMigration(db)
    runRemovePaymentIdMigration(db)
  })

  afterAll(() => {
    db.close()
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
    if (fs.existsSync(TEST_DB_PATH + '-wal')) fs.unlinkSync(TEST_DB_PATH + '-wal')
    if (fs.existsSync(TEST_DB_PATH + '-shm')) fs.unlinkSync(TEST_DB_PATH + '-shm')
  })

  test('creates all required tables', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[]
    const tableNames = tables.map(t => t.name)
    expect(tableNames).toContain('users')
    expect(tableNames).toContain('customers')
    expect(tableNames).toContain('categories')
    expect(tableNames).toContain('menu_items')
    expect(tableNames).toContain('attribute_defs')
    expect(tableNames).toContain('item_attribute_values')
    expect(tableNames).toContain('till_sessions')
    expect(tableNames).toContain('sales')
    expect(tableNames).toContain('sale_items')
    expect(tableNames).toContain('payments')
    expect(tableNames).toContain('payment_allocations')

    const allocationCols = db.prepare('PRAGMA table_info(payment_allocations)').all() as { name: string }[]
    expect(allocationCols.map(c => c.name)).not.toContain('payment_id')
    expect(tableNames).toContain('expenses')
    expect(tableNames).toContain('reimbursements')
    expect(tableNames).toContain('item_purchases')
    expect(tableNames).toContain('cook_events')
    expect(tableNames).toContain('settings')
  })

  test('enables WAL mode', () => {
    const mode = db.pragma('journal_mode', { simple: true })
    expect(mode).toBe('wal')
  })

  test('enables foreign keys', () => {
    const fk = db.pragma('foreign_keys', { simple: true })
    expect(fk).toBe(1)
  })

  test('migration seeded 2 categories', () => {
    const count = db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number }
    expect(count.c).toBe(2)
  })

  test('legacy proteins/starches tables are gone', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('proteins','starches','protein_purchases')").all() as { name: string }[]
    expect(tables).toHaveLength(0)
  })

  test('users table rebuilt with admin/cashier roles', () => {
    const cols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[]
    expect(cols.map(c => c.name)).toContain('created_at')
    expect(() => {
      db.prepare("INSERT INTO users (name, role, pin_hash) VALUES ('bad','manager','abcd')").run()
    }).toThrow()
  })
})
