import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { Button } from './ui/button'

interface CaptainOrderModalProps {
  total: number
  onConfirm: (serviceDescription: string, customerName: string) => void
  onClose: () => void
}

const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)

export function CaptainOrderModal({ total, onConfirm, onClose }: CaptainOrderModalProps) {
  const [description, setDescription] = useState('')
  const [name, setName] = useState('')

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Captain Order</DialogTitle>
        </DialogHeader>
        <DialogDescription className="font-semibold">
          Food provided in exchange for a service. Total: {fmt(total)} — no cash changes hands, recorded as a completed barter sale.
        </DialogDescription>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="font-semibold">Service Provided</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Lunch for engineer who fixed the fridge"
              className="bg-background text-base"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="font-semibold">Person / Service Provider (optional)</Label>
            <Input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter name"
              className="h-11 bg-background text-base"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="h-12 flex-1 font-semibold">Cancel</Button>
          <Button
            onClick={() => onConfirm(description.trim(), name.trim())}
            disabled={!description.trim()}
            className="h-12 flex-1 bg-primary font-bold text-white hover:bg-primary/80"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}