import Database from 'better-sqlite3'

export function runPurchaseYieldsMigration(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (!appliedVersions.has(11)) {
    db.transaction(() => {
      db.exec(`
        ALTER TABLE item_purchases ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));

        CREATE TABLE item_purchase_yields (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          purchase_id INTEGER NOT NULL REFERENCES item_purchases(id) ON DELETE CASCADE,
          item_id INTEGER NOT NULL REFERENCES menu_items(id),
          portions INTEGER NOT NULL DEFAULT 1,
          cost_cents INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX idx_purchase_yields_purchase ON item_purchase_yields(purchase_id);
      `)

      const legacy = db.prepare(`
        SELECT id, yield_item_id, expected_yield, quantity_kg, cost_cents
        FROM item_purchases
        WHERE yield_item_id IS NOT NULL
      `).all() as { id: number; yield_item_id: number; expected_yield: number; quantity_kg: number; cost_cents: number }[]

      const insertYield = db.prepare(
        'INSERT INTO item_purchase_yields (purchase_id, item_id, portions, cost_cents) VALUES (?, ?, ?, ?)'
      )
      for (const p of legacy) {
        const portions = Math.max(1, Math.round(p.expected_yield * p.quantity_kg))
        insertYield.run(p.id, p.yield_item_id, portions, p.cost_cents)
      }

      db.exec(`INSERT INTO schema_migrations (version) VALUES (11);`)
    })()
  }
}