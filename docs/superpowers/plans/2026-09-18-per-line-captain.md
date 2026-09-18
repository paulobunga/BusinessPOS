# Per-Line Captain Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let cashiers mark individual POS order lines as captain (free) with full backend recording: menu value preserved, barter reports updated, stock consumed as `captain_out`.

**Architecture:** One additive migration (`is_captain` on `sale_items`); `salesRepo.create` writes captain lines at menu value with zero line total and splits stock movements; daily/monthly barter adds captain-line menu value; POS cart carries an `isCaptain` flag from keypad to payload. Money math (`total_cents`, `debt_cents`, till cash) is untouched.

**Tech Stack:** TypeScript, Electron + better-sqlite3, vitest, React + Tailwind (existing patterns only).

**Spec:** `docs/superpowers/specs/2026-09-18-per-line-captain-design.md`

## Global Constraints

- Money is whole UGX integers everywhere (migration `008_money_whole_ugx`); never store fractional cents.
- `sales:create` IPC handler passes its payload object straight through to `salesRepo.create` — no handler change needed.
- Existing rows are never rewritten by the migration (`is_captain` defaults to 0; historical price-0 lines stay plain discounts).
- TDD for every behavior change: failing test first, minimal code, re-run.

---

## File map

- Create `electron/db/migrations/026_per_line_captain.ts` — additive migration, version 26.
- Modify `electron/db/index.ts` — register the migration (import + call after `runYieldCleanupMigration`).
- Modify `shared/types.ts` — `SaleItem.is_captain: number`; `SaleItemInput.is_captain?: boolean`.
- Modify `electron/db/repositories/salesRepo.ts` — accept per-item flag, value-preserving captain rows, split stock movement, include flag in `attachItems` SELECT.
- Modify `electron/db/repositories/reportsRepo.ts` — barter adds captain-line menu value (daily + monthly); include flag in `getSales` item SELECT.
- Create `electron/db/__tests__/per-line-captain.test.ts` — repo + report tests (in-memory DB, mocked `getDb`, same scaffold as `debts-v2.test.ts`).
- Modify `src/hooks/cartItems.ts` + `src/hooks/cartItems.test.ts` — `isCaptain` flag, `setLineCaptain`, flag-aware merge.
- Modify `src/components/LineDiscountPad.tsx`, `src/components/Cart.tsx`, `src/components/CartItem.tsx`, `src/pages/Sell/SellPage.tsx` — Captain button, tag, payload plumbing.
- Modify `src/pages/Sales/SalesHistoryPage.tsx`, `src/pages/Reports/ReportsPage.tsx` — Captain tag on history/report lines.

---

### Task 1: Migration 026 + registration + shared types

**Files:**
- Create: `electron/db/migrations/026_per_line_captain.ts`
- Modify: `electron/db/index.ts`
- Modify: `shared/types.ts`

**Interfaces:**
- Consumes: migration pattern from `017_debt_write_offs.ts` (version-guard, transaction, PRAGMA column guard).
- Produces: `runPerLineCaptainMigration(db)`; `SaleItem.is_captain: number`; `SaleItemInput.is_captain?: boolean` for Tasks 2–4.

- [ ] **Step 1: Create the migration file**

```typescript
import Database from 'better-sqlite3'

export function runPerLineCaptainMigration(db: Database.Database) {
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))
  if (appliedVersions.has(26)) return

  db.transaction(() => {
    const cols = db.prepare('PRAGMA table_info(sale_items)').all() as { name: string }[]
    if (!cols.some(c => c.name === 'is_captain')) {
      db.exec('ALTER TABLE sale_items ADD COLUMN is_captain INTEGER NOT NULL DEFAULT 0')
    }

    db.exec('INSERT INTO schema_migrations (version) VALUES (26)')
  })()
}
```

- [ ] **Step 2: Register it in `electron/db/index.ts`**

Add the import with the other migration imports:

```typescript
import { runPerLineCaptainMigration } from './migrations/026_per_line_captain.js'
```

Add the call after `runYieldCleanupMigration(db)` inside `getDb()`:

```typescript
    runYieldCleanupMigration(db)
    runPerLineCaptainMigration(db)
```

- [ ] **Step 3: Extend shared types**

In `shared/types.ts`, add `is_captain: number` to `SaleItem`:

