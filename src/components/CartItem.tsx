import { Minus, Plus, Trash2 } from 'lucide-react'
import { calcLineTotal } from '../hooks/cartItems'
import type { CartLine } from '../hooks/cartItems'

interface CartItemProps {
  item: CartLine
  index: number
  onRemove: (index: number) => void
  onIncrement: (index: number) => void
  onDecrement: (index: number) => void
}

export function CartItem({ item, index, onRemove, onIncrement, onDecrement }: CartItemProps) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)
  const tile = item.itemName.trim().charAt(0).toUpperCase() || '?'

  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-extrabold text-primary">
        {tile}
      </span>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 leading-snug text-sm font-semibold">{item.itemName}</p>
        {item.addOnName && (
          <p className="truncate text-[0.6875rem] font-medium text-muted-foreground">+ {item.addOnName}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {item.quantity === 1 ? (
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Remove ${item.itemName}`}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-transform active:scale-95"
          >
            <Trash2 size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onDecrement(index)}
            aria-label={`Decrease ${item.itemName} quantity`}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform active:scale-95"
          >
            <Minus size={14} />
          </button>
        )}

        <span className="w-4 text-center text-sm font-bold tabular-nums">{item.quantity}</span>

        <button
          type="button"
          onClick={() => onIncrement(index)}
          aria-label={`Increase ${item.itemName} quantity`}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform active:scale-95"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="w-16 shrink-0 text-right">
        <span className="text-sm font-extrabold tabular-nums">{fmt(calcLineTotal(item))}</span>
      </div>
    </div>
  )
}