# Kitchen POS Restyle — Design Spec

Date: 2026-09-12
Status: Approved in chat (scope, cart steppers, item-card tile all confirmed)

## 1. Context & Goal

Restyle the BusinessPOS Electron app into the warm, touch-first "Kitchen POS" design (reference: item grid + persistent order panel). **Scope is restyle + one behavior change (cart quantity aggregation); no new features.** The reference's unavailable features are explicitly out of scope (see §7).

All design tokens come from the approved "Kitchen Point of Sale (Offline)" design doc; this spec adapts those tokens to the app's existing token names so the whole app re-skins at once.

### Decisions locked in chat
- Scope: **full restyle, existing features only** (no cashless credit, customer/loyalty badges, promos, held-sale resume, numpad cash entry, item photos).
- Cart: **aggregate quantities with −/+ steppers** (behavior change, requires small backend change, §5).
- Item cards: **initial on a tinted tile** replaces the reference photo.
- Destructive/attention actions become pink; auto dark mode retained (warm-inverted).

## 2. Current State (verified)

- Every app color flows through CSS custom properties in `src/styles/index.css`; **no hardcoded hex outside that file**. Re-theme is a token swap.
- Existing structure: `AppLayout` = 220px text `Sidebar` (8 routes) + `Header` (TillStatus + Logout) + scrollable `main`. Sell is already two-pane: left item grid (`ItemCard` = text-row buttons `h-16`), right `w-[340px]` cart panel.
- `sale_items.quantity` column exists; `salesRepo.create` **hardcodes quantity=1** and ignores payload quantity (feature does not exist yet in payload typing).
- `reportsRepo` already sums `si.quantity` ("portions_sold") — no change needed for reports.
- Discounts (`DiscountModal`), debts (`DebtModal`), free add-ons (`AddOnSelector`), PIN auth, till modals all exist and stay.
- Fonts: Inter already the `--font-sans` stack.

## 3. Global Theme (`src/styles/index.css`)

Map the design tokens onto existing names. Light `:root` and dark `@media (prefers-color-scheme: dark)` blocks.

### Light
| Token | Value | Notes |
|---|---|---|
| `--background` | `#FFFBF7` | warm off-white |
| `--foreground` | `#241F3D` | dark navy text |
| `--card`, `--popover` | `#FFFFFF` | surfaces |
| `--card-foreground`, `--popover-foreground` | `#241F3D` | |
| `--secondary`, `--muted`, `--accent` | `#FAF5EF` | surface-alt |
| `--secondary-foreground`, `--accent-foreground` | `#241F3D` | |
| `--muted-foreground` | `#9B96A8` | meta text |
| `--primary` | `#F0821D` | orange: prices, CTAs, active tab |
| `--primary-foreground` | `#FFFFFF` | |
| `--destructive` | `#EF4470` | pink: remove/clear/void/close |
| `--destructive-foreground` | `#FFFFFF` | |
| `--border`, `--input` | `#F0E7DC` | |
| `--ring` | `#F0B27D` | focus |
| `--success` | `#22C55E` | free add-ons, positives |
| `--warning` | `#D97706` | till-required, debt CTA |
| `--info` | `#0EA5E9` | unchanged (info) |
| `--chart-1..5` | `#F0821D #EF4470 #22C55E #D97706 #7C3AED` | reports charts |
| `--sidebar*` | warm variants of above (surface `#FFFFFF`, active tint `#FFF0E3`) | |

Radii: `--radius-sm: 8px`, `--radius-md: 12px`, `--radius-lg: 16px`, `--radius-xl: 16px`.

### Dark (inverted warm)
`--background #17121F`, `--foreground #F7F2EC`, `--card/--popover #221C2E`, `--muted/--secondary/--accent #2C2536`, `--muted-foreground #B9B3C4`, `--primary #F5A14D`, `--destructive #FF5C85`, `--border/--input #3A3344`, `--success #34D399`, `--warning #FBBF24`, `--ring #F5A14D`.

### Typography
- No new size scale. Use Tailwind's existing `text-lg` (prices), `text-xl` (panel/tab-group titles), `text-2xl` (order total), `text-3xl` (login/pin display). No font-weight below 500 anywhere (already medium+).
- Prices: bold + orange everywhere via existing `text-primary font-bold/800`.

## 4. Shell & Navigation

