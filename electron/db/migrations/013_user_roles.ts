import Database from 'better-sqlite3'

export function runUserRolesMigration(db: Database.Database) {
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))
  if (appliedVersions.has(13)) return

  db.pragma('foreign_keys = OFF')
  db.pragma('legacy_alter_table = ON')
  db.transaction(() => {
    db.exec(`
      ALTER TABLE users RENAME TO users_old;
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin','cashier')),
        pin_hash TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO users (id, name, role, pin_hash, active)
        SELECT id, name, CASE WHEN role = 'manager' THEN 'admin' ELSE role END, pin_hash, active FROM users_old;
      DROP TABLE users_old;
    `)
  })()
  db.pragma('legacy_alter_table = OFF')
  db.pragma('foreign_keys = ON')

  const fkCheck = db.prepare('PRAGMA foreign_key_check').all()
  if (fkCheck.length > 0) {
    throw new Error(`Foreign key check failed after migration 013: ${fkCheck.length} violations`)
  }

  db.exec(`INSERT INTO schema_migrations (version) VALUES (13);`)
}
