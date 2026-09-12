import Database from 'better-sqlite3'

export function runMenuSeedMigration(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (!appliedVersions.has(9)) {
    db.transaction(() => {
      const catInsert = db.prepare('INSERT INTO categories (name, kind, sort_order) VALUES (?, ?, ?)')
      const getOrCreateCat = (name: string, kind: 'priced' | 'free', sort: number): number => {
        const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name) as { id: number } | undefined
        return existing ? existing.id : Number(catInsert.run(name, kind, sort).lastInsertRowid)
      }
      const proteins = getOrCreateCat('Proteins', 'priced', 0)
      const starches = getOrCreateCat('Starches', 'free', 1)
      const boiled = getOrCreateCat('Boiled Plates', 'priced', 2)
      const combos = getOrCreateCat('Combos', 'priced', 3)
      const drinks = getOrCreateCat('Beverages', 'priced', 4)

      const itemInsert = db.prepare(
        'INSERT INTO menu_items (category_id, name, selling_price_cents, cost_price_cents, out_of_stock, active) VALUES (?, ?, ?, ?, 0, 1)'
      )
      const insertItem = (catId: number, name: string, selling: number, cost: number) => {
        const existing = db.prepare('SELECT id FROM menu_items WHERE name = ?').get(name) as { id: number } | undefined
        if (!existing) itemInsert.run(catId, name, selling, cost)
      }

      insertItem(proteins, 'Goat Meat', 10000, 6000)
      insertItem(proteins, 'Chicken', 8000, 5000)
      insertItem(proteins, 'Fish', 7000, 4000)
      insertItem(starches, 'Banana', 0, 0)
      insertItem(starches, 'Cassava', 0, 0)
      insertItem(starches, 'Plantain', 0, 0)
      insertItem(starches, 'Irish Potatoes', 0, 0)

      insertItem(boiled, 'Chicken (Boiled)', 10000, 0)
      insertItem(boiled, 'Goat (Boiled)', 10000, 0)
      insertItem(boiled, 'Kigere/Molokoni', 10000, 0)
      insertItem(combos, 'Chicken & Chips', 12000, 0)
      insertItem(combos, 'Chapati & Beef Sauce', 5000, 0)
      insertItem(combos, 'Chips & Eggs', 5000, 0)
      insertItem(combos, 'Chips & Sausages', 6000, 0)
      insertItem(drinks, 'African Tea', 5000, 0)
      insertItem(drinks, 'Masala Tea', 3000, 0)
      insertItem(drinks, 'Dawa Tea', 5000, 0)

      db.exec(`INSERT INTO schema_migrations (version) VALUES (9);`)
    })()
  }
}