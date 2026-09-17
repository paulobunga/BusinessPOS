import { getDb } from '../index.js'
import type { AiSession, AiSessionSummary, AiChatMessage, AiToolCall } from '../../../shared/types.js'

function rowToMessage(row: any): AiChatMessage {
  return {
    id: row.id,
    session_id: row.session_id,
    role: row.role === 'tool' ? 'assistant' : row.role,
    content: row.content ?? '',
    tool_calls: row.tool_calls_json ? JSON.parse(row.tool_calls_json) : null,
    error: row.error ?? null,
    created_at: row.created_at,
  }
}

export const chatRepo = {
  createSession(title?: string): AiSession {
    const result = getDb().prepare(
      "INSERT INTO chat_sessions (title) VALUES (?)"
    ).run(title ?? `Chat ${new Date().toLocaleDateString()}`)
    return getDb().prepare('SELECT * FROM chat_sessions WHERE id = ?').get(result.lastInsertRowid) as AiSession
  },

  renameSession(id: number, title: string) {
    getDb().prepare('UPDATE chat_sessions SET title = ?, updated_at = datetime(\'now\') WHERE id = ?').run(title, id)
  },

  archiveSession(id: number) {
    getDb().prepare('UPDATE chat_sessions SET archived = 1, updated_at = datetime(\'now\') WHERE id = ?').run(id)
  },

  exportSession(id: number) {
    const session = getDb().prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id) as AiSession
    const messages = this.listMessages(id)
    return { session, messages }
  },

  deleteSession(id: number) {
    getDb().prepare('DELETE FROM chat_sessions WHERE id = ?').run(id)
  },

  listSessions(): AiSessionSummary[] {
    return getDb().prepare(`
      SELECT cs.id, cs.title, cs.created_at, cs.updated_at,
        (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id) AS message_count,
        (SELECT cm.content FROM chat_messages cm WHERE cm.session_id = cs.id AND cm.role = 'assistant' ORDER BY cm.id DESC LIMIT 1) AS last_message
      FROM chat_sessions cs
      WHERE cs.archived = 0
      ORDER BY cs.updated_at DESC, cs.id DESC
    `).all() as AiSessionSummary[]
  },

  listMessages(sessionId: number): AiChatMessage[] {
    const rows = getDb().prepare(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY id ASC'
    ).all(sessionId) as any[]
    return rows.map(rowToMessage)
  },

  saveUserMessage(sessionId: number, content: string): AiChatMessage {
    const result = getDb().prepare(
      "INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'user', ?)"
    ).run(sessionId, content)
    getDb().prepare('UPDATE chat_sessions SET updated_at = datetime(\'now\') WHERE id = ?').run(sessionId)
    return getDb().prepare('SELECT * FROM chat_messages WHERE id = ?').get(result.lastInsertRowid) as AiChatMessage
  },

  saveAssistantMessage(sessionId: number, content: string, toolCalls?: AiToolCall[] | null, error?: string | null): AiChatMessage {
    const result = getDb().prepare(
      "INSERT INTO chat_messages (session_id, role, content, tool_calls_json, error) VALUES (?, 'assistant', ?, ?, ?)"
    ).run(sessionId, content, toolCalls ? JSON.stringify(toolCalls) : null, error ?? null)
    getDb().prepare('UPDATE chat_sessions SET updated_at = datetime(\'now\') WHERE id = ?').run(sessionId)
    return getDb().prepare('SELECT * FROM chat_messages WHERE id = ?').get(result.lastInsertRowid) as AiChatMessage
  },

  updateSessionMeta(sessionId: number, firstUserContent?: string) {
    const current = getDb().prepare('SELECT id, title FROM chat_sessions WHERE id = ?').get(sessionId) as { id: number; title: string }
    if (current && current.title.startsWith('Chat ')) {
      const title = (firstUserContent ?? 'Chat').trim().split(/\s+/).slice(0, 6).join(' ')
      getDb().prepare('UPDATE chat_sessions SET title = ?, updated_at = datetime(\'now\') WHERE id = ?').run(title.slice(0, 60), sessionId)
    } else {
      getDb().prepare('UPDATE chat_sessions SET updated_at = datetime(\'now\') WHERE id = ?').run(sessionId)
    }
  },
}