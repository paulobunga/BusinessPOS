# Dynamic Categories & Item Attributes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `proteins` / `starches` model with owner-configurable categories (priced/free) and generic `menu_items`, plus typed item attributes (text/number/boolean). Current restaurant behaviour (priced main + free starch add-on) becomes the seeded default; a bar/shop shape (no free categories) falls out naturally.

**Spec (approved):** `docs/superpowers/specs/2026-09-10-dynamic-categories-design.md`
**Base commit:** `734fa69` (HEAD — spec doc commit). All work lands before Task 17 (Electron packaging).

## Global Constraints (from the approved spec + existing conventions)

- Follow Project Rules in `AGENTS.md` / `CLAUDE.md` if present; check for them first.
- Monetary values are integer UGX cents, `_cents` suffix, per `design.md` §2.4. **Never** add float currency.
- `contextIsolation: true`, `nodeIntegration: false` — renderer never touches DB/fs directly. All data flows through `window.api.*` via `electron/preload.ts`.
- No hard deletes on financial records. Soft-deactivate instead (`active = 0`). Exception: categories/items/attributes with no usage may be hard-deleted.
- Minimum touch target 48×48px; no text weight below 500.
- Do **not** edit migration files `001_initial.ts` … `006_waste_table.ts`. New schema goes in a new `007_categories.ts`.
- Preserve all existing data through the migration (production-safe; dev DBs today hold seed + test data and must not be wiped).
- `cost_price_cents` applies to **every** item in every category (drives food cost / COGS / P&L).
- Do **not** add code comments unless the code genuinely needs them (repo style is comment-free).
- Commit after each task. Commit messages: `feat(dynamic-categories): <task summary>`. **Do not commit secrets.**
- The plan is executed task-by-task via subagents. **Subagent coordination notes (critical — known failure modes in this repo):**
  - Subagents sometimes stall in "plan mode" and produce no code. Re-dispatch with explicit instruction: "DO NOT PLAN. JUST IMPLEMENT. I have already planned. Write the code now."
  - Subagents on Windows may think they committed when they did not. After each subagent returns, **the coordinator runs `git status` and commits on the subagent's behalf** if unstaged changes exist.
  - Go-native `tsc` OOMs on parallel runs (`errno=1455`). Run typechecks **sequentially**, one tsconfig at a time, and set env first: `$env:GOMEMLIMIT='2GiB'; $env:GOGC='off'`.

## Verification environment

- Tests: `npm test` (vitest). Existing suite: `electron/__tests__/integration.test.ts` + `electron/db/__tests__/db.test.ts` (10 tests passing).
- Typecheck (run sequentially):
  - `npx tsc --noEmit -p tsconfig.node.json` (electron main process)
  - `npx tsc --noEmit -p tsconfig.json` (renderer)
- Manual smoke at the end: `npm run dev` → login (PIN for seeded manager), sell with add-on, record purchase, record waste, run daily report, manage categories/items/attributes in Settings.

---

## Task A — Migration 007 + new backend repos (no UI yet)

### A1. Create `electron/db/migrations/007_categories.ts`

New file `007_categories.ts` exporting `runCategoriesMigration(db: Database.Database)`. Pattern follows `006_waste_table.ts` (guard on `schema_migrations` version 7, single `db.exec` for DDL, `INSERT INTO schema_migrations (version) VALUES (7)` at the end).

The migration must handle the fact that `proteins`, `starches`, `waste`, `sale_items`, `cook_events`, and `sales.starch_id` all reference the tables being dropped, and that both `proteins` and `starches` begin id ranges at 1 (so ids **cannot be preserved** into one `menu_items` table — must build an id map).

Steps, in order:

1. **Turn FK checks off for the rebuild.** Do this *outside any transaction* on the passed `db`:
   ```ts
   db.pragma('foreign_keys = OFF')
   ```
   (better-sqlite3 pragma works on the passed Database; the app connection already set `foreign_keys = ON`, which would block `DROP COLUMN` of FK columns the SQLite 3.35+ way.)

2. Create the four new tables exactly as the spec:
   ```sql
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
     category_id INTEGER REFERENCES categories(id),   -- NULL = applies to all categories
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
   ```
   Add indexes: `CREATE INDEX idx_menu_items_category ON menu_items(category_id);` and `CREATE INDEX idx_item_attr_values_item ON item_attribute_values(item_id);`

3. Seed the two categories (unconditional — the migration runs exactly once):
   ```sql
   INSERT INTO categories (name, kind, sort_order) VALUES ('Proteins','priced',0), ('Starches','free',1);
   ```

