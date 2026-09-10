import Database from 'better-sqlite3'

export function runSalesExtrasMigration(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (!appliedVersions.has(2)) {
    db.exec(`
      ALTER TABLE sales ADD COLUMN discount_reason TEXT;
      ALTER TABLE sales ADD COLUMN debt_cents INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE sales ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash','debt','mixed'));
      ALTER TABLE sales ADD COLUMN customer_name TEXT;
      ALTER TABLE sale_items ADD COLUMN starch_id INTEGER REFERENCES starches(id);

      INSERT INTO schema_migrations (version) VALUES (2);
    `)
  }
}