```typescript
export interface SaleItem {
  id: number
  sale_id: number
  item_id: number | null
  name_snapshot: string
  unit_price_cents: number
  quantity: number
  line_total_cents: number
  free_item_id?: number | null
  is_captain: number
}
```

Add `is_captain?: boolean` to `SaleItemInput`:

```typescript
export interface SaleItemInput {
  item_id: number
  free_item_id?: number | null
  price_cents: number
  quantity?: number
  is_captain?: boolean
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0, no output.

- [ ] **Step 5: Commit**

```bash
git add electron/db/migrations/026_per_line_captain.ts electron/db/index.ts shared/types.ts
git commit -m "feat: add sale_items.is_captain column and shared types"
```

---

### Task 2: `salesRepo.create` writes captain lines + splits stock

**Files:**
- Modify: `electron/db/repositories/salesRepo.ts`
- Test: `electron/db/__tests__/per-line-captain.test.ts` (create this file in Step 1)

**Interfaces:**
- Consumes: `runPerLineCaptainMigration(db)` from Task 1; `stockRepo.consumeForSale(mealId, qty, opts)` with `movement_type: 'sale_out' | 'captain_out'`; in-memory-DB + `vi.mock('../index')` scaffold copied from `electron/db/__tests__/debts-v2.test.ts` lines 1–18.
- Produces: `salesRepo.create` accepting per-item `is_captain`; captain rows stored as menu-value unit price / zero line total / flag set; `attachItems` returning the flag. Task 3 consumes the stored rows; Task 4 consumes the payload contract.

- [ ] **Step 1: Write the failing test file**

```typescript
import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migrations/001_initial'
import { runSalesExtrasMigration } from '../migrations/002_sales_extras'
import { runDebtsMigration } from '../migrations/004_debts_payment_allocations'
import { runRemovePaymentIdMigration } from '../migrations/014_debt_allocations_cleanup'
import { runDebtWriteOffsMigration } from '../migrations/017_debt_write_offs'
import { runCategoriesMigration } from '../migrations/007_categories'
import { runPerLineCaptainMigration } from '../migrations/026_per_line_captain'

let db: Database.Database
let catId = 0

vi.mock('../index', () => ({
  getDb: () => db,
}))

import { salesRepo } from '../repositories/salesRepo'

function seedItem(name: string, price: number): number {
  return Number(db.prepare(
    `INSERT INTO menu_items (category_id, name, selling_price_cents, cost_price_cents, out_of_stock, active)
     VALUES (?, ?, ?, 0, 0, 1)`
  ).run(catId, name, price).lastInsertRowid)
}

describe('per-line captain sale creation', () => {
  beforeAll(() => {
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    db.prepare(`INSERT INTO users (name, role, pin_hash) VALUES ('User', 'cashier', '1234')`).run()
    runSalesExtrasMigration(db)
    runDebtsMigration(db)
    runRemovePaymentIdMigration(db)
    runDebtWriteOffsMigration(db)
    runCategoriesMigration(db)
    runPerLineCaptainMigration(db)
    catId = (db.prepare(`SELECT id FROM categories WHERE name = 'Proteins'`).get() as { id: number }).id
  })

  afterAll(() => db.close())

  test('captain line stores menu value with zero total and flag; payable math untouched', () => {
    const chicken = seedItem('Chicken', 10000)
    const chips = seedItem('Chips', 3000)
    const saleId = salesRepo.create({
      subtotal_cents: 3000,
      discount_cents: 0,
      total_cents: 3000,
      debt_cents: 0,
      payment_method: 'cash',
      till_session_id: null,
      created_by: 1,
      items: [
        { item_id: chicken, price_cents: 0, quantity: 1, is_captain: true },
        { item_id: chips, price_cents: 3000, quantity: 1 },
      ],
    })
    const rows = db.prepare(
      'SELECT item_id, unit_price_cents, quantity, line_total_cents, is_captain FROM sale_items WHERE sale_id = ? ORDER BY id'
    ).all(saleId) as { item_id: number; unit_price_cents: number; quantity: number; line_total_cents: number; is_captain: number }[]
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ unit_price_cents: 10000, quantity: 1, line_total_cents: 0, is_captain: 1 })
    expect(rows[1]).toMatchObject({ unit_price_cents: 3000, quantity: 1, line_total_cents: 3000, is_captain: 0 })
    const sale = db.prepare('SELECT total_cents, debt_cents, status FROM sales WHERE id = ?').get(saleId) as { total_cents: number; debt_cents: number; status: string }
    expect(sale).toMatchObject({ total_cents: 3000, debt_cents: 0, status: 'completed' })
  })

  test('captain lines consume stock as captain_out, paid lines as sale_out', () => {
    const chicken = seedItem('Chicken2', 10000)
    const saleId = salesRepo.create({
      subtotal_cents: 0,
      discount_cents: 0,
      total_cents: 0,
      debt_cents: 0,
      payment_method: 'cash',
      till_session_id: null,
      created_by: 1,
      items: [{ item_id: chicken, price_cents: 0, quantity: 2, is_captain: true }],
    })
    const moves = db.prepare(
      'SELECT movement_type, quantity FROM item_stock_movements WHERE reference_table = ? AND reference_id = ?'
    ).all('sales', saleId) as { movement_type: string; quantity: number }[]
    expect(moves).toHaveLength(1)
    expect(moves[0]).toMatchObject({ movement_type: 'captain_out', quantity: 2 })
  })
})
```

Note: `menu_items.category_id` is NOT NULL, which is why the scaffold runs migration 007 and `seedItem` uses the seeded `Proteins` category id. Do not insert items with a NULL category.

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run electron/db/__tests__/per-line-captain.test.ts`
Expected: FAIL — `is_captain` column does not exist / `salesRepo.create` ignores the flag (assert on `is_captain: 1` fails).

