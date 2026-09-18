import Database from 'better-sqlite3'

export function runPerLineCaptainMigration(db: Database.Database) {
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))
  if (appliedVersions.has(26)) return

  db.transaction(() => {
    const cols = db.prepare('PRAGMA table_info(sale_items)').all() as { name: string }[]
    if (!cols.some(c => c.name === 'is_captain')) {
      db.exec('ALTER TABLE sale_items ADD COLUMN is_captain INTEGER NOT NULL DEFAULT 0')
    }

    db.exec('INSERT INTO schema_migrations (version) VALUES (26)')
  })()
}
