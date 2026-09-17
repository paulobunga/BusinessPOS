import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { runMigrations } from '../migrations/001_initial'
import { runSalesExtrasMigration } from '../migrations/002_sales_extras'
import { runDebtsMigration } from '../migrations/004_debts_payment_allocations'
import { runRemovePaymentIdMigration } from '../migrations/014_debt_allocations_cleanup'
import { runDebtWriteOffsMigration } from '../migrations/017_debt_write_offs'

const TEST_DB_PATH = path.join(__dirname, '..', '__test_debts.sqlite')

let db: Database.Database

vi.mock('../index', () => ({
  getDb: () => db,
}))

import { debtsRepo } from '../repositories/debtsRepo'

describe('debts:recordPayment', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
    db = new Database(TEST_DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    runSalesExtrasMigration(db)
    runDebtsMigration(db)
    runRemovePaymentIdMigration(db)
    runDebtWriteOffsMigration(db)
  })

  afterAll(() => {
    db.close()
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
    if (fs.existsSync(TEST_DB_PATH + '-wal')) fs.unlinkSync(TEST_DB_PATH + '-wal')
    if (fs.existsSync(TEST_DB_PATH + '-shm')) fs.unlinkSync(TEST_DB_PATH + '-shm')
  })

  test('records a payment allocation without a payments row', () => {
    db.prepare(
      `INSERT INTO users (name, role, pin_hash) VALUES ('User', 'cashier', '1234')`
    ).run()
    const sale = db.prepare(
      `INSERT INTO sales (status, subtotal_cents, total_cents, debt_cents, created_by)
       VALUES ('unpaid', 1000, 1000, 1000, 1)`
    ).run()
    const saleId = Number(sale.lastInsertRowid)

    debtsRepo.recordPayment(saleId, 400, 'cash', null, 1)

    const allocations = db.prepare('SELECT * FROM payment_allocations WHERE sale_id = ?').all(saleId) as any[]
    const paid = db.prepare('SELECT COALESCE(SUM(amount_cents), 0) as paid FROM payment_allocations WHERE sale_id = ?').get(saleId) as { paid: number }
    const schema = db.prepare('PRAGMA table_info(payment_allocations)').all() as { name: string }[]

    expect(allocations).toHaveLength(1)
    expect(allocations[0].amount_cents).toBe(400)
    expect(paid.paid).toBe(400)
    expect(schema.map(c => c.name)).not.toContain('payment_id')
  })
})
