import type { CartItemState } from '../hooks/useCart'

interface CartItemProps {
  item: CartItemState
  index: number
  onRemove: (index: number) => void
}

export function CartItem({ item, index, onRemove }: CartItemProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
      <div>
        <span style={{ fontWeight: 600 }}>{item.itemName}</span>
        {item.addOnName && (
          <span style={{ color: 'var(--color-text-secondary)', marginLeft: 8 }}>+ {item.addOnName}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 700 }}>
          {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(item.itemPrice)}
        </span>
        <button onClick={() => onRemove(index)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontWeight: 600, fontSize: '1.2rem' }}>
          ×
        </button>
      </div>
    </div>
  )
}