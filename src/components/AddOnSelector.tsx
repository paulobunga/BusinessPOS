import type { MenuItemWithCategory } from '../../shared/types'

interface AddOnSelectorProps {
  addOns: MenuItemWithCategory[]
  onSelect: (item: MenuItemWithCategory) => void
}

export function AddOnSelector({ addOns, onSelect }: AddOnSelectorProps) {
  const freeCategoryCount = new Set(addOns.map(i => i.category_name)).size

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
      {addOns.map(item => (
        <button
          key={item.id}
          onClick={() => onSelect(item)}
          style={{
            height: 48,
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            textAlign: 'left',
          }}
        >
          <span>{item.name}</span>
          {freeCategoryCount > 1 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              · {item.category_name}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}