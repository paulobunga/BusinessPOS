# Requirements — BusinessPOS

## 1. Overview

An offline-first Point of Sale (POS) application for a single restaurant location, used to record **sales**, **expenses**, **food costs**, and **customer debts**. Built with **Electron**, **React**, **React Router**, and a **local SQLite database**. No network connectivity, cloud sync, or multi-device support is required for v1.

The restaurant operates as a casual dine-in where customers order through the manager, who enters orders into the kitchen. The POS captures the financial outcome: sales, expenses, till reconciliation, food cost tracking, waste management, and full P&L reporting.

## 2. Goals

- Let the manager record sales transactions quickly during service (touch-friendly, minimal taps).
- Let the manager record expenses (ingredients, supplies, utilities, rent, wages, etc.) as they occur.
- Track customer debts (eat now, pay later) with running balances and partial payment support.
- Track food costs per protein: purchases, cooked portions, servings sold, and waste.
- Support discounted pricing to mitigate waste on slow days.
- Track personal money spent by the owner on business items, with reimbursement tracking.
- Provide daily/weekly/monthly P&L views with trend analysis and per-item margin tracking.
- Reconcile the till at end of day: expected cash vs actual counted cash, with variance alerts.
- Work fully offline, with all data persisted locally and durably.
- Be usable on a single desktop/kiosk device (mouse, touch, or keyboard).

## 3. Non-Goals (v1)

- Multi-device sync (local network or cloud).
- Multi-location support.
- Online payments / card processing integrations.
- Staff scheduling, payroll, or HR features.
- Cloud backup (local export/import only).
- Kitchen display system or order routing to kitchen.
- Table management (restaurant has no fixed tables).
- Multi-payment-type selection (cash only in v1).
- Physical receipt printing.

## 4. Users & Roles

| Role | Description | Permissions |
|---|---|---|
| **Manager/Owner** | Primary user: takes orders, records sales, manages till, reviews reports | Full access: all sales, expenses, debts, food cost, reports, settings, till management |

A simple PIN-based login (local, no external auth) distinguishes the manager from any future staff roles. Single shared PIN for v1.

## 5. Functional Requirements

### 5.1 Sales (Ledger — Income)
- FR-1: Record a new sale with one or more line items (menu item, quantity, unit price, subtotal).
- FR-2: Compute and display running total, tax (optional, configurable rate or none).
- FR-3: Apply optional discount per sale (fixed amount or percentage) — used for waste mitigation on slow days.
- FR-4: Mark a sale as `completed` (paid cash) or `unpaid` (customer owes money, linked to a customer name).
- FR-5: Void or refund a completed sale (manager PIN required), retaining an audit trail (not a hard delete).
- FR-6: On-screen receipt summary after a completed sale.

### 5.2 Customer Debts (Accounts Receivable)
- FR-7: Create or select a customer by name when recording an unpaid sale.
- FR-8: Track running balance per customer (total owed across all unpaid sales).
- FR-9: Record payments against a customer's balance: full payment, partial payment, or payment covering specific sales.
- FR-10: Debts screen showing all customers with outstanding balances: customer name, total owed, last order date, number of unpaid orders.
- FR-11: View individual customer's unpaid order history with amounts and dates.
- FR-12: Clear a customer's balance when fully paid; retain payment history for audit.

