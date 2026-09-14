# Kitchen-Only Cash POS — Revised Data Model (v2)

Revision of the draft "Kitchen-Only Cash POS" model. This version fixes the
till-reconciliation hole, adds the expense/reimbursement layer, resolves the
chicken-portion contradiction, and hardens the drift-prone stored balances.
It is written for **SQLite** (the app's actual DB), not Postgres.

---

## 1. Design decisions (deltas from the draft)

| # | Decision | Why |
|---|---|---|
| D1 | **Every money field is an INTEGER, whole UGX** (`*_ugx`). No `NUMERIC(12,2)`. | UGX has no minor units; matches repo convention (migration 008, NFR-7). Decimal money invites rounding bugs. |
| D2 | **Quantity fields are `REAL`** (portions, Kg, litres, pieces). Only *money* is integer. | Stock is genuinely fractional (0.5 L oil, quarter pieces handled as counts). |
| D3 | **`stock_movement` is the single source of truth for stock.** Its `balance_after` is authoritative. `ingredients.current_stock` is a **cache** maintained by an `AFTER INSERT` trigger on `stock_movement` — never written independently. | Fixes the draft's two-running-balances drift risk. |
| D4 | **`payment` is append-only; order payment state is derived.** `customer_order.amount_paid_ugx` and `payment_status` are caches maintained by a trigger on `payment`. **Overpayment is rejected** (app-level guard, since SQLite can't express cross-row CHECKs). | Fixes the draft's mutable-balance regression. "Balance is derived, never stored as a mutable field" (existing FR-12e principle). |
| D5 | **Procurement money is a till outflow.** `market_purchase` carries `payment_source` (`till`/`personal`) and, when paid from the drawer, `till_session_id`. Expenses and reimbursements also carry `till_session_id`. | Without this, till close is permanently short by the market-run amount (the draft's critical hole). |
| D6 | **Chicken/portion semantics pinned down: portions are counted in pieces.** Ingredient *count* always means the serving unit (a "piece" of chicken = ¼ of a whole bird when bought whole). Recipes express consumption in pieces; the whole-bird→pieces split is a **purchase conversion**, never a recipe fraction. | The draft said "0.25 chicken per portion" while its worked example deducted 8 pieces for 8 portions — 8 × 0.25 = 2, not 8. Now: recipe = 1.0 piece/portion; buying a whole bird converts 1 bought unit → 4 base pieces. |
| D7 | **"Deducted" is derived from the ledger, not a boolean.** `order_item.stock_deducted` is removed. A fresh-cooked item's deduction = existence of a `sale_out` movement with `reference_table='order_item'`. For batch items, "handled" = `batch_id` set + `quantity_sold` incremented at serve. | A parallel boolean can disagree with the ledger after a crash. |
| D8 | **Cancellation / void has a compensating-stock story** and a manager-PIN audit trail, added to the order model (`voided_*` columns, `kitchen_status='cancelled'`/`'voided'`). | The draft defined `cancelled` statuses but said nothing about already-deducted stock (existing FR-5 pattern). |
| D9 | **Expenses + reimbursements restored** (with `payment_source` and `till_session_id`), so the app keeps its existing full P&L. | Adopting the draft as-is would silently drop these (FR-13–18, FR-35). |
| D10 | `units` table renamed from `unit`. | `unit` is reserved-ish in many dialects/ORMs. |

Other fixes carried over: chicken worked example re-derived, `restock` movement
type added, `discount_reason` on orders, optional `tax_` note in settings,
and the debt model's derived-balance overpayment guard preserved.

---

## 2. ERD (in words)

```
supplier ──┐
           │
staff ─────┼──> market_purchase ──< purchase_item >── ingredient ──< recipe_ingredient >── menu_item ──< menu_category
           │                                              │            (& modifier_option_ingredient)    │
           │                                        stock_movement                                 order_item >── customer_order ──> till_session
           │                                              │            (status/kitchen flows)         │        │         │
           │                            stock_count       │                                  order_item_modifier   payment   customer
           └───────────────────────────────────────────────────────────────────────────────● reimbursement / expense ─●
```

One `ingredient` can appear in many `purchase_item` rows (bought repeatedly),
many `recipe_ingredient` rows (used in many dishes), and many
`stock_movement` rows (every stock change is ledgered).

A `menu_item` that is cooked in bulk ahead of demand has `production_batch`
rows — raw stock leaves inventory at **cook time** via `production_use`
movements; unsold cooked portions are logged via `production_batch_disposal`
and never return to raw stock. Dishes cooked per-ticket skip batches and
deduct raw stock at **serve time** via `sale_out` movements.

`payment` carries *both* the order it settles and the till session the cash
physically landed in (`session_id`), so a debt repaid today counts in today's
drawer. Expenses, reimbursements, and till-paid procurement are the outflows
that make the till close correctly.

---

## 3. Schema (SQLite)

```sql
-- =========================================================
-- UNITS OF MEASURE
-- =========================================================
CREATE TABLE units (
    unit_id     INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,        -- 'Kg','Litre','Piece','Bag','Finger','Gram'
    unit_type   TEXT NOT NULL CHECK (unit_type IN ('weight','volume','count'))
);

-- =========================================================
-- INGREDIENTS (raw materials; stock tracked in base unit)
-- =========================================================
CREATE TABLE ingredients (
    ingredient_id   INTEGER PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,        -- 'Cooking Oil','Tomatoes','Irish Potatoes','Chicken',...
    base_unit_id    INTEGER NOT NULL REFERENCES units(unit_id),
    reorder_level   REAL NOT NULL DEFAULT 0,     -- low-stock alert threshold, in base unit
    current_stock   REAL NOT NULL DEFAULT 0,     -- CACHE ONLY; maintained by trg_stock_cache (D3)
    avg_unit_cost_ugx INTEGER NOT NULL DEFAULT 0, -- weighted-average cost per base unit (integer UGX)
    is_active       INTEGER NOT NULL DEFAULT 1
);

-- =========================================================
-- PEOPLE & CASH CONTROL
-- =========================================================
CREATE TABLE staff (
    staff_id   INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    role       TEXT NOT NULL CHECK (role IN ('admin','cashier','cook')),
    pin_hash   TEXT,
    is_active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE till_sessions (
    session_id         INTEGER PRIMARY KEY,
    opened_by          INTEGER NOT NULL REFERENCES staff(staff_id),
    closed_by          INTEGER REFERENCES staff(staff_id),
    opened_at          TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at          TEXT,
    opening_float_ugx  INTEGER NOT NULL DEFAULT 0,

    -- Close-time SNAPSHOTS (D: point-in-time audit, not continuous state)
    expected_cash_ugx  INTEGER,     -- computed at close (formula in §5.E)
    counted_cash_ugx   INTEGER,     -- physically counted at close
    variance_ugx       INTEGER      -- counted - expected
);

-- =========================================================
-- PROCUREMENT (market runs)
-- =========================================================
CREATE TABLE suppliers (
    supplier_id INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    phone       TEXT,
    location    TEXT
);

CREATE TABLE market_purchases (
    purchase_id      INTEGER PRIMARY KEY,
    purchase_date    TEXT NOT NULL DEFAULT (datetime('now')),
    supplier_id      INTEGER REFERENCES suppliers(supplier_id),   -- nullable: vendors are informal
    recorded_by      INTEGER NOT NULL REFERENCES staff(staff_id),

    -- D5: money leaving the drawer is a till outflow
    payment_source   TEXT NOT NULL DEFAULT 'till' CHECK (payment_source IN ('till','personal')),
    till_session_id  INTEGER REFERENCES till_sessions(session_id), -- required when payment_source='till'

    total_cost_ugx   INTEGER NOT NULL DEFAULT 0,   -- snapshot: sum of purchase_item totals
    notes            TEXT
);

CREATE TABLE purchase_items (
    purchase_item_id        INTEGER PRIMARY KEY,
    purchase_id             INTEGER NOT NULL REFERENCES market_purchases(purchase_id) ON DELETE CASCADE,
    ingredient_id           INTEGER NOT NULL REFERENCES ingredients(ingredient_id),
    purchase_unit_id        INTEGER NOT NULL REFERENCES units(unit_id),  -- unit as bought: 'Bag','Piece','Litre','Kg'
    quantity_purchased      REAL NOT NULL,                              -- 1 (bag), 1 (litre), 1 (whole chicken)
    unit_price_ugx          INTEGER NOT NULL,                           -- price PER purchase unit (integer UGX)
    total_price_ugx         INTEGER NOT NULL,                           -- quantity_purchased * unit_price_ugx
    conversion_to_base      REAL NOT NULL DEFAULT 1,                    -- base units per 1 purchase unit (per purchase: bag sizes vary)
    quantity_in_base_unit   REAL NOT NULL                               -- quantity_purchased * conversion_to_base
);

-- =========================================================
-- MENU & RECIPES
-- =========================================================
CREATE TABLE menu_categories (
    category_id INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE     -- 'Stews','Grills','Sides','Boiled Dishes'
);

CREATE TABLE menu_items (
    menu_item_id    INTEGER PRIMARY KEY,
    name            TEXT NOT NULL,
    category_id     INTEGER REFERENCES menu_categories(category_id),
    price_ugx       INTEGER NOT NULL,             -- selling price (integer UGX)
    is_active       INTEGER NOT NULL DEFAULT 1,
    out_of_stock    INTEGER NOT NULL DEFAULT 0    -- 86'd for the day
);

-- Portions are estimated by eye/count (no scale). quantity_estimate is the
-- midpoint actually used for stock deduction and COGS (D6, D7).
CREATE TABLE recipe_ingredients (
    recipe_ingredient_id INTEGER PRIMARY KEY,
    menu_item_id          INTEGER NOT NULL REFERENCES menu_items(menu_item_id) ON DELETE CASCADE,
    ingredient_id         INTEGER NOT NULL REFERENCES ingredients(ingredient_id),
    quantity_min          REAL NOT NULL,          -- e.g. 3 (pieces) or 0.3 (Kg, if weighed)
    quantity_max          REAL NOT NULL,          -- e.g. 4 (pieces); = min when exact
    quantity_estimate     REAL GENERATED ALWAYS AS ((quantity_min + quantity_max) / 2.0) STORED,
    UNIQUE (menu_item_id, ingredient_id)
);

-- =========================================================
-- MODIFIERS (e.g. 'Choice of Side': Cassava / Irish / Matooke)
-- =========================================================
CREATE TABLE modifier_groups (
    modifier_group_id INTEGER PRIMARY KEY,
    menu_item_id       INTEGER NOT NULL REFERENCES menu_items(menu_item_id) ON DELETE CASCADE,
    name               TEXT NOT NULL,             -- 'Choice of Side'
    selection_type     TEXT NOT NULL DEFAULT 'single' CHECK (selection_type IN ('single','multiple')),
    is_required        INTEGER NOT NULL DEFAULT 1,
    min_select         INTEGER NOT NULL DEFAULT 1,
    max_select         INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE modifier_options (
    modifier_option_id INTEGER PRIMARY KEY,
    modifier_group_id   INTEGER NOT NULL REFERENCES modifier_groups(modifier_group_id) ON DELETE CASCADE,
    name                TEXT NOT NULL,            -- 'Cassava','Irish Potatoes','Matooke'
    price_delta_ugx     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE modifier_option_ingredients (
    modifier_option_ingredient_id INTEGER PRIMARY KEY,
    modifier_option_id             INTEGER NOT NULL REFERENCES modifier_options(modifier_option_id) ON DELETE CASCADE,
    ingredient_id                  INTEGER NOT NULL REFERENCES ingredients(ingredient_id),
    quantity_min                   REAL NOT NULL,
    quantity_max                   REAL NOT NULL,
    quantity_estimate              REAL GENERATED ALWAYS AS ((quantity_min + quantity_max) / 2.0) STORED
);

-- =========================================================
-- CUSTOMERS (debt tracking only; anonymous cash sales don't create a row)
-- =========================================================
CREATE TABLE customers (
    customer_id INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    phone       TEXT,
    notes       TEXT,             -- e.g. 'Boda rider, comes daily'
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =========================================================
-- PRODUCTION BATCHES (cooking ahead of demand)
-- Raw stock leaves inventory here, at COOK time (production_use movement).
-- Cooked excess is disposed, never returned to raw stock.
-- =========================================================
CREATE TABLE production_batches (
    batch_id            INTEGER PRIMARY KEY,
    menu_item_id        INTEGER NOT NULL REFERENCES menu_items(menu_item_id),
    prepared_by         INTEGER NOT NULL REFERENCES staff(staff_id),
    prepared_at         TEXT NOT NULL DEFAULT (datetime('now')),
    quantity_prepared   REAL NOT NULL,             -- 8 (pieces) or 6 (litres of stew); may be fractional
    unit_id             INTEGER NOT NULL REFERENCES units(unit_id),  -- 'Piece','Litre',...

    -- maintained by app logic, single-writer transactions:
    -- quantity_sold += order_item.quantity at serve; -= on void of a served item
    -- quantity_disposed = SUM(production_batch_disposals.quantity)
    quantity_sold      REAL NOT NULL DEFAULT 0,
    quantity_disposed  REAL NOT NULL DEFAULT 0,
    quantity_remaining REAL GENERATED ALWAYS AS (quantity_prepared - quantity_sold - quantity_disposed) STORED,

    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
    closed_at   TEXT,
    notes       TEXT
);

CREATE TABLE production_batch_disposals (
    disposal_id   INTEGER PRIMARY KEY,
    batch_id      INTEGER NOT NULL REFERENCES production_batches(batch_id) ON DELETE CASCADE,
    disposal_type TEXT NOT NULL CHECK (disposal_type IN ('given_away','thrown_away','staff_meal')),
    quantity      REAL NOT NULL,
    recorded_by   INTEGER NOT NULL REFERENCES staff(staff_id),
    recorded_at   TEXT NOT NULL DEFAULT (datetime('now')),
    notes         TEXT
);

-- =========================================================
-- SALES (orders; no tables)
-- =========================================================
CREATE TABLE customer_orders (
    order_id        INTEGER PRIMARY KEY,
    order_number    TEXT NOT NULL UNIQUE,     -- printed ticket number 'ORD-0001'
    session_id      INTEGER NOT NULL REFERENCES till_sessions(session_id),
    staff_id        INTEGER NOT NULL REFERENCES staff(staff_id),   -- cashier who took the order
    customer_id     INTEGER REFERENCES customers(customer_id),      -- NULL for anonymous cash sales
    customer_name   TEXT,                     -- free-text, for calling out 'Peter, order ready'
    order_type      TEXT NOT NULL DEFAULT 'takeaway' CHECK (order_type IN ('eat_in','takeaway')),
    status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','served','cancelled','voided')),  -- D8
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at    TEXT,                     -- set when status -> 'served'

    subtotal_ugx   INTEGER NOT NULL DEFAULT 0,
    discount_ugx   INTEGER NOT NULL DEFAULT 0,
    discount_reason TEXT,                     -- e.g. 'slow-day waste mitigation'
    total_ugx      INTEGER NOT NULL DEFAULT 0 CHECK (total_ugx >= 0),

    -- D4: DERIVED CACHES, kept in sync by trg_order_paid_cache on `payment`.
    -- Never written directly by app code.
    amount_paid_ugx  INTEGER NOT NULL DEFAULT 0,
    payment_status   TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid')),
    balance_due_ugx  INTEGER GENERATED ALWAYS AS (total_ugx - amount_paid_ugx) STORED,

    -- D8: void audit (manager PIN required)
    voided_at   TEXT,
    voided_by   INTEGER REFERENCES staff(staff_id),
    void_reason TEXT,

    -- walk-off: ate and left without paying, not expected back
    is_written_off    INTEGER NOT NULL DEFAULT 0,
    write_off_reason  TEXT,
    written_off_by    INTEGER REFERENCES staff(staff_id),
    written_off_at    TEXT
);

CREATE TABLE order_items (
    order_item_id   INTEGER PRIMARY KEY,
    order_id        INTEGER NOT NULL REFERENCES customer_orders(order_id) ON DELETE CASCADE,
    menu_item_id    INTEGER NOT NULL REFERENCES menu_items(menu_item_id),
    batch_id        INTEGER REFERENCES production_batches(batch_id),  -- plate came from a pre-cooked batch; NULL = cooked fresh
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_ugx  INTEGER NOT NULL,           -- snapshot of menu price at order time
    subtotal_ugx    INTEGER NOT NULL,           -- quantity * unit_price_ugx
    kitchen_status  TEXT NOT NULL DEFAULT 'queued'
                    CHECK (kitchen_status IN ('queued','cooking','ready','served','cancelled','voided'))

    -- NO stock_deducted flag (D7). For fresh items, deduction is the existence of
    -- a sale_out stock_movement referencing this order_item. For batch items,
    -- quantity_sold is incremented on the batch at serve time.
);

-- Which modifier option(s) the customer picked (e.g. Boiled Chicken -> Irish)
CREATE TABLE order_item_modifiers (
    order_item_modifier_id INTEGER PRIMARY KEY,
    order_item_id            INTEGER NOT NULL REFERENCES order_items(order_item_id) ON DELETE CASCADE,
    modifier_option_id        INTEGER NOT NULL REFERENCES modifier_options(modifier_option_id),
    quantity_served           REAL,   -- optional override of quantity_estimate, logged by the cook
    CHECK (quantity_served IS NULL OR quantity_served > 0)
);

-- =========================================================
-- PAYMENTS (append-only; order state is derived, D4)
-- amount_paid_ugx > 0 : cash received. < 0 : refund (void / overcharge correction).
-- is_debt_settlement = 1 : clearing a prior debt, not a fresh sale.
-- =========================================================
CREATE TABLE payments (
    payment_id         INTEGER PRIMARY KEY,
    order_id           INTEGER NOT NULL REFERENCES customer_orders(order_id),
    session_id         INTEGER NOT NULL REFERENCES till_sessions(session_id),  -- till that actually received/lost the cash
    staff_id           INTEGER NOT NULL REFERENCES staff(staff_id),
    amount_paid_ugx    INTEGER NOT NULL,      -- signed: + cash in, - refund
    amount_tendered_ugx INTEGER NOT NULL DEFAULT 0,
    change_given_ugx   INTEGER NOT NULL DEFAULT 0,
    is_debt_settlement INTEGER NOT NULL DEFAULT 0,
    paid_at            TEXT NOT NULL DEFAULT (datetime('now')),
    method             TEXT NOT NULL DEFAULT 'cash' CHECK (method = 'cash')
);

-- =========================================================
-- EXPENSES & REIMBURSEMENTS (D9: restored P&L layer)
-- =========================================================
CREATE TABLE expenses (
    expense_id       INTEGER PRIMARY KEY,
    till_session_id  INTEGER REFERENCES till_sessions(session_id),  -- outflow hits THIS session's drawer
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    category         TEXT NOT NULL,     -- ingredients, utilities, rent, supplies, wages, transport, other
    description      TEXT,
    amount_ugx       INTEGER NOT NULL,
    payment_source   TEXT NOT NULL DEFAULT 'till' CHECK (payment_source IN ('till','personal')),
    reference        TEXT,              -- supplier / invoice
    created_by       INTEGER REFERENCES staff(staff_id),
    deleted_at       TEXT,              -- soft delete (NFR-8)
    deleted_by       INTEGER REFERENCES staff(staff_id)
);

-- Till -> owner transfers, reducing 'Amount Owed to Owner'
CREATE TABLE reimbursements (
    reimbursement_id INTEGER PRIMARY KEY,
    till_session_id  INTEGER REFERENCES till_sessions(session_id),  -- withdrawal from THIS session's drawer
    amount_ugx       INTEGER NOT NULL,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    created_by       INTEGER REFERENCES staff(staff_id),
    note             TEXT
);

-- =========================================================
-- INVENTORY LEDGER (single source of truth for stock, D3)
-- balance_after is authoritative. ingredients.current_stock is the cache.
-- =========================================================
CREATE TABLE stock_movements (
    movement_id     INTEGER PRIMARY KEY,
    ingredient_id   INTEGER NOT NULL REFERENCES ingredients(ingredient_id),
    movement_type   TEXT NOT NULL CHECK (movement_type IN
                      ('purchase_in','production_use','sale_out','restock','wastage','adjustment')),
    quantity        REAL NOT NULL,     -- + stock in, - stock out (base unit)
    reference_table TEXT,              -- 'purchase_item','production_batch','order_item','stock_count'
    reference_id    INTEGER,
    balance_after   REAL NOT NULL,     -- cumulative balance after this movement
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    created_by      INTEGER REFERENCES staff(staff_id),
    notes           TEXT
);

-- =========================================================
-- PERIODIC STOCK COUNTS (calibration for estimated portions)
-- =========================================================
CREATE TABLE stock_counts (
    stock_count_id  INTEGER PRIMARY KEY,
    ingredient_id   INTEGER NOT NULL REFERENCES ingredients(ingredient_id),
    counted_at      TEXT NOT NULL DEFAULT (datetime('now')),
    counted_by      INTEGER NOT NULL REFERENCES staff(staff_id),
    system_stock    REAL NOT NULL,
    actual_stock    REAL NOT NULL,
    variance        REAL GENERATED ALWAYS AS (actual_stock - system_stock) STORED
    -- Applying a count writes a stock_movement of type 'adjustment'
    -- with reference_table='stock_count', balance_after = actual_stock.
);

-- =========================================================
-- CACHE-MAINTAINING TRIGGERS (D3, D4)
-- =========================================================

-- Keep ingredients.current_stock in lockstep with the ledger's last balance.
CREATE TRIGGER trg_stock_cache
AFTER INSERT ON stock_movements
BEGIN
    UPDATE ingredients
    SET current_stock = NEW.balance_after
    WHERE ingredient_id = NEW.ingredient_id;
END;

-- Re-derive an order's paid state from its append-only payment rows.
CREATE TRIGGER trg_order_paid_cache
AFTER INSERT ON payments
BEGIN
    UPDATE customer_orders
    SET amount_paid_ugx = (SELECT COALESCE(SUM(amount_paid_ugx),0) FROM payments WHERE order_id = NEW.order_id),
        payment_status  = CASE
            WHEN (SELECT COALESCE(SUM(amount_paid_ugx),0) FROM payments WHERE order_id = NEW.order_id) >= total_ugx THEN 'paid'
            WHEN (SELECT COALESCE(SUM(amount_paid_ugx),0) FROM payments WHERE order_id = NEW.order_id) > 0 THEN 'partial'
            ELSE 'unpaid' END
    WHERE order_id = NEW.order_id;
END;

-- =========================================================
-- INDICES
-- =========================================================
CREATE INDEX idx_purchase_item_ingredient    ON purchase_items(ingredient_id);
CREATE INDEX idx_order_item_order            ON order_items(order_id);
CREATE INDEX idx_order_item_batch            ON order_items(batch_id);
CREATE INDEX idx_stock_movement_ingredient   ON stock_movements(ingredient_id, created_at);
CREATE INDEX idx_stock_movement_reference    ON stock_movements(reference_table, reference_id);
CREATE INDEX idx_payment_order               ON payments(order_id);
CREATE INDEX idx_payment_session             ON payments(session_id);
CREATE INDEX idx_order_status                ON customer_orders(status);
CREATE INDEX idx_expense_session             ON expenses(till_session_id);
```

### Invariants the app must enforce (SQLite can't express these structurally)

1. **Stock ledger is authoritative.** Every movement insert is one transaction:
   compute `balance_after = (SELECT balance_after FROM stock_movements WHERE
   ingredient_id = ? ORDER BY movement_id DESC LIMIT 1) + NEW.quantity`, insert
   the movement, and let `trg_stock_cache` copy it. Never write
   `ingredients.current_stock` directly. A `sale_out`/`restock` for a fresh
   dish stores `reference_table='order_item'`, `reference_id=order_item_id`.
2. **No negative stock.** Reject a movement whose `balance_after < 0` (surface
   a low-stock/negative-stock warning rather than silently going negative).
3. **Overpayment guard.** Reject any new positive `payments.amount_paid_ugx`
   where `SUM(payments.amount_paid_ugx) [excluding this one] >= order.total_ugx`
   — a surplus must be surfaced as an error (existing FR-12c), and a payment
   exceeding the open balance is rejected, never silently over-credited.
4. **Reward append-only.** `payments` and `stock_movements` are never
   UPDATE/DELETE'd. Corrections are new signed rows (a credit is not edited, a
   refund is a negative `payment`; an over-count is an `adjustment` movement).
5. **Till-paid procurement/expenses must carry `till_session_id`.** The app
   refuses to save a `payment_source='till'` expense or market purchase without
   an open session. Personal-source ones may be session-free.

---

## 4. Seed data (market example, chicken math corrected per D6)

```sql
INSERT INTO units (name, unit_type) VALUES
('Litre','volume'), ('Kg','weight'), ('Bag','weight'), ('Piece','count'),
('Finger','count'), ('Gram','weight');

INSERT INTO ingredients (name, base_unit_id, reorder_level) VALUES
('Cooking Oil',    (SELECT unit_id FROM units WHERE name='Litre'),  2),
('Tomatoes',       (SELECT unit_id FROM units WHERE name='Kg'),     5),
('Irish Potatoes', (SELECT unit_id FROM units WHERE name='Piece'),  20),
('Matooke Fingers',(SELECT unit_id FROM units WHERE name='Finger'), 40),
('Cassava',        (SELECT unit_id FROM units WHERE name='Piece'),  15),
('Chicken',        (SELECT unit_id FROM units WHERE name='Piece'),  2),
('Goat Meat',      (SELECT unit_id FROM units WHERE name='Kg'),     3),
('Beef',           (SELECT unit_id FROM units WHERE name='Kg'),     3),
('Sugar',          (SELECT unit_id FROM units WHERE name='Kg'),     2);

-- One market run, paid from the day's drawer (D5).
-- till_session_id is set to the active session in real use.
INSERT INTO market_purchases (recorded_by, payment_source, total_cost_ugx, notes)
VALUES (1, 'till', 89000, 'Weekly market run');

INSERT INTO purchase_items
  (purchase_id, ingredient_id, purchase_unit_id, quantity_purchased, unit_price_ugx,
   total_price_ugx, conversion_to_base, quantity_in_base_unit)
VALUES
-- 1 Litre Cooking Oil @ 8,000
(1, (SELECT ingredient_id FROM ingredients WHERE name='Cooking Oil'),
    (SELECT unit_id FROM units WHERE name='Litre'), 1, 8000, 8000, 1, 1),

-- Bag of tomatoes @ 5,000 (assume bag ~ 50 Kg this week)
(1, (SELECT ingredient_id FROM ingredients WHERE name='Tomatoes'),
    (SELECT unit_id FROM units WHERE name='Bag'), 1, 5000, 5000, 50, 50),

-- Bag of Irish potatoes @ 10,000 (~120 potatoes in this bag)
(1, (SELECT ingredient_id FROM ingredients WHERE name='Irish Potatoes'),
    (SELECT unit_id FROM units WHERE name='Bag'), 1, 10000, 10000, 120, 120),

-- ONE whole chicken @ 17,000 -> 4 pieces of base-unit stock (1 bird = 4 serving pieces).
-- conversion_to_base is the estimated piece count of THIS bird, captured per purchase.
(1, (SELECT ingredient_id FROM ingredients WHERE name='Chicken'),
    (SELECT unit_id FROM units WHERE name='Piece'), 1, 17000, 17000, 4, 4),

-- 1 Kg Goat Meat @ 24,000
(1, (SELECT ingredient_id FROM ingredients WHERE name='Goat Meat'),
    (SELECT unit_id FROM units WHERE name='Kg'), 1, 24000, 24000, 1, 1),

-- 1 Kg Beef @ 20,000
(1, (SELECT ingredient_id FROM ingredients WHERE name='Beef'),
    (SELECT unit_id FROM units WHERE name='Kg'), 1, 20000, 20000, 1, 1),

-- 1 Kg Sugar @ 5,000
(1, (SELECT ingredient_id FROM ingredients WHERE name='Sugar'),
    (SELECT unit_id FROM units WHERE name='Kg'), 1, 5000, 5000, 1, 1);

-- Each row above also writes a stock_movement (purchase_in, +quantity_in_base_unit)
-- and recomputes avg_unit_cost_ugx as a weighted average (rounded to UGX).
```

Boiled Chicken — **one menu item, one base recipe, and a modifier group**:

```sql
INSERT INTO menu_categories (name) VALUES ('Boiled Dishes');

INSERT INTO menu_items (name, category_id, price_ugx) VALUES
('Boiled Chicken',
 (SELECT category_id FROM menu_categories WHERE name='Boiled Dishes'), 15000);

-- Base recipe: whatever's used regardless of side.
-- Chicken is measured in SERVING PIECES (D6): 1.0 piece per portion. The
-- whole-bird -> pieces split lives in the purchase conversion, not here.
INSERT INTO recipe_ingredients (menu_item_id, ingredient_id, quantity_min, quantity_max) VALUES
((SELECT menu_item_id FROM menu_items WHERE name='Boiled Chicken'),
 (SELECT ingredient_id FROM ingredients WHERE name='Chicken'), 1.0, 1.0),   -- exact
((SELECT menu_item_id FROM menu_items WHERE name='Boiled Chicken'),
 (SELECT ingredient_id FROM ingredients WHERE name='Cooking Oil'), 0.04, 0.06);  -- ~50 ml, estimated

INSERT INTO modifier_groups (menu_item_id, name, selection_type, is_required, min_select, max_select) VALUES
((SELECT menu_item_id FROM menu_items WHERE name='Boiled Chicken'),
 'Choice of Side', 'single', 1, 1, 1);

INSERT INTO modifier_options (modifier_group_id, name) VALUES
((SELECT modifier_group_id FROM modifier_groups WHERE name='Choice of Side'), 'Irish Potatoes'),
((SELECT modifier_group_id FROM modifier_groups WHERE name='Choice of Side'), 'Matooke'),
((SELECT modifier_group_id FROM modifier_groups WHERE name='Choice of Side'), 'Cassava');

INSERT INTO modifier_option_ingredients (modifier_option_id, ingredient_id, quantity_min, quantity_max) VALUES
((SELECT modifier_option_id FROM modifier_options WHERE name='Irish Potatoes'),
 (SELECT ingredient_id FROM ingredients WHERE name='Irish Potatoes'), 3, 4),
((SELECT modifier_option_id FROM modifier_options WHERE name='Matooke'),
 (SELECT ingredient_id FROM ingredients WHERE name='Matooke Fingers'), 3, 4),
((SELECT modifier_option_id FROM modifier_options WHERE name='Cassava'),
 (SELECT ingredient_id FROM ingredients WHERE name='Cassava'), 2, 3);
```

At order time, "Boiled Chicken with Matooke" writes one `order_item` plus one
`order_item_modifier` pointing at the Matooke option. At serve, stock is
deducted for the base recipe (1.0 chicken piece + ~0.05 L oil) **and** the
chosen side only (~3.5 matooke fingers) — never Irish or cassava, which weren't
touched.

---

## 5. Core workflows

**A. Market purchase -> stock increases**
1. Log a `market_purchase` with one `purchase_item` per item; if paid from the
   drawer, attach `payment_source='till'` + the active `till_session_id` (D5).
2. For each item, in ONE transaction: insert a `stock_movements` row
   (`purchase_in`, +`quantity_in_base_unit`, `reference_table='purchase_item'`).
   `balance_after` = previous ledger balance + quantity (invariant 1).
3. Recompute `avg_unit_cost_ugx` as an integer weighted average:
   `new_avg = round((old_stock*old_avg + new_base_qty*cost_per_base_unit) / (old_stock + new_base_qty))`
   where `cost_per_base_unit = unit_price_ugx / conversion_to_base`.
   (If `old_stock = 0`, `new_avg = cost_per_base_unit`.)

**B0. Cooking a batch ahead of demand (bulk-cooked dishes only)**
1. Cook inserts `production_batches`: menu_item, `quantity_prepared`, unit.
2. In ONE transaction: for each base-recipe ingredient, insert a
   `stock_movements` row (`production_use`, `-(quantity_estimate * quantity_prepared)`,
   `reference_table='production_batch'`). Raw stock leaves inventory **here**.
3. Batch is `active` with `quantity_remaining = quantity_prepared`, sold against
   through the day.

**B. Order and serve**
1. Active `till_sessions` must exist.
2. `customer_orders` (status `open`) + `order_items`; record modifier picks as
   `order_item_modifiers` at order time.
3. Kitchen queue filters `kitchen_status = 'queued'`; flows `cooking` -> `ready`.
4. Serve logic:
   - **Batch item** (`batch_id` set): on serve, `production_batches.quantity_sold
     += order_item.quantity`. No raw stock movement — raw left at cook time (B0).
     The **side** is cooked fresh: its modifier's ingredient draw is deducted
     normally via `sale_out`.
   - **Fresh item** (`batch_id` NULL): on serve, in ONE transaction, deduct base
     recipe ingredients **and** the chosen modifier's ingredients via
     `sale_out` movements (`reference_table='order_item'`). Deduction is proven
     by the movement's existence (D7).
5. Order `status` and payment state are independent: a customer who owes is
   still served.

**C. Payment, debts, walk-offs, void**
1. **Full payment:** insert one `payment` (`amount_paid_ugx = balance_due_ugx`,
   `is_debt_settlement=0`). Trigger flips order to `paid`.
2. **Partial / zero payment (debt):** create or link `customers`; insert a
   `payment` for whatever was tendered (or none); `payment_status` becomes
   `partial`/`unpaid`; `balance_due_ugx` shows the balance. Food is served
   regardless. **Repeat-credit warning** surfaces the customer's outstanding
   total before new credit is extended (FR-12b).
3. **Debt settled later:** insert a new `payment` against the SAME `order_id`
   with `is_debt_settlement=1`, recorded in **today's** `till_sessions` — the
   cash physically lands in the correct day's drawer. `payment_status` flips to
   `paid` once `balance_due_ugx` reaches 0. Overpayment is rejected (invariant 3).
4. **Walk-off:** `customer_id` may stay NULL; set `is_written_off=1`,
   `write_off_reason`, `written_off_by/at`. `balance_due_ugx` still shows the
   loss; the debt report excludes it, the bad-debt report includes it.
5. **Cancel / void (manager PIN, D8):**
   - `order_items.kitchen_status='cancelled'` before serve: fresh item had no
     deduction yet -> nothing to reverse. Batch item wasn't served -> its
     `quantity_sold` was never incremented -> nothing to reverse.
   - Cancelled **after** deduction (fresh): insert `restock` movements
     (`reference_table='order_item'`, +same quantities). Batch items are only
     ever deducted at serve, so pre-serve cancel is always a no-op for the batch.
   - **Order-level void** (served, e.g. mistaken entry): manager PIN +
     `void_reason`; `status='voided'`, `voided_by/at`. For each non-voided item,
     reverse fresh `sale_out`s with `restock` movements; for batch items served,
     decrement `quantity_sold`. Refund cash via a **negative** `payment`
     (`amount_paid_ugx = -refund`, current session) so the till reconciliation is
     correct on the day the cash leaves.

**D. Periodic stock counts (calibration)**
1. Physically count count-based ingredients at start/end of day; insert
   `stock_counts` (`system_stock`, `actual_stock`).
2. In ONE transaction: insert a `stock_movements` row
   (`adjustment`, quantity = `variance`, `reference_table='stock_count'`) whose
   `balance_after = actual_stock` — this is what makes `current_stock` match
   reality and stays auditable.
3. Watch variance trends to tune `recipe_ingredients` / `modifier_option_ingredients`
   min/max ranges (e.g. matooke running out fast -> bump 3-4 to 4-5).

**E. End of day — till close (corrected, D5)**
1. `expected_cash_ugx = opening_float_ugx`
   `+ SUM(payments.amount_paid_ugx WHERE session_id = session)`   *(refunds deductible as negatives)*
   `- SUM(expenses.amount_ugx WHERE till_session_id = session AND payment_source='till' AND deleted_at IS NULL)`
   `- SUM(market_purchases.total_cost_ugx WHERE till_session_id = session AND payment_source='till')`
   `- SUM(reimbursements.amount_ugx WHERE till_session_id = session)`
2. Cashier counts the drawer into `counted_cash_ugx`; `variance_ugx =
   counted_cash_ugx - expected_cash_ugx`. Three columns are close-time
   snapshots for audit, not live state.
3. Print ingredient levels vs `reorder_level` for the next market run.
4. COGS estimate per dish = `Σ recipe_ingredients.quantity_estimate *
   avg_unit_cost_ugx` + chosen modifier estimate, comparable to
   `menu_items.price_ugx`.

**F. Closing a batch — what didn't sell**
1. Whatever `quantity_remaining` at the end is given away / thrown / staff meal.
2. Insert `production_batch_disposals` rows; set `quantity_disposed`, then
   `status='closed'`, `closed_at`.
3. Nothing touches raw `ingredients.current_stock` — that was settled at cook
   time (B0). This exists to report **sold vs given vs wasted** per batch.
4. Raw ingredients untouched today need no handling — they sit in the ledger.

---

## 6. Worked examples (corrected)

### 6.1 Planned 8, sold 6, 2 disposed (D6-consistent)

```sql
-- Buy 2 bags of chicken; each bag ~4 serving pieces (conversion captured per bag)
INSERT INTO market_purchases (recorded_by, payment_source) VALUES (1, 'till');
INSERT INTO purchase_items
  (purchase_id, ingredient_id, purchase_unit_id, quantity_purchased, unit_price_ugx,
   total_price_ugx, conversion_to_base, quantity_in_base_unit)
VALUES
(2, (SELECT ingredient_id FROM ingredients WHERE name='Chicken'),
    (SELECT unit_id FROM units WHERE name='Bag'), 2, 17000, 34000, 4, 8);

-- Cook all 8 pieces, expecting 8 customers
INSERT INTO production_batches (menu_item_id, prepared_by, quantity_prepared, unit_id)
VALUES ((SELECT menu_item_id FROM menu_items WHERE name='Boiled Chicken'), 3, 8,
        (SELECT unit_id FROM units WHERE name='Piece'));
-- App writes ONE stock_movement per recipe ingredient:
--   ('production_use', -8.0, chicken, balance_after drops 8)          = 8 * 1.0  (D6)
--   ('production_use', -0.4, cooking oil, ...)                        = 8 * 0.05 midpoint
-- production_batches.quantity_remaining = 8

-- Through the day 6 pieces sell (each its own order_item with batch_id = this batch):
-- at serve: quantity_sold += 1 x6  ->  quantity_remaining = 8 - 6 - 0 = 2

-- End of day: dispose the 2 leftovers
INSERT INTO production_batch_disposals (batch_id, disposal_type, quantity, recorded_by, notes) VALUES
((SELECT batch_id FROM production_batches ORDER BY batch_id DESC LIMIT 1), 'given_away', 1, 3, 'gave to a regular customer'),
((SELECT batch_id FROM production_batches ORDER BY batch_id DESC LIMIT 1), 'thrown_away', 1, 3, 'gone cold, not sellable');

UPDATE production_batches
SET quantity_disposed = 2, status = 'closed', closed_at = datetime('now')
WHERE batch_id = (SELECT batch_id FROM production_batches ORDER BY batch_id DESC LIMIT 1);
-- quantity_remaining = 8 - 6 - 2 = 0, closed.
```

Per batch: **8 planned -> 6 sold (75%) -> 1 given -> 1 thrown**, reportable over
time to tighten cooking quantities. Untouched raw chicken stays in the ledger
for tomorrow.

### 6.2 A customer who owes money

```sql
INSERT INTO customers (name, phone) VALUES ('James (boda rider)', '0772xxxxxx');

INSERT INTO customer_orders (order_number, session_id, staff_id, customer_id, subtotal_ugx, total_ugx)
VALUES ('ORD-0042', 1, 2, (SELECT customer_id FROM customers WHERE name='James (boda rider)'), 15000, 15000);

INSERT INTO payments (order_id, session_id, staff_id, amount_paid_ugx, amount_tendered_ugx, change_given_ugx)
VALUES ((SELECT order_id FROM customer_orders WHERE order_number='ORD-0042'), 1, 2, 10000, 10000, 0);
-- trigger: amount_paid_ugx=10000, balance_due_ugx=5000, payment_status='partial'

-- Three days later James clears the balance; cash goes into THAT day's session
INSERT INTO payments (order_id, session_id, staff_id, amount_paid_ugx, amount_tendered_ugx, change_given_ugx, is_debt_settlement)
VALUES ((SELECT order_id FROM customer_orders WHERE order_number='ORD-0042'), 4, 2, 5000, 5000, 0, 1);
-- trigger: payment_status='paid'; the 5,000 counts toward till_session #4, not #1
```

### 6.3 A walk-off

```sql
INSERT INTO customer_orders (order_number, session_id, staff_id, subtotal_ugx, total_ugx)
VALUES ('ORD-0057', 1, 2, 8000, 8000);   -- customer_id NULL; stock deducted normally at serve

UPDATE customer_orders
SET is_written_off = 1,
    write_off_reason = 'left without paying, unknown customer',
    written_off_by = 2,
    written_off_at = datetime('now')
WHERE order_number = 'ORD-0057';
-- balance_due_ugx stays 8000 (that IS the loss); excluded from "collectible debt",
-- included in "bad debt / loss".
```

### 6.4 Expense + reimbursement hitting the till close

```sql
-- Paid wages (till) and a cab ride (owner's pocket) on session #4:
INSERT INTO expenses (till_session_id, created_at, category, description, amount_ugx, payment_source, created_by)
VALUES (4, '2026-09-15 18:00', 'wages', 'Friday wages', 25000, 'till', 1),
       (4, '2026-09-15 18:30', 'transport', 'cab to market', 5000, 'personal', 1);

-- Owner reimburses the cab from the drawer:
INSERT INTO reimbursements (till_session_id, amount_ugx, created_by, note)
VALUES (4, 5000, 1, 'reimburse cab');

-- Session #4 close:
-- expected = opening_float + payments_received - tillExpenses(25000) - tillPurchases - reimbursements(5000)
```

---

## 7. Reports

**Debt (money still expected):**
```sql
SELECT c.name, c.phone, SUM(o.balance_due_ugx) AS owed, MIN(o.created_at) AS oldest, COUNT(*) AS unpaid_orders
FROM customers c
JOIN customer_orders o ON o.customer_id = c.customer_id
WHERE o.balance_due_ugx > 0 AND o.is_written_off = 0 AND o.status <> 'voided'
GROUP BY c.customer_id;
```

**Bad debt / loss:**
```sql
SELECT DATE(o.created_at) AS day, COUNT(*) AS incidents, SUM(o.balance_due_ugx) AS lost_revenue
FROM customer_orders o
WHERE o.is_written_off = 1
GROUP BY DATE(o.created_at) ORDER BY day DESC;
```

**Raw stock levels (next market run):**
```sql
SELECT i.name, i.current_stock, i.reorder_level
FROM ingredients i WHERE i.current_stock <= i.reorder_level ORDER BY i.current_stock ASC;
```

**Daily P&L (per session date):**
```sql
-- revenue = paid(ish) orders' totals; cogs estimate from recipe midpoints;
-- opex = till + personal expenses (personal is "amount owed to owner" until reimbursed)
SELECT
  (SELECT COALESCE(SUM(total_ugx),0) FROM customer_orders
     WHERE DATE(created_at)=DATE('now') AND status <> 'voided')                     AS sales,
  (SELECT COALESCE(SUM(amount_ugx),0) FROM expenses
     WHERE DATE(created_at)=DATE('now') AND payment_source='till' AND deleted_at IS NULL) AS expenses_till,
  (SELECT COALESCE(SUM(amount_ugx),0) FROM expenses
     WHERE DATE(created_at)=DATE('now') AND payment_source='personal' AND deleted_at IS NULL) AS expenses_personal,
  (SELECT COALESCE(SUM(total_cost_ugx),0) FROM market_purchases
     WHERE DATE(purchase_date)=DATE('now') AND payment_source='till')               AS procurement_till,
  (SELECT COALESCE(SUM(amount_ugx),0) FROM reimbursements
     WHERE DATE(created_at)=DATE('now'))                                            AS reimbursed;
```

The P&L layer (D9) matches the existing app's semantics — sales, expenses split
by source, procurement, reimbursements, and "amount owed to owner" =
`SUM(expenses.personal) - SUM(reimbursements)` — so Reports can stay largely as
built, with COGS/waste figures now sourced from the ledger.

---

## 8. Adoption / migration path (current repo)

The repo has 14 migrations on the legacy protein/starch model. This v2 model is
added incrementally, not by resetting:

1. Migration 015: create the v2 tables from §3 **alongside** the legacy tables
   (`units`, `ingredients`, `staff` mapping from `users`, suppliers, market
   purchases, recipes, modifiers, batches, order/stock/expense v2). Keep
   `sales`/`sale_items` untouched for existing history.
2. Migration 016: port the existing owners of money into `staff`
   (admin/cashier roles preserved; `cook` added), copy `expenses`,
   `reimbursements`, `customers` into the v2 shapes (rename/`till_session_id`),
   and rework the debts `payment_allocations` derived-balance behaviour into the
   `payments` trigger + overpay guard.
3. UI/flow rework (Sell -> orders + kitchen status, Inventory -> procurement +
   stock ledger, Menu -> recipes + modifiers) is scoped in a separate
   implementation plan; the current screens keep working off legacy tables
   until each replacement lands, then a cutover migration backfills the ledger
   from legacy `item_purchases`/`purchases`/cook data.

Mapping of concepts:

| Current repo | v2 model |
|---|---|
| `users` (admin/cashier) | `staff` + `cook` role |
| `menu_items` + free `Starches` category | `menu_items` + `recipe_ingredients` + modifier groups |
| `item_purchases` + yield | `market_purchases`/`purchase_items` + `ingredients` (per-bag conversion) |
| `cook_events` + `waste` | `production_batches` + disposals + stock counts |
| `sales`/`sale_items` | `customer_orders`/`order_items` + kitchen status |
| `payments` + `payment_allocations` | `payments` (trigger-derived balance, overpay guard) |
| `expenses` / `reimbursements` | kept (v2 shapes + `till_session_id`) |

---

## 9. Extension points

- **Raw spoilage** (`wastage`) is raw-ingredient loss before cooking; **cooked**
  waste is `production_batch_disposals`. Different failure modes, reported
  separately. Add a reason-code set for spoilage if wanted.
- **Mobile money / card later:** drop `payments.method`'s CHECK constraint and
  treat it as a normal enum.
- **Tax:** not on the v2 tables; it stays a Settings-driven line (as today),
  applied at sell time and snapshotted into `customer_orders.subtotal/total`.
- **Table/seat awareness if ever needed:** add nullable `seat_label` to
  `customer_orders` rather than building a table system.
- **Per-customer aging colors (FR-12d):** days-open and days-since-last-payment
  are derivable from `customer_orders.created_at` + `payments.paid_at`.