### Sidebar → 72px icon rail (`src/components/Sidebar.tsx`)
- New dependency **`lucide-react`** (tree-shakable).
- Vertical rail, `w-[72px]`, `bg-card`, right border. Icon-only `NavLink` buttons, `48px` target (`h-12 w-12`), rounded pills; active = `bg-[#FFF0E3] text-primary` (use `bg-primary/10 text-primary`), inactive `text-muted-foreground hover:bg-muted hover:text-foreground`.
- `title` + `aria-label` for tooltips/labels.
- Icons: Sell `ShoppingCart`, Expenses `ReceiptText`, Debts `Wallet`, Reimbursements `ArrowLeftRight`, Inventory `Package`, Waste `Trash2`, Reports `BarChart3`, Settings `Settings`.
- **Logout moves to rail bottom** (icon button, `LogOut`, `text-destructive`).

### Header (`src/components/Header.tsx`)
- Keep height `h-14`; keeps `TillStatus` (re-skins via tokens + status dot). Remove Logout button (now in rail). Keep `onOpenTill` wiring for `TillStatus`.

### AppLayout
- Unchanged structurally. Floating "Close Till" button already templetized (`border-destructive bg-card text-destructive`) — re-skins automatically.

## 5. Sell Screen Rebuild + Cart Aggregation

### Layout
Two panes as today: left `flex-1` (tabs + grid), right fixed `w-[360px] min-w-[360px]` OrderPanel (up from the current 340px). Keeps the current top-level shell and the neutral page title **"Point of Sale"** — the doc's "Simons's BBQ Team" is sample branding, not adopted.

### CategoryTabs
- Wrap row `flex flex-wrap gap-2`, each pill `h-11 min-h-11 px-4 rounded-full` (44px), active `bg-primary text-white font-bold`, inactive `bg-card border border-border text-foreground font-semibold hover:bg-muted`.
- Remove `--radius-md` square look → pills (rounded-full).

### ItemCard (`src/components/ItemCard.tsx`)
- Convert `Button` row → `button` card: `flex flex-col gap-3 items-start rounded-[var(--radius-md)] border border-border bg-card p-4 text-left`, `min-h-[132px]`. The grid stays **inline in SellPage**: `grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]`.
- Layout: top row `flex items-start justify-between` = name (`text-base font-bold`) + **initial tile** (48px `rounded-[var(--radius-md)] flex items-center justify-center text-lg font-extrabold`; tint `bg-primary/10 text-primary` for priced, `bg-success/10 text-success` for free, `bg-muted text-muted-foreground` for out-of-stock). Bottom: price `text-lg font-extrabold text-primary` (or `text-success` "Free", or muted "Out of stock").
- Selected (pre-add-on): `border-2 border-primary` + `ring-2 ring-[var(--ring)]`. Out-of-stock: `opacity-60`, `disabled`, cursor-not-allowed.
- Still a real `<button>` with `disabled` for out-of-stock; tap = existing `onSelect` semantics (priced) — free items are add-ons, never grid-tappable (existing behavior).

### OrderPanel (`src/components/Cart.tsx`)
- Header row: `font-bold text-xl` **"Current Order"** + spacer + **"Clear All"** `text-destructive font-bold` text-button (`min-h-11`), disabled when cart empty.
- Body: `flex-1 overflow-auto` list of `OrderLine`s; empty state "Cart is empty" muted, centered.
- Footer (`border-t border-border p-4 flex flex-col gap-3`):
  - **OrderSummary**: Subtotal (`text-sm text-muted-foreground` label, `font-bold` value); if discount > 0: **"Discount (reason)"** label + `-{amount}` both `text-destructive font-bold`; divider; **Total** `text-2xl font-extrabold text-primary`.
  - Action row: `Discount` + `Debt` `h-11 flex-1` outline buttons (Debt keeps `text-warning border-warning`) + **"Complete Sale"** `h-14 flex-[2] bg-primary text-white font-bold` CTA. Buttons disabled when cart empty (as today).

### OrderLine (`src/components/CartItem.tsx`)
- Row `flex items-center gap-3 py-2 border-b border-border`:
  - Initial thumb 40px (`h-10 w-10 rounded-[var(--radius-md)] bg-primary/10 text-primary font-extrabold`, first letter).
  - Middle: name `font-bold text-sm`, meta line `text-xs text-muted-foreground` (add-on name and/or `unit` price).
  - Right cluster: **stepper** `flex items-center gap-1` = `−` `Button size-icon` (`h-11 w-11`), qty `w-7 text-center font-extrabold`, `+`; then **trash** `Trash2` icon button `h-11 w-11 text-destructive`; then line total `w-[76px] text-right font-extrabold`.
- `decrement` at qty 1 removes the line; trash removes the whole line instantly.

