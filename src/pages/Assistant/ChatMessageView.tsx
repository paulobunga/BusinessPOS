import { Message, MessageAvatar } from '@/components/ui/message'
import { Markdown } from '@/components/ui/markdown'
import { Tool, type ToolPart } from '@/components/ui/tool'
import { cn } from '@/lib/utils'
import type { AiChatMessage, AiToolCall } from '../../../shared/types'

function formatArgs(args: Record<string, unknown>): string {
  return JSON.stringify(args, null, 2)
}

function resultText(call: AiToolCall): string {
  if (call.status === 'rejected') return 'Rejected by user'
  if (call.status === 'error') return `Error: ${call.error ?? 'unknown'}`
  if (call.result === undefined) return ''
  return JSON.stringify(call.result, null, 2)
}

function toToolPart(call: AiToolCall): ToolPart {
  const failed = call.status === 'rejected' || call.status === 'error'
  const out = call.result
  return {
    type: call.name,
    state: failed
      ? 'output-error'
      : call.status === 'done'
        ? 'output-available'
        : 'input-available',
    input: call.args,
    output: !failed && out != null
      ? typeof out === 'object' && out !== null
        ? (out as Record<string, unknown>)
        : { result: out }
      : undefined,
    toolCallId: call.id,
    errorText: failed
      ? (call.status === 'rejected' ? 'Rejected by user' : call.error ?? 'unknown error')
      : undefined,
  }
}

export function ChatMessageView({ message }: { message: AiChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <Message className={isUser ? 'justify-end' : undefined}>
      {!isUser && <MessageAvatar src="" alt="Assistant" fallback="AI" />}
      <div className={cn('min-w-0', isUser && 'max-w-[80%]')}>
        {isUser ? (
          <div className="rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
            {message.content}
          </div>
        ) : (
          <div className="rounded-lg bg-card p-2 text-foreground">
            <Markdown id={`m-${message.id}`} className="prose prose-sm dark:prose-invert max-w-none">
              {message.content || (message.tool_calls?.length ? 'Working on it…' : '')}
            </Markdown>
            {message.tool_calls?.map((call) => (
              <div key={call.id} className="mt-2">
                <Tool toolPart={toToolPart(call)} defaultOpen />
                {(() => {
                  const text = resultText(call)
                  return call.status === 'rejected' || call.status === 'error' ? (
                    <div className="text-xs font-medium text-destructive">{text}</div>
                  ) : (
                    text && <div className="overflow-hidden text-ellipsis whitespace-nowrap pt-1 text-xs text-muted-foreground" title={text}>{text}</div>
                  )
                })()}
              </div>
            ))}
            {message.error && (
              <p className="mt-1 text-xs font-medium text-destructive">{message.error}</p>
            )}
          </div>
        )}
      </div>
    </Message>
  )
}