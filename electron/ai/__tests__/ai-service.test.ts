import { describe, test, expect, vi } from 'vitest'
import type { AiChatMessage, AiToolCall, AiEvent } from '../../../shared/types'
import { messagesToOpenAI, runAssistant, SYSTEM_PROMPT } from '../service'

const { config } = vi.hoisted(() => ({
  config: { apiKey: 'sk-test', model: 'deepseek-flash' },
}))

vi.mock('../config', () => ({ getAiConfig: () => config }))
vi.mock('../tools', () => ({ TOOL_DEFINITIONS: {}, isWriteTool: () => false, executeTool: async () => ({}) }))

function fakeCall(name: string, id = `call_${name}`): AiToolCall {
  return { id, name, args: {}, status: 'pending' }
}

function makeChunk(delta: { content?: string; tool_calls?: any[] }) {
  return {
    id: '1',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'openai/gpt-4o-mini',
    choices: [{ index: 0, delta, finish_reason: null }],
  }
}

function finalChunk(toolCalls?: any[]) {
  return {
    id: '1', object: 'chat.completion.chunk', created: 0, model: 'openai/gpt-4o-mini',
    choices: [{ index: 0, delta: {}, finish_reason: toolCalls ? 'tool_calls' : 'stop' }],
  }
}

describe('messagesToOpenAI', () => {
  test('maps user+assistant messages and injects system prompt', () => {
    const msgs: AiChatMessage[] = [
      { id: 1, session_id: 1, role: 'user', content: 'hi', created_at: 'now' },
      { id: 2, session_id: 1, role: 'assistant', content: 'hello', created_at: 'now' },
    ]
    const out = messagesToOpenAI(msgs)
    expect(out[0]).toMatchObject({ role: 'system', content: SYSTEM_PROMPT })
    expect(out.map(m => m.role)).toEqual(['system', 'user', 'assistant'])
  })

  test('maps persisted tool calls back to OpenAI tool messages', () => {
    const msgs: AiChatMessage[] = [
      {
        id: 1, session_id: 1, role: 'assistant', content: '', created_at: 'now',
        tool_calls: [
          fakeCall('get_daily_report'),
          { ...fakeCall('log_expense'), args: { amount_cents: 5000 }, status: 'done', result: { id: 41 } },
        ],
      },
    ]
    const out = messagesToOpenAI(msgs)
    expect(out[1].role).toBe('assistant')
    expect((out[1] as any).tool_calls).toHaveLength(2)
    expect((out as any)[2]).toMatchObject({ role: 'tool', tool_call_id: 'call_get_daily_report' })
    expect((out as any)[3]).toMatchObject({ role: 'tool', tool_call_id: 'call_log_expense', content: '{"id":41}' })
  })

  test('maps rejected/error tool calls without results', () => {
    const msgs: AiChatMessage[] = [
      {
        id: 1, session_id: 1, role: 'assistant', content: '', created_at: 'now',
        tool_calls: [
          { ...fakeCall('log_expense'), status: 'rejected' },
          { ...fakeCall('record_waste'), status: 'error', error: 'boom' },
        ],
      },
    ]
    const out = messagesToOpenAI(msgs)
    expect((out as any)[2]).toMatchObject({ role: 'tool', tool_call_id: 'call_log_expense', content: '{"approved": false}' })
    expect((out as any)[3]).toMatchObject({ role: 'tool', tool_call_id: 'call_record_waste', content: 'boom' })
  })
})

describe('runAssistant', () => {
  test('streams a final answer when no tools are called', async () => {
    const stream = {
      [Symbol.asyncIterator]: async function* () {
        yield makeChunk({ content: 'Revenue ' })
        yield makeChunk({ content: 'looks good.' })
        yield finalChunk()
      },
    }
    const client = { chat: { completions: { create: vi.fn(async () => stream) } } }

    const events: AiEvent[] = []
    const chatRepoMock = {
      listMessages: vi.fn(() => []),
      saveUserMessage: vi.fn(() => ({ id: 1, session_id: 1, role: 'user', content: 'x', created_at: 'now' })),
      saveAssistantMessage: vi.fn(() => ({ id: 2, session_id: 1, role: 'assistant', content: 'Revenue looks good.', created_at: 'now' })),
      updateSessionMeta: vi.fn(),
    }

    const result = await runAssistant({
      sessionId: 1, content: 'How is revenue?', userId: 1, role: 'admin',
      emit: (e) => events.push(e),
      waitForApproval: async () => true,
      deps: { client: client as any, chatRepo: chatRepoMock as any },
    })

    expect(chatRepoMock.updateSessionMeta).toHaveBeenCalled()
    expect(events.some(e => e.type === 'delta')).toBe(true)
    expect(result.content).toBe('Revenue looks good.')
    expect(events.some(e => e.type === 'done')).toBe(true)
  })
})