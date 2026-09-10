# Design — BusinessPOS

Optimized for a **touch-first restaurant POS**: high contrast, large tap targets, fast scanning under time pressure, and clear separation between "money in" (sales) and "money out" (expenses) actions. Centered on **cash reconciliation** and **full P&L visibility**.

---

## 1. Design System

### 1.1 Design Principles
1. **Thumb-friendly, glanceable** — big buttons, minimal text, color-coded state.
2. **Speed over elegance** — every extra tap during service has a cost; optimize the sale flow above all else.
3. **Unambiguous money actions** — sales (green/positive) and expenses (red/negative) are never visually confusable.
4. **Legible in a busy kitchen** — high contrast, no thin/light font weights, no low-contrast gray-on-gray.
5. **Financial clarity** — every screen answers: "How much money do we have, and where did it go?"

### 1.2 Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-bg` | `#0F172A` (dark) / `#F8FAFC` (light) | App background |
| `--color-surface` | `#1E293B` / `#FFFFFF` | Cards, panels |
| `--color-surface-alt` | `#334155` / `#F1F5F9` | Secondary panels, list rows |
| `--color-border` | `#334155` / `#E2E8F0` | Dividers, input borders |
| `--color-text-primary` | `#F8FAFC` / `#0F172A` | Primary text |
| `--color-text-secondary` | `#94A3B8` / `#64748B` | Secondary/meta text |
| `--color-primary` | `#2563EB` | Primary actions (Charge, Save, Confirm) |
| `--color-primary-hover` | `#1D4ED8` | Primary hover/active |
| `--color-success` | `#16A34A` | Sales / income indicators, "Paid" state |
| `--color-danger` | `#DC2626` | Expenses / outgoing indicators, void/delete |
| `--color-warning` | `#D97706` | Held sales, low stock, variance warnings, debt alerts |
| `--color-info` | `#0EA5E9` | Informational, personal expenses, reimbursements |
| `--color-focus-ring` | `#60A5FA` | Keyboard/touch focus outline |

Two themes (dark default for low-light kitchens, light optional) share the same token names so components never hardcode colors.

### 1.3 Typography

- Font: **Inter** (system fallback: `-apple-system, Segoe UI, Roboto, sans-serif`) — clean, highly legible at small and large sizes.
- Scale (rem, base 16px):

| Token | Size | Weight | Usage |
|---|---|---|---|
| `text-xs` | 0.75rem | 500 | Meta labels, timestamps |
| `text-sm` | 0.875rem | 500 | Secondary text, table cells |
| `text-base` | 1rem | 500 | Body, inputs |
| `text-lg` | 1.25rem | 600 | Section headers, item names |
| `text-xl` | 1.5rem | 700 | Screen titles |
| `text-2xl` | 2rem | 700 | Cart/total amounts |
| `text-3xl` | 2.75rem | 800 | Numpad display, grand total |

No text weight below 500 is used — thin fonts read poorly on kiosk displays.

### 1.4 Spacing & Sizing

