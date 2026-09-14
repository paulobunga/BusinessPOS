import Database from 'better-sqlite3'

export function runRemovePaymentIdMigration(db: Database.Database) {
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (appliedVersions.has(14)) return

  const cols = db.prepare("PRAGMA table_info(payment_allocations)").all() as { name: string }[]

  db.pragma('foreign_keys = OFF')
  db.transaction(() => {
    if (cols.some(c => c.name === 'payment_id')) {
      db.exec('ALTER TABLE payment_allocations DROP COLUMN payment_id')
    }
    const categoryCols = db.prepare("PRAGMA table_info(categories)").all() as { name: string }[]
  if (categoryCols.some(c => c.name === 'purchase_only')) {
    db.exec("UPDATE categories SET purchase_only = 1 WHERE name IN ('Stock', 'Raw Inputs')")
  }
    db.exec('INSERT INTO schema_migrations (version) VALUES (14)')
  })()
  db.pragma('foreign_keys = ON')
}
