import { XCircle } from 'lucide-react'
import { TillStatus } from '../pages/Till/TillStatus'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { ROLE_LABELS } from '../lib/permissions'
import { useAuth } from '../context/AuthContext'
import { useTill } from '../context/TillContext'

interface HeaderProps {
  onOpenTill: () => void
  onCloseTill: () => void
}

export function Header({ onOpenTill, onCloseTill }: HeaderProps) {
  const { currentTill } = useTill()
  const { name, role } = useAuth()

  return (
    <header className="flex h-14 min-h-14 items-center justify-end gap-3 border-b border-border bg-card px-6">
      {name && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{name}</span>
          {role && <Badge variant="outline">{ROLE_LABELS[role]}</Badge>}
        </div>
      )}
      <TillStatus onOpenTill={onOpenTill} />
      {currentTill && (
        <Button
          onClick={onCloseTill}
          variant="outline"
          className="flex h-[34px] items-center gap-2 rounded-[var(--radius-md)] border-destructive bg-destructive/10 px-3 text-[0.875rem] font-semibold text-destructive"
        >
          <XCircle className="size-4" />
          Close Till
        </Button>
      )}
    </header>
  )
}