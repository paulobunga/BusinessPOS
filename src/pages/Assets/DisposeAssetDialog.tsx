import { useState } from 'react'
import { DatePicker } from '../../components/ui/date-picker'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import type { AssetWithValue, DisposeAssetPayload } from '../../../shared/types'

const REASONS = ['sold', 'scrapped', 'broken past repair', 'other']
const fmt = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 })
const inputClass = 'h-11 rounded-[var(--radius-md)] bg-background text-[0.875rem]'

interface Props {
  open: boolean
  asset: AssetWithValue | null
  onSubmit: (payload: DisposeAssetPayload) => Promise<void> | void
  onOpenChange: (open: boolean) => void
}

export function DisposeAssetDialog({ open, asset, onSubmit, onOpenChange }: Props) {
  const [disposedAt, setDisposedAt] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState(REASONS[0])
  const [proceeds, setProceeds] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const proceedsNum = proceeds.trim() === '' ? undefined : Math.round(parseFloat(proceeds))
    if (proceeds.trim() !== '' && (isNaN(proceedsNum as number) || (proceedsNum as number) < 0)) {
      setError('Enter a valid sale proceeds amount, or leave it blank')
      return
    }
    if (!disposedAt) {
      setError('Pick a disposal date')
      return
    }
    setSaving(true)
    try {
      await onSubmit({ disposed_at: disposedAt, reason, proceeds_cents: proceedsNum })
    } catch (err) {
      setError((err as Error).message || 'Failed to dispose asset')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dispose asset</DialogTitle>
          <DialogDescription>
            {asset ? `${asset.name} — current book value ${fmt.format(asset.net_book_value_cents)}. It will leave the active register but stay in history.` : ''}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <p className="m-0 font-semibold text-destructive">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Disposal date
              <DatePicker value={disposedAt} onValueChange={setDisposedAt} />
            </Label>
            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Reason
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-11 w-full rounded-[var(--radius-md)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </Label>
          </div>

          <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
            Sale proceeds (UGX, optional)
            <Input type="number" min="0" value={proceeds} onChange={e => setProceeds(e.target.value)} className={inputClass} placeholder="0 if sold" />
          </Label>

          <DialogFooter>
            <Button type="button" variant="outline" className="border-border bg-card font-semibold" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={saving} className="font-semibold">
              {saving ? 'Saving...' : 'Dispose asset'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}