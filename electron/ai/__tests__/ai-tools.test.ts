import { describe, test, expect, vi } from 'vitest'
import { TOOL_DEFINITIONS, isWriteTool, executeTool, WRITE_TOOLS } from '../tools'

const { fakeReportRepo, fakeExpenseRepo, fakeWasteRepo, fakeDebtRepo, fakeReimbRepo, fakeAssetsRepo } = vi.hoisted(() => ({
  fakeReportRepo: { getDaily: vi.fn(() => [salesRepoReportFactory()]) },
  fakeExpenseRepo: { create: vi.fn(() => 41) },
  fakeWasteRepo: { record: vi.fn(() => ({ id: 7 })) },
  fakeDebtRepo: { payOnAccount: vi.fn(() => ({ total_applied_cents: 50000 })) },
  fakeReimbRepo: { create: vi.fn(() => 9) },
  fakeAssetsRepo: {
    summary: vi.fn(() => ({ total_cost_cents: 500000, total_book_value_cents: 400000, total_monthly_depreciation_cents: 50000, total_accumulated_cents: 100000, active_count: 3, disposed_count: 1 })),
    list: vi.fn(() => [{ id: 1, name: 'Freezer', category: 'Kitchen Equipment', quantity: 1, purchase_date: '2024-01-01', purchase_cost_cents: 200000, salvage_cents: 20000, useful_life_months: 120, location: 'Kitchen', notes: '', active: 1, disposed_at: null, disposed_reason: null, sold_proceeds_cents: null, created_at: '', created_by: null, months_elapsed: 20, accumulated_depreciation_cents: 30000, net_book_value_cents: 170000, monthly_depreciation_cents: 15000 }]),
    getById: vi.fn((id: number, _asOf?: string) => ({ id, name: 'Freezer', category: 'Kitchen Equipment', quantity: 1, purchase_date: '2024-01-01', purchase_cost_cents: 200000, salvage_cents: 20000, useful_life_months: 120, location: 'Kitchen', notes: '', active: 1, disposed_at: null, disposed_reason: null, sold_proceeds_cents: null, created_at: '', created_by: null, months_elapsed: 20, accumulated_depreciation_cents: 30000, net_book_value_cents: 170000, monthly_depreciation_cents: 15000 })),
    create: vi.fn(() => 5),
    update: vi.fn((id: number, _patch: Record<string, unknown>) => ({ id, name: 'Updated', category: 'Kitchen Equipment', quantity: 1, purchase_date: '2024-01-01', purchase_cost_cents: 200000, salvage_cents: 20000, useful_life_months: 120, location: 'Kitchen', notes: '', active: 1, disposed_at: null, disposed_reason: null, sold_proceeds_cents: null, created_at: '', created_by: null, months_elapsed: 20, accumulated_depreciation_cents: 30000, net_book_value_cents: 170000, monthly_depreciation_cents: 15000 })),
    dispose: vi.fn((id: number, _disposedAt: string, _reason: string, _proceeds: number | null) => ({ id, name: 'Freezer', category: 'Kitchen Equipment', quantity: 1, purchase_date: '2024-01-01', purchase_cost_cents: 200000, salvage_cents: 20000, useful_life_months: 120, location: 'Kitchen', notes: '', active: 0, disposed_at: '2025-06-01', disposed_reason: 'sold', sold_proceeds_cents: 100000, created_at: '', created_by: null, months_elapsed: 17, accumulated_depreciation_cents: 25500, net_book_value_cents: 174500, monthly_depreciation_cents: 15000 })),
  },
}))

function salesRepoReportFactory() {
  return { sales_revenue_cents: 850000, net_profit_cents: 120000 }
}

vi.mock('../../db/repositories/reportsRepo.js', () => ({ reportsRepo: fakeReportRepo }))
vi.mock('../../db/repositories/expensesRepo.js', () => ({ expensesRepo: fakeExpenseRepo }))
vi.mock('../../db/repositories/wasteRepo.js', () => ({ wasteRepo: fakeWasteRepo }))
vi.mock('../../db/repositories/debtsRepo.js', () => ({ debtsRepo: fakeDebtRepo }))
vi.mock('../../db/repositories/reimbursementsRepo.js', () => ({ reimbursementsRepo: fakeReimbRepo }))
vi.mock('../../db/repositories/assetsRepo.js', () => ({ assetsRepo: fakeAssetsRepo }))

