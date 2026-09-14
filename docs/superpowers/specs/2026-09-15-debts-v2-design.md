# Design — Debts / Credit v2

Date: 2026-09-15
Status: Approved

## Overview

Feature-depth release for the Debts (accounts receivable) module. v2 adds, on
top of the existing per-sale `debt_cents` model already live in the app:

1. **FR-12a — Mixed / partial payment at checkout** — cash tendered at the till
   plus a carried debt remainder on the same sale (`payment_method='mixed'`).
2. **FR-12b — Repeat-credit warning** — surface a returning debtor's total owed
   before extending new credit.
3. **FR-12c — Overpayment guard** — a debt payment can never exceed the open
   balance; enforced at the repo level (not only clamped in the UI).
4. **FR-12d — Aging indicators** — every open debt shows days since sale and
   days since last payment, color-coded (fresh → warn → overdue), sortable.
5. **FR-12e — Per-customer balance view** — Debts screen aggregates open debts
   by customer (implementing FR-8/FR-10), plus a customer detail page (FR-11)
   with open orders and payment history.
6. **Pay-on-account** — one payment covering a customer's combined balance
   across multiple open sales, applied oldest-first.

## Decisions (confirmed with owner)

| Question | Decision |
|---|---|
| Direction | Feature depth on debts/credit ("done properly", not new modules) |
| Data model | **Evolve** the current per-sale `debt_cents` model; **no schema migration needed**; all balances stay *derived* from `sales` + append-only `payment_allocations` |
| Customer key | Key debts by `sales.customer_name` (the denormalized column the debts flow actually writes today) — **not** `customers.id`. The `customers`/`payments` tables from migration 001 were never wired up; `salesRepo` writes debt sales via `customer_name` and `debtsRepo.listOpen` reads it. All v2 aggregation pays off this column. |
| Payment architecture | Zero new tables. `payment_allocations` is already headerless (`payment_id` dropped in migration 014). Extend `debtsRepo`; add one new repo function `payOnAccount`. |
| Aging | Computed **at read time** from `sales.created_at` (device clock): `<7d` fresh, `7–30d` warn, `>30d` overdue. Last-payment date shown for context. Nothing stored. |
| Receivables report | Fix `reports:debtSummary` to subtract `payment_allocations` (it currently lists raw `debt_cents`, disagreeing with the Debts page). Consistency fix, not a refactor. |
| `customers:*` / `payments:*` stubs | The dead typed channels (`customers:create/list/get`, `payments:create/list`, stubbed in `main.ts`) are **removed** from the `Api` type, preload, and main. Their intended functionality is superseded by the new `debts:*` commands keyed by name. |

## Data Model — derived, no migration

Live schema state (verified against migrations 001–014):

```sql
-- sales: payment_method IN ('cash','debt','mixed'), debt_cents INT DEFAULT 0,
--        customer_name TEXT, status IN ('completed','unpaid','voided','refunded'),
--        payment_source IN ('cash','unpaid')
-- payment_allocations: sale_id, amount_cents, payment_method, till_session_id,
--        created_by, created_at   (NO payment_id column — headerless, append-only)
```

All derived fields are computed in SQL at query time:

- `paid_cents        = COALESCE(SUM(pa.amount_cents), 0)` per sale
- `remaining_cents   = debt_cents − paid_cents` (open debt ⟺ `remaining_cents > 0`)
- `days_open         = CAST(julianday('now') - julianday(s.created_at) AS INTEGER)`
- `last_payment_at   = MAX(pa.created_at)`
- Open debt filter: `s.status = 'unpaid'` AND `s.debt_cents > 0` AND
  `remaining_cents > 0`. Voided/refunded sales are excluded by the status
  filter; anonymous sales (`customer_name IS NULL`) are excluded from the
  per-customer aggregation.

## Backend

### `electron/db/repositories/debtsRepo.ts`

| Function | Behavior |
|---|---|
| `listOpen()` | Existing query + `remaining_cents`, `days_open`, `last_payment_at`. Order `created_at DESC`. Returns typed `OpenDebt[]`. |
| `customerBalances()` | One row per `customer_name` with open debt: `total_owed_cents`, `total_paid_cents`, `unpaid_orders`, `oldest_open_date`, `newest_open_date`, `last_payment_at`. Same open-debt filter, `NULLIF(customer_name,'') IS NOT NULL`, `GROUP BY customer_name`. |
| `balanceByName(name)` | Total remaining for a customer across open sales; `0` if unknown or no open debt. Used by the checkout warning (FR-12b). |
| `customerDetail(name)` | `total_owed_cents` + `open_debts: OpenDebt[]` + `payments: PaymentHistoryEntry[]` (allocation history DESC joined with sale metadata). Used by the customer detail page (FR-11). |
| `recordPayment(...)` | Now **guarded + transactional**: throw if `amount <= 0` or `amount > remaining` (FR-12c). Inserts allocation, flips sale to `'completed'` iff remaining hits exactly 0 (otherwise stays `'unpaid'`). Returns `{ remaining_cents, sale_status }`. |
| `payOnAccount(payload)` | Transaction: load the customer's open sales **oldest-first** (`created_at ASC, id ASC`), distribute `amount_cents` across them, each allocation capped at that sale's remaining. Throw with **full rollback** if `amount <= 0` or `amount > total outstanding` — no partial application on error. Insert one allocation per touched sale; flip each sale to `'completed'` exactly when settled. Returns `{ total_applied_cents, allocations, settled_sale_ids }`. |

