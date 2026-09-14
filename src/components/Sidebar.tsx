import { NavLink, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  BarChart3,
  LogOut,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '../context/AuthContext'
import type { Module } from '../lib/permissions'

const navItems: { to: string; label: string; icon: React.ElementType; module: Module }[] = [
  { to: '/sell', label: 'Sell', icon: ShoppingCart, module: 'pos' },
  { to: '/expenses', label: 'Expenses', icon: ReceiptText, module: 'expenses' },
  { to: '/debts', label: 'Debts', icon: Wallet, module: 'debts' },
  { to: '/reimbursements', label: 'Reimbursements', icon: ArrowLeftRight, module: 'reimbursements' },
  { to: '/inventory', label: 'Inventory', icon: Package, module: 'inventory' },
  { to: '/waste', label: 'Waste', icon: Trash2, module: 'waste' },
  { to: '/reports', label: 'Reports', icon: BarChart3, module: 'reports' },
  { to: '/settings', label: 'Settings', icon: Settings, module: 'settings' },
  { to: '/users', label: 'Users', icon: Users, module: 'users' },
]

export function Sidebar() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { canSee } = useAuth()
  const items = navItems.filter((i) => canSee(i.module))

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="flex w-[72px] min-w-[72px] flex-col items-center justify-between overflow-y-auto border-r border-border bg-card py-3">
      <div className="flex flex-col items-center gap-1">
        <span className="mb-2 flex h-10 w-10 items-center justify-center text-xs font-extrabold text-primary" title="BusinessPOS">
          BP
        </span>
        {items.map(item => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              aria-label={item.label}
              className={({ isActive }) =>
                cn(
                  'flex h-12 w-12 items-center justify-center rounded-full transition-colors duration-100',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              <Icon className="h-6 w-6" strokeWidth={2} />
            </NavLink>
          )
        })}
      </div>
      <button
        type="button"
        onClick={handleLogout}
        title="Logout"
        aria-label="Logout"
        className="flex h-12 w-12 items-center justify-center rounded-full text-destructive transition-colors duration-100 hover:bg-destructive/10"
      >
        <LogOut className="h-6 w-6" strokeWidth={2} />
      </button>
    </nav>
  )
}