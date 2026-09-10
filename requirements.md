# Requirements — Kitchen Point of Sale (Offline)

## 1. Overview

An offline-first Point of Sale (POS) application for a single kitchen location, used to record **sales** and **expenses** in a standard POS ledger format. Built with **Electron**, **React**, **React Router**, and a **local SQLite database**. No network connectivity, cloud sync, or multi-device support is required for v1.

## 2. Goals

- Let kitchen staff record sales transactions quickly during service (touch-friendly, minimal taps).
- Let staff/managers record expenses (ingredients, supplies, utilities, misc.) as they occur.
- Provide a daily/period view of cash flow: total sales, total expenses, net.
- Work fully offline, with all data persisted locally and durably.
- Be usable on a single desktop/kiosk device (mouse, touch, or keyboard).

## 3. Non-Goals (v1)

- Multi-device sync (local network or cloud).
- Multi-location support.
- Online payments / card processing integrations.
- Staff scheduling, payroll, or HR features.
- Cloud backup (local export/import only).

## 4. Users & Roles

| Role | Description | Permissions |
|---|---|---|
| **Cashier/Staff** | Front-of-kitchen staff entering sales during service | Create sales, view today's sales |
| **Manager/Owner** | Oversees the till, records expenses, reviews reports | All cashier permissions + record expenses, view reports, edit/void transactions, manage menu items & categories, close/open till (cash drawer count) |

A simple PIN-based login (local, no external auth) distinguishes roles. This can be a single shared PIN per role rather than per-user accounts, to keep v1 simple.

## 5. Functional Requirements

### 5.1 Sales (Ledger — Income)
- FR-1: Record a new sale with one or more line items (menu item, quantity, unit price, subtotal).
- FR-2: Support quick-add of common/frequent items (favorites grid) for speed during service.
- FR-3: Apply optional discount per sale (fixed amount or percentage).
- FR-4: Select payment method per sale: Cash, Mobile Money, Card, Other (configurable list).
- FR-5: Compute and display running total, tax (optional, configurable rate or none), and change due (for cash).
- FR-6: Print or generate a simple receipt (on-screen summary; physical receipt printing is optional/stretch).
- FR-7: Void or refund a completed sale (manager PIN required), retaining an audit trail (not a hard delete).
- FR-8: Hold/park a sale (save as draft) and resume later, for multitasking during busy service.

### 5.2 Expenses (Ledger — Outgoing)
- FR-9: Record an expense with: date, category (ingredients, utilities, rent, supplies, wages, other), description, amount, payment method.
- FR-10: Attach an optional note/reference (e.g., supplier name, invoice number).
- FR-11: Edit or delete an expense (manager PIN required for delete), with audit trail.
- FR-12: Support recurring-expense templates (e.g., "Weekly market run") to speed repeat entry. *(stretch)*

### 5.3 Menu / Items Management
- FR-13: CRUD for menu items: name, price, category, active/inactive flag, optional image/icon.
- FR-14: CRUD for item categories (e.g., Mains, Drinks, Sides) used for filtering during sale entry.
- FR-15: Mark items as out-of-stock/86'd for the day without deleting them.

### 5.4 Till / Cash Drawer
- FR-16: Open till with a starting cash float amount at the beginning of a session/day.
- FR-17: Close till at end of day: system computes expected cash (float + cash sales − cash expenses/payouts) vs. actual counted cash, records any variance.
- FR-18: Prevent recording new sales/expenses when no till session is open (configurable — can be relaxed).

### 5.5 Reporting & History
- FR-19: Daily summary view: total sales, total expenses, net, sales by payment method, sales by category.
- FR-20: Transaction history list (sales + expenses combined or filtered), searchable/filterable by date range, type, category, payment method.
- FR-21: Detail view for any past transaction (line items, timestamps, who recorded it, void/edit history).
- FR-22: Export report/history to CSV for a given date range.

### 5.6 Data & System
- FR-23: All data stored locally in a SQLite database file; app fully functional with zero network access.
- FR-24: Automatic local backup of the database on a schedule (e.g., daily) and on app close, to a separate backups folder.
- FR-25: Manual "Export data" / "Import data" (backup file) for migrating to a new machine.
- FR-26: App must recover gracefully from an unclean shutdown (e.g., power loss) without data corruption — use SQLite WAL mode and transactions for all writes.
- FR-27: Basic settings screen: currency symbol, tax rate (on/off + %), receipt footer text, payment methods list, PIN management.

## 6. Non-Functional Requirements

- NFR-1: **Offline-first** — zero runtime dependency on internet connectivity for any core workflow.
- NFR-2: **Performance** — sale entry screen interactions (tap item → add to cart) must respond in <100ms; app cold start <3s on typical low/mid-spec kitchen hardware.
- NFR-3: **Reliability** — no data loss on crash or power failure; every committed transaction is durable (SQLite transactions, WAL mode).
- NFR-4: **Usability** — large touch targets (min 44×44px) for use on a tablet/touchscreen POS terminal in a kitchen environment (potentially greasy/wet hands, glanceable UI).
- NFR-5: **Legibility** — high contrast UI suitable for varied kitchen lighting.
- NFR-6: **Packaging** — distributable as a single installer per OS (Windows primary target; macOS/Linux nice-to-have) via Electron Builder/Forge.
- NFR-7: **Data integrity** — monetary values stored as integers (smallest currency unit, e.g., cents) to avoid floating-point rounding errors.
- NFR-8: **Auditability** — no hard deletes on financial records; use soft-delete/void flags with timestamps and actor (role/PIN) recorded.
- NFR-9: **Maintainability** — clear separation between Electron main process (system/file/DB access) and React renderer (UI), communicating via a well-defined IPC contract.

## 7. Constraints

- Single device, single SQLite file — no distributed transactions or conflict resolution needed.
- No external services or APIs may be required for core functionality.
- Electron main process owns all database access; renderer never touches the filesystem/DB directly (security + architecture cleanliness).

## 8. Assumptions

- Single currency, no multi-currency support needed.
- Single tax rate (or none) is sufficient — no per-item tax overrides in v1.
- Physical receipt printing is optional; on-screen/PDF receipt is acceptable for v1.
- The device is dedicated to this app (kiosk-like usage), so aggressive local storage use is acceptable.

## 9. Success Criteria

- A staff member can complete a typical 3-item cash sale in under 15 seconds.
- A manager can record an expense in under 10 seconds.
- End-of-day report accurately reconciles cash float + sales − expenses against actual drawer count.
- App can be killed mid-transaction (simulating a crash) without corrupting the database or losing previously committed sales.
