import type { MenuItemWithCategory } from '../../shared/types'

interface ItemCardProps {
  item: MenuItemWithCategory
  selected: boolean
  onSelect: (item: MenuItemWithCategory) => void
}

export function ItemCard({ item, selected, onSelect }: ItemCardProps) {
  const outOfStock = item.out_of_stock === 1
  const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

  return (
    <button
      onClick={() => { if (!outOfStock) onSelect(item) }}
      disabled={outOfStock}
      style={{
        height: 64,
        padding: '8px 16px',
        borderRadius: 'var(--radius-md)',
        background: outOfStock ? 'var(--color-surface)' : selected ? 'var(--color-primary)' : 'var(--color-surface)',
        color: outOfStock ? 'var(--color-text-secondary)' : selected ? 'white' : 'var(--color-text-primary)',
        border: outOfStock ? '1px dashed var(--color-border)' : selected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
        fontWeight: 600,
        fontSize: '1rem',
        cursor: outOfStock ? 'not-allowed' : 'pointer',
        opacity: outOfStock ? 0.5 : 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        textAlign: 'left',
      }}
    >
      <span>{item.name}</span>
      <span style={{ fontWeight: 700, color: item.category_kind === 'free' ? 'var(--color-success)' : undefined }}>
        {outOfStock ? 'Out of stock' : item.category_kind === 'priced' ? fmt(item.selling_price_cents) : 'Free'}
      </span>
    </button>
  )
}