import { useState } from 'react'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Button } from '../../components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { DatePicker } from '../../components/ui/date-picker'

const CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Supplies', 'Maintenance', 'Transport', 'Marketing', 'Other']
const PAYMENT_SOURCES = ['till', 'personal', 'mpesa'] as const

interface Props {
  initial?: {
    category?: string
    description?: string
    amount_cents?: number
    payment_source?: 'till' | 'personal' | 'mpesa'
    reference?: string
    date?: string
  }
  onSubmit: (data: { category: string; description: string; amount_cents: number; payment_source: 'till' | 'personal' | 'mpesa'; reference: string; date: string }) => void
  onCancel: () => void
}

export function ExpenseForm({ initial, onSubmit, onCancel }: Props) {
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[0])
  const [description, setDescription] = useState(initial?.description ?? '')
  const [amount, setAmount] = useState(initial?.amount_cents ? String(initial.amount_cents) : '')
  const [paymentSource, setPaymentSource] = useState<'till' | 'personal' | 'mpesa'>(initial?.payment_source ?? 'till')
  const [reference, setReference] = useState(initial?.reference ?? '')
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10))
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amtCents = Math.round(parseFloat(amount))
    if (!amount || isNaN(amtCents) || amtCents <= 0) {
      setError('Enter a valid amount')
      return
    }
    onSubmit({
      category,
      description,
      amount_cents: amtCents,
      payment_source: paymentSource,
      reference,
      date,
    })
  }

  const selectClass = 'h-11 w-full rounded-[var(--radius-md)]'
  const inputClass = 'h-11 rounded-[var(--radius-md)] bg-background text-[0.875rem]'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <p className="font-semibold text-destructive">{error}</p>}

      <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
        Date
        <DatePicker value={date} onValueChange={setDate} />
      </Label>

      <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
        Category
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className={selectClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </Label>

      <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
        Amount (UGX)
        <Input type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} className={inputClass} min="0" step="0.01" />
      </Label>

      <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
        Payment Source
        <Select value={paymentSource} onValueChange={v => setPaymentSource(v as typeof paymentSource)}>
          <SelectTrigger className={selectClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_SOURCES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </Label>

      <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
        Description
        <Input type="text" placeholder="What was this expense for?" value={description} onChange={e => setDescription(e.target.value)} className={inputClass} />
      </Label>

      <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
        Reference
        <Input type="text" placeholder="Receipt #, Mpesa code, etc." value={reference} onChange={e => setReference(e.target.value)} className={inputClass} />
      </Label>

      <div className="flex justify-end gap-2">
        <Button type="button" onClick={onCancel} variant="outline" className="bg-transparent font-semibold">
          Cancel
        </Button>
        <Button type="submit" className="bg-primary font-semibold">
          Save Expense
        </Button>
      </div>
    </form>
  )
}