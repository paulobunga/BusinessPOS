import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/sell', label: 'Sell', icon: '\u25B6' },
  { to: '/expenses', label: 'Expenses', icon: '\u25BC' },
  { to: '/debts', label: 'Debts', icon: '\u25C0' },
  { to: '/reimbursements', label: 'Reimbursements', icon: '\u25B2' },
  { to: '/inventory', label: 'Inventory', icon: '\u25A0' },
  { to: '/waste', label: 'Waste', icon: '\u2716' },
  { to: '/reports', label: 'Reports', icon: '\u2630' },
  { to: '/settings', label: 'Settings', icon: '\u2699' },
]

export function Sidebar() {
  return (
    <nav className="flex w-[220px] min-w-[220px] flex-col overflow-y-auto bg-card py-4 border-r border-border">
      <div className="mb-2 border-b border-border px-4 pb-4">
        <span className="text-lg font-bold tracking-tight text-primary">
          BusinessPOS
        </span>
      </div>

      {navItems.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'flex h-12 min-h-12 items-center gap-3 border-r-[3px] px-4 text-[0.9375rem] font-medium no-underline transition-colors duration-100',
              isActive
                ? 'border-primary bg-muted text-primary'
                : 'border-transparent text-foreground'
            )
          }
        >
          <span className="w-5 text-center text-sm">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}