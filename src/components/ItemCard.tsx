import type { MenuItemWithCategory } from '../../shared/types'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'

interface ItemCardProps {
  item: MenuItemWithCategory
  selected: boolean
  onSelect: (item: MenuItemWithCategory) => void
}

export function ItemCard({ item, selected, onSelect }: ItemCardProps) {
  const outOfStock = item.out_of_stock === 1
  const isPriced = item.category_kind === 'priced'
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)
  const tile = item.name.trim().charAt(0).toUpperCase() || '?'

  return (
    <Button
      type="button"
      onClick={() => { if (!outOfStock) onSelect(item) }}
      disabled={outOfStock}
      variant="outline"
      className={cn(
        'flex h-auto min-h-[132px] w-full flex-col items-start justify-between gap-3 rounded-[var(--radius-md)] border p-4 text-left',
        outOfStock
          ? 'cursor-not-allowed border-dashed opacity-60'
          : selected
            ? 'border-2 border-primary bg-primary/5'
            : 'hover:border-primary/50'
      )}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className={cn('text-base font-bold leading-tight', outOfStock && 'text-muted-foreground')}>
          {item.name}
        </span>
        <span
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-lg font-extrabold',
            outOfStock
              ? 'bg-muted text-muted-foreground'
              : isPriced
                ? 'bg-primary/10 text-primary'
                : 'bg-success/10 text-success'
          )}
        >
          {outOfStock ? '—' : tile}
        </span>
      </div>
      <span
        className={cn(
          'text-lg font-extrabold',
          outOfStock
            ? 'text-muted-foreground'
            : isPriced
              ? 'text-primary'
              : 'text-success'
        )}
      >
        {outOfStock ? 'Out of stock' : isPriced ? fmt(item.selling_price_cents) : 'Free'}
      </span>
    </Button>
  )
}