4. **Copy + map.** Use TS loops with prepared statements (not pure SQL) to build a map from old id → new item id, because menu_items ids are fresh AUTOINCREMENT values:
   ```ts
   const mapProtein = new Map<number, number>()
   const mapStarch = new Map<number, number>()
   ```
   - `SELECT id, name, selling_price_cents, cost_price_cents, out_of_stock, active FROM proteins ORDER BY id` → insert into `menu_items` with `category_id` = Proteins category id (looked up via `SELECT id FROM categories WHERE name='Proteins'`), record `mapProtein.set(oldId, newId)`.
   - Do the same for `starches` (no prices → 0/0) into the Starches category.

5. **Remap `sale_items`** (add columns first, backfill, drop legacy columns):
   ```sql
   ALTER TABLE sale_items ADD COLUMN item_id INTEGER REFERENCES menu_items(id);
   ALTER TABLE sale_items ADD COLUMN free_item_id INTEGER REFERENCES menu_items(id);
   ```
   Then backfill per row in TS:
   - `item_id` = `mapProtein.get(protein_id)` (or `mapStarch.get(protein_id)` IFF protein_id came from starches — it never did; protein_id always pointed at `proteins`, so always `mapProtein`).
   - `free_item_id` = `starch_id` ? `mapStarch.get(starch_id)` : null.
   Then drop legacy columns (FK is off, so allowed):
   ```sql
   ALTER TABLE sale_items DROP COLUMN protein_id;
   ALTER TABLE sale_items DROP COLUMN starch_id;
   ```

6. **Drop the legacy `sales.starch_id` header column** (unused — nothing writes it, all writes are NULL):
   ```sql
   ALTER TABLE sales DROP COLUMN starch_id;
   ```

7. **`protein_purchases` → `item_purchases`.** Create the new table with an `item_id` FK, copy rows in TS using `mapProtein`, then drop the old table:
   ```sql
   CREATE TABLE item_purchases (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     item_id INTEGER NOT NULL REFERENCES menu_items(id),
     purchase_date TEXT NOT NULL,
     quantity_kg REAL NOT NULL,
     cost_cents INTEGER NOT NULL,
     expected_yield INTEGER NOT NULL,
     created_by INTEGER REFERENCES users(id)
   );
   ```
   Copy `SELECT id, protein_id, purchase_date, quantity_kg, cost_cents, expected_yield, created_by FROM protein_purchases` → insert with `item_id = mapProtein.get(protein_id)`. Then `DROP TABLE protein_purchases;`

8. **Remap `waste`:** `ALTER TABLE waste ADD COLUMN item_id INTEGER REFERENCES menu_items(id);` backfill `item_id = mapProtein.get(protein_id)`; `ALTER TABLE waste DROP COLUMN protein_id;`

9. **Remap `cook_events`:** same pattern — `ADD COLUMN item_id`, backfill via `mapProtein`, drop `protein_id`. (Table is unused/dead schema today but must remain valid and reference `menu_items`; there is no data to lose in practice, but map anyway to be safe.)

10. **Drop the legacy tables:**
    ```sql
    DROP TABLE proteins;
    DROP TABLE starches;
    ```

11. **Re-enable FKs and verify integrity:**
    ```ts
    db.pragma('foreign_keys = ON')
    // assert sqlite_master has no proteins/starches/protein_purchases
    // assert sale_items has item_id/free_item_id columns
    // run PRAGMA foreign_key_check → expect zero rows; if rows found, throw
    ```

12. `INSERT INTO schema_migrations (version) VALUES (7);`

