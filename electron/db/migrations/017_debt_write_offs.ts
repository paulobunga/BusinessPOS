import Database from 'better-sqlite3'

export function runDebtWriteOffsMigration(db: Database.Database) {
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))
  if (appliedVersions.has(17)) return

  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS debt_write_offs (
        id INTEGER PRIMARY KEY,
        sale_id INTEGER NOT NULL REFERENCES sales(id),
        amount_cents INTEGER NOT NULL,
        reason TEXT NOT NULL,
        written_by INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_debt_write_offs_sale ON debt_write_offs(sale_id);
    `)

    const cols = db.prepare("PRAGMA table_info(payment_allocations)").all() as { name: string }[]
    if (!cols.some(c => c.name === 'note')) {
      db.exec(`ALTER TABLE payment_allocations ADD COLUMN note TEXT`)
    }

    const salesCols = db.prepare("PRAGMA table_info(sales)").all() as { name: string }[]
    if (!salesCols.some(c => c.name === 'sale_kind')) {
      db.exec(`ALTER TABLE sales ADD COLUMN sale_kind TEXT NOT NULL DEFAULT 'sale'`)
    }
    if (!salesCols.some(c => c.name === 'service_description')) {
      db.exec(`ALTER TABLE sales ADD COLUMN service_description TEXT`)
    }

    db.exec('INSERT INTO schema_migrations (version) VALUES (17)')
  })()
}