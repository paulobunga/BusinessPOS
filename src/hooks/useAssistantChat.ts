import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import type { AiChatMessage, AiSessionSummary, AiToolCall, AiEvent } from '../../shared/types'

interface ApprovalItem {
  requestId: string
  call: AiToolCall
}

export function useAssistantChat() {
  const { userId, role } = useAuth()
  const [messages, setMessages] = useState<AiChatMessage[]>([])
  const [streamingMessage, setStreamingMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<number>(0)
  const [sessions, setSessions] = useState<AiSessionSummary[]>([])
  const [approvalQueue, setApprovalQueue] = useState<ApprovalItem[]>([])
  const [input, setInput] = useState('')
  const requestIdRef = useRef<string | null>(null)

  const loadSessions = useCallback(async () => {
    try {
      const list = await window.api['ai:sessions:list']()
      setSessions(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => { void loadSessions() }, [loadSessions])

  const onEvent = useCallback((e: AiEvent) => {
    if (requestIdRef.current && e.requestId !== requestIdRef.current) return
    switch (e.type) {
      case 'delta':
        setStreamingMessage((prev) => prev + e.delta)
        break
      case 'tool-call':
      case 'tool-result':
        break
      case 'approval-request':
        setApprovalQueue((q) => [...q, { requestId: e.requestId, call: e.call }])
        break
      case 'done':
        setMessages((prev) => [...prev, e.message])
        setStreamingMessage('')
        setIsLoading(false)
        requestIdRef.current = null
        void loadSessions()
        break
      case 'error':
        setError(e.message.error ?? 'Something went wrong')
        setMessages((prev) => [...prev, e.message])
        setStreamingMessage('')
        setIsLoading(false)
        requestIdRef.current = null
        break
    }
  }, [loadSessions])

  useEffect(() => {
    return window.api.onAiEvent(onEvent)
  }, [onEvent])

  const submit = useCallback(async (content?: string) => {
    const text = (content ?? input).trim()
    if (!text || isLoading || !userId || !role) return
    setInput('')
    setIsLoading(true)
    setError(null)
    setStreamingMessage('')

    try {
      let targetSessionId = sessionId
      if (targetSessionId === 0) {
        const session = await window.api['ai:sessions:create']()
        setSessionId(session.id)
        targetSessionId = session.id
      }

      setMessages((prev) => [...prev, {
        id: -Date.now(), session_id: targetSessionId, role: 'user', content: text, created_at: new Date().toISOString(),
      }])
      const { requestId } = await window.api['ai:chat:start']({ sessionId: targetSessionId, content: text, userId, role })
      requestIdRef.current = requestId
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setIsLoading(false)
      requestIdRef.current = null
    }
  }, [sessionId, input, isLoading, userId, role])

  const loadSession = useCallback(async (id: number) => {
    try {
      const msgs = await window.api['ai:chat:messages'](id)
      setSessionId(id)
      setMessages(msgs)
      setStreamingMessage('')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const newSession = useCallback(async () => {
    try {
      const session = await window.api['ai:sessions:create']()
      setSessionId(session.id)
      setMessages([])
      setStreamingMessage('')
      setError(null)
      await loadSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [loadSessions])

  const renameSession = useCallback(async (id: number, title: string) => {
    try {
      await window.api['ai:sessions:rename'](id, title)
      await loadSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [loadSessions])

  const deleteSession = useCallback(async (id: number) => {
    try {
      await window.api['ai:sessions:delete'](id)
      if (id === sessionId) { setSessionId(0); setMessages([]) }
      await loadSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [sessionId, loadSessions])

  const approve = useCallback(async (requestId: string, callId: string) => {
    try {
      await window.api['ai:toolApproval']({ requestId, callId, approved: true })
      setApprovalQueue((q) => q.filter((a) => !(a.requestId === requestId && a.call.id === callId)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const reject = useCallback(async (requestId: string, callId: string) => {
    try {
      await window.api['ai:toolApproval']({ requestId, callId, approved: false })
      setApprovalQueue((q) => q.filter((a) => !(a.requestId === requestId && a.call.id === callId)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return {
    messages, input, setInput, submit, isLoading, streamingMessage, error,
    sessionId, sessions, loadSession, newSession, renameSession, deleteSession,
    approvalQueue, approve, reject, clearError,
  }
}