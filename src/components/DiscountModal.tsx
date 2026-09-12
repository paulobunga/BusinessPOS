import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Button } from './ui/button'

interface DiscountModalProps {
  onApply: (cents: number, reason: string) => void
  onClose: () => void
}

export function DiscountModal({ onApply, onClose }: DiscountModalProps) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const handleApply = () => {
    const parsed = parseInt(amount, 10)
    if (parsed > 0 && reason.trim()) {
      onApply(parsed, reason.trim())
      onClose()
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Apply Discount</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label className="font-semibold">Amount (UGX)</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="bg-background text-base" autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="font-semibold">Reason</Label>
            <Input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Waste discount" className="bg-background text-base" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="h-12 flex-1 font-semibold">
            Cancel
          </Button>
          <Button onClick={handleApply} className="h-12 flex-1 font-bold">
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}