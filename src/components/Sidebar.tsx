import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/sell', label: 'Sell', icon: '\u25B6' },
  { to: '/expenses', label: 'Expenses', icon: '\u25BC' },
  { to: '/debts', label: 'Debts', icon: '\u25C0' },
  { to: '/reimbursements', label: 'Reimbursements', icon: '\u25B2' },
  { to: '/inventory', label: 'Inventory', icon: '\u25A0' },
  { to: '/waste', label: 'Waste', icon: '\u2716' },
  { to: '/reports', label: 'Reports', icon: '\u2630' },
]

export function Sidebar() {
  return (
    <nav style={{
      width: 220,
      minWidth: 220,
      background: 'var(--color-surface)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 0',
      overflowY: 'auto',
    }}>
      <div style={{
        padding: '0 16px 16px',
        borderBottom: '1px solid var(--color-border)',
        marginBottom: 8,
      }}>
        <span style={{
          fontWeight: 700,
          fontSize: '1.125rem',
          color: 'var(--color-primary)',
          letterSpacing: '-0.01em',
        }}>
          BusinessPOS
        </span>
      </div>

      {navItems.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 16px',
            height: 48,
            minHeight: 48,
            textDecoration: 'none',
            fontSize: '0.9375rem',
            fontWeight: 500,
            color: isActive ? 'var(--color-primary)' : 'var(--color-text-primary)',
            background: isActive ? 'var(--color-surface-alt)' : 'transparent',
            borderRight: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
            transition: 'background 120ms, color 120ms',
          })}
        >
          <span style={{ width: 20, textAlign: 'center', fontSize: '0.875rem' }}>{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
