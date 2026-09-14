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
import { RequireModule } from './components/RequireModule'
import { UsersPage } from './pages/Users/UsersPage'

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
              <Route path="/expenses" element={<RequireModule module="expenses"><ExpensesPage /></RequireModule>} />
              <Route path="/debts" element={<RequireModule module="debts"><DebtsPage /></RequireModule>} />
              <Route path="/reimbursements" element={<RequireModule module="reimbursements"><ReimbursementsPage /></RequireModule>} />
              <Route path="/inventory" element={<RequireModule module="inventory"><InventoryPage /></RequireModule>} />
              <Route path="/waste" element={<RequireModule module="waste"><WastePage /></RequireModule>} />
              <Route path="/reports" element={<RequireModule module="reports"><ReportsPage /></RequireModule>} />
              <Route path="/settings" element={<RequireModule module="settings"><SettingsPage /></RequireModule>} />
              <Route path="/users" element={<RequireModule module="users"><UsersPage /></RequireModule>} />
            </Route>
          </Route>
        </Routes>
      </TillProvider>
    </AuthProvider>
  )
}