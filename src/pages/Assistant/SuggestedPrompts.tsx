import { PromptSuggestion } from '@/components/ui/prompt-suggestion'

export function SuggestedPrompts({ prompts, onPick }: { prompts: string[]; onPick: (p: string) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {prompts.map((p) => (
        <PromptSuggestion key={p} onClick={() => onPick(p)}>
          {p}
        </PromptSuggestion>
      ))}
    </div>
  )
}