Edge cases to respect when writing A1:
- Keep the `` ` `` template-literal `db.exec(...)` style consistent with existing migrations (001 uses one big `db.exec`, 006 the same).
- `db.pragma('foreign_keys = OFF')`/`ON` must be called on the raw Database object and outside a `.transaction()`. The DDL/copy/drop steps themselves may be wrapped in `db.transaction(() => {...})()` for atomicity *after* the OFF pragma.
- Order matters: add+backfill new columns before dropping old ones, and drop child references before dropping parents is unnecessary once FK is OFF, but keep the exact order above anyway for readability.

**Verify A1:** `npx tsc --noEmit -p tsconfig.node.json` (sequential, with GOMEMLIMIT/GOGC env set). Unit-estimate: migration compiles.

### A2. Wire migration + seeds in `electron/db/index.ts`

- Import `runCategoriesMigration` and call it after `runWasteMigration(db)` in `getDb()`.
- Replace `proteinsRepo.seed()` / `starchesRepo.seed()` calls with `itemsRepo.seed()` (A3) and `categoriesRepo.seedIfEmpty()` (A4). `usersRepo.seed()` and `settingsRepo.seed()` stay.
- Remove the old imports/seed calls; add the new repo imports.

### A3. Create `electron/db/repositories/itemsRepo.ts` (replaces proteinsRepo + starchesRepo)

Delete `proteinsRepo.ts` and `starchesRepo.ts`. New `itemsRepo.ts` exports an object following the existing repo style (plain object of methods, `getDb()` from `../index`, no class):

Signature contracts (mirror current callers):

```ts
listActive(): MenuItemWithCategory[]                    // active=1, ordered by cat.sort_order, category name, item name
listAll(): MenuItemWithCategory[]                       // all, active DESC then sort_order, name
listByCategory(categoryId: number, activeOnly?: boolean): MenuItemWithCategory[]
listByKind(kind: 'priced' | 'free', activeOnly?: boolean): MenuItemWithCategory[]   // JOIN categories
getById(id: number): MenuItemWithCategory | undefined
upsert(data: { id?: number; category_id: number; name: string; selling_price_cents?: number; cost_price_cents?: number; out_of_stock?: number; active?: number }): MenuItemWithCategory
setOutOfStock(id: number, outOfStock: boolean): void
del(id: number): void                                   // hard delete only if no sale_items/purchases/waste/cook_events refs; else active=0
seed(): void                                            // only if menu_items count == 0
```

`MenuItemWithCategory` is `MenuItem` + `category_name: string` + `category_kind: 'priced' | 'free'` + `attribute_values` array (see A5 for shape) — a LEFT JOIN against `categories` and a `SELECT ... FROM item_attribute_values v JOIN attribute_defs d ON d.id = v.attr_def_id WHERE v.item_id = ?` per item (small datasets; N+1 acceptable and consistent with repo simplicity).

- `upsert` with `data.id` → `UPDATE menu_items`; else `INSERT`. `selling_price_cents`/`cost_price_cents` default 0 when omitted (free items).
- If `upsert` **changes the item's category**, delete `item_attribute_values` rows whose `attr_def_id` points to an `attribute_defs` row scoped to a *different* category than the new one (i.e. keep values for defs where `category_id IS NULL OR category_id = newCategoryId`). Implement via: fetch defs, delete values whose def doesn't apply to new category.
- `del`: count refs in `sale_items` (item_id or free_item_id), `item_purchases`, `waste`, `cook_events`. If total === 0 → `DELETE` row + its `item_attribute_values`; else `UPDATE menu_items SET active = 0`.
- `seed()` exactly matches prior seed data so dev UX is unchanged:
  - Proteins category: `Goat Meat` 10000/6000, `Chicken` 8000/5000, `Fish` 7000/4000.
  - Starches category: `Banana`, `Cassava`, `Plantain`, `Irish Potatoes` (0/0).
  - Only when `SELECT COUNT(*) FROM menu_items` is 0. Skip if the DB came from the migration (already has rows).
  - Look up category ids by name via `SELECT id FROM categories WHERE name = ?`.

### A4. Create `electron/db/repositories/categoriesRepo.ts`

```ts
list(): Category[]                       // ORDER BY sort_order, name
listActive(): Category[]                 // active=1, ORDER BY sort_order, name
upsert(data: { id?: number; name: string; kind?: 'priced' | 'free'; sort_order?: number; active?: number }): Category
del(id: number): void                    // hard delete only if menu_items count === 0; else active=0
seedIfEmpty(): void                      // if categories count === 0, insert Proteins(priced,0), Starches(free,1)
```

- Updating `kind` from priced→free or free→priced is allowed (owner decisions). No cascade checks needed beyond `menu_items` emptiness for hard delete.
- `name` is UNIQUE — surface constraint errors as thrown errors with a readable message (`Duplicate category name`). Wrap the INSERT in try/catch and rethrow `Error('A category with this name already exists')`.

### A5. Create `electron/db/repositories/attributesRepo.ts`

```ts
interface AttributeDefInput { id?: number; category_id: number | null; name: string; type: 'text' | 'number' | 'boolean'; sort_order?: number }
list(categoryId?: number | null): AttributeDef[]        // categoryId null/omitted = all; else scoped + global (category_id IS NULL OR category_id = ?)
upsert(input: AttributeDefInput): AttributeDef
del(id: number): void                                   // deletes attribute_defs row + its item_attribute_values rows
saveValues(itemId: number, values: Array<{ attr_def_id: number; value_text?: string; value_number?: number; value_boolean?: boolean }>): void
  // upsert per (item_id, attr_def_id): INSERT ... ON CONFLICT(item_id, attr_def_id) DO UPDATE
