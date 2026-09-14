import { Navigate } from 'react-router-dom'
import React from 'react'
import { useAuth } from '../context/AuthContext'
import type { Module } from '../lib/permissions'

export function RequireModule({ module, children }: { module: Module; children: React.ReactNode }) {
  const { canSee } = useAuth()
  if (!canSee(module)) return <Navigate to="/sell" replace />
  return <>{children}</>
}
