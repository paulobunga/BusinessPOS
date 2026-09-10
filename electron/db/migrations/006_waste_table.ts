import Database from 'better-sqlite3'

export function runWasteMigration(db: Database.Database) {
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (!appliedVersions.has(6)) {
    db.exec(`
      CREATE TABLE waste (
        id INTEGER PRIMARY KEY,
        protein_id INTEGER NOT NULL REFERENCES proteins(id),
        quantity INTEGER NOT NULL,
        estimated_value_cents INTEGER NOT NULL,
        reason TEXT NOT NULL CHECK(reason IN ('staff_meal', 'spoiled', 'other')),
        waste_date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO schema_migrations (version) VALUES (6);
    `)
  }
}
