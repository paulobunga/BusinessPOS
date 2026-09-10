import Database from 'better-sqlite3'

export function runExpensesMigration(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (!appliedVersions.has(3)) {
    db.exec(`
      CREATE TABLE expenses_new (
        id INTEGER PRIMARY KEY,
        till_session_id INTEGER REFERENCES till_sessions(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        date TEXT NOT NULL DEFAULT (date('now')),
        category TEXT NOT NULL,
        description TEXT,
        amount_cents INTEGER NOT NULL,
        payment_source TEXT NOT NULL DEFAULT 'till' CHECK(payment_source IN ('till','personal','mpesa')),
        reference TEXT,
        created_by INTEGER REFERENCES users(id),
        deleted_at TEXT,
        deleted_by INTEGER REFERENCES users(id)
      );

      INSERT INTO expenses_new (id, till_session_id, created_at, date, category, description, amount_cents, payment_source, reference, created_by, deleted_at, deleted_by)
      SELECT id, till_session_id, created_at, DATE(created_at), category, description, amount_cents, payment_source, reference, created_by, deleted_at, deleted_by
      FROM expenses;

      DROP TABLE expenses;

      ALTER TABLE expenses_new RENAME TO expenses;

      INSERT INTO schema_migrations (version) VALUES (3);
    `)
  }
}
