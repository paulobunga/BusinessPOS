import { CartItem } from './CartItem'
import type { CartItemState } from '../hooks/useCart'

interface CartProps {
  items: CartItemState[]
  subtotal: number
  discountCents: number
  discountReason: string
  total: number
  onRemoveItem: (index: number) => void
  onSetDiscount: () => void
  onDebtSale: () => void
  onCompleteSale: () => void
}

export function Cart({ items, subtotal, discountCents, discountReason, total, onRemoveItem, onSetDiscount, onDebtSale, onCompleteSale }: CartProps) {
  const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px' }}>
        {items.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: 24 }}>Cart is empty</p>
        ) : (
          items.map((item, i) => <CartItem key={i} item={item} index={i} onRemove={onRemoveItem} />)
        )}
      </div>

      <div style={{ borderTop: '2px solid var(--color-border)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600 }}>Subtotal</span>
          <span style={{ fontWeight: 700 }}>{fmt(subtotal)}</span>
        </div>
        {discountCents > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-danger)' }}>
            <span style={{ fontWeight: 600 }}>Discount ({discountReason})</span>
            <span style={{ fontWeight: 700 }}>-{fmt(discountCents)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem' }}>
          <span style={{ fontWeight: 700 }}>Total</span>
          <span style={{ fontWeight: 800, color: 'var(--color-primary)' }}>{fmt(total)}</span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={onSetDiscount} style={{ flex: 1, height: 48, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontWeight: 600, cursor: 'pointer' }}>
            Discount
          </button>
          <button onClick={onDebtSale} disabled={items.length === 0} style={{ flex: 1, height: 48, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-warning)', background: 'var(--color-surface)', color: 'var(--color-warning)', fontWeight: 700, cursor: items.length === 0 ? 'not-allowed' : 'pointer', opacity: items.length === 0 ? 0.5 : 1 }}>
            Debt
          </button>
          <button onClick={onCompleteSale} disabled={items.length === 0} style={{ flex: 2, height: 48, borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-primary)', color: 'white', fontWeight: 700, cursor: items.length === 0 ? 'not-allowed' : 'pointer', opacity: items.length === 0 ? 0.5 : 1 }}>
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  )
}