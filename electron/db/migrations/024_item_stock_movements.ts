import Database from 'better-sqlite3'

export function runItemStockMovementsMigration(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (!appliedVersions.has(24)) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS item_stock_movements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id INTEGER NOT NULL REFERENCES menu_items(id),
          movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase_in', 'sale_out', 'discount_out', 'captain_out', 'waste')),
          quantity INTEGER NOT NULL DEFAULT 1,
          is_discount INTEGER NOT NULL DEFAULT 0,
          reference_table TEXT,
          reference_id INTEGER,
          created_by INTEGER REFERENCES users(id),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          notes TEXT
        );
      `)

      db.exec(`CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON item_stock_movements(item_id, created_at);`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON item_stock_movements(reference_table, reference_id);`)

      db.exec(`INSERT INTO schema_migrations (version) VALUES (24);`)
    })()
  }
}
