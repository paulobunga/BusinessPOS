import { useState, useEffect } from 'react'
import type { TillCountData } from '../../../shared/types'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Button } from '../../components/ui/button'

interface CloseTillModalProps {
  onCloseTill: (countedCents: number) => void
  onClose: () => void
}

export function CloseTillModal({ onCloseTill, onClose }: CloseTillModalProps) {
  const [actualCash, setActualCash] = useState('')
  const [countData, setCountData] = useState<TillCountData | null>(null)

  useEffect(() => {
    window.api['till:countCash']().then(setCountData)
  }, [])

  const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

  const handleClose = () => {
    const parsed = parseInt(actualCash, 10)
    if (!isNaN(parsed)) {
      onCloseTill(parsed)
      onClose()
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Close Till</DialogTitle>
        </DialogHeader>
        {countData && (
          <div className="mb-4 flex flex-col gap-2">
            <div className="flex justify-between">
              <span className="font-semibold">Opening Float</span>
              <span>{fmt(countData.openingFloatCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Cash Sales</span>
              <span className="text-success">+{fmt(countData.cashSalesCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Till Expenses</span>
              <span className="text-destructive">-{fmt(countData.tillExpensesCents)}</span>
            </div>
            <div className="flex justify-between border-t-2 border-border pt-2 font-bold">
              <span>Expected Cash</span>
              <span className="text-primary">{fmt(countData.expectedClosingCents)}</span>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label className="font-semibold">Actual Cash Counted (UGX)</Label>
          <Input
            type="number"
            value={actualCash}
            onChange={e => setActualCash(e.target.value)}
            className="bg-background text-base"
            autoFocus
          />
        </div>
        {actualCash && countData && (
          <div
            className={`rounded-[var(--radius-md)] px-3 py-3 font-bold ${
              parseInt(actualCash, 10) >= countData.expectedClosingCents ? 'bg-[#e6f9e6]' : 'bg-[#fce8e8]'
            }`}
          >
            Variance: {fmt(parseInt(actualCash, 10) - countData.expectedClosingCents)}
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="h-12 flex-1 font-semibold">
            Cancel
          </Button>
          <Button onClick={handleClose} className="h-12 flex-1 bg-destructive font-bold text-white hover:bg-destructive/80">
            Close Till
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}