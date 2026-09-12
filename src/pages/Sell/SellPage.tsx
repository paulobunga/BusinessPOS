import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useCategories } from '../../hooks/useCategories'
import { useItems } from '../../hooks/useItems'
import { useCart } from '../../hooks/useCart'
import { ItemCard } from '../../components/ItemCard'
import { AddOnSelector } from '../../components/AddOnSelector'
import { Cart } from '../../components/Cart'
import { CartOptionsModal } from '../../components/CartOptionsModal'
import { DiscountModal } from '../../components/DiscountModal'
import { DebtModal } from '../../components/DebtModal'
import { Button } from '../../components/ui/button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { useTill } from '../../context/TillContext'
import type { Category, MenuItemWithCategory } from '../../../shared/types'
import type { CreateSalePayload } from '../../../shared/types'

export function SellPage() {
  const { categories, loading: categoriesLoading, error: categoriesError, retry: retryCategories } = useCategories(false)
  const { items, loading: itemsLoading, error: itemsError, retry: retryItems } = useItems()
  const cart = useCart()
  const { userId } = useAuth()
  const { currentTill } = useTill()
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [selectedItem, setSelectedItem] = useState<MenuItemWithCategory | null>(null)
  const [showDiscount, setShowDiscount] = useState(false)
  const [showDebt, setShowDebt] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pendingSale, setPendingSale] = useState<{ paymentMethod: 'cash' | 'debt'; customerName?: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const isEditableTarget = (t: EventTarget | null): boolean => {
      const el = t as HTMLElement | null
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (showOptions || showDiscount || showDebt || pendingSale) return
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
  }, [showOptions, showDiscount, showDebt, pendingSale])

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

  const requestSale = (paymentMethod: 'cash' | 'debt', customerName?: string) => {
    if (cart.items.length === 0) return
    if (!currentTill) {
      setMessage('No till session is open. Open the till before completing a sale.')
      return
    }
    if (userId == null) {
      setMessage('You must be signed in to complete a sale.')
      return
    }
    setPendingSale({ paymentMethod, customerName })
  }

  const completeSale = async (paymentMethod: 'cash' | 'debt', customerName?: string) => {
    if (!currentTill || userId == null || cart.items.length === 0) return
    setSaving(true)
    setMessage(null)
    try {
      const payload: CreateSalePayload = {
        customer_name: paymentMethod === 'debt' ? customerName : undefined,
        subtotal_cents: cart.subtotal,
        discount_cents: cart.discountCents,
        discount_reason: cart.discountReason || undefined,
        total_cents: cart.total,
        debt_cents: paymentMethod === 'debt' ? cart.total : 0,
        payment_method: paymentMethod,
        till_session_id: currentTill.id,
        created_by: userId,
        items: cart.items.map(item => ({
          item_id: item.itemId,
          free_item_id: item.addOnId ?? null,
          price_cents: item.itemPrice,
          quantity: item.quantity,
        })),
      }
      await window.api['sales:create'](payload)
      cart.clearCart()
      setSelectedItem(null)
      setSearchQuery('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      setMessage('Sale failed: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
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
    <div className="flex h-full min-h-0">
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
          items={cart.items}
          subtotal={cart.subtotal}
          discountCents={cart.discountCents}
          discountReason={cart.discountReason}
          total={cart.total}
          onRemoveItem={cart.removeItem}
          onIncrement={cart.increment}
          onDecrement={cart.decrement}
          onClear={cart.clearCart}
          onOpenOptions={() => setShowOptions(true)}
          onCompleteSale={() => requestSale('cash')}
        />
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
          onConfirm={(name) => {
            setShowDebt(false)
            requestSale('debt', name)
          }}
          onClose={() => setShowDebt(false)}
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
          if (p) completeSale(p.paymentMethod, p.customerName)
        }}
      />

      {saving && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40">
          <p className="rounded-[var(--radius-lg)] bg-card px-6 py-4 font-bold">Saving sale...</p>
        </div>
      )}

      {success && (
        <div className="fixed top-6 right-6 z-[999] rounded-[var(--radius-md)] bg-primary px-6 py-3 font-bold text-white shadow-lg">
          Sale recorded ✓
        </div>
      )}
    </div>
  )
}