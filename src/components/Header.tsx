import { useNavigate } from 'react-router-dom'
import { Button } from './ui/button'
import { useAuth } from '../context/AuthContext'
import { useTill } from '../context/TillContext'
import { TillStatus } from '../pages/Till/TillStatus'

interface HeaderProps {
  onOpenTill: () => void
}

export function Header({ onOpenTill }: HeaderProps) {
  const { logout } = useAuth()
  const { currentTill } = useTill()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="flex h-14 min-h-14 items-center justify-end gap-3 bg-card px-6 border-b border-border">
      <TillStatus onOpenTill={onOpenTill} />
      <Button
        onClick={handleLogout}
        variant="outline"
        className="h-10 min-h-10 text-sm font-semibold"
      >
        Logout
      </Button>
    </header>
  )
}