import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { TillProvider } from './context/TillContext'
import { PinPadPage } from './pages/Login/PinPadPage'
import { RequireAuth } from './components/RequireAuth'
import { AppLayout } from './components/AppLayout'
import { SellPage } from './pages/Sell/SellPage'
import { ExpensesPage } from './pages/Expenses/ExpensesPage'
import { DebtsPage } from './pages/Debts/DebtsPage'
import { ReimbursementsPage } from './pages/Reimbursements/ReimbursementsPage'
import { InventoryPage } from './pages/Inventory/InventoryPage'
import { WastePage } from './pages/Waste/WastePage'
import { ReportsPage } from './pages/Reports/ReportsPage'
import { SettingsPage } from './pages/Settings/SettingsPage'

export default function App() {
  return (
    <AuthProvider>
      <TillProvider>
        <Routes>
          <Route path="/login" element={<PinPadPage />} />
          <Route path="/" element={<Navigate to="/sell" replace />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/sell" element={<SellPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/debts" element={<DebtsPage />} />
              <Route path="/reimbursements" element={<ReimbursementsPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/waste" element={<WastePage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </TillProvider>
    </AuthProvider>
  )
}