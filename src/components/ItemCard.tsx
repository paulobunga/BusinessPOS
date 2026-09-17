import { UtensilsCrossed } from 'lucide-react'
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

  return (
    <Button
      type="button"
      onClick={() => { if (!outOfStock) onSelect(item) }}
      disabled={outOfStock}
      variant="outline"
      className={cn(
        'h-auto w-full flex-col items-stretch overflow-hidden rounded-[var(--radius-md)] border p-0 text-left',
        outOfStock
          ? 'cursor-not-allowed border-dashed opacity-60'
          : selected
            ? 'border-2 border-primary bg-primary/5'
            : 'hover:border-primary/50'
      )}
    >
      {/* Media area — centered icon fallback (no product images yet) */}
      <div
        className={cn(
          'flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br',
          outOfStock ? 'from-muted to-muted/60' : 'from-secondary via-secondary to-[#F3EBDD]'
        )}
      >
        <span
          className={cn(
            'grid h-16 w-16 place-items-center rounded-full',
            outOfStock ? 'bg-muted-foreground/10 text-muted-foreground' : 'bg-white/70 shadow-sm text-primary'
          )}
        >
          <UtensilsCrossed size={30} strokeWidth={1.4} />
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1 p-4 pt-3">
        <span className={cn('truncate text-[0.9375rem] font-bold leading-snug', outOfStock && 'text-muted-foreground')}>
          {item.name}
        </span>
        <span
          className={cn(
            'text-base font-extrabold',
            outOfStock
              ? 'text-muted-foreground'
              : isPriced
                ? 'text-primary'
                : 'text-success'
          )}
        >
          {outOfStock ? 'Out of stock' : isPriced ? fmt(item.selling_price_cents) : 'Free'}
        </span>
      </div>
    </Button>
  )
}