- [ ] **Step 3: Minimal implementation in `salesRepo.ts`**

Change the `create` items parameter type to accept the flag:

```typescript
    items: Array<{ item_id: number; free_item_id?: number | null; price_cents: number; quantity?: number; is_captain?: boolean }>
```

Change the menu lookup to also fetch the selling price:

```typescript
    const getItem = db.prepare('SELECT name, selling_price_cents FROM menu_items WHERE id = ?')
```

Replace the item loop body with the captain-aware version:

```typescript
    for (const item of data.items) {
      const mi = getItem.get(item.item_id) as { name: string; selling_price_cents: number } | undefined
      const qty = item.quantity ?? 1
      const isCaptain = item.is_captain ? 1 : 0
      const unitPrice = isCaptain ? (mi?.selling_price_cents ?? item.price_cents) : item.price_cents
      insertItem.run(saleId, item.item_id, item.free_item_id ?? null, mi?.name ?? '', unitPrice, qty, isCaptain ? 0 : unitPrice * qty)
      // is_captain lines use the menu-value unit price with a zero line total (spec Section 1)
      db.prepare('UPDATE sale_items SET is_captain = ? WHERE sale_id = ? AND item_id = ? AND unit_price_cents = ? AND quantity = ?').run(
        isCaptain, saleId, item.item_id, unitPrice, qty
      )
      stockRepo.consumeForSale(item.item_id, qty, {
        movement_type: isCaptain ? 'captain_out' : 'sale_out',
        is_discount: data.discount_cents > 0 ? 1 : 0,
        reference_table: 'sales',
        reference_id: saleId,
        created_by: data.created_by,
      })
    }
```

Wait — do NOT use that UPDATE-by-match (it can hit the wrong row when two identical lines exist). Instead extend the INSERT to include the column. Replace the `insertItem` prepare with:

```typescript
    const insertItem = db.prepare(`
      INSERT INTO sale_items (sale_id, item_id, free_item_id, name_snapshot, unit_price_cents, quantity, line_total_cents, is_captain)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
```

and the run call with:

```typescript
      insertItem.run(saleId, item.item_id, item.free_item_id ?? null, mi?.name ?? '', unitPrice, qty, isCaptain ? 0 : unitPrice * qty, isCaptain)
