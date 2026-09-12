# POS Kitchen Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the BusinessPOS app into the warm, touch-first "Kitchen POS" design (orange-primary, pink-destructive, 72px icon nav rail, two-pane Sell with card grid + order panel) and aggregate cart quantities with steppers.

**Architecture:** All colors already flow through CSS custom properties in `src/styles/index.css` — the theme is a token swap plus rebuilding three bespoke surfaces (nav rail, item card, order panel) and one behavior change (cart aggregation, backed by a small `quantity` pass-through in `salesRepo`). Cart logic is extracted to a pure, testable module.

**Tech Stack:** Electron + React 18 + Vite, Tailwind v4 (CSS-first tokens in `src/styles/index.css`), shadcn/radix UI, better-sqlite3, vitest. New dep: `lucide-react` only.

**Spec:** `docs/superpowers/specs/2026-09-12-pos-restyle-design.md` (arguments live in the spec; read it with each task).

## Global Constraints

- No new features beyond approved cart quantity aggregation. Reference-only items (cashless credit, customer badges, promos, held sales, numpad, photos, sync status) are NOT built.
- Only `lucide-react` added to dependencies.
- All colors via tokens only — no hardcoded hex outside `src/styles/index.css`.
- Money: sales keep whole-UGX convention (`selling_price_cents` shown as-is, e.g. 8000 → "UGX 8,000"); do not introduce divide-by-100 in Sell/cart.
- Touch targets ≥ 44px: controls use `h-11` (44px) minimum; primary CTA is `h-14`; icon buttons `h-11 w-11` (override base sizes with className).
- Prices: bold + `text-primary` everywhere; free add-ons `text-success`; out-of-stock `text-muted-foreground`.
- Destructive/attention actions (remove, clear all, void, close till, delete, logout) use pink `--destructive` (`#EF4470`).
- Keep auto dark-mode media block (warm-inverted values from the spec §3).
- Currency formatting in this app: `new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 })`.
- Renderer entry `src/main.tsx`, router `src/App.tsx`, and all IPC surface (`window.api`) are untouched by this plan.
- Every task ends with `npx tsc -p tsconfig.json --noEmit` passing (or the spec's page run) before commit.

---

### Task 1: Warm theme tokens + radii

**Files:**
- Modify: `src/styles/index.css` (whole `:root` and dark blocks, radii)

**Interfaces:**
- Consumes: nothing.
- Produces: token values later tasks rely on: `--primary #F0821D`, `--destructive #EF4470`, `--background #FFFBF7`, `--foreground #241F3D`, `--muted #FAF5EF`, `--muted-foreground #9B96A8`, `--border #F0E7DC`, `--ring #F0B27D`, `--success #22C55E`, `--warning #D97706`, `--radius-sm 8px`, `--radius-md 12px`, `--radius-lg 16px`.

- [ ] **Step 1: Replace the `:root` palette block (lines 7-63) with the warm palette**

Values (kept on existing token names so the `@theme inline` mapping below is untouched):

```css
:root {
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 16px;
  --radius: 0.625rem;

  --background: #FFFBF7;
  --foreground: #241F3D;

  --card: #FFFFFF;
  --card-foreground: #241F3D;

  --popover: #FFFFFF;
  --popover-foreground: #241F3D;

  --primary: #F0821D;
  --primary-foreground: #FFFFFF;

  --secondary: #FAF5EF;
  --secondary-foreground: #241F3D;

  --muted: #FAF5EF;
  --muted-foreground: #9B96A8;

  --accent: #FAF5EF;
  --accent-foreground: #241F3D;

  --destructive: #EF4470;
  --destructive-foreground: #FFFFFF;

  --border: #F0E7DC;
  --input: #F0E7DC;
  --ring: #F0B27D;

  --success: #22C55E;
  --success-foreground: #FFFFFF;
  --warning: #D97706;
  --warning-foreground: #FFFFFF;
  --info: #0EA5E9;
  --info-foreground: #FFFFFF;

  --chart-1: #F0821D;
  --chart-2: #22C55E;
  --chart-3: #D97706;
  --chart-4: #EF4470;
  --chart-5: #7C3AED;

  --sidebar: #FFFFFF;
  --sidebar-foreground: #241F3D;
  --sidebar-primary: #F0821D;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #FFF0E3;
  --sidebar-accent-foreground: #241F3D;
  --sidebar-border: #F0E7DC;
  --sidebar-ring: #F0B27D;
}
```

- [ ] **Step 2: Replace the dark `@media (prefers-color-scheme: dark)` block (lines 65-110) with warm-inverted values**

```css
@media (prefers-color-scheme: dark) {
  :root {
    --background: #17121F;
    --foreground: #F7F2EC;

    --card: #221C2E;
    --card-foreground: #F7F2EC;

    --popover: #221C2E;
    --popover-foreground: #F7F2EC;

    --primary: #F5A14D;
    --primary-foreground: #17121F;

    --secondary: #2C2536;
    --secondary-foreground: #F7F2EC;

    --muted: #2C2536;
    --muted-foreground: #B9B3C4;

    --accent: #2C2536;
    --accent-foreground: #F7F2EC;

    --destructive: #FF5C85;
    --destructive-foreground: #FFFFFF;

    --border: #3A3344;
    --input: #3A3344;
    --ring: #F5A14D;

    --chart-1: #F5A14D;
    --chart-2: #34D399;
    --chart-3: #FBBF24;
    --chart-4: #FF5C85;
    --chart-5: #A78BFA;

    --sidebar: #221C2E;
    --sidebar-foreground: #F7F2EC;
    --sidebar-primary: #F5A14D;
    --sidebar-primary-foreground: #17121F;
    --sidebar-accent: #2C2536;
    --sidebar-accent-foreground: #F7F2EC;
    --sidebar-border: #3A3344;
    --sidebar-ring: #F5A14D;
  }
}
```

- [ ] **Step 3: Add a zebra-row utility for tables (used in Task 10)**

Append to the end of the file:

```css
@layer components {
  .table-zebra tbody tr:nth-child(even) {
    background-color: color-mix(in oklch, var(--muted) 60%, transparent);
  }
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: PASS (no TS changes; guards against accidental syntax break).

- [ ] **Step 5: Commit**

```bash
git add src/styles/index.css
git commit -m "style(pos): warm kitchen palette + larger radii"
```

---

### Task 2: Nav rail (lucide) + Header cleanup

**Files:**
- Create: (none)
- Modify: `package.json` (dep), `src/components/Sidebar.tsx`, `src/components/Header.tsx`

**Interfaces:**
- Consumes: `useAuth` from `src/context/AuthContext` exports `{ logout }`; `NavLink` from react-router-dom; `cn` from `@/lib/utils`.
- Produces: `Sidebar` (icon rail incl. logout) still rendered by `AppLayout` at the same spot; `Header` now takes only `{ onOpenTill: () => void }`.

- [ ] **Step 1: Install lucide-react**

Run: `npm install lucide-react`
Expected: `lucide-react` appears in `package.json` dependencies.

- [ ] **Step 2: Rewrite `src/components/Sidebar.tsx`**

Full replacement:

```tsx
import { NavLink, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  BarChart3,
  LogOut,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Trash2,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/sell', label: 'Sell', icon: ShoppingCart },
  { to: '/expenses', label: 'Expenses', icon: ReceiptText },
  { to: '/debts', label: 'Debts', icon: Wallet },
  { to: '/reimbursements', label: 'Reimbursements', icon: ArrowLeftRight },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/waste', label: 'Waste', icon: Trash2 },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="flex w-[72px] min-w-[72px] flex-col items-center justify-between overflow-y-auto border-r border-border bg-card py-3">
      <div className="flex flex-col items-center gap-1">
        <span className="mb-2 flex h-10 w-10 items-center justify-center text-xs font-extrabold text-primary" title="BusinessPOS">
          BP
        </span>
        {navItems.map(item => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              aria-label={item.label}
              className={({ isActive }) =>
                cn(
                  'flex h-12 w-12 items-center justify-center rounded-full transition-colors duration-100',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              <Icon className="h-6 w-6" strokeWidth={2} />
            </NavLink>
          )
        })}
      </div>
      <button
        type="button"
        onClick={handleLogout}
        title="Logout"
        aria-label="Logout"
        className="flex h-12 w-12 items-center justify-center rounded-full text-destructive transition-colors duration-100 hover:bg-destructive/10"
      >
        <LogOut className="h-6 w-6" strokeWidth={2} />
      </button>
    </nav>
  )
}
```

- [ ] **Step 3: Rewrite `src/components/Header.tsx`** (logout moved into rail)

Full replacement:

```tsx
import { TillStatus } from '../pages/Till/TillStatus'

