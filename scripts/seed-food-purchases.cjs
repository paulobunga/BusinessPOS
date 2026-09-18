#!/usr/bin/env node
/* Reclassify food-buy expenses in the live BusinessPOS DB into the Inventory purchase model.
   - Creates a 'Stock' (purchase_only) category + raw input items if missing.
   - For each historical food expense: deletes the expense row and inserts an item_purchase.
   - Purchases carry total_yield (servings produced) which feeds the item_stock_movements
     ledger, and meal links are stored as recipes (item_yield_defaults) while meal
     cost_price_cents is set from cost-per-portion, so Item Performance deducts real cost.
   Idempotent + guarded. Run with the app CLOSED. */

const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const dbPath = process.env.BUSINESSPOS_DB || path.join(process.env.APPDATA || '', 'businesspos', 'businesspos.sqlite')

if (!fs.existsSync(dbPath)) {
  console.error(`DB not found: ${dbPath}`)
  process.exit(1)
}

const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

// --- raw inputs to ensure exist (matches InventoryPage's auto-created 'Stock' category) ---
const RAW_ITEMS = [
  ['Whole Chicken', 'bird'],
  ['Goat Meat', 'kg'],
  ['Beef', 'kg'],
  ['Fish', 'fish'],
  ['Irish', 'bag'],
  ['Cooking Oil', 'ltr'],
  ['Matooke', 'bunch'],
  ['Wheat Flour', 'kg'],
  ['Tomatoes', 'bag'],
  ['Onions', 'bag'],
  ['Carrots', 'bag'],
  ['Green pepper', 'bag'],
  ['Corriander', 'bunch'],
  ['Garlic', 'pack'],
  ['Royco', 'packet'],
]

