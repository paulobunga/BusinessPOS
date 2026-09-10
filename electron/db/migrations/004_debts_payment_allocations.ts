import Database from 'better-sqlite3'

export function runDebtsMigration(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (!appliedVersions.has(4)) {
    const cols = db.prepare("PRAGMA table_info(payment_allocations)").all() as { name: string }[]
    const colNames = new Set(cols.map(c => c.name))

    if (!colNames.has('payment_method')) {
      db.exec(`ALTER TABLE payment_allocations ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash'`)
    }
    if (!colNames.has('till_session_id')) {
      db.exec(`ALTER TABLE payment_allocations ADD COLUMN till_session_id INTEGER REFERENCES till_sessions(id)`)
    }
    if (!colNames.has('created_by')) {
      db.exec(`ALTER TABLE payment_allocations ADD COLUMN created_by INTEGER REFERENCES users(id)`)
    }
    if (!colNames.has('created_at')) {
      db.exec(`ALTER TABLE payment_allocations ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'))`)
    }

    db.exec(`INSERT INTO schema_migrations (version) VALUES (4)`)
  }
}
