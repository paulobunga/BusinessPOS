import Database from 'better-sqlite3'

export function runReimbursementsMigration(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (!appliedVersions.has(5)) {
    db.exec(`
      CREATE TABLE reimbursements_new (
        id INTEGER PRIMARY KEY,
        description TEXT,
        amount_cents INTEGER NOT NULL,
        till_session_id INTEGER REFERENCES till_sessions(id),
        created_by INTEGER REFERENCES users(id),
        date TEXT NOT NULL DEFAULT (date('now')),
        paid_to TEXT NOT NULL DEFAULT 'till' CHECK(paid_to IN ('till','mpesa')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO reimbursements_new (id, amount_cents, created_by, created_at, date, paid_to)
      SELECT id, amount_cents, created_by, created_at, DATE(created_at), 'till'
      FROM reimbursements;

      DROP TABLE reimbursements;

      ALTER TABLE reimbursements_new RENAME TO reimbursements;

      INSERT INTO schema_migrations (version) VALUES (5);
    `)
  }
}
