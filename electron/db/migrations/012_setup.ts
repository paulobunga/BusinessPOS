import Database from 'better-sqlite3'

export function runSetupMigration(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (!appliedVersions.has(12)) {
    db.exec(`
      CREATE TABLE item_yield_defaults (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        raw_input_id INTEGER NOT NULL REFERENCES menu_items(id),
        meal_id      INTEGER NOT NULL REFERENCES menu_items(id),
        portions     INTEGER NOT NULL CHECK (portions > 0),
        UNIQUE (raw_input_id, meal_id)
      );

      CREATE INDEX idx_yield_defaults_raw ON item_yield_defaults(raw_input_id);
    `)
    db.exec(`INSERT INTO schema_migrations (version) VALUES (12);`)
  }
}