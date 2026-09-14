import { getDb } from '../index'
import { computeDepreciation, type DepreciableAsset } from '../../../shared/depreciation'
import type { AssetSummary, AssetWithValue, CreateAssetPayload } from '../../../shared/types'

const COLS = `id, name, category, quantity, purchase_date, purchase_cost_cents, salvage_cents, useful_life_months, location, notes, active, disposed_at, disposed_reason, sold_proceeds_cents, created_at, created_by`

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function toAsset(row: Record<string, unknown>, asOf: string): AssetWithValue {
  return { ...row, ...computeDepreciation(row as unknown as DepreciableAsset, asOf) } as AssetWithValue
}

function validate(data: Partial<CreateAssetPayload>) {
  if (data.name !== undefined && !String(data.name).trim()) throw new Error('Asset name is required')
  if (data.purchase_cost_cents !== undefined && (isNaN(data.purchase_cost_cents) || data.purchase_cost_cents < 0)) throw new Error('Purchase cost must be a non-negative number')
  if (data.salvage_cents !== undefined && (isNaN(data.salvage_cents) || data.salvage_cents < 0)) throw new Error('Salvage value must be a non-negative number')
  if (data.useful_life_months !== undefined && (!Number.isInteger(data.useful_life_months) || data.useful_life_months < 1)) throw new Error('Useful life must be at least 1 month')
  if (data.quantity !== undefined && (!Number.isInteger(data.quantity) || data.quantity < 1)) throw new Error('Quantity must be a positive whole number')
}

export const assetsRepo = {
  create(data: CreateAssetPayload & { created_by?: number | null }): number {
    validate(data)
    if (!data.name || !String(data.name).trim()) throw new Error('Asset name is required')
    if (!data.purchase_date) throw new Error('Purchase date is required')
    const result = getDb().prepare(`
      INSERT INTO assets (name, category, quantity, purchase_date, purchase_cost_cents, salvage_cents, useful_life_months, location, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.name.trim(),
      data.category,
      data.quantity ?? 1,
      data.purchase_date,
      data.purchase_cost_cents,
      data.salvage_cents ?? 0,
      data.useful_life_months,
      data.location?.trim() || null,
      data.notes?.trim() || null,
      data.created_by ?? null,
    )
    return result.lastInsertRowid as number
  },

  getById(id: number, asOf: string = today()): AssetWithValue | undefined {
    const row = getDb().prepare(`SELECT ${COLS} FROM assets WHERE id = ?`).get(id) as Record<string, unknown> | undefined
    return row ? toAsset(row, asOf) : undefined
  },

  list(asOf: string = today()): AssetWithValue[] {
    const rows = getDb().prepare(`SELECT ${COLS} FROM assets ORDER BY active DESC, purchase_date DESC`).all() as Record<string, unknown>[]
    return rows.map(r => toAsset(r, asOf))
  },

  update(id: number, patch: Partial<CreateAssetPayload>): AssetWithValue {
    validate(patch)
    const fields: string[] = []
    const values: (string | number | null)[] = []
    if (patch.name !== undefined) { fields.push('name = ?'); values.push(patch.name.trim()) }
    if (patch.category !== undefined) { fields.push('category = ?'); values.push(patch.category) }
    if (patch.quantity !== undefined) { fields.push('quantity = ?'); values.push(patch.quantity) }
    if (patch.purchase_date !== undefined) { fields.push('purchase_date = ?'); values.push(patch.purchase_date) }
    if (patch.purchase_cost_cents !== undefined) { fields.push('purchase_cost_cents = ?'); values.push(patch.purchase_cost_cents) }
    if (patch.salvage_cents !== undefined) { fields.push('salvage_cents = ?'); values.push(patch.salvage_cents) }
    if (patch.useful_life_months !== undefined) { fields.push('useful_life_months = ?'); values.push(patch.useful_life_months) }
    if (patch.location !== undefined) { fields.push('location = ?'); values.push(patch.location.trim() || null) }
    if (patch.notes !== undefined) { fields.push('notes = ?'); values.push(patch.notes.trim() || null) }
    if (fields.length > 0) {
      values.push(id)
      getDb().prepare(`UPDATE assets SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    }
    return this.getById(id)!
  },

  dispose(id: number, disposedAt: string, reason: string, proceedsCents: number | null = null): AssetWithValue {
    if (!disposedAt) throw new Error('Disposal date is required')
    if (!reason || !reason.trim()) throw new Error('Disposal reason is required')
    if (proceedsCents != null && (isNaN(proceedsCents) || proceedsCents < 0)) throw new Error('Sale proceeds must be a non-negative number')
    getDb().prepare(`
      UPDATE assets SET disposed_at = ?, disposed_reason = ?, sold_proceeds_cents = ?, active = 0 WHERE id = ?
    `).run(disposedAt, reason.trim(), proceedsCents, id)
    return this.getById(id)!
  },

  summary(asOf: string = today()): AssetSummary {
    const all = this.list(asOf)
    const active = all.filter(a => a.active === 1)
    return {
      total_cost_cents: all.reduce((s, a) => s + a.purchase_cost_cents, 0),
      total_book_value_cents: active.reduce((s, a) => s + a.net_book_value_cents, 0),
      total_monthly_depreciation_cents: active.reduce((s, a) => s + a.monthly_depreciation_cents, 0),
      total_accumulated_cents: active.reduce((s, a) => s + a.accumulated_depreciation_cents, 0),
      active_count: active.length,
      disposed_count: all.length - active.length,
    }
  },
}