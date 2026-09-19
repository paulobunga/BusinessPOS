import { Message, MessageAvatar } from '@/components/ui/message'
import { Markdown } from '@/components/ui/markdown'
import { Steps, StepsItem, StepsTrigger, StepsContent, StepsBar } from '@/components/ui/steps'
import { cn } from '@/lib/utils'
import type { AiChatMessage, AiToolCall } from '../../../shared/types'
import type { ToolPart } from '@/components/ui/tool'

function formatUGX(cents: number): string {
  return new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(cents)
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
      ? (call.status === 'rejected' ? 'Rejected by user' : call.error ?? 'unknown')
      : undefined,
  }
}

function renderStructuredResult(call: AiToolCall): React.ReactNode {
  if (call.result == null) return null

  const result = call.result as Record<string, unknown>

  if (Array.isArray(result)) {
    return <TableView data={result} />
  }

  const arrays = Object.entries(result).filter(([, v]) => Array.isArray(v))
  if (arrays.length === 1) {
    return <TableView data={arrays[0][1] as Record<string, unknown>[]} />
  }

  if (arrays.length > 1) {
    return (
      <div className="space-y-3">
        {arrays.map(([key, value]) => (
          <div key={key}>
            <h5 className="text-xs font-medium text-muted-foreground mb-1 capitalize">
              {key.replace(/_/g, ' ')}
            </h5>
            <TableView data={value as Record<string, unknown>[]} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <pre className="text-xs whitespace-pre-wrap font-mono">
      {JSON.stringify(result, null, 2)}
    </pre>
  )
}

function TableView({ data }: { data: Record<string, unknown>[] }) {
  if (!data || data.length === 0) return <p className="text-xs text-muted-foreground">No data</p>

  const columns = new Set<string>()
  data.forEach(row => Object.keys(row).forEach(k => {
    if (typeof row[k] !== 'object' || row[k] === null) columns.add(k)
  }))
  const cols = Array.from(columns)

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-muted text-left">
            {cols.map(col => (
              <th key={col} className="px-2 py-1.5 font-semibold whitespace-nowrap capitalize">
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-t border-border">
              {cols.map(col => {
                const val = row[col]
                let display: string
                if (val == null) display = '\u2014'
                else if (typeof val === 'number' && col.endsWith('_cents')) display = formatUGX(val)
                else if (typeof val === 'number') display = val.toLocaleString()
                else display = String(val)
                return <td key={col} className="px-2 py-1.5 whitespace-nowrap">{display}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ToolStep({ call }: { call: AiToolCall }) {
  const icon = call.status === 'done' ? '\u2713' : call.status === 'error' || call.status === 'rejected' ? '\u2717' : '\u2026'
  const color = call.status === 'done' ? 'text-green-500' : call.status === 'error' || call.status === 'rejected' ? 'text-red-500' : 'text-blue-500'

  return (
    <StepsItem className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={cn("text-xs font-mono", color)}>{icon}</span>
        <span className="text-sm font-mono text-foreground">{call.name}</span>
      </div>
      {call.status === 'done' && call.result != null && (
        <div className="pl-6">
          {renderStructuredResult(call)}
        </div>
      )}
      {call.status === 'error' && (
        <p className="text-xs text-red-500">{call.error}</p>
      )}
      {call.status === 'rejected' && (
        <p className="text-xs text-muted-foreground">Rejected by user</p>
      )}
    </StepsItem>
  )
}

export function ChatMessageView({ message, isStreaming }: { message: AiChatMessage; isStreaming?: boolean }) {
  const isUser = message.role === 'user'
  const hasToolCalls = message.tool_calls && message.tool_calls.length > 0

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
            {message.content ? (
              <Markdown id={`m-${message.id}`} className="prose prose-sm dark:prose-invert max-w-none">
                {message.content}
              </Markdown>
            ) : (
              <p className="m-0 px-2 py-1 text-sm text-muted-foreground">
                {isStreaming ? 'Thinking…' : (hasToolCalls ? 'Working on it…' : '')}
              </p>
            )}

            {hasToolCalls && (
              <Steps defaultOpen={true}>
                <StepsTrigger leftIcon={<span className="text-xs">Tools: {message.tool_calls!.filter(c => c.status === 'done').length}/{message.tool_calls!.length}</span>}>
                  {message.tool_calls!.filter(c => c.status === 'done').length}/{message.tool_calls!.length} tools
                </StepsTrigger>
                <StepsContent>
                  <StepsBar />
                  <div className="ml-4 space-y-2">
                    {message.tool_calls!.map((call) => (
                      <ToolStep key={call.id} call={call} />
                    ))}
                  </div>
                </StepsContent>
              </Steps>
            )}

            {message.error && (
              <p className="mt-1 text-xs font-medium text-destructive">{message.error}</p>
            )}
          </div>
        )}
      </div>
    </Message>
  )
}
