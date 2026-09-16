import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { TillProvider } from './context/TillContext'
import { PinPadPage } from './pages/Login/PinPadPage'
import { RequireAuth } from './components/RequireAuth'
import { AppLayout } from './components/AppLayout'
import { SetupPage } from './pages/Setup/SetupPage'
import { SellPage } from './pages/Sell/SellPage'
import { ExpensesPage } from './pages/Expenses/ExpensesPage'
import { DebtsPage } from './pages/Debts/DebtsPage'
import { DebtDetailPage } from './pages/Debts/DebtDetailPage'
import { ReimbursementsPage } from './pages/Reimbursements/ReimbursementsPage'
import { InventoryPage } from './pages/Inventory/InventoryPage'
import { WastePage } from './pages/Waste/WastePage'
import { ReportsPage } from './pages/Reports/ReportsPage'
import { AssistantPage } from './pages/Assistant/AssistantPage'
import { SettingsPage } from './pages/Settings/SettingsPage'
import { RequireModule } from './components/RequireModule'
import { UsersPage } from './pages/Users/UsersPage'
import { AssetsPage } from './pages/Assets/AssetsPage'

type Phase = 'loading' | 'setup' | 'ready'

function Root() {
  const { login } = useAuth()
  const [phase, setPhase] = useState<Phase>('loading')

  useEffect(() => {
    window.api['system:status']().then(s => setPhase(s.needsSetup ? 'setup' : 'ready'))
  }, [])

  if (phase === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-lg font-bold text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (phase === 'setup') {
    return <SetupPage onComplete={() => setPhase('ready')} />
  }

  return (
    <TillProvider>
      <Routes>
        <Route path="/login" element={<PinPadPage />} />
        <Route path="/" element={<Navigate to="/sell" replace />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/sell" element={<SellPage />} />
            <Route path="/expenses" element={<RequireModule module="expenses"><ExpensesPage /></RequireModule>} />
            <Route path="/debts" element={<RequireModule module="debts"><DebtsPage /></RequireModule>} />
            <Route path="/debts/:customerName" element={<RequireModule module="debts"><DebtDetailPage /></RequireModule>} />
            <Route path="/reimbursements" element={<RequireModule module="reimbursements"><ReimbursementsPage /></RequireModule>} />
            <Route path="/inventory" element={<RequireModule module="inventory"><InventoryPage /></RequireModule>} />
            <Route path="/waste" element={<RequireModule module="waste"><WastePage /></RequireModule>} />
            <Route path="/assets" element={<RequireModule module="assets"><AssetsPage /></RequireModule>} />
            <Route path="/reports" element={<RequireModule module="reports"><ReportsPage /></RequireModule>} />
            <Route path="/assistant" element={<RequireModule module="reports"><AssistantPage /></RequireModule>} />
            <Route path="/settings" element={<RequireModule module="settings"><SettingsPage /></RequireModule>} />
            <Route path="/users" element={<RequireModule module="users"><UsersPage /></RequireModule>} />
          </Route>
        </Route>
      </Routes>
    </TillProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  )
}