// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { AiChatMessage, AiSessionSummary, AiEvent } from '../../shared/types'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ userId: 1, role: 'admin' as const }),
}))

type ApiLike = {
  'ai:chat:start': ReturnType<typeof vi.fn>
  'ai:chat:messages': ReturnType<typeof vi.fn>
  'ai:toolApproval': ReturnType<typeof vi.fn>
  'ai:sessions:list': ReturnType<typeof vi.fn>
  'ai:sessions:create': ReturnType<typeof vi.fn>
  'ai:sessions:rename': ReturnType<typeof vi.fn>
  'ai:sessions:delete': ReturnType<typeof vi.fn>
  onAiEvent: ReturnType<typeof vi.fn>
}

let api: ApiLike
let listener: (e: AiEvent) => void

beforeEach(() => {
  listener = () => {}
  api = {
    'ai:chat:start': vi.fn(async () => ({ requestId: 'req_1' })),
    'ai:chat:messages': vi.fn(async () => []),
    'ai:toolApproval': vi.fn(async () => {}),
    'ai:sessions:list': vi.fn(async () => [] as AiSessionSummary[]),
    'ai:sessions:create': vi.fn(async (title?: string) => ({ id: 1, title: title ?? 'Chat', created_at: 'now' })),
    'ai:sessions:rename': vi.fn(async () => {}),
    'ai:sessions:delete': vi.fn(async () => {}),
    onAiEvent: vi.fn((cb: (e: AiEvent) => void) => { listener = cb; return () => {} }),
  }
  ;(window as any).api = api
})

async function emit(e: AiEvent) { await act(async () => { listener(e) }) }

describe('useAssistantChat', () => {
  test('submit() invokes ai:chat:start with role+userId and accumulates deltas', async () => {
    const { useAssistantChat } = await import('./useAssistantChat')
    const { result } = renderHook(() => useAssistantChat())
    await act(async () => { await result.current.submit('How is revenue?') })

    expect(api['ai:chat:start']).toHaveBeenCalledWith({
      sessionId: expect.any(Number), content: 'How is revenue?', userId: expect.any(Number), role: expect.any(String),
    })

    await emit({ type: 'delta', requestId: 'req_1', delta: 'Revenue ' })
    await emit({ type: 'delta', requestId: 'req_1', delta: 'is up.' })
    expect(result.current.streamingMessage).toBe('Revenue is up.')

    await emit({ type: 'done', requestId: 'req_1', message: {
      id: 2, session_id: 1, role: 'assistant', content: 'Revenue is up.', created_at: 'now',
    } })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1].content).toBe('Revenue is up.')
  })

  test('approve() resolves a pending write-tool approval', async () => {
    const { useAssistantChat } = await import('./useAssistantChat')
    const { result } = renderHook(() => useAssistantChat())
    await act(async () => { await result.current.submit('log expense') })

    await emit({
      type: 'approval-request', requestId: 'req_1',
      call: { id: 'call_1', name: 'log_expense', args: { amount_cents: 5000 }, status: 'pending' },
    })
    expect(result.current.approvalQueue).toHaveLength(1)

    await act(async () => { await result.current.approve('req_1', 'call_1') })
    expect(api['ai:toolApproval']).toHaveBeenCalledWith({ requestId: 'req_1', callId: 'call_1', approved: true })
    expect(result.current.approvalQueue).toHaveLength(0)
  })

  test('newSession() creates a session and loads it', async () => {
    const { useAssistantChat } = await import('./useAssistantChat')
    const { result } = renderHook(() => useAssistantChat())
    await act(async () => { await result.current.newSession() })
    expect(result.current.sessionId).toBe(1)
    expect(api['ai:sessions:create']).toHaveBeenCalled()
    expect(result.current.messages).toEqual([])
  })

  test('submit() clears isLoading + sets error when ai:chat:start rejects', async () => {
    api['ai:sessions:create'] = vi.fn(async () => ({ id: 1, title: 'Chat', created_at: 'now' }))
    api['ai:chat:start'] = vi.fn(async () => { throw new Error('no such table: chat_sessions') })
    const { useAssistantChat } = await import('./useAssistantChat')
    const { result } = renderHook(() => useAssistantChat())

    await act(async () => { await result.current.submit('hello') })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.streamingMessage).toBe('')
    expect(result.current.error).toContain('chat_sessions')
    expect(result.current.messages).toHaveLength(1)
  })

  test('submit() clears isLoading when ai:sessions:create rejects before chat starts', async () => {
    api['ai:sessions:create'] = vi.fn(async () => { throw new Error('no such table: chat_sessions') })
    api['ai:chat:start'] = vi.fn(async () => ({ requestId: 'req_1' }))
    const { useAssistantChat } = await import('./useAssistantChat')
    const { result } = renderHook(() => useAssistantChat())

    await act(async () => { await result.current.submit('hello') })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toContain('chat_sessions')
    expect(api['ai:chat:start']).not.toHaveBeenCalled()
  })

  test('emit error event appends message + clears loading', async () => {
    const { useAssistantChat } = await import('./useAssistantChat')
    const { result } = renderHook(() => useAssistantChat())
    await act(async () => { await result.current.submit('hello') })

    await emit({
      type: 'error', requestId: 'req_1',
      message: { id: 2, session_id: 1, role: 'assistant', content: '', error: 'boom', created_at: 'now' },
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe('boom')
    expect(result.current.messages).toHaveLength(2)
  })
})