describe('ai tools', () => {
  test('exports a definition for every registered tool', () => {
    for (const name of Object.keys(TOOL_DEFINITIONS)) {
      expect(TOOL_DEFINITIONS[name].description).toBeTruthy()
      expect(TOOL_DEFINITIONS[name].parameters).toBeTruthy()
    }
  })

  test('isWriteTool returns true only for write tools', () => {
    expect(isWriteTool('log_expense')).toBe(true)
    expect(isWriteTool('get_daily_report')).toBe(false)
    expect(WRITE_TOOLS).toContain('log_expense')
    expect(WRITE_TOOLS).toContain('post_depreciation')
  })

  test('executeTool routes read tool to the repo', async () => {
    const out = await executeTool('get_daily_report', { start: '2026-09-01', end: '2026-09-07' }, { userId: 1, role: 'admin' })
    expect(fakeReportRepo.getDaily).toHaveBeenCalledWith('2026-09-01', '2026-09-07')
    expect(out).toEqual([{ sales_revenue_cents: 850000, net_profit_cents: 120000 }])
  })

  test('executeTool allows admin to run write tools', async () => {
    const out = await executeTool('log_expense', {
      date: '2026-09-15', category: 'Transport', description: 'boda', amount_cents: 5000, payment_source: 'till',
    }, { userId: 1, role: 'admin' })
    expect(fakeExpenseRepo.create).toHaveBeenCalledWith(expect.objectContaining({ amount_cents: 5000 }))
    expect(out).toBe(41)
  })

  test('executeTool rejects write tools for cashier role', async () => {
    await expect(
      executeTool('log_expense', { date: '2026-09-15', category: 'X', amount_cents: 1000, payment_source: 'till' }, { userId: 2, role: 'cashier' })
    ).rejects.toThrow('admin role required')
  })

  test('executeTool throws on unknown tool', async () => {
    await expect(executeTool('nope', {}, { userId: 1, role: 'admin' })).rejects.toThrow('Unknown tool')
  })

  test('get_assets_list returns list from assetsRepo', async () => {
    const out = await executeTool('get_assets_list', {}, { userId: 1, role: 'admin' })
    expect(fakeAssetsRepo.list).toHaveBeenCalled()
    expect(out).toBeInstanceOf(Array)
    expect((out as Array<unknown>)[0]).toHaveProperty('name')
  })

  test('get_assets_list accepts as_of parameter', async () => {
    await executeTool('get_assets_list', { as_of: '2025-06-01' }, { userId: 1, role: 'admin' })
    expect(fakeAssetsRepo.list).toHaveBeenCalledWith('2025-06-01')
  })

  test('get_asset_detail returns asset from assetsRepo', async () => {
    const out = await executeTool('get_asset_detail', { id: 1 }, { userId: 1, role: 'admin' })
    expect(fakeAssetsRepo.getById).toHaveBeenCalledWith(1, expect.any(String))
    expect(out as Record<string, unknown>).toHaveProperty('name')
    expect(out as Record<string, unknown>).toHaveProperty('monthly_depreciation_cents')
  })

  test('get_asset_detail rejects missing id', async () => {
    await expect(
      executeTool('get_asset_detail', {}, { userId: 1, role: 'admin' })
    ).rejects.toThrow('id is required')
  })

  test('get_depreciation_schedule returns schedule for asset', async () => {
    const out = await executeTool('get_depreciation_schedule', { asset_id: 1 }, { userId: 1, role: 'admin' })
    expect(fakeAssetsRepo.getById).toHaveBeenCalledWith(1, expect.any(String))
    expect(out).toBeDefined()
  })

  test('get_depreciation_schedule returns schedule for all assets', async () => {
    const out = await executeTool('get_depreciation_schedule', {}, { userId: 1, role: 'admin' })
    expect(fakeAssetsRepo.list).toHaveBeenCalled()
    expect(out).toBeInstanceOf(Object)
  })

  test('get_depreciation_schedule accepts months_ahead', async () => {
    await executeTool('get_depreciation_schedule', { asset_id: 1, months_ahead: 6 }, { userId: 1, role: 'admin' })
    expect(fakeAssetsRepo.getById).toHaveBeenCalledWith(1, expect.any(String))
  })

  test('create_asset writes via assetsRepo for admin', async () => {
    const out = await executeTool('create_asset', {
      name: 'Oven', category: 'Kitchen Equipment', quantity: 1, purchase_date: '2025-01-01',
      purchase_cost_cents: 500000, salvage_cents: 50000, useful_life_months: 120, location: 'Kitchen',
    }, { userId: 1, role: 'admin' })
    expect(fakeAssetsRepo.create).toHaveBeenCalled()
    expect(out).toBe(5)
  })

  test('create_asset rejects cashier role', async () => {
    await expect(
      executeTool('create_asset', {
        name: 'Oven', category: 'Kitchen Equipment', quantity: 1, purchase_date: '2025-01-01',
        purchase_cost_cents: 500000, salvage_cents: 50000, useful_life_months: 120, location: 'Kitchen',
      }, { userId: 2, role: 'cashier' })
    ).rejects.toThrow('admin role required')
  })

  test('update_asset writes via assetsRepo for admin', async () => {
    const out = await executeTool('update_asset', { id: 1, name: 'Updated' }, { userId: 1, role: 'admin' })
    expect(fakeAssetsRepo.update).toHaveBeenCalledWith(1, expect.any(Object))
    expect(out).toHaveProperty('name', 'Updated')
  })

  test('update_asset rejects cashier role', async () => {
    await expect(
      executeTool('update_asset', { id: 1, name: 'Updated' }, { userId: 2, role: 'cashier' })
    ).rejects.toThrow('admin role required')
  })

  test('dispose_asset writes via assetsRepo for admin', async () => {
    const out = await executeTool('dispose_asset', { id: 1, disposed_at: '2025-06-01', reason: 'sold', proceeds_cents: 100000 }, { userId: 1, role: 'admin' })
    expect(fakeAssetsRepo.dispose).toHaveBeenCalledWith(1, expect.any(String), expect.any(String), expect.any(Number))
    expect(out).toHaveProperty('disposed_at')
  })

  test('dispose_asset rejects cashier role', async () => {
    await expect(
      executeTool('dispose_asset', { id: 1, disposed_at: '2025-06-01', reason: 'sold', proceeds_cents: 100000 }, { userId: 2, role: 'cashier' })
    ).rejects.toThrow('admin role required')
  })

  test('post_depreciation creates expense via expensesRepo for admin', async () => {
    const out = await executeTool('post_depreciation', {
      asset_id: 1, amount_cents: 15000, period: '2025-09-01', payment_source: 'till',
    }, { userId: 1, role: 'admin' })
    expect(fakeExpenseRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      category: 'depreciation',
      amount_cents: 15000,
      payment_source: 'till',
    }))
    expect(out).toBe(41)
  })

  test('post_depreciation auto-calculates amount', async () => {
    await executeTool('post_depreciation', { asset_id: 1 }, { userId: 1, role: 'admin' })
    expect(fakeExpenseRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      category: 'depreciation',
      amount_cents: 1500,
      description: 'Depreciation - Freezer',
      date: expect.any(String),
    }))
  })

  test('post_depreciation rejects cashier role', async () => {
    await expect(
      executeTool('post_depreciation', { asset_id: 1, amount_cents: 15000 }, { userId: 2, role: 'cashier' })
    ).rejects.toThrow('admin role required')
  })

  test('post_depreciation rejects missing asset_id', async () => {
    await expect(
      executeTool('post_depreciation', { amount_cents: 15000 }, { userId: 1, role: 'admin' })
    ).rejects.toThrow('asset_id is required')
  })

  test('post_depreciation rejects non-existent asset', async () => {
    fakeAssetsRepo.getById.mockReturnValueOnce(undefined as any)
    await expect(
      executeTool('post_depreciation', { asset_id: 999 }, { userId: 1, role: 'admin' })
    ).rejects.toThrow('Asset 999 not found')
    fakeAssetsRepo.getById.mockReturnValueOnce({
      id: 999, name: 'Test', category: 'Kitchen Equipment', quantity: 1, purchase_date: '2024-01-01',
      purchase_cost_cents: 100000, salvage_cents: 10000, useful_life_months: 60, location: 'Kitchen',
      notes: '', active: 1, disposed_at: null, disposed_reason: null, sold_proceeds_cents: null,
      created_at: '', created_by: null, months_elapsed: 0, accumulated_depreciation_cents: 0,
      net_book_value_cents: 100000, monthly_depreciation_cents: 1500,
    })
  })
})
