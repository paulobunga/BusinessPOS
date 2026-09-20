import { cn } from '@/lib/utils'
import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { useCategories } from '../../hooks/useCategories'
import { useItems } from '../../hooks/useItems'
import {
  addItemToCart,
  attachAddOnToCart,
  calcSubtotal,
  decrementCartLine,
  incrementCartLine,
  removeCartLine,
  setLinePrice,
  type CartLine,
} from '../../hooks/cartItems'
import { ItemCard } from '../../components/ItemCard'
import { AddOnSelector } from '../../components/AddOnSelector'
import { Cart } from '../../components/Cart'
import { CartOptionsModal } from '../../components/CartOptionsModal'
import { DiscountModal } from '../../components/DiscountModal'
import { DebtModal } from '../../components/DebtModal'
import { CaptainOrderModal } from '../../components/CaptainOrderModal'
import { Button } from '../../components/ui/button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { useTill } from '../../context/TillContext'
import { usePosTabs, type PosTab } from '../../context/PosTabsContext'
import type { Category, MenuItemWithCategory } from '../../../shared/types'
import type { CreateSalePayload, CreateCaptainOrderPayload } from '../../../shared/types'

export function SellPage() {
  const { categories, loading: categoriesLoading, error: categoriesError, retry: retryCategories } = useCategories(false)
  const { items, loading: itemsLoading, error: itemsError, retry: retryItems } = useItems()
  const { tabs, setTabs, activeTabId, setActiveTabId, createTab } = usePosTabs()
  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0]
  const { userId } = useAuth()
  const { currentTill } = useTill()
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [selectedItem, setSelectedItem] = useState<MenuItemWithCategory | null>(null)
  const [showDiscount, setShowDiscount] = useState(false)
  const [showDebt, setShowDebt] = useState(false)
  const [showCaptain, setShowCaptain] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [lastSaleId, setLastSaleId] = useState<number | null>(null)
  const [pendingSale, setPendingSale] = useState<{ paymentMethod: 'cash' | 'debt'; customerName?: string; paidNowCents: number; tabId: string } | null>(null)
  const [pendingCaptain, setPendingCaptain] = useState<{ serviceDescription: string; customerName?: string; tabId: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [closingTab, setClosingTab] = useState<PosTab | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [availability, setAvailability] = useState<Record<number, number | null>>({})

  const refreshAvailability = async (ids: number[]) => {
    if (ids.length === 0) return
    const getAvailability = (window.api as unknown as Record<string, ((itemIds: number[]) => Promise<Record<number, number | null>>) | undefined>)['inventory:stockAvailability']
    if (typeof getAvailability !== 'function') return
    try {
      const result = await getAvailability(ids)
      setAvailability(prev => ({ ...prev, ...result }))
    } catch {
      // stock tracking unavailable — items remain sellable
    }
  }

  useEffect(() => {
    void refreshAvailability(items.map(i => i.id))
  }, [items])

  // Facade over the active tab's cart so Cart + modals keep working unchanged
  const cart = useMemo(() => {
    const id = activeTab.id
    const subtotal = calcSubtotal(activeTab.items)
    return {
      items: activeTab.items,
      subtotal,
      discountCents: activeTab.discountCents,
      discountReason: activeTab.discountReason,
      total: Math.max(0, subtotal - activeTab.discountCents),
      itemCount: activeTab.items.reduce((s, l) => s + l.quantity, 0),
      addItem: (item: { id: number; name: string; selling_price_cents: number }) =>
        setTabs(prev => prev.map(t => (t.id === id ? { ...t, items: addItemToCart(t.items, item) } : t))),
      increment: (index: number) =>
        setTabs(prev => prev.map(t => (t.id === id ? { ...t, items: incrementCartLine(t.items, index) } : t))),
      decrement: (index: number) =>
        setTabs(prev => prev.map(t => (t.id === id ? { ...t, items: decrementCartLine(t.items, index) } : t))),
      removeItem: (index: number) =>
        setTabs(prev => prev.map(t => (t.id === id ? { ...t, items: removeCartLine(t.items, index) } : t))),
      setLinePrice: (index: number, cents: number) =>
        setTabs(prev => prev.map(t => (t.id === id ? { ...t, items: setLinePrice(t.items, index, cents) } : t))),
      attachAddOn: (data: {
        pricedItemId: number
        pricedItemName: string
        pricedPrice: number
        addOnId: number
        addOnName: string
      }) => setTabs(prev => prev.map(t => (t.id === id ? { ...t, items: attachAddOnToCart(t.items, data) } : t))),
      clearCart: (tabId: string = id) =>
        setTabs(prev => prev.map(t => (t.id === tabId ? { ...t, items: [], discountCents: 0, discountReason: '' } : t))),
      setDiscountCents: (cents: number) =>
        setTabs(prev => prev.map(t => (t.id === id ? { ...t, discountCents: cents } : t))),
      setDiscountReason: (reason: string) =>
        setTabs(prev => prev.map(t => (t.id === id ? { ...t, discountReason: reason } : t))),
      setTabLabel: (tabId: string, label: string) =>
        setTabs(prev => prev.map(t => (t.id === tabId ? { ...t, label } : t))),
    }
  }, [activeTab])

  useEffect(() => {
    const isEditableTarget = (t: EventTarget | null): boolean => {
      const el = t as HTMLElement | null
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (showOptions || showDiscount || showDebt || showCaptain || pendingSale || pendingCaptain) return
      if (isEditableTarget(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Backspace') {
        e.preventDefault()
        setSearchQuery(q => q.slice(0, -1))
        return
      }
      if (e.key === 'Delete' || e.key === 'Escape') {
        setSearchQuery('')
        return
      }
      if (e.key.length === 1) {
        setSearchQuery(q => q + e.key)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showOptions, showDiscount, showDebt, showCaptain, pendingSale, pendingCaptain])

  const activeCategories = categories.filter(c => c.active && c.purchase_only !== 1)
  const pricedCategories = activeCategories.filter(c => c.kind === 'priced')
  const selectedCategory: Category | undefined = activeCategories.find(c => c.id === selectedCategoryId) ?? pricedCategories[0] ?? activeCategories[0]

  const freeCategories = categories.filter(c => c.kind === 'free' && c.active)
  const freeItems = items.filter(i => i.category_kind === 'free' && i.active)

  const query = searchQuery.trim().toLowerCase()
  const searching = query.length > 0

  const matchesQuery = (i: MenuItemWithCategory): boolean => {
    if (i.category_kind !== 'priced' || !i.active) return false
    return i.name.toLowerCase().includes(query) || i.category_name.toLowerCase().includes(query)
  }

  const displayItems = searching
    ? items.filter(matchesQuery)
    : selectedCategory
      ? items.filter(i => i.category_id === selectedCategory.id && i.active)
      : []
  const displayHeading = searching
    ? `Results for "${searchQuery.trim()}"`
    : `Select ${selectedCategory?.name ?? 'Item'}`

  const handleCategorySelect = (category: Category) => {
    setSelectedCategoryId(category.id)
    setSelectedItem(null)
    setSearchQuery('')
  }

  const handleItemSelect = (item: MenuItemWithCategory) => {
    if (item.category_kind !== 'priced') return
    const left = availability[item.id]
    if (left != null && left <= 0) return
    setSelectedItem(item)
    cart.addItem(item)
  }

  const handleAddOnSelect = (item: MenuItemWithCategory) => {
    if (selectedItem) {
      cart.attachAddOn({
        pricedItemId: selectedItem.id,
        pricedItemName: selectedItem.name,
        pricedPrice: selectedItem.selling_price_cents,
        addOnId: item.id,
        addOnName: item.name,
      })
    }
    setSelectedItem(null)
  }

  const requestSale = (paymentMethod: 'cash' | 'debt', customerName?: string, paidNowCents = 0) => {
    if (cart.items.length === 0) return
    if (!currentTill) {
      setMessage('No till session is open. Open the till before completing a sale.')
      return
    }
    if (userId == null) {
      setMessage('You must be signed in to complete a sale.')
      return
    }
    setPendingSale({ paymentMethod, customerName, paidNowCents, tabId: activeTab.id })
  }

  const completeSale = async (paymentMethod: 'cash' | 'debt', customerName?: string, paidNowCents = 0, tabId: string = activeTab.id) => {
    const tab = tabs.find(t => t.id === tabId) ?? activeTab
    if (!currentTill || userId == null || tab.items.length === 0) return
    setSaving(true)
    setMessage(null)
    const subtotal = calcSubtotal(tab.items)
    const total = Math.max(0, subtotal - tab.discountCents)
    try {
      const isDebtFlow = paymentMethod === 'debt'
      const method: 'cash' | 'debt' | 'mixed' = !isDebtFlow
        ? 'cash'
        : paidNowCents >= total
          ? 'cash'
          : paidNowCents > 0
            ? 'mixed'
            : 'debt'
      const debtCents = method === 'cash' ? 0 : total - paidNowCents
      const payload: CreateSalePayload = {
        customer_name: method !== 'cash' ? customerName : undefined,
        subtotal_cents: subtotal,
        discount_cents: tab.discountCents,
        discount_reason: tab.discountReason || undefined,
        total_cents: total,
        debt_cents: debtCents,
        payment_method: method,
        till_session_id: currentTill.id,
        created_by: userId,
        items: tab.items.map(item => ({
          item_id: item.itemId,
          free_item_id: item.addOnId ?? null,
          price_cents: item.itemPrice,
          quantity: item.quantity,
        })),
      }
      const sale = await window.api['sales:create'](payload)
      setLastSaleId(sale.id)
      cart.clearCart(tabId)
      if (customerName?.trim()) cart.setTabLabel(tabId, customerName.trim())
      setSelectedItem(null)
      setSearchQuery('')
      setSuccess(true)
      void refreshAvailability(tab.items.map(i => i.itemId))
      setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      setMessage('Sale failed: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const completeCaptainOrder = async (serviceDescription: string, customerName?: string, tabId: string = activeTab.id) => {
    const tab = tabs.find(t => t.id === tabId) ?? activeTab
    if (!currentTill || userId == null || tab.items.length === 0) return
    setSaving(true)
    setMessage(null)
    const subtotal = calcSubtotal(tab.items)
    const total = Math.max(0, subtotal - tab.discountCents)
    try {
      const payload: CreateCaptainOrderPayload = {
        customer_name: customerName || undefined,
        service_description: serviceDescription,
        subtotal_cents: subtotal,
        discount_cents: tab.discountCents,
        discount_reason: tab.discountReason || undefined,
        total_cents: total,
        till_session_id: currentTill.id,
        created_by: userId,
        items: tab.items.map(item => ({
          item_id: item.itemId,
          free_item_id: item.addOnId ?? null,
          price_cents: item.itemPrice,
          quantity: item.quantity,
        })),
      }
      const order = await window.api['sales:createCaptainOrder'](payload)
      setLastSaleId(order.id)
      cart.clearCart(tabId)
      if (customerName?.trim()) cart.setTabLabel(tabId, customerName.trim())
      setSelectedItem(null)
      setSearchQuery('')
      setSuccess(true)
      void refreshAvailability(tab.items.map(i => i.itemId))
      setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      setMessage('Captain order failed: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handlePrintLastReceipt = async () => {
    if (lastSaleId == null) return
    try {
      const res = await window.api['print:ticket']({ orderId: lastSaleId, kind: 'receipt' })
      if (!res.ok) setMessage(res.error ?? res.skipped ?? 'Print failed')
    } catch (err) {
      setMessage('Print failed: ' + (err as Error).message)
    }
  }

  const switchTab = (id: string) => {
    setActiveTabId(id)
    setSelectedItem(null)
    setShowOptions(false)
    setShowDiscount(false)
    setShowDebt(false)
    setShowCaptain(false)
    setPendingSale(null)
    setPendingCaptain(null)
  }

  const addTab = () => {
    const t = createTab()
    setTabs(prev => [...prev, t])
    switchTab(t.id)
  }

  const doCloseTab = (target: PosTab) => {
    let next = tabs.filter(t => t.id !== target.id)
    if (next.length === 0) next = [createTab()]
    setTabs(next)
    if (!next.some(t => t.id === activeTabId)) {
      const idx = tabs.findIndex(t => t.id === target.id)
      switchTab(next[Math.min(idx, next.length - 1)].id)
    }
  }

  const requestCloseTab = (target: PosTab) => {
    if (target.items.length === 0) {
      doCloseTab(target)
    } else {
      setClosingTab(target)
    }
  }

  const commitRename = () => {
    if (renamingId) {
      const v = renameValue.trim()
      if (v) setTabs(prev => prev.map(t => (t.id === renamingId ? { ...t, label: v } : t)))
    }
    setRenamingId(null)
  }

  const loading = categoriesLoading || itemsLoading
  const error = categoriesError || itemsError

  if (loading) return <div className="p-6 text-center">Loading menu...</div>

  if (error) return (
    <div className="p-6 text-center">
      <p className="mb-4 font-semibold text-destructive">{error}</p>
      <Button onClick={() => { retryCategories(); retryItems() }} variant="outline" className="border-border bg-card font-semibold">
        Retry
      </Button>
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Customer tabs */}
      <div className="flex shrink-0 items-end gap-1 overflow-x-auto border-b border-border bg-card px-3 pt-2">
        {tabs.map(t => {
          const isActive = t.id === activeTab.id
          const count = t.items.reduce((s, l) => s + l.quantity, 0)
          return (
            <div
              key={t.id}
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-t-[var(--radius-md)] border px-2 py-1.5 text-[0.875rem]',
                isActive
                  ? '-mb-px border-border border-b-background bg-background font-bold'
                  : 'border-transparent text-muted-foreground hover:bg-muted'
              )}
            >
              {renamingId === t.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  onClick={e => e.stopPropagation()}
                  className="h-6 w-28 rounded border border-border bg-background px-1 text-[0.875rem] outline-none"
                  aria-label="Tab name"
                />
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => switchTab(t.id)}
                  onDoubleClick={() => { setRenamingId(t.id); setRenameValue(t.label) }}
                  title="Double-click to rename"
                  className="flex items-center gap-1.5"
                >
                  <span className="max-w-32 truncate">{t.label}</span>
                  {count > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.6875rem] font-bold text-white">
                      {count}
                    </span>
                  )}
                </button>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={() => requestCloseTab(t)}
                aria-label={`Close ${t.label}`}
                className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
        <button
          type="button"
          disabled={saving}
          onClick={addTab}
          aria-label="New customer tab"
          title="New customer tab"
          className="mb-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
      {/* Item selection — scrolls independently */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6 pr-3">
        <h1 className="text-2xl font-bold">Point of Sale</h1>

        <p className="-mt-2 text-sm text-muted-foreground">Tip: start typing to search the menu</p>

        {/* Search indicator — the active query (typing is captured page-wide) */}
        {searching ? (
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-primary/40 bg-primary/5 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-primary" />
            <span className="flex-1 truncate text-[0.9375rem] font-semibold">{searchQuery}</span>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="grid h-6 w-6 place-items-center rounded-[var(--radius-sm)] text-muted-foreground hover:bg-muted"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            {/* Category chips */}
            <div className="flex flex-wrap gap-2">
              {activeCategories.map(c => {
                const isSelected = selectedCategory?.id === c.id
                return (
                  <Button
                    key={c.id}
                    type="button"
                    onClick={() => handleCategorySelect(c)}
                    variant={isSelected ? 'default' : 'outline'}
                    className={cn(
                      'h-11 min-h-11 rounded-full px-4 text-[0.875rem] font-bold',
                      !isSelected && 'bg-card'
                    )}
                  >
                    {c.name}
                  </Button>
                )
              })}
            </div>
          </>
        )}

        <h2 className="text-xl font-bold">{displayHeading}</h2>

        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
          {displayItems.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              selected={selectedItem?.id === item.id}
              onSelect={handleItemSelect}
              stockLeft={availability[item.id]}
            />
          ))}
        </div>

        {searching && displayItems.length === 0 && (
          <p className="rounded-[var(--radius-md)] border border-border bg-card px-4 py-3 text-center text-sm text-muted-foreground">
            No items match "{searchQuery.trim()}"
          </p>
        )}

        {selectedItem && freeCategories.length > 0 && (
          <div className="mt-2 rounded-[var(--radius-lg)] border border-border bg-card p-4">
            <p className="font-semibold">
              {selectedItem.name} — pick a free add-on
            </p>
            <AddOnSelector addOns={freeItems} onSelect={handleAddOnSelect} />
          </div>
        )}
      </div>

      {/* Cart — flush under <main>, full height */}
      <div className="flex w-[360px] min-w-[360px] shrink-0 flex-col border-l border-border bg-card p-6">
        {!currentTill && (
          <p className="mb-4 font-semibold text-warning">
            No till session is open. Sales cannot be completed until the till is opened.
          </p>
        )}
        {message && (
          <p className="mb-4 font-semibold text-destructive">{message}</p>
        )}

        <Cart
          key={activeTab.id}
          items={cart.items}
          subtotal={cart.subtotal}
          discountCents={cart.discountCents}
          discountReason={cart.discountReason}
          total={cart.total}
          onRemoveItem={cart.removeItem}
          onIncrement={cart.increment}
          onDecrement={cart.decrement}
          onSetLinePrice={cart.setLinePrice}
          onClear={cart.clearCart}
          onOpenOptions={() => setShowOptions(true)}
          onCompleteSale={() => requestSale('cash')}
        />
      </div>
      </div>

      {showOptions && (
        <CartOptionsModal
          open
          hasItems={cart.items.length > 0}
          onDiscount={() => {
            setShowOptions(false)
            setShowDiscount(true)
          }}
          onDebt={() => {
            setShowOptions(false)
            setShowDebt(true)
          }}
          onCaptain={() => {
            setShowOptions(false)
            setShowCaptain(true)
          }}
          onClose={() => setShowOptions(false)}
        />
      )}

      {showDiscount && (
        <DiscountModal
          onApply={(cents, reason) => {
            cart.setDiscountCents(cents)
            cart.setDiscountReason(reason)
          }}
          onClose={() => setShowDiscount(false)}
        />
      )}

      {showDebt && (
        <DebtModal
          total={cart.total}
          onConfirm={(name, paidNowCents) => {
            setShowDebt(false)
            requestSale('debt', name, paidNowCents)
          }}
          onClose={() => setShowDebt(false)}
        />
      )}

      {showCaptain && (
        <CaptainOrderModal
          total={cart.total}
          onConfirm={(serviceDescription, customerName) => {
            setShowCaptain(false)
            if (!currentTill || userId == null || cart.items.length === 0) return
            setPendingCaptain({ serviceDescription, customerName, tabId: activeTab.id })
          }}
          onClose={() => setShowCaptain(false)}
        />
      )}

      <ConfirmDialog
        open={pendingSale != null}
        onOpenChange={o => { if (!o) setPendingSale(null) }}
        title="Complete this sale?"
        destructive={false}
        confirmText="Complete Sale"
        onConfirm={() => {
          const p = pendingSale
          setPendingSale(null)
          if (p) completeSale(p.paymentMethod, p.customerName, p.paidNowCents, p.tabId)
        }}
      />

      <ConfirmDialog
        open={pendingCaptain != null}
        onOpenChange={o => { if (!o) setPendingCaptain(null) }}
        title="Confirm Captain Order?"
        destructive={false}
        confirmText="Confirm Order"
        onConfirm={() => {
          const p = pendingCaptain
          setPendingCaptain(null)
          if (p) completeCaptainOrder(p.serviceDescription, p.customerName, p.tabId)
        }}
      />

      <ConfirmDialog
        open={closingTab != null}
        onOpenChange={o => { if (!o) setClosingTab(null) }}
        title={`Close ${closingTab?.label ?? 'tab'}?`}
        description="Items in this order will be discarded."
        destructive
        confirmText="Close Tab"
        onConfirm={() => {
          const t = closingTab
          setClosingTab(null)
          if (t) doCloseTab(t)
        }}
      />

      {saving && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40">
          <p className="rounded-[var(--radius-lg)] bg-card px-6 py-4 font-bold">Saving sale...</p>
        </div>
      )}

      {success && (
        <div className="fixed top-6 right-6 z-[999] flex items-center gap-3 rounded-[var(--radius-md)] bg-primary px-6 py-3 font-bold text-white shadow-lg">
          <span>Sale recorded ✓</span>
          {lastSaleId != null && (
            <button
              type="button"
              className="rounded-[var(--radius-sm)] bg-white px-3 py-1 text-[0.875rem] font-bold text-primary hover:bg-white/90"
              onClick={() => void handlePrintLastReceipt()}
            >
              Print receipt
            </button>
          )}
        </div>
      )}
    </div>
  )
}