// Expense (by date + description + amount) -> purchase to create in its place.
// yields: [mealName, portions]
const MOVES = [
  { date: '2026-09-09', desc: 'Goat meat', amount: 24000, raw: 'Goat Meat', unit: 'kg', qty: 1.0, cost: 24000, yields: [['Boiled Goat', 8]] },
  { date: '2026-09-09', desc: 'Chicken', amount: 34000, raw: 'Whole Chicken', unit: 'bird', qty: 2.0, cost: 34000, yields: [['Boiled Chicken', 8]] },
  { date: '2026-09-09', desc: 'Irish Potatoes', amount: 15000, raw: 'Irish', unit: 'bag', qty: 1.0, cost: 15000, yields: [] },
  { date: '2026-09-09', desc: 'Cooking Oil', amount: 24000, raw: 'Cooking Oil', unit: 'ltr', qty: 1.0, cost: 24000, yields: [] },
  { date: '2026-09-09', desc: 'Tomatoes', amount: 5000, raw: 'Tomatoes', unit: 'bag', qty: 1.0, cost: 5000, yields: [] },
  { date: '2026-09-09', desc: 'Onions', amount: 5000, raw: 'Onions', unit: 'bag', qty: 1.0, cost: 5000, yields: [] },
  { date: '2026-09-09', desc: 'Matooke', amount: 3000, raw: 'Matooke', unit: 'bunch', qty: 1.0, cost: 3000, yields: [] },

  { date: '2026-09-12', desc: 'Irish', amount: 10000, raw: 'Irish', unit: 'bag', qty: 1.0, cost: 10000, yields: [] },
  { date: '2026-09-12', desc: 'Chicken', amount: 17000, raw: 'Whole Chicken', unit: 'bird', qty: 1.0, cost: 17000, yields: [['Boiled Chicken', 4]] },
  { date: '2026-09-12', desc: 'Beef', amount: 10000, raw: 'Beef', unit: 'kg', qty: 0.5, cost: 10000, yields: [['Chapati & Beef', 5]] },
  { date: '2026-09-12', desc: 'Greenpaper', amount: 1000, raw: 'Green pepper', unit: 'bag', qty: 1.0, cost: 1000, yields: [] },
  { date: '2026-09-12', desc: 'Carrots', amount: 1000, raw: 'Carrots', unit: 'bag', qty: 1.0, cost: 1000, yields: [] },
  { date: '2026-09-12', desc: 'Matooke', amount: 2000, raw: 'Matooke', unit: 'bunch', qty: 1.0, cost: 2000, yields: [] },
  { date: '2026-09-12', desc: 'Corriander', amount: 1000, raw: 'Corriander', unit: 'bunch', qty: 1.0, cost: 1000, yields: [] },

  { date: '2026-09-13', desc: 'Chicken', amount: 17000, raw: 'Whole Chicken', unit: 'bird', qty: 1.0, cost: 17000, yields: [['Boiled Chicken', 4]] },
  { date: '2026-09-13', desc: 'Tomatoes', amount: 3000, raw: 'Tomatoes', unit: 'bag', qty: 1.0, cost: 3000, yields: [] },
  { date: '2026-09-13', desc: 'Matooke', amount: 2000, raw: 'Matooke', unit: 'bunch', qty: 1.0, cost: 2000, yields: [] },
  { date: '2026-09-13', desc: 'Garlic', amount: 500, raw: 'Garlic', unit: 'pack', qty: 1.0, cost: 500, yields: [] },
  { date: '2026-09-13', desc: 'Beef', amount: 10000, raw: 'Beef', unit: 'kg', qty: 0.5, cost: 10000, yields: [['Chapati & Beef', 5]] },
  { date: '2026-09-13', desc: 'Irish', amount: 5000, raw: 'Irish', unit: 'bag', qty: 1.0, cost: 5000, yields: [] },
  { date: '2026-09-13', desc: 'Royco Beef', amount: 400, raw: 'Royco', unit: 'packet', qty: 1.0, cost: 400, yields: [] },
  { date: '2026-09-13', desc: 'Cooking Oil', amount: 9000, raw: 'Cooking Oil', unit: 'ltr', qty: 1.0, cost: 9000, yields: [] },
  { date: '2026-09-13', desc: 'Carrots', amount: 1000, raw: 'Carrots', unit: 'bag', qty: 1.0, cost: 1000, yields: [] },
  { date: '2026-09-13', desc: 'Greenpaper', amount: 1000, raw: 'Green pepper', unit: 'bag', qty: 1.0, cost: 1000, yields: [] },
  { date: '2026-09-13', desc: 'Goat meat', amount: 12000, raw: 'Goat Meat', unit: 'kg', qty: 0.5, cost: 12000, yields: [['Boiled Goat', 4]] },

  { date: '2026-09-14', desc: 'Chicken', amount: 34000, raw: 'Whole Chicken', unit: 'bird', qty: 2.0, cost: 34000, yields: [['Boiled Chicken', 8]] },
  { date: '2026-09-14', desc: 'Beef', amount: 10000, raw: 'Beef', unit: 'kg', qty: 0.5, cost: 10000, yields: [['Chapati & Beef', 5]] },
  { date: '2026-09-14', desc: 'Matooke', amount: 3000, raw: 'Matooke', unit: 'bunch', qty: 1.0, cost: 3000, yields: [] },
  { date: '2026-09-14', desc: 'Onions', amount: 3000, raw: 'Onions', unit: 'bag', qty: 1.0, cost: 3000, yields: [] },
  { date: '2026-09-14', desc: 'Tomatoes', amount: 3000, raw: 'Tomatoes', unit: 'bag', qty: 1.0, cost: 3000, yields: [] },
  { date: '2026-09-14', desc: 'Irish', amount: 10000, raw: 'Irish', unit: 'bag', qty: 1.0, cost: 10000, yields: [] },
  { date: '2026-09-14', desc: 'Carrots', amount: 1000, raw: 'Carrots', unit: 'bag', qty: 1.0, cost: 1000, yields: [] },
  { date: '2026-09-14', desc: 'Green pepper', amount: 1000, raw: 'Green pepper', unit: 'bag', qty: 1.0, cost: 1000, yields: [] },
  { date: '2026-09-14', desc: 'Wheat Flour (Supreme Flour)', amount: 10000, raw: 'Wheat Flour', unit: 'kg', qty: 1.0, cost: 10000, yields: [] },
  { date: '2026-09-14', desc: 'Goat Meat', amount: 12000, raw: 'Goat Meat', unit: 'kg', qty: 0.5, cost: 12000, yields: [['Boiled Goat', 4]] },
]

const sumOrig = db.prepare('SELECT COALESCE(SUM(amount_cents),0) t FROM expenses WHERE date IN (?,?,?,?)').get('2026-09-09','2026-09-12','2026-09-13','2026-09-14').t

