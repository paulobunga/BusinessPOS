import { TillStatus } from '../pages/Till/TillStatus'

interface HeaderProps {
  onOpenTill: () => void
}

export function Header({ onOpenTill }: HeaderProps) {
  return (
    <header className="flex h-14 min-h-14 items-center justify-end gap-3 border-b border-border bg-card px-6">
      <TillStatus onOpenTill={onOpenTill} />
    </header>
  )
}