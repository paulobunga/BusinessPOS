import { cn } from '@/lib/utils'
import { useState } from 'react'
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

  const activeCategories = categories.filter(c => c.active)
  const pricedCategories = activeCategories.filter(c => c.kind === 'priced')
  const selectedCategory: Category | undefined = activeCategories.find(c => c.id === selectedCategoryId) ?? pricedCategories[0] ?? activeCategories[0]

  const freeCategories = categories.filter(c => c.kind === 'free' && c.active)
  const freeItems = items.filter(i => i.category_kind === 'free' && i.active)
  const categoryItems = selectedCategory ? items.filter(i => i.category_id === selectedCategory.id && i.active) : []

  const handleCategorySelect = (category: Category) => {
    setSelectedCategoryId(category.id)
    setSelectedItem(null)
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
    <div className="flex h-full min-h-0 flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Point of Sale</h1>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
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

        <div className="flex min-h-0 flex-1 gap-6">
          {/* Item Grid */}
          <div className="flex min-w-0 flex-[2] flex-col">
            <h2 className="mb-4 text-xl font-bold">Select {selectedCategory?.name ?? 'Item'}</h2>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
                {categoryItems.map(item => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    selected={selectedItem?.id === item.id}
                    onSelect={handleItemSelect}
                  />
                ))}
              </div>

              {selectedItem && freeCategories.length > 0 && (
                <div className="mt-4 rounded-[var(--radius-lg)] border border-border bg-card p-4">
                  <p className="font-semibold">
                    {selectedItem.name} — pick a free add-on
                  </p>
                  <AddOnSelector addOns={freeItems} onSelect={handleAddOnSelect} />
                </div>
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="flex w-[360px] min-w-[360px] flex-col rounded-[var(--radius-lg)] border border-border bg-card p-6">
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