import { Routes, Route, Navigate } from 'react-router-dom'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/sell" replace />} />
      <Route path="/sell" element={<div>Sell Screen (TODO)</div>} />
    </Routes>
  )
}