getValuesForItem(itemId: number): AttributeValue[]      // join defs; used by itemsRepo.list*N
```

`AttributeValue` shape: `{ attr_def_id, name, type, value_text, value_number, value_boolean }` (resolve the value field by def type in SQL: `COALESCE(v.value_text, v.value_number, v.value_boolean)` need not be done — return raw columns; the renderer picks the right one by `type`).

Validation: `saveValues` may only set the value field matching the def's `type` (text→value_text, number→value_number, boolean→value_boolean). Enforce in the repo (throw `Error('Value type mismatch for attribute <name>')`), and in SQL use `INSERT ... VALUES (..., @, @, @)` with the literal left in `value_text` etc.

### A6. Remap the existing repos that referenced proteins/starches

Create `electron/db/repositories/purchasesRepo.ts` (renamed from `inventoryRepo.ts`; delete the old file):

- `recordPurchase(itemId, quantity, costCents, date, createdBy)` → `INSERT INTO item_purchases (item_id, purchase_date, quantity_kg, cost_cents, expected_yield, created_by) VALUES (?,?,?,?,?,?)` (expected_yield = quantity, as today).
- `getByDate(date)` / `getByDateRange(start, end)` → join `menu_items` instead of `proteins`, alias `mi.name as item_name`, `mi.cost_price_cents as unit_cost_cents`. SELECT `ip.*` + `mi.name as item_name`.
- `getLatestByItem(itemId)` → `WHERE item_id = ?`.
- `dailyTotal(date)` → `FROM item_purchases`.
- Rename `inventoryRepo` export to `purchasesRepo`.

Update `electron/db/repositories/wasteRepo.ts`:
- `record(data: { item_id; quantity; estimated_value_cents; reason; waste_date; notes? })` → insert into `waste (item_id, ...)`.
- All JOINs `proteins p` → `menu_items mi`, `p.id = w.protein_id` → `mi.id = w.item_id`, alias `mi.name as item_name`.
- `getAggregatedByProtein` → `getAggregatedByItem`, GROUP BY `w.item_id`, alias `item_name`.
- Keep `dailyTotal` unchanged (date-only).

Update `electron/db/repositories/salesRepo.ts`:
- `items: Array<{ item_id: number; free_item_id?: number | null; price_cents: number }>`.
- Resolve main name: `SELECT name FROM menu_items WHERE id = ?`; `name_snapshot` = main item name (keep — snapshot must not change after delete/rename).
- `INSERT INTO sale_items (sale_id, item_id, free_item_id, name_snapshot, unit_price_cents, quantity, line_total_cents)`.

Update `electron/db/repositories/reportsRepo.ts`:
- `getProteinPerformance` → `getItemPerformance(start, end): ItemPerformance[]`:
  ```sql
  SELECT
    c.name AS category_name,
    mi.name AS item_name,
    SUM(si.quantity) AS portions_sold,
    SUM(si.line_total_cents) AS revenue_cents,
    0 AS cost_cents,
    SUM(si.line_total_cents) AS margin_cents
  FROM sale_items si
  LEFT JOIN menu_items mi ON mi.id = si.item_id
  LEFT JOIN categories c ON c.id = mi.category_id
  JOIN sales s ON s.id = si.sale_id
  WHERE s.status IN ('completed','unpaid')
    AND DATE(s.created_at) >= ? AND DATE(s.created_at) <= ?
  GROUP BY c.name, mi.name
  ORDER BY revenue_cents DESC
  ```
  (`cost_cents` stays 0 — the COGS mapping is a known deferred item, do NOT implement the join now.)
- `getDailyRow` / `getMonthlyAggregated` purchase subqueries: `FROM protein_purchases` → `FROM item_purchases` (column names unchanged). Waste subqueries unchanged (they only aggregate `waste` by date, no protein join).
- Delete `ProteinPerformance` interface from this file; it lives in `shared/types.ts` (A8).

### A7. IPC layer: handlers + preload + main.ts registration

Replace `electron/ipc/menuHandlers.ts` with three handler files (or keep one file renamed `itemHandlers.ts` plus `categoryHandlers.ts` + `attributeHandlers.ts` — pick the 3-file split for clarity):

`electron/ipc/itemsHandlers.ts`:
- `items:list` ← `({ categoryId?, kind?, activeOnly? })`:
  - no filters at all → `itemsRepo.listAll()` (active + inactive — used by Settings),
  - `activeOnly: true` → `itemsRepo.listActive()`,
  - `categoryId` given → `itemsRepo.listByCategory(categoryId, activeOnly)`,
  - `kind` given → `itemsRepo.listByKind(kind, activeOnly)`.
- `items:upsert` ← payload → `itemsRepo.upsert`
- `items:setOutOfStock` ← `(id, boolean)`
- `items:delete` ← `(id)`

`electron/ipc/categoriesHandlers.ts`:
- `categories:list` ← `(activeOnly?)`
- `categories:upsert`
- `categories:delete`

`electron/ipc/attributesHandlers.ts`:
- `attributes:list` ← `({ categoryId? })`
- `attributes:upsert`
- `attributes:delete` ← `(id)`
- `attributes:saveValues` ← `({ itemId, values })`

Delete `menuHandlers.ts`.

Update `electron/main.ts`: remove `registerMenuHandlers()`; add `registerItemsHandlers()`, `registerCategoriesHandlers()`, `registerAttributesHandlers()` in its place (keep call order alphabetical as today).

Update `electron/preload.ts`: remove `proteins:*`/`starches:*` lines; add `items:*`, `categories:*`, `attributes:*`; update `inventory:*`/`waste:*` handlers to pass `item_id` payloads (discussed in B below — preload is just a passthrough, the type change comes from `shared/types.ts`). Rename `reports:proteinPerformance` → `reports:itemPerformance`.

Update `electron/ipc/inventoryHandlers.ts`, `electron/ipc/wasteHandlers.ts`, `electron/ipc/reportsHandlers.ts`:
- inventory payload type `{ item_id: number; quantity: number; cost_cents: number; date: string; created_by: number | null }` → `purchasesRepo`.
- waste payload type `{ item_id: number; quantity: number; estimated_value_cents: number; reason: ...; waste_date: string; notes?: string }` → `wasteRepo`. Channel `waste:byProtein` → `waste:byItem`.
- reports: `reports:itemPerformance`.

### A8. Refactor `shared/types.ts` + `src` type surface

Edit `shared/types.ts`:

- Add:
  ```ts
  export interface Category { id: number; name: string; kind: 'priced' | 'free'; sort_order: number; active: number }
  export interface MenuItem {
    id: number; category_id: number; name: string;
    selling_price_cents: number; cost_price_cents: number;
    out_of_stock: number; active: number
  }
  export interface MenuItemWithCategory extends MenuItem { category_name: string; category_kind: 'priced' | 'free'; attribute_values?: AttributeValue[] }
  export interface AttributeDef { id: number; category_id: number | null; name: string; type: 'text' | 'number' | 'boolean'; sort_order: number }
  export interface AttributeValue {
    attr_def_id: number; name: string; type: 'text' | 'number' | 'boolean';
    value_text: string | null; value_number: number | null; value_boolean: number | null
  }
  ```
- **Remove** `Protein`, `Starch`, `ProteinPurchase`, `ProteinPurchaseWithName`, `WasteByProtein`, `ProteinPerformance`, `CookEvent`.
- Change `Sale`/`SaleItem`: remove `starch_id: number | null` from `Sale`; change `SaleItem.protein_id` → `item_id: number | null`, `starch_id` → `free_item_id?: number | null`.
- `SaleWithItems`: remove `starch_name?`.
- `WasteRecord`: `protein_id` → `item_id: number`; `protein_name?` → `item_name?`.
- Replace `ProteinPurchase` with `ItemPurchase { id; item_id; purchase_date; quantity_kg; cost_cents; expected_yield; created_by }` and `ItemPurchaseWithName` (`item_name?`, `unit_cost_cents?`).
- Replace `WasteByProtein` with `WasteByItem { item_name; total_quantity; total_value_cents }`.
- Replace `ProteinPerformance` with `ItemPerformance { category_name: string; item_name: string; portions_sold; revenue_cents; cost_cents; margin_cents }`.
- Update IPC payload types:
  ```ts
  export interface SaleItemInput { item_id: number; free_item_id?: number | null; price_cents: number }
  ```
  `CreateSalePayload` unchanged otherwise.
- Update the `Api` interface: remove `proteins:*` + `starches:*`; add:
  ```ts
  'items:list': (filters?: { categoryId?: number; kind?: 'priced' | 'free'; activeOnly?: boolean }) => Promise<MenuItemWithCategory[]>
  'items:upsert': (payload: Partial<MenuItem> & { id?: number }) => Promise<MenuItemWithCategory>
  'items:setOutOfStock': (id: number, outOfStock: boolean) => Promise<void>
  'items:delete': (id: number) => Promise<void>
  'categories:list': (activeOnly?: boolean) => Promise<Category[]>
  'categories:upsert': (payload: Partial<Category> & { id?: number }) => Promise<Category>
  'categories:delete': (id: number) => Promise<void>
  'attributes:list': (filters?: { categoryId?: number | null }) => Promise<AttributeDef[]>
  'attributes:upsert': (payload: Partial<AttributeDef> & { id?: number }) => Promise<AttributeDef>
  'attributes:delete': (id: number) => Promise<void>
  'attributes:saveValues': (payload: { itemId: number; values: Array<{ attr_def_id: number; value_text?: string; value_number?: number; value_boolean?: boolean }> }) => Promise<void>
  ```
  Update `inventory:*` / `waste:*` / `reports:itemPerformance` signatures to the renamed payloads above (`InventoryPurchasePayload`, `WasteRecordPayload` inline or as named types).
- `Customer`/`TillSession`/`Expense`/`Reimbursement`/`Payment`/`DebtSummaryItem`/`TillSummaryData`/`FoodCostSummary` remain, except `FoodCostSummary.protein_name` → `item_name` (dead type; rename fields for consistency, keep the rest).

**Verify A1–A8:** `npx tsc --noEmit -p tsconfig.node.json`. All electron code (repos, handlers, main, preload, shared types, tests) must compile. The renderer does **not** compile yet (Task B) — that's expected at this checkpoint.

---

## Task B — Renderer refactor (hooks, Sell flow, Settings managers, Inventory/Waste, Reports)

### B1. New hooks + update existing

- Delete `src/hooks/useProteins.ts` and `useStarches.ts`. Create `src/hooks/useItems.ts`, `useCategories.ts`, `useAttributes.ts`, each following the exact Task-16 contract (`{ data, loading, error, retry` } with `window.api[...]`):
  - `useItems(filters?: { categoryId?: number; kind?: 'priced' | 'free'; activeOnly?: boolean })`
  - `useCategories(activeOnly = false)`
  - `useAttributes(categoryId?: number | null)`
- Update `src/hooks/useInventory.ts` → `usePurchases.ts`? — **keep filename `useInventory.ts`** (pages import it) but change payload fields: `record({ item_id, quantity, cost_cents, date, created_by })`, state type `ItemPurchaseWithName[]`.
- Update `src/hooks/useWaste.ts`: payload `item_id`; state `WasteRecord[]`; `byItem(start, end)`.
- Update `src/hooks/useReports.ts`: `loadItemPerf` → `window.api['reports:itemPerformance']`, state `ItemPerformance[]`.
- Update `src/hooks/useCart.ts`: rename the cart line model (see CartItemState in B2) from protein/starch to `itemId/itemName/itemPrice/addOnId/addOnName`. Keep the exact public operations used by SellPage: `addItem`, `setAddOn`, `removeItem`, `clearCart`, `subtotal`, `total`, `discountCents`, `setDiscountCents`, `discountReason`, `setDiscountReason`, `itemCount`.

### B2. Sell flow

- `src/components/ProteinCard.tsx` → delete; create `src/components/ItemCard.tsx`:
  - Props: `{ item: MenuItemWithCategory, selected: boolean, onSelect: (i) => void }`.
  - Shows `item.name`; price area shows `fmt(selling_price_cents)` when category_kind === 'priced', else the word **Free** in `--color-success`.
  - Greys out + disables click when `out_of_stock === 1` (existing behaviour).
- `src/components/StarchSelector.tsx` → delete; create `src/components/AddOnSelector.tsx`:
  - Props `{ addOns: MenuItemWithCategory[], onSelect: (item) => void }` — chips of free items; each chip shows `item.name` (+ category name sub-label when >1 free category exists, e.g. `Banana · Starches`). All free items (all active free categories) are offered.
- `src/pages/Sell/SellPage.tsx` rewrite:
  - Hooks: `useCategories(false)` + `useItems()` (all active), choose which to render:
    - Category chips row: active categories ordered by `sort_order`; default select the first **priced** category.
    - Item grid shows the selected category's active items.
    - `const freeCategories = categories.filter(c => c.kind === 'free' && c.active)`, `const freeItems = items.filter(i => i.category_kind === 'free' && i.active)`.
  - Selecting a **priced** item → `cart.addItem(item)` and set `selectedItem` state; if `freeCategories.length > 0` show the add-on row ("{item.name} — pick a free add-on") with `AddOnSelector`; picking an add-on → `cart.setAddOn(item)` and clear `selectedItem`.
  - Selecting a **free** item with no free categories in play → not offered as a main (free items are only ever add-ons). When `freeCategories.length === 0` (bar/shop mode): clicking a priced item adds straight to cart with no add-on row, matching existing one-line-per-item behaviour.
  - Complete-sale payload maps cart lines → `{ item_id: item.itemId, free_item_id: item.addOnId, price_cents: item.itemPrice }`.
  - Preserve the existing loading/error/retry, till-open guard, confirm dialog, DiscountModal, DebtModal, saving overlay, success toast behaviour exactly (Task 16 polish).
- `src/components/CartItem.tsx`: render `item.itemName` (+ `+ addOnName` when present); price `fmt(item.itemPrice)`. Delete the old protein/starch names.
- `src/components/Cart.tsx`: props stay the same shape (it takes `items: CartItemState[]`); the type import updates only.

### B3. Settings managers — `src/pages/Settings/SettingsPage.tsx`

Replace the **Manage Proteins** and **Manage Starches** sections with three sections (reuse the existing `Section`, `StatusLine`, `btnPrimary/btnGhost/btnDanger` style objects; keep the Business Info, Change PIN, and Backup sections untouched):

1. **Categories** — list each category (name, kind badge `Priced`/`Free`, active state); per-row **Edit** (rename, swap kind, sort_order number input) and **Deactivate/Activate**; **Add category** row (name + kind + order). Uses `categories:list`, `categories:upsert`, `categories:delete`.
2. **Attributes** — list `AttributeDef`s (name, type, scope = category name or "All categories"); per-row **Edit**/**Delete**; **Add attribute** form (name, type select `text|number|boolean`, scope select = "All categories" or one of the active categories). Uses `attributes:*`.
3. **Menu Items** — a category selector (priced **and** free categories listed for completeness; owner manages items per category), then per-category: item rows with name, selling UGX, cost UGX, inline attribute value inputs (rendered by attribute `type`: text input / number input / checkbox), out-of-stock toggle, Edit/Deactivate/Delete; **Add item** form (name, selling, cost) for that category. Uses `items:list`, `items:upsert`, `items:setOutOfStock`, `items:delete`, `attributes:saveValues`.

Hard delete confirmation copy (matches existing pattern): categories — `Delete category "X"? Only allowed if it has no items.`; items — `Delete "X"? Sales history referencing it will be kept (item deactivated).`; attributes — `Delete attribute? Its saved values will also be removed.`

### B4. Inventory + Waste pages — item selector + list labels

- `src/pages/Inventory/InventoryPage.tsx`:
  - `useItems({ kind: 'priced', activeOnly: true })` for the item selector (purchases only make sense for cost-bearing priced items).
  - Rename state `proteinId` → `itemId`; on record call `window.api['inventory:recordPurchase']({ item_id, ... })` — keep the hook call `useInventory`.
  - Label copy: "Record the day's stock purchases" (drop "protein"); preview `"{name} × {qty} kg @ {unit}kg"`; purchase rows show `p.item_name ?? Item #p.item_id`.
  - `useInventory` exposes `record` + `byDate`/`byDateRange` (as today).
- `src/pages/Waste/WastePage.tsx`:
  - Same `kind:'priced'` selector; `item_id` payload; confirm dialog unchanged; rows show `w.item_name ?? Item #w.item_id`; aggregate section uses `waste:byItem`.

### B5. Reports page — item performance

- `src/pages/Reports/ReportsPage.tsx` + `src/hooks/useReports.ts`:
  - Replace the protein-performance block with **Item performance** grouping: table rows `Category · Item`, portions sold, revenue. Keep the `daily`/`monthly`/`categoryBreakdown`/`debtSummary`/`tillSummary` sections exactly as they are today.
  - Channel calls `window.api['reports:itemPerformance'](start, end)`.

**Verify B1–B5:** `npx tsc --noEmit -p tsconfig.json` (renderer) — sequential, GOMEMLIMIT/GOGC env set. Then a full `npm test`.

---

## Task C — Tests + final verification

### C1. `electron/db/__tests__/db.test.ts`

- Replace table-name assertions `proteins`/`starches`/`protein_purchases` with `categories`, `menu_items`, `item_purchases`, `attribute_defs`, `item_attribute_values`.
- The test creates a fresh in-memory DB through the migration runner; **ensure it now calls `runCategoriesMigration` after `runWasteMigration`** or it will throw (sale_items etc. reference menu_items).
- Add smoke assertions: seeding ran (`SELECT COUNT(*) FROM categories` = 2), proteins/starches tables are gone.

### C2. `electron/__tests__/integration.test.ts` — rewrite the setup to the new model

- Register `runCategoriesMigration(db)` after the other migrations.
- Replace starches/proteins setup with dynamic category + item creation through the new repos (per spec: "create a category + items dynamically instead of relying on seeded proteins/starches"):
  ```ts
  const meatCat = categoriesRepo.upsert({ name: 'Test Meats', kind: 'priced', sort_order: 0 })
  const sideCat = categoriesRepo.upsert({ name: 'Test Sides', kind: 'free', sort_order: 1 })
  const goat = itemsRepo.upsert({ category_id: meatCat.id, name: 'Goat Meat', selling_price_cents: 10000, cost_price_cents: 6000 })
  const chicken = itemsRepo.upsert({ category_id: meatCat.id, name: 'Chicken', selling_price_cents: 8000, cost_price_cents: 5000 })
  const banana = itemsRepo.upsert({ category_id: sideCat.id, name: 'Banana' })
  ```
- Sale items become `{ item_id: goat.id, free_item_id: banana.id, price_cents: 10000 }` etc.
- Purchase becomes `purchasesRepo.recordPurchase(goat.id, 5, 30000, reportDate, userId)`.
- Keep the full round-trip: open till → cash sale (2 goat + 1 chicken with banana add-on) → purchase → expense → `countCash` formula → close → daily report figures (same expected numbers).
- Also add a small item-performance assertion: `reportsRepo.getItemPerformance(reportDate, reportDate)` returns the goat row with `portions_sold = 2`, `revenue_cents = 20000`, `category_name = 'Test Meats'`.

### C3. New repo tests — `electron/db/__tests__/categories-items-attributes.test.ts`

Fresh in-memory DB (migrations 1–7), then:
- `categoriesRepo.upsert` inserts + updates; duplicate name throws readable error.
- `categoriesRepo.del` hard-deletes an empty category but soft-deactivates one holding `menu_items`.
- `itemsRepo.upsert` creates in a priced category (price stored), and free item in free category (price 0).
- `itemsRepo.del` hard-deletes an unused item; soft-deactivates an item referenced by a `sale_items` row (create a sale first via `salesRepo.create`, or insert a `sale_items` row directly); item disappears from `itemsRepo.listActive()` but stays in `listAll()` with `active === 0`.
- `attributesRepo.upsert` scope NULL applies to all; `attributes:saveValues` upsert: setting a value twice for the same `(item_id, attr_def_id)` updates rather than duplicates; `attributesRepo.del` removes def + its values.
- `itemsRepo.listByKind('free', true)` returns only free active items.

### C4. Final verification gate (before claiming done)

1. `npm test` — all tests pass (expect ≥ 13: 2 db + 7 integration + 4+ new).
2. `npx tsc --noEmit -p tsconfig.node.json` then `npx tsc --noEmit -p tsconfig.json` — sequentially, both clean.
3. Grep gate: run `rg "protein|starch|Protein|Starch"` across `src/` and `electron/` — allow hits ONLY inside `electron/db/migrations/001_initial.ts`…`006_waste_table.ts`, `design.md`, the spec, this plan, and non-code docs. No field/table/API name (`protein_id`, `starch_id`, `proteins:list`, `useProteins`, `reports:proteinPerformance`, `proteinsRepo`, `starchesRepo`, `inventoryRepo`) may remain in code.
4. Manual smoke (`npm run dev`): login → category chips render (Proteins active) → sell 2× Goat + Banana → complete cash sale → cart clears → open till countCash reflects sale → Settings shows Categories/Attributes/Menu Items managers, rename a category, edit item price, toggle out-of-stock grey-out on the Sell screen → Inventory records a Goat purchase → Waste records waste → Reports daily + item-performance show the numbers.
5. Coordinator commits any remaining work; update `.superpowers/sdd/.../progress.md` ledger.

## Out of scope for this plan (from spec §Out of scope + known deferred items)

- Quantities per cart line, per-category discounts/taxes, attribute-driven report filtering, new roles.
- PIN brute-force lockout (Task-4 deferred), till `opened_by`/`closed_by` recording (Task-8 deferred), item-performance COGS (`cost_cents` stays 0), renderer cache invalidation after DB import (Task-15 deferred), `foodCost:*` stale handlers in `design.md` docs cleanup.

## Definition of Done

- Migration `007` applies cleanly to a DB created by migrations 1–6 (data preserved, FK check passes) **and** to a fresh empty DB (seed populates Proteins/Starches categories + default items).
- Sell flow, purchases, waste, all reports work on the new model with the same numbers as pre-refactor for the same input.
- Settings ships the three-manager UI.
- Test suite green + both typechecks green + grep gate clean.
- Commits landed on top of `734fa69`; ledger updated with notes including any new deferred items.