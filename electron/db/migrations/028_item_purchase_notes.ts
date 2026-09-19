import Database from 'better-sqlite3'

export function runItemPurchaseNotesMigration(db: Database.Database) {
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))
  if (appliedVersions.has(28)) return

  db.transaction(() => {
    // item_purchases is created by migration 007/022, which always run first.
    const cols = db.prepare('PRAGMA table_info(item_purchases)').all() as { name: string }[]
    if (!cols.some(c => c.name === 'notes')) {
      db.exec('ALTER TABLE item_purchases ADD COLUMN notes TEXT')
    }

    db.exec('INSERT INTO schema_migrations (version) VALUES (28)')
  })()
}
