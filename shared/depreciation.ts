export interface DepreciableAsset {
  purchase_date: string
  purchase_cost_cents: number
  salvage_cents: number
  useful_life_months: number
  disposed_at: string | null
}

export interface DepreciationValue {
  months_elapsed: number
  accumulated_depreciation_cents: number
  net_book_value_cents: number
  monthly_depreciation_cents: number
}

function toYM(date: string): number {
  const [y, m] = date.slice(0, 7).split('-').map(Number)
  return y * 12 + (m - 1)
}

export function computeDepreciation(asset: DepreciableAsset, asOfDate: string): DepreciationValue {
  const effective = asset.disposed_at && asset.disposed_at < asOfDate ? asset.disposed_at : asOfDate
  const life = asset.useful_life_months > 0 ? asset.useful_life_months : 0
  const months = toYM(effective) - toYM(asset.purchase_date)
  const elapsed = Math.max(0, Math.min(months, life))
  if (life === 0) {
    return {
      months_elapsed: 0,
      accumulated_depreciation_cents: 0,
      net_book_value_cents: asset.purchase_cost_cents,
      monthly_depreciation_cents: 0,
    }
  }
  const base = Math.max(asset.purchase_cost_cents - asset.salvage_cents, 0)
  const accumulated = Math.floor((base * elapsed) / life)
  const monthly = Math.floor(base / life)
  return {
    months_elapsed: elapsed,
    accumulated_depreciation_cents: accumulated,
    net_book_value_cents: asset.purchase_cost_cents - accumulated,
    monthly_depreciation_cents: monthly,
  }
}