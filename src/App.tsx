import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PinPadPage } from './pages/Login/PinPadPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<PinPadPage />} />
        <Route path="/" element={<Navigate to="/sell" replace />} />
        <Route path="/sell" element={<div>Sell Screen (TODO)</div>} />
      </Routes>
    </AuthProvider>
  )
}