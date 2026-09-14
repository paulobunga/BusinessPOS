# Design — Asset Management (Assets Register)

Date: 2026-09-15
Status: Approved

## Overview

Add an **Assets** module to BusinessPOS so the owner can track all business
assets (freezer, gas stove, deep fryer, plates, cups, forks, and anything
bought later): what they cost, what they are worth today (net book value after
straight-line depreciation), and when they are disposed of.

Depreciation is **informational only** — it does NOT appear as an expense in the
P&L/reports. Registering an asset does **not** create an expense entry in the
expenses ledger (capital purchases are tracked standalone).

## Decisions (confirmed with owner)

| Question | Decision |
|---|---|
| Asset granularity | **Mixed**: big equipment = one asset each; small items (plates/cups/forks) = a quantity lot (e.g. "50 plates") in one row |
| Depreciation → P&L | Informational only; never written as an expense |
| Purchase cost vs expenses ledger | Standalone; no expense entry auto-created |
| Depreciation method | **Straight-line** only: `(cost − salvage) ÷ useful_life_months`, per asset |
| Categories & useful life | Predefined categories with default useful lives, editable per asset |
| Disposal | Tracked: date, reason, optional sale proceeds; asset leaves active register but stays in history |
| Money | Integer UGX shillings (whole units, no decimals), consistent with NFR-7 |

## Data Model

### `assets` table (new migration `015_assets`)

```sql
CREATE TABLE assets (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  purchase_date TEXT NOT NULL,
  purchase_cost_cents INTEGER NOT NULL,
  salvage_cents INTEGER NOT NULL DEFAULT 0,
  useful_life_months INTEGER NOT NULL,
  location TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  disposed_at TEXT,
  disposed_reason TEXT,
  sold_proceeds_cents INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id)
);
```

### Categories with default useful lives

| Category | Default useful life |
|---|---|
| Kitchen Equipment | 120 months (10 yrs) |
| Utensils / Smallware | 24 months (2 yrs) |
| Furniture | 60 months (5 yrs) |
| Electronics | 60 months (5 yrs) |
| Vehicle | 120 months (10 yrs) |
| Other | 60 months (5 yrs) |

The category list lives as a shared constant `ASSET_CATEGORIES` defined in
`shared/types.ts` (tuples of `{ name, default_life_months }`). The repo reads
it to derive default useful life; the renderer reads it for the select options.
Useful life is pre-filled from the category on the form but editable per asset.

### Derived value computation (never stored)

All derived values are computed at query time:

- `months_elapsed` = full calendar months between `purchase_date` and `today`
  (or `disposed_at` if disposed), clamped to `[0, useful_life_months]`.
- `depreciable_base_cents` = `purchase_cost_cents − salvage_cents` (if negative,
  treat as 0).
- `accumulated_depreciation_cents` = `depreciable_base_cents × months_elapsed
  ÷ useful_life_months` (integer division, truncated). At end of life this
  equals the depreciable base exactly, so book value never falls below salvage.
- `net_book_value_cents` = `purchase_cost_cents −
  accumulated_depreciation_cents`.
- `monthly_depreciation_cents` = `depreciable_base_cents ÷ useful_life_months`
  (integer division; informational display only).

## IPC Contract

Additions to `shared/types.ts` `Api` interface and `preload.ts`:

```
assets:list()        → AssetWithValue[]
assets:get(id)       → AssetWithValue
assets:create(payload)  → Asset
assets:update(id, payload) → Asset
assets:dispose(id, payload: { disposed_at, reason, proceeds_cents? }) → Asset
assets:summary()     → AssetSummary
```

Types:

