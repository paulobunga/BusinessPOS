import { getDb } from '../index.js'
import { settingsRepo } from './settingsRepo.js'
import { usersRepo } from './usersRepo.js'
import { categoriesRepo } from './categoriesRepo.js'
import type { SetupPayload } from '../../../shared/types'

export const setupRepo = {
  save(payload: SetupPayload): { userId: number } {
    if (!payload.businessName.trim()) throw new Error('Business name is required')
    if (!payload.managerName.trim()) throw new Error('Manager name is required')
    if (!/^\d{4}$/.test(payload.managerPin)) throw new Error('PIN must be 4 digits')
    if (payload.rawInputs.length === 0) throw new Error('Add at least one raw input')
    if (payload.meals.length === 0) throw new Error('Add at least one meal')

    const db = getDb()
    const userId = db.transaction(() => {
      settingsRepo.setMany({
        business_name: payload.businessName.trim(),
        phone: payload.phone.trim(),
        address: payload.address.trim(),
        currency: 'UGX',
      })

      const manager = usersRepo.create(payload.managerName.trim(), 'admin', payload.managerPin)

      const rawCat = categoriesRepo.upsert({ name: 'Raw Inputs', kind: 'priced', sort_order: 0, purchase_only: 1 })
      const rawByName = new Map<string, number>()
      const insertRaw = db.prepare(
        'INSERT INTO menu_items (category_id, name, selling_price_cents, cost_price_cents, purchase_unit, active) VALUES (?, ?, 0, ?, ?, 1)'
      )
      for (const r of payload.rawInputs) {
        const name = r.name.trim()
        if (!name || rawByName.has(name)) continue
        const info = insertRaw.run(rawCat.id, name, r.costPerUnit, r.unit.trim().toLowerCase() || 'kg')
        rawByName.set(name, Number(info.lastInsertRowid))
      }

      const mealCatByName = new Map<string, number>()
      let sortOrder = 1
      const insertMeal = db.prepare(
        'INSERT INTO menu_items (category_id, name, selling_price_cents, cost_price_cents, purchase_unit, active) VALUES (?, ?, ?, ?, ?, 1)'
      )
      const yieldRows: Array<{ rawInputId: number; mealId: number; portions: number }> = []
      for (const m of payload.meals) {
        const name = m.name.trim()
        if (!name) continue
        const catName = m.category.trim().length > 0 ? m.category.trim() : 'Meals'
        let catId = mealCatByName.get(catName)
        if (catId == null) {
          const c = categoriesRepo.upsert({ name: catName, kind: 'priced', sort_order: sortOrder, purchase_only: 0 })
          catId = c.id
          mealCatByName.set(catName, catId)
          sortOrder += 1
        }
        const info = insertMeal.run(catId, name, m.sellingPrice, m.costPerServing, 'kg')
        const mealId = Number(info.lastInsertRowid)
        for (const y of m.yields) {
          const rawId = rawByName.get(y.rawInputName.trim())
          if (rawId != null && Number.isFinite(y.portions) && y.portions > 0) {
            yieldRows.push({ rawInputId: rawId, mealId, portions: Math.floor(y.portions) })
          }
        }
      }

      const insertYield = db.prepare(
        `INSERT INTO item_yield_defaults (raw_input_id, meal_id, portions) VALUES (?, ?, ?)
         ON CONFLICT(raw_input_id, meal_id) DO UPDATE SET portions = excluded.portions`
      )
      for (const y of yieldRows) insertYield.run(y.rawInputId, y.mealId, y.portions)

      settingsRepo.set('setup_complete', '1')
      return manager.id as number
    })()

    return { userId }
  },
}