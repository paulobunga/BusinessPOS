import { useMemo, useState } from 'react'
import { useAssets } from '../../hooks/useAssets'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { FilterBar, FilterCard, FilterSelect } from '../../components/FilterBar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { PaginationFooter } from '../../components/PaginationFooter'
import { usePagination } from '../../hooks/usePagination'
import { ASSET_CATEGORIES } from '../../../shared/types'
import type { AssetWithValue } from '../../../shared/types'
import { AssetFormDialog } from './AssetFormDialog'
import { DisposeAssetDialog } from './DisposeAssetDialog'

const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

export function AssetsPage() {
  const { assets, summary, loading, error, create, update, dispose } = useAssets()
  const [status, setStatus] = useState<'all' | 'active' | 'disposed'>('all')
  const [cat, setCat] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AssetWithValue | null>(null)
  const [disposing, setDisposing] = useState<AssetWithValue | null>(null)

  const filtered = useMemo(
    () => assets.filter(a =>
      (status === 'all' || (status === 'active' ? a.active === 1 : a.active === 0)) &&
      (cat === 'all' || a.category === cat)
    ),
    [assets, status, cat]
  )
  const pager = usePagination(filtered)

  const openCreate = () => { setEditing(null); setShowForm(true) }
  const openEdit = (a: AssetWithValue) => { setEditing(a); setShowForm(true) }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Assets</h1>
        <span className="text-[0.9375rem] font-bold">Total Book Value: {fmt(summary?.total_book_value_cents ?? 0)}</span>
        <Button onClick={openCreate} className="bg-primary font-semibold">
          + Register Asset
        </Button>
      </div>

      <FilterBar>
        <FilterCard>
          <FilterSelect
            label="Status"
            value={status}
            onChange={v => setStatus(v as typeof status)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'disposed', label: 'Disposed' },
            ]}
          />
          <FilterSelect
            label="Category"
            value={cat}
            onChange={setCat}
            width="w-56"
            options={[
              { value: 'all', label: 'All' },
              ...ASSET_CATEGORIES.map(c => ({ value: c.name, label: c.name })),
            ]}
          />
        </FilterCard>
      </FilterBar>

      {loading ? (
        <p className="text-center text-muted-foreground">Loading...</p>
      ) : error ? (
        <p className="text-center font-semibold text-destructive">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="p-12 text-center text-lg text-muted-foreground">{assets.length === 0 ? 'No assets registered yet' : 'No assets match the filters'}</p>
      ) : (
        <div className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
          <Table className="table-zebra">
            <TableHeader>
              <TableRow className="bg-card hover:bg-card">
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Purchased</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Book value</TableHead>
                <TableHead>Monthly dep.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pager.slice.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="font-semibold">{a.name}</TableCell>
                  <TableCell className="text-muted-foreground">{a.category}</TableCell>
                  <TableCell>{a.quantity}</TableCell>
                  <TableCell className="text-muted-foreground">{a.purchase_date}</TableCell>
                  <TableCell>{fmt(a.purchase_cost_cents)}</TableCell>
                  <TableCell className="font-semibold">{fmt(a.net_book_value_cents)}</TableCell>
                  <TableCell className="text-muted-foreground">{fmt(a.monthly_depreciation_cents)}</TableCell>
                  <TableCell>
                    {a.active === 1 ? <Badge>Active</Badge> : <Badge variant="secondary">Disposed</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {a.active === 1 && (
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" className="h-8 border-border bg-background px-3 text-[0.8125rem] font-semibold" onClick={() => openEdit(a)}>
                          Edit
                        </Button>
                        <Button variant="outline" className="h-8 border-destructive/40 bg-background px-3 text-[0.8125rem] font-semibold text-destructive hover:bg-destructive/10" onClick={() => setDisposing(a)}>
                          Dispose
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <PaginationFooter pager={pager} />
        </div>
      )}

      <AssetFormDialog
        key={editing?.id ?? 'new'}
        open={showForm}
        initial={editing}
        onSubmit={async data => {
          if (editing) await update(editing.id, data)
          else await create(data)
          setShowForm(false)
        }}
        onOpenChange={o => { if (!o) { setShowForm(false); setEditing(null) } }}
      />

      <DisposeAssetDialog
        key={disposing?.id ?? 'none'}
        open={disposing != null}
        asset={disposing}
        onSubmit={async payload => {
          if (!disposing) return
          await dispose(disposing.id, payload)
          setDisposing(null)
        }}
        onOpenChange={o => { if (!o) setDisposing(null) }}
      />
    </div>
  )
}