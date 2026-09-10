import Database from 'better-sqlite3'

export function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (!appliedVersions.has(1)) {
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('cashier','manager')),
        pin_hash TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE customers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        phone TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE proteins (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        selling_price_cents INTEGER NOT NULL,
        cost_price_cents INTEGER NOT NULL,
        category TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        out_of_stock INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE starches (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE till_sessions (
        id INTEGER PRIMARY KEY,
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        opening_float_cents INTEGER NOT NULL,
        expected_cash_cents INTEGER,
        counted_cash_cents INTEGER,
        variance_cents INTEGER,
        opened_by INTEGER REFERENCES users(id),
        closed_by INTEGER REFERENCES users(id)
      );

      CREATE TABLE sales (
        id INTEGER PRIMARY KEY,
        till_session_id INTEGER REFERENCES till_sessions(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        status TEXT NOT NULL CHECK(status IN ('completed','unpaid','voided','refunded')),
        subtotal_cents INTEGER NOT NULL,
        discount_cents INTEGER NOT NULL DEFAULT 0,
        tax_cents INTEGER NOT NULL DEFAULT 0,
        total_cents INTEGER NOT NULL,
        payment_source TEXT NOT NULL DEFAULT 'cash' CHECK(payment_source IN ('cash','unpaid')),
        customer_id INTEGER REFERENCES customers(id),
        starch_id INTEGER REFERENCES starches(id),
        created_by INTEGER REFERENCES users(id),
        voided_at TEXT,
        voided_by INTEGER REFERENCES users(id),
        void_reason TEXT
      );

      CREATE TABLE sale_items (
        id INTEGER PRIMARY KEY,
        sale_id INTEGER NOT NULL REFERENCES sales(id),
        protein_id INTEGER REFERENCES proteins(id),
        name_snapshot TEXT NOT NULL,
        unit_price_cents INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        line_total_cents INTEGER NOT NULL
      );

      CREATE TABLE payments (
        id INTEGER PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        amount_cents INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_by INTEGER REFERENCES users(id),
        note TEXT
      );

      CREATE TABLE payment_allocations (
        id INTEGER PRIMARY KEY,
        payment_id INTEGER NOT NULL REFERENCES payments(id),
        sale_id INTEGER NOT NULL REFERENCES sales(id),
        amount_cents INTEGER NOT NULL
      );

      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY,
        till_session_id INTEGER REFERENCES till_sessions(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        category TEXT NOT NULL,
        description TEXT,
        amount_cents INTEGER NOT NULL,
        payment_source TEXT NOT NULL DEFAULT 'till' CHECK(payment_source IN ('till','personal')),
        reference TEXT,
        created_by INTEGER REFERENCES users(id),
        deleted_at TEXT,
        deleted_by INTEGER REFERENCES users(id)
      );

      CREATE TABLE reimbursements (
        id INTEGER PRIMARY KEY,
        amount_cents INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_by INTEGER REFERENCES users(id),
        note TEXT
      );

      CREATE TABLE protein_purchases (
        id INTEGER PRIMARY KEY,
        protein_id INTEGER NOT NULL REFERENCES proteins(id),
        purchase_date TEXT NOT NULL,
        quantity_kg REAL NOT NULL,
        cost_cents INTEGER NOT NULL,
        expected_yield INTEGER NOT NULL,
        created_by INTEGER REFERENCES users(id)
      );

      CREATE TABLE cook_events (
        id INTEGER PRIMARY KEY,
        protein_id INTEGER NOT NULL REFERENCES proteins(id),
        cook_date TEXT NOT NULL,
        portions_cooked INTEGER NOT NULL,
        created_by INTEGER REFERENCES users(id)
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      INSERT INTO schema_migrations (version) VALUES (1);
    `)
  }
}
