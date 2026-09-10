import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useTill } from '../context/TillContext'
import { OpenTillModal } from '../pages/Till/OpenTillModal'
import { CloseTillModal } from '../pages/Till/CloseTillModal'

export function AppLayout() {
  const { openTill, closeTill, currentTill } = useTill()
  const [showOpenTill, setShowOpenTill] = useState(false)
  const [showCloseTill, setShowCloseTill] = useState(false)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header onOpenTill={() => setShowOpenTill(true)} />
        <main style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
          <Outlet />
        </main>
      </div>

      {showOpenTill && (
        <OpenTillModal
          onOpen={(floatCents) => openTill(floatCents)}
          onClose={() => setShowOpenTill(false)}
        />
      )}

      {showCloseTill && (
        <CloseTillModal
          onCloseTill={(countedCents) => closeTill(countedCents)}
          onClose={() => setShowCloseTill(false)}
        />
      )}

      {currentTill && (
        <button
          onClick={() => setShowCloseTill(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-danger)',
            background: 'var(--color-surface)',
            color: 'var(--color-danger)',
            fontWeight: 600,
            fontSize: '0.9375rem',
            cursor: 'pointer',
            minHeight: 48,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            zIndex: 100,
          }}
        >
          Close Till
        </button>
      )}
    </div>
  )
}
