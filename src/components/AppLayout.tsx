import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useTill } from '../context/TillContext'
import { OpenTillModal } from '../pages/Till/OpenTillModal'
import { CloseTillModal } from '../pages/Till/CloseTillModal'

export function AppLayout() {
  const { openTill, closeTill } = useTill()
  const [showOpenTill, setShowOpenTill] = useState(false)
  const [showCloseTill, setShowCloseTill] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onOpenTill={() => setShowOpenTill(true)} onCloseTill={() => setShowCloseTill(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background">
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
    </div>
  )
}