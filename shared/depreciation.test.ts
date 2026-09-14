import { describe, test, expect } from 'vitest'
import { computeDepreciation } from './depreciation'

describe('computeDepreciation (straight-line)', () => {
  test('freezer: 1,200,000 UGX, 10yr life, 24 months in', () => {
    const r = computeDepreciation(
      { purchase_date: '2024-01-10', purchase_cost_cents: 1200000, salvage_cents: 0, useful_life_months: 120, disposed_at: null },
      '2026-01-10'
    )
    expect(r.months_elapsed).toBe(24)
    expect(r.monthly_depreciation_cents).toBe(10000)
    expect(r.accumulated_depreciation_cents).toBe(240000)
    expect(r.net_book_value_cents).toBe(960000)
  })

  test('plates lot: 200,000 UGX for 50 plates, 2yr life, 14 months in', () => {
    const r = computeDepreciation(
      { purchase_date: '2025-07-15', purchase_cost_cents: 200000, salvage_cents: 0, useful_life_months: 24, disposed_at: null },
      '2026-09-15'
    )
    expect(r.months_elapsed).toBe(14)
    expect(r.monthly_depreciation_cents).toBe(8333)
    expect(r.accumulated_depreciation_cents).toBe(116666)
    expect(r.net_book_value_cents).toBe(83334)
  })

  test('end of life clamps to salvage value (never below)', () => {
    const r = computeDepreciation(
      { purchase_date: '2025-01-01', purchase_cost_cents: 100000, salvage_cents: 10000, useful_life_months: 12, disposed_at: null },
      '2027-01-01'
    )
    expect(r.months_elapsed).toBe(12)
    expect(r.accumulated_depreciation_cents).toBe(90000)
    expect(r.net_book_value_cents).toBe(10000)
  })

  test('same-month purchase has zero depreciation', () => {
    const r = computeDepreciation(
      { purchase_date: '2026-09-01', purchase_cost_cents: 60000, salvage_cents: 0, useful_life_months: 24, disposed_at: null },
      '2026-09-20'
    )
    expect(r.months_elapsed).toBe(0)
    expect(r.accumulated_depreciation_cents).toBe(0)
    expect(r.net_book_value_cents).toBe(60000)
  })

  test('disposal cuts depreciation off at the disposed date', () => {
    const r = computeDepreciation(
      { purchase_date: '2025-01-01', purchase_cost_cents: 240000, salvage_cents: 0, useful_life_months: 24, disposed_at: '2025-06-15' },
      '2026-09-15'
    )
    expect(r.months_elapsed).toBe(5)
    expect(r.accumulated_depreciation_cents).toBe(50000)
    expect(r.net_book_value_cents).toBe(190000)
  })

  test('salvage greater than cost results in zero depreciation, full book value', () => {
    const r = computeDepreciation(
      { purchase_date: '2026-01-01', purchase_cost_cents: 50000, salvage_cents: 80000, useful_life_months: 12, disposed_at: null },
      '2026-12-31'
    )
    expect(r.months_elapsed).toBe(11)
    expect(r.accumulated_depreciation_cents).toBe(0)
    expect(r.net_book_value_cents).toBe(50000)
  })
})