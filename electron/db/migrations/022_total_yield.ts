import Database from 'better-sqlite3'

export function runTotalYieldMigration(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (!appliedVersions.has(22)) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE item_purchases_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id INTEGER NOT NULL REFERENCES menu_items(id),
          purchase_date TEXT NOT NULL,
          quantity_kg REAL NOT NULL,
          cost_cents INTEGER NOT NULL,
          total_yield INTEGER NOT NULL DEFAULT 0,
          created_by INTEGER REFERENCES users(id),
          unit TEXT NOT NULL DEFAULT 'kg',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `)

      db.exec(`
        INSERT INTO item_purchases_new (id, item_id, purchase_date, quantity_kg, cost_cents, total_yield, created_by, unit, created_at)
        SELECT id, item_id, purchase_date, quantity_kg, cost_cents, 0, created_by,
               COALESCE(unit, 'kg'), COALESCE(created_at, datetime('now'))
        FROM item_purchases
      `)

      db.exec(`DROP TABLE item_purchases;`)
      db.exec(`ALTER TABLE item_purchases_new RENAME TO item_purchases;`)

      db.exec(`INSERT INTO schema_migrations (version) VALUES (22);`)
    })()
  }
}