- Base unit: `4px`. Scale: 4, 8, 12, 16, 24, 32, 48, 64.
- **Minimum touch target: 48×48px** (exceeds WCAG's 44px minimum, for kitchen/glove/wet-hand use).
- Standard button height: 56px (primary actions), 48px (secondary).
- Grid gutter for item tiles: 12px.
- Border radius: `--radius-sm: 6px`, `--radius-md: 10px`, `--radius-lg: 16px` (cards/modals).

### 1.5 Core Components

- **ItemTile** — large tappable card (menu item): name, price, category color accent, out-of-stock overlay state.
- **CartLine** — row with item name, qty stepper (− / +), unit price, discount amount, line total, remove icon.
- **NumPad** — large on-screen numeric keypad for cash tendered / manual amount entry (no physical keyboard dependency).
- **PrimaryButton / SecondaryButton / DangerButton** — consistent 56px/48px height, full-width in modals, icon+label.
- **SummaryCard** — used on Dashboard/Reports: label, big number, delta/trend, colored accent (green for sales, red for expenses).
- **StatusBadge** — Paid / Unpaid / Voided / Refunded, color-coded (success/warning/danger/neutral).
- **PinPad** — for role login and manager-authorization prompts (void, delete, close till).
- **DataTable** — for transaction history: sticky header, zebra striping (`--color-surface-alt`), filter bar above.
- **Modal / Drawer** — used for item details, expense entry, till close reconciliation, debt payment.
- **Toast** — transient confirmation ("Sale saved", "Backup complete").

### 1.6 Iconography
Use a single consistent icon set (e.g., **Lucide**, MIT-licensed, tree-shakable) — outline style, 24px default, stroke width 2. Icons never appear without a text label in primary navigation (accessibility + speed of recognition).

### 1.7 Layout Pattern

Persistent left **sidebar** (icon + label nav): Sell, Debts, Expenses, Reports, Till, Menu, Food Cost, Settings. Main content area uses a **two-pane pattern on the Sell screen**: left = item grid/categories, right = fixed cart panel (always visible, never a separate step) so the running total is always in view.

---

## 2. Application Architecture

### 2.1 Process Model (Electron)

```
┌─────────────────────────────┐        IPC (contextBridge)       ┌──────────────────────────────┐
│      Renderer Process        │ <───────────────────────────────> │        Main Process           │
│  React + React Router (UI)   │                                    │  Node.js — owns all I/O       │
│  - No direct FS/DB access    │                                    │  - better-sqlite3 (DB)        │
│  - Calls window.api.*        │                                    │  - File system (backups)      │
│                              │                                    │  - Printer (native/HTML→PDF)  │
└─────────────────────────────┘                                    └──────────────────────────────┘
```

- `contextIsolation: true`, `nodeIntegration: false`. Preload script exposes a narrow, typed `window.api` surface via `contextBridge`.
- All SQLite access happens in the **main process** only. Renderer sends IPC requests (`api.sales.create(payload)`), main handles DB write, returns result.
- Rationale: keeps renderer sandboxed (security), and centralizes transactional integrity in one place.

### 2.2 Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Shell | Electron (latest stable) | Packaged with Electron Builder |
| UI | React 18 | Function components + hooks |
| Routing | React Router (v6+, HashRouter) | HashRouter avoids file:// path issues in packaged Electron builds |
| State | React Context + `useReducer` for cart; TanStack Query for server-like data from main process | Keeps cart logic local/fast, DB-backed data cached & revalidated |
| DB | SQLite via `better-sqlite3` | Synchronous, fast, ideal for local single-writer use in main process |
| Styling | CSS variables (tokens above) + CSS Modules or Tailwind | Either works; Tailwind speeds dev, CSS vars keep theming clean |
| Build | Vite (renderer) + Electron Builder (packaging) | Fast dev loop |

### 2.3 Routing Map (React Router)

```
/                    → redirect to /sell (or /login if PIN required)
/login               → PinPad role login
/sell                → Sell screen (item grid + cart) — default/home screen
/debts               → Customer debts list (outstanding balances)
/debts/:customerId   → Customer detail (order history, record payment)
/expenses            → Expense list + "Add expense" entry
/expenses/new        → Add/edit expense form
/reports             → Daily P&L summary + charts
/reports/weekly      → Weekly P&L comparison
/reports/monthly     → Monthly P&L comparison
/reports/history     → Transaction history table (filterable)
/history/:id         → Transaction detail view
/till                → Open/close till, cash count reconciliation
/menu                → Menu items & protein/starch management
/menu/:id            → Edit item
/food-cost           → Daily food cost tracker (purchases, cook events, waste)
/settings            → Currency, tax, PIN, backup/export
```

Route guards: a lightweight `RequireRole` wrapper redirects to `/login` or shows a PIN prompt modal for manager-only actions (void, delete, close till, settings) without necessarily leaving the current route.

### 2.4 Data Model (SQLite Schema)

```sql
-- Users/roles (simple, PIN-based)
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('cashier','manager')),
  pin_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

-- Customers (for debt tracking)
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Menu: proteins (priced items) and starches (free accompaniments)
CREATE TABLE proteins (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  selling_price_cents INTEGER NOT NULL,
  cost_price_cents INTEGER NOT NULL,
  category TEXT NOT NULL,          -- e.g., 'Goat', 'Chicken', 'Fish'
  active INTEGER NOT NULL DEFAULT 1,
  out_of_stock INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE starches (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

-- Till sessions
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

-- Sales (header)
CREATE TABLE sales (
  id INTEGER PRIMARY KEY,
  till_session_id INTEGER REFERENCES till_sessions(id),
  created_at TEXT NOT NULL,
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

-- Sale line items (one protein per line, with starch choice)
CREATE TABLE sale_items (
  id INTEGER PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  protein_id INTEGER REFERENCES proteins(id),
  name_snapshot TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  line_total_cents INTEGER NOT NULL
);

-- Customer debt payments
CREATE TABLE payments (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  amount_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  note TEXT
);

-- Link payments to specific sales (supports partial payment across multiple sales)
CREATE TABLE payment_allocations (
  id INTEGER PRIMARY KEY,
  payment_id INTEGER NOT NULL REFERENCES payments(id),
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  amount_cents INTEGER NOT NULL
);

-- Expenses
CREATE TABLE expenses (
  id INTEGER PRIMARY KEY,
  till_session_id INTEGER REFERENCES till_sessions(id),
  created_at TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  amount_cents INTEGER NOT NULL,
  payment_source TEXT NOT NULL DEFAULT 'till' CHECK(payment_source IN ('till','personal')),
  reference TEXT,
  created_by INTEGER REFERENCES users(id),
  deleted_at TEXT,
  deleted_by INTEGER REFERENCES users(id)
);

-- Owner reimbursements (personal → till transfers)
CREATE TABLE reimbursements (
  id INTEGER PRIMARY KEY,
  amount_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id),
  note TEXT
);

-- Daily protein purchases
CREATE TABLE protein_purchases (
  id INTEGER PRIMARY KEY,
  protein_id INTEGER NOT NULL REFERENCES proteins(id),
  purchase_date TEXT NOT NULL,
  quantity_kg REAL NOT NULL,
  cost_cents INTEGER NOT NULL,
  expected_yield INTEGER NOT NULL,  -- expected servings from this purchase
  created_by INTEGER REFERENCES users(id)
);

-- Daily cook events (how many portions cooked today)
CREATE TABLE cook_events (
  id INTEGER PRIMARY KEY,
  protein_id INTEGER NOT NULL REFERENCES proteins(id),
  cook_date TEXT NOT NULL,
  portions_cooked INTEGER NOT NULL,
  created_by INTEGER REFERENCES users(id)
);

-- App settings (key-value)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

Design notes:
- All monetary values as **integer cents/shillings** (NFR-7).
- `sale_items` snapshots name/price so historical receipts remain accurate even if the menu changes later.
- No hard deletes on `sales`/`expenses` — status/soft-delete columns preserve audit trail (NFR-8).
- SQLite opened in **WAL mode** (`PRAGMA journal_mode=WAL;`) for crash resilience and read/write concurrency between main-process operations.
- `customers` table is lightweight — just name (and optional phone) for debt tracking.
- `payments` + `payment_allocations` support partial payments and payment across multiple sales.
- `protein_purchases` + `cook_events` enable waste calculation: cooked − sold = waste.

### 2.5 IPC Contract (illustrative)

```
-- Sales
sales:create(payload) → { id, total_cents, ... }
sales:void(id, reason, managerPin)
sales:list(filters)   → Sale[]
sales:get(id)         → SaleWithItems

-- Customer Debts
customers:create(name) → Customer
customers:list()       → Customer[]
customers:get(id)      → CustomerWithBalance
payments:create(customerId, amount, allocations) → Payment
payments:list(customerId) → Payment[]

-- Expenses
expenses:create(payload)
expenses:update(id, payload)
expenses:delete(id, managerPin)
expenses:list(filters)

-- Reimbursements
reimbursements:create(amount, note) → Reimbursement
reimbursements:balance() → { owed_to_owner_cents }

-- Till
till:open(floatCents, userId)
till:close(countedCents, userId) → { expected, variance }
till:current() → TillSession | null

-- Food Cost
foodCost:purchases:list(date) → ProteinPurchase[]
foodCost:purchases:create(payload)
foodCost:cookEvents:list(date) → CookEvent[]
foodCost:cookEvents:create(payload)
foodCost:summary(date) → { proteins: [{ name, purchased, cooked, sold, waste, cost, revenue, margin }] }

-- Reports
reports:daily(date) → P&L { sales, expenses_till, expenses_personal, net, reimbursement_balance, waste, discounts }
reports:weekly(date) → WeeklyP&L
reports:monthly(date) → MonthlyP&L
reports:exportCsv(range) → filePath

-- Menu
proteins:list() / proteins:upsert() / proteins:setOutOfStock()
starches:list() / starches:upsert()

-- Settings & Auth
settings:get() / settings:update(partial)
backup:create() / backup:restore(filePath)
auth:login(pin) → { userId, role }
```

Each handler wraps writes in a SQLite transaction; failures return a typed error the renderer surfaces as a toast.

### 2.6 Folder Structure

```
/electron
  main.ts             # app lifecycle, window creation
  preload.ts          # contextBridge exposing window.api
  db/
    index.ts          # better-sqlite3 connection, migrations runner
    migrations/
    repositories/
      salesRepo.ts
      customersRepo.ts
      paymentsRepo.ts
      expensesRepo.ts
      reimbursementsRepo.ts
      tillRepo.ts
      proteinsRepo.ts
      starchesRepo.ts
      foodCostRepo.ts
      settingsRepo.ts
      usersRepo.ts
  ipc/
    salesHandlers.ts
    customersHandlers.ts
    expensesHandlers.ts
    reimbursementsHandlers.ts
    tillHandlers.ts
    foodCostHandlers.ts
    ...
/src (renderer)
  main.tsx
  router.tsx
  pages/
    Sell/
    Debts/
    Expenses/
    Reports/
    Till/
    Menu/
    FoodCost/
    Settings/
    Login/
  components/         # ItemTile, CartLine, NumPad, PinPad, DataTable, ...
  context/             # CartContext, AuthContext, TillContext
  hooks/               # useSales, useExpenses, useTill, useCustomers, useFoodCost, useSettings
  styles/
    tokens.css         # design tokens from §1
    global.css
/shared
  types.ts             # shared TS types between main & renderer (IPC payloads)
```

### 2.7 Backup Strategy
- On app close and on a daily timer: copy the SQLite file (WAL-checkpointed) to `userData/backups/pos-YYYY-MM-DD.sqlite`.
- Keep a rolling window (e.g., last 30 daily backups) to bound disk usage.
- Manual "Export" in Settings zips the current DB + a JSON manifest for portability to a new machine.
