import Database from 'better-sqlite3'

export function runInventoryV2Migration(db: Database.Database) {
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (!appliedVersions.has(18)) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE units (
          id        INTEGER PRIMARY KEY,
          name      TEXT NOT NULL UNIQUE,
          unit_type TEXT NOT NULL CHECK (unit_type IN ('weight','volume','count'))
        );

        CREATE TABLE staff (
          id        INTEGER PRIMARY KEY,
          name      TEXT NOT NULL,
          role      TEXT NOT NULL CHECK (role IN ('admin','cashier','cook')),
          pin_hash  TEXT,
          is_active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE ingredients (
          id                INTEGER PRIMARY KEY,
          name              TEXT NOT NULL UNIQUE,
          base_unit_id      INTEGER NOT NULL REFERENCES units(id),
          reorder_level     REAL NOT NULL DEFAULT 0,
          current_stock     REAL NOT NULL DEFAULT 0,
          avg_unit_cost_ugx INTEGER NOT NULL DEFAULT 0,
          is_active         INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE suppliers (
          id       INTEGER PRIMARY KEY,
          name     TEXT NOT NULL,
          phone    TEXT,
          location TEXT
        );

        CREATE TABLE market_purchases (
          id               INTEGER PRIMARY KEY,
          purchase_date    TEXT NOT NULL DEFAULT (datetime('now')),
          supplier_id      INTEGER REFERENCES suppliers(id),
          recorded_by      INTEGER NOT NULL REFERENCES staff(id),
          payment_source   TEXT NOT NULL DEFAULT 'till' CHECK (payment_source IN ('till','personal')),
          till_session_id  INTEGER REFERENCES till_sessions(id),
          total_cost_ugx   INTEGER NOT NULL DEFAULT 0,
          notes            TEXT
        );

        CREATE TABLE purchase_items (
          id                    INTEGER PRIMARY KEY,
          purchase_id           INTEGER NOT NULL REFERENCES market_purchases(id) ON DELETE CASCADE,
          ingredient_id         INTEGER NOT NULL REFERENCES ingredients(id),
          purchase_unit_id      INTEGER NOT NULL REFERENCES units(id),
          quantity_purchased    REAL NOT NULL,
          unit_price_ugx        INTEGER NOT NULL,
          total_price_ugx       INTEGER NOT NULL,
          conversion_to_base    REAL NOT NULL DEFAULT 1,
          quantity_in_base_unit REAL NOT NULL
        );

        CREATE TABLE stock_movements (
          id              INTEGER PRIMARY KEY,
          ingredient_id   INTEGER NOT NULL REFERENCES ingredients(id),
          movement_type   TEXT NOT NULL CHECK (movement_type IN
                            ('purchase_in','production_use','sale_out','restock','wastage','adjustment')),
          quantity        REAL NOT NULL,
          reference_table TEXT,
          reference_id    INTEGER,
          balance_after   REAL NOT NULL,
          created_at      TEXT NOT NULL DEFAULT (datetime('now')),
          created_by      INTEGER REFERENCES staff(id),
          notes           TEXT
        );

        CREATE TABLE stock_counts (
          id            INTEGER PRIMARY KEY,
          ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
          counted_at    TEXT NOT NULL DEFAULT (datetime('now')),
          counted_by    INTEGER NOT NULL REFERENCES staff(id),
          system_stock  REAL NOT NULL,
          actual_stock  REAL NOT NULL,
          variance      REAL GENERATED ALWAYS AS (actual_stock - system_stock) STORED
        );

        CREATE TRIGGER trg_stock_cache
        AFTER INSERT ON stock_movements
        BEGIN
          UPDATE ingredients SET current_stock = NEW.balance_after WHERE id = NEW.ingredient_id;
        END;

        CREATE INDEX idx_purchase_item_ingredient     ON purchase_items(ingredient_id);
        CREATE INDEX idx_stock_movement_ingredient    ON stock_movements(ingredient_id, created_at);
        CREATE INDEX idx_stock_movement_reference     ON stock_movements(reference_table, reference_id);

        INSERT INTO staff (name, role)
        SELECT name, CASE WHEN role='manager' THEN 'admin' ELSE role END FROM users
        WHERE NOT EXISTS (SELECT 1 FROM staff);

        INSERT INTO staff (name, role)
        SELECT 'Admin', 'admin' WHERE NOT EXISTS (SELECT 1 FROM staff);

        INSERT INTO schema_migrations (version) VALUES (18);
      `)
    })()
  }
}