import { describe, test, expect } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migrations/001_initial'
import { runChatTablesMigration } from '../migrations/020_chat_tables'

describe('chat tables migration', () => {
  test('creates chat_sessions and chat_messages and marks version 20', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    runChatTablesMigration(db)

    const sessions = db.prepare('PRAGMA table_info(chat_sessions)').all() as { name: string }[]
    expect(sessions.map(c => c.name)).toEqual(
      expect.arrayContaining(['id', 'title', 'created_at', 'updated_at'])
    )

    const messages = db.prepare('PRAGMA table_info(chat_messages)').all() as { name: string }[]
    expect(messages.map(c => c.name)).toEqual(
      expect.arrayContaining(['id', 'session_id', 'role', 'content', 'tool_calls_json', 'error', 'created_at'])
    )

    const applied = db.prepare('SELECT version FROM schema_migrations WHERE version = 20').get()
    expect(applied).toBeTruthy()
    db.close()
  })

  test('is idempotent', () => {
    const db = new Database(':memory:')
    runMigrations(db)
    runChatTablesMigration(db)
    expect(() => runChatTablesMigration(db)).not.toThrow()
    db.close()
  })
})