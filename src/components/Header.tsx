import { useNavigate } from 'react-router-dom'
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
    <header style={{
      height: 56,
      minHeight: 56,
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: '0 24px',
      gap: 12,
    }}>
      <TillStatus onOpenTill={onOpenTill} />
      <button
        onClick={handleLogout}
        style={{
          height: 40,
          padding: '0 16px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          color: 'var(--color-text-primary)',
          fontWeight: 600,
          fontSize: '0.875rem',
          cursor: 'pointer',
          minHeight: 40,
        }}
      >
        Logout
      </button>
    </header>
  )
}