### Cart behavior (`src/hooks/useCart.ts`)
- `CartItemState` gains `quantity: number`.
- `addItem(item)`: if a line exists with same `itemId` **and** same `addOnId` → `quantity+1`; else append `{...quantity: 1}`.
- `increment(index)`, `decrement(index)` (removes at 0), `removeLine(index)` (rename of `removeItem`, filters by index).
- `attachAddOn(pricedItemId, pricedItemName, pricedPrice, addOnId, addOnName)`: find the priced plain line `(pricedItemId, null)`; decrement its qty by 1 (delete if 0); increment the `(pricedItemId, addOnId)` variant (create with `{quantity:1, addOnId, addOnName}` if absent). Called from SellPage's `handleAddOnSelect` (replaces `cart.setAddOn`).
- `subtotal = Σ(price × qty)`; `itemCount = Σ qty`; `total` unchanged; `clearCart`, discount state unchanged.
- `setAddOn` removed from the hook surface.

### SellPage wiring
- `handleAddOnSelect` → `cart.attachAddOn(selectedItem.id, ..., item.id, item.name)`.
- Sale payload items become `{ item_id, free_item_id, price_cents, quantity }`.
- Unchanged: category filtering, `selectedItem` add-on panel, `requestSale`/`completeSale`/`pendingSale` ConfirmDialog, DiscountModal/DebtModal, saving/success overlays.

## 6. Backend: Sale Quantity (`electron/db/repositories/salesRepo.ts`, `shared/types.ts`)

- `CreateSalePayload.items` element type adds `quantity?: number` (default 1 for backward compatibility; existing typed test payloads unaffected).
- `salesRepo.create` item type: `{ item_id, free_item_id?, price_cents, quantity?: number }`; insert uses `item.quantity ?? 1` for `quantity`, and `line_total_cents = item.price_cents * (item.quantity ?? 1)`.
- No schema migration (column exists). No other write paths affected (`salesRepo.create` is the only sale writer).

### Tests
- Add/extend db tests: create a sale with `quantity: 3` on one item → single `sale_items` row with `quantity = 3`, `line_total_cents = 3 × unit`; both cash and qty-1 default still pass.
- Existing 22 tests must stay green; `reportsRepo` "portions_sold" assertion remains valid (already sums quantity).

## 7. Out of Scope (reference features NOT built)

Cashless-credit payment, customer/loyalty/Gift-Ticket badges, promo chips, held-sale resume, numpad cash tendering, item photo/emoji storage, sync/"last synced" status, settings/help icons in the order header, app-level brand rename.

## 8. App-Wide Consistency Sweep

- Touch targets: any remaining `h-10` interactive control app-wide → `h-11` (44px). Modals already use `h-12`/`h-14` CTAs — keep.
- Tables (ExpenseList, Debts, Inventory, Waste, Reports, Reimbursements): zebra rows via `[&_tr:nth-child(even)]:bg-muted/50` (surface-alt), keep sticky headers where present.
- Recheck every page for hardcoded color classes during implementation (grep baseline: none today).
- PinPad/Login, modals, DatePicker, Select, Inputs re-skin via tokens automatically; spot-check contrast (orange primary + white `font-bold` text meets kitchen legibility).

## 9. Dependencies

- Add `lucide-react` (only new dependency).

## 10. Verification

1. `npx tsc -p tsconfig.json --noEmit` — clean.
2. `npm run test` — existing 22 pass + new sale-quantity tests pass.
3. `npm run build` — passes (Vite build + `tsc -p tsconfig.node.json`).
4. Manual spot-check via dev app: rail navigation, Sell two-pane (tabs, cards, add-on flow, steppers, discount/debt, clear all, complete sale), dark-mode toggle.

## 11. File Touch List (planned)

- `src/styles/index.css` (tokens, radii, dark)
- `src/components/Sidebar.tsx` (icon rail + logout)
- `src/components/Header.tsx` (remove logout; keep TillStatus)
- `src/pages/Sell/SellPage.tsx` (tabs pills, grid, add-on wiring, payload qty)
- `src/components/ItemCard.tsx` (card + tile)
- `src/components/Cart.tsx` (OrderPanel) & `src/components/CartItem.tsx` (OrderLine + steppers)
- `src/hooks/useCart.ts` (aggregation)
- `src/components/AddOnSelector.tsx`, `DiscountModal.tsx`, `DebtModal.tsx` (token/radius touch-ups)
- `shared/types.ts` (quantity on payload), `electron/db/repositories/salesRepo.ts` (insert qty)
- Electron db tests (+ new qty case); `package.json` (`lucide-react`)
- Sweep pass over remaining pages ($8), touch sizes, zebra rows