```

(Use the extended INSERT, not the UPDATE. The UPDATE sketch above is shown only so you know what NOT to do.)

Also extend the `attachItems` SELECT (line 17) to return the flag:

```sql
SELECT id, sale_id, item_id, free_item_id, name_snapshot, unit_price_cents, quantity, line_total_cents, is_captain
```

- [ ] **Step 4: Run tests to verify green**

Run: `npx vitest run electron/db/__tests__/per-line-captain.test.ts`
Expected: PASS, 2/2. Then run: `npx vitest run electron/db/__tests__/debts-v2.test.ts electron/db/__tests__/debts.test.ts electron/db/__tests__/sales-history.test.ts`
Expected: all pass, no regressions.

- [ ] **Step 5: Commit**

```bash
git add electron/db/repositories/salesRepo.ts electron/db/__tests__/per-line-captain.test.ts
git commit -m "feat: persist per-line captain items with split stock movement"
```

---

### Task 3: Barter reports include captain-line value

**Files:**
- Modify: `electron/db/repositories/reportsRepo.ts`
- Test: `electron/db/__tests__/per-line-captain.test.ts` (append to the file from Task 2)

**Interfaces:**
- Consumes: stored `sale_items.is_captain` rows with menu-value `unit_price_cents` from Task 2.
- Produces: daily/monthly `barter_cents` including captain-line menu value; `getSales` item rows carrying the flag for Task 4's history tags.

- [ ] **Step 1: Write the failing tests** (append inside the existing `describe` block)

```typescript
  test('daily barter includes captain-line menu value; debts exclude it', () => {
    const chicken = seedItem('Chicken3', 10000)
    const saleId = salesRepo.create({
      subtotal_cents: 5000,
      discount_cents: 0,
      total_cents: 5000,
      debt_cents: 5000,
      payment_method: 'debt',
      till_session_id: null,
      created_by: 1,
      customer_name: 'Barter Customer',
      items: [
        { item_id: chicken, price_cents: 0, quantity: 1, is_captain: true },
        { item_id: chicken, price_cents: 5000, quantity: 1 },
      ],
    })
    const today = new Date().toISOString().slice(0, 10)
    db.prepare('UPDATE sales SET created_at = ? WHERE id = ?').run(`${today} 12:00:00`, saleId)
    const { reportsRepo } = await import('../repositories/reportsRepo')
    const days = reportsRepo.getDaily(today, today)
    expect(days).toHaveLength(1)
    expect(days[0].barter_cents).toBe(10000)
    expect(days[0].debt_sales_cents).toBe(5000)
    const debts = reportsRepo.getDebtSummary().filter(d => d.sale_id === saleId)
    expect(debts).toHaveLength(1)
    expect(debts[0].total_debt_cents).toBe(5000)
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run electron/db/__tests__/per-line-captain.test.ts`
Expected: FAIL on `barter_cents` (captain-line value missing; whole-sale barter only).

- [ ] **Step 3: Minimal implementation**

In `getDailyRow` (line 48–60), change the `barter_cents` expression from:

```sql
COALESCE(SUM(CASE WHEN status IN ('completed','unpaid') AND sale_kind = 'captain' THEN total_cents ELSE 0 END), 0) AS barter_cents,
```

to:

```sql
COALESCE(SUM(CASE WHEN status IN ('completed','unpaid') AND sale_kind = 'captain' THEN total_cents ELSE 0 END), 0)
+ COALESCE((
  SELECT SUM(si.unit_price_cents * si.quantity)
  FROM sale_items si
  JOIN sales s2 ON s2.id = si.sale_id
  WHERE DATE(s2.created_at) = DATE(s.created_at)
    AND si.is_captain = 1
    AND s2.status IN ('completed','unpaid')
    AND s2.sale_kind != 'captain'
), 0) AS barter_cents,
```

Apply the identical change to the monthly inner query's `barter_cents` (line 127), correlating on the month instead:

```sql
COALESCE(SUM(CASE WHEN s.status IN ('completed','unpaid') AND s.sale_kind = 'captain' THEN s.total_cents ELSE 0 END), 0)
+ COALESCE((
  SELECT SUM(si.unit_price_cents * si.quantity)
  FROM sale_items si
  JOIN sales sx ON sx.id = si.sale_id
  WHERE strftime('%Y-%m', sx.created_at) = strftime('%Y-%m', s.created_at)
    AND si.is_captain = 1
    AND sx.status IN ('completed','unpaid')
    AND sx.sale_kind != 'captain'
), 0) AS barter_cents,
```

Extend the `getSales` item SELECT (line 321) to return the flag:

```sql
SELECT id, sale_id, item_id, free_item_id, name_snapshot, unit_price_cents, quantity, line_total_cents, is_captain
```

Do NOT touch `getDebtSummary`, till summary, revenue, or net-profit formulas.

- [ ] **Step 4: Run tests to verify green**

Run: `npx vitest run electron/db/__tests__/per-line-captain.test.ts`
Expected: PASS, 3/3. Then re-run the Task 2 regression set from Task 2 Step 4.

- [ ] **Step 5: Commit**

```bash
git add electron/db/repositories/reportsRepo.ts electron/db/__tests__/per-line-captain.test.ts
git commit -m "feat: count per-line captain value in barter reports"
```

---

### Task 4: POS keypad Captain button + line flag + history tags

**Files:**
- Modify: `src/hooks/cartItems.ts`, `src/hooks/cartItems.test.ts`
- Modify: `src/components/LineDiscountPad.tsx`, `src/components/Cart.tsx`, `src/components/CartItem.tsx`, `src/pages/Sell/SellPage.tsx`
- Modify: `src/pages/Sales/SalesHistoryPage.tsx`, `src/pages/Reports/ReportsPage.tsx`

**Interfaces:**
- Consumes: `SaleItemInput.is_captain` payload contract from Task 1; sale payload already sends per-item `price_cents`.
- Produces: tapped Captain button → zero-price flagged line through checkout into `salesRepo.create`; visible Captain tags in cart, history, reports.

- [ ] **Step 1: Write the failing hook tests** (append to the existing `describe` in `src/hooks/cartItems.test.ts`; import `setLineCaptain` alongside `setLinePrice`)

```typescript
  it('setLineCaptain flags the line free at zero keeping menu value', () => {
    let out = addItemToCart([], item(1))
    out = setLineCaptain(out, 0, true)
    expect(out[0]).toMatchObject({ itemPrice: 0, menuPrice: 8000, isCaptain: true })
    expect(calcSubtotal(out)).toBe(0)
  })

  it('captain line merges only with same-item captain lines', () => {
    let out = addItemToCart([], item(1))
    out = setLineCaptain(out, 0, true)
    out = addItemToCart(out, item(1))
    expect(out).toHaveLength(2)
    out = setLineCaptain(out, 1, true)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ itemPrice: 0, quantity: 2, isCaptain: true })
  })

  it('editing a captain line to non-zero clears the flag', () => {
    let out = addItemToCart([], item(1))
    out = setLineCaptain(out, 0, true)
    out = setLinePrice(out, 0, 6000)
    expect(out[0]).toMatchObject({ itemPrice: 6000, isCaptain: false })
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/hooks/cartItems.test.ts`
Expected: FAIL — `setLineCaptain is not a function`.

- [ ] **Step 3: Minimal hook implementation** (append to `src/hooks/cartItems.ts`)

Add the optional flag to the interface:

```typescript
export interface CartLine {
  itemId: number
  itemName: string
  itemPrice: number
  menuPrice?: number
  isCaptain?: boolean
  addOnId: number | null
  addOnName: string | null
  quantity: number
}
```

Add the helper (merge only with same item/add-on/price/captain state):

```typescript
export function setLineCaptain(lines: CartLines, index: number, on: boolean): CartLines {
  const out = [...lines]
  const l = out[index]
  if (!l) return lines
  if (on) {
    out[index] = { ...l, itemPrice: 0, isCaptain: true }
  } else {
    out[index] = { ...l, itemPrice: l.menuPrice ?? l.itemPrice, isCaptain: false }
  }
  const cur = out[index]
  const twin = out.findIndex(
    (o, i) => i !== index && o.itemId === l.itemId && o.addOnId === l.addOnId
      && o.itemPrice === cur.itemPrice && !!o.isCaptain === !!cur.isCaptain
  )
  if (twin !== -1) {
    const keep = Math.min(index, twin)
    const drop = Math.max(index, twin)
    out[keep] = { ...out[keep], quantity: out[keep].quantity + out[drop].quantity }
    out.splice(drop, 1)
  }
  return out
}
```

Update `setLinePrice` so a manual edit to non-zero clears the flag, and the twin-match respects the flag. Replace the clamp + merge block with:

```typescript
  const cap = l.menuPrice ?? l.itemPrice
  const clamped = Math.max(0, Math.min(cap, Math.floor(newPriceCents)))
  const stillCaptain = !!l.isCaptain && clamped === 0
  out[index] = { ...l, itemPrice: clamped, isCaptain: stillCaptain }
  // Combine with an existing line only when the same discount lands on the same price
  const twin = out.findIndex(
    (o, i) => i !== index && o.itemId === l.itemId && o.addOnId === l.addOnId
      && o.itemPrice === clamped && !!o.isCaptain === stillCaptain
  )
```

(Keep the existing keep/drop merge body below it unchanged.)

Also update the `addItemToCart` merge finder to require flag equality so a menu re-tap never merges into a captain line:

```typescript
  const idx = out.findIndex(l => l.itemId === item.id && l.addOnId === null && l.itemPrice === item.selling_price_cents && !l.isCaptain)
```

- [ ] **Step 4: Run hook tests green**

Run: `npx vitest run src/hooks/cartItems.test.ts`
Expected: PASS (16 existing + 3 new = 19).

- [ ] **Step 5: Keypad Captain button** (`src/components/LineDiscountPad.tsx`)

Add an `onCaptain: () => void` prop and a full-width button above the C/Reset/Apply row:

```tsx
<Button type="button" onClick={onCaptain} variant="secondary" className="mt-2 h-12 w-full font-bold">
  Captain order — free
</Button>
```

Extend the props interface with `onCaptain: () => void` and destructure it in the function signature.

- [ ] **Step 6: Cart + SellPage plumbing**

In `src/components/Cart.tsx`, extend the props interface with `onSetLineCaptain: (index: number, on: boolean) => void`, destructure it, and pass to the pad:

```tsx
<LineDiscountPad
  itemName={discountLine.itemName}
  menuPrice={discountLine.menuPrice ?? discountLine.itemPrice}
  currentPrice={discountLine.itemPrice}
  onApply={(cents) => { onSetLinePrice(discountIndex, cents); setDiscountIndex(null) }}
  onCaptain={() => { onSetLineCaptain(discountIndex, true); setDiscountIndex(null) }}
  onClose={() => setDiscountIndex(null)}
/>
```

In `src/pages/Sell/SellPage.tsx`: import `setLineCaptain` next to `setLinePrice` in the `cartItems` import; add to the cart facade:

```typescript
      setLineCaptain: (index: number, on: boolean) =>
        setTabs(prev => prev.map(t => (t.id === id ? { ...t, items: setLineCaptain(t.items, index, on) } : t))),
```

pass `onSetLineCaptain={cart.setLineCaptain}` to `<Cart>`, and extend the sale payload items map (both `completeSale` and `completeCaptainOrder` map over `tab.items`) with the flag:

```typescript
        items: tab.items.map(item => ({
          item_id: item.itemId,
          free_item_id: item.addOnId ?? null,
          price_cents: item.itemPrice,
          quantity: item.quantity,
          is_captain: item.isCaptain ?? false,
        })),
```

- [ ] **Step 7: Captain tags** (cart row, history, reports)

In `src/components/CartItem.tsx`, after the existing `{discounted && (...)}` label block, add:

```tsx
        {item.isCaptain && (
          <p className="text-[0.6875rem] font-bold text-primary">Captain — free</p>
        )}
```

In `src/pages/Sales/SalesHistoryPage.tsx` expanded item rows (line 191 area), after the `name_snapshot` span add:

```tsx
                                {item.is_captain === 1 && (
                                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">Captain</span>
                                )}
```

In `src/pages/Reports/ReportsPage.tsx` sale item rows (line 183 area), after the `free_item_id` marker add:

```tsx
                           {it.is_captain === 1 ? ' (captain)' : ''}
```

so the line reads `{it.quantity} × {it.name_snapshot}{it.free_item_id != null ? ' (free)' : ''}{it.is_captain === 1 ? ' (captain)' : ''}`.

- [ ] **Step 8: Typecheck + targeted tests**

Run: `npx tsc --noEmit -p tsconfig.json` — Expected: exit 0.
Run: `npx vitest run src/hooks/cartItems.test.ts` — Expected: PASS 19/19.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/cartItems.ts src/hooks/cartItems.test.ts src/components/LineDiscountPad.tsx src/components/Cart.tsx src/components/CartItem.tsx src/pages/Sell/SellPage.tsx src/pages/Sales/SalesHistoryPage.tsx src/pages/Reports/ReportsPage.tsx
git commit -m "feat: per-line captain keypad button with flagged free lines"
```

---

### Task 5: Full verification gate

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all suites pass except the known pre-existing `electron/db/__tests__/chat-repo.test.ts` failures (4 tests, reproducible on the clean tree — verify with `git stash -u` + targeted rerun if the failure set changes).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0, no output.

- [ ] **Step 3: Manual tablet pass**

Open the POS, add two different items, tap one row, tap Captain order, complete the sale as cash. Confirm: receipt/history shows the Captain tag at 0, the daily report barter increased by the item's menu value, and stock decreased.

- [ ] **Step 4: Commit (only if Step 3 required code fixes; otherwise nothing to commit)**
