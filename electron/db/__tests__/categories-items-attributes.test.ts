import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migrations/001_initial'
import { runSalesExtrasMigration } from '../migrations/002_sales_extras'
import { runExpensesMigration } from '../migrations/003_expenses_add_date_mpesa'
import { runDebtsMigration } from '../migrations/004_debts_payment_allocations'
import { runReimbursementsMigration } from '../migrations/005_reimbursements_add_columns'
import { runWasteMigration } from '../migrations/006_waste_table'
import { runCategoriesMigration } from '../migrations/007_categories'
import { runMenuSeedMigration } from '../migrations/009_menu_seed'
import { runPurchaseYieldMigration } from '../migrations/010_purchase_yield'
import { runUserRolesMigration } from '../migrations/013_user_roles'
import { runPerLineCaptainMigration } from '../migrations/026_per_line_captain'
import { runKitchenStatusMigration } from '../migrations/029_kitchen_status'

let db: Database.Database

vi.mock('../index', () => ({
  getDb: () => db,
}))

import { categoriesRepo } from '../repositories/categoriesRepo'
import { itemsRepo } from '../repositories/itemsRepo'
import { attributesRepo } from '../repositories/attributesRepo'
import { usersRepo } from '../repositories/usersRepo'
import { salesRepo } from '../repositories/salesRepo'

