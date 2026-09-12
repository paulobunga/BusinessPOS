import { Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
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
    <div className="flex items-center gap-3 border-b border-border py-2">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary/10 text-sm font-extrabold text-primary">
        {tile}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{item.itemName}</p>
        <p className="text-xs font-medium text-muted-foreground">
          {item.addOnName ? `+ ${item.addOnName}` : `${fmt(item.itemPrice)} each`}
        </p>
      </div>
      <div className="flex items-center">
        <Button
          onClick={() => onDecrement(index)}
          variant="outline"
          size="icon"
          aria-label="Decrease quantity"
          className="h-11 w-11 rounded-full bg-card"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-7 text-center text-sm font-extrabold">{item.quantity}</span>
        <Button
          onClick={() => onIncrement(index)}
          variant="outline"
          size="icon"
          aria-label="Increase quantity"
          className="h-11 w-11 rounded-full bg-card"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => onRemove(index)}
          variant="ghost"
          size="icon"
          aria-label="Remove line"
          className="ml-1 h-11 w-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>
      <span className="w-[76px] text-right text-sm font-extrabold">{fmt(calcLineTotal(item))}</span>
    </div>
  )
}