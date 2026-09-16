import { useState } from 'react'
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from '@/components/ui/chat-container'
import { ScrollButton } from '@/components/ui/scroll-button'
import { PromptInput, PromptInputActions, PromptInputAction, PromptInputTextarea } from '@/components/ui/prompt-input'
import { Button } from '@/components/ui/button'
import { Message, MessageAvatar } from '@/components/ui/message'
import { Loader } from '@/components/ui/loader'
import { Settings, Plus, Bot, SendHorizontal } from 'lucide-react'
import { useAssistantChat } from '@/hooks/useAssistantChat'
import { ChatMessageView } from './ChatMessageView'
import { SuggestedPrompts } from './SuggestedPrompts'
import { ApprovalCard } from './ApprovalCard'
import { AssistantSettingsDialog } from './AssistantSettingsDialog'
import { AssistantSidebar } from './AssistantSidebar'
import { Markdown } from '@/components/ui/markdown'

const starterPrompts = [
  'Analyse this week\u2019s performance',
  'Where are my cash leaks?',
  'Forecast next month\u2019s revenue',
  'What are my best-selling items?',
  'Suggest ways to raise profit margins',
]

export function AssistantPage() {
  const chat = useAssistantChat()
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div className="flex h-full">
      <AssistantSidebar
        sessions={chat.sessions}
        activeId={chat.sessionId}
        onSelect={(id) => chat.loadSession(id)}
        onNew={chat.newSession}
        onRename={chat.renameSession}
        onDelete={chat.deleteSession}
      />
      <div className="relative flex-1 overflow-hidden">
        <ChatContainerRoot className="h-full">
          <ChatContainerContent className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
            {chat.messages.length === 0 && !chat.streamingMessage && (
              <div className="flex flex-col items-center gap-4 pt-16 text-center">
                <Bot className="h-12 w-12 text-primary" />
                <div>
                  <h2 className="text-2xl font-extrabold text-foreground">Insights</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ask your business anything — performance, cash leaks, forecasts, margins.
                  </p>
                </div>
                <SuggestedPrompts prompts={starterPrompts} onPick={(p) => chat.submit(p)} />
              </div>
            )}

            {chat.messages.map((m) => (
              <ChatMessageView key={m.id} message={m} />
            ))}

            {chat.error && !chat.isLoading && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <span className="flex-1">{chat.error}</span>
                <button
                  type="button"
                  onClick={chat.clearError}
                  className="text-xs font-semibold text-destructive underline-offset-2 hover:underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {chat.streamingMessage && (
              <Message>
                <MessageAvatar src="" alt="Assistant" fallback="AI" />
                <div className="min-w-0 rounded-lg bg-card p-2 text-foreground">
                  <Markdown id={`stream-${chat.sessionId}`} className="prose prose-sm dark:prose-invert max-w-none">
                    {chat.streamingMessage}
                  </Markdown>
                </div>
              </Message>
            )}

            {chat.isLoading && !chat.streamingMessage && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader variant="dots" size="sm" />
                <span>Thinking…</span>
              </div>
            )}
            <ChatContainerScrollAnchor />
          </ChatContainerContent>

          <div className="absolute right-4 bottom-28">
            <ScrollButton />
          </div>
        </ChatContainerRoot>

        <div className="absolute inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl px-4 py-3">
            {chat.approvalQueue.length > 0 ? (
              <div className="space-y-2">
                {chat.approvalQueue.map((item) => (
                  <ApprovalCard
                    key={item.call.id}
                    call={item.call}
                    onApprove={() => chat.approve(item.requestId, item.call.id)}
                    onReject={() => chat.reject(item.requestId, item.call.id)}
                  />
                ))}
              </div>
            ) : (
              <PromptInput value={chat.input} onValueChange={chat.setInput} onSubmit={() => chat.submit()} isLoading={chat.isLoading}>
                <PromptInputTextarea placeholder="Ask about your business…" />
                <PromptInputActions>
                  <PromptInputAction tooltip="New chat">
                    <button type="button" onClick={() => { void chat.newSession() }} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted">
                      <Plus className="h-4 w-4" />
                    </button>
                  </PromptInputAction>
                  <PromptInputAction tooltip="Settings">
                    <button type="button" onClick={() => setShowSettings(true)} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted">
                      <Settings className="h-4 w-4" />
                    </button>
                  </PromptInputAction>
                  <Button type="submit" size="sm" className="h-8 gap-1">
                    <SendHorizontal className="h-4 w-4" />
                    Send
                  </Button>
                </PromptInputActions>
              </PromptInput>
            )}
          </div>
        </div>
      </div>

      {showSettings && <AssistantSettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  )
}