Shared private helpers: `applyAllocation` (validates remaining, inserts,
flips status) and `settleIfPaid(sale_id)` — reused by both `recordPayment` and
`payOnAccount`.

### `electron/db/repositories/reportsRepo.ts`

- `getDebtSummary()`: subtract `SUM(pa.amount_cents)` from each sale's
  `debt_cents`, keep only `remaining > 0`, add `paid_cents`/`days_open` to the
  returned rows so the Receivables tab agrees with the Debts page.
- `getTillSummary` / `getDaily` need **no change** — the till already computes
  cash from a mixed sale as `total − debt_cents` (verified).

### No schema migration

The `payments` / `customers` tables stay untouched (documented dead/deprecated).

## IPC Contract

`shared/types.ts` `Api` + `electron/preload.ts` + hands in `main.ts`:

**Removed** (dead stubs): `customers:create`, `customers:list`, `customers:get`,
`payments:create`, `payments:list` (main.ts lines 77–81).

**Added / retyped**:

```
debts:listOpen          ()                          → Promise<OpenDebt[]>
debts:recordPayment     (payload)                   → Promise<{ remaining_cents, sale_status }>
debts:customerBalances  ()                          → Promise<CustomerBalance[]>
debts:customerDetail    (customer_name)             → Promise<CustomerDetail>
debts:balanceByName     (customer_name)             → Promise<number>
debts:payOnAccount      (payload)                   → Promise<PayOnAccountResult>
```

New types:

```ts
interface OpenDebt {
  sale_id: number
  customer_name: string | null
  debt_cents: number
  total_cents: number
  paid_cents: number
  remaining_cents: number
  created_at: string
  days_open: number
  last_payment_at: string | null
}

interface CustomerBalance {
  customer_name: string
  total_owed_cents: number
  total_paid_cents: number
  unpaid_orders: number
  oldest_open_date: string
  newest_open_date: string
  last_payment_at: string | null
}

interface PaymentHistoryEntry {
  id: number
  sale_id: number
  amount_cents: number
  payment_method: string
  till_session_id: number | null
  created_by: number | null
  created_at: string
  sale_total_cents: number
  sale_created_at: string
}

interface CustomerDetail {
  customer_name: string
  total_owed_cents: number
  open_debts: OpenDebt[]
  payments: PaymentHistoryEntry[]
}

interface PayOnAccountPayload {
  customer_name: string
  amount_cents: number
  till_session_id: number | null
  created_by: number
  payment_method?: string   // default 'cash'
}

interface PayOnAccountResult {
  total_applied_cents: number
  allocations: { sale_id: number; amount_cents: number }[]
  settled_sale_ids: number[]
}
```

`debts:recordPayment` payload keeps its current shape;
`payment_method` still defaults to `'cash'`.

### `electron/ipc/debtsHandlers.ts`

Wire the new commands. `main.ts` only removes the `customers:*`/`payments:*`
stub lines.

## Frontend

### Shared components (new)

- `src/components/DebtAgingBadge.tsx` — props `days_open` (+ optional
  `last_payment_at` for tooltip). `<7` → success "X d", `7–30` → warning,
  `>30` → danger "Overdue · X d". Drives FR-12d.
- `src/components/BalanceWarning.tsx` — inline warning line: "Already owes
  UGX X". Shown only when `debts:balanceByName(name)` returns > 0 (FR-12b).

### Checkout — `DebtModal` → partial payment (FR-12a / FR-12b)

- Renamed concept to **Debt / Partial payment**. Fields: customer name +
  **"Paid now (UGX)"** (NumPad-style entry; default 0; "Pay in full" shortcut
  sets paid now = total).
- Live computed **"To carry forward"** = `total − paidNow`; `paidNow` clamped
  to `≤ total` (tendering above total is a cash overpayment — out of scope).
- On blur of the customer name, call `debts:balanceByName` and render
  `BalanceWarning` when nonzero. Warning is shown, never blocking (manager
  decision).