describe('Categories / items / attributes repos', () => {
  let ownerCat: { id: number; kind: string }
  let sideCat: { id: number; kind: string }
  let goat: { id: number }
  let banana: { id: number }
  let userId: number

  beforeAll(() => {
    db = new Database(':memory:')
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    runSalesExtrasMigration(db)
    runExpensesMigration(db)
    runDebtsMigration(db)
    runReimbursementsMigration(db)
    runWasteMigration(db)
    runCategoriesMigration(db)
    runMenuSeedMigration(db)
    runPurchaseYieldMigration(db)
    runUserRolesMigration(db)
    runPerLineCaptainMigration(db)
    runKitchenStatusMigration(db)

    const user = usersRepo.create('Test Owner', 'admin', '1234')
    userId = user.id as number

    ownerCat = categoriesRepo.upsert({ name: 'Test Mains', kind: 'priced', sort_order: 0 })
    sideCat = categoriesRepo.upsert({ name: 'Test AddOns', kind: 'free', sort_order: 1 })

    goat = itemsRepo.upsert({ category_id: ownerCat.id, name: 'Goat Meat', selling_price_cents: 10000, cost_price_cents: 6000 })
    banana = itemsRepo.upsert({ category_id: sideCat.id, name: 'Banana' })
  })

  afterAll(() => {
    db.close()
  })

  test('categories: upsert inserts and updates', () => {
    const created = categoriesRepo.upsert({ name: 'Temp Cat', kind: 'priced', sort_order: 5 })
    expect(created.id).toBeGreaterThan(0)
    const updated = categoriesRepo.upsert({ id: created.id, name: 'Temp Cat Renamed', kind: 'free', sort_order: 6 })
    expect(updated.name).toBe('Temp Cat Renamed')
    expect(updated.kind).toBe('free')
    expect(updated.sort_order).toBe(6)
    categoriesRepo.del(created.id)
  })

  test('categories: duplicate name throws', () => {
    categoriesRepo.upsert({ name: 'Dup Cat', kind: 'priced', sort_order: 9 })
    expect(() => categoriesRepo.upsert({ name: 'Dup Cat', kind: 'free', sort_order: 10 })).toThrow('A category with this name already exists')
    const dup = db.prepare("SELECT id FROM categories WHERE name = 'Dup Cat'").all()
    expect(dup).toHaveLength(1)
    const dupCat = categoriesRepo.list().find((c: any) => c.name === 'Dup Cat') as any
    categoriesRepo.del(dupCat.id)
  })

  test('categories: del hard-deletes empty category, soft-deactivates one with items', () => {
    const empty = categoriesRepo.upsert({ name: 'Empty Cat', kind: 'priced', sort_order: 7 })
    categoriesRepo.del(empty.id)
    expect(categoriesRepo.list().find((c: any) => c.id === empty.id)).toBeUndefined()

    categoriesRepo.del(sideCat.id)
    const deactivated = categoriesRepo.list().find((c: any) => c.id === sideCat.id)
    expect(deactivated).toBeDefined()
    expect(deactivated!.active).toBe(0)
    categoriesRepo.upsert({ id: sideCat.id, name: 'Test AddOns', kind: 'free', sort_order: 1, active: 1 })
  })

  test('items: upsert stores price in priced category, zero price in free category', () => {
    const priced = itemsRepo.getById(goat.id)
    expect(priced!.selling_price_cents).toBe(10000)
    expect(priced!.cost_price_cents).toBe(6000)
    expect(priced!.category_kind).toBe('priced')
    const free = itemsRepo.getById(banana.id)
    expect(free!.selling_price_cents).toBe(0)
    expect(free!.category_kind).toBe('free')
  })

  test('items: listByKind filters by kind and active state', () => {
    const freeActive = itemsRepo.listByKind('free', true)
    expect(freeActive.length).toBeGreaterThan(0)
    expect(freeActive.every((i: any) => i.category_kind === 'free' && i.active === 1)).toBe(true)
    const inactive = freeActive.filter((i: any) => i.id === banana.id)
    expect(inactive).toHaveLength(1)
  })

  test('items: del hard-deletes unused item', () => {
    const unused = itemsRepo.upsert({ category_id: ownerCat.id, name: 'Unused Item', selling_price_cents: 500, cost_price_cents: 100 })
    itemsRepo.del(unused.id)
    expect(itemsRepo.getById(unused.id)).toBeUndefined()
    expect(itemsRepo.listAll().find((i: any) => i.id === unused.id)).toBeUndefined()
  })

  test('items: del soft-deactivates item referenced by sale_items', () => {
    const saleId = salesRepo.create({
      subtotal_cents: 10000,
      discount_cents: 0,
      total_cents: 10000,
      debt_cents: 0,
      payment_method: 'cash',
      created_by: userId,
      items: [{ item_id: goat.id, price_cents: 10000 }],
    })
    expect(saleId).toBeGreaterThan(0)
    db.prepare("UPDATE sales SET created_at = ? WHERE id = ?").run(new Date().toISOString().slice(0, 10) + ' 09:00:00', saleId)

    itemsRepo.del(goat.id)
    expect(itemsRepo.getById(goat.id)).toBeDefined()
    expect(itemsRepo.listActive().find((i: any) => i.id === goat.id)).toBeUndefined()
    const all = itemsRepo.listAll().find((i: any) => i.id === goat.id)
    expect(all).toBeDefined()
    expect(all!.active).toBe(0)
    itemsRepo.upsert({ id: goat.id, category_id: ownerCat.id, name: 'Goat Meat', selling_price_cents: 10000, cost_price_cents: 6000, active: 1 })
  })

  test('attributes: global-scope upsert, saveValues upserts without duplication, del clears values', () => {
    const def = attributesRepo.upsert({ category_id: null, name: 'Size', type: 'text', sort_order: 0 })
    expect(def.id).toBeGreaterThan(0)

    attributesRepo.saveValues(goat.id, [{ attr_def_id: def.id, value_text: 'Large' }])
    attributesRepo.saveValues(goat.id, [{ attr_def_id: def.id, value_text: 'Extra Large' }])
    const values = attributesRepo.getValuesForItem(goat.id)
    const sizeValues = values.filter((v: any) => v.attr_def_id === def.id)
    expect(sizeValues).toHaveLength(1)
    expect(sizeValues[0].value_text).toBe('Extra Large')

    const cats = attributesRepo.list(undefined)
    expect(cats.find((a: any) => a.id === def.id)).toBeDefined()

    attributesRepo.del(def.id)
    expect(attributesRepo.list(undefined).find((a: any) => a.id === def.id)).toBeUndefined()
    expect(attributesRepo.getValuesForItem(goat.id).filter((v: any) => v.attr_def_id === def.id)).toHaveLength(0)
  })

  test('attributes: value type mismatch throws', () => {
    const numDef = attributesRepo.upsert({ category_id: ownerCat.id, name: 'Quantity', type: 'number', sort_order: 1 })
    expect(() => attributesRepo.saveValues(goat.id, [{ attr_def_id: numDef.id, value_number: 3 }])).not.toThrow()
    expect(() => attributesRepo.saveValues(goat.id, [{ attr_def_id: numDef.id, value_text: 'three' }])).toThrow('Value type mismatch for attribute Quantity')
    attributesRepo.del(numDef.id)
  })
})