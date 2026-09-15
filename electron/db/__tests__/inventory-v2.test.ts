import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { runMigrations } from '../migrations/001_initial'
import { runInventoryV2Migration } from '../migrations/018_inventory_v2'
import { runInventoryV2SeedMigration } from '../migrations/019_inventory_v2_seed'

const TEST_DB_PATH = path.join(__dirname, '..', '__test_inv_v2.sqlite')

describe('v2 inventory schema', () => {
  let db: Database.Database

  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
    db = new Database(TEST_DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    runInventoryV2Migration(db)
    runInventoryV2SeedMigration(db)
  })

  afterAll(() => {
    db.close()
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(TEST_DB_PATH + suffix)) fs.unlinkSync(TEST_DB_PATH + suffix)
    }
  })

  test('creates all v2 base tables', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[]
    for (const t of ['units', 'staff', 'ingredients', 'suppliers', 'market_purchases', 'purchase_items', 'stock_movements', 'stock_counts']) {
      expect(tables.map(r => r.name)).toContain(t)
    }
  })

  test('registers migration as version 18', () => {
    const row = db.prepare("SELECT version FROM schema_migrations WHERE version = 18").get() as { version: number } | undefined
    expect(row?.version).toBe(18)
  })

  test('trg_stock_cache keeps ingredients.current_stock in sync', () => {
    db.prepare("INSERT OR IGNORE INTO units (name, unit_type) VALUES ('Litre', 'volume')").run()
    db.prepare("INSERT INTO ingredients (name, base_unit_id) VALUES ('Test Oil', (SELECT id FROM units WHERE name='Litre'))").run()
    const ing = db.prepare('SELECT id FROM ingredients WHERE name = ?').get('Test Oil') as { id: number }
    db.prepare(
      "INSERT INTO stock_movements (ingredient_id, movement_type, quantity, balance_after) VALUES (?, 'purchase_in', 2.5, 2.5)"
    ).run(ing.id)
    db.prepare(
      "INSERT INTO stock_movements (ingredient_id, movement_type, quantity, balance_after) VALUES (?, 'sale_out', -0.5, 2.0)"
    ).run(ing.id)
    const after = db.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get(ing.id) as { current_stock: number }
    expect(after.current_stock).toBe(2.0)
  })

  test('seeds units', () => {
    const names = db.prepare('SELECT name FROM units ORDER BY id').all() as { name: string }[]
    expect(names.map(r => r.name)).toEqual(['Litre', 'Kg', 'Bag', 'Piece', 'Finger', 'Gram'])
  })

  test('seeds ingredients with base units', () => {
    const row = db.prepare(`
      SELECT i.name, u.name as unit FROM ingredients i JOIN units u ON u.id = i.base_unit_id WHERE i.name = ?
    `).get('Cooking Oil') as { name: string; unit: string } | undefined
    expect(row?.unit).toBe('Litre')
  })
})