import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const MODEL_OPTIONS = [
  'deepseek-flash',
  'deepseek-v4-pro',
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
        <div className="flex flex-col gap-4">
          <Label htmlFor="ds-key" className="flex w-full flex-col gap-1.5">
            DeepSeek API key
            <Input
              id="ds-key"
              type="password"
              placeholder="sk-…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Stored encrypted on this device. Get a key at platform.openai.com.
            </p>
          </Label>
          <Label htmlFor="ds-model" className="flex w-full flex-col gap-1.5">
            Model
            <select
              id="ds-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}