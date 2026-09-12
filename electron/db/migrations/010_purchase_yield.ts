import Database from 'better-sqlite3'

export function runPurchaseYieldMigration(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (!appliedVersions.has(10)) {
    db.transaction(() => {
      db.exec(`
        ALTER TABLE categories ADD COLUMN purchase_only INTEGER NOT NULL DEFAULT 0;

        ALTER TABLE menu_items ADD COLUMN purchase_unit TEXT NOT NULL DEFAULT 'kg';

        ALTER TABLE item_purchases ADD COLUMN unit TEXT NOT NULL DEFAULT 'kg';
        ALTER TABLE item_purchases ADD COLUMN yield_item_id INTEGER REFERENCES menu_items(id);
      `)
      db.exec(`INSERT INTO schema_migrations (version) VALUES (10);`)
    })()
  }
}