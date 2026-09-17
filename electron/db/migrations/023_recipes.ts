import Database from 'better-sqlite3'

export function runRecipesMigration(db: Database.Database) {
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (!appliedVersions.has(23)) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS recipes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          servings INTEGER NOT NULL DEFAULT 1,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `)

      db.exec(`
        CREATE TABLE IF NOT EXISTS recipe_ingredients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
          item_id INTEGER REFERENCES menu_items(id),
          item_name TEXT NOT NULL,
          quantity REAL NOT NULL DEFAULT 1,
          unit TEXT NOT NULL DEFAULT 'pcs',
          sort_order INTEGER NOT NULL DEFAULT 0
        );
      `)

      db.exec(`INSERT INTO schema_migrations (version) VALUES (23);`)
    })()
  }
}
