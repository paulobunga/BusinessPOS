import Database from 'better-sqlite3'

export function runKitchenStatusMigration(db: Database.Database) {
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))
  if (appliedVersions.has(29)) return

  db.transaction(() => {
    const cols = db.prepare('PRAGMA table_info(sales)').all() as { name: string }[]
    if (!cols.some(c => c.name === 'kitchen_status')) {
      db.exec(`ALTER TABLE sales ADD COLUMN kitchen_status TEXT NOT NULL DEFAULT 'new' CHECK (kitchen_status IN ('new','preparing','completed','served'))`)
    }

    db.exec('CREATE INDEX IF NOT EXISTS idx_sales_kitchen_status ON sales(kitchen_status, id)')

    db.exec('INSERT INTO schema_migrations (version) VALUES (29)')
  })()
}
