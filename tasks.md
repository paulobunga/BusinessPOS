# Tasks — Kitchen Point of Sale (Offline)

Ordered so each phase produces something runnable. Checkboxes for tracking.

## Phase 0 — Project Setup
- [ ] Scaffold Electron + Vite + React + TypeScript project (`electron-vite` template or manual: Vite renderer, TSC-compiled main).
- [ ] Configure `contextIsolation: true`, `nodeIntegration: false`, preload script skeleton.
- [ ] Add React Router (`HashRouter`) with placeholder routes from design.md §2.3.
- [ ] Install & wire up `better-sqlite3`; verify it loads correctly in the packaged Electron main process (native module rebuild step).
- [ ] Set up design tokens (`tokens.css`) from design.md §1.2–1.4; pick styling approach (Tailwind config mapped to tokens, or CSS Modules).
- [ ] Set up ESLint/Prettier, basic CI-less local scripts (`dev`, `build`, `package`).

## Phase 1 — Database Foundation
- [ ] Write migration runner (simple versioned SQL files applied in order, tracked in a `schema_migrations` table).
- [ ] Create initial migration with all tables from design.md §2.4.
- [ ] Enable `PRAGMA journal_mode=WAL;` and `PRAGMA foreign_keys=ON;` on connection init.
- [ ] Implement repositories: `itemsRepo`, `categoriesRepo`, `salesRepo`, `saleItemsRepo`, `expensesRepo`, `tillRepo`, `settingsRepo`, `usersRepo`.
- [ ] Seed script: default categories/items, one manager PIN, default settings (currency, tax off).
- [ ] Unit tests for repositories (in-memory/temp-file SQLite) covering create/read/update/soft-delete paths.

## Phase 2 — IPC Layer & Shared Types
- [ ] Define shared TypeScript types for all entities and IPC payloads (`/shared/types.ts`).
- [ ] Implement IPC handlers per design.md §2.5, each wrapping DB writes in a transaction.
- [ ] Implement `preload.ts` exposing `window.api.*` matching the IPC contract 1:1.
- [ ] Add centralized error handling: repository errors → typed IPC error → renderer toast.
- [ ] Smoke test: call each IPC method from a temporary renderer button and confirm round-trip.

## Phase 3 — Auth & Till
- [ ] Build `PinPad` component (design.md §1.5).
- [ ] Implement `auth:login` flow, `AuthContext`, and `RequireRole` route guard.
- [ ] Build Till screen: Open Till (enter float) / Close Till (enter counted cash, show expected vs variance).
- [ ] Enforce "no sales/expenses without open till" rule (configurable toggle in Settings).
- [ ] Manager-PIN-required modal for sensitive actions (void, delete, close till, settings changes) — reusable `useRequireManager()` hook.

## Phase 4 — Menu Management
- [ ] Categories CRUD screen (name, sort order).
- [ ] Items CRUD screen (name, price, category, active, out-of-stock toggle, optional icon).
- [ ] Validation: price > 0, unique-ish name warning, prevent deleting a category with active items (soft-handle via reassignment prompt).

## Phase 5 — Sell Screen (core flow)
- [ ] Two-pane layout: item grid (filterable by category) + persistent cart panel (design.md §1.7).
- [ ] `ItemTile` grid with out-of-stock overlay state.
- [ ] `CartContext` (`useReducer`): add/remove line, adjust qty, apply discount, compute subtotal/tax/total.
- [ ] Payment method selection + `NumPad` for cash tendered → auto-compute change.
- [ ] "Charge"/complete sale action → `sales:create` IPC call → success toast + clear cart.
- [ ] Hold sale (`sales:hold`) and a "Held Sales" quick-access list to resume (`/sell/:heldId`).
- [ ] On-screen receipt summary after a completed sale (print button stubbed/optional for v1).
- [ ] Void flow: locate a recent sale, require manager PIN, capture void reason, call `sales:void`.

## Phase 6 — Expenses
- [ ] Expense entry form (category, description, amount via NumPad, payment method, reference).
- [ ] Expenses list (today by default, filterable by date range/category).
- [ ] Edit expense; delete requires manager PIN (soft delete).

## Phase 7 — Reports & History
- [ ] Daily summary screen: `SummaryCard`s for total sales, total expenses, net, by payment method, by category (`reports:daily`).
- [ ] Transaction history table (`DataTable`) combining sales + expenses, filters: date range, type, category, payment method, status.
- [ ] Transaction detail view/drawer (line items, timestamps, actor, void/edit trail).
- [ ] CSV export for a selected date range (`reports:exportCsv`).

## Phase 8 — Settings
- [ ] Currency symbol, tax on/off + rate, receipt footer text.
- [ ] Payment methods list management (add/remove/reorder).
- [ ] PIN management (set/change cashier & manager PINs).
- [ ] Manual backup export/import UI wired to `backup:create` / `backup:restore`.

## Phase 9 — Reliability & Backup
- [ ] Automatic backup job: on app quit + daily timer, copy WAL-checkpointed DB to `backups/`.
- [ ] Rolling retention (keep last N backups).
- [ ] Crash-recovery test: force-kill app mid-transaction, confirm DB integrity and no partial writes (SQLite transaction wrapping verified).
- [ ] Graceful "database locked/corrupt" error screen with guidance to restore from last backup.

## Phase 10 — Polish & Packaging
- [ ] Accessibility pass: 48px touch targets, focus states (`--color-focus-ring`), keyboard navigability for non-touch use.
- [ ] Empty states, loading states, and error toasts across all screens.
- [ ] App icon, window title, about/version screen.
- [ ] Configure Electron Builder for target OS installer(s); verify native module (`better-sqlite3`) rebuilds correctly for packaged app.
- [ ] End-to-end manual test pass through a full simulated day: open till → multiple sales (cash/other) → hold/resume a sale → void one sale → record several expenses → close till → check report matches manual math → export CSV.

## Stretch / Post-v1 (not required for launch)
- [ ] Physical receipt printer integration.
- [ ] Recurring expense templates.
- [ ] Per-user (not just per-role) accounts and login history.
- [ ] Local-network multi-terminal sync.
- [ ] Multi-currency / multi-tax-rate support.
