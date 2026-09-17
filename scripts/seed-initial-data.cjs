#!/usr/bin/env node
/* One-shot seed of the live BusinessPOS DB (10-13/09 sales + 15/09 expenses).
   Run with the app CLOSED. Idempotency guard: refuses to run if a seed already happened. */

const Database = require('better-sqlite3')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const dbPath = process.env.BUSINESSPOS_DB || path.join(process.env.APPDATA || '', 'businesspos', 'businesspos.sqlite')

if (!fs.existsSync(dbPath)) {
  console.error(`DB not found: ${dbPath}`)
  process.exit(1)
}

const hashPin = (pin) => crypto.createHash('sha256').update(pin).digest('hex')

const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

const guard = db.prepare("SELECT COUNT(*) as c FROM settings WHERE key = 'setup_complete' AND value = '1'").get()
if (guard.c > 0) {
  console.error('Refusing: setup_complete is already set — this DB looks seeded already.')
  db.close()
  process.exit(1)
}

db.pragma('wal_checkpoint(TRUNCATE)')
db.close()

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupDir = path.join(path.dirname(dbPath), `backup-${stamp}`)
fs.mkdirSync(backupDir, { recursive: true })
for (const f of fs.readdirSync(path.dirname(dbPath))) {
  if (/^businesspos\.sqlite(-wal|-shm)?$/.test(f)) {
    fs.copyFileSync(path.join(path.dirname(dbPath), f), path.join(backupDir, f))
  }
}

const db2 = new Database(dbPath)
db2.pragma('foreign_keys = ON')

