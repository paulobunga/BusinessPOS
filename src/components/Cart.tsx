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
  onSetDiscount: () => void
  onDebtSale: () => void
  onCompleteSale: () => void
}

export function Cart({ items, subtotal, discountCents, discountReason, total, onRemoveItem, onIncrement, onDecrement, onClear, onSetDiscount, onDebtSale, onCompleteSale }: CartProps) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-1 pb-3">
        <h2 className="text-xl font-bold">Current Order</h2>
        <Button
          onClick={onClear}
          disabled={items.length === 0}
          variant="ghost"
          className="h-11 px-3 font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          Clear All
        </Button>
      </div>

      <div className="flex-1 overflow-auto px-1 py-2">
        {items.length === 0 ? (
          <p className="mt-6 text-center text-sm font-medium text-muted-foreground">Cart is empty</p>
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

      <div className="flex flex-col gap-3 border-t-2 border-border p-4">
        <div className="flex flex-col gap-1.5">
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

        <div className="flex gap-2">
          <Button onClick={onSetDiscount} variant="outline" className="h-11 flex-1 bg-card font-semibold">
            Discount
          </Button>
          <Button
            onClick={onDebtSale}
            disabled={items.length === 0}
            variant="outline"
            className="h-11 flex-1 border-warning bg-card font-bold text-warning"
          >
            Debt
          </Button>
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