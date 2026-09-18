# Per-Line Captain Order — Design

Date: 2026-09-18
Status: approved (section-by-section)

## Context

The POS needs per-line captain treatment: tapping a line in Current Order opens the
discount keypad, which offers a Captain order button. One tap makes that line free
(100% discount) with a Captain tag. The sale completes normally alongside paid lines.

Constraints discovered during exploration:

- Captain-ness today is whole-sale only (`sales.sale_kind = 'captain'` + required
  `service_description`, settled via a `service` payment allocation).
- `sale_items` has no per-line captain marker (only `free_item_id` for add-ons).
- Reports derive barter from `sale_kind = 'captain'` totals; debts derive from
  `sales.debt_cents`; stock distinguishes `sale_out` vs `captain_out`.
- Decisions already taken with the user: instant apply, no per-line description;
  captain-line menu value counts as barter; captain lines consume stock as
  `captain_out`; no backfill of historical rows.

## Section 1 — Data model & migration (`026_per_line_captain`)

- `ALTER TABLE sale_items ADD COLUMN is_captain INTEGER NOT NULL DEFAULT 0`.
- No new index (reports reach lines via `sales` by date, as today).
- Captain line semantics: `unit_price_cents` = menu price at sale time (value given
  away), `line_total_cents = 0`, `is_captain = 1`. All other rows unchanged in meaning.
- No backfill: existing rows default to 0; historical price-0 lines remain classified
  as plain discounts (not retroactively distinguishable).
- `shared/types.ts`: `SaleItem` gains `is_captain: number`; both sale-create payloads
  accept optional per-item `is_captain`.

## Section 2 — Sale creation & money math

- `salesRepo.create` accepts per-item `is_captain` and writes menu `unit_price_cents`,
  `line_total_cents = 0`, `is_captain = 1` for flagged lines (inside the existing
  transaction with stock + items).
- `subtotal_cents` / `total_cents` / `debt_cents` cover payable lines only — identical
  math to today. Till expected-cash (`total − debt`), debt validation
  (`paid ≤ debt`), and `cash/debt/mixed` derivation are untouched.
- Stock: captain lines → `captain_out`; all other lines → `sale_out`.
- Validation: captain lines require quantity ≥ 1 and a valid `item_id`, like any line.
  An all-captain sale completes as `cash` with total 0 (no debt, no customer required),
  mirroring a fully-discounted sale today.
- `createCaptainOrder` (whole-order flow) is unchanged.

## Section 3 — Reports, debts & receipts

- Daily/monthly `barter_cents` = whole-captain-sale totals (unchanged) PLUS
  `SUM(unit_price_cents × quantity)` over `sale_items.is_captain = 1` in normal sales.
- Revenue, debt, and net-profit formulas unchanged (captain `line_total` is 0).
- Debts/receivables: excluded automatically since they derive from `sales.debt_cents`.
- Receipts/sale history: captain lines render at 0 with a Captain tag; no per-line
  service description.
- Stock reports: `captain_out` already exists as a bucket, so free-meal consumption
  appears alongside whole captain orders.

## Section 4 — POS UI

- `LineDiscountPad` gains a prominent Captain order button: one tap sets the line to 0,
  flags it Captain, closes the keypad.
- `CartLine` gains `isCaptain?: boolean`. Merge rules: a captain line merges only with
  the same item/add-on at 0 that is also captain-flagged; manual-0 lines stay separate
  from captain lines; re-tapping the menu still opens a fresh full-price line. Editing
  a captain line to non-zero, or Reset/C, clears the flag.
- `CartItem` shows a Captain tag (instead of "Discounted from…") with the menu value
  struck through.
- `SellPage` sends per-item `is_captain` in the existing sale payload. Order-level
  Discount and Captain Order modals unchanged.

## Section 5 — Testing & rollout

- Migration test: `is_captain` defaults to 0 on old rows; column writable; app boots on
  a pre-migration DB copy.
- Repo tests (TDD): mixed sale (paid + captain lines) asserts line rows,
  `total`/`debt` exclude free value, stock movements split `sale_out`/`captain_out`;
  barter report includes captain-line menu value; debts report excludes it.
- Hook tests: captain flag set/clear plus captain-only merge rule (extends the passing
  `cartItems` suite).
- Rollout: single release, no backfill. Gate: `tsc` clean + full suite green except the
  known pre-existing `chat-repo` failures. Manual pass on tablet sizing: tap-to-captain,
  receipt Captain tag, daily-report barter movement.

## Out of scope

- Per-line service descriptions or per-line captain reporting beyond `barter_cents`.
- Reclassifying historical price-0 lines.
- Changes to the whole-order Captain Order flow.
