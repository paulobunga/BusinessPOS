# Kitchen POS v2 — Inventory & Procurement Foundation (Plan 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the v2 raw-inventory and procurement layer (units, ingredients, suppliers, market purchases, stock ledger, stock counts) via a purely additive migration, with repositories and passing tests — without touching any legacy tables or breaking the existing app.

**Architecture:** Two new self-guarded migrations (`018` schema + `019` seed) create the tables that have **no name collision** with the existing schema. New repos (`staffRepo`, `ingredientsRepo`, `stockRepo`, `procurementRepo`) sit next to the existing legacy repos and use the same `getDb()` singleton. The `stock_movements` ledger is the single source of truth; `ingredients.current_stock` is a trigger-maintained cache; purchases update `avg_unit_cost_ugx` as an integer weighted average. Existing tables/repos/pages are untouched this plan.

**Tech Stack:** Electron main process, better-sqlite3, TypeScript, Vitest (per repo convention `electron/**/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-09-15-kitchen-pos-model-v2-design.md` (§2–§5 A/D, §8)

> **Decomposition note:** Later plans implement v2 menu/recipes/batches (Plan 2), v2 orders/payments + legacy ports (Plan 3), and IPC/preload + UI (Plan 4). This plan deliberately does **not** create tables that collide with existing names (`menu_items`, `expenses`, `customers`, `till_sessions`, `payments`, `sales`).

## Global Constraints

- **Money is INTEGER, whole UGX** (spec D1). Column names end in `_ugx`. Never use REAL/NUMERIC for money.
- **Quantities are REAL** (spec D2): Kg, litres, pieces, bag conversions. Round quantity arithmetic to 4 decimals.
- **The ledger is append-only and authoritative** (spec D3, invariant 1): never `UPDATE`/`DELETE` a row in `stock_movements`; correction = new signed row. `ingredients.current_stock` is written **only** by the `trg_stock_cache` trigger, never by app code directly.
- **No negative stock** (spec invariant 2): a movement whose computed `balance_after < 0` must throw.
- **Till-paid procurement requires a session** (spec invariant 5): `payment_source='till'` with no `till_session_id` → throw.
- PK columns are `id` (repo-wide convention); FK columns are `<table>_id`.
- Do not modify any legacy table or existing repository file in this plan (exception: `electron/db/index.ts` for migration registration + `DATA_TABLES`).
- Keep `npm test` green (existing tests must keep passing).
- Import `.js` extensions in anything compiled for the main process (`electron/db/index.ts`); test files import without extensions (repo convention).
- Follow existing repo patterns: migrations are self-guarded (`schema_migrations.version`), repos are plain objects over `getDb()`.

---

### Task 1: v2 base schema migration (018)

> **Renumbered (twice, controller ruling R2/R4):** version 16 is taken by `016_pin_uniqueness.ts` (committed at HEAD); version 17 is reserved by the in-progress untracked `017_debt_write_offs.ts` (user's other work) — so the v2 schema migration is version **018** and the seed migration is version **019**. Neither user file is touched.

**Files:**
- Create: `electron/db/migrations/018_inventory_v2.ts`
- Modify: `electron/db/index.ts` (import + call + `DATA_TABLES`)
- Test: `electron/db/__tests__/inventory-v2.test.ts`

**Interfaces:**
- Consumes: `Database` from `better-sqlite3`; `schema_migrations` table (created by `001_initial`).
- Produces: `runInventoryV2Migration(db: Database.Database): void` — creates `units`, `staff`, `ingredients`, `suppliers`, `market_purchases`, `purchase_items`, `stock_movements`, `stock_counts`, trigger `trg_stock_cache`, indices, and seeds a fallback admin staff row if `staff` is empty.

- [ ] **Step 1: Write the failing structural test**

Create `electron/db/__tests__/inventory-v2.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { runMigrations } from '../migrations/001_initial'
import { runInventoryV2Migration } from '../migrations/018_inventory_v2'

const TEST_DB_PATH = path.join(__dirname, '..', '__test_inv_v2.sqlite')

describe('v2 inventory schema', () => {
  let db: Database.Database

  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
    db = new Database(TEST_DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    runInventoryV2Migration(db)
  })

  afterAll(() => {
    db.close()
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(TEST_DB_PATH + suffix)) fs.unlinkSync(TEST_DB_PATH + suffix)
    }
  })

  test('creates all v2 base tables', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[]
    for (const t of ['units', 'staff', 'ingredients', 'suppliers', 'market_purchases', 'purchase_items', 'stock_movements', 'stock_counts']) {
      expect(tables.map(r => r.name)).toContain(t)
    }
  })

  test('registers migration as version 16', () => {
    const row = db.prepare("SELECT version FROM schema_migrations WHERE version = 18").get() as { version: number } | undefined
    expect(row?.version).toBe(18)
  })

  test('trg_stock_cache keeps ingredients.current_stock in sync', () => {
    db.prepare("INSERT INTO ingredients (name, base_unit_id) VALUES ('Test Oil', (SELECT id FROM units WHERE name='Litre'))").run()
    const ing = db.prepare('SELECT id FROM ingredients WHERE name = ?').get('Test Oil') as { id: number }
    db.prepare(
      "INSERT INTO stock_movements (ingredient_id, movement_type, quantity, balance_after) VALUES (?, 'purchase_in', 2.5, 2.5)"
    ).run(ing.id)
    db.prepare(
      "INSERT INTO stock_movements (ingredient_id, movement_type, quantity, balance_after) VALUES (?, 'sale_out', -0.5, 2.0)"
    ).run(ing.id)
    const after = db.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get(ing.id) as { current_stock: number }
    expect(after.current_stock).toBe(2.0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/db/__tests__/inventory-v2.test.ts`
Expected: FAIL — "Cannot find module '../migrations/018_inventory_v2'".

- [ ] **Step 3: Write the migration**

Create `electron/db/migrations/018_inventory_v2.ts`:

```ts
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
```

- [ ] **Step 4: Register migration in `electron/db/index.ts`**

Add import:
```ts
import { runInventoryV2Migration } from './migrations/018_inventory_v2.js'
```
Add call after `runPinUniquenessMigration(db)` (keep call order ascending by version):
```ts
    runInventoryV2Migration(db)
```
Add to `DATA_TABLES`:
```ts
  'staff',
  'units',
  'ingredients',
  'suppliers',
  'market_purchases',
  'purchase_items',
  'stock_movements',
  'stock_counts',
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run electron/db/__tests__/inventory-v2.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full suite to confirm nothing broke**

Run: `npm test`
Expected: all existing tests still PASS.

- [ ] **Step 7: Commit**

```bash
git add electron/db/migrations/018_inventory_v2.ts electron/db/index.ts electron/db/__tests__/inventory-v2.test.ts
git commit -m "db: v2 inventory schema migration 018 (units, ingredients, procurement, stock ledger)"
```

---

### Task 2: v2 seed migration (019)

**Files:**
- Create: `electron/db/migrations/019_inventory_v2_seed.ts`
- Modify: `electron/db/index.ts` (import + call)
- Test: `electron/db/__tests__/inventory-v2.test.ts` (extend)

**Interfaces:**
- Consumes: `ingredients`, `units` from Task 1.
- Produces: `runInventoryV2SeedMigration(db: Database.Database): void` — seeds units + the spec §4 ingredients.

- [ ] **Step 1: Write the failing test**

Append to `electron/db/__tests__/inventory-v2.test.ts` — import `runInventoryV2SeedMigration` and run it inside `beforeAll` (after `runInventoryV2Migration`), then add:

```ts
  test('seeds units', () => {
    const names = db.prepare('SELECT name FROM units ORDER BY id').all() as { name: string }[]
    expect(names.map(r => r.name)).toEqual(['Litre', 'Kg', 'Bag', 'Piece', 'Finger', 'Gram'])
  })

  test('seeds ingredients with base units', () => {
    const row = db.prepare(`
      SELECT i.name, u.name as unit FROM ingredients i JOIN units u ON u.id = i.base_unit_id WHERE i.name = ?
    `).get('Cooking Oil') as { name: string; unit: string } | undefined
    expect(row?.unit).toBe('Litre')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/db/__tests__/inventory-v2.test.ts`
Expected: FAIL — "Cannot find module '../migrations/019_inventory_v2_seed'".

- [ ] **Step 3: Write the seed migration**

Create `electron/db/migrations/019_inventory_v2_seed.ts`:

```ts
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
```

- [ ] **Step 4: Register in `electron/db/index.ts`**

Add import + call after `runInventoryV2Migration(db)`:
```ts
    runInventoryV2SeedMigration(db)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run electron/db/__tests__/inventory-v2.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add electron/db/migrations/019_inventory_v2_seed.ts electron/db/index.ts electron/db/__tests__/inventory-v2.test.ts
git commit -m "db: v2 inventory seed migration 019 (units + ingredients)"
```

---

### Task 3: v2 shared types

**Files:**
- Modify: `shared/types.ts`

**Interfaces:**
- Produces: the exact types later tasks and Plans 2–4 import. Names below are binding.

- [ ] **Step 1: Add the types** (append near the other entity types in `shared/types.ts`):

```ts
export type MovementType = 'purchase_in' | 'production_use' | 'sale_out' | 'restock' | 'wastage' | 'adjustment'

export interface Unit {
  id: number
  name: string
  unit_type: 'weight' | 'volume' | 'count'
}

export interface Staff {
  id: number
  name: string
  role: 'admin' | 'cashier' | 'cook'
  pin_hash: string | null
  is_active: number
}

export interface Ingredient {
  id: number
  name: string
  base_unit_id: number
  base_unit_name?: string
  reorder_level: number
  current_stock: number
  avg_unit_cost_ugx: number
  is_active: number
}

export interface Supplier {
  id: number
  name: string
  phone: string | null
  location: string | null
}

export interface MarketPurchase {
  id: number
  purchase_date: string
  supplier_id: number | null
  supplier_name?: string | null
  recorded_by: number
  payment_source: 'till' | 'personal'
  till_session_id: number | null
  total_cost_ugx: number
  notes: string | null
}

export interface PurchaseItem {
  id: number
  purchase_id: number
  ingredient_id: number
  ingredient_name?: string
  purchase_unit_id: number
  purchase_unit_name?: string
  quantity_purchased: number
  unit_price_ugx: number
  total_price_ugx: number
  conversion_to_base: number
  quantity_in_base_unit: number
}

export interface MarketPurchaseWithItems extends MarketPurchase {
  items: PurchaseItem[]
}

export interface StockMovement {
  id: number
  ingredient_id: number
  movement_type: MovementType
  quantity: number
  reference_table: string | null
  reference_id: number | null
  balance_after: number
  created_at: string
  created_by: number | null
  notes: string | null
}

export interface StockCount {
  id: number
  ingredient_id: number
  counted_at: string
  counted_by: number
  system_stock: number
  actual_stock: number
  variance: number
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.node.json --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add shared/types.ts
git commit -m "types: v2 inventory & procurement entity types"
```

---

### Task 4: staffRepo

**Files:**
- Create: `electron/db/repositories/staffRepo.ts`
- Test: `electron/db/__tests__/staff-ingredients-repo.test.ts`

**Interfaces:**
- Consumes: `getDb` from `../index`, `Staff` from `../../../shared/types`.
- Produces:
  - `staffRepo.list(): Staff[]`
  - `staffRepo.getById(id: number): Staff | undefined`
  - `staffRepo.create(input: { name: string; role: Staff['role']; pin_hash?: string | null }): Staff`
  - `staffRepo.count(): number`

- [ ] **Step 1: Write the failing test**

Create `electron/db/__tests__/staff-ingredients-repo.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { runMigrations } from '../migrations/001_initial'
import { runInventoryV2Migration } from '../migrations/018_inventory_v2'
import { runInventoryV2SeedMigration } from '../migrations/019_inventory_v2_seed'

const TEST_DB_PATH = path.join(__dirname, '..', '__test_staff.sqlite')

let db: Database.Database

vi.mock('../index', () => ({
  getDb: () => db,
}))

import { staffRepo } from '../repositories/staffRepo'

describe('staffRepo', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
    db = new Database(TEST_DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    runInventoryV2Migration(db)
    runInventoryV2SeedMigration(db)
  })

  afterAll(() => {
    db.close()
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(TEST_DB_PATH + suffix)) fs.unlinkSync(TEST_DB_PATH + suffix)
    }
  })

  test('counts seeded admin', () => {
    expect(staffRepo.count()).toBeGreaterThanOrEqual(1)
  })

  test('creates and reads back a staff member', () => {
    const created = staffRepo.create({ name: 'Cook #1', role: 'cook' })
    expect(created.id).toBeGreaterThan(0)
    expect(staffRepo.getById(created.id)?.name).toBe('Cook #1')
    expect(staffRepo.list().some(s => s.role === 'cook')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/db/__tests__/staff-ingredients-repo.test.ts`
Expected: FAIL — "Cannot find module '../repositories/staffRepo'".

- [ ] **Step 3: Write the minimal implementation**

Create `electron/db/repositories/staffRepo.ts`:

```ts
import { getDb } from '../index'
import type { Staff } from '../../../shared/types'

export const staffRepo = {
  list(): Staff[] {
    return getDb().prepare('SELECT * FROM staff ORDER BY name').all() as Staff[]
  },

  getById(id: number): Staff | undefined {
    return getDb().prepare('SELECT * FROM staff WHERE id = ?').get(id) as Staff | undefined
  },

  create(input: { name: string; role: Staff['role']; pin_hash?: string | null }): Staff {
    const result = getDb().prepare('INSERT INTO staff (name, role, pin_hash) VALUES (?, ?, ?)').run(
      input.name,
      input.role,
      input.pin_hash ?? null,
    )
    return getDb().prepare('SELECT * FROM staff WHERE id = ?').get(result.lastInsertRowid as number) as Staff
  },

  count(): number {
    return (getDb().prepare('SELECT COUNT(*) as c FROM staff').get() as { c: number }).c
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run electron/db/__tests__/staff-ingredients-repo.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add electron/db/repositories/staffRepo.ts electron/db/__tests__/staff-ingredients-repo.test.ts
git commit -m "feat: staffRepo (v2 staff CRUD)"
```

---

### Task 5: ingredientsRepo

**Files:**
- Create: `electron/db/repositories/ingredientsRepo.ts`
- Test: `electron/db/__tests__/staff-ingredients-repo.test.ts` (extend)

**Interfaces:**
- Consumes: `getDb`, `Ingredient` type.
- Produces:
  - `ingredientsRepo.list(activeOnly?: boolean): Ingredient[]` (includes `base_unit_name` via join)
  - `ingredientsRepo.getById(id: number): Ingredient | undefined`
  - `ingredientsRepo.getByName(name: string): Ingredient | undefined`
  - `ingredientsRepo.create(input: { name: string; base_unit_id: number; reorder_level?: number }): Ingredient`
  - `ingredientsRepo.update(id: number, patch: { reorder_level?: number; is_active?: number }): Ingredient`

- [ ] **Step 1: Write the failing test**

Append to `electron/db/__tests__/staff-ingredients-repo.test.ts` after the staffRepo describe block (add import `ingredientsRepo`):

```ts
describe('ingredientsRepo', () => {
  test('lists seeded ingredients with base unit names', () => {
    const list = ingredientsRepo.list()
    expect(list.length).toBeGreaterThanOrEqual(9)
    const oil = list.find(i => i.name === 'Cooking Oil')
    expect(oil?.base_unit_name).toBe('Litre')
    expect(oil?.avg_unit_cost_ugx).toBe(0)
  })

  test('creates, finds by name, and updates', () => {
    const created = ingredientsRepo.create({ name: 'Salt', base_unit_id: 2, reorder_level: 1 })
    expect(ingredientsRepo.getByName('Salt')?.id).toBe(created.id)

    const updated = ingredientsRepo.update(created.id, { reorder_level: 3, is_active: 0 })
    expect(updated.reorder_level).toBe(3)
    expect(updated.is_active).toBe(0)
    expect(ingredientsRepo.list(true).some(i => i.name === 'Salt')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/db/__tests__/staff-ingredients-repo.test.ts`
Expected: FAIL — "Cannot find module '...ingredientsRepo'".

- [ ] **Step 3: Write the minimal implementation**

Create `electron/db/repositories/ingredientsRepo.ts`:

```ts
import { getDb } from '../index'
import type { Ingredient } from '../../../shared/types'

const SELECT = `
  SELECT i.*, u.name AS base_unit_name
  FROM ingredients i
  JOIN units u ON u.id = i.base_unit_id
`

export const ingredientsRepo = {
  list(activeOnly = false): Ingredient[] {
    const sql = activeOnly ? `${SELECT} WHERE i.is_active = 1 ORDER BY i.name` : `${SELECT} ORDER BY i.name`
    return getDb().prepare(sql).all() as Ingredient[]
  },

  getById(id: number): Ingredient | undefined {
    return getDb().prepare(`${SELECT} WHERE i.id = ?`).get(id) as Ingredient | undefined
  },

  getByName(name: string): Ingredient | undefined {
    return getDb().prepare(`${SELECT} WHERE i.name = ?`).get(name) as Ingredient | undefined
  },

  create(input: { name: string; base_unit_id: number; reorder_level?: number }): Ingredient {
    const result = getDb().prepare('INSERT INTO ingredients (name, base_unit_id, reorder_level) VALUES (?, ?, ?)').run(
      input.name,
      input.base_unit_id,
      input.reorder_level ?? 0,
    )
    return this.getById(result.lastInsertRowid as number) as Ingredient
  },

  update(id: number, patch: { reorder_level?: number; is_active?: number }): Ingredient {
    const current = this.getById(id)
    if (!current) throw new Error(`Ingredient ${id} not found`)
    getDb().prepare('UPDATE ingredients SET reorder_level = ?, is_active = ? WHERE id = ?').run(
      patch.reorder_level ?? current.reorder_level,
      patch.is_active ?? current.is_active,
      id,
    )
    return this.getById(id) as Ingredient
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run electron/db/__tests__/staff-ingredients-repo.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add electron/db/repositories/ingredientsRepo.ts electron/db/__tests__/staff-ingredients-repo.test.ts
git commit -m "feat: ingredientsRepo (v2 ingredient CRUD)"
```

---

### Task 6: stockRepo (ledger + counts)

**Files:**
- Create: `electron/db/repositories/stockRepo.ts`
- Test: `electron/db/__tests__/stock-repo.test.ts`

**Interfaces:**
- Consumes: `getDb`, `StockMovement`, `StockCount`, `MovementType` types.
- Produces:
  - `stockRepo.recordMovement(input: { ingredient_id: number; movement_type: MovementType; quantity: number; reference_table?: string | null; reference_id?: number | null; created_by?: number | null; notes?: string | null }): StockMovement` — computes `balance_after = prev + quantity`, **throws if negative**, inserts the row (trigger syncs `current_stock`).
  - `stockRepo.recordCount(input: { ingredient_id: number; actual_stock: number; counted_by: number }): StockCount` — snapshots `system_stock = current_stock`, inserts the `stock_counts` row and an `adjustment` movement (ref `stock_count`) whose `balance_after` equals `actual_stock`. Mirrors legacy repo error behavior: `getById` missing → nested `.getById` throws `Ingredient not found`.
  - `stockRepo.listByIngredient(ingredientId: number, limit = 50): StockMovement[]`
  - `stockRepo.getById(id: number): StockMovement`
  - `stockRepo.currentBalance(ingredientId: number): number` — `current_stock` from `ingredients` (the cache).
  - `stockRepo.ensureIngredient(id: number): void` — throws if the ingredient doesn't exist.

- [ ] **Step 1: Write the failing test**

Create `electron/db/__tests__/stock-repo.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { runMigrations } from '../migrations/001_initial'
import { runInventoryV2Migration } from '../migrations/018_inventory_v2'
import { runInventoryV2SeedMigration } from '../migrations/019_inventory_v2_seed'

const TEST_DB_PATH = path.join(__dirname, '..', '__test_stock.sqlite')

let db: Database.Database

vi.mock('../index', () => ({
  getDb: () => db,
}))

import { stockRepo } from '../repositories/stockRepo'

describe('stockRepo ledger', () => {
  let beanId: number
  let cookId: number

  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
    db = new Database(TEST_DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    runInventoryV2Migration(db)
    runInventoryV2SeedMigration(db)
    const row = db.prepare("INSERT INTO ingredients (name, base_unit_id) VALUES ('Beans', (SELECT id FROM units WHERE name='Kg'))").run()
    beanId = Number(row.lastInsertRowid)
    const staff = db.prepare("INSERT INTO staff (name, role) VALUES ('Cook', 'cook')").run()
    cookId = Number(staff.lastInsertRowid)
  })

  afterAll(() => {
    db.close()
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(TEST_DB_PATH + suffix)) fs.unlinkSync(TEST_DB_PATH + suffix)
    }
  })

  test('computes running balance and syncs current_stock cache', () => {
    stockRepo.recordMovement({ ingredient_id: beanId, movement_type: 'purchase_in', quantity: 10 })
    const sold = stockRepo.recordMovement({ ingredient_id: beanId, movement_type: 'sale_out', quantity: -3.5 })
    expect(sold.balance_after).toBe(6.5)
    expect(stockRepo.currentBalance(beanId)).toBe(6.5)
  })

  test('rejects a movement that would drive stock below zero', () => {
    expect(() =>
      stockRepo.recordMovement({ ingredient_id: beanId, movement_type: 'sale_out', quantity: -100 }),
    ).toThrow(/Insufficient stock/)
    expect(stockRepo.currentBalance(beanId)).toBe(6.5)
  })

  test('serializes movements with references', () => {
    const m = stockRepo.recordMovement({
      ingredient_id: beanId,
      movement_type: 'restock',
      quantity: 1,
      reference_table: 'order_item',
      reference_id: 7,
      created_by: cookId,
    })
    expect(m.reference_table).toBe('order_item')
    expect(m.reference_id).toBe(7)
    expect(m.created_by).toBe(cookId)
  })

  test('recordCount corrects stock via adjustment movement', () => {
    const count = stockRepo.recordCount({ ingredient_id: beanId, actual_stock: 5, counted_by: cookId })
    expect(count.variance).toBeCloseTo(5 - 7.5, 4)
    expect(stockRepo.currentBalance(beanId)).toBe(5)
    const last = stockRepo.listByIngredient(beanId)[0]
    expect(last.movement_type).toBe('adjustment')
    expect(last.reference_table).toBe('stock_count')
    expect(last.balance_after).toBe(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/db/__tests__/stock-repo.test.ts`
Expected: FAIL — "Cannot find module '../repositories/stockRepo'".

- [ ] **Step 3: Write the minimal implementation**

Create `electron/db/repositories/stockRepo.ts`:

```ts
import { getDb } from '../index'
import type { MovementType, StockCount, StockMovement } from '../../../shared/types'

const ROUND = 4

function round4(n: number): number {
  return Math.round(n * 10 ** ROUND) / 10 ** ROUND
}

export const stockRepo = {
  ensureIngredient(id: number): void {
    const row = getDb().prepare('SELECT id FROM ingredients WHERE id = ?').get(id)
    if (!row) throw new Error(`Ingredient ${id} not found`)
  },

  getById(id: number): StockMovement {
    const row = getDb().prepare('SELECT * FROM stock_movements WHERE id = ?').get(id) as StockMovement | undefined
    if (!row) throw new Error(`Stock movement ${id} not found`)
    return row
  },

  currentBalance(ingredientId: number): number {
    const row = getDb().prepare('SELECT current_stock FROM ingredients WHERE id = ?').get(ingredientId) as { current_stock: number } | undefined
    if (!row) throw new Error(`Ingredient ${ingredientId} not found`)
    return row.current_stock
  },

  listByIngredient(ingredientId: number, limit = 50): StockMovement[] {
    return getDb().prepare(
      'SELECT * FROM stock_movements WHERE ingredient_id = ? ORDER BY id DESC LIMIT ?',
    ).all(ingredientId, limit) as StockMovement[]
  },

  recordMovement(input: {
    ingredient_id: number
    movement_type: MovementType
    quantity: number
    reference_table?: string | null
    reference_id?: number | null
    created_by?: number | null
    notes?: string | null
  }): StockMovement {
    this.ensureIngredient(input.ingredient_id)
    const db = getDb()
    const last = db.prepare(
      'SELECT balance_after FROM stock_movements WHERE ingredient_id = ? ORDER BY id DESC LIMIT 1',
    ).get(input.ingredient_id) as { balance_after: number } | undefined
    const prev = last?.balance_after ?? 0
    const balanceAfter = round4(prev + input.quantity)
    if (balanceAfter < 0) {
      throw new Error(`Insufficient stock: ingredient ${input.ingredient_id} would go to ${balanceAfter}`)
    }
    const result = db.prepare(`
      INSERT INTO stock_movements
        (ingredient_id, movement_type, quantity, reference_table, reference_id, balance_after, created_by, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.ingredient_id,
      input.movement_type,
      input.quantity,
      input.reference_table ?? null,
      input.reference_id ?? null,
      balanceAfter,
      input.created_by ?? null,
      input.notes ?? null,
    )
    return this.getById(result.lastInsertRowid as number)
  },

  recordCount(input: { ingredient_id: number; actual_stock: number; counted_by: number }): StockCount {
    this.ensureIngredient(input.ingredient_id)
    const db = getDb()
    const systemStock = this.currentBalance(input.ingredient_id)
    const variance = round4(input.actual_stock - systemStock)
    return db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO stock_counts (ingredient_id, counted_by, system_stock, actual_stock)
        VALUES (?, ?, ?, ?)
      `).run(input.ingredient_id, input.counted_by, systemStock, input.actual_stock)
      const countId = result.lastInsertRowid as number
      this.recordMovement({
        ingredient_id: input.ingredient_id,
        movement_type: 'adjustment',
        quantity: variance,
        reference_table: 'stock_count',
        reference_id: countId,
        created_by: input.counted_by,
      })
      return db.prepare('SELECT * FROM stock_counts WHERE id = ?').get(countId) as StockCount
    })()
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run electron/db/__tests__/stock-repo.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add electron/db/repositories/stockRepo.ts electron/db/__tests__/stock-repo.test.ts
git commit -m "feat: stockRepo (append-only ledger, negative-stock guard, stock counts)"
```

---

### Task 7: procurementRepo (market purchases)

**Files:**
- Create: `electron/db/repositories/procurementRepo.ts`
- Test: `electron/db/__tests__/procurement-repo.test.ts`

**Interfaces:**
- Consumes: `getDb`, `MarketPurchaseWithItems`, `PurchaseItem` types, `stockRepo`.
- Produces:
  - `procurementRepo.recordPurchase(input: { recorded_by: number; supplier_name?: string | null; payment_source?: 'till' | 'personal'; till_session_id?: number | null; notes?: string | null; items: Array<{ ingredient_id: number; purchase_unit_id: number; quantity_purchased: number; unit_price_ugx: number; conversion_to_base: number }> }): MarketPurchaseWithItems`
    - Invariant 5: `payment_source='till'` with no `till_session_id` → throw `Error('Till-paid purchase requires an open till session')`.
    - One transaction: resolve/create supplier by name, insert `market_purchases`, insert each `purchase_items` row, call `stockRepo.recordMovement('purchase_in', +quantity_in_base_unit, ref 'purchase_item')`, recompute `avg_unit_cost_ugx` after each item.
    - `total_cost_ugx` = sum of item totals (stored at the end).
  - `procurementRepo.listByDate(date: string): MarketPurchaseWithItems[]`
  - `procurementRepo.getById(id: number): MarketPurchaseWithItems`
  - `procurementRepo.listSuppliers(): Supplier[]`

- [ ] **Step 1: Write the failing test**

Create `electron/db/__tests__/procurement-repo.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { runMigrations } from '../migrations/001_initial'
import { runInventoryV2Migration } from '../migrations/018_inventory_v2'
import { runInventoryV2SeedMigration } from '../migrations/019_inventory_v2_seed'

const TEST_DB_PATH = path.join(__dirname, '..', '__test_proc.sqlite')

let db: Database.Database

vi.mock('../index', () => ({
  getDb: () => db,
}))

import { procurementRepo } from '../repositories/procurementRepo'
import { ingredientsRepo } from '../repositories/ingredientsRepo'
import { stockRepo } from '../repositories/stockRepo'

describe('procurementRepo', () => {
  let staffId: number
  let oilId: number
  let beefId: number
  let kgId: number

  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
    db = new Database(TEST_DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    runInventoryV2Migration(db)
    runInventoryV2SeedMigration(db)
    staffId = Number(db.prepare("INSERT INTO staff (name, role) VALUES ('Manager', 'admin')").run().lastInsertRowid)
    oilId = ingredientsRepo.getByName('Cooking Oil')!.id
    beefId = ingredientsRepo.getByName('Beef')!.id
    kgId = Number(db.prepare("SELECT id FROM units WHERE name='Kg'").get()!.id)
  })

  afterAll(() => {
    db.close()
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(TEST_DB_PATH + suffix)) fs.unlinkSync(TEST_DB_PATH + suffix)
    }
  })

  test('throws when a till-paid purchase has no session', () => {
    expect(() =>
      procurementRepo.recordPurchase({
        recorded_by: staffId,
        payment_source: 'till',
        items: [{ ingredient_id: oilId, purchase_unit_id: kgId, quantity_purchased: 1, unit_price_ugx: 1000, conversion_to_base: 1 }],
      }),
    ).toThrow(/till session/)
  })

  test('records purchase, stock movements, and weighted-average unit cost', () => {
    const purchase = procurementRepo.recordPurchase({
      recorded_by: staffId,
      supplier_name: 'Nakasero Stall 12',
      payment_source: 'personal',
      items: [
        { ingredient_id: oilId, purchase_unit_id: kgId, quantity_purchased: 1, unit_price_ugx: 8000, conversion_to_base: 1 },
        { ingredient_id: beefId, purchase_unit_id: kgId, quantity_purchased: 3, unit_price_ugx: 2000, conversion_to_base: 1 },
      ],
    })

    expect(purchase.total_cost_ugx).toBe(8000 + 6000)
    expect(purchase.supplier_name).toBe('Nakasero Stall 12')
    expect(purchase.items).toHaveLength(2)

    expect(stockRepo.currentBalance(oilId)).toBe(1)
    expect(ingredientsRepo.getById(oilId)!.avg_unit_cost_ugx).toBe(8000)

    // weighted average: (3 * 0 + 3 * 2000) / 3 = 2000
    expect(stockRepo.currentBalance(beefId)).toBe(3)
    expect(ingredientsRepo.getById(beefId)!.avg_unit_cost_ugx).toBe(2000)
  })

  test('weighted average blends across purchases', () => {
    procurementRepo.recordPurchase({
      recorded_by: staffId,
      payment_source: 'personal',
      items: [{ ingredient_id: beefId, purchase_unit_id: kgId, quantity_purchased: 1, unit_price_ugx: 3000, conversion_to_base: 1 }],
    })
    // old: 3 kg @ 2000 = 6000; new: 1 kg @ 3000 = 3000; avg = 9000 / 4 = 2250
    expect(ingredientsRepo.getById(beefId)!.avg_unit_cost_ugx).toBe(2250)
    expect(stockRepo.currentBalance(beefId)).toBe(4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/db/__tests__/procurement-repo.test.ts`
Expected: FAIL — "Cannot find module '../repositories/procurementRepo'".

- [ ] **Step 3: Write the minimal implementation**

Create `electron/db/repositories/procurementRepo.ts`:

```ts
import { getDb } from '../index'
import type { MarketPurchaseWithItems, PurchaseItem, Supplier } from '../../../shared/types'
import { stockRepo } from './stockRepo'

const PURCHASE_SELECT = `
  SELECT mp.*, s.name AS supplier_name
  FROM market_purchases mp
  LEFT JOIN suppliers s ON s.id = mp.supplier_id
`

const ITEM_SELECT = `
  SELECT pi.*, ing.name AS ingredient_name, u.name AS purchase_unit_name
  FROM purchase_items pi
  JOIN ingredients ing ON ing.id = pi.ingredient_id
  JOIN units u ON u.id = pi.purchase_unit_id
`

export interface PurchaseInputItem {
  ingredient_id: number
  purchase_unit_id: number
  quantity_purchased: number
  unit_price_ugx: number
  conversion_to_base: number
}

function attachItems(purchase: MarketPurchaseWithItems): MarketPurchaseWithItems {
  const items = getDb().prepare(`${ITEM_SELECT} WHERE pi.purchase_id = ? ORDER BY pi.id`).all(purchase.id) as PurchaseItem[]
  return { ...purchase, items }
}

function resolveSupplierId(name?: string | null): number | null {
  if (!name || !name.trim()) return null
  const trimmed = name.trim()
  const existing = getDb().prepare('SELECT id FROM suppliers WHERE name = ?').get(trimmed) as { id: number } | undefined
  if (existing) return existing.id
  const result = getDb().prepare('INSERT INTO suppliers (name) VALUES (?)').run(trimmed)
  return result.lastInsertRowid as number
}

export const procurementRepo = {
  recordPurchase(input: {
    recorded_by: number
    supplier_name?: string | null
    payment_source?: 'till' | 'personal'
    till_session_id?: number | null
    notes?: string | null
    items: PurchaseInputItem[]
  }): MarketPurchaseWithItems {
    const paymentSource = input.payment_source ?? 'till'
    if (paymentSource === 'till' && input.till_session_id == null) {
      throw new Error('Till-paid purchase requires an open till session')
    }
    const db = getDb()
    return db.transaction(() => {
      const supplierId = resolveSupplierId(input.supplier_name)
      const purchaseResult = db.prepare(`
        INSERT INTO market_purchases (supplier_id, recorded_by, payment_source, till_session_id, notes)
        VALUES (?, ?, ?, ?, ?)
      `).run(supplierId, input.recorded_by, paymentSource, input.till_session_id ?? null, input.notes ?? null)
      const purchaseId = purchaseResult.lastInsertRowid as number

      let total = 0
      const insertItem = db.prepare(`
        INSERT INTO purchase_items
          (purchase_id, ingredient_id, purchase_unit_id, quantity_purchased, unit_price_ugx,
           total_price_ugx, conversion_to_base, quantity_in_base_unit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const item of input.items) {
        const totalPrice = Math.round(item.quantity_purchased * item.unit_price_ugx)
        const qtyBase = round4(item.quantity_purchased * item.conversion_to_base)
        const itemResult = insertItem.run(
          purchaseId, item.ingredient_id, item.purchase_unit_id,
          item.quantity_purchased, item.unit_price_ugx, totalPrice,
          item.conversion_to_base, qtyBase,
        )
        const itemId = itemResult.lastInsertRowid as number
        total += totalPrice

        stockRepo.recordMovement({
          ingredient_id: item.ingredient_id,
          movement_type: 'purchase_in',
          quantity: qtyBase,
          reference_table: 'purchase_item',
          reference_id: itemId,
          created_by: input.recorded_by,
        })
        updateAvgCost(item.ingredient_id, qtyBase, item.unit_price_ugx, item.conversion_to_base)
      }

      db.prepare('UPDATE market_purchases SET total_cost_ugx = ? WHERE id = ?').run(total, purchaseId)
      return this.getById(purchaseId)
    })()
  },

  getById(id: number): MarketPurchaseWithItems {
    const row = getDb().prepare(`${PURCHASE_SELECT} WHERE mp.id = ?`).get(id) as MarketPurchaseWithItems | undefined
    if (!row) throw new Error(`Purchase ${id} not found`)
    return attachItems(row)
  },

  listByDate(date: string): MarketPurchaseWithItems[] {
    const rows = getDb()
      .prepare(`${PURCHASE_SELECT} WHERE DATE(mp.purchase_date) = ? ORDER BY mp.id DESC`)
      .all(date) as MarketPurchaseWithItems[]
    return rows.map(r => attachItems(r))
  },

  listSuppliers(): Supplier[] {
    return getDb().prepare('SELECT * FROM suppliers ORDER BY name').all() as Supplier[]
  },
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

function updateAvgCost(ingredientId: number, qtyBase: number, unitPriceUgx: number, conversionToBase: number): void {
  const db = getDb()
  const ing = db.prepare('SELECT current_stock, avg_unit_cost_ugx FROM ingredients WHERE id = ?').get(ingredientId) as
    { current_stock: number; avg_unit_cost_ugx: number } | undefined
  if (!ing) throw new Error(`Ingredient ${ingredientId} not found`)
  // NOTE: current_stock read AFTER the movement was inserted above, so it already
  // includes qtyBase (trigger-synced). Cost per base unit honors the conversion.
  const oldQty = ing.current_stock - qtyBase
  const costPerBase = conversionToBase > 0 ? Math.round(unitPriceUgx / conversionToBase) : unitPriceUgx
  const newAvg = oldQty > 0
    ? Math.round((oldQty * ing.avg_unit_cost_ugx + qtyBase * costPerBase) / (oldQty + qtyBase))
    : costPerBase
  db.prepare('UPDATE ingredients SET avg_unit_cost_ugx = ? WHERE id = ?').run(newAvg, ingredientId)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run electron/db/__tests__/procurement-repo.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add electron/db/repositories/procurementRepo.ts electron/db/__tests__/procurement-repo.test.ts
git commit -m "feat: procurementRepo (market purchases, per-bag conversion, weighted avg cost)"
```

---

### Task 8: Consolidation verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests PASS, including the four pre-existing suites (db, debts, user-roles, categories-items) and the four new v2 suites (inventory-v2, staff-ingredients, stock, procurement).

- [ ] **Step 2: Typecheck the Electron side**

Run: `npx tsc -p tsconfig.node.json --noEmit`
Expected: exit 0, no new errors.

- [ ] **Step 3: Confirm the app still boots in dev**

Run: `npm run dev`
Expected: window opens; no migration errors in the main-process console. Close the window.

- [ ] **Step 4: Commit any stragglers**

```bash
git status --short
git add -A && git commit -m "chore: v2 inventory foundation consolidation"  # only if uncommitted changes exist
```

---

## Self-Review notes

- **Spec coverage:** This plan implements spec §3 tables with no legacy-name collision (units, ingredients, suppliers, market_purchases, purchase_items, stock_movements, stock_counts), spec §2 relationships, D1 (integer `_ugx` money), D2 (REAL quantities, 4-decimal rounding), D3 (ledger authoritative + `trg_stock_cache`), D5 (payment_source + till session guard), D7 (deduction derived — movements reference order_item/purchase_item/batch), and workflows A + D (§5). `staff` covers the actor FK for recorded_by/created_by/counted_by (Plan 3 ports `users` → `staff`). Menu/recipes/modifiers/batches/orders/payments/expenses are deliberately deferred to Plans 2–4, which will also handle the legacy `_legacy` renames the spec §8 calls for.
- **Type consistency:** `MovementType`, `Ingredient`, `MarketPurchaseWithItems`, `PurchaseItem`, `StockMovement`, `StockCount`, `Staff`, `Supplier`, `Unit` are defined once in Task 3 and referenced by name in Tasks 4–7. `procurementRepo.recordPurchase` returns `MarketPurchaseWithItems`; tests assert `purchase.supplier_name` and `purchase.items` — both present on that interface.
- **No placeholders:** every task has concrete code and expected test output.
- **Legacy safety:** no legacy table is modified; `index.ts` only gains imports/calls + `DATA_TABLES` entries.