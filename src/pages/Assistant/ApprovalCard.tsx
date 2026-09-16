import { ShieldAlert, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatUGX } from '@/lib/money'
import type { AiToolCall } from '../../../shared/types'

const toolLabels: Record<string, string> = {
  log_expense: 'Log expense',
  record_waste: 'Record waste',
  record_debt_payment: 'Record debt payment',
  log_reimbursement: 'Log reimbursement',
}

export function ApprovalCard({ call, onApprove, onReject }: {
  call: AiToolCall
  onApprove: () => void
  onReject: () => void
}) {
  const amount = typeof call.args.amount_cents === 'number' ? call.args.amount_cents : null
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        <ShieldAlert className="h-4 w-4 shrink-0 text-primary" />
        <span className="font-medium">{toolLabels[call.name] ?? call.name}</span>
        {amount != null && <span className="text-muted-foreground">{formatUGX(amount)}</span>}
        <span className="max-w-60 truncate text-xs text-muted-foreground">
          {typeof call.args.description === 'string' ? call.args.description : ''}
        </span>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" variant="outline" onClick={onReject} className="gap-1">
          <X className="h-3.5 w-3.5" /> Reject
        </Button>
        <Button size="sm" onClick={onApprove} className="gap-1">
          <Check className="h-3.5 w-3.5" /> Approve
        </Button>
      </div>
    </div>
  )
}