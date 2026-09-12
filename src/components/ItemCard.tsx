import type { MenuItemWithCategory } from '../../shared/types'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

interface ItemCardProps {
  item: MenuItemWithCategory
  selected: boolean
  onSelect: (item: MenuItemWithCategory) => void
}

export function ItemCard({ item, selected, onSelect }: ItemCardProps) {
  const outOfStock = item.out_of_stock === 1
  const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

  return (
    <Button
      onClick={() => { if (!outOfStock) onSelect(item) }}
      disabled={outOfStock}
      variant="outline"
      className={cn(
        'h-16 w-full justify-between rounded-[var(--radius-md)] px-4 text-base font-semibold',
        outOfStock
          ? 'cursor-not-allowed border-dashed opacity-50'
          : selected
            ? 'border-2 border-primary bg-primary text-white'
            : 'bg-card text-foreground'
      )}
    >
      <span>{item.name}</span>
      <span
        className={cn(
          'font-bold',
          !outOfStock && item.category_kind === 'free' && 'text-success',
          selected && 'text-white'
        )}
      >
        {outOfStock ? 'Out of stock' : item.category_kind === 'priced' ? fmt(item.selling_price_cents) : 'Free'}
      </span>
    </Button>
  )
}