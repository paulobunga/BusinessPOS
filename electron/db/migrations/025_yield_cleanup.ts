import Database from 'better-sqlite3'

export function runYieldCleanupMigration(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (!appliedVersions.has(25)) {
    db.transaction(() => {
      // Legacy per-purchase yield splits. Superseded by item_purchases.total_yield
      // (migration 022) and the item_stock_movements ledger (migration 024).
      // Nothing in app code reads or writes this table (verified before removal).
      db.exec(`DROP TABLE IF EXISTS item_purchase_yields;`)
      db.exec(`INSERT INTO schema_migrations (version) VALUES (25);`)
    })()
  }
}
