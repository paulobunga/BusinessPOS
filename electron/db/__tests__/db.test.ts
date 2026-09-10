import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { runMigrations } from '../migrations/001_initial'

const TEST_DB_PATH = path.join(__dirname, '..', '__test.sqlite')

describe('Database initialization', () => {
  let db: Database.Database

  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
    db = new Database(TEST_DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
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
    expect(tableNames).toContain('proteins')
    expect(tableNames).toContain('starches')
    expect(tableNames).toContain('till_sessions')
    expect(tableNames).toContain('sales')
    expect(tableNames).toContain('sale_items')
    expect(tableNames).toContain('payments')
    expect(tableNames).toContain('payment_allocations')
    expect(tableNames).toContain('expenses')
    expect(tableNames).toContain('reimbursements')
    expect(tableNames).toContain('protein_purchases')
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
})
