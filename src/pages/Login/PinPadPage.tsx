import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { PinPad } from '../../components/PinPad'

export function PinPadPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(false)

  const handleSubmit = async (pin: string) => {
    const ok = await login(pin)
    if (ok) navigate('/sell')
    else { setError(true); setTimeout(() => setError(false), 1500) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 24 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Enter PIN</h1>
      {error && <p style={{ color: 'var(--color-danger)' }}>Invalid PIN</p>}
      <PinPad onSubmit={handleSubmit} />
    </div>
  )
}