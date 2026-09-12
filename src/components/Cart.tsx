import { Settings2 } from 'lucide-react'
import { CartItem } from './CartItem'
import { Button } from './ui/button'
import type { CartLine } from '../hooks/cartItems'

interface CartProps {
  items: CartLine[]
  subtotal: number
  discountCents: number
  discountReason: string
  total: number
  onRemoveItem: (index: number) => void
  onIncrement: (index: number) => void
  onDecrement: (index: number) => void
  onClear: () => void
  onOpenOptions: () => void
  onCompleteSale: () => void
}

export function Cart({ items, subtotal, discountCents, discountReason, total, onRemoveItem, onIncrement, onDecrement, onClear, onOpenOptions, onCompleteSale }: CartProps) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1 pb-3">
        <h2 className="text-xl font-bold">Current Order</h2>
        <div className="flex items-center gap-2">
          <Button
            onClick={onClear}
            disabled={items.length === 0}
            variant="ghost"
            className="h-9 rounded-full bg-destructive/10 px-3 text-xs font-bold text-destructive hover:bg-destructive/20 hover:text-destructive"
          >
            Clear All
          </Button>
          <Button
            onClick={onOpenOptions}
            variant="outline"
            size="icon"
            aria-label="Order settings"
            className="h-9 w-9 rounded-full border-border bg-card text-muted-foreground"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto divide-y divide-border pr-1">
        {items.length === 0 ? (
          <p className="mt-6 text-center text-sm font-medium text-muted-foreground">No items in this order</p>
        ) : (
          items.map((item, i) => (
            <CartItem
              key={`${item.itemId}-${item.addOnId ?? 'none'}`}
              item={item}
              index={i}
              onRemove={onRemoveItem}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
            />
          ))
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t-2 border-border pt-4">
        <div className="flex flex-col gap-1.5 rounded-[var(--radius-lg)] border border-border bg-background/50 p-4">
          <div className="flex justify-between">
            <span className="text-sm font-medium text-muted-foreground">Subtotal</span>
            <span className="text-sm font-bold">{fmt(subtotal)}</span>
          </div>
          {discountCents > 0 && (
            <div className="flex justify-between">
              <span className="text-sm font-medium text-destructive">Discount ({discountReason})</span>
              <span className="text-sm font-bold text-destructive">-{fmt(discountCents)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-border pt-2">
            <span className="text-2xl font-extrabold">Total</span>
            <span className="text-2xl font-extrabold text-primary">{fmt(total)}</span>
          </div>
        </div>

        <Button
          onClick={onCompleteSale}
          disabled={items.length === 0}
          className="h-14 w-full bg-primary text-base font-bold text-white"
        >
          Complete Sale
        </Button>
      </div>
    </div>
  )
}