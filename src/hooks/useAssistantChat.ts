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
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<number>(0)
  const [sessions, setSessions] = useState<AiSessionSummary[]>([])
  const [approvalQueue, setApprovalQueue] = useState<ApprovalItem[]>([])
  const [input, setInput] = useState('')
  const [loadingSessionId, setLoadingSessionId] = useState<number | null>(null)

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
        if (e.message.session_id === sessionId) {
          setMessages((prev) => [...prev, e.message])
          setStreamingMessage('')
        }
        setLoadingSessionId((prev) => prev === e.message.session_id ? null : prev)
        void loadSessions()
        break
      case 'error':
        if (e.message.session_id === sessionId) {
          setError(e.message.error ?? 'Something went wrong')
          setMessages((prev) => [...prev, e.message])
          setStreamingMessage('')
        }
        setLoadingSessionId((prev) => prev === e.message.session_id ? null : prev)
        break
    }
  }, [sessionId, loadSessions])

  useEffect(() => {
    return window.api.onAiEvent(onEvent)
  }, [onEvent])

  const submit = useCallback(async (content?: string) => {
    const text = (content ?? input).trim()
    if (!text || loadingSessionId !== null || !userId || !role) return
    setInput('')
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
      setLoadingSessionId(targetSessionId)
      await window.api['ai:chat:start']({ sessionId: targetSessionId, content: text, userId, role })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setLoadingSessionId(null)
    }
  }, [sessionId, input, loadingSessionId, userId, role])

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

  const archiveSession = useCallback(async (id: number) => {
    try {
      await window.api['ai:sessions:archive'](id)
      if (id === sessionId) { setSessionId(0); setMessages([]) }
      await loadSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [sessionId, loadSessions])

  const exportSession = useCallback(async (id: number) => {
    try {
      const result = await window.api['ai:sessions:export'](id)
      if (!result) throw new Error('Export failed')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

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

  const isLoading = loadingSessionId === sessionId

  return {
    messages, input, setInput, submit, isLoading, streamingMessage, error,
    sessionId, sessions, loadSession, newSession, renameSession, archiveSession, exportSession, deleteSession,
    approvalQueue, approve, reject, clearError,
  }
}