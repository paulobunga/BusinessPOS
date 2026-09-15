import Database from 'better-sqlite3'

export function runInventoryV2SeedMigration(db: Database.Database) {
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (!appliedVersions.has(19)) {
    db.transaction(() => {
      db.exec(`
        INSERT INTO units (name, unit_type) VALUES
        ('Litre','volume'), ('Kg','weight'), ('Bag','weight'),
        ('Piece','count'), ('Finger','count'), ('Gram','weight');

        INSERT INTO ingredients (name, base_unit_id, reorder_level) VALUES
        ('Cooking Oil',    (SELECT id FROM units WHERE name='Litre'),  2),
        ('Tomatoes',       (SELECT id FROM units WHERE name='Kg'),     5),
        ('Irish Potatoes', (SELECT id FROM units WHERE name='Piece'),  20),
        ('Matooke Fingers',(SELECT id FROM units WHERE name='Finger'), 40),
        ('Cassava',        (SELECT id FROM units WHERE name='Piece'),  15),
        ('Chicken',        (SELECT id FROM units WHERE name='Piece'),  2),
        ('Goat Meat',      (SELECT id FROM units WHERE name='Kg'),     3),
        ('Beef',           (SELECT id FROM units WHERE name='Kg'),     3),
        ('Sugar',          (SELECT id FROM units WHERE name='Kg'),     2);

        INSERT INTO schema_migrations (version) VALUES (19);
      `)
    })()
  }
}