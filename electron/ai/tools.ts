import type { Role } from '../../shared/types.js'
import { reportsRepo } from '../db/repositories/reportsRepo.js'
import { expensesRepo } from '../db/repositories/expensesRepo.js'
import { wasteRepo } from '../db/repositories/wasteRepo.js'
import { debtsRepo } from '../db/repositories/debtsRepo.js'
import { reimbursementsRepo } from '../db/repositories/reimbursementsRepo.js'
import { itemsRepo } from '../db/repositories/itemsRepo.js'
import { assetsRepo } from '../db/repositories/assetsRepo.js'
import { purchasesRepo } from '../db/repositories/purchasesRepo.js'
import { tillRepo } from '../db/repositories/tillRepo.js'
import type { OpenDebt } from '../../shared/types.js'

interface ToolDef {
  description: string
  parameters: Record<string, unknown>
}

export const WRITE_TOOLS: string[] = ['log_expense', 'record_waste', 'record_debt_payment', 'log_reimbursement']

export function isWriteTool(name: string): boolean {
  return WRITE_TOOLS.includes(name)
}

export const TOOL_DEFINITIONS: Record<string, ToolDef> = {
  get_business_summary: {
    description: 'Snapshot of the business today: open till, today revenue, net profit, expense total, open debt balance, and top-selling items.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  get_daily_report: {
    description: 'Daily profit & loss rows between start and end (each day: revenue, debt sales, barter, bad debt, food purchase, waste, expenses, reimbursements, net profit).',
    parameters: {
      type: 'object',
      properties: {
        start: { type: 'string', description: 'YYYY-MM-DD' },
        end: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['start', 'end'],
      additionalProperties: false,
    },
  },
  get_monthly_report: {
    description: 'Monthly profit & loss rows for a year (same fields as daily, per month).',
    parameters: { type: 'object', properties: { year: { type: 'integer' } }, required: ['year'], additionalProperties: false },
  },
  get_category_breakdown: {
    description: 'Expense totals grouped by category for a date range.',
    parameters: {
      type: 'object',
      properties: { start: { type: 'string' }, end: { type: 'string' } },
      required: ['start', 'end'], additionalProperties: false,
    },
  },
  get_item_performance: {
    description: 'Per-menu-item: units sold, revenue, COGS, profit for a range.',
    parameters: {
      type: 'object',
      properties: { start: { type: 'string' }, end: { type: 'string' } },
      required: ['start', 'end'], additionalProperties: false,
    },
  },
  get_expenses: {
    description: 'List expenses in a range, optionally filtered by category or payment source.',
    parameters: {
      type: 'object',
      properties: {
        start: { type: 'string' }, end: { type: 'string' },
        category: { type: 'string' }, payment_source: { type: 'string', enum: ['till', 'personal', 'mpesa'] },
      },
      required: ['start', 'end'], additionalProperties: false,
    },
  },
  get_sales: {
    description: 'Sales with line items in a date range.',
    parameters: {
      type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } },
      required: ['start', 'end'], additionalProperties: false,
    },
  },
  get_debt_summary: {
    description: 'Open receivables: per-sale debt with days open and paid/written-off amounts.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  get_customer_balances: {
    description: 'Per-customer outstanding balances with unpaid order counts.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  get_customer_detail: {
    description: 'One customer: open debts, payment history, write-offs.',
    parameters: { type: 'object', properties: { customer_name: { type: 'string' } }, required: ['customer_name'], additionalProperties: false },
  },
  get_till_summary: {
    description: 'Till session drawer reconciliation: float, cash sales, till expenses, expected cash.',
    parameters: { type: 'object', properties: { till_session_id: { type: 'integer' } }, additionalProperties: false },
  },
  get_waste_data: {
    description: 'Waste records (value, reason, item) in a range, plus per-item totals.',
    parameters: {
      type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } },
      required: ['start', 'end'], additionalProperties: false,
    },
  },
  get_food_purchases: {
    description: 'Food/protein purchases (cost, quantity) in a range.',
    parameters: {
      type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } },
      required: ['start', 'end'], additionalProperties: false,
    },
  },
  get_reimbursements: {
    description: 'Owner reimbursements paid from the till in a range.',
    parameters: {
      type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } },
      required: ['start', 'end'], additionalProperties: false,
    },
  },
  get_assets_summary: {
    description: 'Asset portfolio: total cost, book value, monthly depreciation, active count.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  get_menu_items: {
    description: 'Active menu items with selling and cost prices.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  log_expense: {
    description: 'Record an expense. Requires admin. Amount is whole UGX.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string' }, category: { type: 'string' }, description: { type: 'string' },
        amount_cents: { type: 'integer', description: 'Whole UGX' },
        payment_source: { type: 'string', enum: ['till', 'personal', 'mpesa'] },
      },
      required: ['date', 'category', 'amount_cents', 'payment_source'], additionalProperties: false,
    },
  },
  record_waste: {
    description: 'Record wasted food. Requires admin. estimated_value_cents is whole UGX.',
    parameters: {
      type: 'object',
      properties: {
        item_id: { type: 'integer' }, quantity: { type: 'number' },
        estimated_value_cents: { type: 'integer' },
        reason: { type: 'string', enum: ['staff_meal', 'spoiled', 'other'] },
        waste_date: { type: 'string' }, notes: { type: 'string' },
      },
      required: ['item_id', 'quantity', 'estimated_value_cents', 'reason', 'waste_date'], additionalProperties: false,
    },
  },
  record_debt_payment: {
    description: 'Apply a customer payment across their oldest open debts. Requires admin. amount_cents is whole UGX.',
    parameters: {
      type: 'object',
      properties: {
        customer_name: { type: 'string' },
        amount_cents: { type: 'integer', description: 'Whole UGX' },
      },
      required: ['customer_name', 'amount_cents'], additionalProperties: false,
    },
  },
  log_reimbursement: {
    description: 'Record an owner reimbursement paid out of the till. Requires admin. amount_cents is whole UGX.',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string' }, amount_cents: { type: 'integer' },
        paid_to: { type: 'string', enum: ['till', 'mpesa'] }, date: { type: 'string' },
      },
      required: ['description', 'amount_cents', 'paid_to', 'date'], additionalProperties: false,
    },
  },
}

