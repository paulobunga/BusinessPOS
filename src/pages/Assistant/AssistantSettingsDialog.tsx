import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const MODEL_OPTIONS = [
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3.7-sonnet',
  'google/gemini-2.0-flash-001',
  'meta-llama/llama-3.3-70b-instruct',
]

export function AssistantSettingsDialog({ onClose }: { onClose: () => void }) {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(MODEL_OPTIONS[0])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void window.api['ai:config:get']().then((cfg) => {
      setModel(cfg.model)
    })
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await window.api['ai:config:save']({ apiKey: apiKey || undefined, model })
      toast.success('AI settings saved')
      onClose()
    } catch (err) {
      toast.error((err as Error).message || 'Failed to save AI settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>AI Assistant Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="or-key">OpenRouter API key</Label>
            <Input
              id="or-key"
              type="password"
              placeholder="sk-or-…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Stored encrypted on this device. Get a key at openrouter.ai.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="or-model">Model</Label>
            <select
              id="or-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}