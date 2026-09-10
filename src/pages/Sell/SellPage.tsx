import { useState } from 'react'
import { useCategories } from '../../hooks/useCategories'
import { useItems } from '../../hooks/useItems'
import { useCart } from '../../hooks/useCart'
import { ItemCard } from '../../components/ItemCard'
import { AddOnSelector } from '../../components/AddOnSelector'
import { Cart } from '../../components/Cart'
import { DiscountModal } from '../../components/DiscountModal'
import { DebtModal } from '../../components/DebtModal'
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
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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
    cart.setAddOn(item)
    setSelectedItem(null)
  }

  const completeSale = async (paymentMethod: 'cash' | 'debt', customerName?: string) => {
    if (cart.items.length === 0) return
    if (!currentTill) {
      setMessage('No till session is open. Open the till before completing a sale.')
      return
    }
    if (userId == null) {
      setMessage('You must be signed in to complete a sale.')
      return
    }
    if (!window.confirm('Complete this sale?')) return
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

  if (loading) return <div style={{ padding: 24, textAlign: 'center' }}>Loading menu...</div>

  if (error) return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <p style={{ color: 'var(--color-danger)', fontWeight: 600, marginBottom: 16 }}>{error}</p>
      <button onClick={() => { retryCategories(); retryItems() }} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontWeight: 600, cursor: 'pointer' }}>
        Retry
      </button>
    </div>
  )

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Point of Sale</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Category chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {activeCategories.map(c => (
            <button
              key={c.id}
              onClick={() => handleCategorySelect(c)}
              style={{
                height: 48,
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: selectedCategory?.id === c.id ? 'var(--color-primary)' : 'var(--color-surface)',
                color: selectedCategory?.id === c.id ? '#fff' : 'var(--color-text-primary)',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                boxShadow: selectedCategory?.id === c.id ? 'none' : 'inset 0 0 0 1px var(--color-border)',
              }}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          {/* Item Grid */}
          <div style={{ flex: 2 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>Select {selectedCategory?.name ?? 'Item'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
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
              <div style={{ marginTop: 16, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 16, border: '1px solid var(--color-border)' }}>
                <p style={{ fontWeight: 600 }}>
                  {selectedItem.name} — pick a free add-on
                </p>
                <AddOnSelector addOns={freeItems} onSelect={handleAddOnSelect} />
              </div>
            )}
          </div>

          {/* Cart */}
          <div style={{ flex: 1, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 24, border: '1px solid var(--color-border)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 16 }}>Current Sale</h2>

            {!currentTill && (
              <p style={{ color: 'var(--color-warning)', fontWeight: 600, marginBottom: 16 }}>
                No till session is open. Sales cannot be completed until the till is opened.
              </p>
            )}
            {message && (
              <p style={{ color: 'var(--color-danger)', fontWeight: 600, marginBottom: 16 }}>{message}</p>
            )}

            <Cart
              items={cart.items}
              subtotal={cart.subtotal}
              discountCents={cart.discountCents}
              discountReason={cart.discountReason}
              total={cart.total}
              onRemoveItem={cart.removeItem}
              onSetDiscount={() => setShowDiscount(true)}
              onDebtSale={() => setShowDebt(true)}
              onCompleteSale={() => completeSale('cash')}
            />
          </div>
        </div>
      </div>

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
            completeSale('debt', name)
          }}
          onClose={() => setShowDebt(false)}
        />
      )}

      {saving && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <p style={{ background: 'var(--color-surface)', padding: '16px 24px', borderRadius: 'var(--radius-lg)', fontWeight: 700 }}>Saving sale...</p>
        </div>
      )}

      {success && (
        <div style={{ position: 'fixed', top: 24, right: 24, background: 'var(--color-primary)', color: 'white', padding: '12px 24px', borderRadius: 'var(--radius-md)', fontWeight: 700, zIndex: 999, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          Sale recorded ✓
        </div>
      )}
    </div>
  )
}