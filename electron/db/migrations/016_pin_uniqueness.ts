import Database from 'better-sqlite3'

export function runPinUniquenessMigration(db: Database.Database) {
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))
  if (appliedVersions.has(16)) return

  db.transaction(() => {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_pin_hash ON users(pin_hash)')
    db.exec('INSERT INTO schema_migrations (version) VALUES (16)')
  })()
}