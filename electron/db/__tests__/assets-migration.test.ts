import { describe, test, expect } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migrations/001_initial'
import { runAssetsMigration } from '../migrations/015_assets'

describe('assets migration', () => {
  test('creates the assets table with the expected columns and marks version 15', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    runAssetsMigration(db)

    const cols = db.prepare('PRAGMA table_info(assets)').all() as { name: string }[]
    expect(cols.map(c => c.name)).toEqual(expect.arrayContaining([
      'id', 'name', 'category', 'quantity', 'purchase_date', 'purchase_cost_cents',
      'salvage_cents', 'useful_life_months', 'location', 'notes', 'active',
      'disposed_at', 'disposed_reason', 'sold_proceeds_cents', 'created_at', 'created_by',
    ]))

    const applied = db.prepare('SELECT version FROM schema_migrations WHERE version = 15').get()
    expect(applied).toBeTruthy()
    db.close()
  })

  test('is idempotent: running it twice does not error', () => {
    const db = new Database(':memory:')
    runMigrations(db)
    runAssetsMigration(db)
    expect(() => runAssetsMigration(db)).not.toThrow()
    db.close()
  })
})