interface HeaderProps {
  onOpenTill: () => void
}

export function Header({ onOpenTill }: HeaderProps) {
  return (
    <header className="flex h-14 min-h-14 items-center justify-end gap-3 border-b border-border bg-card px-6">
      <TillStatus onOpenTill={onOpenTill} />
    </header>
  )
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: PASS. (No test covers layout; visual check optional.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/Sidebar.tsx src/components/Header.tsx
git commit -m "feat(pos): 72px icon nav rail with in-rail logout"
```

---

### Task 3: Pure cart aggregation module + unit tests

**Files:**
- Create: `src/hooks/cartItems.ts`, `src/hooks/cartItems.test.ts`
- Modify: `vitest.config.ts` (include renderer pure-module tests)

**Interfaces:**
- Consumes: nothing.
- Produces (signatures consumed by Task 4 `useCart`, Task 7 `Cart`/`CartItem`, Task 8 `SellPage`):

```ts
export interface CartLine {
  itemId: number
  itemName: string
  itemPrice: number
  addOnId: number | null
  addOnName: string | null
  quantity: number
}
export type CartLines = CartLine[]

export function addItemToCart(lines: CartLines, item: { id: number; name: string; selling_price_cents: number }): CartLines
export function incrementCartLine(lines: CartLines, index: number): CartLines
export function decrementCartLine(lines: CartLines, index: number): CartLines   // qty 1 → line removed
export function removeCartLine(lines: CartLines, index: number): CartLines
export function attachAddOnToCart(
  lines: CartLines,
  data: { pricedItemId: number; pricedItemName: string; pricedPrice: number; addOnId: number; addOnName: string }
): CartLines
export function calcLineTotal(line: CartLine): number
export function calcSubtotal(lines: CartLines): number
```

- [ ] **Step 1: Write the failing test**

Create `src/hooks/cartItems.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  addItemToCart,
  attachAddOnToCart,
  calcLineTotal,
  calcSubtotal,
  decrementCartLine,
  incrementCartLine,
  removeCartLine,
  type CartLines,
} from './cartItems'

const item = (id: number, name = 'Chicken', selling_price_cents = 8000) => ({ id, name, selling_price_cents })

describe('cartItems aggregation', () => {
  it('adds a line with quantity 1 on first tap', () => {
    const out = addItemToCart([], item(1))
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ itemId: 1, itemName: 'Chicken', itemPrice: 8000, addOnId: null, addOnName: null, quantity: 1 })
  })

  it('merges repeated taps into one line and bumps quantity', () => {
    let out = addItemToCart([], item(1))
    out = addItemToCart(out, item(1))
    out = addItemToCart(out, item(1))
    expect(out).toHaveLength(1)
    expect(out[0].quantity).toBe(3)
  })

  it('keeps distinct items as separate lines', () => {
    let out = addItemToCart([], item(1))
    out = addItemToCart(out, item(2, 'Goat', 10000))
    expect(out).toHaveLength(2)
    expect(out[0].itemId).toBe(1)
    expect(out[1].itemId).toBe(2)
  })

  it('increment bumps quantity', () => {
    let out = addItemToCart([], item(1))
    out = incrementCartLine(out, 0)
    expect(out[0].quantity).toBe(2)
  })

  it('decrement reduces quantity and removes the line at 1', () => {
    let out = addItemToCart([], item(1))
    out = addItemToCart(out, item(1))
    expect(out[0].quantity).toBe(2)
    out = decrementCartLine(out, 0)
    expect(out[0].quantity).toBe(1)
    out = decrementCartLine(out, 0)
    expect(out).toHaveLength(0)
  })

  it('removeCartLine drops the line at index', () => {
    let out = addItemToCart([], item(1))
    out = addItemToCart(out, item(2, 'Goat', 10000))
    out = removeCartLine(out, 0)
    expect(out).toHaveLength(1)
    expect(out[0].itemId).toBe(2)
  })

  it('attachAddOn moves one unit from the plain line into the variant line', () => {
    let out = addItemToCart([], item(1))
    out = attachAddOnToCart(out, { pricedItemId: 1, pricedItemName: 'Chicken', pricedPrice: 8000, addOnId: 9, addOnName: 'Banana' })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ itemId: 1, addOnId: 9, addOnName: 'Banana', quantity: 1 })
  })

  it('attachAddOn with qty 3 leaves a plain line of 2 plus a variant of 1', () => {
    let out = addItemToCart([], item(1))
    out = addItemToCart(out, item(1))
    out = addItemToCart(out, item(1))
    out = attachAddOnToCart(out, { pricedItemId: 1, pricedItemName: 'Chicken', pricedPrice: 8000, addOnId: 9, addOnName: 'Banana' })
    expect(out).toHaveLength(2)
    const plain = out.find(l => l.addOnId === null)!
    const variant = out.find(l => l.addOnId === 9)!
    expect(plain.quantity).toBe(2)
    expect(variant.quantity).toBe(1)
  })

  it('attachAddOn merges into an existing variant line', () => {
    let out = addItemToCart([], item(1))
    out = attachAddOnToCart(out, { pricedItemId: 1, pricedItemName: 'Chicken', pricedPrice: 8000, addOnId: 9, addOnName: 'Banana' })
    out = addItemToCart(out, item(1))
    out = attachAddOnToCart(out, { pricedItemId: 1, pricedItemName: 'Chicken', pricedPrice: 8000, addOnId: 9, addOnName: 'Banana' })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ addOnId: 9, quantity: 2 })
  })

  it('calcLineTotal and calcSubtotal multiply price by quantity', () => {
    const lines: CartLines = [
      { itemId: 1, itemName: 'Chicken', itemPrice: 8000, addOnId: null, addOnName: null, quantity: 2 },
      { itemId: 2, itemName: 'Goat', itemPrice: 10000, addOnId: 9, addOnName: 'Banana', quantity: 1 },
    ]
    expect(calcLineTotal(lines[0])).toBe(16000)
    expect(calcSubtotal(lines)).toBe(26000)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/cartItems.test.ts`
Expected: FAIL (module `./cartItems` not found).

- [ ] **Step 3: Write the pure module**

Create `src/hooks/cartItems.ts`:

```ts
export interface CartLine {
  itemId: number
  itemName: string
  itemPrice: number
  addOnId: number | null
  addOnName: string | null
  quantity: number
}

export type CartLines = CartLine[]

export function addItemToCart(
  lines: CartLines,
  item: { id: number; name: string; selling_price_cents: number }
): CartLines {
  const out = [...lines]
  const idx = out.findIndex(l => l.itemId === item.id && l.addOnId === null)
  if (idx !== -1) {
    const l = out[idx]
    out[idx] = { ...l, itemPrice: item.selling_price_cents, quantity: l.quantity + 1 }
  } else {
    out.push({ itemId: item.id, itemName: item.name, itemPrice: item.selling_price_cents, addOnId: null, addOnName: null, quantity: 1 })
  }
  return out
}

export function incrementCartLine(lines: CartLines, index: number): CartLines {
  const out = [...lines]
  const l = out[index]
  if (!l) return lines
  out[index] = { ...l, quantity: l.quantity + 1 }
  return out
}

export function decrementCartLine(lines: CartLines, index: number): CartLines {
  const out = [...lines]
  const l = out[index]
  if (!l) return lines
  if (l.quantity > 1) {
    out[index] = { ...l, quantity: l.quantity - 1 }
  } else {
    out.splice(index, 1)
  }
  return out
}

export function removeCartLine(lines: CartLines, index: number): CartLines {
  return lines.filter((_, i) => i !== index)
}

export function attachAddOnToCart(
  lines: CartLines,
  data: { pricedItemId: number; pricedItemName: string; pricedPrice: number; addOnId: number; addOnName: string }
): CartLines {
  const out = [...lines]
  const plainIdx = out.findIndex(l => l.itemId === data.pricedItemId && l.addOnId === null)
  if (plainIdx === -1) return lines
  if (out[plainIdx].quantity > 1) {
    out[plainIdx] = { ...out[plainIdx], quantity: out[plainIdx].quantity - 1 }
  } else {
    out.splice(plainIdx, 1)
  }
  const variantIdx = out.findIndex(l => l.itemId === data.pricedItemId && l.addOnId === data.addOnId)
  if (variantIdx === -1) {
    out.push({
      itemId: data.pricedItemId,
      itemName: data.pricedItemName,
      itemPrice: data.pricedPrice,
      addOnId: data.addOnId,
      addOnName: data.addOnName,
      quantity: 1,
    })
  } else {
    out[variantIdx] = { ...out[variantIdx], quantity: out[variantIdx].quantity + 1 }
  }
  return out
}

export function calcLineTotal(line: CartLine): number {
  return line.itemPrice * line.quantity
}

export function calcSubtotal(lines: CartLines): number {
  return lines.reduce((sum, l) => sum + calcLineTotal(l), 0)
}
```

- [ ] **Step 4: Include renderer pure-module tests in vitest**

Modify `vitest.config.ts` include:

```ts
include: ['electron/**/*.test.ts', 'src/**/*.test.ts'],
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/hooks/cartItems.test.ts`
Expected: PASS (all 10 cases).

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts src/hooks/cartItems.ts src/hooks/cartItems.test.ts
git commit -m "feat(cart): pure line aggregation module with tests"
```

---

### Task 4: useCart rewrite (aggregation + steppers + attachAddOn)

**Files:**
- Modify: `src/hooks/useCart.ts`

**Interfaces:**
- Consumes: pure module from Task 3.
- Produces (consumed by Task 7 `Cart`/`CartItem` and Task 8 `SellPage`):

```ts
export function useCart(): {
  items: CartLine[]
  addItem(item: { id: number; name: string; selling_price_cents: number }): void
  increment(index: number): void
  decrement(index: number): void
  removeItem(index: number): void
  attachAddOn(data: { pricedItemId: number; pricedItemName: string; pricedPrice: number; addOnId: number; addOnName: string }): void
  clearCart(): void
  discountCents: number
  setDiscountCents(n: number): void
  discountReason: string
  setDiscountReason(s: string): void
  subtotal: number
  total: number
  itemCount: number
}
```

- [ ] **Step 1: Rewrite the hook**

Full replacement of `src/hooks/useCart.ts`:

```ts
import { useCallback, useMemo, useState } from 'react'
import {
  addItemToCart,
  attachAddOnToCart,
  calcSubtotal,
  decrementCartLine,
  incrementCartLine,
  removeCartLine,
  type CartLine,
} from './cartItems'

export type { CartLine }

export function useCart() {
  const [items, setItems] = useState<CartLine[]>([])
  const [discountCents, setDiscountCents] = useState(0)
  const [discountReason, setDiscountReason] = useState<string>('')

  const addItem = useCallback((item: { id: number; name: string; selling_price_cents: number }) => {
    setItems(prev => addItemToCart(prev, item))
  }, [])

  const increment = useCallback((index: number) => {
    setItems(prev => incrementCartLine(prev, index))
  }, [])

  const decrement = useCallback((index: number) => {
    setItems(prev => decrementCartLine(prev, index))
  }, [])

  const removeItem = useCallback((index: number) => {
    setItems(prev => removeCartLine(prev, index))
  }, [])

  const attachAddOn = useCallback((data: {
    pricedItemId: number
    pricedItemName: string
    pricedPrice: number
    addOnId: number
    addOnName: string
  }) => {
    setItems(prev => attachAddOnToCart(prev, data))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    setDiscountCents(0)
    setDiscountReason('')
  }, [])

  const subtotal = useMemo(() => calcSubtotal(items), [items])
  const total = useMemo(() => Math.max(0, subtotal - discountCents), [subtotal, discountCents])
  const itemCount = useMemo(() => items.reduce((sum, l) => sum + l.quantity, 0), [items])

  return {
    items,
    addItem,
    increment,
    decrement,
    removeItem,
    attachAddOn,
    clearCart,
    discountCents,
    setDiscountCents,
    discountReason,
    setDiscountReason,
    subtotal,
    total,
    itemCount,
  }
}
```

Note: `setAddOn` is removed from the hook surface — Task 8 fixes its only caller (`SellPage`). `itemCount` now counts units, not lines (no current consumer depends on the old meaning).

- [ ] **Step 2: Verify**

Run: `npx vitest run src/hooks/cartItems.test.ts && npx tsc -p tsconfig.json --noEmit`
Expected: tests PASS; tsc PASS (SellPage still compiles because `setAddOn` call sites get fixed in Task 8 — if tsc flags the stale `cart.setAddOn` call, that is expected and is cleared by Task 8; resolve it here only if it blocks).

If tsc errors on the stale call and you want each commit green, temporarily keep `setAddOn` in Task 4:

```ts
/** @deprecated removed in Task 8 */
const setAddOn = useCallback((addOn: { id: number; name: string }) => {
  setItems(prev => attachAddOnToCart(prev, {
    pricedItemId: prev[prev.length - 1]?.itemId ?? 0,
    pricedItemName: prev[prev.length - 1]?.itemName ?? '',
    pricedPrice: prev[prev.length - 1]?.itemPrice ?? 0,
    addOnId: addOn.id,
    addOnName: addOn.name,
  }))
}, [])
```

and return it. Delete this shim in Task 8.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCart.ts
git commit -m "feat(cart): aggregate quantities with steppers via useCart"
```

---

### Task 5: Sale quantity pass-through (types + salesRepo) + test

**Files:**
- Modify: `shared/types.ts:260-264` (`SaleItemInput`), `electron/db/repositories/salesRepo.ts` (item type + insert), `electron/__tests__/integration.test.ts` (new test 9)

**Interfaces:**
- Consumes: existing `salesRepo.create` callers.
- Produces: `SaleItemInput` gains `quantity?: number`; `salesRepo.create` writes `quantity ?? 1` and `line_total_cents = price_cents * quantity`. Backward compatible (existing callers omit `quantity` → 1, same rows as before).

- [ ] **Step 1: Write the failing backend test**

Append to `electron/__tests__/integration.test.ts` inside the existing `describe` (after test 8, so revenue assertions in earlier tests are unaffected):

```ts
test('9. Sale with quantity>1 writes a single line with correct totals', () => {
  const saleId = salesRepo.create({
    subtotal_cents: 24000,
    discount_cents: 0,
    total_cents: 24000,
    debt_cents: 0,
    payment_method: 'cash',
    created_by: userId,
    items: [{ item_id: chicken.id, price_cents: 8000, quantity: 3 }],
  })
  expect(saleId).toBeGreaterThan(0)
  const rows = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId) as any[]
  expect(rows).toHaveLength(1)
  expect(rows[0].quantity).toBe(3)
  expect(rows[0].unit_price_cents).toBe(8000)
  expect(rows[0].line_total_cents).toBe(24000)
  expect(rows[0].name_snapshot).toBe('Chicken')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run electron/__tests__/integration.test.ts -t "quantity"`
Expected: FAIL — `line_total_cents` is `8000` (repo hardcodes qty 1), not `24000`.

- [ ] **Step 3: Update `SaleItemInput`**

In `shared/types.ts`, replace lines 260-264:

```ts
export interface SaleItemInput {
  item_id: number
  free_item_id?: number | null
  price_cents: number
  quantity?: number
}
```

- [ ] **Step 4: Update `salesRepo.create`**

In `electron/db/repositories/salesRepo.ts`:
- Item array type (line 14): `items: Array<{ item_id: number; free_item_id?: number | null; price_cents: number; quantity?: number }>`
- Loop insert (lines 43-46) becomes:

```ts
for (const item of data.items) {
  const mi = getItem.get(item.item_id) as { name: string } | undefined
  const qty = item.quantity ?? 1
  insertItem.run(saleId, item.item_id, item.free_item_id ?? null, mi?.name ?? '', item.price_cents, qty, item.price_cents * qty)
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run electron/__tests__/integration.test.ts`
Expected: PASS (all 9 tests; earlier quantity-1 behavior identical).

- [ ] **Step 6: Verify types + commit**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: PASS.

```bash
git add shared/types.ts electron/db/repositories/salesRepo.ts electron/__tests__/integration.test.ts
git commit -m "feat(sales): persist item quantity and per-line totals"
```

---

### Task 6: ItemCard redesign (card + tinted tile)

**Files:**
- Modify: `src/components/ItemCard.tsx`

**Interfaces:**
- Consumes: `MenuItemWithCategory` from `../../shared/types`; `Button` from `./ui/button`; `cn` from `@/lib/utils`.
- Produces: same props `{ item, selected, onSelect }`; grid container in SellPage keeps `[grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]`.

- [ ] **Step 1: Rewrite the card**

Full replacement of `src/components/ItemCard.tsx`:

```tsx
import type { MenuItemWithCategory } from '../../shared/types'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'

interface ItemCardProps {
  item: MenuItemWithCategory
  selected: boolean
  onSelect: (item: MenuItemWithCategory) => void
}

export function ItemCard({ item, selected, onSelect }: ItemCardProps) {
  const outOfStock = item.out_of_stock === 1
  const isPriced = item.category_kind === 'priced'
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)
  const tile = item.name.trim().charAt(0).toUpperCase() || '?'

  return (
    <Button
      type="button"
      onClick={() => { if (!outOfStock) onSelect(item) }}
      disabled={outOfStock}
      variant="outline"
      className={cn(
        'flex h-auto min-h-[132px] w-full flex-col items-start justify-between gap-3 rounded-[var(--radius-md)] border p-4 text-left',
        outOfStock
          ? 'cursor-not-allowed border-dashed opacity-60'
          : selected
            ? 'border-2 border-primary bg-primary/5'
            : 'hover:border-primary/50'
      )}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className={cn('text-base font-bold leading-tight', outOfStock && 'text-muted-foreground')}>
          {item.name}
        </span>
        <span
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-lg font-extrabold',
            outOfStock
              ? 'bg-muted text-muted-foreground'
              : isPriced
                ? 'bg-primary/10 text-primary'
                : 'bg-success/10 text-success'
          )}
        >
          {outOfStock ? '—' : tile}
        </span>
      </div>
      <span
        className={cn(
          'text-lg font-extrabold',
          outOfStock
            ? 'text-muted-foreground'
            : isPriced
              ? 'text-primary'
              : 'text-success'
        )}
      >
        {outOfStock ? 'Out of stock' : isPriced ? fmt(item.selling_price_cents) : 'Free'}
      </span>
    </Button>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: PASS (Button `variant="outline"` provides `bg-background hover:bg-muted`; the added classes layer the card look).

- [ ] **Step 3: Commit**

```bash
git add src/components/ItemCard.tsx
git commit -m "feat(sell): item cards with tinted initial tile"
```

---

### Task 7: Order panel + order line with steppers

**Files:**
- Modify: `src/components/Cart.tsx`, `src/components/CartItem.tsx`

**Interfaces:**
- Consumes: `CartLine` type + `calcLineTotal` from `../hooks/cartItems`; `Button` from `./ui/button`; lucide `Minus`, `Plus`, `Trash2`.
- Produces: `Cart` props become:

```ts
interface CartProps {
  items: CartLine[]
  subtotal: number
  discountCents: number
  discountReason: string
  total: number
  onRemoveItem: (index: number) => void
  onIncrement: (index: number) => void
  onDecrement: (index: number) => void
  onClear: () => void
  onSetDiscount: () => void
  onDebtSale: () => void
  onCompleteSale: () => void
}
```

`CartItem` props become `{ item: CartLine; index: number; onRemove; onIncrement; onDecrement }`. Component/file names are kept (`Cart` = OrderPanel, `CartItem` = OrderLine) so SellPage's imports don't change.

- [ ] **Step 1: Rewrite `src/components/CartItem.tsx` (OrderLine)**

```tsx
import { Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import { calcLineTotal } from '../hooks/cartItems'
import type { CartLine } from '../hooks/cartItems'

interface CartItemProps {
  item: CartLine
  index: number
  onRemove: (index: number) => void
  onIncrement: (index: number) => void
  onDecrement: (index: number) => void
}

export function CartItem({ item, index, onRemove, onIncrement, onDecrement }: CartItemProps) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)
  const tile = item.itemName.trim().charAt(0).toUpperCase() || '?'

  return (
    <div className="flex items-center gap-3 border-b border-border py-2">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary/10 text-sm font-extrabold text-primary">
        {tile}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{item.itemName}</p>
        <p className="text-xs font-medium text-muted-foreground">
          {item.addOnName ? `+ ${item.addOnName}` : `${fmt(item.itemPrice)} each`}
        </p>
      </div>
      <div className="flex items-center">
        <Button
          onClick={() => onDecrement(index)}
          variant="outline"
          size="icon"
          aria-label="Decrease quantity"
          className="h-11 w-11 rounded-full bg-card"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-7 text-center text-sm font-extrabold">{item.quantity}</span>
        <Button
          onClick={() => onIncrement(index)}
          variant="outline"
          size="icon"
          aria-label="Increase quantity"
          className="h-11 w-11 rounded-full bg-card"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => onRemove(index)}
          variant="ghost"
          size="icon"
          aria-label="Remove line"
          className="ml-1 h-11 w-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>
      <span className="w-[76px] text-right text-sm font-extrabold">{fmt(calcLineTotal(item))}</span>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `src/components/Cart.tsx` (OrderPanel)**

```tsx
import { CartItem } from './CartItem'
import { Button } from './ui/button'
import type { CartLine } from '../hooks/cartItems'

interface CartProps {
  items: CartLine[]
  subtotal: number
  discountCents: number
  discountReason: string
  total: number
  onRemoveItem: (index: number) => void
  onIncrement: (index: number) => void
  onDecrement: (index: number) => void
  onClear: () => void
  onSetDiscount: () => void
  onDebtSale: () => void
  onCompleteSale: () => void
}

export function Cart({ items, subtotal, discountCents, discountReason, total, onRemoveItem, onIncrement, onDecrement, onClear, onSetDiscount, onDebtSale, onCompleteSale }: CartProps) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-1 pb-3">
        <h2 className="text-xl font-bold">Current Order</h2>
        <Button
          onClick={onClear}
          disabled={items.length === 0}
          variant="ghost"
          className="h-11 px-3 font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          Clear All
        </Button>
      </div>

      <div className="flex-1 overflow-auto px-1 py-2">
        {items.length === 0 ? (
          <p className="mt-6 text-center text-sm font-medium text-muted-foreground">Cart is empty</p>
        ) : (
          items.map((item, i) => (
            <CartItem
              key={`${item.itemId}-${item.addOnId ?? 'none'}`}
              item={item}
              index={i}
              onRemove={onRemoveItem}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
            />
          ))
        )}
      </div>

      <div className="flex flex-col gap-3 border-t-2 border-border p-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between">
            <span className="text-sm font-medium text-muted-foreground">Subtotal</span>
            <span className="text-sm font-bold">{fmt(subtotal)}</span>
          </div>
          {discountCents > 0 && (
            <div className="flex justify-between">
              <span className="text-sm font-medium text-destructive">Discount ({discountReason})</span>
              <span className="text-sm font-bold text-destructive">-{fmt(discountCents)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-border pt-2">
            <span className="text-2xl font-extrabold">Total</span>
            <span className="text-2xl font-extrabold text-primary">{fmt(total)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={onSetDiscount} variant="outline" className="h-11 flex-1 bg-card font-semibold">
            Discount
          </Button>
          <Button
            onClick={onDebtSale}
            disabled={items.length === 0}
            variant="outline"
            className="h-11 flex-1 border-warning bg-card font-bold text-warning"
          >
            Debt
          </Button>
        </div>

        <Button
          onClick={onCompleteSale}
          disabled={items.length === 0}
          className="h-14 w-full bg-primary text-base font-bold text-white"
        >
          Complete Sale
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: FAIL — `SellPage` passes the old prop set and still calls `cart.setAddOn`. This is expected; Task 8 fixes the caller.

- [ ] **Step 4: Commit (allowed to be red until Task 8)**

```bash
git add src/components/Cart.tsx src/components/CartItem.tsx
git commit -m "feat(sell): order panel with steppers and clear-all"
```

If the repo convention forbids red commits, defer this commit until Task 8 completes and commit both together.

---

### Task 8: SellPage wiring (pills, grid, attachAddOn, quantity payload)

**Files:**
- Modify: `src/pages/Sell/SellPage.tsx`

**Interfaces:**
- Consumes: `cart.attachAddOn`, `cart.increment`, `cart.decrement`, `cart.clearCart`, `CartLine` (via `cart.items`), new `Cart`/`CartItem` props from Task 7.
- Produces: sale payload items of shape `{ item_id, free_item_id, price_cents, quantity }` to `window.api['sales:create']`.

- [ ] **Step 1: Update imports and category-tab pills**

Add `import { cn } from '@/lib/utils'` at the top.

Replace the category chips block (lines 122-137) with pill styling:

```tsx
<div className="flex flex-wrap gap-2">
  {activeCategories.map(c => {
    const isSelected = selectedCategory?.id === c.id
    return (
      <Button
        key={c.id}
        type="button"
        onClick={() => handleCategorySelect(c)}
        variant={isSelected ? 'default' : 'outline'}
        className={cn(
          'h-11 min-h-11 rounded-full px-4 text-[0.875rem] font-bold',
          !isSelected && 'bg-card'
        )}
      >
        {c.name}
      </Button>
    )
  })}
</div>
```

- [ ] **Step 2: Tighten the item grid + widen the order panel**

Replace the grid class (line 143) `[grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]` with:

```tsx
<div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
```

Replace the cart panel class (line 165) `w-[340px] min-w-[340px]` with:

```tsx
w-[360px] min-w-[360px]
```

Also remove the panel's `<h2 className="mb-4 text-xl font-bold">Current Sale</h2>` (the panel header now lives in `Cart`). Keep the till-warning and message paragraphs.

- [ ] **Step 3: Rewire add-on selection to `attachAddOn`**

Replace `handleAddOnSelect` (lines 51-54):

```tsx
const handleAddOnSelect = (item: MenuItemWithCategory) => {
  if (selectedItem) {
    cart.attachAddOn({
      pricedItemId: selectedItem.id,
      pricedItemName: selectedItem.name,
      pricedPrice: selectedItem.selling_price_cents,
      addOnId: item.id,
      addOnName: item.name,
    })
  }
  setSelectedItem(null)
}
```

Delete the now-unused `const freeItems = items.filter(...)` line only if tsc flags it (it is used to build the add-on list passed to `AddOnSelector` — keep it).

- [ ] **Step 4: Wire new Cart props and quantity payload**

Replace the `<Cart ... />` block:

```tsx
<Cart
  items={cart.items}
  subtotal={cart.subtotal}
  discountCents={cart.discountCents}
  discountReason={cart.discountReason}
  total={cart.total}
  onRemoveItem={cart.removeItem}
  onIncrement={cart.increment}
  onDecrement={cart.decrement}
  onClear={cart.clearCart}
  onSetDiscount={() => setShowDiscount(true)}
  onDebtSale={() => setShowDebt(true)}
  onCompleteSale={() => requestSale('cash')}
/>
```

In `completeSale`, replace the `items` mapping (lines 84-88):

```tsx
items: cart.items.map(item => ({
  item_id: item.itemId,
  free_item_id: item.addOnId ?? null,
  price_cents: item.itemPrice,
  quantity: item.quantity,
})),
```

- [ ] **Step 5: Remove the deprecated `setAddOn` shim if Task 4 added one**

In `src/hooks/useCart.ts` delete the `/** @deprecated ... */ const setAddOn ...` block and its return entry.

- [ ] **Step 6: Verify**

Run: `npx tsc -p tsconfig.json --noEmit && npx vitest run`
Expected: tsc PASS; vitest PASS (all tests incl. new quantity + cartItems cases).

- [ ] **Step 7: Commit**

```bash
git add src/pages/Sell/SellPage.tsx src/hooks/useCart.ts
git commit -m "feat(sell): wire pills, grid, add-on attach and quantity payload"
```

---

### Task 9: Modal/selector touch-ups

**Files:**
- Modify: `src/components/AddOnSelector.tsx`, `src/components/DiscountModal.tsx`, `src/components/DebtModal.tsx`

**Interfaces:**
- Consumes: tokens from Task 1; no signature changes.

- [ ] **Step 1: AddOnSelector pills**

In `src/components/AddOnSelector.tsx`, change the button className to pill + touch height:

```tsx
className="flex h-11 min-h-11 flex-col items-start rounded-full bg-card px-4 text-[0.875rem] font-semibold"
```

- [ ] **Step 2: DiscountModal + DebtModal button/title touch-ups**

`DiscountModal.tsx` — CTA stays orange (tokens); bump inputs to touch height by adding `h-11` to both `Input` classNames (`bg-background text-base` → `h-11 bg-background text-base`). Same for `DebtModal.tsx` customer-name `Input`.

- [ ] **Step 3: Verify**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/AddOnSelector.tsx src/components/DiscountModal.tsx src/components/DebtModal.tsx
git commit -m "style(pos): add-on pills and modal touch sizes"
```

---

### Task 10: App-wide sweep (touch targets + zebra tables + hardcoded colors)

**Files:**
- Modify: `src/styles/index.css` (already has `.table-zebra` from Task 1), `src/components/ui/input.tsx`, `src/components/ui/select.tsx`, plus page files found by grep (pinpoint edits below).

**Interfaces:**
- Consumes: nothing new.

- [ ] **Step 1: Bump base input/select heights to 44px**

In `src/components/ui/input.tsx` find the `h-10` in the base class and change to `h-11`.
In `src/components/ui/select.tsx` change the `Trigger` height class from `h-10` to `h-11` (its `triggerClass` default if present).

- [ ] **Step 2: Sweep remaining `h-10` controls**

Run: `rg -n "h-10" src --glob "*.tsx" | rg -v "h-10 w-10|h-10 shrink-0|tile"`
For each hit that is an interactive control (button, select trigger, input, date-picker trigger, pagination) change to `h-11`. Do NOT touch `h-10 w-10` decoroative tiles in `ItemCard`/`CartItem`, and do NOT touch `min-h-10`.

- [ ] **Step 3: Zebra rows on data tables**

Find tables: `rg -ln "<Table" src/pages`.
For each page containing a data table (ExpenseList, Debts, Inventory, Waste, Reports, Reimbursements), add `className="table-zebra"` to the shadcn `<Table ...>` element (merge with any existing className via `cn(...)`).

- [ ] **Step 4: Recheck hardcoded colors**

Run: `rg -n "#[0-9a-fA-F]{3,6}" src --glob "*.tsx"`
Expected: no matches (only `index.css` keeps hex). Fix any stray color literals by mapping to tokens.

- [ ] **Step 5: Verify**

Run: `npx tsc -p tsconfig.json --noEmit && npx vitest run`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "style(pos): 44px touch targets and zebra tables"
```

---

### Task 11: Full verification

**Files:**
- Modify: (none)

- [ ] **Step 1: Typecheck**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: no output (PASS).

- [ ] **Step 2: All tests**

Run: `npm run test`
Expected: Test Files 4 passed (3 electron + 1 src), all tests pass (existing 22 + new cartItems + new sale-quantity).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: `vite build` + `tsc -p tsconfig.node.json` both succeed.

- [ ] **Step 4: Spot-check in the running dev app** (if the dev server is still up; otherwise note for the user)

- Rail: all 8 routes navigate; active pill; logout in rail.
- Sell: category pills; card grid; tap Chicken ×3 → one line qty 3; −/+ steppers; trash removes line; add-on flow merges one unit; discount shows as negative pink; debt flow; Clear All; Complete Sale writes sale (verify via Reports).
- Dark mode (OS preference) re-skins warm-dark.

- [ ] **Step 5: Commit any stray changes**

```bash
git status --porcelain && git add -A && git commit -m "chore(pos): final restyle verification fixes" || true
```

---

## Self-Review (run before handing off)

1. **Spec coverage vs tasks:**
   - §3 tokens/radii/dark → Task 1
   - §4 shell/nav/header → Task 2
   - §5 Sell rebuild (tabs, ItemCard, Cart=OrderPanel, CartItem=OrderLine, useCart, SellPage wiring) → Tasks 6, 7, 8, 4
   - §6 backend quantity + tests → Task 5
   - §8 sweep (touch, zebra, colors) → Task 10
   - §9 deps (lucide-react) → Task 2
   - §10 verification → Task 11
2. **Placeholder scan:** all steps carry concrete code; no TBD/todo/invoke-later patterns.
3. **Type consistency:** `CartLine` defined in Task 3, used in Tasks 4/7/8; `attachAddOnToCart` signature identical across Tasks 3/4/8; `SaleItemInput.quantity` defined in Task 5 and used in Task 8's payload; `cart.increment/decrement/clear/setAddOn-removal` consistent between Tasks 4, 7, and 8. `setAddOn` removal is sequenced (Task 4 may shim it, Task 8 deletes the shim) to keep each commit green.