export async function executeTool(name: string, args: Record<string, unknown>, ctx: { userId: number; role: Role }): Promise<unknown> {
  if (isWriteTool(name) && ctx.role !== 'admin') {
    throw new Error('admin role required')
  }

  switch (name) {
    case 'get_business_summary': {
      const until = new Date().toISOString().slice(0, 10)
      const till = tillRepo.current()
      const daily = reportsRepo.getDaily(until, until)
      const items = reportsRepo.getItemPerformance(until, until)
      const debts = debtsRepo.listOpen()
      const totalDebt = debts.reduce((sum, d: OpenDebt) => sum + d.remaining_cents, 0)
      return {
        till_open: !!till,
        today_revenue_cents: daily[0]?.sales_revenue_cents ?? 0,
        today_net_profit_cents: daily[0]?.net_profit_cents ?? 0,
        open_debt_cents: totalDebt,
        top_items: items.slice(0, 5),
      }
    }
    case 'get_daily_report':
      return reportsRepo.getDaily(String(args.start), String(args.end))
    case 'get_monthly_report':
      return reportsRepo.getMonthly(Number(args.year))
    case 'get_category_breakdown':
      return reportsRepo.getCategoryBreakdown(String(args.start), String(args.end))
    case 'get_item_performance':
      return reportsRepo.getItemPerformance(String(args.start), String(args.end))
    case 'get_expenses':
      return expensesRepo.list({
        date_from: String(args.start),
        date_to: String(args.end),
        category: args.category ? String(args.category) : undefined,
        payment_source: args.payment_source ? String(args.payment_source) : undefined,
      })
    case 'get_sales':
      return reportsRepo.getSales(String(args.start), String(args.end))
    case 'get_debt_summary':
      return reportsRepo.getDebtSummary()
    case 'get_customer_balances':
      return debtsRepo.customerBalances()
    case 'get_customer_detail':
      return debtsRepo.customerDetail(String(args.customer_name))
    case 'get_till_summary': {
      const id = args.till_session_id ? Number(args.till_session_id) : (tillRepo.current()?.id ?? 0)
      if (!id) return null
      return reportsRepo.getTillSummary(id)
    }
    case 'get_waste_data':
      return {
        records: wasteRepo.getByDateRange(String(args.start), String(args.end)),
        by_item: wasteRepo.getAggregatedByItem(String(args.start), String(args.end)),
      }
    case 'get_food_purchases':
      return purchasesRepo.getByDateRange(String(args.start), String(args.end))
    case 'get_reimbursements':
      return reimbursementsRepo.listByDateRange(String(args.start), String(args.end))
    case 'get_assets_summary':
      return assetsRepo.summary()
    case 'get_menu_items':
      return itemsRepo.listActive()
    case 'log_expense':
      return expensesRepo.create({
        date: String(args.date),
        category: String(args.category),
        description: args.description ? String(args.description) : undefined,
        amount_cents: Number(args.amount_cents),
        payment_source: args.payment_source as 'till' | 'personal' | 'mpesa',
        created_by: ctx.userId,
      })
    case 'record_waste':
      return wasteRepo.record({
        item_id: Number(args.item_id),
        quantity: Number(args.quantity),
        estimated_value_cents: Number(args.estimated_value_cents),
        reason: args.reason as string,
        waste_date: String(args.waste_date),
        notes: args.notes ? String(args.notes) : undefined,
      })
    case 'record_debt_payment':
      return debtsRepo.payOnAccount({
        customer_name: String(args.customer_name),
        amount_cents: Number(args.amount_cents),
        till_session_id: tillRepo.current()?.id ?? null,
        created_by: ctx.userId,
      })
    case 'log_reimbursement':
      return reimbursementsRepo.create({
        description: String(args.description),
        amount_cents: Number(args.amount_cents),
        paid_to: args.paid_to as 'till' | 'mpesa',
        date: String(args.date),
        created_by: ctx.userId,
      })
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}