```ts
interface Asset {
  id: number
  name: string
  category: string
  quantity: number
  purchase_date: string
  purchase_cost_cents: number
  salvage_cents: number
  useful_life_months: number
  location: string | null
  notes: string | null
  active: number
  disposed_at: string | null
  disposed_reason: string | null
  sold_proceeds_cents: number | null
  created_at: string
  created_by: number | null
}

interface AssetWithValue extends Asset {
  months_elapsed: number
  accumulated_depreciation_cents: number
  net_book_value_cents: number
  monthly_depreciation_cents: number
}

interface CreateAssetPayload {
  name: string
  category: string
  quantity?: number
  purchase_date: string
  purchase_cost_cents: number
  salvage_cents?: number
  useful_life_months: number
  location?: string
  notes?: string
}

interface AssetSummary {
  total_cost_cents: number                // sum of all asset purchase costs
  total_book_value_cents: number          // sum of net book values (active only)
  total_monthly_depreciation_cents: number // sum of monthly dep (active only)
  total_accumulated_cents: number         // sum of accumulated dep (active only)
  active_count: number
  disposed_count: number
}
```

## Backend

### `electron/db/migrations/015_assets.ts`
`runAssetsMigration(db)` — `CREATE TABLE IF NOT EXISTS assets (...)` (schema
above). Register in `electron/db/index.ts` `getDb()` after migration 014.

### `electron/db/repositories/assetsRepo.ts`
- `create(data)` → int id
- `update(id, partial)` → Asset (editable: name, category, quantity,
  purchase_date, purchase_cost_cents, salvage_cents, useful_life_months,
  location, notes)
- `list()` → `AssetWithValue[]` (order: active first, then purchase_date desc)
- `getById(id)` → `AssetWithValue`
- `dispose(id, disposed_at, reason, proceeds_cents?)` → `AssetWithValue`
  (sets `disposed_at`, `disposed_reason`, `sold_proceeds_cents`, `active = 0`)
- `summary()` → `AssetSummary`
- Shared pure function `computeDepreciation(asset, asOfDate)` in
  `electron/db/lib/depreciation.ts`, unit-tested directly.

### `electron/ipc/assetsHandlers.ts`
`registerAssetsHandlers()` — one `ipcMain.handle` per IPC method above. Register
in `electron/main.ts` alongside the other handlers.

### Tests — `electron/db/__tests__/assets.test.ts`
- create + list + getById round-trip, defaults (quantity=1, salvage=0)
- straight-line math mid-life, end of life clamps to salvage
- lot quantity is a display field, depreciation scales off total cost
- disposal cuts off depreciation at `disposed_at`, sets active=0
- summary totals include/exclude disposed correctly

## Frontend

### `src/hooks/useAssets.ts`
Follows `useExpenses.ts` pattern: state + refresh + create/update/dispose
wrappers around `window.api['assets:*']`.

### `src/pages/Assets/AssetsPage.tsx` (route `/assets`)
- **Summary cards**: Total book value, Total purchase cost, Monthly
  depreciation, Disposed count.
- **Filters**: status (All / Active / Disposed) + category select.
- **Table** (existing `ui/table`): name, category, qty, purchase date, cost,
  **net book value**, monthly dep, status badge, actions (Edit / Dispose).
- **Add / Edit dialog** (existing `ui/dialog` + `date-picker` + inputs): name,
  category (prefills useful life), quantity, purchase date, purchase cost,
  salvage, useful life, location, notes. Live preview of computed net book
  value and monthly depreciation as the user edits.
- **Dispose dialog**: date (default today), reason select (sold / scrapped /
  broken past repair / other), optional sale proceeds.
- Empty state when no assets registered.

### Routing, sidebar, permissions
- Route added to `src/App.tsx` with `<RequireModule module="assets">`.
- Sidebar entry in `src/components/Sidebar.tsx` (Lucide icon, e.g. `Boxes`),
  label **Assets**, placed after Waste.
- `src/lib/permissions.ts`: add `'assets'` to `MODULES`. Admin gets it via
  `'*'`; cashier does not.

## Out of Scope (v1)
- Depreciation in P&L/reports
- Documentary expense entries for asset purchases
- Declining-balance depreciation
- Asset photos or maintenance/repair history
- Multi-location asset assignment