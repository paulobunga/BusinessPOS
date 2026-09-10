import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { TillProvider } from './context/TillContext'
import { PinPadPage } from './pages/Login/PinPadPage'
import { RequireAuth } from './components/RequireAuth'
import { SellPage } from './pages/Sell/SellPage'
import { ExpensesPage } from './pages/Expenses/ExpensesPage'
import { DebtsPage } from './pages/Debts/DebtsPage'
import { ReimbursementsPage } from './pages/Reimbursements/ReimbursementsPage'
import { InventoryPage } from './pages/Inventory/InventoryPage'
import { WastePage } from './pages/Waste/WastePage'

export default function App() {
  return (
    <AuthProvider>
      <TillProvider>
        <Routes>
          <Route path="/login" element={<PinPadPage />} />
          <Route path="/" element={<Navigate to="/sell" replace />} />
          <Route path="/sell" element={<RequireAuth><SellPage /></RequireAuth>} />
          <Route path="/expenses" element={<RequireAuth><ExpensesPage /></RequireAuth>} />
          <Route path="/debts" element={<RequireAuth><DebtsPage /></RequireAuth>} />
          <Route path="/reimbursements" element={<RequireAuth><ReimbursementsPage /></RequireAuth>} />
          <Route path="/inventory" element={<RequireAuth><InventoryPage /></RequireAuth>} />
          <Route path="/waste" element={<RequireAuth><WastePage /></RequireAuth>} />
        </Routes>
      </TillProvider>
    </AuthProvider>
  )
}