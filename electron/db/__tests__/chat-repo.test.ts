import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migrations/001_initial'
import { runChatTablesMigration } from '../migrations/020_chat_tables'
import { chatRepo } from '../repositories/chatRepo'

vi.mock('../index', () => ({ getDb: () => testDb }))

let testDb: Database.Database

beforeEach(() => {
  testDb = new Database(':memory:')
  testDb.pragma('foreign_keys = ON')
  runMigrations(testDb)
  runChatTablesMigration(testDb)
})

afterEach(() => testDb.close())

describe('chatRepo', () => {
  test('createSession returns a session and listSessions shows it', () => {
    const session = chatRepo.createSession()
    expect(session.id).toBe(1)
    const all = chatRepo.listSessions()
    expect(all).toHaveLength(1)
    expect(all[0].title).toBeTruthy()
    expect(all[0].message_count).toBe(0)
  })

  test('saveUserMessage + saveAssistantMessage round-trip', () => {
    const session = chatRepo.createSession()
    const user = chatRepo.saveUserMessage(session.id, 'How are sales this week?')
    chatRepo.updateSessionMeta(session.id, user.content)
    const assistant = chatRepo.saveAssistantMessage(session.id, 'Solid week.', [
      { id: 'call_1', name: 'get_daily_report', args: { start: '2026-09-01', end: '2026-09-07' }, status: 'done', result: { rows: [] } },
    ])

    const msgs = chatRepo.listMessages(session.id)
    expect(msgs).toHaveLength(2)
    expect(msgs[0].role).toBe('user')
    expect(msgs[0].content).toBe('How are sales this week?')
    expect(msgs[1].role).toBe('assistant')
    expect(msgs[1].tool_calls?.[0].name).toBe('get_daily_report')

    const all = chatRepo.listSessions()
    expect(all[0].last_message).toBe('Solid week.')
    expect(all[0].message_count).toBe(2)
  })

  test('deleteSession cascades messages', () => {
    const session = chatRepo.createSession()
    chatRepo.saveUserMessage(session.id, 'x')
    chatRepo.deleteSession(session.id)
    expect(chatRepo.listSessions()).toHaveLength(0)
    expect(chatRepo.listMessages(session.id)).toHaveLength(0)
  })

  test('renameSession updates title', () => {
    const session = chatRepo.createSession()
    chatRepo.renameSession(session.id, 'September review')
    const all = chatRepo.listSessions()
    expect(all[0].title).toBe('September review')
  })
})