# Dynamic Categories & Item Attributes

**Date:** 2026-09-10
**Status:** Approved
**Type:** Architectural — post-Task-16 refactor of the item/entity model

## Context

The system currently hardcodes two item kinds: `proteins` (priced main items) and
`starches` (free add-ons). This serves the current restaurant (protein + free starch)
but blocks reuse for other businesses the owner may run later — a small bar (all items
priced, e.g. Beers/Spirits/Soft Drinks) or a small shop (products with attributes like
brand/size). The hardcoded model cannot express those.

This refactor opens the item model into owner-defined categories and typed item
attributes, while preserving the current restaurant behaviour as the seeded default.

## Goals

1. Replace `proteins`/`starches` with a single generic `menu_items` table.
2. Add owner-configurable `categories`, each flagged `priced` or `free`.
3. Add typed attributes (`text` / `number` / `boolean`) definable per category (or all).
4. Keep the existing sales flow intact: one priced main + optional free add-on per cart line.
5. Future business shapes fall out naturally: no `free` categories ⟹ no add-on row.
6. `cost_price` applies to **every** item in every category (drives food cost / COGS / P&L).

## Data model

### New tables

```sql
CREATE TABLE categories (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL UNIQUE,
  kind         TEXT NOT NULL CHECK (kind IN ('priced','free')),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1
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
  category_id INTEGER REFERENCES categories(id),  -- NULL = applies to all categories
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

### Remapped tables

| Current | New |
|---|---|
| `proteins` | dropped; rows → `menu_items` (category = Proteins) |
| `starches` | dropped; rows → `menu_items` (category = Starches) |
| `sale_items.protein_id` | `sale_items.item_id` (main, priced item) |
| `sale_items.starch_id` | `sale_items.free_item_id` (NULL when no add-on) |
| `protein_purchases` | `item_purchases` (`protein_id` → `item_id`) |
| `waste.protein_id` | `waste.item_id` |

## Migration strategy (`electron/db/migrations/007_categories.ts`)

1. Create `categories`, `menu_items`, `attribute_defs`, `item_attribute_values`.
2. Seed categories **Proteins** (`priced`, order 0) and **Starches** (`free`, order 1).
3. Copy `proteins` rows → `menu_items` (category = Proteins); `starches` → Starches.
4. Remap `sale_items` (`protein_id`→`item_id`, `starch_id`→`free_item_id`).
5. Remap `protein_purchases` → `item_purchases`; remap `waste.protein_id` → `item_id`.
6. Drop `proteins`, `starches`.
7. Preserve all existing data (production-safe; dev data is seed-only today but must not be wiped).

## IPC contract

Replace `proteins:*` / `starches:*` channels:

| Channel | Payload / Returns |
|---|---|
| `items:list` | `{ categoryId?: number, activeOnly?: boolean }` → `MenuItem[]` joined with category name + attribute values |
| `items:upsert` | `MenuItem` create/update (id optional) |
| `items:setOutOfStock` | `(id, boolean)` |
| `items:delete` | `(id)` — hard delete only if no sales history; else soft-deactivate |
| `categories:list` | → `Category[]` |
| `categories:upsert` | `Category` create/update |
| `categories:delete` | `(id)` — only if empty; else soft-deactivate |
| `attributes:list` | `{ categoryId?: number }` → `AttributeDef[]` |
| `attributes:upsert` | `AttributeDef` create/update |
| `attributes:delete` | `(id)` — also removes `item_attribute_values` for that def |
| `attributes:saveValues` | `{ itemId, values: [{ attrDefId, text?, number?, boolean? }] }` — upsert into `item_attribute_values` |

## UI changes

### Sell flow (`SellPage`)
- Category chips row at top (active categories by `sort_order`).
- Item grid for the selected category (priced items show price; free items show "Free").
- Selecting a priced item reveals free-category add-on chips **only if a free category exists**.
- Add to cart as one line: `item_id` (main) + optional `free_item_id` (add-on).
- No free categories ⟹ no add-on row; items add straight to cart (bar/shop mode).
- `out_of_stock` items greyed out and disabled (existing behaviour preserved).

### Settings (`SettingsPage`)
Three managers, replacing the Proteins/Starches sections:
1. **Categories** — add / edit / rename / reorder / set priced-free / deactivate.
2. **Attributes** — define name + type, scope to a category or "all categories".
3. **Menu Items** — per-category item CRUD: name, selling price, cost price,
   inline attribute-value entry, out-of-stock toggle.

### Reports (`ReportsPage`)
- `reports:itemPerformance` replaces `proteinPerformance`, joined via `menu_items`
  + `categories`, grouped by category.
- Purchases and waste totals aggregate via `item_id`.

## Hooks / frontend structure

- `useItems` replaces `useProteins` + `useStarches` (list by category, retry, error state).
- `useCategories`, `useAttributes` for the new managers.
- All hooks keep the existing `error` / `loading` / `retry` contract from Task 16.

## Tests

- Update the Task-16 integration test: create a category + items dynamically
  instead of relying on seeded proteins/starches; assert sale → purchase → expense →
  `countCash` → close → daily report round-trip on the new model.
- Add repo tests: `categoriesRepo`, `attributesRepo`, `itemsRepo` upsert/delete semantics.
- `menu_items` unique validation: name not required unique (two categories may share
  an item name); category choice is the discriminator.

## Files touched (~15)

Main-process: `007_categories.ts`, `itemsRepo.ts` (replaces proteins/starches repos),
`categoriesRepo.ts`, `attributesRepo.ts`, `purchasesRepo.ts` (renamed), `wasteRepo.ts` (remap),
`salesRepo.ts` (sale_items remap), `reportsRepo.ts` (item performance),
`menuHandlers.ts` → handlers split, `main.ts` (registration), `shared/types.ts`.

Renderer: `useItems.ts`, `useCategories.ts`, `useAttributes.ts`, `SellPage.tsx`,
`SettingsPage.tsx`, `InventoryPage.tsx`, `WastePage.tsx`, `ReportsPage.tsx`.

## Out of scope (future work)

- Quantities per cart line (bar mode currently = one line per item, click to repeat).
- Pluggable discounts / taxes per category.
- Attribute-driven searching or filtering in reports.
- Multi-user roles beyond the current single-manager + cashier model.

## Sequencing

This lands after Task 16 and before Task 17 (Electron packaging), so the packaged
app ships the new model. A follow-up implementation plan (2026-09-10-dynamic-categories)
will carry it.