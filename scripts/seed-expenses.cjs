#!/usr/bin/env node
/* Append historical expenses to the live BusinessPOS DB.
   Run with the app CLOSED. Re-runnable per date: dates already seeded are skipped. */

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

const anitah = db.prepare("SELECT id FROM users WHERE name = 'Anitah'").get()
if (!anitah) {
  console.error('Refusing: Anitah user not found — main seed has not run.')
  db.close()
  process.exit(1)
}

// date -> [description, category, amount]
const days = {
  '2026-09-12': [
    ['Irish', '1 (Bag)', 10000],
    ['Chicken', '1 (Bird)', 17000],
    ['Beef', '1 (0.5KG)', 10000],
    ['Greenpaper', '1 (Bag)', 1000],
    ['Carrots', '1 (Bag)', 1000],
    ['Transport', 'Transport', 4000],
    ['Matooke', 'Supplies', 2000],
    ['Corriander', 'Supplies', 1000],
    ['Toothpicks', 'Supplies', 4000],
  ],
  '2026-09-13': [
    ['Chicken', '1 bird', 17000],
    ['Tomatoes', '1 Bag', 3000],
    ['Paul (Petty Cash)', 'Other', 5000],
    ['Transport', 'Transport', 2000],
    ['Matooke', 'Supplies', 2000],
    ['Garlic', 'Supplies', 500],
    ['Beef', 'Supplies', 10000],
    ['Chapati Guy (Wage)', 'Salaries', 5000],
    ['Irish', 'Supplies', 5000],
    ['Royco Beef', '2 (sackets)', 400],
    ['Charcoal', '1 (Bag)', 3000],
    ['Cooking Oil', '1 (Ltr)', 9000],
    ['Carrots', '1 (Bag)', 1000],
    ['Greenpaper', '1 (Bag)', 1000],
    ['Goat meat', '.5 KG', 12000],
    ['Transport', 'Transport', 2000],
  ],
  '2026-09-09': [
    ['Gas Cylinder, Cooking Item Delivery', 'Supplies', 6000],
    ['Goat meat', 'Supplies', 24000],
    ['Chicken', 'Supplies', 34000],
    ['Irish Potatoes', 'Supplies', 15000],
    ['Cooking Oil', 'Supplies', 24000],
    ['Tomatoes', 'Supplies', 5000],
    ['Onions', 'Supplies', 5000],
    ['Transport', 'Transport', 2000],
    ['Matooke', 'Supplies', 3000],
  ],
}

const existing = db.prepare('SELECT COUNT(*) c FROM expenses WHERE date = ?')
const insertExpense = db.prepare(`
  INSERT INTO expenses (till_session_id, date, category, description, amount_cents, payment_source, created_by, created_at)
  VALUES (NULL, ?, ?, ?, ?, 'till', ?, datetime('now'))
  `)

const run = db.transaction(() => {
  for (const [day, rows] of Object.entries(days)) {
    const count = existing.get(day).c
    if (count > 0) {
      console.log(`skip ${day}: already has ${count} expense(s)`)
      continue
    }
    for (const [description, cat, amount] of rows) {
      insertExpense.run(day, cat, description, amount, anitah.id)
    }
    console.log(`${day}: inserted ${rows.length} expenses`)
  }
})

run()
db.close()
console.log('EXPENSES OK')