// === Entities ===
export type Role = 'admin' | 'cashier'

export interface User {
  id: number
  name: string
  role: Role
  active: number
  created_at?: string
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

export interface Category {
  id: number
  name: string
  kind: 'priced' | 'free'
  sort_order: number
  active: number
  purchase_only?: number
}

export interface MenuItem {
  id: number
  category_id: number
  name: string
  selling_price_cents: number
  cost_price_cents: number
  out_of_stock: number
  active: number
  purchase_unit?: string
}

export interface AttributeDef {
  id: number
  category_id: number | null
  name: string
  type: 'text' | 'number' | 'boolean'
  sort_order: number
}

export interface AttributeValue {
  attr_def_id: number
  name: string
  type: 'text' | 'number' | 'boolean'
  value_text: string | null
  value_number: number | null
  value_boolean: number | null
}

export interface MenuItemWithCategory extends MenuItem {
  category_name: string
  category_kind: 'priced' | 'free'
  attribute_values?: AttributeValue[]
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
  item_id: number | null
  name_snapshot: string
  unit_price_cents: number
  quantity: number
  line_total_cents: number
  free_item_id?: number | null
}

export interface SaleWithItems extends Sale {
  items: SaleItem[]
  customer_name?: string
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
  sale_id: number
  amount_cents: number
}

export interface OpenDebt {
  sale_id: number
  customer_name: string | null
  debt_cents: number
  total_cents: number
  paid_cents: number
  remaining_cents: number
  created_at: string
  days_open: number
  last_payment_at: string | null
}

export interface CustomerBalance {
  customer_name: string
  total_owed_cents: number
  total_paid_cents: number
  unpaid_orders: number
  oldest_open_date: string
  newest_open_date: string
  last_payment_at: string | null
}

export interface PaymentHistoryEntry {
  id: number
  sale_id: number
  amount_cents: number
  payment_method: string
  till_session_id: number | null
  created_by: number | null
  created_at: string
  sale_total_cents: number
  sale_created_at: string
}

export interface CustomerDetail {
  customer_name: string
  total_owed_cents: number
  open_debts: OpenDebt[]
  payments: PaymentHistoryEntry[]
}

export interface PayOnAccountPayload {
  customer_name: string
  amount_cents: number
  till_session_id: number | null
  created_by: number
  payment_method?: string
}

export interface PayOnAccountResult {
  total_applied_cents: number
  allocations: { sale_id: number; amount_cents: number }[]
  settled_sale_ids: number[]
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
  description: string | null
  amount_cents: number
  till_session_id: number | null
  created_by: number | null
  date: string
  paid_to: 'till' | 'mpesa'
  created_at: string
}

// === Assets ===
export const ASSET_CATEGORIES: { name: string; default_life_months: number }[] = [
  { name: 'Kitchen Equipment', default_life_months: 120 },
  { name: 'Utensils / Smallware', default_life_months: 24 },
  { name: 'Furniture', default_life_months: 60 },
  { name: 'Electronics', default_life_months: 60 },
  { name: 'Vehicle', default_life_months: 120 },
  { name: 'Other', default_life_months: 60 },
]

export interface Asset {
  id: number
  name: string
  category: string
  quantity: number
  purchase_date: string
  purchase_cost_cents: number
  salvage_cents: number
  useful_life_months: number
  location: string | null
  notes: string | null
  active: number
  disposed_at: string | null
  disposed_reason: string | null
  sold_proceeds_cents: number | null
  created_at: string
  created_by: number | null
}

export interface AssetWithValue extends Asset {
  months_elapsed: number
  accumulated_depreciation_cents: number
  net_book_value_cents: number
  monthly_depreciation_cents: number
}

export interface CreateAssetPayload {
  name: string
  category: string
  quantity?: number
  purchase_date: string
  purchase_cost_cents: number
  salvage_cents?: number
  useful_life_months: number
  location?: string
  notes?: string
}

export interface DisposeAssetPayload {
  disposed_at: string
  reason: string
  proceeds_cents?: number
}

export interface AssetSummary {
  total_cost_cents: number
  total_book_value_cents: number
  total_monthly_depreciation_cents: number
  total_accumulated_cents: number
  active_count: number
  disposed_count: number
}

export interface ItemPurchase {
  id: number
  item_id: number
  purchase_date: string
  quantity_kg: number
  cost_cents: number
  expected_yield: number
  created_by: number | null
  unit?: string
  yield_item_id?: number | null
  created_at?: string
}

export interface PurchaseYield {
  id: number
  item_id: number
  name: string
  portions: number
  cost_cents: number
}

export interface WasteRecord {
  id: number
  item_id: number
  quantity: number
  estimated_value_cents: number
  reason: 'staff_meal' | 'spoiled' | 'other'
  waste_date: string
  notes: string | null
  created_at: string
  item_name?: string
}

export interface ItemPurchaseWithName extends ItemPurchase {
  item_name?: string
  unit_cost_cents?: number
  yield_item_name?: string
  yields?: PurchaseYield[]
}

export interface WasteByItem {
  item_name: string
  total_quantity: number
  total_value_cents: number
}

export interface ItemPerformance {
  category_name: string
  item_name: string
  quantity_sold: number
  price_per_item_cents: number
  amount_sold_cents: number
  cost_cents: number
  profit_cents: number
}

export interface FoodCostSummary {
  item_name: string
  purchased: number
  cooked: number
  sold: number
  waste: number
  cost_cents: number
  revenue_cents: number
  margin_cents: number
}

// === Reports ===
export interface DailyReport {
  date: string
  sales_revenue_cents: number
  debt_sales_cents: number
  food_purchase_cents: number
  waste_cents: number
  expense_cents: number
  reimbursement_cents: number
  net_profit_cents: number
}

export interface MonthlyReport {
  month: string
  sales_revenue_cents: number
  debt_sales_cents: number
  food_purchase_cents: number
  waste_cents: number
  expense_cents: number
  reimbursement_cents: number
  net_profit_cents: number
}

export interface CategoryBreakdown {
  category: string
  amount_cents: number
}

export interface DebtSummaryItem {
  customer_name: string | null
  sale_id: number
  debt_cents: number
  paid_cents: number
  total_debt_cents: number
  days_open: number
  last_payment_at: string | null
  created_at: string
}

export interface TillSummaryData {
  till_session_id: number
  opening_float_cents: number
  cash_sales_cents: number
  till_expenses_cents: number
  reimbursements_cents: number
  expected_cash_cents: number
  closed_at: string | null
}

// === IPC Payloads ===
export interface SaleItemInput {
  item_id: number
  free_item_id?: number | null
  price_cents: number
  quantity?: number
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

export interface RawInputDraft {
  name: string
  unit: string
  costPerUnit: number
}

export interface MealYieldDraft {
  rawInputName: string
  portions: number
}

export interface MealDraft {
  name: string
  category: string
  sellingPrice: number
  costPerServing: number
  yields: MealYieldDraft[]
}

export interface SetupPayload {
  businessName: string
  phone: string
  address: string
  managerName: string
  managerPin: string
  rawInputs: RawInputDraft[]
  meals: MealDraft[]
}

// === API Shape ===
export interface Api {
  ping: () => Promise<string>
  'auth:login': (pin: string) => Promise<{ userId: number; role: Role; name: string } | null>
  'sales:create': (payload: CreateSalePayload) => Promise<Sale>
  'sales:void': (id: number, reason: string) => Promise<void>
  'sales:list': (filters?: { status?: string; date_from?: string; date_to?: string }) => Promise<SaleWithItems[]>
  'sales:get': (id: number) => Promise<SaleWithItems>
  'sales:listByDate': (date: string) => Promise<Sale[]>
  'sales:getById': (id: number) => Promise<Sale | null>
  'expenses:create': (payload: CreateExpensePayload) => Promise<Expense>
  'expenses:update': (id: number, payload: Partial<CreateExpensePayload>) => Promise<Expense>
  'expenses:delete': (id: number) => Promise<void>
  'expenses:list': (filters?: { date_from?: string; date_to?: string; category?: string; payment_source?: string }) => Promise<Expense[]>
  'reimbursements:create': (payload: { description: string; amount_cents: number; till_session_id?: number | null; created_by: number; date: string; paid_to: 'till' | 'mpesa' }) => Promise<Reimbursement>
  'reimbursements:list': (start: string, end: string) => Promise<Reimbursement[]>
  'reimbursements:delete': (id: number) => Promise<void>
  'till:open': (floatCents: number) => Promise<TillSession>
  'till:close': (countedCents: number) => Promise<{ expected: number; variance: number }>
  'till:current': () => Promise<TillSession | null>
  'till:countCash': () => Promise<TillCountData | null>
  'inventory:recordPurchase': (payload: { item_id: number; quantity: number; cost_cents: number; date: string; created_by: number | null; unit?: string; yield_item_id?: number | null; expected_yield?: number; yields?: { itemId: number; portions: number }[] }) => Promise<ItemPurchaseWithName>
  'inventory:byDate': (date: string) => Promise<ItemPurchaseWithName[]>
  'inventory:byDateRange': (start: string, end: string) => Promise<ItemPurchaseWithName[]>
  'inventory:dailyTotal': (date: string) => Promise<number>
  'waste:record': (payload: { item_id: number; quantity: number; estimated_value_cents: number; reason: 'staff_meal' | 'spoiled' | 'other'; waste_date: string; notes?: string }) => Promise<WasteRecord>
  'waste:byDate': (date: string) => Promise<WasteRecord[]>
  'waste:byDateRange': (start: string, end: string) => Promise<WasteRecord[]>
  'waste:byItem': (start: string, end: string) => Promise<WasteByItem[]>
  'waste:dailyTotal': (date: string) => Promise<number>
  'reports:daily': (start: string, end: string) => Promise<DailyReport[]>
  'reports:monthly': (year: number) => Promise<MonthlyReport[]>
  'reports:categoryBreakdown': (start: string, end: string) => Promise<CategoryBreakdown[]>
  'reports:itemPerformance': (start: string, end: string) => Promise<ItemPerformance[]>
  'reports:debtSummary': () => Promise<DebtSummaryItem[]>
  'reports:sales': (start: string, end: string) => Promise<SaleWithItems[]>
  'reports:tillSummary': (tillSessionId: number) => Promise<TillSummaryData | null>
  'reports:exportCsv': (range: { from: string; to: string }) => Promise<string>
  'items:list': (filters?: { categoryId?: number; kind?: 'priced' | 'free'; activeOnly?: boolean }) => Promise<MenuItemWithCategory[]>
  'items:upsert': (payload: Partial<MenuItem> & { id?: number }) => Promise<MenuItemWithCategory>
  'items:setOutOfStock': (id: number, outOfStock: boolean) => Promise<void>
  'items:delete': (id: number) => Promise<void>
  'categories:list': (activeOnly?: boolean) => Promise<Category[]>
  'categories:upsert': (payload: Partial<Category> & { id?: number }) => Promise<Category>
  'categories:delete': (id: number) => Promise<void>
  'attributes:list': (filters?: { categoryId?: number | null }) => Promise<AttributeDef[]>
  'attributes:upsert': (payload: Partial<AttributeDef> & { id?: number }) => Promise<AttributeDef>
  'attributes:delete': (id: number) => Promise<void>
  'attributes:saveValues': (payload: { itemId: number; values: Array<{ attr_def_id: number; value_text?: string; value_number?: number; value_boolean?: boolean }> }) => Promise<void>
  'settings:get': () => Promise<Record<string, string>>
  'settings:update': (partial: Record<string, string>) => Promise<void>
  'users:setPin': (userId: number, oldPin: string, newPin: string) => Promise<boolean>
  'users:list': () => Promise<User[]>
  'users:create': (payload: { name: string; role: Role; pin: string }) => Promise<User>
  'users:update': (payload: { id: number; name?: string; role?: Role; active?: number }) => Promise<User | null>
  'users:resetPin': (payload: { id: number; newPin: string }) => Promise<boolean>
  'backup:export': () => Promise<string | null>
  'backup:import': () => Promise<{ ok: boolean; message: string }>
  'system:status': () => Promise<{ needsSetup: boolean }>
  'system:purge': () => Promise<void>
  'setup:save': (payload: SetupPayload) => Promise<{ userId: number }>
  'debts:listOpen': () => Promise<OpenDebt[]>
  'debts:recordPayment': (payload: { sale_id: number; amount_cents: number; payment_method: string; till_session_id: number | null; created_by: number }) => Promise<{ remaining_cents: number; sale_status: string }>
  'debts:customerBalances': () => Promise<CustomerBalance[]>
  'debts:customerDetail': (customer_name: string) => Promise<CustomerDetail>
  'debts:balanceByName': (customer_name: string) => Promise<number>
  'debts:payOnAccount': (payload: PayOnAccountPayload) => Promise<PayOnAccountResult>
  'debts:getTotalOwed': (sale_id: number) => Promise<number>
  'debts:history': (sale_id: number) => Promise<PaymentHistoryEntry[]>
  'assets:list': () => Promise<AssetWithValue[]>
  'assets:get': (id: number) => Promise<AssetWithValue | null>
  'assets:create': (payload: CreateAssetPayload) => Promise<AssetWithValue>
  'assets:update': (id: number, payload: Partial<CreateAssetPayload>) => Promise<AssetWithValue>
  'assets:dispose': (id: number, payload: DisposeAssetPayload) => Promise<AssetWithValue>
  'assets:summary': () => Promise<AssetSummary>
}
