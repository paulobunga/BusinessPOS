import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Button } from './ui/button'

interface PayOnAccountDialogProps {
  open: boolean
  customerName: string
  totalOwedCents: number
  processing: boolean
  error: string | null
  onConfirm: (amountCents: number) => void
  onClose: () => void
}

export function PayOnAccountDialog({ open, customerName, totalOwedCents, processing, error, onConfirm, onClose }: PayOnAccountDialogProps) {
  const [amount, setAmount] = useState('')
  const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)
  const cents = Math.min(totalOwedCents, Math.max(0, Math.round(parseFloat(amount) || 0)))

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Pay Balance</DialogTitle>
        </DialogHeader>
        <DialogDescription className="font-semibold">
          {customerName} currently owes {fmt(totalOwedCents)}
        </DialogDescription>
        {error && <p className="font-semibold text-destructive">{error}</p>}
        <div className="flex flex-col gap-1.5">
          <Label className="font-semibold">Payment Amount (UGX)</Label>
          <Input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={fmt(totalOwedCents)}
            className="bg-background text-base"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="h-12 flex-1 font-semibold">Cancel</Button>
          <Button onClick={() => onConfirm(cents)} disabled={processing || cents <= 0} className="h-12 flex-1 font-bold">
            {processing ? 'Saving...' : 'Confirm Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}