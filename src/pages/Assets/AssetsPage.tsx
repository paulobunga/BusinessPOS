import { useMemo, useState } from 'react'
import { Boxes } from 'lucide-react'
import { useAssets } from '../../hooks/useAssets'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Card, CardContent } from '../../components/ui/card'
import { EmptyState } from '../../components/ui/empty-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { ASSET_CATEGORIES } from '../../../shared/types'
import type { AssetWithValue } from '../../../shared/types'
import { AssetFormDialog } from './AssetFormDialog'
import { DisposeAssetDialog } from './DisposeAssetDialog'

const fmt = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 })
const selectClass = 'h-11 w-full rounded-[var(--radius-md)]'

export function AssetsPage() {
  const { assets, summary, loading, create, update, dispose } = useAssets()
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

  const openCreate = () => { setEditing(null); setShowForm(true) }
  const openEdit = (a: AssetWithValue) => { setEditing(a); setShowForm(true) }

  const cards = [
    { label: 'Total book value', value: fmt.format(summary?.total_book_value_cents ?? 0) },
    { label: 'Total purchase cost', value: fmt.format(summary?.total_cost_cents ?? 0) },
    { label: 'Monthly depreciation', value: fmt.format(summary?.total_monthly_depreciation_cents ?? 0) },
    { label: 'Disposed assets', value: String(summary?.disposed_count ?? 0) },
  ]

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assets</h1>
          <p className="m-0 text-[0.875rem] text-muted-foreground">
            Equipment and supplies you own, with straight-line depreciation. Book value is informational only.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-primary font-semibold">
          + Register Asset
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map(c => (
          <Card key={c.label} size="sm">
            <CardContent className="flex flex-col gap-1">
              <span className="text-[0.8125rem] font-semibold text-muted-foreground">{c.label}</span>
              <span className="text-lg font-extrabold">{c.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex w-44 flex-col gap-1.5 text-[0.875rem] font-semibold">
          Status
          <Select value={status} onValueChange={v => setStatus(v as typeof status)}>
            <SelectTrigger className={selectClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disposed">Disposed</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="flex w-56 flex-col gap-1.5 text-[0.875rem] font-semibold">
          Category
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className={selectClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {ASSET_CATEGORIES.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
      </div>

      {loading ? (
        <EmptyState icon={Boxes} title="Loading assets..." loading />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={assets.length === 0 ? 'No assets registered yet' : 'No assets match the filters'}
          description={assets.length === 0 ? 'Register your first asset — freezer, stove, plates — to start tracking value.' : undefined}
          action={assets.length === 0 ? <Button onClick={openCreate} className="bg-primary font-semibold">+ Register Asset</Button> : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
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
              {filtered.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="font-semibold">{a.name}</TableCell>
                  <TableCell className="text-muted-foreground">{a.category}</TableCell>
                  <TableCell>{a.quantity}</TableCell>
                  <TableCell className="text-muted-foreground">{a.purchase_date}</TableCell>
                  <TableCell>{fmt.format(a.purchase_cost_cents)}</TableCell>
                  <TableCell className="font-semibold">{fmt.format(a.net_book_value_cents)}</TableCell>
                  <TableCell className="text-muted-foreground">{fmt.format(a.monthly_depreciation_cents)}</TableCell>
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