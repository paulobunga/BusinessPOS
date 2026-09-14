# Tasks — BusinessPOS

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
- [ ] Create initial migration with all tables from design.md §2.4 (users, customers, proteins, starches, till_sessions, sales, sale_items, payments, payment_allocations, expenses, reimbursements, protein_purchases, cook_events, settings).
- [ ] Enable `PRAGMA journal_mode=WAL;` and `PRAGMA foreign_keys=ON;` on connection init.
- [ ] Implement repositories: usersRepo, customersRepo, proteinsRepo, starchesRepo, salesRepo, saleItemsRepo, paymentsRepo, expensesRepo, reimbursementsRepo, tillRepo, foodCostRepo, settingsRepo.
- [ ] Seed script: default proteins/starches, one manager PIN, default settings (currency UGX, tax off).
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

## Phase 4 — Menu Management (Proteins & Starches)
- [ ] Proteins CRUD screen: name, selling price, cost price, category (Goat/Chicken/Fish), active, out-of-stock toggle.
- [ ] Starches CRUD screen: name, active toggle.
- [ ] Validation: selling price > 0, cost price >= 0, prevent deleting a protein with recent sales (soft-handle via deactivation).
- [ ] Settings for starch display order (customer picks one per meal).

## Phase 5 — Sell Screen (core flow)
- [ ] Two-pane layout: protein grid (filterable by category) + persistent cart panel (design.md §1.7).
- [ ] `ItemTile` grid for proteins with out-of-stock overlay state.
- [ ] Starch selection: after adding protein to cart, customer picks a starch (modal or inline selector).
- [ ] `CartContext` (`useReducer`): add/remove line, adjust qty, apply discount (fixed amount), compute subtotal/tax/total.
- [ ] Sale completion: mark as `completed` (cash paid) or `unpaid` (linked to customer name).
- [ ] Unpaid flow: when marking as unpaid, prompt for customer name (create new or select existing).
- [ ] On-screen receipt summary after a completed sale.
- [ ] **Preserve in-progress sale**: persist the current cart locally and restore it after app restart/crash, so an unfinalized order is never lost.
- [ ] Void flow: locate a recent sale, require manager PIN, capture void reason, call `sales:void`.

## Phase 6 — Customer Debts
- [ ] Debts screen: list all customers with outstanding balances (name, total owed, last order date, # of unpaid orders).
- [ ] Customer detail screen: unpaid order history with amounts and dates.
- [ ] Record payment flow: select customer, enter amount, allocate to specific sales (full, partial, or per-sale).
- [ ] Auto-clear customer balance when fully paid; retain payment history for audit.
- [ ] Search/filter on debts list (by name).
- [ ] **Partial payment at checkout**: extend the debt-sale flow to accept cash tendered now and carry the remainder as debt (`payment_method='mixed'`).
- [ ] **Per-customer balance aggregation**: Debts screen totals open debts per customer (name, total owed, oldest open sale, unpaid order count) alongside the per-sale rows.
- [ ] **Debt aging**: show days-open and color-code each open debt (fresh / warn / overdue); sortable by age and by amount.
- [ ] **Repeat-credit warning**: surface a customer's outstanding balance in the debt prompt before recording a new debt sale.
- [ ] **Overpayment guard**: block a payment that exceeds the open balance; surface the surplus as an error.

## Phase 7 — Expenses (with Payment Source)
- [ ] Expense entry form: category, description, amount via NumPad, payment source toggle (till / personal), reference.
- [ ] Expenses list (today by default, filterable by date range/category/payment source).
- [ ] Edit expense; delete requires manager PIN (soft delete).
- [ ] Visual indicator for personal expenses (info color) vs till expenses.

## Phase 8 — Owner Reimbursements
- [ ] "Amount Owed to Owner" dashboard card: running balance of personal expenses not yet reimbursed.
- [ ] Record reimbursement: transfer from till to owner, reduces the owed balance.
- [ ] Reimbursement history: list of all reimbursements with dates and amounts.
- [ ] Reimbursements factored into till close reconciliation (till cash − reimbursements = expected).

## Phase 9 — Food Cost & Waste Tracking
- [ ] Food Cost screen: date selector, list of proteins purchased today.
- [ ] Record protein purchase: select protein, enter KG, cost, expected yield (servings).
- [ ] Record cook event: select protein, enter portions cooked today.
- [ ] Auto-calculate from sales data: portions sold per protein per day.
- [ ] Waste calculation: cooked − sold = waste portions, with waste value.
- [ ] Raw leftover display: purchased − cooked = raw saved for next day.
- [ ] Per-protein daily summary: purchased, cooked, sold, waste, cost, revenue, margin.
- [ ] Food cost summary: total food cost, total waste value, overall margin.

## Phase 10 — Reports & P&L
- [ ] Daily P&L screen: SummaryCards for total sales, expenses (till + personal), net profit, waste value, discounts given, reimbursement balance.
- [ ] Weekly P&L: aggregate daily data, compare to previous week.
- [ ] Monthly P&L: aggregate weekly data, compare to previous month.
- [ ] Per-protein margin analysis: revenue, food cost, waste cost, margin per protein type.
- [ ] Expense breakdown by category and by payment source (till vs personal).
- [ ] Discount impact report: full-price revenue vs actual revenue, discount total, waste avoided.
- [ ] Transaction history table: sales + expenses + payments, filterable by date range, type, category, payment source, status.
- [ ] Transaction detail view/drawer.
- [ ] CSV export for a selected date range.

## Phase 11 — Settings
- [ ] Currency symbol (default UGX), tax on/off + rate.
- [ ] PIN management (set/change manager PIN).
- [ ] Manual backup export/import UI wired to `backup:create` / `backup:restore`.

## Phase 12 — Reliability & Backup
- [ ] Automatic backup job: on app quit + daily timer, copy WAL-checkpointed DB to `backups/`.
- [ ] Rolling retention (keep last N backups).
- [ ] Crash-recovery test: force-kill app mid-transaction, confirm DB integrity and no partial writes (SQLite transaction wrapping verified).
- [ ] Graceful "database locked/corrupt" error screen with guidance to restore from last backup.

## Phase 13 — Polish & Packaging
- [ ] Accessibility pass: 48px touch targets, focus states (`--color-focus-ring`), keyboard navigability for non-touch use.
- [ ] Empty states, loading states, and error toasts across all screens.
- [ ] App icon, window title, about/version screen.
- [ ] Configure Electron Builder for target OS installer(s); verify native module (`better-sqlite3`) rebuilds correctly for packaged app.
- [ ] End-to-end manual test pass: open till → sell meals (paid + unpaid) → record expenses (till + personal) → record food purchases → cook events → close till → check P&L matches manual math → export CSV.

## Stretch / Post-v1 (not required for launch)
- [ ] Physical receipt printer integration.
- [ ] Recurring expense templates (rent, wages).
- [ ] Per-user accounts and login history.
- [ ] Local-network multi-terminal sync.
- [ ] Kitchen display system (order routing to kitchen screen).
- [ ] Multi-currency / multi-tax-rate support.
- [ ] Photo attachments for receipts/expenses.
- [ ] Multiple concurrent open orders at the POS (browser-tab-style carts, one per dine-in group) — kafunda learnings.
- [ ] Layaway / prepaid-item facility (customer pays toward an item in installments; item released when fully paid) — kafunda learnings.
