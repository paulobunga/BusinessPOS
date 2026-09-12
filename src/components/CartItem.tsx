import type { CartItemState } from '../hooks/useCart'
import { Button } from './ui/button'

interface CartItemProps {
  item: CartItemState
  index: number
  onRemove: (index: number) => void
}

export function CartItem({ item, index, onRemove }: CartItemProps) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2">
      <div>
        <span className="font-semibold">{item.itemName}</span>
        {item.addOnName && (
          <span className="ml-2 text-muted-foreground">+ {item.addOnName}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-bold">
          {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(item.itemPrice)}
        </span>
        <Button
          onClick={() => onRemove(index)}
          variant="ghost"
          size="icon-sm"
          className="text-xl font-semibold text-destructive"
        >
          ×
        </Button>
      </div>
    </div>
  )
}