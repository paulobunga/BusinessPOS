import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { Button } from './ui/button'
import { useTill } from '../context/TillContext'
import { OpenTillModal } from '../pages/Till/OpenTillModal'
import { CloseTillModal } from '../pages/Till/CloseTillModal'

export function AppLayout() {
  const { openTill, closeTill, currentTill } = useTill()
  const [showOpenTill, setShowOpenTill] = useState(false)
  const [showCloseTill, setShowCloseTill] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onOpenTill={() => setShowOpenTill(true)} />
        <main className="flex-1 overflow-auto bg-background">
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
        <Button
          onClick={() => setShowCloseTill(true)}
          variant="outline"
          className="fixed right-6 bottom-6 z-100 min-h-12 rounded-[var(--radius-md)] border-destructive bg-card px-5 text-[0.9375rem] font-semibold text-destructive shadow-md"
        >
          Close Till
        </Button>
      )}
    </div>
  )
}