import Database from 'better-sqlite3'
import crypto from 'crypto'

export function runPinUniquenessMigration(db: Database.Database) {
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))
  if (appliedVersions.has(16)) return

  db.transaction(() => {
    // Safeguard: existing data may have duplicate pins (e.g. dev DBs seeded
    // before uniqueness was enforced). Regenerate a random hash for all but the
    // lowest-id row per duplicate so the unique index can be created.
    const dups = db.prepare(
      'SELECT pin_hash FROM users GROUP BY pin_hash HAVING COUNT(*) > 1'
    ).all() as { pin_hash: string }[]
    for (const { pin_hash } of dups) {
      const ids = db.prepare('SELECT id FROM users WHERE pin_hash = ? ORDER BY id').all(pin_hash) as { id: number }[]
      for (const { id } of ids.slice(1)) {
        const newHash = crypto.randomBytes(32).toString('hex')
        db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(newHash, id)
      }
    }
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_pin_hash ON users(pin_hash)')
    db.exec('INSERT INTO schema_migrations (version) VALUES (16)')
  })()
}