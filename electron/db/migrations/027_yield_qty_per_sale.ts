import Database from 'better-sqlite3'

export function runYieldQtyPerSaleMigration(db: Database.Database) {
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))
  if (appliedVersions.has(27)) return

  db.transaction(() => {
    // item_yield_defaults is created by migration 012, which always runs first.
    const cols = db.prepare('PRAGMA table_info(item_yield_defaults)').all() as { name: string }[]
    if (!cols.some(c => c.name === 'qty_per_sale')) {
      db.exec('ALTER TABLE item_yield_defaults ADD COLUMN qty_per_sale INTEGER NOT NULL DEFAULT 1')
    }

    db.exec('INSERT INTO schema_migrations (version) VALUES (27)')
  })()
}
