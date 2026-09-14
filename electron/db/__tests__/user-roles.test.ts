import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migrations/001_initial'
import { runSalesExtrasMigration } from '../migrations/002_sales_extras'
import { runExpensesMigration } from '../migrations/003_expenses_add_date_mpesa'
import { runDebtsMigration } from '../migrations/004_debts_payment_allocations'
import { runReimbursementsMigration } from '../migrations/005_reimbursements_add_columns'
import { runWasteMigration } from '../migrations/006_waste_table'
import { runCategoriesMigration } from '../migrations/007_categories'
import { runUserRolesMigration } from '../migrations/013_user_roles'
import { runRemovePaymentIdMigration } from '../migrations/014_debt_allocations_cleanup'

let db: Database.Database

vi.mock('../index', () => ({
  getDb: () => db,
}))

import { usersRepo } from '../repositories/usersRepo'

function runChain(d: Database.Database, withRolesMigration = true) {
  d.pragma('journal_mode = WAL')
  d.pragma('foreign_keys = ON')
  runMigrations(d)
  runSalesExtrasMigration(d)
  runExpensesMigration(d)
  runDebtsMigration(d)
  runReimbursementsMigration(d)
  runWasteMigration(d)
    runCategoriesMigration(d)
    if (withRolesMigration) runUserRolesMigration(d)
    runRemovePaymentIdMigration(d)
  }

describe('usersRepo CRUD + guards', () => {
  let adminId: number

  beforeAll(() => {
    db = new Database(':memory:')
    runChain(db)
    adminId = usersRepo.create('Alice', 'admin', '1111').id
  })

  afterAll(() => {
    db.close()
  })

  test('create remembers role; list() returns the user with created_at', () => {
    const cashier = usersRepo.create('Bob', 'cashier', '2222')
    expect(cashier.role).toBe('cashier')
    expect(cashier.id).toBeGreaterThan(0)

    const rows = usersRepo.list()
    const alice = rows.find(r => r.id === adminId)
    const bob = rows.find(r => r.id === cashier.id)
    expect(alice?.id).toBe(adminId)
    expect(alice?.role).toBe('admin')
    expect(bob?.role).toBe('cashier')
    expect(bob?.created_at).toBeTruthy()
    expect(alice?.created_at).toBeTruthy()
  })

  test('create validates PIN length and non-empty name', () => {
    expect(() => usersRepo.create('X', 'admin', '12')).toThrow('PIN must be 4 digits')
    expect(() => usersRepo.create('', 'admin', '1234')).toThrow('Name is required')
  })

  test('resetPin replaces the pin; setPin requires the correct old pin', () => {
    expect(usersRepo.resetPin(adminId, '4321')).toBe(true)
    expect(usersRepo.setPin(adminId, '4321', '9999')).toBe(true)
    expect(usersRepo.setPin(adminId, '1111', '0000')).toBe(false)
  })

  test('a single admin cannot be demoted or deactivated', () => {
    expect(() => usersRepo.update(adminId, { role: 'cashier' })).toThrow('Cannot remove the last admin')
    expect(() => usersRepo.update(adminId, { active: 0 })).toThrow('Cannot remove the last admin')
  })

  test('with a second admin present, demote and deactivate both succeed', () => {
    const second = usersRepo.create('Carol', 'admin', '3333')
    expect(second.id).toBeGreaterThan(0)

    const deactivated = usersRepo.update(adminId, { active: 0 })
    expect(deactivated?.active).toBe(0)
    expect(usersRepo.update(adminId, { active: 1 })?.active).toBe(1)

    const demoted = usersRepo.update(adminId, { role: 'cashier' })
    expect(demoted?.role).toBe('cashier')
    expect(demoted?.id).toBe(adminId)
  })

  test('update returns null for a missing id', () => {
    expect(usersRepo.update(9999, { name: 'Ghost' })).toBeNull()
  })
})

describe('seed() on an empty database', () => {
  beforeAll(() => {
    db = new Database(':memory:')
    runChain(db)
    usersRepo.seed()
  })

  afterAll(() => {
    db.close()
  })

  test('creates a single admin user with the default PIN', () => {
    const users = usersRepo.list()
    expect(users).toHaveLength(1)
    expect(users[0].name).toBe('Admin')
    expect(users[0].role).toBe('admin')
    const match = usersRepo.findByPin('1234') as { id: number } | undefined
    expect(match?.id).toBe(users[0].id)
  })

  test('seed() does not duplicate when called again', () => {
    usersRepo.seed()
    expect(usersRepo.list()).toHaveLength(1)
  })
})

describe('manager -> admin mapping on migration 013', () => {
  beforeAll(() => {
    db = new Database(':memory:')
    runChain(db, false)
    db.prepare("INSERT INTO users (name, role, pin_hash, active) VALUES ('Old Manager', 'manager', 'hash', 1)").run()
    runUserRolesMigration(db)
  })

  afterAll(() => {
    db.close()
  })

  test('pre-existing manager user reads back as admin with the same id', () => {
    const rows = db.prepare('SELECT * FROM users').all() as { id: number; name: string; role: string }[]
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Old Manager')
    expect(rows[0].role).toBe('admin')

    const viaRepo = usersRepo.list()
    expect(viaRepo).toHaveLength(1)
    expect(viaRepo[0].id).toBe(rows[0].id)
  })
})