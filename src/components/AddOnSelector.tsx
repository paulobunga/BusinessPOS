import type { MenuItemWithCategory } from '../../shared/types'
import { Button } from './ui/button'

interface AddOnSelectorProps {
  addOns: MenuItemWithCategory[]
  onSelect: (item: MenuItemWithCategory) => void
}

export function AddOnSelector({ addOns, onSelect }: AddOnSelectorProps) {
  const freeCategoryCount = new Set(addOns.map(i => i.category_name)).size

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {addOns.map(item => (
        <Button
          key={item.id}
          onClick={() => onSelect(item)}
          variant="outline"
          className="flex h-12 flex-col items-start rounded-[var(--radius-md)] bg-card px-4 text-[0.875rem] font-semibold"
        >
          <span>{item.name}</span>
          {freeCategoryCount > 1 && (
            <span className="text-xs font-medium text-muted-foreground">
              · {item.category_name}
            </span>
          )}
        </Button>
      ))}
    </div>
  )
}