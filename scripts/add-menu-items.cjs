#!/usr/bin/env node
/* Add the newly-priced menu items (Fried Plates + Tea tabs) to the live BusinessPOS DB.
   Idempotent: only creates categories/items that don't exist yet. Run with the app CLOSED. */

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

const getCat = db.prepare('SELECT id FROM categories WHERE name = ?')
const insertCat = db.prepare('INSERT INTO categories (name, kind, sort_order, purchase_only) VALUES (?, ?, ?, 0)')
const getItemByName = db.prepare('SELECT id, selling_price_cents FROM menu_items WHERE name = ?')
const insertItem = db.prepare('INSERT INTO menu_items (category_id, name, selling_price_cents, cost_price_cents, purchase_unit, out_of_stock, active) VALUES (?, ?, ?, 0, \'each\', 0, 1)')
const updatePrice = db.prepare('UPDATE menu_items SET selling_price_cents = ? WHERE id = ?')

const categories = [
  { name: 'Fried Plates', kind: 'priced', sort_order: 2 },
  { name: 'Tea', kind: 'priced', sort_order: 3 },
  { name: 'Fish Plates', kind: 'priced', sort_order: 5 },
]

const items = {
  'Fried Plates': [
    ['Deep Fried Chicken', 7000],
    ['Whole Deep Fried Chicken', 32000],
    ['Half Deep Fried Chicken', 16000],
  ],
  Combos: [
    ['Deep Fried Chicken with Fries and a Salad', 10000],
    ['Chips & Sausages', 6000],
    ['Chapati & Tea', 6000],
    ['Single Chapati & Tea', 4000],
    ['Plain Chapati', 2000],
  ],
  Tea: [
    ['African Tea', 5000],
    ['Tea', 2000],
    ['Dawa Tea', 10000],
  ],
  'Fish Plates': [
    ['Deep Fried Fish', 40000],
  ],
}

const run = db.transaction(() => {
  const catIds = {}
  for (const c of categories) {
    let id = getCat.get(c.name)
    if (!id) id = { id: Number(insertCat.run(c.name, c.kind, c.sort_order).lastInsertRowid) }
    catIds[c.name] = id.id
  }

  let created = 0
  for (const [cat, list] of Object.entries(items)) {
    let catId = catIds[cat]
    if (!catId) {
      const existing = getCat.get(cat)
      if (existing) catId = existing.id
    }
    for (const [name, price] of list) {
      const existing = getItemByName.get(name)
      if (existing) {
        if (existing.selling_price_cents !== price) {
          updatePrice.run(price, existing.id)
          console.log(`updated: ${name} -> ${price} UGX`)
        } else {
          console.log(`ok existing: ${name} (${price} UGX)`)
        }
        continue
      }
      insertItem.run(catId, name, price)
      created += 1
      console.log(`created: ${name} (${price} UGX) -> ${cat}`)
    }
  }
  console.log(`menu items created: ${created}`)
})

run()
db.close()
console.log('MENU ADD OK')