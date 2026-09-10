# BusinessPOS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline-first restaurant POS with sales, customer debts, food cost/waste tracking, and full P&L reporting.

**Architecture:** Electron app with React renderer (Vite) and SQLite backend (better-sqlite3). Main process owns all I/O; renderer communicates via typed IPC contract through contextBridge. Single-device, single-database, cash-only.

**Tech Stack:** Electron, React 18, TypeScript, Vite, React Router v6 (HashRouter), better-sqlite3, TanStack Query, CSS Modules + Tailwind, Vitest

**Spec:** `requirements.md`, `design.md`

## Global Constraints

- Windows primary target, macOS/Linux nice-to-have
- `contextIsolation: true`, `nodeIntegration: false` — renderer never touches filesystem/DB directly
- All monetary values as integer shillings (UGX) — no floating point
- SQLite WAL mode + foreign keys enabled on connection
- No hard deletes on financial records — soft-delete/void with timestamps
- Minimum touch target: 48×48px
- No text weight below 500

---

## File Structure

```
/electron/
  main.ts                    # App lifecycle, window creation, IPC registration
  preload.ts                 # contextBridge exposing window.api.*
  db/
    index.ts                 # better-sqlite3 connection, WAL mode, migrations runner
    migrations/
      001_initial.ts         # All tables from design.md §2.4
    repositories/
      usersRepo.ts           # PIN auth, user CRUD
      customersRepo.ts       # Customer CRUD, balance queries
      proteinsRepo.ts        # Protein CRUD, out-of-stock
      starchesRepo.ts        # Starch CRUD
      salesRepo.ts           # Sales + sale_items CRUD, status transitions
      paymentsRepo.ts        # Debt payments + allocations
      expensesRepo.ts        # Expenses with payment_source
      reimbursementsRepo.ts  # Owner reimbursements
      tillRepo.ts            # Till sessions, open/close, reconciliation
      foodCostRepo.ts        # Purchases, cook events, waste calculation
      settingsRepo.ts        # Key-value settings
  ipc/
    salesHandlers.ts         # sales:create, sales:void, sales:list, sales:get
    customersHandlers.ts     # customers:create, customers:list, customers:get
    paymentsHandlers.ts      # payments:create, payments:list
    expensesHandlers.ts      # expenses:create, expenses:update, expenses:delete, expenses:list
    reimbursementsHandlers.ts # reimbursements:create, reimbursements:balance
    tillHandlers.ts          # till:open, till:close, till:current
    foodCostHandlers.ts      # foodCost:purchases, foodCost:cookEvents, foodCost:summary
    reportsHandlers.ts       # reports:daily, reports:weekly, reports:monthly, reports:exportCsv
    menuHandlers.ts          # proteins:list, proteins:upsert, starches:list, starches:upsert
    settingsHandlers.ts      # settings:get, settings:update, backup:create, backup:restore
    authHandlers.ts          # auth:login

/src/
  main.tsx                   # React entry point
  router.tsx                 # Route definitions
  pages/
    Login/PinPadPage.tsx     # PIN entry screen
    Sell/SellPage.tsx        # Two-pane: protein grid + cart
    Sell/StarchPicker.tsx    # Starch selection modal after adding protein
    Debts/DebtsPage.tsx      # Customer debts list
    Debts/CustomerDetail.tsx # Customer order history + payment recording
    Expenses/ExpensesPage.tsx    # Expense list + add button
    Expenses/ExpenseForm.tsx     # Add/edit expense form
    Reports/ReportsPage.tsx      # Daily P&L summary
    Reports/WeeklyPage.tsx       # Weekly P&L comparison
    Reports/MonthlyPage.tsx      # Monthly P&L comparison
    Reports/HistoryPage.tsx      # Transaction history table
    Reports/TransactionDetail.tsx # Transaction detail drawer
    Till/TillPage.tsx            # Open/close till
    Menu/MenuPage.tsx            # Proteins & starches management
    FoodCost/FoodCostPage.tsx    # Daily food cost tracker
    Settings/SettingsPage.tsx    # Currency, tax, PIN, backup
  components/
    PinPad.tsx               # Numeric PIN entry
    ItemTile.tsx             # Tappable protein card
    CartLine.tsx             # Cart row with qty, discount, total
    NumPad.tsx               # Large on-screen numeric keypad
    PrimaryButton.tsx        # Styled button variants
    SummaryCard.tsx          # Dashboard metric card
    StatusBadge.tsx          # Status indicator (Paid/Unpaid/Voided)
    DataTable.tsx            # Filterable table with sticky header
    Modal.tsx                # Reusable modal/drawer
    Toast.tsx                # Transient notification
    Sidebar.tsx              # Left navigation
  context/
    AuthContext.tsx           # Current user, login/logout
    CartContext.tsx           # Cart state (useReducer)
    TillContext.tsx           # Current till session
  hooks/
    useSales.ts              # TanStack Query hooks for sales
    useCustomers.ts          # TanStack Query hooks for customers
    useExpenses.ts           # TanStack Query hooks for expenses
    useTill.ts               # TanStack Query hooks for till
    useFoodCost.ts           # TanStack Query hooks for food cost
    useReports.ts            # TanStack Query hooks for reports
    useSettings.ts           # TanStack Query hooks for settings
  styles/
    tokens.css               # CSS custom properties from design.md §1.2-1.4
    global.css               # Reset, base styles, theme variables
    Tailwind config mapped to tokens

/shared/
  types.ts                   # All shared TypeScript types
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `electron-builder.yml`
- Create: `electron/main.ts`, `electron/preload.ts`
- Create: `src/main.tsx`, `src/App.tsx`, `src/router.tsx`
- Create: `src/styles/tokens.css`, `src/styles/global.css`

**Interfaces:**
- Produces: runnable Electron app with React renderer, dev server, hot reload

- [ ] **Step 1: Initialize npm project**

```bash
npm init -y
npm install electron react react-dom react-router-dom
npm install -D typescript vite @vitejs/plugin-react electron-builder concurrently wait-on
```

- [ ] **Step 2: Create TypeScript configs**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"], "@shared/*": ["shared/*"] }
  },
  "include": ["src/**/*", "shared/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist-electron"
  },
  "include": ["electron/**/*", "shared/**/*"]
}
```

- [ ] **Step 3: Create Vite config**

`vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
```

- [ ] **Step 4: Create Electron main process**

`electron/main.ts`:
```typescript
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
```

- [ ] **Step 5: Create preload script**

`electron/preload.ts`:
```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Placeholder — will be filled in Task 3
  ping: () => ipcRenderer.invoke('ping'),
})
```

- [ ] **Step 6: Create React entry and router**

`src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './styles/tokens.css'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
```

`src/App.tsx`:
```tsx
import { Routes, Route, Navigate } from 'react-router-dom'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/sell" replace />} />
      <Route path="/sell" element={<div>Sell Screen (TODO)</div>} />
    </Routes>
  )
}
```

- [ ] **Step 7: Create CSS tokens and global styles**

`src/styles/tokens.css`:
```css
:root {
  --color-bg: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-surface-alt: #F1F5F9;
  --color-border: #E2E8F0;
  --color-text-primary: #0F172A;
  --color-text-secondary: #64748B;
  --color-primary: #2563EB;
  --color-primary-hover: #1D4ED8;
  --color-success: #16A34A;
  --color-danger: #DC2626;
  --color-warning: #D97706;
  --color-info: #0EA5E9;
  --color-focus-ring: #60A5FA;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0F172A;
    --color-surface: #1E293B;
    --color-surface-alt: #334155;
    --color-border: #334155;
    --color-text-primary: #F8FAFC;
    --color-text-secondary: #94A3B8;
  }
}
```

`src/styles/global.css`:
```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: Inter, -apple-system, Segoe UI, Roboto, sans-serif;
  font-weight: 500;
  background: var(--color-bg);
  color: var(--color-text-primary);
  line-height: 1.5;
}
button { cursor: pointer; font: inherit; }
input { font: inherit; }
```

- [ ] **Step 8: Add package.json scripts**

