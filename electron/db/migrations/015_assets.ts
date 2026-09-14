import Database from 'better-sqlite3'

export function runAssetsMigration(db: Database.Database) {
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))
  if (appliedVersions.has(15)) return

  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        purchase_date TEXT NOT NULL,
        purchase_cost_cents INTEGER NOT NULL,
        salvage_cents INTEGER NOT NULL DEFAULT 0,
        useful_life_months INTEGER NOT NULL,
        location TEXT,
        notes TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        disposed_at TEXT,
        disposed_reason TEXT,
        sold_proceeds_cents INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_by INTEGER REFERENCES users(id)
      );
    `)
    db.exec('INSERT INTO schema_migrations (version) VALUES (15)')
  })()
}