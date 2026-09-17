#!/usr/bin/env node
/* Record unpaid sales as debts in the BusinessPOS DB.
   Run with the app CLOSED. Uses the same DB path as seed-initial-data.cjs. */

const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const dbPath = process.env.BUSINESSPOS_DB || path.join(process.env.APPDATA || '', 'businesspos', 'businesspos.sqlite')

if (!fs.existsSync(dbPath)) {
  console.error(`DB not found: ${dbPath}`)
  process.exit(1)
}

const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

// Find an admin user for created_by
const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get()
if (!admin) {
  console.error('No admin user found in DB')
  db.close()
  process.exit(1)
}
const CREATED_BY = admin.id

const resolveCustomer = (name) => {
  if (!name) return null
  const existing = db.prepare('SELECT id FROM customers WHERE name = ?').get(name)
  if (existing) return existing.id
  return Number(db.prepare('INSERT INTO customers (name) VALUES (?)').run(name).lastInsertRowid)
}

// Each debt entry: customer, items [{name, price, qty}], amountPaid
const debts = [
  {
    customer: 'Muzafaru',
    date: '2026-09-15',
    items: [
      { name: 'Chips & Eggs', price: 5000, qty: 2 },
      { name: 'Chips', price: 4000, qty: 1 },
    ],
    paid: 2000,
  },
  {
    customer: 'DJ Brian',
    date: '2026-09-15',
    items: [{ name: 'Rolex', price: 5000, qty: 1 }],
    paid: 0,
  },
  {
    customer: 'DJ Gavacorp',
    date: '2026-09-15',
    items: [
      { name: 'Chapati & Beef Sauce', price: 3000, qty: 1 },
      { name: 'Masala Tea', price: 2000, qty: 1 },
      { name: 'Chicken (Boiled)', price: 7000, qty: 1 },
    ],
    paid: 0,
  },
  {
    customer: 'DJ Gavacorp',
    date: '2026-09-15',
    items: [{ name: 'Chicken (Boiled)', price: 7000, qty: 1 }],
    paid: 0,
  },
  {
    customer: 'Superflow',
    date: '2026-09-15',
    items: [{ name: 'Chicken (Boiled)', price: 7000, qty: 1 }],
    paid: 0,
  },
  {
    customer: 'DJ Brian',
    date: '2026-09-15',
    items: [{ name: 'Chicken & Chips', price: 10000, qty: 1 }],
    paid: 0,
  },
]

const getCustomer = db.prepare('SELECT id FROM customers WHERE name = ?')
const insertCustomer = db.prepare('INSERT INTO customers (name) VALUES (?)')
const resolveCustomerId = (name) => {
  if (!name) return null
  const existing = getCustomer.get(name)
  if (existing) return existing.id
  return Number(insertCustomer.run(name).lastInsertRowid)
}

const insertSale = db.prepare(`
  INSERT INTO sales (customer_id, customer_name, subtotal_cents, discount_cents, discount_reason,
                     debt_cents, payment_method, status, payment_source, total_cents,
                     till_session_id, created_by, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
`)

const insertSaleItem = db.prepare(`
  INSERT INTO sale_items (sale_id, item_id, free_item_id, name_snapshot, unit_price_cents, quantity, line_total_cents)
  VALUES (?, NULL, NULL, ?, ?, ?, ?)
`)

let totalDebt = 0
let saleCount = 0

const run = db.transaction(() => {
  for (const d of debts) {
    const subtotal = d.items.reduce((s, i) => s + i.price * i.qty, 0)
    const total = subtotal // assuming no discount for now
    const debtCents = total - d.paid

    const customerId = resolveCustomerId(d.customer)
    const saleId = Number(insertSale.run(
      customerId,
      d.customer,
      subtotal,
      0,
      null,
      debtCents,
      'debt',
      'unpaid',
      'unpaid',
      total,
      CREATED_BY,
      d.date + ' 12:00:00',
    ).lastInsertRowid)

    for (const item of d.items) {
      insertSaleItem.run(saleId, item.name, item.price, item.qty, item.price * item.qty)
    }

    totalDebt += debtCents
    saleCount += 1
    console.log(`Sale #${saleId}: ${d.customer} — Debt: ${debtCents.toLocaleString()} UGX (${d.items.map(i => i.name).join(', ')})`)
  }
})

run()
db.close()
console.log(`\nTotal debts recorded: ${saleCount} sales, ${totalDebt.toLocaleString()} UGX`)