```json
{
  "scripts": {
    "dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
    "build": "vite build && tsc -p tsconfig.node.json",
    "package": "npm run build && electron-builder"
  },
  "main": "dist-electron/main.js"
}
```

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: scaffold Electron + Vite + React project"
```

---

## Task 2: Database Foundation

**Files:**
- Create: `electron/db/index.ts`, `electron/db/migrations/001_initial.ts`
- Create: `electron/db/repositories/usersRepo.ts` (minimal — just init)
- Create: `shared/types.ts` (minimal — just DB types)

**Interfaces:**
- Produces: `getDb()` returns initialized SQLite connection with WAL + FK enabled, all tables created

- [ ] **Step 1: Install better-sqlite3**

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

- [ ] **Step 2: Create database connection**

`electron/db/index.ts`:
```typescript
import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import { runMigrations } from './migrations/001_initial'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'businesspos.sqlite')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
  }
  return db
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}
```

- [ ] **Step 3: Create initial migration**

`electron/db/migrations/001_initial.ts`:
```typescript
import Database from 'better-sqlite3'

export function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))

  if (!appliedVersions.has(1)) {
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('cashier','manager')),
        pin_hash TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE customers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        phone TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE proteins (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        selling_price_cents INTEGER NOT NULL,
        cost_price_cents INTEGER NOT NULL,
        category TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        out_of_stock INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE starches (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );

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

      CREATE TABLE sales (
        id INTEGER PRIMARY KEY,
        till_session_id INTEGER REFERENCES till_sessions(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
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

      CREATE TABLE sale_items (
        id INTEGER PRIMARY KEY,
        sale_id INTEGER NOT NULL REFERENCES sales(id),
        protein_id INTEGER REFERENCES proteins(id),
        name_snapshot TEXT NOT NULL,
        unit_price_cents INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        line_total_cents INTEGER NOT NULL
      );

      CREATE TABLE payments (
        id INTEGER PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        amount_cents INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_by INTEGER REFERENCES users(id),
        note TEXT
      );

      CREATE TABLE payment_allocations (
        id INTEGER PRIMARY KEY,
        payment_id INTEGER NOT NULL REFERENCES payments(id),
        sale_id INTEGER NOT NULL REFERENCES sales(id),
        amount_cents INTEGER NOT NULL
      );

      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY,
        till_session_id INTEGER REFERENCES till_sessions(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        category TEXT NOT NULL,
        description TEXT,
        amount_cents INTEGER NOT NULL,
        payment_source TEXT NOT NULL DEFAULT 'till' CHECK(payment_source IN ('till','personal')),
        reference TEXT,
        created_by INTEGER REFERENCES users(id),
        deleted_at TEXT,
        deleted_by INTEGER REFERENCES users(id)
      );

      CREATE TABLE reimbursements (
        id INTEGER PRIMARY KEY,
        amount_cents INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_by INTEGER REFERENCES users(id),
        note TEXT
      );

      CREATE TABLE protein_purchases (
        id INTEGER PRIMARY KEY,
        protein_id INTEGER NOT NULL REFERENCES proteins(id),
        purchase_date TEXT NOT NULL,
        quantity_kg REAL NOT NULL,
        cost_cents INTEGER NOT NULL,
        expected_yield INTEGER NOT NULL,
        created_by INTEGER REFERENCES users(id)
      );

      CREATE TABLE cook_events (
        id INTEGER PRIMARY KEY,
        protein_id INTEGER NOT NULL REFERENCES proteins(id),
        cook_date TEXT NOT NULL,
        portions_cooked INTEGER NOT NULL,
        created_by INTEGER REFERENCES users(id)
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      INSERT INTO schema_migrations (version) VALUES (1);
    `)
  }
}
```

- [ ] **Step 4: Test database initialization**

Create `electron/db/__tests__/db.test.ts`:
```typescript
import { getDb, closeDb } from '../index'
import Database from 'better-sqlite3'

describe('Database initialization', () => {
  let db: Database.Database

  beforeAll(() => {
    process.env.NODE_ENV = 'test'
    db = getDb()
  })

  afterAll(() => {
    closeDb()
  })

  test('creates all required tables', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[]
    const tableNames = tables.map(t => t.name)
    expect(tableNames).toContain('users')
    expect(tableNames).toContain('customers')
    expect(tableNames).toContain('proteins')
    expect(tableNames).toContain('starches')
    expect(tableNames).toContain('sales')
    expect(tableNames).toContain('sale_items')
    expect(tableNames).toContain('payments')
    expect(tableNames).toContain('expenses')
    expect(tableNames).toContain('reimbursements')
    expect(tableNames).toContain('protein_purchases')
    expect(tableNames).toContain('cook_events')
    expect(tableNames).toContain('settings')
  })

  test('enables WAL mode', () => {
    const mode = db.pragma('journal_mode', { simple: true })
    expect(mode).toBe('wal')
  })

  test('enables foreign keys', () => {
    const fk = db.pragma('foreign_keys', { simple: true })
    expect(fk).toBe(1)
  })
})
```

- [ ] **Step 5: Install vitest and run test**

```bash
npm install -D vitest
npx vitest run electron/db/__tests__/db.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: database foundation with all tables, WAL mode, migrations"
```

---

## Task 3: Shared Types & IPC Skeleton

**Files:**
- Create: `shared/types.ts` (full entity types)
- Modify: `electron/preload.ts` (expose all IPC methods)
- Modify: `electron/main.ts` (register all IPC handlers)

**Interfaces:**
- Produces: `window.api.*` methods matching design.md §2.5

- [ ] **Step 1: Create shared types**

`shared/types.ts`:
```typescript
// === Entities ===
export interface User {
  id: number
  name: string
  role: 'cashier' | 'manager'
  active: number
}

export interface Customer {
  id: number
  name: string
  phone: string | null
  created_at: string
}

export interface CustomerWithBalance extends Customer {
  total_owed_cents: number
  unpaid_orders: number
  last_order_date: string
}

export interface Protein {
  id: number
  name: string
  selling_price_cents: number
  cost_price_cents: number
  category: string
  active: number
  out_of_stock: number
}

export interface Starch {
  id: number
  name: string
  active: number
}

export interface TillSession {
  id: number
  opened_at: string
  closed_at: string | null
  opening_float_cents: number
  expected_cash_cents: number | null
  counted_cash_cents: number | null
  variance_cents: number | null
  opened_by: number | null
  closed_by: number | null
}

export interface Sale {
  id: number
  till_session_id: number | null
  created_at: string
  status: 'completed' | 'unpaid' | 'voided' | 'refunded'
  subtotal_cents: number
  discount_cents: number
  tax_cents: number
  total_cents: number
  payment_source: 'cash' | 'unpaid'
  customer_id: number | null
  starch_id: number | null
  created_by: number | null
  voided_at: string | null
  voided_by: number | null
  void_reason: string | null
}

export interface SaleItem {
  id: number
  sale_id: number
  protein_id: number | null
  name_snapshot: string
  unit_price_cents: number
  quantity: number
  line_total_cents: number
}

export interface SaleWithItems extends Sale {
  items: SaleItem[]
  customer_name?: string
  starch_name?: string
}

export interface Payment {
  id: number
  customer_id: number
  amount_cents: number
  created_at: string
  created_by: number | null
  note: string | null
}

export interface PaymentAllocation {
  id: number
  payment_id: number
  sale_id: number
  amount_cents: number
}

export interface Expense {
  id: number
  till_session_id: number | null
  created_at: string
  category: string
  description: string | null
  amount_cents: number
  payment_source: 'till' | 'personal'
  reference: string | null
  created_by: number | null
  deleted_at: string | null
  deleted_by: number | null
}

export interface Reimbursement {
  id: number
  amount_cents: number
  created_at: string
  created_by: number | null
  note: string | null
}

export interface ProteinPurchase {
  id: number
  protein_id: number
  purchase_date: string
  quantity_kg: number
  cost_cents: number
  expected_yield: number
  created_by: number | null
}

export interface CookEvent {
  id: number
  protein_id: number
  cook_date: string
  portions_cooked: number
  created_by: number | null
}

export interface FoodCostSummary {
  protein_name: string
  purchased: number
  cooked: number
  sold: number
  waste: number
  cost_cents: number
  revenue_cents: number
  margin_cents: number
}

// === IPC Payloads ===
export interface CreateSalePayload {
  items: { protein_id: number; quantity: number }[]
  starch_id: number
  discount_cents?: number
  tax_rate?: number
  status: 'completed' | 'unpaid'
  customer_id?: number
  customer_name?: string
}

export interface CreateExpensePayload {
  category: string
  description?: string
  amount_cents: number
  payment_source: 'till' | 'personal'
  reference?: string
}

export interface CreatePaymentPayload {
  customer_id: number
  amount_cents: number
  allocations: { sale_id: number; amount_cents: number }[]
}

// === API Shape ===
export interface Api {
  ping: () => Promise<string>
  // Auth
  'auth:login': (pin: string) => Promise<{ userId: number; role: string } | null>
  // Sales
  'sales:create': (payload: CreateSalePayload) => Promise<Sale>
  'sales:void': (id: number, reason: string) => Promise<void>
  'sales:list': (filters?: { status?: string; date_from?: string; date_to?: string }) => Promise<SaleWithItems[]>
  'sales:get': (id: number) => Promise<SaleWithItems>
  // Customers
  'customers:create': (name: string, phone?: string) => Promise<Customer>
  'customers:list': () => Promise<CustomerWithBalance[]>
  'customers:get': (id: number) => Promise<CustomerWithBalance & { orders: SaleWithItems[] }>
  // Payments
  'payments:create': (payload: CreatePaymentPayload) => Promise<Payment>
  'payments:list': (customerId: number) => Promise<Payment[]>
  // Expenses
  'expenses:create': (payload: CreateExpensePayload) => Promise<Expense>
  'expenses:update': (id: number, payload: Partial<CreateExpensePayload>) => Promise<Expense>
  'expenses:delete': (id: number) => Promise<void>
  'expenses:list': (filters?: { date_from?: string; date_to?: string; category?: string; payment_source?: string }) => Promise<Expense[]>
  // Reimbursements
  'reimbursements:create': (amount_cents: number, note?: string) => Promise<Reimbursement>
  'reimbursements:balance': () => Promise<{ owed_to_owner_cents: number }>
  // Till
  'till:open': (floatCents: number) => Promise<TillSession>
  'till:close': (countedCents: number) => Promise<{ expected: number; variance: number }>
  'till:current': () => Promise<TillSession | null>
  // Food Cost
  'foodCost:purchases:list': (date: string) => Promise<ProteinPurchase[]>
  'foodCost:purchases:create': (payload: { protein_id: number; quantity_kg: number; cost_cents: number; expected_yield: number }) => Promise<ProteinPurchase>
  'foodCost:cookEvents:list': (date: string) => Promise<CookEvent[]>
  'foodCost:cookEvents:create': (payload: { protein_id: number; portions_cooked: number }) => Promise<CookEvent>
  'foodCost:summary': (date: string) => Promise<FoodCostSummary[]>
  // Reports
  'reports:daily': (date: string) => Promise<any>
  'reports:weekly': (date: string) => Promise<any>
  'reports:monthly': (date: string) => Promise<any>
  'reports:exportCsv': (range: { from: string; to: string }) => Promise<string>
  // Menu
  'proteins:list': () => Promise<Protein[]>
  'proteins:upsert': (payload: Partial<Protein>) => Promise<Protein>
  'proteins:setOutOfStock': (id: number, outOfStock: boolean) => Promise<void>
  'starches:list': () => Promise<Starch[]>
  'starches:upsert': (payload: Partial<Starch>) => Promise<Starch>
  // Settings
  'settings:get': () => Promise<Record<string, string>>
  'settings:update': (partial: Record<string, string>) => Promise<void>
  'backup:create': () => Promise<string>
  'backup:restore': (filePath: string) => Promise<void>
}
```

- [ ] **Step 2: Update preload to expose all IPC methods**

`electron/preload.ts`:
```typescript
import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/types'

const api: Api = {
  ping: () => ipcRenderer.invoke('ping'),
  'auth:login': (pin) => ipcRenderer.invoke('auth:login', pin),
  'sales:create': (payload) => ipcRenderer.invoke('sales:create', payload),
  'sales:void': (id, reason) => ipcRenderer.invoke('sales:void', id, reason),
  'sales:list': (filters) => ipcRenderer.invoke('sales:list', filters),
  'sales:get': (id) => ipcRenderer.invoke('sales:get', id),
  'customers:create': (name, phone) => ipcRenderer.invoke('customers:create', name, phone),
  'customers:list': () => ipcRenderer.invoke('customers:list'),
  'customers:get': (id) => ipcRenderer.invoke('customers:get', id),
  'payments:create': (payload) => ipcRenderer.invoke('payments:create', payload),
  'payments:list': (customerId) => ipcRenderer.invoke('payments:list', customerId),
  'expenses:create': (payload) => ipcRenderer.invoke('expenses:create', payload),
  'expenses:update': (id, payload) => ipcRenderer.invoke('expenses:update', id, payload),
  'expenses:delete': (id) => ipcRenderer.invoke('expenses:delete', id),
  'expenses:list': (filters) => ipcRenderer.invoke('expenses:list', filters),
  'reimbursements:create': (amount, note) => ipcRenderer.invoke('reimbursements:create', amount, note),
  'reimbursements:balance': () => ipcRenderer.invoke('reimbursements:balance'),
  'till:open': (float) => ipcRenderer.invoke('till:open', float),
  'till:close': (counted) => ipcRenderer.invoke('till:close', counted),
  'till:current': () => ipcRenderer.invoke('till:current'),
  'foodCost:purchases:list': (date) => ipcRenderer.invoke('foodCost:purchases:list', date),
  'foodCost:purchases:create': (payload) => ipcRenderer.invoke('foodCost:purchases:create', payload),
  'foodCost:cookEvents:list': (date) => ipcRenderer.invoke('foodCost:cookEvents:list', date),
  'foodCost:cookEvents:create': (payload) => ipcRenderer.invoke('foodCost:cookEvents:create', payload),
  'foodCost:summary': (date) => ipcRenderer.invoke('foodCost:summary', date),
  'reports:daily': (date) => ipcRenderer.invoke('reports:daily', date),
  'reports:weekly': (date) => ipcRenderer.invoke('reports:weekly', date),
  'reports:monthly': (date) => ipcRenderer.invoke('reports:monthly', date),
  'reports:exportCsv': (range) => ipcRenderer.invoke('reports:exportCsv', range),
  'proteins:list': () => ipcRenderer.invoke('proteins:list'),
  'proteins:upsert': (payload) => ipcRenderer.invoke('proteins:upsert', payload),
  'proteins:setOutOfStock': (id, outOfStock) => ipcRenderer.invoke('proteins:setOutOfStock', id, outOfStock),
  'starches:list': () => ipcRenderer.invoke('starches:list'),
  'starches:upsert': (payload) => ipcRenderer.invoke('starches:upsert', payload),
  'settings:get': () => ipcRenderer.invoke('settings:get'),
  'settings:update': (partial) => ipcRenderer.invoke('settings:update', partial),
  'backup:create': () => ipcRenderer.invoke('backup:create'),
  'backup:restore': (filePath) => ipcRenderer.invoke('backup:restore', filePath),
}

contextBridge.exposeInMainWorld('api', api)
```

- [ ] **Step 3: Update main.ts to register IPC handlers (stubs)**

`electron/main.ts` — add IPC registration that returns stubs. Each handler will be implemented in its own file in subsequent tasks.

- [ ] **Step 4: Verify preload type-checks**

```bash
npx tsc -p tsconfig.node.json --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: shared types and IPC skeleton with all method signatures"
```

---

## Task 4: Seed Data & Auth

**Files:**
- Create: `electron/db/repositories/usersRepo.ts`
- Create: `electron/db/repositories/settingsRepo.ts`
- Create: `electron/ipc/authHandlers.ts`
- Create: `src/context/AuthContext.tsx`
- Create: `src/components/PinPad.tsx`
- Create: `src/pages/Login/PinPadPage.tsx`

**Interfaces:**
- Consumes: `getDb()` from Task 2
- Produces: `auth:login` IPC handler, `AuthContext`, `PinPad` component, seed data

- [ ] **Step 1: Create usersRepo**

```typescript
import { getDb } from '../index'
import crypto from 'crypto'

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex')
}

export const usersRepo = {
  findByPin(pin: string) {
    return getDb().prepare('SELECT * FROM users WHERE pin_hash = ? AND active = 1').get(hashPin(pin))
  },
  create(name: string, role: 'cashier' | 'manager', pin: string) {
    const result = getDb().prepare('INSERT INTO users (name, role, pin_hash) VALUES (?, ?, ?)').run(name, role, hashPin(pin))
    return { id: result.lastInsertRowid, name, role }
  },
  seed() {
    const count = getDb().prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }
    if (count.c === 0) {
      this.create('Manager', 'manager', '1234')
    }
  }
}
```

- [ ] **Step 2: Create settingsRepo**

```typescript
import { getDb } from '../index'

export const settingsRepo = {
  get(key: string): string | null {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  },
  getAll(): Record<string, string> {
    const rows = getDb().prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  },
  set(key: string, value: string) {
    getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
  },
  setMany(entries: Record<string, string>) {
    const insert = getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    const tx = getDb().transaction(() => {
      for (const [k, v] of Object.entries(entries)) insert.run(k, v)
    })
    tx()
  },
  seed() {
    const count = getDb().prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number }
    if (count.c === 0) {
      this.setMany({
        currency: 'UGX',
        tax_enabled: 'false',
        tax_rate: '0',
      })
    }
  }
}
```

- [ ] **Step 3: Create auth IPC handler**

`electron/ipc/authHandlers.ts`:
```typescript
import { ipcMain } from 'electron'
import { usersRepo } from '../db/repositories/usersRepo'

export function registerAuthHandlers() {
  ipcMain.handle('auth:login', (_event, pin: string) => {
    const user = usersRepo.findByPin(pin) as any
    if (!user) return null
    return { userId: user.id, role: user.role }
  })
}
```

- [ ] **Step 4: Create AuthContext**

`src/context/AuthContext.tsx`:
```tsx
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface AuthState {
  userId: number | null
  role: string | null
  isAuthenticated: boolean
}

interface AuthContextType extends AuthState {
  login: (pin: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ userId: null, role: null, isAuthenticated: false })

  const login = useCallback(async (pin: string) => {
    const result = await window.api['auth:login'](pin)
    if (result) {
      setAuth({ userId: result.userId, role: result.role, isAuthenticated: true })
      return true
    }
    return false
  }, [])

  const logout = useCallback(() => {
    setAuth({ userId: null, role: null, isAuthenticated: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 5: Create PinPad component**

`src/components/PinPad.tsx`:
```tsx
import { useState } from 'react'

interface PinPadProps {
  onSubmit: (pin: string) => void
  length?: number
}

export function PinPad({ onSubmit, length = 4 }: PinPadProps) {
  const [pin, setPin] = useState('')

  const handleDigit = (digit: string) => {
    if (pin.length < length) {
      const next = pin + digit
      setPin(next)
      if (next.length === length) onSubmit(next)
    }
  }

  const handleClear = () => setPin('')
  const handleBackspace = () => setPin(p => p.slice(0, -1))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 300 }}>
      {['1','2','3','4','5','6','7','8','9'].map(d => (
        <button key={d} onClick={() => handleDigit(d)}
          style={{ height: 56, fontSize: '1.5rem', fontWeight: 600, borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
          {d}
        </button>
      ))}
      <button onClick={handleClear} style={{ height: 56, fontSize: '1rem', fontWeight: 600, borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        Clear
      </button>
      <button onClick={() => handleDigit('0')} style={{ height: 56, fontSize: '1.5rem', fontWeight: 600, borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        0
      </button>
      <button onClick={handleBackspace} style={{ height: 56, fontSize: '1rem', fontWeight: 600, borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        ⌫
      </button>
      <div style={{ gridColumn: '1 / -1', textAlign: 'center', fontSize: '2rem', letterSpacing: 8, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {'●'.repeat(pin.length)}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create PinPadPage**

`src/pages/Login/PinPadPage.tsx`:
```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { PinPad } from '../../components/PinPad'

export function PinPadPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(false)

  const handleSubmit = async (pin: string) => {
    const ok = await login(pin)
    if (ok) navigate('/sell')
    else { setError(true); setTimeout(() => setError(false), 1500) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 24 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Enter PIN</h1>
      {error && <p style={{ color: 'var(--color-danger)' }}>Invalid PIN</p>}
      <PinPad onSubmit={handleSubmit} />
    </div>
  )
}
```

- [ ] **Step 7: Wire AuthProvider into App**

Update `src/App.tsx` to wrap routes with `AuthProvider` and add login route.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: auth with PIN login, seed data, PinPad component"
```

---

## Task 5: Seed Proteins & Starches

**Files:**
- Create: `electron/db/repositories/proteinsRepo.ts`
- Create: `electron/db/repositories/starchesRepo.ts`
- Create: `electron/ipc/menuHandlers.ts`

**Interfaces:**
- Produces: `proteins:list`, `proteins:upsert`, `starches:list`, `starches:upsert`

- [ ] **Step 1: Create proteinsRepo**

```typescript
import { getDb } from '../index'

export const proteinsRepo = {
  list() {
    return getDb().prepare('SELECT * FROM proteins WHERE active = 1 ORDER BY category, name').all()
  },
  getById(id: number) {
    return getDb().prepare('SELECT * FROM proteins WHERE id = ?').get(id)
  },
  upsert(data: { id?: number; name: string; selling_price_cents: number; cost_price_cents: number; category: string; active?: number }) {
    if (data.id) {
      getDb().prepare('UPDATE proteins SET name=?, selling_price_cents=?, cost_price_cents=?, category=?, active=? WHERE id=?')
        .run(data.name, data.selling_price_cents, data.cost_price_cents, data.category, data.active ?? 1, data.id)
      return this.getById(data.id)
    }
    const result = getDb().prepare('INSERT INTO proteins (name, selling_price_cents, cost_price_cents, category) VALUES (?, ?, ?, ?)')
      .run(data.name, data.selling_price_cents, data.cost_price_cents, data.category)
    return this.getById(result.lastInsertRowid as number)
  },
  setOutOfStock(id: number, outOfStock: boolean) {
    getDb().prepare('UPDATE proteins SET out_of_stock = ? WHERE id = ?').run(outOfStock ? 1 : 0, id)
  },
  seed() {
    const count = getDb().prepare('SELECT COUNT(*) as c FROM proteins').get() as { c: number }
    if (count.c === 0) {
      const insert = getDb().prepare('INSERT INTO proteins (name, selling_price_cents, cost_price_cents, category) VALUES (?, ?, ?, ?)')
      insert.run('Goat Meat', 10000, 6000, 'Goat')
      insert.run('Chicken', 8000, 5000, 'Chicken')
      insert.run('Fish', 7000, 4000, 'Fish')
    }
  }
}
```

- [ ] **Step 2: Create starchesRepo**

```typescript
import { getDb } from '../index'

export const starchesRepo = {
  list() {
    return getDb().prepare('SELECT * FROM starches WHERE active = 1 ORDER BY name').all()
  },
  upsert(data: { id?: number; name: string; active?: number }) {
    if (data.id) {
      getDb().prepare('UPDATE starches SET name=?, active=? WHERE id=?').run(data.name, data.active ?? 1, data.id)
      return getDb().prepare('SELECT * FROM starches WHERE id = ?').get(data.id)
    }
    const result = getDb().prepare('INSERT INTO starches (name) VALUES (?)').run(data.name)
    return getDb().prepare('SELECT * FROM starches WHERE id = ?').get(result.lastInsertRowid)
  },
  seed() {
    const count = getDb().prepare('SELECT COUNT(*) as c FROM starches').get() as { c: number }
    if (count.c === 0) {
      const insert = getDb().prepare('INSERT INTO starches (name) VALUES (?)')
      insert.run('Banana')
      insert.run('Cassava')
      insert.run('Plantain')
      insert.run('Irish Potatoes')
    }
  }
}
```

- [ ] **Step 3: Create menu IPC handlers**

`electron/ipc/menuHandlers.ts`:
```typescript
import { ipcMain } from 'electron'
import { proteinsRepo } from '../db/repositories/proteinsRepo'
import { starchesRepo } from '../db/repositories/starchesRepo'

export function registerMenuHandlers() {
  ipcMain.handle('proteins:list', () => proteinsRepo.list())
  ipcMain.handle('proteins:upsert', (_e, payload) => proteinsRepo.upsert(payload))
  ipcMain.handle('proteins:setOutOfStock', (_e, id, outOfStock) => proteinsRepo.setOutOfStock(id, outOfStock))
  ipcMain.handle('starches:list', () => starchesRepo.list())
  ipcMain.handle('starches:upsert', (_e, payload) => starchesRepo.upsert(payload))
}
```

- [ ] **Step 4: Update db/index.ts to call seeds**

```typescript
import { usersRepo } from './repositories/usersRepo'
import { settingsRepo } from './repositories/settingsRepo'
import { proteinsRepo } from './repositories/proteinsRepo'
import { starchesRepo } from './repositories/starchesRepo'

// After runMigrations:
usersRepo.seed()
settingsRepo.seed()
proteinsRepo.seed()
starchesRepo.seed()
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: proteins and starches repos with seed data"
```

---

## Task 6: Sell Screen — Protein Grid

**Files:**
- Create: `src/hooks/useProteins.ts`
- Create: `src/components/ItemTile.tsx`
- Create: `src/pages/Sell/SellPage.tsx`

**Interfaces:**
- Consumes: `proteins:list` IPC
- Produces: tappable protein grid with category filtering

- [ ] **Step 1: Create useProteins hook**

```typescript
import { useQuery } from '@tanstack/react-query'

export function useProteins() {
  return useQuery({
    queryKey: ['proteins'],
    queryFn: () => window.api['proteins:list'](),
  })
}
```

- [ ] **Step 2: Create ItemTile component**

`src/components/ItemTile.tsx`:
```tsx
import { Protein } from '@shared/types'

interface ItemTileProps {
  protein: Protein
  onClick: (protein: Protein) => void
}

export function ItemTile({ protein, onClick }: ItemTileProps) {
  const isOutOfStock = protein.out_of_stock === 1

  return (
    <button
      onClick={() => !isOutOfStock && onClick(protein)}
      disabled={isOutOfStock}
      style={{
        height: 120,
        padding: 16,
        borderRadius: 'var(--radius-md)',
        background: isOutOfStock ? 'var(--color-surface-alt)' : 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        opacity: isOutOfStock ? 0.5 : 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textAlign: 'left',
        color: 'var(--color-text-primary)',
      }}
    >
      <span style={{ fontSize: '1rem', fontWeight: 600 }}>{protein.name}</span>
      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success)' }}>
        {(protein.selling_price_cents / 100).toLocaleString()} UGX
      </span>
      {isOutOfStock && <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)' }}>Out of stock</span>}
    </button>
  )
}
```

- [ ] **Step 3: Create SellPage with protein grid**

`src/pages/Sell/SellPage.tsx`:
```tsx
import { useState } from 'react'
import { useProteins } from '../../hooks/useProteins'
import { ItemTile } from '../../components/ItemTile'
import { Protein } from '@shared/types'

export function SellPage() {
  const { data: proteins = [] } = useProteins()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const categories = [...new Set(proteins.map(p => p.category))]
  const filtered = selectedCategory ? proteins.filter(p => p.category === selectedCategory) : proteins

  const handleAddProtein = (protein: Protein) => {
    // TODO: open starch picker, add to cart (Task 7)
    console.log('Selected:', protein)
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Left pane: protein grid */}
      <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
        {/* Category filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedCategory(null)}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-sm)',
              background: !selectedCategory ? 'var(--color-primary)' : 'var(--color-surface)',
              color: !selectedCategory ? 'white' : 'var(--color-text-primary)',
              border: '1px solid var(--color-border)', fontWeight: 600,
            }}
          >All</button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '8px 16px', borderRadius: 'var(--radius-sm)',
                background: selectedCategory === cat ? 'var(--color-primary)' : 'var(--color-surface)',
                color: selectedCategory === cat ? 'white' : 'var(--color-text-primary)',
                border: '1px solid var(--color-border)', fontWeight: 600,
              }}
            >{cat}</button>
          ))}
        </div>
        {/* Protein grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {filtered.map(p => (
            <ItemTile key={p.id} protein={p} onClick={handleAddProtein} />
          ))}
        </div>
      </div>

      {/* Right pane: cart (TODO in Task 7) */}
      <div style={{ width: 360, borderLeft: '1px solid var(--color-border)', padding: 16, background: 'var(--color-surface)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>Cart</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>Cart coming in Task 7...</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire SellPage into router**

Update `src/router.tsx` to use `SellPage`.

- [ ] **Step 5: Install TanStack Query**

```bash
npm install @tanstack/react-query
```

Wrap `App` with `QueryClientProvider`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: sell screen with protein grid and category filtering"
```

---

## Task 7: Cart & Sale Completion

**Files:**
- Create: `src/context/CartContext.tsx`
- Create: `src/components/CartLine.tsx`
- Create: `src/components/NumPad.tsx`
- Create: `src/pages/Sell/StarchPicker.tsx`
- Modify: `src/pages/Sell/SellPage.tsx`
- Create: `electron/db/repositories/salesRepo.ts`
- Create: `electron/ipc/salesHandlers.ts`

**Interfaces:**
- Consumes: `proteins:list`, `starches:list`, `till:current`
- Produces: working sell flow: add protein → pick starch → view cart → complete sale

- [ ] **Step 1: Create CartContext**

`src/context/CartContext.tsx`:
```tsx
import { createContext, useContext, useReducer, ReactNode } from 'react'
import { Protein, Starch } from '@shared/types'

interface CartItem {
  protein: Protein
  quantity: number
}

interface CartState {
  items: CartItem[]
  starch: Starch | null
  discountCents: number
}

type CartAction =
  | { type: 'ADD_PROTEIN'; protein: Protein }
  | { type: 'REMOVE_PROTEIN'; proteinId: number }
  | { type: 'SET_QUANTITY'; proteinId: number; quantity: number }
  | { type: 'SET_STARCH'; starch: Starch }
  | { type: 'SET_DISCOUNT'; discountCents: number }
  | { type: 'CLEAR' }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_PROTEIN': {
      const existing = state.items.find(i => i.protein.id === action.protein.id)
      if (existing) {
        return { ...state, items: state.items.map(i => i.protein.id === action.protein.id ? { ...i, quantity: i.quantity + 1 } : i) }
      }
      return { ...state, items: [...state.items, { protein: action.protein, quantity: 1 }] }
    }
    case 'REMOVE_PROTEIN':
      return { ...state, items: state.items.filter(i => i.protein.id !== action.proteinId) }
    case 'SET_QUANTITY':
      return { ...state, items: state.items.map(i => i.protein.id === action.proteinId ? { ...i, quantity: action.quantity } : i) }
    case 'SET_STARCH':
      return { ...state, starch: action.starch }
    case 'SET_DISCOUNT':
      return { ...state, discountCents: action.discountCents }
    case 'CLEAR':
      return { items: [], starch: null, discountCents: 0 }
    default:
      return state
  }
}

const CartContext = createContext<{
  state: CartState
  dispatch: React.Dispatch<CartAction>
  subtotal: number
  total: number
} | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], starch: null, discountCents: 0 })
  const subtotal = state.items.reduce((sum, i) => sum + i.protein.selling_price_cents * i.quantity, 0)
  const total = subtotal - state.discountCents

  return (
    <CartContext.Provider value={{ state, dispatch, subtotal, total }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
```

- [ ] **Step 2: Create CartLine and NumPad components**

(See design.md for specs — CartLine shows item, qty stepper, price, discount; NumPad is large touch keypad for amounts)

- [ ] **Step 3: Create StarchPicker modal**

`src/pages/Sell/StarchPicker.tsx`:
```tsx
import { useQuery } from '@tanstack/react-query'
import { useCart } from '../../context/CartContext'

export function StarchPicker({ onClose }: { onClose: () => void }) {
  const { data: starches = [] } = useQuery({ queryKey: ['starches'], queryFn: () => window.api['starches:list']() })
  const { dispatch } = useCart()

  const handleSelect = (starch: any) => {
    dispatch({ type: 'SET_STARCH', starch })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 300 }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>Choose Starch</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {starches.map((s: any) => (
            <button key={s.id} onClick={() => handleSelect(s)}
              style={{ height: 48, borderRadius: 'var(--radius-md)', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', fontWeight: 600, fontSize: '1rem' }}>
              {s.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create salesRepo**

`electron/db/repositories/salesRepo.ts`:
```typescript
import { getDb } from '../index'

export const salesRepo = {
  create(sale: any, items: any[]) {
    const db = getDb()
    const insertSale = db.prepare(`INSERT INTO sales (till_session_id, status, subtotal_cents, discount_cents, tax_cents, total_cents, payment_source, customer_id, starch_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    const insertItem = db.prepare(`INSERT INTO sale_items (sale_id, protein_id, name_snapshot, unit_price_cents, quantity, line_total_cents)
      VALUES (?, ?, ?, ?, ?, ?)`)

    const result = db.transaction(() => {
      const r = insertSale.run(sale.till_session_id, sale.status, sale.subtotal_cents, sale.discount_cents, sale.tax_cents, sale.total_cents, sale.payment_source, sale.customer_id, sale.starch_id, sale.created_by)
      const saleId = r.lastInsertRowid
      for (const item of items) {
        insertItem.run(saleId, item.protein_id, item.name_snapshot, item.unit_price_cents, item.quantity, item.line_total_cents)
      }
      return saleId
    })()

    return this.getById(result as number)
  },
  getById(id: number) {
    const sale = getDb().prepare('SELECT * FROM sales WHERE id = ?').get(id) as any
    if (!sale) return null
    const items = getDb().prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id)
    return { ...sale, items }
  },
  list(filters?: any) {
    let query = 'SELECT * FROM sales WHERE 1=1'
    const params: any[] = []
    if (filters?.status) { query += ' AND status = ?'; params.push(filters.status) }
    if (filters?.date_from) { query += ' AND created_at >= ?'; params.push(filters.date_from) }
    if (filters?.date_to) { query += ' AND created_at <= ?'; params.push(filters.date_to) }
    query += ' ORDER BY created_at DESC'
    return getDb().prepare(query).all(...params)
  },
  void(id: number, reason: string, userId: number) {
    getDb().prepare("UPDATE sales SET status = 'voided', voided_at = datetime('now'), voided_by = ?, void_reason = ? WHERE id = ?")
      .run(userId, reason, id)
  }
}
```

- [ ] **Step 5: Create sales IPC handlers**

`electron/ipc/salesHandlers.ts`:
```typescript
import { ipcMain } from 'electron'
import { salesRepo } from '../db/repositories/salesRepo'
import { tillRepo } from '../db/repositories/tillRepo'

export function registerSalesHandlers() {
  ipcMain.handle('sales:create', (_e, payload) => {
    const currentTill = tillRepo.current()
    const items = payload.items.map((item: any) => {
      // Look up protein price from DB
      const protein = require('../db/repositories/proteinsRepo').proteinsRepo.getById(item.protein_id) as any
      return {
        protein_id: item.protein_id,
        name_snapshot: protein.name,
        unit_price_cents: protein.selling_price_cents,
        quantity: item.quantity,
        line_total_cents: protein.selling_price_cents * item.quantity,
      }
    })
    const subtotal = items.reduce((sum: number, i: any) => sum + i.line_total_cents, 0)
    const discount = payload.discount_cents || 0
    const tax = 0 // TODO: configurable tax
    return salesRepo.create({
      till_session_id: currentTill?.id || null,
      status: payload.status,
      subtotal_cents: subtotal,
      discount_cents: discount,
      tax_cents: tax,
      total_cents: subtotal - discount + tax,
      payment_source: payload.status === 'unpaid' ? 'unpaid' : 'cash',
      customer_id: payload.customer_id || null,
      starch_id: payload.starch_id || null,
      created_by: 1, // TODO: from auth context
    }, items)
  })
  ipcMain.handle('sales:void', (_e, id, reason) => salesRepo	void(id, reason, 1))
  ipcMain.handle('sales:list', (_e, filters) => salesRepo.list(filters))
  ipcMain.handle('sales:get', (_e, id) => salesRepo.getById(id))
}
```

- [ ] **Step 6: Update SellPage with full cart flow**

Wire up: tap protein → starch picker → add to cart → view cart → complete sale (cash or unpaid).

- [ ] **Step 7: Test full sale flow**

Run the app, add proteins, pick starch, complete a sale, verify it's in the database.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: complete sell flow with cart, starch picker, sale creation"
```

---

## Task 8: Till Management

**Files:**
- Create: `electron/db/repositories/tillRepo.ts`
- Create: `electron/ipc/tillHandlers.ts`
- Create: `src/context/TillContext.tsx`
- Create: `src/pages/Till/TillPage.tsx`
- Create: `src/hooks/useTill.ts`

**Interfaces:**
- Produces: till open/close, cash reconciliation, till context for sale validation

- [ ] **Step 1: Create tillRepo**

```typescript
import { getDb } from '../index'

export const tillRepo = {
  current() {
    return getDb().prepare('SELECT * FROM till_sessions WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1').get()
  },
  open(floatCents: number, userId: number) {
    const result = getDb().prepare('INSERT INTO till_sessions (opened_at, opening_float_cents, opened_by) VALUES (datetime(?), ?, ?)')
      .run(new Date().toISOString(), floatCents, userId)
    return getDb().prepare('SELECT * FROM till_sessions WHERE id = ?').get(result.lastInsertRowid)
  },
  close(countedCents: number, userId: number) {
    const current = this.current() as any
    if (!current) throw new Error('No open till session')

    // Calculate expected: float + cash sales - till expenses - reimbursements
    const cashSales = getDb().prepare("SELECT COALESCE(SUM(total_cents), 0) as total FROM sales WHERE till_session_id = ? AND status = 'completed' AND payment_source = 'cash'").get(current.id) as { total: number }
    const tillExpenses = getDb().prepare("SELECT COALESCE(SUM(amount_cents), 0) as total FROM expenses WHERE till_session_id = ? AND payment_source = 'till' AND deleted_at IS NULL").get(current.id) as { total: number }
    const reimbursements = getDb().prepare("SELECT COALESCE(SUM(amount_cents), 0) as total FROM reimbursements WHERE created_at >= ? AND created_at <= datetime(?, '+1 day')").get(current.opened_at, current.opened_at) as { total: number }

    const expected = current.opening_float_cents + cashSales.total - tillExpenses.total - reimbursements.total
    const variance = countedCents - expected

    getDb().prepare('UPDATE till_sessions SET closed_at = datetime(?), expected_cash_cents = ?, counted_cash_cents = ?, variance_cents = ?, closed_by = ? WHERE id = ?')
      .run(new Date().toISOString(), expected, countedCents, variance, userId, current.id)

    return { expected, variance }
  }
}
```

- [ ] **Step 2: Create TillPage**

Open Till: enter float amount → `till:open(floatCents)`
Close Till: enter counted cash → show expected vs variance → confirm → `till:close(countedCents)`

- [ ] **Step 3: Create TillContext**

Provides `currentTill` to the app so sales can be linked to a till session.

- [ ] **Step 4: Enforce "no sales without till" rule**

Update SellPage to check `till:current` — if null, show "Open till first" message.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: till management with open/close and cash reconciliation"
```

---

## Task 9: Expenses with Payment Source

**Files:**
- Create: `electron/db/repositories/expensesRepo.ts`
- Create: `electron/ipc/expensesHandlers.ts`
- Create: `src/pages/Expenses/ExpensesPage.tsx`
- Create: `src/pages/Expenses/ExpenseForm.tsx`
- Create: `src/hooks/useExpenses.ts`

**Interfaces:**
- Produces: expense CRUD with till/personal payment source

- [ ] **Step 1: Create expensesRepo**

```typescript
import { getDb } from '../index'

export const expensesRepo = {
  create(data: any) {
    const result = getDb().prepare('INSERT INTO expenses (till_session_id, category, description, amount_cents, payment_source, reference, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(data.till_session_id || null, data.category, data.description || null, data.amount_cents, data.payment_source, data.reference || null, data.created_by || 1)
    return getDb().prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid)
  },
  list(filters?: any) {
    let query = 'SELECT * FROM expenses WHERE deleted_at IS NULL'
    const params: any[] = []
    if (filters?.date_from) { query += ' AND created_at >= ?'; params.push(filters.date_from) }
    if (filters?.date_to) { query += ' AND created_at <= ?'; params.push(filters.date_to) }
    if (filters?.category) { query += ' AND category = ?'; params.push(filters.category) }
    if (filters?.payment_source) { query += ' AND payment_source = ?'; params.push(filters.payment_source) }
    query += ' ORDER BY created_at DESC'
    return getDb().prepare(query).all(...params)
  },
  update(id: number, data: any) {
    const sets: string[] = []
    const params: any[] = []
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) { sets.push(`${k} = ?`); params.push(v) }
    }
    params.push(id)
    getDb().prepare(`UPDATE expenses SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    return getDb().prepare('SELECT * FROM expenses WHERE id = ?').get(id)
  },
  delete(id: number, userId: number) {
    getDb().prepare("UPDATE expenses SET deleted_at = datetime('now'), deleted_by = ? WHERE id = ?").run(userId, id)
  }
}
```

- [ ] **Step 2: Create ExpenseForm with payment source toggle**

Form fields: category (dropdown), description, amount (NumPad), payment source (till/personal radio buttons), reference.

- [ ] **Step 3: Create ExpensesPage with list and filters**

Show expenses list with filters: date range, category, payment source. Personal expenses shown in info color.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: expenses with till/personal payment source tracking"
```

---

## Task 10: Customer Debts

**Files:**
- Create: `electron/db/repositories/customersRepo.ts`
- Create: `electron/db/repositories/paymentsRepo.ts`
- Create: `electron/ipc/customersHandlers.ts`
- Create: `electron/ipc/paymentsHandlers.ts`
- Create: `src/pages/Debts/DebtsPage.tsx`
- Create: `src/pages/Debts/CustomerDetail.tsx`
- Create: `src/hooks/useCustomers.ts`

**Interfaces:**
- Produces: customer CRUD, unpaid sale linking, debt payments, balance tracking

- [ ] **Step 1: Create customersRepo**

```typescript
import { getDb } from '../index'

export const customersRepo = {
  create(name: string, phone?: string) {
    const result = getDb().prepare('INSERT INTO customers (name, phone) VALUES (?, ?)').run(name, phone || null)
    return getDb().prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid)
  },
  list() {
    return getDb().prepare(`
      SELECT c.*,
        COALESCE(SUM(CASE WHEN s.status = 'unpaid' THEN s.total_cents ELSE 0 END), 0) as total_owed_cents,
        COUNT(CASE WHEN s.status = 'unpaid' THEN 1 END) as unpaid_orders,
        MAX(CASE WHEN s.status = 'unpaid' THEN s.created_at END) as last_order_date
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id
      GROUP BY c.id
      HAVING total_owed_cents > 0
      ORDER BY total_owed_cents DESC
    `).all()
  },
  getById(id: number) {
    const customer = getDb().prepare('SELECT * FROM customers WHERE id = ?').get(id) as any
    if (!customer) return null
    const balance = getDb().prepare(`
      SELECT COALESCE(SUM(total_cents), 0) as total_owed
      FROM sales WHERE customer_id = ? AND status = 'unpaid'
    `).get(id) as { total_owed: number }
    const orders = getDb().prepare("SELECT * FROM sales WHERE customer_id = ? AND status = 'unpaid' ORDER BY created_at DESC").all(id)
    return { ...customer, total_owed_cents: balance.total_owed, orders }
  },
  findByName(name: string) {
    return getDb().prepare('SELECT * FROM customers WHERE name = ?').get(name)
  }
}
```

- [ ] **Step 2: Create paymentsRepo**

```typescript
import { getDb } from '../index'

export const paymentsRepo = {
  create(customerId: number, amountCents: number, allocations: { sale_id: number; amount_cents: number }[], userId: number) {
    const db = getDb()
    const insertPayment = db.prepare('INSERT INTO payments (customer_id, amount_cents, created_by) VALUES (?, ?, ?)')
    const insertAlloc = db.prepare('INSERT INTO payment_allocations (payment_id, sale_id, amount_cents) VALUES (?, ?, ?)')
    const updateSale = db.prepare("UPDATE sales SET status = 'completed', payment_source = 'cash' WHERE id = ?")

    const result = db.transaction(() => {
      const r = insertPayment.run(customerId, amountCents, userId)
      const paymentId = r.lastInsertRowid
      for (const alloc of allocations) {
        insertAlloc.run(paymentId, alloc.sale_id, alloc.amount_cents)
        // If fully allocated, mark sale as completed
        const remaining = db.prepare("SELECT total_cents - COALESCE((SELECT SUM(amount_cents) FROM payment_allocations WHERE sale_id = ?), 0) as remaining FROM sales WHERE id = ?").get(alloc.sale_id, alloc.sale_id) as any
        if (remaining.remaining <= 0) updateSale.run(alloc.sale_id)
      }
      return paymentId
    })()

    return getDb().prepare('SELECT * FROM payments WHERE id = ?').get(result)
  },
  list(customerId: number) {
    return getDb().prepare('SELECT * FROM payments WHERE customer_id = ? ORDER BY created_at DESC').all(customerId)
  }
}
```

- [ ] **Step 3: Create DebtsPage**

List all customers with outstanding balances. Show: name, total owed, last order date, # unpaid orders. Tap to view detail.

- [ ] **Step 4: Create CustomerDetail page**

Show customer's unpaid orders with amounts and dates. "Record Payment" button → enter amount → allocate to sales (full, partial, or per-sale).

- [ ] **Step 5: Update sale flow for unpaid sales**

When completing a sale, if status is "unpaid", prompt for customer name (create new or select existing).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: customer debts with balance tracking and partial payments"
```

---

## Task 11: Owner Reimbursements

**Files:**
- Create: `electron/db/repositories/reimbursementsRepo.ts`
- Create: `electron/ipc/reimbursementsHandlers.ts`
- Modify: Reports/dashboard to show reimbursement balance

**Interfaces:**
- Produces: reimbursement CRUD, balance calculation

- [ ] **Step 1: Create reimbursementsRepo**

```typescript
import { getDb } from '../index'

export const reimbursementsRepo = {
  create(amountCents: number, userId: number, note?: string) {
    const result = getDb().prepare('INSERT INTO reimbursements (amount_cents, created_by, note) VALUES (?, ?, ?)').run(amountCents, userId, note || null)
    return getDb().prepare('SELECT * FROM reimbursements WHERE id = ?').get(result.lastInsertRowid)
  },
  balance() {
    const result = getDb().prepare("SELECT COALESCE(SUM(amount_cents), 0) as total FROM reimbursements").get() as { total: number }
    return { owed_to_owner_cents: result.total }
  },
  list() {
    return getDb().prepare('SELECT * FROM reimbursements ORDER BY created_at DESC').all()
  }
}
```

- [ ] **Step 2: Add "Amount Owed to Owner" to dashboard/reports**

Show running balance on the daily P&L and in a sidebar widget.

- [ ] **Step 3: Record reimbursement flow**

From the dashboard or till screen, "Reimburse Owner" button → enter amount → deducts from till expected cash.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: owner reimbursement tracking with balance"
```

---

## Task 12: Food Cost & Waste Tracking

**Files:**
- Create: `electron/db/repositories/foodCostRepo.ts`
- Create: `electron/ipc/foodCostHandlers.ts`
- Create: `src/pages/FoodCost/FoodCostPage.tsx`
- Create: `src/hooks/useFoodCost.ts`

**Interfaces:**
- Produces: protein purchase recording, cook event recording, waste calculation, per-protein margin

- [ ] **Step 1: Create foodCostRepo**

```typescript
import { getDb } from '../index'

export const foodCostRepo = {
  createPurchase(data: { protein_id: number; quantity_kg: number; cost_cents: number; expected_yield: number; purchase_date: string }, userId: number) {
    const result = getDb().prepare('INSERT INTO protein_purchases (protein_id, purchase_date, quantity_kg, cost_cents, expected_yield, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .run(data.protein_id, data.purchase_date, data.quantity_kg, data.cost_cents, data.expected_yield, userId)
    return getDb().prepare('SELECT * FROM protein_purchases WHERE id = ?').get(result.lastInsertRowid)
  },
  listPurchases(date: string) {
    return getDb().prepare('SELECT pp.*, p.name as protein_name FROM protein_purchases pp JOIN proteins p ON p.id = pp.protein_id WHERE pp.purchase_date = ?').all(date)
  },
  createCookEvent(data: { protein_id: number; cook_date: string; portions_cooked: number }, userId: number) {
    const result = getDb().prepare('INSERT INTO cook_events (protein_id, cook_date, portions_cooked, created_by) VALUES (?, ?, ?, ?)')
      .run(data.protein_id, data.cook_date, data.portions_cooked, userId)
    return getDb().prepare('SELECT * FROM cook_events WHERE id = ?').get(result.lastInsertRowid)
  },
  listCookEvents(date: string) {
    return getDb().prepare('SELECT ce.*, p.name as protein_name FROM cook_events ce JOIN proteins p ON p.id = ce.protein_id WHERE ce.cook_date = ?').all(date)
  },
  getSummary(date: string) {
    // Get purchases, cook events, and sales for this date, then compute waste
    const purchases = this.listPurchases(date) as any[]
    const cookEvents = this.listCookEvents(date) as any[]
    const sales = getDb().prepare("SELECT si.protein_id, SUM(si.quantity) as sold FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE date(s.created_at) = ? AND s.status != 'voided' GROUP BY si.protein_id").all(date) as any[]

    const purchaseMap = new Map(purchases.map((p: any) => [p.protein_id, p]))
    const cookMap = new Map(cookEvents.map((c: any) => [c.protein_id, c]))
    const salesMap = new Map(sales.map((s: any) => [s.protein_id, s]))

    const proteinIds = new Set([...purchaseMap.keys(), ...cookMap.keys()])

    return Array.from(proteinIds).map(id => {
      const purchase = purchaseMap.get(id) || { expected_yield: 0, cost_cents: 0 }
      const cook = cookMap.get(id) || { portions_cooked: 0 }
      const sale = salesMap.get(id) || { sold: 0 }
      const protein = getDb().prepare('SELECT * FROM proteins WHERE id = ?').get(id) as any

      return {
        protein_name: protein?.name || 'Unknown',
        purchased: purchase.expected_yield,
        cooked: cook.portions_cooked,
        sold: sale.sold,
        waste: Math.max(0, cook.portions_cooked - sale.sold),
        cost_cents: Math.round(purchase.cost_cents * (cook.portions_cooked / Math.max(purchase.expected_yield, 1))),
        revenue_cents: (protein?.selling_price_cents || 0) * sale.sold,
        margin_cents: 0, // computed below
      }
    }).map((s: any) => ({ ...s, margin_cents: s.revenue_cents - s.cost_cents }))
  }
}
```

- [ ] **Step 2: Create FoodCostPage**

Date selector → list of protein purchases for that day → add purchase form → add cook event form → summary table showing purchased, cooked, sold, waste, cost, revenue, margin per protein.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: food cost and waste tracking with per-protein margins"
```

---

## Task 13: Reports & P&L

**Files:**
- Create: `electron/ipc/reportsHandlers.ts`
- Create: `src/pages/Reports/ReportsPage.tsx`
- Create: `src/pages/Reports/WeeklyPage.tsx`
- Create: `src/pages/Reports/MonthlyPage.tsx`
- Create: `src/pages/Reports/HistoryPage.tsx`
- Create: `src/pages/Reports/TransactionDetail.tsx`
- Create: `src/hooks/useReports.ts`
- Create: `src/components/SummaryCard.tsx`

**Interfaces:**
- Produces: daily/weekly/monthly P&L, per-protein margins, expense breakdown, discount impact, transaction history

- [ ] **Step 1: Create reportsHandlers**

`electron/ipc/reportsHandlers.ts`:
```typescript
import { ipcMain } from 'electron'
import { getDb } from '../db/index'

export function registerReportsHandlers() {
  ipcMain.handle('reports:daily', (_e, date: string) => {
    const db = getDb()
    const sales = db.prepare("SELECT COALESCE(SUM(total_cents), 0) as total, COALESCE(SUM(discount_cents), 0) as discounts FROM sales WHERE date(created_at) = ? AND status != 'voided'").get(date) as any
    const expensesTill = db.prepare("SELECT COALESCE(SUM(amount_cents), 0) as total FROM expenses WHERE date(created_at) = ? AND payment_source = 'till' AND deleted_at IS NULL").get(date) as any
    const expensesPersonal = db.prepare("SELECT COALESCE(SUM(amount_cents), 0) as total FROM expenses WHERE date(created_at) = ? AND payment_source = 'personal' AND deleted_at IS NULL").get(date) as any
    const reimbursements = db.prepare("SELECT COALESCE(SUM(amount_cents), 0) as total FROM reimbursements WHERE date(created_at) = ?").get(date) as any
    const unpaid = db.prepare("SELECT COALESCE(SUM(total_cents), 0) as total FROM sales WHERE date(created_at) = ? AND status = 'unpaid'").get(date) as any

    const fullPriceRevenue = sales.total + sales.discounts

    return {
      date,
      sales_total: sales.total,
      discounts: sales.discounts,
      full_price_revenue: fullPriceRevenue,
      expenses_till: expensesTill.total,
      expenses_personal: expensesPersonal.total,
      expenses_total: expensesTill.total + expensesPersonal.total,
      reimbursements: reimbursements.total,
      unpaid_sales: unpaid.total,
      net: sales.total - expensesTill.total - expensesPersonal.total,
      reimbursement_balance: 0, // computed from reimbursementsRepo.balance()
    }
  })

  ipcMain.handle('reports:weekly', (_e, date) => {
    // Aggregate 7 days starting from date
    const db = getDb()
    const days: any[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(date)
      d.setDate(d.getDate() + i)
      days.push(d.toISOString().split('T')[0])
    }
    // Call reports:daily for each day and sum
    // ...
  })

  ipcMain.handle('reports:monthly', (_e, date) => {
    // Aggregate 30 days
    // ...
  })

  ipcMain.handle('reports:exportCsv', (_e, range) => {
    // Generate CSV from transaction history
    // ...
  })
}
```

- [ ] **Step 2: Create ReportsPage (Daily P&L)**

SummaryCards showing: Sales Revenue, Expenses (Till), Expenses (Personal), Net Profit, Discounts Given, Reimbursement Balance.

- [ ] **Step 3: Create WeeklyPage and MonthlyPage**

Aggregate daily data, show trend comparison (this period vs previous period).

- [ ] **Step 4: Create HistoryPage**

DataTable combining sales + expenses + payments, filterable by date range, type, category, payment source, status.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: P&L reports with daily/weekly/monthly views and transaction history"
```

---

## Task 14: Sidebar Navigation & Layout

**Files:**
- Create: `src/components/Sidebar.tsx`
- Modify: `src/App.tsx` (layout with sidebar)

**Interfaces:**
- Produces: persistent left sidebar with all navigation links

- [ ] **Step 1: Create Sidebar component**

`src/components/Sidebar.tsx`:
```tsx
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/sell', label: 'Sell', icon: '🛒' },
  { to: '/debts', label: 'Debts', icon: '👥' },
  { to: '/expenses', label: 'Expenses', icon: '💸' },
  { to: '/reports', label: 'Reports', icon: '📊' },
  { to: '/till', label: 'Till', icon: '💰' },
  { to: '/menu', label: 'Menu', icon: '📋' },
  { to: '/food-cost', label: 'Food Cost', icon: '🥩' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export function Sidebar() {
  const { logout } = useAuth()

  return (
    <nav style={{ width: 200, background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', padding: '16px 0' }}>
      <div style={{ padding: '0 16px 16px', fontWeight: 700, fontSize: '1.25rem' }}>BusinessPOS</div>
      {navItems.map(item => (
        <NavLink key={item.to} to={item.to}
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            textDecoration: 'none', fontWeight: 600,
            color: isActive ? 'var(--color-primary)' : 'var(--color-text-primary)',
            background: isActive ? 'var(--color-surface-alt)' : 'transparent',
          })}>
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
      <div style={{ marginTop: 'auto', padding: '0 16px' }}>
        <button onClick={logout} style={{ width: '100%', padding: '12px 0', background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontWeight: 600, textAlign: 'left' }}>
          Logout
        </button>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Update App layout**

Wrap routes in a layout with Sidebar on the left and main content on the right.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: sidebar navigation with all routes"
```

---

## Task 15: Settings & Backup

**Files:**
- Create: `electron/ipc/settingsHandlers.ts`
- Create: `src/pages/Settings/SettingsPage.tsx`
- Create: `src/hooks/useSettings.ts`

**Interfaces:**
- Produces: settings CRUD, backup/restore

- [ ] **Step 1: Create settingsHandlers**

Handles `settings:get`, `settings:update`, `backup:create`, `backup:restore`.

- [ ] **Step 2: Create SettingsPage**

Form for: currency symbol, tax on/off + rate, PIN management (change PIN), manual backup/export/import.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: settings page with currency, tax, PIN, backup"
```

---

## Task 16: Polish & Integration Testing

**Files:**
- Modify: all pages for empty states, loading states, error handling
- Create: end-to-end test script

**Interfaces:**
- Produces: polished app ready for packaging

- [ ] **Step 1: Add empty states to all pages**

Each list page shows a helpful empty state when no data exists.

- [ ] **Step 2: Add loading states**

Use TanStack Query's `isLoading` to show skeleton/spinner on all data-dependent screens.

- [ ] **Step 3: Add error handling**

Wrap IPC calls in try/catch, show Toast on errors.

- [ ] **Step 4: End-to-end manual test**

Run through the full flow:
1. Login with PIN 1234
2. Open till with float
3. Sell meals (cash + unpaid)
4. Record expenses (till + personal)
5. Record food purchases and cook events
6. Close till and verify reconciliation
7. Check P&L report
8. Record debt payment
9. Record reimbursement
10. Export CSV

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: polish with empty states, loading states, error handling"
```

---

## Task 17: Electron Builder Packaging

**Files:**
- Create: `electron-builder.yml`

**Interfaces:**
- Produces: distributable Windows installer

- [ ] **Step 1: Configure electron-builder**

```yaml
appId: com.businesspos.app
productName: BusinessPOS
directories:
  output: release
files:
  - dist/**/*
  - dist-electron/**/*
  - package.json
win:
  target: nsis
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

- [ ] **Step 2: Build and test installer**

```bash
npm run package
```

Test the installer on Windows.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: electron builder packaging for Windows"
```
