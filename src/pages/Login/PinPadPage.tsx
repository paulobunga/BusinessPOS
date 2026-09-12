import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { PinKeypad } from '../../components/PinKeypad'

export function PinPadPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | false>(false)
  const [attempt, setAttempt] = useState(0)

  const handleComplete = async (pin: string) => {
    const ok = await login(pin)
    if (ok) navigate('/sell')
    else {
      setError('Invalid PIN')
      setTimeout(() => {
        setError(null)
        setAttempt((a) => a + 1)
      }, 600)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
      <h1 className="text-2xl font-bold">Enter PIN</h1>
      <PinKeypad
        key={attempt}
        length={4}
        onComplete={handleComplete}
        error={error}
      />
    </div>
  )
}