const run = db.transaction(() => {
  // 1. Stock category
  let stockCat = db.prepare('SELECT id FROM categories WHERE purchase_only = 1').get()
  if (!stockCat) {
    stockCat = db.prepare("INSERT INTO categories (name, kind, sort_order, purchase_only) VALUES ('Stock','priced',4,1)").run()
    stockCat = { id: Number(stockCat.lastInsertRowid) }
    console.log('created category: Stock (purchase_only)')
  }

  // 2. Raw input items
  const getItem = db.prepare('SELECT id FROM menu_items WHERE name = ?')
  const insertItem = db.prepare("INSERT INTO menu_items (category_id, name, selling_price_cents, cost_price_cents, purchase_unit, out_of_stock, active) VALUES (?, ?, 0, 0, ?, 0, 1)")
  const rawIds = {}
  for (const [name, unit] of RAW_ITEMS) {
    let item = getItem.get(name)
    if (!item) {
      item = { id: Number(insertItem.run(stockCat.id, name, unit).lastInsertRowid) }
      console.log(`created raw input: ${name}`)
    }
    rawIds[name] = item.id
  }

  // 3. Reclassify: expense -> item_purchase (+ yields)
  const getMeal = db.prepare('SELECT id FROM menu_items WHERE name = ?')
  const getExpense = db.prepare('SELECT id FROM expenses WHERE date = ? AND description = ? AND amount_cents = ? ORDER BY id LIMIT 1')
  const delExpense = db.prepare('DELETE FROM expenses WHERE id = ?')
  const purchaseExists = db.prepare('SELECT id FROM item_purchases WHERE item_id = ? AND purchase_date = ? AND cost_cents = ? ORDER BY id LIMIT 1')
  const insertPurchase = db.prepare(`INSERT INTO item_purchases (item_id, purchase_date, quantity_kg, cost_cents, total_yield, created_by, unit) VALUES (?, ?, ?, ?, ?, ?, ?)`)
  const insertMovement = db.prepare(`INSERT INTO item_stock_movements (item_id, movement_type, quantity, reference_table, reference_id, created_by) VALUES (?, 'purchase_in', ?, 'item_purchases', ?, ?)`)
  const linkRecipe = db.prepare(`INSERT OR IGNORE INTO item_yield_defaults (raw_input_id, meal_id, portions) VALUES (?, ?, ?)`)
  const setRawCost = db.prepare('UPDATE menu_items SET cost_price_cents = ? WHERE id = ?')
  const setMealCost = db.prepare('UPDATE menu_items SET cost_price_cents = ? WHERE id = ?')
  const anitah = db.prepare("SELECT id FROM users WHERE name = 'Anitah'").get().id

  let created = 0
  let skipped = 0
  for (const m of MOVES) {
    const exp = getExpense.get(m.date, m.desc, m.amount)
    const rawId = rawIds[m.raw]
    const existing = purchaseExists.get(rawId, m.date, m.cost)

    if (existing) {
      if (exp) { console.log(`WARN: expense ${m.date} ${m.desc} ${m.amount} still present but purchase exists; deleting expense`); delExpense.run(exp.id) }
      skipped += 1
      continue
    }
    if (!exp) {
      console.log(`skip ${m.date} ${m.desc}: no matching expense to reclassify`)
      skipped += 1
      continue
    }

    const totalPortions = m.yields.reduce((s, [, p]) => s + p, 0)
    const totalYield = totalPortions > 0 ? totalPortions : Math.max(1, Math.round(m.qty))
    const res = insertPurchase.run(rawId, m.date, m.qty, m.cost, totalYield, anitah, m.unit)
    insertMovement.run(rawId, totalYield, res.lastInsertRowid, anitah)

    setRawCost.run(Math.round(m.cost / m.qty), rawId)
    if (m.yields.length > 0) {
      const costPerPortion = Math.round(m.cost / totalPortions)
      for (const [mealName, portions] of m.yields) {
        const mealId = getMeal.get(mealName).id
        linkRecipe.run(rawId, mealId, portions)
        setMealCost.run(costPerPortion, mealId)
      }
    }
    delExpense.run(exp.id)
    created += 1
    console.log(`moved ${m.date} ${m.desc} ${m.amount} -> purchase ${m.raw}${m.yields.length ? ` (${m.yields.map(([n, p]) => `${n} x${p}`).join(', ')})` : ''}`)
  }
  console.log(`purchases created: ${created}, skipped: ${skipped}`)
})

run()

const foodTot = db.prepare("SELECT COALESCE(SUM(cost_cents),0) t FROM item_purchases WHERE purchase_date IN ('2026-09-09','2026-09-12','2026-09-13','2026-09-14')").get().t
const expenseTot = db.prepare('SELECT COALESCE(SUM(amount_cents),0) t FROM expenses').get().t
const completeTot = db.prepare('SELECT COALESCE(SUM(amount_cents),0) t FROM expenses WHERE date IN (?,?,?,?)').get('2026-09-09','2026-09-12','2026-09-13','2026-09-14').t

console.log(`food purchases total (4 days): ${foodTot}`)
console.log(`original expenses total (4 days): ${sumOrig}`)
console.log(`remaining expenses total (4 days): ${completeTot}`)
console.log(`reclassified = original - remaining: ${sumOrig - completeTot}`)

const costs = db.prepare("SELECT name, cost_price_cents FROM menu_items WHERE name IN ('Boiled Chicken','Boiled Goat','Chapati & Beef') ORDER BY id").all()
for (const c of costs) console.log(`meal cost: ${c.name} = ${c.cost_price_cents}`)

db.close()
console.log('RECLASSIFY OK')