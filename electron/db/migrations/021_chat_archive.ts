import Database from 'better-sqlite3'

export function runChatArchiveMigration(db: Database.Database) {
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))
  if (appliedVersions.has(21)) return

  db.transaction(() => {
    // Check if archived column exists (migration 020 already created table)
    const cols = db.prepare("PRAGMA table_info(chat_sessions)").all() as { name: string }[]
    const hasArchived = cols.some(c => c.name === 'archived')
    if (!hasArchived) {
      db.exec('ALTER TABLE chat_sessions ADD COLUMN archived INTEGER NOT NULL DEFAULT 0')
    }
    db.exec('INSERT INTO schema_migrations (version) VALUES (21)')
  })()
}
