// === Entities ===
export interface User {
  id: number
  name: string
  role: 'cashier' | 'manager'
  active: number
}

export interface Customer {
  id: number
  name: string
  phone: string | null
  created_at: string
}

export interface CustomerWithBalance extends Customer {
  total_owed_cents: number
  unpaid_orders: number
  last_order_date: string
}

export interface Protein {
  id: number
  name: string
  selling_price_cents: number
  cost_price_cents: number
  category: string
  active: number
  out_of_stock: number
}

export interface Starch {
  id: number
  name: string
  active: number
}

export interface TillSession {
  id: number
  opened_at: string
  closed_at: string | null
  opening_float_cents: number
  expected_cash_cents: number | null
  counted_cash_cents: number | null
  variance_cents: number | null
  opened_by: number | null
  closed_by: number | null
}

export interface TillCountData {
  openingFloatCents: number
  cashSalesCents: number
  tillExpensesCents: number
  expectedClosingCents: number
}

export interface Sale {
  id: number
  till_session_id: number | null
  created_at: string
  status: 'completed' | 'unpaid' | 'voided' | 'refunded'
  subtotal_cents: number
  discount_cents: number
  tax_cents: number
  total_cents: number
  payment_source: 'cash' | 'unpaid'
  customer_id: number | null
  starch_id: number | null
  created_by: number | null
  voided_at: string | null
  voided_by: number | null
  void_reason: string | null
  discount_reason?: string | null
  debt_cents?: number
  payment_method?: 'cash' | 'debt' | 'mixed'
  customer_name?: string | null
}

export interface SaleItem {
  id: number
  sale_id: number
  protein_id: number | null
  name_snapshot: string
  unit_price_cents: number
  quantity: number
  line_total_cents: number
  starch_id?: number | null
}

export interface SaleWithItems extends Sale {
  items: SaleItem[]
  customer_name?: string
  starch_name?: string
}

export interface Payment {
  id: number
  customer_id: number
  amount_cents: number
  created_at: string
  created_by: number | null
  note: string | null
}

export interface PaymentAllocation {
  id: number
  payment_id: number
  sale_id: number
  amount_cents: number
}

export interface Expense {
  id: number
  till_session_id: number | null
  created_at: string
  date: string
  category: string
  description: string | null
  amount_cents: number
  payment_source: 'till' | 'personal' | 'mpesa'
  reference: string | null
  created_by: number | null
  deleted_at: string | null
  deleted_by: number | null
}

export interface Reimbursement {
  id: number
  amount_cents: number
  created_at: string
  created_by: number | null
  note: string | null
}

export interface ProteinPurchase {
  id: number
  protein_id: number
  purchase_date: string
  quantity_kg: number
  cost_cents: number
  expected_yield: number
  created_by: number | null
}

export interface CookEvent {
  id: number
  protein_id: number
  cook_date: string
  portions_cooked: number
  created_by: number | null
}

export interface FoodCostSummary {
  protein_name: string
  purchased: number
  cooked: number
  sold: number
  waste: number
  cost_cents: number
  revenue_cents: number
  margin_cents: number
}

// === IPC Payloads ===
export interface SaleItemInput {
  protein_id: number
  starch_id?: number | null
  price_cents: number
}

export interface CreateSalePayload {
  customer_name?: string
  subtotal_cents: number
  discount_cents: number
  discount_reason?: string
  total_cents: number
  debt_cents: number
  payment_method: 'cash' | 'debt' | 'mixed'
  till_session_id?: number | null
  created_by: number
  items: SaleItemInput[]
}

export interface CreateExpensePayload {
  category: string
  description?: string
  amount_cents: number
  payment_source: 'till' | 'personal' | 'mpesa'
  reference?: string
  date?: string
}

export interface CreatePaymentPayload {
  customer_id: number
  amount_cents: number
  allocations: { sale_id: number; amount_cents: number }[]
}

// === API Shape ===
export interface Api {
  ping: () => Promise<string>
  // Auth
  'auth:login': (pin: string) => Promise<{ userId: number; role: string } | null>
  // Sales
  'sales:create': (payload: CreateSalePayload) => Promise<Sale>
  'sales:void': (id: number, reason: string) => Promise<void>
  'sales:list': (filters?: { status?: string; date_from?: string; date_to?: string }) => Promise<SaleWithItems[]>
  'sales:get': (id: number) => Promise<SaleWithItems>
  'sales:listByDate': (date: string) => Promise<Sale[]>
  'sales:getById': (id: number) => Promise<Sale | null>
  // Customers
  'customers:create': (name: string, phone?: string) => Promise<Customer>
  'customers:list': () => Promise<CustomerWithBalance[]>
  'customers:get': (id: number) => Promise<CustomerWithBalance & { orders: SaleWithItems[] }>
  // Payments
  'payments:create': (payload: CreatePaymentPayload) => Promise<Payment>
  'payments:list': (customerId: number) => Promise<Payment[]>
  // Expenses
  'expenses:create': (payload: CreateExpensePayload) => Promise<Expense>
  'expenses:update': (id: number, payload: Partial<CreateExpensePayload>) => Promise<Expense>
  'expenses:delete': (id: number) => Promise<void>
  'expenses:list': (filters?: { date_from?: string; date_to?: string; category?: string; payment_source?: string }) => Promise<Expense[]>
  // Reimbursements
  'reimbursements:create': (amount_cents: number, note?: string) => Promise<Reimbursement>
  'reimbursements:balance': () => Promise<{ owed_to_owner_cents: number }>
  // Till
  'till:open': (floatCents: number) => Promise<TillSession>
  'till:close': (countedCents: number) => Promise<{ expected: number; variance: number }>
  'till:current': () => Promise<TillSession | null>
  'till:countCash': () => Promise<TillCountData | null>
  // Food Cost
  'foodCost:purchases:list': (date: string) => Promise<ProteinPurchase[]>
  'foodCost:purchases:create': (payload: { protein_id: number; quantity_kg: number; cost_cents: number; expected_yield: number }) => Promise<ProteinPurchase>
  'foodCost:cookEvents:list': (date: string) => Promise<CookEvent[]>
  'foodCost:cookEvents:create': (payload: { protein_id: number; portions_cooked: number }) => Promise<CookEvent>
  'foodCost:summary': (date: string) => Promise<FoodCostSummary[]>
  // Reports
  'reports:daily': (date: string) => Promise<any>
  'reports:weekly': (date: string) => Promise<any>
  'reports:monthly': (date: string) => Promise<any>
  'reports:exportCsv': (range: { from: string; to: string }) => Promise<string>
  // Menu
  'proteins:list': () => Promise<Protein[]>
  'proteins:upsert': (payload: Partial<Protein>) => Promise<Protein>
  'proteins:setOutOfStock': (id: number, outOfStock: boolean) => Promise<void>
  'starches:list': () => Promise<Starch[]>
  'starches:upsert': (payload: Partial<Starch>) => Promise<Starch>
  // Settings
  'settings:get': () => Promise<Record<string, string>>
  'settings:update': (partial: Record<string, string>) => Promise<void>
  'backup:create': () => Promise<string>
  'backup:restore': (filePath: string) => Promise<void>
}