- On confirm, the sale is created with `debt_cents = total − paidNow` and:
  - `paidNow ≥ total` → `payment_method: 'cash'` (full payment, normal sale)
  - `paidNow > 0` → `payment_method: 'mixed'` (cash portion lands in till)
  - `paidNow = 0` → `payment_method: 'debt'` (unchanged behaviour)
- `salesRepo.create` already stores `debt_cents`, `customer_name`, and picks
  `status = 'unpaid'` for mixed/debt — no repo change needed for checkout.

### Debts screen — `src/pages/Debts/DebtsPage.tsx` (per-customer view, FR-12e)

- Replace the flat per-sale table with a **per-customer summary**: columns
  name, total owed, unpaid orders, oldest open date, `DebtAgingBadge` (from
  oldest open sale), last payment date.
- Row actions: **Pay** (opens pay-on-account dialog) and **View** → route
  `/debts/:customerName`. Sorting by balance/age where the underlying type
  allows (FR-12d).
- Header keeps the running "Total Owed" summary card.

### Customer detail — `src/pages/Debts/DebtDetailPage.tsx` (route `/debts/:customerName`)

- Header: customer name, total owed, back link to `/debts`.
- **Open orders** table: date, total, remaining, `DebtAgingBadge` (days + last
  payment), per-sale **Record payment** (existing flow, now guarded).
- **Payment history** list: date, amount, which sale it settled, by whom.
- **Pay balance** action (pay-on-account dialog) with total outstanding shown.
- Encoded route param via `encodeURIComponent(customer_name)`;
  unknown name → empty state.

### Pay-on-account dialog (shared between Debts page + detail page)

- Shows customer + total outstanding; amount input (default = outstanding);
  confirm → `debts:payOnAccount`. Errors (e.g. overpayment) surface as a toast.
- Reuses the existing modal/toast components.

### Hooks & wiring

- `src/hooks/useDebts.ts` — add `customerBalances`, `payOnAccount`,
  `customerDetail`, `balanceByName`; keep `listOpen`, `recordPayment`,
  `getTotalOwed`, `history`.
- `src/App.tsx` — add `<Route path="/debts/:customerName">` inside the Debts
  route tree; `src/pages/Debts/index.tsx` exports both pages.

## Edge Cases & Error Handling

- **Overpayment** (single-sale record or on-account total) → typed error,
  transaction rollback, zero partial application (FR-12c).
- **Zero/negative amount** → rejected by guard.
- **Deposit while a till session is closed** → existing till guard already
  blocks sale creation; pay-on-account/record-payment keep passing
  `till_session_id` as today.
- **Mixed sale for a customer who already owes** → allowed; repeat-credit
  warning shown, never blocking.
- **Anonymous debt sales** (`customer_name` null) — excluded from customer
  aggregation; still visible via `debts:listOpen` raw list (kept for
  compatibility/tests).
- **Aging clock**: uses device time via `julianday('now')`; documented, no
  timezone handling (single device assumption).
- **Name case/whitespace**: aggregation groups by the exact stored
  `customer_name` string. The checkout modal trims input on submit.

## Out of Scope

- Multi-payment-type selection beyond cash at checkout (MPesa/card).
- Void/refund of `payment_allocations` (recorded as-is for audit).
- Customer balance limits or credit approvals.
- Statements/invoices/receipt printing for debts.
- Laying over a sale (split a single sale across two or more pickup events).
- Reviving the `customers`/`payments` tables (documented deprecated dead
  schema for a future clean-model v3).

## Testing & Verification

Tests in `electron/db/__tests__/debts.test.ts` (extend the existing file) and a
focused `reports` test fixture:

- `listOpen` returns typed rows incl. `days_open`, `last_payment_at`,
  `remaining_cents`; excluded rows (settled/voided/null-name) stay excluded.
- `recordPayment`: guard throws on `amount > remaining` and `amount <= 0`;
  exact-remaining flips status to `completed`; partial keeps `unpaid`; returns
  correct `{ remaining_cents, sale_status }`.
- `payOnAccount`: oldest-first distribution across N sales; each allocation
  capped at per-sale remaining; `settled_sale_ids` only for fully paid;
  overpayment throws and **rolls back** (zero allocation rows, no status
  change); complete-settle clears the customer (no longer in
  `customerBalances`).
- `customerBalances` / `customerDetail` / `balanceByName`: per-customer math,
  count, oldest/newest/last-payment, unknown name → `0`/empty.
- `reports:debtSummary` respects allocations (partial payment reduces the
  outstanding shown); `getTillSummary` counts mixed-sale cash correctly.
- Mixed checkout integration: `salesRepo.create` with `payment_method='mixed'`
  + `debt_cents < total` → `status='unpaid'`, till cash = `total − debt`.

Verification commands: `npm run test` (vitest), `npx tsc --noEmit`,
`npm run build`.