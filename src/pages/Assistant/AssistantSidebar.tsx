import { useState } from 'react'
import { Plus, MoreHorizontal, MessageSquare, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { AiSessionSummary } from '../../../shared/types'

interface Props {
  sessions: AiSessionSummary[]
  activeId: number
  onSelect: (id: number) => void
  onNew: () => void
  onRename: (id: number, title: string) => void
  onDelete: (id: number) => void
}

export function AssistantSidebar({ sessions, activeId, onSelect, onNew, onRename, onDelete }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draftTitle, setDraftTitle] = useState('')

  const commitRename = (id: number) => {
    const title = draftTitle.trim()
    if (title) onRename(id, title)
    setEditingId(null)
  }

  return (
    <aside className="flex w-60 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between p-3">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Chats</span>
        <Button variant="ghost" size="icon" onClick={onNew} title="New chat">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={cn(
              'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5',
              s.id === activeId ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
            )}
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            {editingId === s.id ? (
              <input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={() => commitRename(s.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitRename(s.id) }}
                className="w-full bg-transparent text-sm outline-none"
              />
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm">{s.title}</span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setEditingId(s.id); setDraftTitle(s.title) }}>
                  <Pencil className="mr-2 h-4 w-4" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(s.id)} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    </aside>
  )
}