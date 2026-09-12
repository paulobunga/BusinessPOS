import Database from 'better-sqlite3'

export function runMoneyWholeUgxMigration(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (!appliedVersions.has(8)) {
    db.transaction(() => {
      // Expenses and reimbursements were stored as true cents (input * 100).
      // Convert to whole UGX to match the rest of the app.
      db.exec(`
        UPDATE expenses SET amount_cents = amount_cents / 100
        WHERE amount_cents >= 100 AND amount_cents % 100 = 0;

        UPDATE reimbursements SET amount_cents = amount_cents / 100
        WHERE amount_cents >= 100 AND amount_cents % 100 = 0;
      `)

      db.exec(`INSERT INTO schema_migrations (version) VALUES (8);`)
    })()
  }
}