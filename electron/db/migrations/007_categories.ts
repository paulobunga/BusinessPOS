import Database from 'better-sqlite3'

export function runCategoriesMigration(db: Database.Database) {
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (!appliedVersions.has(7)) {
    db.pragma('foreign_keys = OFF')

    db.transaction(() => {
      db.exec(`
        CREATE TABLE categories (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          name       TEXT NOT NULL UNIQUE,
          kind       TEXT NOT NULL CHECK (kind IN ('priced','free')),
          sort_order INTEGER NOT NULL DEFAULT 0,
          active     INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE menu_items (
          id                  INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id         INTEGER NOT NULL REFERENCES categories(id),
          name                TEXT NOT NULL,
          selling_price_cents INTEGER NOT NULL DEFAULT 0,
          cost_price_cents    INTEGER NOT NULL DEFAULT 0,
          out_of_stock        INTEGER NOT NULL DEFAULT 0,
          active              INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE attribute_defs (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER REFERENCES categories(id),
          name        TEXT NOT NULL,
          type        TEXT NOT NULL CHECK (type IN ('text','number','boolean')),
          sort_order  INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE item_attribute_values (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id       INTEGER NOT NULL REFERENCES menu_items(id),
          attr_def_id   INTEGER NOT NULL REFERENCES attribute_defs(id),
          value_text    TEXT,
          value_number  REAL,
          value_boolean INTEGER,
          UNIQUE (item_id, attr_def_id)
        );

        CREATE INDEX idx_menu_items_category ON menu_items(category_id);
        CREATE INDEX idx_item_attr_values_item ON item_attribute_values(item_id);

        INSERT INTO categories (name, kind, sort_order) VALUES ('Proteins','priced',0), ('Starches','free',1);
      `)

      const catProteins = db.prepare('SELECT id FROM categories WHERE name = ?').get('Proteins') as { id: number }
      const catStarches = db.prepare('SELECT id FROM categories WHERE name = ?').get('Starches') as { id: number }

      const insertItem = db.prepare(
        'INSERT INTO menu_items (category_id, name, selling_price_cents, cost_price_cents, out_of_stock, active) VALUES (?, ?, ?, ?, ?, ?)'
      )

      const mapProtein = new Map<number, number>()
      const mapStarch = new Map<number, number>()

      const proteins = db.prepare('SELECT id, name, selling_price_cents, cost_price_cents, out_of_stock, active FROM proteins ORDER BY id').all() as {
        id: number; name: string; selling_price_cents: number; cost_price_cents: number; out_of_stock: number; active: number
      }[]
      for (const p of proteins) {
        const info = insertItem.run(catProteins.id, p.name, p.selling_price_cents, p.cost_price_cents, p.out_of_stock, p.active)
        mapProtein.set(p.id, Number(info.lastInsertRowid))
      }

      const starches = db.prepare('SELECT id, name, active FROM starches ORDER BY id').all() as {
        id: number; name: string; active: number
      }[]
      for (const s of starches) {
        const info = insertItem.run(catStarches.id, s.name, 0, 0, 0, s.active)
        mapStarch.set(s.id, Number(info.lastInsertRowid))
      }

      db.exec(`
        ALTER TABLE sale_items ADD COLUMN item_id INTEGER REFERENCES menu_items(id);
        ALTER TABLE sale_items ADD COLUMN free_item_id INTEGER REFERENCES menu_items(id);
      `)

      const saleItems = db.prepare('SELECT id, protein_id, starch_id FROM sale_items').all() as {
        id: number; protein_id: number | null; starch_id: number | null
      }[]
      const updateSaleItem = db.prepare('UPDATE sale_items SET item_id = ?, free_item_id = ? WHERE id = ?')
      for (const si of saleItems) {
        const itemId = si.protein_id != null ? mapProtein.get(si.protein_id) ?? null : null
        const freeItemId = si.starch_id != null ? mapStarch.get(si.starch_id) ?? null : null
        updateSaleItem.run(itemId, freeItemId, si.id)
      }

      db.exec(`
        ALTER TABLE sale_items DROP COLUMN protein_id;
        ALTER TABLE sale_items DROP COLUMN starch_id;
      `)

      db.exec(`ALTER TABLE sales DROP COLUMN starch_id;`)

      db.exec(`
        CREATE TABLE item_purchases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id INTEGER NOT NULL REFERENCES menu_items(id),
          purchase_date TEXT NOT NULL,
          quantity_kg REAL NOT NULL,
          cost_cents INTEGER NOT NULL,
          expected_yield INTEGER NOT NULL,
          created_by INTEGER REFERENCES users(id)
        );
      `)

      const purchases = db.prepare(
        'SELECT id, protein_id, purchase_date, quantity_kg, cost_cents, expected_yield, created_by FROM protein_purchases'
      ).all() as {
        id: number; protein_id: number; purchase_date: string; quantity_kg: number; cost_cents: number; expected_yield: number; created_by: number | null
      }[]
      const insertPurchase = db.prepare(
        'INSERT INTO item_purchases (item_id, purchase_date, quantity_kg, cost_cents, expected_yield, created_by) VALUES (?, ?, ?, ?, ?, ?)'
      )
      for (const p of purchases) {
        const itemId = mapProtein.get(p.protein_id) ?? null
        insertPurchase.run(itemId, p.purchase_date, p.quantity_kg, p.cost_cents, p.expected_yield, p.created_by)
      }

      db.exec(`DROP TABLE protein_purchases;`)

      db.exec(`ALTER TABLE waste ADD COLUMN item_id INTEGER REFERENCES menu_items(id);`)
      const wasteRows = db.prepare('SELECT id, protein_id FROM waste').all() as { id: number; protein_id: number }[]
      const updateWaste = db.prepare('UPDATE waste SET item_id = ? WHERE id = ?')
      for (const w of wasteRows) {
        updateWaste.run(mapProtein.get(w.protein_id) ?? null, w.id)
      }
      db.exec(`ALTER TABLE waste DROP COLUMN protein_id;`)

      db.exec(`ALTER TABLE cook_events ADD COLUMN item_id INTEGER REFERENCES menu_items(id);`)
      const cookRows = db.prepare('SELECT id, protein_id FROM cook_events').all() as { id: number; protein_id: number }[]
      const updateCook = db.prepare('UPDATE cook_events SET item_id = ? WHERE id = ?')
      for (const c of cookRows) {
        updateCook.run(mapProtein.get(c.protein_id) ?? null, c.id)
      }
      db.exec(`ALTER TABLE cook_events DROP COLUMN protein_id;`)

      db.exec(`
        DROP TABLE proteins;
        DROP TABLE starches;
      `)
    })()

    db.pragma('foreign_keys = ON')

    const fkCheck = db.prepare('PRAGMA foreign_key_check').all()
    if (fkCheck.length > 0) {
      throw new Error(`Foreign key check failed after migration 007: ${fkCheck.length} violations`)
    }

    const legacyTables = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('proteins','starches','protein_purchases')`
    ).all() as { name: string }[]
    if (legacyTables.length > 0) {
      throw new Error(`Legacy tables still exist after migration 007: ${legacyTables.map(t => t.name).join(', ')}`)
    }

    const saleItemCols = db.prepare('PRAGMA table_info(sale_items)').all() as { name: string }[]
    const colNames = new Set(saleItemCols.map(c => c.name))
    if (!colNames.has('item_id') || !colNames.has('free_item_id')) {
      throw new Error('sale_items missing item_id or free_item_id columns after migration 007')
    }

    db.exec(`INSERT INTO schema_migrations (version) VALUES (7);`)
  }
}
