import Database from 'better-sqlite3'

export function runChatTablesMigration(db: Database.Database) {
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))
  if (appliedVersions.has(20)) return

  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        title      TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id     INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role           TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
        content        TEXT NOT NULL DEFAULT '',
        tool_calls_json TEXT,
        error          TEXT,
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, id);
    `)
    db.exec('INSERT INTO schema_migrations (version) VALUES (20)')
  })()
}