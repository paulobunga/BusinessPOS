import { useMemo, useState } from 'react'
import { DatePicker } from '../../components/ui/date-picker'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { computeDepreciation } from '../../../shared/depreciation'
import { ASSET_CATEGORIES } from '../../../shared/types'
import type { AssetWithValue, CreateAssetPayload } from '../../../shared/types'

const fmt = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 })
const inputClass = 'h-11 rounded-[var(--radius-md)] bg-background text-[0.875rem]'
const selectClass = 'h-11 w-full rounded-[var(--radius-md)]'

function toNum(v: string): number {
  const n = Math.round(parseFloat(v))
  return isNaN(n) ? 0 : n
}

interface Props {
  open: boolean
  initial?: AssetWithValue | null
  onSubmit: (data: CreateAssetPayload) => Promise<void> | void
  onOpenChange: (open: boolean) => void
}

export function AssetFormDialog({ open, initial, onSubmit, onOpenChange }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? ASSET_CATEGORIES[0].name)
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '1')
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchase_date ?? new Date().toISOString().slice(0, 10))
  const [cost, setCost] = useState(initial ? String(initial.purchase_cost_cents) : '')
  const [salvage, setSalvage] = useState(initial ? String(initial.salvage_cents) : '0')
  const [life, setLife] = useState(initial ? String(initial.useful_life_months) : String(ASSET_CATEGORIES[0].default_life_months))
  const [location, setLocation] = useState(initial?.location ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const costNum = toNum(cost)
  const salvageNum = toNum(salvage)
  const lifeNum = toNum(life)

  const preview = useMemo(() => {
    if (!purchaseDate || costNum <= 0 || lifeNum < 1) return null
    return computeDepreciation(
      {
        purchase_date: purchaseDate,
        purchase_cost_cents: costNum,
        salvage_cents: salvageNum,
        useful_life_months: lifeNum,
        disposed_at: null,
      },
      new Date().toISOString().slice(0, 10)
    )
  }, [purchaseDate, costNum, salvageNum, lifeNum])

  const handleCategoryChange = (value: string) => {
    setCategory(value)
    const def = ASSET_CATEGORIES.find(c => c.name === value)
    if (def) setLife(String(def.default_life_months))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const qty = toNum(quantity)
    if (!name.trim()) { setError('Enter an asset name'); return }
    if (!purchaseDate) { setError('Pick a purchase date'); return }
    if (costNum <= 0) { setError('Enter a purchase cost greater than 0'); return }
    if (salvageNum < 0) { setError('Enter a valid salvage value'); return }
    if (lifeNum < 1) { setError('Useful life must be at least 1 month'); return }
    if (qty < 1) { setError('Quantity must be at least 1'); return }
    setSaving(true)
    try {
      await onSubmit({
        name: name.trim(),
        category,
        quantity: qty,
        purchase_date: purchaseDate,
        purchase_cost_cents: costNum,
        salvage_cents: salvageNum,
        useful_life_months: lifeNum,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      })
    } catch (err) {
      setError((err as Error).message || 'Failed to save asset')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit asset' : 'Register asset'}</DialogTitle>
          <DialogDescription>
            Recording an asset does not create an expense. Book value and monthly depreciation are estimated immediately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex max-h-[min(80vh,700px)] flex-col gap-4 overflow-y-auto pr-1">
          {error && <p className="m-0 font-semibold text-destructive">{error}</p>}

          <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
            Name
            <Input value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="e.g. Freezer, Plates" autoFocus />
          </Label>

          <div className="flex flex-col gap-4">
            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Category
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CATEGORIES.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Label>
            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Quantity
              <Input type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} className={inputClass} />
            </Label>
          </div>

          <div className="flex flex-col gap-4">
            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Purchase date
              <DatePicker value={purchaseDate} onValueChange={setPurchaseDate} />
            </Label>
            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Purchase cost (UGX)
              <Input type="number" min="0" value={cost} onChange={e => setCost(e.target.value)} className={inputClass} placeholder="e.g. 1200000" />
            </Label>
          </div>

          <div className="flex flex-col gap-4">
            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Salvage value (UGX)
              <Input type="number" min="0" value={salvage} onChange={e => setSalvage(e.target.value)} className={inputClass} placeholder="0" />
            </Label>
            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Useful life (months)
              <Input type="number" min="1" step="1" value={life} onChange={e => setLife(e.target.value)} className={inputClass} />
            </Label>
          </div>

          <div className="flex flex-col gap-4">
            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Location (optional)
              <Input value={location} onChange={e => setLocation(e.target.value)} className={inputClass} placeholder="Kitchen, Store…" />
            </Label>
            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Notes (optional)
              <Input value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} placeholder="Brand, serial…" />
            </Label>
          </div>

          {preview && (
            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-background px-4 py-3">
              <span className="text-[0.875rem] text-muted-foreground">Estimated value now</span>
              <div className="flex items-center gap-4">
                <span className="text-[0.8125rem] text-muted-foreground">-{fmt.format(preview.monthly_depreciation_cents)}/mo</span>
                <span className="text-lg font-extrabold">{fmt.format(preview.net_book_value_cents)}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" className="border-border bg-card font-semibold" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-primary font-semibold">
              {saving ? 'Saving...' : (initial ? 'Save changes' : 'Register asset')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}