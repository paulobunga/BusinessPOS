#!/usr/bin/env node
/* Derive a menu from the historical sales in the live BusinessPOS DB.
   Idempotent: only creates menu items that don't exist yet; links matching sale_items. */

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
const getItemByName = db.prepare('SELECT id FROM menu_items WHERE name = ?')
const insertItem = db.prepare('INSERT INTO menu_items (category_id, name, selling_price_cents, cost_price_cents, purchase_unit, out_of_stock, active) VALUES (?, ?, ?, 0, \'each\', 0, 1)')

const categories = [
  { name: 'Boiled Plates', kind: 'priced', sort_order: 0 },
  { name: 'Combos', kind: 'priced', sort_order: 1 },
]

const items = {
  'Boiled Plates': [
    ['Boiled Chicken', 10000],
    ['Boiled Goat', 10000],
  ],
  Combos: [
    ['Chapati & Beef', 5000],
    ['Beef & Chapati', 3000],
    ['Chips & Eggs', 5000],
    ['Chips & Egss (2 Eggs)', 5000],
    ['Chips & Salad', 2000],
    ['Chapati & Tea', 3000],
    ['Plain Chips', 3000],
    ['Plain Chapati', 4000],
    ['Sausages', 4000],
  ],
}

const link = db.prepare('UPDATE sale_items SET item_id = ? WHERE name_snapshot = ? AND item_id IS NULL')

const run = db.transaction(() => {
  const catIds = {}
  for (const c of categories) {
    let id = getCat.get(c.name)
    if (!id) id = { id: Number(insertCat.run(c.name, c.kind, c.sort_order).lastInsertRowid) }
    catIds[c.name] = id.id
  }

  let created = 0
  for (const [cat, list] of Object.entries(items)) {
    for (const [name, price] of list) {
      let item = getItemByName.get(name)
      if (!item) {
        item = { id: Number(insertItem.run(catIds[cat], name, price).lastInsertRowid) }
        created += 1
      }
      const res = link.run(item.id, name)
      if (res.changes > 0) console.log(`linked sale_items -> ${name}`)
    }
  }
  console.log(`menu items created: ${created}`)
})

run()
db.close()
console.log('MENU OK')