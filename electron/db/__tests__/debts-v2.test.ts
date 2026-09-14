import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migrations/001_initial'
import { runSalesExtrasMigration } from '../migrations/002_sales_extras'
import { runDebtsMigration } from '../migrations/004_debts_payment_allocations'
import { runRemovePaymentIdMigration } from '../migrations/014_debt_allocations_cleanup'

let db: Database.Database

vi.mock('../index', () => ({
  getDb: () => db,
}))

import { debtsRepo } from '../repositories/debtsRepo'
import { reportsRepo } from '../repositories/reportsRepo'
import { tillRepo } from '../repositories/tillRepo'
import { salesRepo } from '../repositories/salesRepo'

function insertSale(opts: { customer?: string; debtCents: number; totalCents?: number; status?: string; createdAt?: string }): number {
  const res = db.prepare(`
    INSERT INTO sales (customer_name, status, subtotal_cents, total_cents, debt_cents, payment_method)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    opts.customer ?? null,
    opts.status ?? 'unpaid',
    opts.totalCents ?? opts.debtCents,
    opts.totalCents ?? opts.debtCents,
    opts.debtCents,
    opts.debtCents > 0 ? 'debt' : 'cash',
  )
  const id = Number(res.lastInsertRowid)
  if (opts.createdAt) db.prepare('UPDATE sales SET created_at = ? WHERE id = ?').run(opts.createdAt, id)
  return id
}

function pay(saleId: number, amountCents: number) {
  db.prepare(`
    INSERT INTO payment_allocations (sale_id, amount_cents, payment_method, till_session_id, created_by)
    VALUES (?, ?, 'cash', NULL, NULL)
  `).run(saleId, amountCents)
}

describe('debts v2', () => {
  let s2 = 0
  let s3 = 0
  let anon = 0

  beforeAll(() => {
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    db.prepare(`INSERT INTO users (name, role, pin_hash) VALUES ('User', 'cashier', '1234')`).run()
    runSalesExtrasMigration(db)
    runDebtsMigration(db)
    runRemovePaymentIdMigration(db)
  })

  afterAll(() => db.close())

  test('listOpen returns remaining/aging/last-payment and excludes settled & voided', () => {
    const s1 = insertSale({ customer: 'Alice', debtCents: 1000 })
    pay(s1, 400)
    const s2 = insertSale({ customer: 'Bob', debtCents: 2000 })
    pay(s2, 2000)
    insertSale({ customer: 'Alice', debtCents: 500, status: 'voided' })
    anon = insertSale({ debtCents: 1200, createdAt: '2026-09-15 08:00:00' })

    const rows = debtsRepo.listOpen()
    expect(rows).toHaveLength(2)

    const anonRow = rows.find(r => r.sale_id === anon)!
    expect(anonRow.remaining_cents).toBe(1200)
    expect(anonRow.paid_cents).toBe(0)
    expect(anonRow.customer_name).toBeNull()
    expect(typeof anonRow.days_open).toBe('number')
    expect(anonRow.days_open).toBeGreaterThanOrEqual(0)
    expect(anonRow.last_payment_at).toBeNull()

    const aliceRow = rows.find(r => r.sale_id === s1)!
    expect(aliceRow.remaining_cents).toBe(600)
    expect(aliceRow.paid_cents).toBe(400)
    expect(aliceRow.last_payment_at).toBeTruthy()
  })

  test('recordPayment guards overpay/zero and flips to completed exactly at remaining', () => {
    const sale = insertSale({ customer: 'Carol', debtCents: 1000 })

    expect(() => debtsRepo.recordPayment(sale, 1200, 'cash', null, 1)).toThrow()
    expect(() => debtsRepo.recordPayment(sale, 0, 'cash', null, 1)).toThrow()

    const r1 = debtsRepo.recordPayment(sale, 400, 'cash', null, 1)
    expect(r1).toEqual({ remaining_cents: 600, sale_status: 'unpaid' })

    const r2 = debtsRepo.recordPayment(sale, 600, 'cash', null, 1)
    expect(r2).toEqual({ remaining_cents: 0, sale_status: 'completed' })

    const status = (db.prepare('SELECT status FROM sales WHERE id = ?').get(sale) as { status: string }).status
    expect(status).toBe('completed')

    expect(() => debtsRepo.recordPayment(sale, 1, 'cash', null, 1)).toThrow()
  })

  test('payOnAccount distributes oldest-first and settles fully-paid sales', () => {
    const c = 'Dan'
    const s1 = insertSale({ customer: c, debtCents: 1000, createdAt: '2026-09-10 10:00:00' })
    s2 = insertSale({ customer: c, debtCents: 2000, createdAt: '2026-09-11 10:00:00' })
    s3 = insertSale({ customer: c, debtCents: 5000, createdAt: '2026-09-12 10:00:00' })

    const res = debtsRepo.payOnAccount({ customer_name: c, amount_cents: 2500, till_session_id: null, created_by: 1 })

    expect(res.total_applied_cents).toBe(2500)
    expect(res.allocations).toEqual([
      { sale_id: s1, amount_cents: 1000 },
      { sale_id: s2, amount_cents: 1500 },
    ])
    expect(res.settled_sale_ids).toEqual([s1])
    expect((db.prepare('SELECT status FROM sales WHERE id = ?').get(s1) as { status: string }).status).toBe('completed')
    expect((db.prepare('SELECT status FROM sales WHERE id = ?').get(s2) as { status: string }).status).toBe('unpaid')
    expect(debtsRepo.getTotalOwed(s3)).toBe(5000)
  })

  test('payOnAccount overpayment throws and rolls back completely', () => {
    const before = (db.prepare('SELECT COUNT(*) as c FROM payment_allocations').get() as { c: number }).c
    expect(() => debtsRepo.payOnAccount({ customer_name: 'Dan', amount_cents: 99999, till_session_id: null, created_by: 1 })).toThrow()
    const after = (db.prepare('SELECT COUNT(*) as c FROM payment_allocations').get() as { c: number }).c
    expect(after).toBe(before)
  })

  test('customerBalances aggregates per customer and excludes settled/anonymous', () => {
    const balances = debtsRepo.customerBalances()

    const dan = balances.find(b => b.customer_name === 'Dan')!
    expect(dan.total_owed_cents).toBe(7000) // open sales only: 2000 (s2) + 5000 (s3)
    expect(dan.total_paid_cents).toBe(1500) // allocations on open sales only: s2's 1500 (s1 was settled earlier)
    expect(dan.unpaid_orders).toBe(2)
    expect(dan.oldest_open_date).toContain('2026-09-11') // oldest OPEN sale; s1 (10th) was settled before this test runs
    expect(dan.newest_open_date).toContain('2026-09-12')
    expect(dan.last_payment_at).toBeTruthy()

    const bob = balances.find(b => b.customer_name === 'Bob')
    expect(bob).toBeUndefined()
    expect(balances.some(b => b.customer_name === null)).toBe(false)
  })

  test('balanceByName returns outstanding or 0 for unknown/settled customers', () => {
    expect(debtsRepo.balanceByName('Dan')).toBe(5500) // 1500 + 5000 remaining
    expect(debtsRepo.balanceByName('Bob')).toBe(0)
    expect(debtsRepo.balanceByName('Ghost')).toBe(0)
  })

  test('customerDetail returns open debts newest-first plus payment history', () => {
    const detail = debtsRepo.customerDetail('Dan')
    expect(detail.customer_name).toBe('Dan')
    expect(detail.total_owed_cents).toBe(5500)
    expect(detail.open_debts.map(d => d.sale_id)).toEqual([s3, s2])
    expect(detail.open_debts.length).toBe(2)
    expect(detail.payments.length).toBeGreaterThanOrEqual(2)
    expect(detail.payments[0].sale_total_cents).toBeGreaterThan(0)
  })

  test('reports getDebtSummary subtracts allocations and lists only open debts', () => {
    const rows = reportsRepo.getDebtSummary()

    const dan = rows.filter(r => r.customer_name === 'Dan')
    expect(dan.length).toBe(2)
    const s2Row = dan.find(r => r.sale_id === s2)!
    expect(s2Row.debt_cents).toBe(2000)
    expect(s2Row.paid_cents).toBe(1500)
    expect(s2Row.total_debt_cents).toBe(500)
    expect(s2Row.paid_cents).toBeGreaterThan(0)

    const anonRow = rows.find(r => r.sale_id === anon)!
    expect(anonRow.total_debt_cents).toBe(anonRow.debt_cents)

    const settled = rows.find(r => r.customer_name === 'Bob')
    expect(settled).toBeUndefined()
  })

  test('mixed checkout stays unpaid and credits till only the cash portion', () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS menu_items (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL REFERENCES categories(id), name TEXT NOT NULL, selling_price_cents INTEGER NOT NULL DEFAULT 0);
    `)
    const itemCols = (db.prepare('PRAGMA table_info(sale_items)').all() as { name: string }[]).map(c => c.name)
    if (!itemCols.includes('item_id')) db.exec('ALTER TABLE sale_items ADD COLUMN item_id INTEGER REFERENCES menu_items(id)')
    if (!itemCols.includes('free_item_id')) db.exec('ALTER TABLE sale_items ADD COLUMN free_item_id INTEGER REFERENCES menu_items(id)')
    const reimCols = (db.prepare('PRAGMA table_info(reimbursements)').all() as { name: string }[]).map(c => c.name)
    if (!reimCols.includes('till_session_id')) db.exec('ALTER TABLE reimbursements ADD COLUMN till_session_id INTEGER REFERENCES till_sessions(id)')

    const catId = Number(db.prepare(`INSERT INTO categories (name) VALUES ('Mixed')`).run().lastInsertRowid)
    const itemId = Number(
      db.prepare(`INSERT INTO menu_items (category_id, name, selling_price_cents) VALUES (?, 'Mixed Plate', 10000)`).run(catId).lastInsertRowid
    )

    const tillId = Number(tillRepo.open(0))
    const saleId = salesRepo.create({
      customer_name: 'Eve',
      subtotal_cents: 10000,
      discount_cents: 0,
      total_cents: 10000,
      debt_cents: 3000,
      payment_method: 'mixed',
      till_session_id: tillId,
      created_by: 1,
      items: [{ item_id: itemId, price_cents: 10000, quantity: 1 }],
    })

    const sale = db.prepare('SELECT status, payment_method, debt_cents FROM sales WHERE id = ?').get(saleId) as { status: string; payment_method: string; debt_cents: number }
    expect(sale.status).toBe('unpaid')
    expect(sale.payment_method).toBe('mixed')
    expect(sale.debt_cents).toBe(3000)

    const cash = tillRepo.countCash()
    expect(cash?.cashSalesCents).toBe(7000)
    expect(cash?.expectedClosingCents).toBe(7000)
    expect(reportsRepo.getTillSummary(tillId)?.cash_sales_cents).toBe(7000)
  })
})