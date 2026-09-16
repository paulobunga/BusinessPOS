import { describe, test, expect, vi } from 'vitest'
import { TOOL_DEFINITIONS, isWriteTool, executeTool, WRITE_TOOLS } from '../tools'

const { fakeReportRepo, fakeExpenseRepo, fakeWasteRepo, fakeDebtRepo, fakeReimbRepo } = vi.hoisted(() => ({
  fakeReportRepo: { getDaily: vi.fn(() => [salesRepoReportFactory()]) },
  fakeExpenseRepo: { create: vi.fn(() => 41) },
  fakeWasteRepo: { record: vi.fn(() => ({ id: 7 })) },
  fakeDebtRepo: { payOnAccount: vi.fn(() => ({ total_applied_cents: 50000 })) },
  fakeReimbRepo: { create: vi.fn(() => 9) },
}))

function salesRepoReportFactory() {
  return { sales_revenue_cents: 850000, net_profit_cents: 120000 }
}

vi.mock('../../db/repositories/reportsRepo.js', () => ({ reportsRepo: fakeReportRepo }))
vi.mock('../../db/repositories/expensesRepo.js', () => ({ expensesRepo: fakeExpenseRepo }))
vi.mock('../../db/repositories/wasteRepo.js', () => ({ wasteRepo: fakeWasteRepo }))
vi.mock('../../db/repositories/debtsRepo.js', () => ({ debtsRepo: fakeDebtRepo }))
vi.mock('../../db/repositories/reimbursementsRepo.js', () => ({ reimbursementsRepo: fakeReimbRepo }))

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
})