### 5.3 Expenses (Ledger — Outgoing)
- FR-13: Record an expense with: date, category (ingredients, utilities, rent, supplies, wages, transport, other), description, amount.
- FR-14: Assign a payment source to each expense: `till` (business funds) or `personal` (owner's pocket).
- FR-15: Attach an optional note/reference (e.g., supplier name, invoice number).
- FR-16: Edit or delete an expense (manager PIN required for delete), with audit trail.
- FR-17: Track running balance of personal expenses not yet reimbursed ("Amount Owed to Owner").
- FR-18: Record reimbursement transfers from till to owner, reducing the owed balance.

### 5.4 Menu / Items Management
- FR-19: CRUD for menu items: name, selling price, cost price, category, active/inactive flag.
- FR-20: Menu model: **Proteins** (goat, chicken, fish, etc.) with selling price and cost price; **Starches** (banana, cassava, plantain, potatoes) as free accompaniments.
- FR-21: CRUD for protein categories (e.g., Goat, Chicken, Fish) used for filtering during sale entry.
- FR-22: CRUD for starch options (customer picks one per meal).
- FR-23: Mark items as out-of-stock/86'd for the day without deleting them.

### 5.5 Food Cost & Waste Tracking
- FR-24: Record daily protein purchases: protein type, quantity (KG), cost, expected yield (servings).
- FR-25: Record daily cook events: protein type, number of portions cooked.
- FR-26: Automatically calculate servings sold per protein from sales data.
- FR-27: Calculate daily waste: cooked portions − sold portions = waste portions, with waste value.
- FR-28: Track raw leftover: purchased portions − cooked portions = raw saved for next day.
- FR-29: Calculate true food cost per protein: (purchase cost ÷ expected yield) × cooked portions.
- FR-30: Calculate per-protein margin: revenue from servings sold − food cost of cooked portions.

### 5.6 Till / Cash Drawer
- FR-31: Open till with a starting cash float amount at the beginning of a session/day.
- FR-32: Close till at end of day: system computes expected cash (float + cash sales − till expenses − reimbursements) vs. actual counted cash, records any variance.
- FR-33: Prevent recording new sales/expenses when no till session is open (configurable).
- FR-34: Till close reconciliation must account for: cash sales, till-paid expenses, owner reimbursements, and discounts given.

### 5.7 Reporting & P&L
- FR-35: Daily P&L view: total sales, total expenses (by source: till vs personal), net profit, owner reimbursement balance.
- FR-36: Weekly and monthly P&L summaries with trend comparison (this period vs previous period).
- FR-37: Per-protein margin analysis: revenue, food cost, waste cost, margin per protein type.
- FR-38: Expense breakdown by category and by payment source.
- FR-39: Discount impact report: total discounts given, full-price revenue vs actual revenue, waste avoided.
- FR-40: Transaction history list (sales + expenses + debt payments combined), filterable by date range, type, category, payment source, status.
- FR-41: Detail view for any past transaction (line items, timestamps, who recorded it, void/edit history).
- FR-42: Export report/history to CSV for a given date range.

### 5.8 Data & System
- FR-43: All data stored locally in a SQLite database file; app fully functional with zero network access.
- FR-44: Automatic local backup of the database on a schedule (e.g., daily) and on app close, to a separate backups folder.
- FR-45: Manual "Export data" / "Import data" (backup file) for migrating to a new machine.
- FR-46: App must recover gracefully from an unclean shutdown (e.g., power loss) without data corruption — use SQLite WAL mode and transactions for all writes.
- FR-47: Settings screen: currency symbol (default UGX), tax rate (on/off + %), receipt footer text, PIN management.

## 6. Non-Functional Requirements

- NFR-1: **Offline-first** — zero runtime dependency on internet connectivity for any core workflow.
- NFR-2: **Performance** — sale entry screen interactions (tap item → add to cart) must respond in <100ms; app cold start <3s on typical low/mid-spec hardware.
- NFR-3: **Reliability** — no data loss on crash or power failure; every committed transaction is durable (SQLite transactions, WAL mode).
- NFR-4: **Usability** — large touch targets (min 48×48px) for use on a tablet/touchscreen POS terminal in a kitchen environment (potentially greasy/wet hands, glanceable UI).
- NFR-5: **Legibility** — high contrast UI suitable for varied kitchen lighting.
- NFR-6: **Packaging** — distributable as a single installer per OS (Windows primary target; macOS/Linux nice-to-have) via Electron Builder/Forge.
- NFR-7: **Data integrity** — monetary values stored as integers (smallest currency unit, e.g., UGX shillings) to avoid floating-point rounding errors.
- NFR-8: **Auditability** — no hard deletes on financial records; use soft-delete/void flags with timestamps and actor recorded.
- NFR-9: **Maintainability** — clear separation between Electron main process (system/file/DB access) and React renderer (UI), communicating via a well-defined IPC contract.

## 7. Constraints

- Single device, single SQLite file — no distributed transactions or conflict resolution needed.
- No external services or APIs may be required for core functionality.
- Electron main process owns all database access; renderer never touches the filesystem/DB directly (security + architecture cleanliness).

## 8. Assumptions

- Single currency (UGX), no multi-currency support needed.
- Single tax rate (or none) is sufficient — no per-item tax overrides in v1.
- Cash-only payments — no card or mobile money integration in v1.
- Protein is the priced item; starches are free accompaniments (customer picks one).
- Daily protein purchases, cooked fresh each day. Raw leftovers saved for next day; cooked leftovers given to staff (waste).
- Manager is the primary (and likely only) user in v1.
- Small menu (<30 items), prices change infrequently.
- Customer identification is by name (no phone/ID required).

## 9. Success Criteria

- A manager can complete a typical 3-item cash sale in under 15 seconds.
- A manager can record an unpaid sale with customer name in under 10 seconds.
- A manager can record a personal expense and have it tracked in the P&L in under 10 seconds.
- End-of-day till reconciliation accurately matches: float + cash sales − till expenses − reimbursements against actual drawer count.
- End-of-day food cost report accurately shows: protein purchased, portions cooked, portions sold, waste value, and per-protein margin.
- Customer debt screen shows all outstanding balances with correct totals.
- Owner reimbursement balance accurately reflects all personal expenses not yet repaid.
- App can be killed mid-transaction (simulating a crash) without corrupting the database or losing previously committed sales.
