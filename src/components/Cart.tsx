import { CartItem } from './CartItem'
import { Button } from './ui/button'
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
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto px-2">
        {items.length === 0 ? (
          <p className="mt-6 text-center text-muted-foreground">Cart is empty</p>
        ) : (
          items.map((item, i) => <CartItem key={i} item={item} index={i} onRemove={onRemoveItem} />)
        )}
      </div>

      <div className="flex flex-col gap-2 border-t-2 border-border p-4">
        <div className="flex justify-between">
          <span className="font-semibold">Subtotal</span>
          <span className="font-bold">{fmt(subtotal)}</span>
        </div>
        {discountCents > 0 && (
          <div className="flex justify-between text-destructive">
            <span className="font-semibold">Discount ({discountReason})</span>
            <span className="font-bold">-{fmt(discountCents)}</span>
          </div>
        )}
        <div className="flex justify-between text-xl">
          <span className="font-bold">Total</span>
          <span className="font-extrabold text-primary">{fmt(total)}</span>
        </div>

        <div className="mt-2 flex gap-2">
          <Button
            onClick={onSetDiscount}
            variant="outline"
            className="h-12 flex-1 bg-card font-semibold"
          >
            Discount
          </Button>
          <Button
            onClick={onDebtSale}
            disabled={items.length === 0}
            variant="outline"
            className="h-12 flex-1 border-warning bg-card font-bold text-warning"
          >
            Debt
          </Button>
          <Button
            onClick={onCompleteSale}
            disabled={items.length === 0}
            className="h-12 flex-[2] bg-primary font-bold text-white"
          >
            Complete Sale
          </Button>
        </div>
      </div>
    </div>
  )
}