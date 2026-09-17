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
import { categoriesRepo } from '../db/repositories/categoriesRepo.js'
import { getDb } from '../db/index.js'
import { computeDepreciation } from '../../shared/depreciation.js'
import type { OpenDebt } from '../../shared/types.js'
import type { DepreciableAsset } from '../../shared/depreciation.js'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function toYM(date: string): number {
  const [y, m] = date.slice(0, 7).split('-').map(Number)
  return y * 12 + (m - 1)
}

interface ToolDef {
  description: string
  parameters: Record<string, unknown>
}

export const WRITE_TOOLS: string[] = [
  'log_expense', 'record_waste', 'record_debt_payment', 'log_reimbursement',
  'update_menu_item', 'add_menu_item', 'toggle_item_stock',
  'record_purchase',
  'open_till', 'close_till',
  'create_asset', 'update_asset', 'dispose_asset', 'post_depreciation',
]

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
  get_assets_list: {
    description: 'All assets with current depreciation values (book value, accumulated depreciation, monthly depreciation).',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  get_asset_detail: {
    description: 'Full details for one asset including depreciation breakdown.',
    parameters: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'], additionalProperties: false },
  },
  get_depreciation_schedule: {
    description: 'Month-by-month depreciation projection for an asset or all active assets.',
    parameters: {
      type: 'object',
      properties: {
        asset_id: { type: 'integer', description: 'If provided, schedule for one asset. Otherwise all active assets.' },
        months_ahead: { type: 'integer', description: 'How many future months to project (default 12).' },
      },
      additionalProperties: false,
    },
  },
  create_asset: {
    description: 'Register a new asset. Requires admin. purchase_cost_cents and useful_life_months are required.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        category: { type: 'string' },
        purchase_date: { type: 'string' },
        purchase_cost_cents: { type: 'integer' },
        salvage_cents: { type: 'integer' },
        useful_life_months: { type: 'integer' },
        quantity: { type: 'integer' },
        location: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['name', 'purchase_date', 'purchase_cost_cents', 'useful_life_months'], additionalProperties: false,
    },
  },
  update_asset: {
    description: 'Update an existing asset. Requires admin.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Asset ID' },
        name: { type: 'string' },
        category: { type: 'string' },
        purchase_date: { type: 'string' },
        purchase_cost_cents: { type: 'integer' },
        salvage_cents: { type: 'integer' },
        useful_life_months: { type: 'integer' },
        quantity: { type: 'integer' },
        location: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['id'], additionalProperties: false,
    },
  },
  dispose_asset: {
    description: 'Dispose or retire an asset. Requires admin. proceeds_cents is whole UGX.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        disposed_at: { type: 'string' },
        reason: { type: 'string' },
        proceeds_cents: { type: 'integer' },
      },
      required: ['id', 'disposed_at', 'reason'], additionalProperties: false,
    },
  },
  post_depreciation: {
    description: 'Record a depreciation expense for an asset. Requires admin. amount_cents is whole UGX.',
    parameters: {
      type: 'object',
      properties: {
        asset_id: { type: 'integer' },
        amount_cents: { type: 'integer', description: 'Whole UGX. Auto-calculated if omitted.' },
        period: { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
        description: { type: 'string' },
        payment_source: { type: 'string', enum: ['till', 'personal', 'mpesa'] },
      },
      required: ['asset_id'], additionalProperties: false,
    },
  },
  get_menu_items: {
    description: 'Active menu items with selling and cost prices.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  get_all_menu_items: {
    description: 'All menu items (including inactive) with category and prices.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  get_categories: {
    description: 'Menu categories with their items.',
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
  update_menu_item: {
    description: 'Update an existing menu item: name, selling price, cost price, or category. Requires admin.',
    parameters: {
      type: 'object',
      properties: {
        item_id: { type: 'integer', description: 'ID of the item to update' },
        name: { type: 'string', description: 'New name' },
        selling_price_cents: { type: 'integer', description: 'New selling price in whole UGX' },
        cost_price_cents: { type: 'integer', description: 'New cost price in whole UGX' },
        category_id: { type: 'integer', description: 'New category ID' },
      },
      required: ['item_id'], additionalProperties: false,
    },
  },
  add_menu_item: {
    description: 'Add a new menu item. Requires admin.',
    parameters: {
      type: 'object',
      properties: {
        category_id: { type: 'integer' },
        name: { type: 'string' },
        selling_price_cents: { type: 'integer', description: 'Selling price in whole UGX' },
        cost_price_cents: { type: 'integer', description: 'Cost price in whole UGX' },
      },
      required: ['category_id', 'name'], additionalProperties: false,
    },
  },
  toggle_item_stock: {
    description: 'Mark an item as in-stock or out-of-stock. Requires admin.',
    parameters: {
      type: 'object',
      properties: {
        item_id: { type: 'integer' },
        out_of_stock: { type: 'boolean' },
      },
      required: ['item_id', 'out_of_stock'], additionalProperties: false,
    },
  },
  record_purchase: {
    description: 'Record a food/protein purchase. Updates item cost price automatically. Requires admin. cost_cents is whole UGX.',
    parameters: {
      type: 'object',
      properties: {
        item_id: { type: 'integer' },
        quantity: { type: 'number', description: 'Quantity purchased (e.g., kg or units)' },
        cost_cents: { type: 'integer', description: 'Total cost in whole UGX' },
        purchase_date: { type: 'string', description: 'YYYY-MM-DD, defaults to today' },
        unit: { type: 'string', description: 'Unit of measure: kg, g, whole, etc.' },
      },
      required: ['item_id', 'quantity', 'cost_cents'], additionalProperties: false,
    },
  },
  open_till: {
    description: 'Open a new till session with starting float. Requires admin. float_cents is whole UGX.',
    parameters: {
      type: 'object',
      properties: {
        float_cents: { type: 'integer', description: 'Starting float in whole UGX' },
      },
      required: ['float_cents'], additionalProperties: false,
    },
  },
  close_till: {
    description: 'Close the current till session. Requires admin.',
    parameters: {
      type: 'object',
      properties: {
        counted_cents: { type: 'integer', description: 'Physical cash counted in whole UGX' },
      },
      required: ['counted_cents'], additionalProperties: false,
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
    case 'get_assets_list':
      return assetsRepo.list(String(args.as_of ?? today()))
    case 'get_asset_detail': {
      const id = Number(args.id)
      if (!id) throw new Error('id is required')
      const asset = assetsRepo.getById(id, String(args.as_of ?? today()))
      if (!asset) throw new Error(`Asset ${id} not found`)
      return asset
    }
    case 'get_depreciation_schedule': {
      const monthsAhead = args.months_ahead ? Number(args.months_ahead) : 12
      const today$1 = today()
      if (args.asset_id) {
        const asset = assetsRepo.getById(Number(args.asset_id), today$1)
        if (!asset) throw new Error(`Asset ${args.asset_id} not found`)
        const schedule = []
        const purchaseYM = toYM(asset.purchase_date)
        const endYM = purchaseYM + asset.useful_life_months
        const currentYM = toYM(today$1)
        const end = Math.min(endYM, currentYM + monthsAhead)
        for (let ym = Math.max(purchaseYM, currentYM); ym <= end; ym++) {
          const dateStr = `${String(Math.floor(ym / 12) + 2000).padStart(4, '0')}-${String((ym % 12) + 1).padStart(2, '0')}`
          const val = computeDepreciation(asset as unknown as DepreciableAsset, dateStr)
          schedule.push({
            month: dateStr,
            accumulated_depreciation_cents: val.accumulated_depreciation_cents,
            net_book_value_cents: val.net_book_value_cents,
            monthly_depreciation_cents: val.monthly_depreciation_cents,
          })
        }
        return schedule
      }
      const all = assetsRepo.list(today$1).filter(a => a.active === 1)
      const result: Record<string, unknown[]> = {}
      for (const asset of all) {
        const schedule = []
        const purchaseYM = toYM(asset.purchase_date)
        const endYM = purchaseYM + asset.useful_life_months
        const currentYM = toYM(today$1)
        const end = Math.min(endYM, currentYM + monthsAhead)
        for (let ym = Math.max(purchaseYM, currentYM); ym <= end; ym++) {
          const dateStr = `${String(Math.floor(ym / 12) + 2000).padStart(4, '0')}-${String((ym % 12) + 1).padStart(2, '0')}`
          const val = computeDepreciation(asset as unknown as DepreciableAsset, dateStr)
          schedule.push({
            month: dateStr,
            accumulated_depreciation_cents: val.accumulated_depreciation_cents,
            net_book_value_cents: val.net_book_value_cents,
            monthly_depreciation_cents: val.monthly_depreciation_cents,
          })
        }
        result[`${asset.name} (#${asset.id})`] = schedule
      }
      return result
    }
    case 'get_menu_items':
      return itemsRepo.listActive()
    case 'get_all_menu_items':
      return itemsRepo.listAll()
    case 'get_categories':
      return categoriesRepo.list()
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

    case 'add_menu_item':
      return itemsRepo.upsert({
        category_id: Number(args.category_id),
        name: String(args.name),
        selling_price_cents: args.selling_price_cents != null ? Number(args.selling_price_cents) : 0,
        cost_price_cents: args.cost_price_cents != null ? Number(args.cost_price_cents) : 0,
      })
    case 'update_menu_item': {
      const existing = itemsRepo.getById(Number(args.item_id))
      if (!existing) throw new Error(`Menu item ${args.item_id} not found`)
      return itemsRepo.upsert({
        id: Number(args.item_id),
        category_id: args.category_id != null ? Number(args.category_id) : existing.category_id,
        name: args.name != null ? String(args.name) : existing.name,
        selling_price_cents: args.selling_price_cents != null ? Number(args.selling_price_cents) : existing.selling_price_cents,
        cost_price_cents: args.cost_price_cents != null ? Number(args.cost_price_cents) : existing.cost_price_cents,
      })
    }
    case 'toggle_item_stock':
      return itemsRepo.setOutOfStock(Number(args.item_id), Boolean(args.out_of_stock))
    case 'record_purchase':
      return purchasesRepo.recordPurchase(
        Number(args.item_id),
        Number(args.quantity),
        Number(args.cost_cents),
        args.purchase_date ? String(args.purchase_date) : new Date().toISOString().slice(0, 10),
        ctx.userId,
        { unit: args.unit ? String(args.unit) : 'kg' }
      )
    case 'create_asset':
      return assetsRepo.create({
        name: String(args.name),
        category: String(args.category),
        purchase_date: String(args.purchase_date),
        purchase_cost_cents: Number(args.purchase_cost_cents),
        salvage_cents: args.salvage_cents != null ? Number(args.salvage_cents) : 0,
        useful_life_months: Number(args.useful_life_months),
        quantity: args.quantity != null ? Number(args.quantity) : 1,
        location: args.location ? String(args.location) : undefined,
        notes: args.notes ? String(args.notes) : undefined,
        created_by: ctx.userId,
      })
    case 'update_asset': {
      const id = Number(args.id)
      const existing = assetsRepo.getById(id)
      if (!existing) throw new Error(`Asset ${id} not found`)
      const patch: Record<string, unknown> = {}
      if (args.name != null) patch.name = String(args.name)
      if (args.category != null) patch.category = String(args.category)
      if (args.purchase_date != null) patch.purchase_date = String(args.purchase_date)
      if (args.purchase_cost_cents != null) patch.purchase_cost_cents = Number(args.purchase_cost_cents)
      if (args.salvage_cents != null) patch.salvage_cents = Number(args.salvage_cents)
      if (args.useful_life_months != null) patch.useful_life_months = Number(args.useful_life_months)
      if (args.quantity != null) patch.quantity = Number(args.quantity)
      if (args.location != null) patch.location = String(args.location)
      if (args.notes != null) patch.notes = String(args.notes)
      return assetsRepo.update(id, patch)
    }
    case 'dispose_asset': {
      const id = Number(args.id)
      if (!id) throw new Error('id is required')
      return assetsRepo.dispose(
        id,
        String(args.disposed_at),
        String(args.reason),
        args.proceeds_cents != null ? Number(args.proceeds_cents) : null,
      )
    }
    case 'post_depreciation': {
      const assetId = Number(args.asset_id)
      if (!assetId) throw new Error('asset_id is required')
      const asset = assetsRepo.getById(assetId)
      if (!asset) throw new Error(`Asset ${assetId} not found`)
      const period = String(args.period ?? today())
      const amountCents = args.amount_cents != null ? Number(args.amount_cents) : Math.max(computeDepreciation(asset as unknown as DepreciableAsset, period).monthly_depreciation_cents, 0)
      const description = args.description ? String(args.description) : `Depreciation - ${asset.name}`
      return expensesRepo.create({
        date: period,
        category: 'depreciation',
        description,
        amount_cents: amountCents,
        payment_source: (args.payment_source as 'till' | 'personal' | 'mpesa') ?? 'till',
        created_by: ctx.userId,
      })
    }
    case 'open_till':
      return tillRepo.open(Number(args.float_cents))
    case 'close_till':
      return tillRepo.close(tillRepo.current()?.id ?? 0, Number(args.counted_cents))
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