const run = db2.transaction(() => {
  const insertSetting = db2.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  const insertUser = db2.prepare('INSERT INTO users (name, role, pin_hash) VALUES (?, ?, ?)')

  insertSetting.run('business_name', 'Club 17 Bar & Restaurant')
  insertSetting.run('phone', '0768869308')
  insertSetting.run('address', 'Kayebe, Gayaza')
  insertSetting.run('currency', 'UGX')
  insertSetting.run('tax_enabled', 'false')
  insertSetting.run('tax_rate', '0')
  insertSetting.run('setup_complete', '1')

  const admin = Number(insertUser.run('Admin', 'admin', hashPin('1234')).lastInsertRowid)
  const anitah = Number(insertUser.run('Anitah', 'cashier', hashPin('1234')).lastInsertRowid)
  const paul = Number(insertUser.run('Paul', 'cashier', hashPin('1234')).lastInsertRowid)
  console.log(`users: Admin#${admin}, Anitah#${anitah}, Paul#${paul}`)

  const getCustomer = db2.prepare('SELECT id FROM customers WHERE name = ?')
  const insertCustomer = db2.prepare('INSERT INTO customers (name) VALUES (?)')
  const resolveCustomer = (name) => {
    if (!name) return null
    const existing = getCustomer.get(name)
    if (existing) return existing.id
    return Number(insertCustomer.run(name).lastInsertRowid)
  }

  const insertSale = db2.prepare(`
    INSERT INTO sales (customer_id, customer_name, subtotal_cents, discount_cents, discount_reason,
                       debt_cents, payment_method, status, payment_source, total_cents, till_session_id, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `)
  const insertSaleItem = db2.prepare(`
    INSERT INTO sale_items (sale_id, item_id, free_item_id, name_snapshot, unit_price_cents, quantity, line_total_cents)
    VALUES (?, NULL, NULL, ?, ?, ?, ?)
  `)

  const mkTime = (date, i) => `${date} ${String(10 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}:00`

  let saleCount = 0
  let debtCentsTotal = 0

  const addSale = (date, i, name, qty, unitCents, opts = {}) => {
    const std = opts.stdCents ?? unitCents
    const discount = Math.max(0, std * qty - unitCents * qty)
    const subtotal = std * qty
    const total = unitCents * qty
    const isDebt = !!opts.customerNote || opts.debt
    const status = isDebt ? 'unpaid' : 'completed'
    const paymentMethod = isDebt ? 'debt' : 'cash'
    const paymentSource = isDebt ? 'unpaid' : 'cash'
    const customerId = resolveCustomer(opts.customer)
    const saleId = Number(insertSale.run(
      customerId, opts.customer ?? null,
      subtotal, discount, discount > 0 ? 'Discounted' : null,
      isDebt ? total : 0,
      paymentMethod, status, paymentSource, total, anitah, mkTime(date, i)
    ).lastInsertRowid)
    insertSaleItem.run(saleId, name, std, qty, subtotal)
    saleCount += 1
    if (isDebt) debtCentsTotal += total
  }

  let i = 0

  // 10/09/2026 — all paid
  for (let k = 0; k < 4; k++) addSale('2026-09-10', i++, 'Boiled Chicken', 1, 10000)
  addSale('2026-09-10', i++, 'Chips & Salad', 1, 2000)
  addSale('2026-09-10', i++, 'Chips & Egss (2 Eggs)', 1, 5000)

  // 11/09/2026
  addSale('2026-09-11', i++, 'Boiled Chicken', 1, 10000)
  addSale('2026-09-11', i++, 'Boiled Chicken', 1, 10000)
  addSale('2026-09-11', i++, 'Boiled Chicken', 1, 10000)
  addSale('2026-09-11', i++, 'Chips & Eggs', 1, 4000, { stdCents: 5000 })
  addSale('2026-09-11', i++, 'Boiled Chicken', 1, 10000)
  addSale('2026-09-11', i++, 'Chips & Eggs', 1, 4000)
  addSale('2026-09-11', i++, 'Boiled Chicken', 1, 10000)
  addSale('2026-09-11', i++, 'Chips & Eggs', 1, 5000)
  addSale('2026-09-11', i++, 'Beef & Chapati', 1, 3000)
  addSale('2026-09-11', i++, 'Chips & Eggs', 1, 5000, { customer: 'DJ Bria', debt: true })
  addSale('2026-09-11', i++, 'Chapati & Beef', 1, 3000)
  addSale('2026-09-11', i++, 'Boiled Chicken', 1, 10000, { customer: 'Superflow', debt: true })
  addSale('2026-09-11', i++, 'Boiled Goat', 1, 10000, { debt: true })

  // 12/09/2026
  addSale('2026-09-12', i++, 'Boiled Chicken', 1, 10000)
  addSale('2026-09-12', i++, 'Boiled Chicken', 1, 10000)
  addSale('2026-09-12', i++, 'Boiled Chicken', 1, 10000)
  addSale('2026-09-12', i++, 'Boiled Goat', 1, 10000, { customer: 'Unknown Customer Male', debt: true })
  addSale('2026-09-12', i++, 'Chapati & Beef', 1, 5000)
  addSale('2026-09-12', i++, 'Chapati & Beef', 1, 5000)
  addSale('2026-09-12', i++, 'Chips & Eggs', 1, 5000)
  addSale('2026-09-12', i++, 'Chapati & Tea', 1, 3000)
  addSale('2026-09-12', i++, 'Plain Chips', 1, 3000)
  addSale('2026-09-12', i++, 'Plain Chips', 1, 1000, { stdCents: 3000 })
  addSale('2026-09-12', i++, 'Boiled Chicken', 1, 10000)
  addSale('2026-09-12', i++, 'Boiled Goat', 1, 10000)
  addSale('2026-09-12', i++, 'Boiled Goat', 1, 5000, { stdCents: 10000 })

  // 13/09/2026
  for (let k = 0; k < 4; k++) addSale('2026-09-13', i++, 'Boiled Chicken', 1, 10000)
  addSale('2026-09-13', i++, 'Chapati & Beef', 1, 5000)
  addSale('2026-09-13', i++, 'Chapati & Beef', 2, 4000, { stdCents: 5000, customer: 'DJ Gavacorp', debt: true })
  addSale('2026-09-13', i++, 'Chapati & Beef', 1, 5000, { customer: 'Superflow', debt: true })
  addSale('2026-09-13', i++, 'Boiled Goat', 1, 10000)
  addSale('2026-09-13', i++, 'Boiled Chicken', 1, 10000)
  addSale('2026-09-13', i++, 'Plain Chapati', 2, 4000, { customer: 'Ben', debt: true })
  addSale('2026-09-13', i++, 'Plain Chips', 1, 4000)
  addSale('2026-09-13', i++, 'Sausages', 1, 4000)

  // 14/09/2026 expenses (payment_source till, created_by Anitah)
  const insertExpense = db2.prepare(`
    INSERT INTO expenses (till_session_id, date, category, description, amount_cents, payment_source, created_by, created_at)
    VALUES (NULL, ?, ?, ?, ?, 'till', ?, datetime('now'))
  `)
  const expenses = [
    ['Chicken', '2 Birds', 34000],
    ['Beef', '0.5KG', 10000],
    ['Matooke', '1 bag', 3000],
    ['Onions', '1 bag', 3000],
    ['Tomatoes', '1 bag', 3000],
    ['Irish', '1 bag', 10000],
    ['Carrots', '1 bag', 1000],
    ['Green pepper', '1 bag', 1000],
    ['Wheat Flour', '1 Bag (2KG)', 10000],
    ['Chapati Man (Wage)', 'Wage', 5000],
    ['Transport', 'Transport', 6000],
    ['Goat Meat', 'Goat meat', 12000],
    ['Transport', 'Transport', 2000],
  ]
  for (const [description, cat, amount] of expenses) {
    const c = cat === 'Wage' ? 'Salaries' : cat === 'Transport' ? 'Transport' : 'Supplies'
    insertExpense.run('2026-09-14', c, description, amount, anitah)
  }

  console.log(`sales inserted: ${saleCount}`)
  console.log(`unpaid debt total: ${debtCentsTotal} UGX`)
  console.log(`expenses inserted: ${expenses.length}`)
})

run()
db2.close()
console.log(`SEED OK — backup at ${backupDir}`)