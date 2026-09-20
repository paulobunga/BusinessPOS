import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useCategories } from '../../hooks/useCategories'
import { useAttributes } from '../../hooks/useAttributes'
import { useItems } from '../../hooks/useItems'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Badge } from '../../components/ui/badge'
import { Checkbox } from '../../components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Copy, Eye, EyeOff } from 'lucide-react'
import type { Category, MenuItemWithCategory, AttributeDef } from '../../../shared/types'

const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n)
const inputClass = 'min-h-10 rounded-[var(--radius-md)] border-border bg-background text-[0.875rem]'
const selectClass = 'h-11 w-full rounded-[var(--radius-md)]'
const pinClass = `${inputClass} max-w-[120px] text-center text-base font-bold tracking-[8px]`

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">{title}</h2>
      {subtitle && <p className="text-[0.875rem] text-muted-foreground">{subtitle}</p>}
      {children}
    </div>
  )
}

function StatusLine({ type, text }: { type: 'success' | 'error' | 'info'; text: string }) {
  const cls = type === 'success' ? 'text-success' : type === 'error' ? 'text-destructive' : 'text-muted-foreground'
  return <p className={`m-0 text-[0.875rem] font-semibold ${cls}`}>{text}</p>
}

function KindBadge({ kind }: { kind: 'priced' | 'free' }) {
  return (
    <Badge className={kind === 'priced' ? 'bg-primary text-white' : 'bg-success text-white'}>
      {kind === 'priced' ? 'Priced' : 'Free'}
    </Badge>
  )
}

type CategoryModal = { mode: 'add' } | { mode: 'edit'; category: Category }
type AttrModal = { mode: 'add' } | { mode: 'edit'; attr: AttributeDef }
type ItemModal = { mode: 'add' } | { mode: 'edit'; item: MenuItemWithCategory }

export function SettingsPage() {
  const { userId, role } = useAuth()

  // Business info
  const [businessName, setBusinessName] = useState('My Restaurant')
  const [bizStatus, setBizStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Kitchen display
  const [kdsMinutes, setKdsMinutes] = useState('10')
  const [kdsStatus, setKdsStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [kdsPort, setKdsPort] = useState('3000')
  const [kdsToken, setKdsToken] = useState('')
  const [kdsServer, setKdsServer] = useState<{ running: boolean; port: number | null; error: string | null } | null>(null)
  const [kdsUrls, setKdsUrls] = useState<string[]>([])
  const [kdsCopied, setKdsCopied] = useState<string | null>(null)
  const [showKdsPin, setShowKdsPin] = useState(false)
  const [kdsBusy, setKdsBusy] = useState(false)

  // Printing
  const [printEnabled, setPrintEnabled] = useState(true)
  const [printKotAuto, setPrintKotAuto] = useState(true)
  const [printReceiptAuto, setPrintReceiptAuto] = useState(false)
  const [printDevice, setPrintDevice] = useState('')
  const [printerList, setPrinterList] = useState<{ name: string; isDefault: boolean }[]>([])
  const [receiptFooter, setReceiptFooter] = useState('')
  const [printStatus, setPrintStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [printBusy, setPrintBusy] = useState(false)

  // Categories
  const { categories, loading: categoriesLoading, error: categoriesError, retry: retryCategories } = useCategories(false)
  const [categoryModal, setCategoryModal] = useState<CategoryModal | null>(null)
  const [categoryDraft, setCategoryDraft] = useState({ name: '', kind: 'priced', sort_order: '0', purchase_only: false })
  const [categoryStatus, setCategoryStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Attributes
  const { attributes, loading: attributesLoading, error: attributesError, retry: retryAttributes } = useAttributes(null)
  const [attrModal, setAttrModal] = useState<AttrModal | null>(null)
  const [attrDraft, setAttrDraft] = useState({ name: '', type: 'text', scope: 'all' })
  const [attrStatus, setAttrStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Menu items
  const { items, loading: itemsLoading, error: itemsError, retry: retryItems } = useItems()
  const [menuCatId, setMenuCatId] = useState<number | null>(null)
  const { attributes: categoryDefs, retry: retryCategoryDefs } = useAttributes(menuCatId)
  const [itemModal, setItemModal] = useState<ItemModal | null>(null)
  const [itemDraft, setItemDraft] = useState<{ name: string; selling: string; cost: string; purchase_unit: string; values: Record<number, { text?: string; number?: string; boolean?: boolean }> }>({ name: '', selling: '', cost: '', purchase_unit: 'kg', values: {} })
  const [itemStatus, setItemStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // PIN
  const [pinOpen, setPinOpen] = useState(false)
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinStatus, setPinStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Backup
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [backupBusy, setBackupBusy] = useState(false)

  // Danger Zone
  const [purgeStatus, setPurgeStatus] = useState<{ type: 'error' | 'info'; text: string } | null>(null)

  // Confirmations
  const [confirmState, setConfirmState] = useState<null | { title: string; description?: string; destructive: boolean; confirmText?: string; action: () => void }>(null)

  const parseCents = (s: string) => {
    const n = parseFloat(s)
    if (isNaN(n) || n < 0) return null
    return Math.round(n)
  }

  // === Business info ===
  const saveBusinessName = async () => {
    const name = businessName.trim()
    if (!name) { setBizStatus({ type: 'error', text: 'Business name cannot be empty' }); return }
    await window.api['settings:update']({ business_name: name })
    setBizStatus({ type: 'success', text: 'Business name saved' })
    setTimeout(() => setBizStatus(null), 2500)
  }

  // === Kitchen display ===
  const refreshKdsServer = async () => {
    try {
      const st = await window.api['system:kitchenStatus']()
      setKdsServer({ running: st.running, port: st.port, error: st.error })
    } catch {
      setKdsServer({ running: false, port: null, error: 'Status unavailable' })
    }
    try {
      setKdsUrls(await window.api['system:kitchenUrls']())
    } catch {
      setKdsUrls([])
    }
  }

  useEffect(() => {
    window.api['settings:get']().then(s => {
      const raw = s?.kds_alert_minutes
      const parsed = raw != null ? parseInt(raw, 10) : NaN
      setKdsMinutes(Number.isInteger(parsed) && parsed >= 1 && parsed <= 120 ? String(parsed) : '10')
      const rawPort = s?.kds_port
      const parsedPort = rawPort != null ? parseInt(rawPort, 10) : NaN
      setKdsPort(Number.isInteger(parsedPort) && parsedPort >= 1 && parsedPort <= 65535 ? String(parsedPort) : '3000')
      setKdsToken(s?.kds_token ?? '')
      setPrintEnabled(s?.print_enabled !== 'false')
      setPrintKotAuto(s?.print_kot_auto !== 'false')
      setPrintReceiptAuto(s?.print_receipt_auto === 'true')
      setPrintDevice(s?.print_device_name ?? '')
      setReceiptFooter(s?.receipt_footer ?? '')
    }).catch(() => {})
    window.api['print:listPrinters']().then(p => setPrinterList(p ?? [])).catch(() => setPrinterList([]))
    void refreshKdsServer()
  }, [])

  const saveKdsMinutes = async () => {
    const n = parseInt(kdsMinutes, 10)
    if (!Number.isInteger(n) || n < 1 || n > 120) { setKdsStatus({ type: 'error', text: 'Enter a whole number from 1 to 120' }); return }
    await window.api['settings:update']({ kds_alert_minutes: String(n) })
    setKdsStatus({ type: 'success', text: 'Kitchen alert threshold saved' })
    setTimeout(() => setKdsStatus(null), 2500)
  }

  const saveKdsPort = async () => {
    const n = parseInt(kdsPort, 10)
    if (!Number.isInteger(n) || n < 1 || n > 65535) { setKdsStatus({ type: 'error', text: 'Enter a whole number from 1 to 65535' }); return }
    setKdsBusy(true)
    try {
      await window.api['settings:update']({ kds_port: String(n) })
      const st = await window.api['system:restartKds'](n)
      setKdsServer({ running: st.running, port: st.port, error: st.error })
      try {
        setKdsUrls(await window.api['system:kitchenUrls']())
      } catch {
        setKdsUrls([])
      }
      if (st.running) {
        setKdsStatus({ type: 'success', text: `Port saved — server running on port ${st.port}` })
      } else {
        setKdsStatus({ type: 'error', text: st.error ?? 'Port saved but server failed to start' })
      }
    } catch (e: any) {
      setKdsStatus({ type: 'error', text: e?.message ?? 'Failed to save port' })
    }
    setKdsBusy(false)
  }

  const regenerateKdsToken = async () => {
    const pin = String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000)
    try {
      await window.api['settings:update']({ kds_token: pin })
      setKdsToken(pin)
      setShowKdsPin(true)
      setKdsStatus({ type: 'success', text: 'Kitchen PIN regenerated' })
    } catch (e: any) {
      setKdsStatus({ type: 'error', text: e?.message ?? 'Failed to regenerate PIN' })
    }
  }

  const copyKdsPin = async () => {
    if (!kdsToken) return
    try {
      await navigator.clipboard.writeText(kdsToken)
      setKdsCopied('pin')
      setTimeout(() => setKdsCopied(c => (c === 'pin' ? null : c)), 2000)
    } catch {
      setKdsStatus({ type: 'error', text: 'Copy failed — reveal the PIN and copy it manually' })
    }
  }

  const restartKdsServer = async () => {
    setKdsBusy(true)
    try {
      const st = await window.api['system:restartKds']()
      setKdsServer({ running: st.running, port: st.port, error: st.error })
      try {
        setKdsUrls(await window.api['system:kitchenUrls']())
      } catch {
        setKdsUrls([])
      }
      if (st.running) {
        setKdsStatus({ type: 'success', text: `Server restarted on port ${st.port}` })
      } else {
        setKdsStatus({ type: 'error', text: st.error ?? 'Server failed to start' })
      }
    } catch (e: any) {
      setKdsStatus({ type: 'error', text: e?.message ?? 'Failed to restart server' })
    }
    setKdsBusy(false)
  }

  const copyKdsUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setKdsCopied(url)
      setTimeout(() => setKdsCopied(c => (c === url ? null : c)), 2000)
    } catch {
      setKdsStatus({ type: 'error', text: 'Copy failed — select the URL manually' })
    }
  }

  // === Printing ===
  const savePrintToggle = async (key: 'print_enabled' | 'print_kot_auto' | 'print_receipt_auto', value: boolean, apply: (v: boolean) => void, label: string) => {
    apply(value)
    try {
      await window.api['settings:update']({ [key]: value ? 'true' : 'false' })
      setPrintStatus({ type: 'success', text: `${label} saved` })
    } catch (e: any) {
      setPrintStatus({ type: 'error', text: e?.message ?? `Failed to save ${label}` })
    }
    setTimeout(() => setPrintStatus(null), 2500)
  }

  const savePrintDevice = async (v: string) => {
    setPrintDevice(v)
    try {
      await window.api['settings:update']({ print_device_name: v })
      setPrintStatus({ type: 'success', text: 'Printer saved' })
    } catch (e: any) {
      setPrintStatus({ type: 'error', text: e?.message ?? 'Failed to save printer' })
    }
    setTimeout(() => setPrintStatus(null), 2500)
  }

  const saveReceiptFooter = async () => {
    try {
      await window.api['settings:update']({ receipt_footer: receiptFooter })
      setPrintStatus({ type: 'success', text: 'Receipt footer saved' })
    } catch (e: any) {
      setPrintStatus({ type: 'error', text: e?.message ?? 'Failed to save footer' })
    }
    setTimeout(() => setPrintStatus(null), 2500)
  }

  const printTestPage = async () => {
    setPrintBusy(true)
    try {
      const res = await window.api['print:test']('receipt')
      if (res.ok) {
        setPrintStatus({ type: 'success', text: res.skipped ? `Print skipped — ${res.skipped}` : 'Test page sent to printer' })
      } else {
        setPrintStatus({ type: 'error', text: res.error ?? 'Test print failed' })
      }
    } catch (e: any) {
      setPrintStatus({ type: 'error', text: e?.message ?? 'Test print failed' })
    }
    setPrintBusy(false)
  }

  // === Categories ===
  const openAddCategory = () => {
    setCategoryDraft({ name: '', kind: 'priced', sort_order: '0', purchase_only: false })
    setCategoryStatus(null)
    setCategoryModal({ mode: 'add' })
  }

  const openEditCategory = (c: Category) => {
    setCategoryDraft({ name: c.name, kind: c.kind, sort_order: String(c.sort_order), purchase_only: c.purchase_only === 1 })
    setCategoryStatus(null)
    setCategoryModal({ mode: 'edit', category: c })
  }

  const submitCategory = async () => {
    if (!categoryDraft.name.trim()) { setCategoryStatus({ type: 'error', text: 'Name is required' }); return }
    if (categoryModal?.mode === 'edit') {
      const c = categoryModal.category
      await window.api['categories:upsert']({ id: c.id, name: categoryDraft.name.trim(), kind: categoryDraft.kind as 'priced' | 'free', sort_order: parseInt(categoryDraft.sort_order, 10) || 0, active: c.active, purchase_only: categoryDraft.purchase_only ? 1 : 0 })
      setCategoryModal(null)
      await retryCategories()
      await retryItems()
      setCategoryStatus({ type: 'success', text: 'Category saved' })
    } else {
      await window.api['categories:upsert']({ name: categoryDraft.name.trim(), kind: categoryDraft.kind as 'priced' | 'free', sort_order: parseInt(categoryDraft.sort_order, 10) || 0, active: 1, purchase_only: categoryDraft.purchase_only ? 1 : 0 })
      setCategoryModal(null)
      await retryCategories()
      await retryItems()
      setCategoryStatus({ type: 'success', text: 'Category added' })
    }
    setTimeout(() => setCategoryStatus(null), 2500)
  }

  const toggleCategoryActive = async (c: Category) => {
    await window.api['categories:upsert']({ ...c, active: c.active ? 0 : 1 })
    await retryCategories()
  }

  const deleteCategory = async (c: Category) => {
    await window.api['categories:delete'](c.id)
    if (menuCatId === c.id) setMenuCatId(null)
    await retryCategories()
    await retryAttributes()
    await retryItems()
    setCategoryStatus({ type: 'success', text: 'Category deleted' })
    setTimeout(() => setCategoryStatus(null), 2500)
  }

  // === Attributes ===
  const scopeName = (a: AttributeDef) => {
    if (a.category_id == null) return 'All categories'
    return categories.find(c => c.id === a.category_id)?.name ?? 'All categories'
  }

  const openAddAttr = () => {
    setAttrDraft({ name: '', type: 'text', scope: 'all' })
    setAttrStatus(null)
    setAttrModal({ mode: 'add' })
  }

  const openEditAttr = (a: AttributeDef) => {
    setAttrDraft({ name: a.name, type: a.type, scope: a.category_id == null ? 'all' : String(a.category_id) })
    setAttrStatus(null)
    setAttrModal({ mode: 'edit', attr: a })
  }

  const submitAttr = async () => {
    if (!attrDraft.name.trim()) { setAttrStatus({ type: 'error', text: 'Name is required' }); return }
    if (attrModal?.mode === 'edit') {
      const a = attrModal.attr
      await window.api['attributes:upsert']({ id: a.id, name: attrDraft.name.trim(), type: attrDraft.type as 'text' | 'number' | 'boolean', category_id: attrDraft.scope === 'all' ? null : Number(attrDraft.scope), sort_order: a.sort_order })
      setAttrModal(null)
      await retryAttributes()
      setAttrStatus({ type: 'success', text: 'Attribute saved' })
    } else {
      await window.api['attributes:upsert']({ name: attrDraft.name.trim(), type: attrDraft.type as 'text' | 'number' | 'boolean', category_id: attrDraft.scope === 'all' ? null : Number(attrDraft.scope), sort_order: 0 })
      setAttrModal(null)
      await retryAttributes()
      setAttrStatus({ type: 'success', text: 'Attribute added' })
    }
    setTimeout(() => setAttrStatus(null), 2500)
  }

  const deleteAttr = async (a: AttributeDef) => {
    await window.api['attributes:delete'](a.id)
    await retryAttributes()
    await retryItems()
    setAttrStatus({ type: 'success', text: 'Attribute deleted' })
    setTimeout(() => setAttrStatus(null), 2500)
  }

  // === Menu items ===
  const menuItems = menuCatId == null ? [] : items.filter(i => i.category_id === menuCatId)

  const openAddItem = () => {
    setItemDraft({ name: '', selling: '', cost: '', purchase_unit: 'kg', values: {} })
    setItemStatus(null)
    setItemModal({ mode: 'add' })
  }

  const openEditItem = (item: MenuItemWithCategory) => {
    const values: Record<number, { text?: string; number?: string; boolean?: boolean }> = {}
    for (const def of categoryDefs) {
      const val = item.attribute_values?.find(v => v.attr_def_id === def.id)
      if (def.type === 'text') values[def.id] = { text: val?.value_text ?? '' }
      else if (def.type === 'number') values[def.id] = { number: val?.value_number != null ? String(val.value_number) : '' }
      else values[def.id] = { boolean: val?.value_boolean === 1 }
    }
    setItemDraft({ name: item.name, selling: String(item.selling_price_cents), cost: String(item.cost_price_cents), purchase_unit: item.purchase_unit ?? 'kg', values })
    setItemStatus(null)
    setItemModal({ mode: 'edit', item })
  }

  const submitItem = async () => {
    if (!itemDraft.name.trim()) { setItemStatus({ type: 'error', text: 'Name is required' }); return }
    const selling = parseCents(itemDraft.selling)
    const cost = parseCents(itemDraft.cost)
    if (selling === null || cost === null) { setItemStatus({ type: 'error', text: 'Enter valid prices' }); return }

    if (itemModal?.mode === 'edit') {
      const item = itemModal.item
      await window.api['items:upsert']({ id: item.id, name: itemDraft.name.trim(), selling_price_cents: selling, cost_price_cents: cost, purchase_unit: itemDraft.purchase_unit.trim() || 'kg' })
      if (categoryDefs.length > 0) {
        const values: Array<{ attr_def_id: number; value_text?: string; value_number?: number; value_boolean?: boolean }> = []
        for (const def of categoryDefs) {
          const v = itemDraft.values[def.id]
          if (def.type === 'text') values.push({ attr_def_id: def.id, value_text: v?.text ?? '' })
          else if (def.type === 'number') {
            const n = v?.number !== undefined && v.number !== '' ? Number(v.number) : NaN
            if (!isNaN(n)) values.push({ attr_def_id: def.id, value_number: n })
          } else values.push({ attr_def_id: def.id, value_boolean: v?.boolean ?? false })
        }
        await window.api['attributes:saveValues']({ itemId: item.id, values })
      }
      setItemModal(null)
      await retryItems()
      await retryCategoryDefs()
      setItemStatus({ type: 'success', text: 'Item saved' })
    } else {
      if (menuCatId == null) { setItemStatus({ type: 'error', text: 'Select a category first' }); return }
      await window.api['items:upsert']({ category_id: menuCatId, name: itemDraft.name.trim(), selling_price_cents: selling, cost_price_cents: cost, purchase_unit: itemDraft.purchase_unit.trim() || 'kg', active: 1 })
      setItemModal(null)
      await retryItems()
      setItemStatus({ type: 'success', text: 'Item added' })
    }
    setTimeout(() => setItemStatus(null), 2500)
  }

  const toggleOutOfStock = async (item: MenuItemWithCategory) => {
    await window.api['items:setOutOfStock'](item.id, item.out_of_stock === 0)
    await retryItems()
  }

  const toggleItemActive = async (item: MenuItemWithCategory) => {
    await window.api['items:upsert']({ ...item, id: item.id, active: item.active ? 0 : 1 })
    await retryItems()
  }

  const deleteItem = async (item: MenuItemWithCategory) => {
    await window.api['items:delete'](item.id)
    await retryItems()
    await retryCategoryDefs()
    setItemStatus({ type: 'success', text: 'Item deleted' })
    setTimeout(() => setItemStatus(null), 2500)
  }

  // === PIN ===
  const changePin = async () => {
    if (!userId) { setPinStatus({ type: 'error', text: 'Not logged in' }); return }
    if (!/^\d{4}$/.test(oldPin) || !/^\d{4}$/.test(newPin) || !/^\d{4}$/.test(confirmPin)) {
      setPinStatus({ type: 'error', text: 'All PINs must be 4 digits' }); return
    }
    if (newPin !== confirmPin) { setPinStatus({ type: 'error', text: 'New PIN and confirmation do not match' }); return }
    const ok = await window.api['users:setPin'](userId, oldPin, newPin)
    if (ok) {
      setOldPin(''); setNewPin(''); setConfirmPin('')
      setPinOpen(false)
      setPinStatus({ type: 'success', text: 'PIN changed successfully' })
      setTimeout(() => setPinStatus(null), 2500)
    } else {
      setPinStatus({ type: 'error', text: 'Current PIN is incorrect' })
    }
  }

  // === Backup ===
  const exportBackup = async () => {
    setBackupBusy(true)
    setBackupStatus(null)
    try {
      const filePath = await window.api['backup:export']()
      setBackupStatus(filePath ? { type: 'success', text: `Backup saved to ${filePath}` } : { type: 'info', text: 'Export canceled' })
    } catch {
      setBackupStatus({ type: 'error', text: 'Export failed' })
    }
    setBackupBusy(false)
  }

  const importBackup = async () => {
    setBackupBusy(true)
    setBackupStatus(null)
    try {
      const result = await window.api['backup:import']()
      setBackupStatus(result.ok ? { type: 'success', text: result.message } : { type: 'error', text: result.message })
    } catch {
      setBackupStatus({ type: 'error', text: 'Import failed' })
    }
    setBackupBusy(false)
  }

  const askConfirm = (c: { title: string; description?: string; destructive?: boolean; confirmText?: string; action: () => void }) => {
    setConfirmState({ title: c.title, description: c.description, destructive: c.destructive ?? true, confirmText: c.confirmText, action: c.action })
  }

  const purgeSystem = async () => {
    setPurgeStatus({ type: 'info', text: 'Erasing all data...' })
    try {
      await window.api['system:purge']()
      window.location.reload()
    } catch (e: any) {
      setPurgeStatus({ type: 'error', text: e?.message ?? 'Failed to erase data' })
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <span className="text-[0.9375rem] font-bold">{categories.length} categories · {items.length} items</span>
      </div>

      {/* Business Info */}
      <Section title="Business Info" subtitle="Shown across the app and reports.">
        <div className="flex flex-wrap items-end gap-3">
          <Label className="flex min-w-[240px] flex-1 flex-col gap-1 text-[0.875rem] font-semibold">
            Business name
            <Input className={inputClass} value={businessName} onChange={e => setBusinessName(e.target.value)} />
          </Label>
          <Button className="h-11 bg-primary font-semibold" onClick={saveBusinessName}>Save</Button>
        </div>
        {bizStatus && <StatusLine type={bizStatus.type} text={bizStatus.text} />}
      </Section>

      {/* Kitchen display */}
      <Section title="Kitchen display" subtitle="Alert threshold for overdue orders on the kitchen screen.">
        <div className="flex flex-wrap items-end gap-3">
          <Label className="flex min-w-[240px] flex-1 flex-col gap-1 text-[0.875rem] font-semibold">
            Alert after (minutes)
            <Input
              className={inputClass}
              type="number"
              min={1}
              max={120}
              value={kdsMinutes}
              onChange={e => setKdsMinutes(e.target.value)}
            />
          </Label>
          <Button className="h-11 bg-primary font-semibold" onClick={saveKdsMinutes}>Save</Button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Label className="flex min-w-[240px] flex-1 flex-col gap-1 text-[0.875rem] font-semibold">
            Server port
            <Input
              className={`${inputClass} h-11`}
              type="number"
              min={1}
              max={65535}
              value={kdsPort}
              onChange={e => setKdsPort(e.target.value)}
            />
          </Label>
          <Button className="h-11 bg-primary font-semibold" onClick={saveKdsPort} disabled={kdsBusy}>Save & Restart</Button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Label className="flex min-w-[240px] flex-1 flex-col gap-1 text-[0.875rem] font-semibold">
            Kitchen PIN
            <span className="flex items-center gap-2">
              <Input
                className={`${inputClass} h-11 flex-1`}
                type={showKdsPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={kdsToken}
                placeholder="Not set yet — start the app once"
                readOnly
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 border-border bg-card"
                onClick={() => setShowKdsPin(v => !v)}
                title={showKdsPin ? 'Hide PIN' : 'Show PIN'}
                aria-label={showKdsPin ? 'Hide PIN' : 'Show PIN'}
              >
                {showKdsPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0 border-border bg-card font-semibold"
                onClick={copyKdsPin}
                disabled={!kdsToken}
              >
                {kdsCopied === 'pin' ? 'Copied' : <span className="flex items-center gap-1"><Copy className="h-4 w-4" />Copy</span>}
              </Button>
            </span>
          </Label>
          <Button className="h-11 border-border bg-card font-semibold" variant="outline" onClick={regenerateKdsToken}>Regenerate</Button>
        </div>
        <p className="m-0 text-[0.875rem] text-muted-foreground">Changing the PIN disconnects tablets until they re-enter it.</p>
        {kdsServer != null && (
          kdsServer.running
            ? <StatusLine type="success" text={`Running on port ${kdsServer.port}`} />
            : <StatusLine type="error" text={kdsServer.error ?? 'Server not running'} />
        )}
        {kdsUrls.length > 0 && (
          <div className="flex flex-col gap-2">
            {kdsUrls.map(url => (
              <div key={url} className="flex flex-wrap items-center gap-2">
                <code className="select-all rounded-[var(--radius-md)] border border-border bg-card px-2 py-1 text-[0.875rem]">{url}</code>
                <Button variant="outline" size="sm" className="h-11 border-border bg-card font-semibold" onClick={() => copyKdsUrl(url)}>
                  {kdsCopied === url ? 'Copied' : 'Copy'}
                </Button>
              </div>
            ))}
          </div>
        )}
        <div>
          <Button className="h-11 border-border bg-card font-semibold" variant="outline" onClick={restartKdsServer} disabled={kdsBusy}>Restart server</Button>
        </div>
        {kdsStatus && <StatusLine type={kdsStatus.type} text={kdsStatus.text} />}
      </Section>

      {/* Printing */}
      <Section title="Printing" subtitle="Ticket printers for KOTs and receipts.">
        <Label className="flex min-h-10 flex-row items-center gap-2 text-[0.875rem] font-semibold">
          <Checkbox checked={printEnabled} onCheckedChange={v => void savePrintToggle('print_enabled', v === true, setPrintEnabled, 'Printing')} />
          <span>Enable printing</span>
        </Label>
        <Label className="flex min-h-10 flex-row items-center gap-2 text-[0.875rem] font-semibold">
          <Checkbox checked={printKotAuto} onCheckedChange={v => void savePrintToggle('print_kot_auto', v === true, setPrintKotAuto, 'KOT auto-print')} />
          <span>Auto-print KOT on sale</span>
        </Label>
        <Label className="flex min-h-10 flex-row items-center gap-2 text-[0.875rem] font-semibold">
          <Checkbox checked={printReceiptAuto} onCheckedChange={v => void savePrintToggle('print_receipt_auto', v === true, setPrintReceiptAuto, 'Receipt auto-print')} />
          <span>Auto-print receipt on sale</span>
        </Label>
        <div className="flex flex-wrap items-end gap-3">
          <Label className="flex min-w-[240px] flex-1 flex-col gap-1 text-[0.875rem] font-semibold">
            Printer
            <select
              className={`${inputClass} h-11`}
              value={printDevice}
              onChange={e => void savePrintDevice(e.target.value)}
            >
              <option value="">System default</option>
              {printerList.map(p => (
                <option key={p.name} value={p.name}>{p.name + (p.isDefault ? ' (default)' : '')}</option>
              ))}
            </select>
          </Label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Label className="flex min-w-[240px] flex-1 flex-col gap-1 text-[0.875rem] font-semibold">
            Receipt footer
            <Input
              className={`${inputClass} h-11`}
              value={receiptFooter}
              onChange={e => setReceiptFooter(e.target.value)}
              placeholder="e.g. Thank you, come again!"
            />
          </Label>
          <Button className="h-11 bg-primary font-semibold" onClick={saveReceiptFooter}>Save</Button>
        </div>
        <div>
          <Button className="h-11 border-border bg-card font-semibold" variant="outline" onClick={printTestPage} disabled={printBusy}>
            {printBusy ? 'Printing...' : 'Print test page'}
          </Button>
        </div>
        {printStatus && <StatusLine type={printStatus.type} text={printStatus.text} />}
      </Section>

      {/* Categories */}
      <Section title="Categories" subtitle="Organize menu items into priced (mains) and free (add-on) categories.">
        {categoriesError && (
          <div className="flex items-center gap-3">
            <p className="text-center font-semibold text-destructive">{categoriesError}</p>
            <Button variant="outline" size="sm" onClick={retryCategories}>Retry</Button>
          </div>
        )}
        {categoriesLoading ? (
          <p className="text-center text-muted-foreground">Loading...</p>
        ) : (
        <div className="flex flex-col gap-3">
          {categories.map(c => (
            <div key={c.id} className={`flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-card px-4 py-3 ${c.active ? '' : 'opacity-55'}`}>
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <p className="m-0 text-[0.9375rem] font-bold text-foreground">{c.name}</p>
                <KindBadge kind={c.kind} />
                {c.purchase_only === 1 && <Badge variant="secondary">Stock</Badge>}
                {!c.active && <span className="text-[0.8125rem] font-semibold text-muted-foreground">inactive</span>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="h-11 border-border bg-card font-semibold" onClick={() => toggleCategoryActive(c)}>{c.active ? 'Deactivate' : 'Activate'}</Button>
                <Button className="h-11 bg-primary font-semibold" onClick={() => openEditCategory(c)}>Edit</Button>
                <Button variant="outline" className="h-11 border-destructive text-destructive" onClick={() => askConfirm({ title: `Delete category "${c.name}"?`, description: 'Only allowed if it has no items.', action: () => deleteCategory(c) })}>Delete</Button>
              </div>
            </div>
          ))}
          {categories.length === 0 && <p className="p-12 text-center text-lg text-muted-foreground">No categories yet.</p>}
        </div>
        )}

        <Button className="h-11 w-fit bg-primary font-semibold" onClick={openAddCategory}>+ Add Category</Button>
        {categoryStatus && <StatusLine type={categoryStatus.type} text={categoryStatus.text} />}
      </Section>

      {/* Attributes */}
      <Section title="Attributes" subtitle="Track text, number, or boolean details per menu item.">
        {attributesError && (
          <div className="flex items-center gap-3">
            <p className="text-center font-semibold text-destructive">{attributesError}</p>
            <Button variant="outline" size="sm" onClick={retryAttributes}>Retry</Button>
          </div>
        )}
        {attributesLoading ? (
          <p className="text-center text-muted-foreground">Loading...</p>
        ) : (
        <div className="flex flex-col gap-3">
          {attributes.map(a => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="m-0 text-[0.9375rem] font-bold text-foreground">{a.name}</p>
                <p className="m-0 mt-0.5 text-[0.8125rem] text-muted-foreground">
                  {a.type} · {scopeName(a)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button className="h-11 bg-primary font-semibold" onClick={() => openEditAttr(a)}>Edit</Button>
                <Button variant="outline" className="h-11 border-destructive text-destructive" onClick={() => askConfirm({ title: 'Delete attribute?', description: 'Its saved values will also be removed.', action: () => deleteAttr(a) })}>Delete</Button>
              </div>
            </div>
          ))}
          {attributes.length === 0 && <p className="p-12 text-center text-lg text-muted-foreground">No attributes yet.</p>}
        </div>
        )}

        <Button className="h-11 w-fit bg-primary font-semibold" onClick={openAddAttr}>+ Add Attribute</Button>
        {attrStatus && <StatusLine type={attrStatus.type} text={attrStatus.text} />}
      </Section>

      {/* Menu Items */}
      <Section title="Menu Items" subtitle="Manage items per category, including prices, out-of-stock state, and attribute values.">
        {itemsError && (
          <div className="flex items-center gap-3">
            <p className="text-center font-semibold text-destructive">{itemsError}</p>
            <Button variant="outline" size="sm" onClick={retryItems}>Retry</Button>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <Label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[0.875rem] font-semibold">
            Category
            <Select value={menuCatId == null ? 'none' : String(menuCatId)} onValueChange={v => setMenuCatId(v === 'none' ? null : Number(v))}>
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select category...</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.kind})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
        </div>

        {menuCatId != null && (
          itemsLoading ? (
            <p className="text-center text-muted-foreground">Loading...</p>
          ) : (
          <div className="flex flex-col gap-3">
            {menuItems.map(item => (
              <div key={item.id} className={`flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-card px-4 py-3 ${item.active ? '' : 'opacity-55'}`}>
                <div className="min-w-0">
                  <p className="m-0 text-[0.9375rem] font-bold text-foreground">
                    {item.name}
                    {item.out_of_stock === 1 && <span className="font-semibold text-muted-foreground"> · out of stock</span>}
                    {item.active ? '' : ' · inactive'}
                  </p>
                  <p className="m-0 mt-0.5 text-[0.8125rem] text-muted-foreground">
                    Sell {fmt(item.selling_price_cents)} · Cost {fmt(item.cost_price_cents)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" className="h-11 border-border bg-card font-semibold" onClick={() => toggleOutOfStock(item)}>{item.out_of_stock === 1 ? 'In Stock' : 'Out of Stock'}</Button>
                  <Button variant="outline" className="h-11 border-border bg-card font-semibold" onClick={() => toggleItemActive(item)}>{item.active ? 'Deactivate' : 'Activate'}</Button>
                  <Button className="h-11 bg-primary font-semibold" onClick={() => openEditItem(item)}>Edit</Button>
                  <Button variant="outline" className="h-11 border-destructive text-destructive" onClick={() => askConfirm({ title: `Delete "${item.name}"?`, description: 'Sales history referencing it will be kept (item deactivated).', action: () => deleteItem(item) })}>Delete</Button>
                </div>
              </div>
            ))}
            {menuItems.length === 0 && <p className="p-12 text-center text-lg text-muted-foreground">No items in this category yet.</p>}
          </div>
          )
        )}

        {menuCatId != null && (
          <Button className="h-11 w-fit bg-primary font-semibold" onClick={openAddItem}>+ Add Item</Button>
        )}
        {itemStatus && <StatusLine type={itemStatus.type} text={itemStatus.text} />}
      </Section>

      {/* Change PIN */}
      <Section title="Change PIN" subtitle="Your 4-digit security PIN for logging in.">
        <div>
          <Button className="h-11 w-fit bg-primary font-semibold" onClick={() => { setOldPin(''); setNewPin(''); setConfirmPin(''); setPinStatus(null); setPinOpen(true) }}>Change PIN</Button>
        </div>
        {pinStatus && pinStatus.type === 'success' && <StatusLine type="success" text={pinStatus.text} />}
      </Section>

      {/* Backup */}
      <Section title="Backup" subtitle="Export a full copy of your database or restore from a previous backup.">
        <div className="flex flex-wrap gap-3">
          <Button className="h-11 min-w-[140px] bg-primary font-semibold" onClick={exportBackup} disabled={backupBusy}>Export Backup</Button>
          <Button className="h-11 min-w-[140px] bg-destructive font-semibold text-white hover:bg-destructive/80" onClick={() => askConfirm({ title: 'Import backup?', description: 'Importing a backup will REPLACE all current data in this app. Continue?',
            confirmText: 'Import',
            action: importBackup })} disabled={backupBusy}>Import Backup</Button>
        </div>
        {backupBusy && <StatusLine type="info" text="Working..." />}
        {backupStatus && <StatusLine type={backupStatus.type} text={backupStatus.text} />}
      </Section>

      {/* Danger Zone */}
      {role === 'admin' && (
        <Section title="Danger Zone" subtitle="Erase every sale, inventory item, user, category and setting, then restart the first-time setup wizard.">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="h-11 min-w-[140px] bg-destructive font-semibold text-white hover:bg-destructive/80"
              onClick={() => askConfirm({
                title: 'Erase everything?',
                description: 'This permanently deletes ALL sales, purchases, inventory, users, categories and settings. There is no undo. Consider exporting a backup first. You will land on the setup wizard after restart.',
                confirmText: 'Erase everything',
                action: purgeSystem,
              })}
            >Erase Everything</Button>
          </div>
          {purgeStatus && <StatusLine type={purgeStatus.type} text={purgeStatus.text} />}
        </Section>
      )}

      {/* Category modal */}
      <Dialog open={categoryModal != null} onOpenChange={o => { if (!o) setCategoryModal(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{categoryModal?.mode === 'edit' ? 'Edit Category' : 'Add Category'}</DialogTitle>
            <DialogDescription>
              {categoryModal?.mode === 'edit' ? 'Update the category details.' : 'Create a new menu category.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {categoryStatus?.type === 'error' && <StatusLine type="error" text={categoryStatus.text} />}
            <div className="flex flex-col gap-4">
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">Name<Input className={inputClass} value={categoryDraft.name} onChange={e => setCategoryDraft(d => ({ ...d, name: e.target.value }))} /></Label>
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">Sort order<Input className={inputClass} type="number" value={categoryDraft.sort_order} onChange={e => setCategoryDraft(d => ({ ...d, sort_order: e.target.value }))} /></Label>
            </div>
            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">Kind
              <Select value={categoryDraft.kind} onValueChange={v => setCategoryDraft(d => ({ ...d, kind: v }))}>
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priced">Priced</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                </SelectContent>
              </Select>
            </Label>
            <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-background p-3">
              <Checkbox
                id="cat-purchase-only"
                checked={categoryDraft.purchase_only}
                onCheckedChange={v => setCategoryDraft(d => ({ ...d, purchase_only: v === true }))}
              />
              <Label htmlFor="cat-purchase-only" className="text-[0.875rem] font-semibold">
                Purchase-only (hidden from POS screen)
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="border-border bg-card font-semibold" onClick={() => setCategoryModal(null)}>Cancel</Button>
              <Button type="button" className="bg-primary font-semibold" onClick={submitCategory}>{categoryModal?.mode === 'edit' ? 'Save' : 'Add Category'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attribute modal */}
      <Dialog open={attrModal != null} onOpenChange={o => { if (!o) setAttrModal(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{attrModal?.mode === 'edit' ? 'Edit Attribute' : 'Add Attribute'}</DialogTitle>
            <DialogDescription>
              {attrModal?.mode === 'edit' ? 'Update the attribute details.' : 'Create a new menu attribute.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {attrStatus?.type === 'error' && <StatusLine type="error" text={attrStatus.text} />}
            <div className="flex flex-col gap-4">
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">Name<Input className={inputClass} value={attrDraft.name} onChange={e => setAttrDraft(d => ({ ...d, name: e.target.value }))} /></Label>
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">Type
                <Select value={attrDraft.type} onValueChange={v => setAttrDraft(d => ({ ...d, type: v }))}>
                  <SelectTrigger className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                  </SelectContent>
                </Select>
              </Label>
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">Scope
                <Select value={attrDraft.scope} onValueChange={v => setAttrDraft(d => ({ ...d, scope: v }))}>
                  <SelectTrigger className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.filter(c => c.active).map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="border-border bg-card font-semibold" onClick={() => setAttrModal(null)}>Cancel</Button>
              <Button type="button" className="bg-primary font-semibold" onClick={submitAttr}>{attrModal?.mode === 'edit' ? 'Save' : 'Add Attribute'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Item modal */}
      <Dialog open={itemModal != null} onOpenChange={o => { if (!o) setItemModal(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{itemModal?.mode === 'edit' ? 'Edit Item' : 'Add Item'}</DialogTitle>
            <DialogDescription>
              {categories.find(c => c.id === menuCatId)?.name ?? 'Menu item'} — {itemModal?.mode === 'edit' ? 'update details' : `sell & cost are whole UGX amounts (e.g. 8000 = UGX 8,000)`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {itemStatus?.type === 'error' && <StatusLine type="error" text={itemStatus.text} />}
            <div className="flex flex-col gap-4">
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">Name<Input className={inputClass} value={itemDraft.name} onChange={e => setItemDraft(d => ({ ...d, name: e.target.value }))} /></Label>
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">Selling (UGX)<Input className={inputClass} type="number" min="0" value={itemDraft.selling} onChange={e => setItemDraft(d => ({ ...d, selling: e.target.value }))} /></Label>
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">Cost (UGX)<Input className={inputClass} type="number" min="0" value={itemDraft.cost} onChange={e => setItemDraft(d => ({ ...d, cost: e.target.value }))} /></Label>
            </div>
            <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
              Purchase unit
              <Input className={`${inputClass} max-w-[160px]`} value={itemDraft.purchase_unit} onChange={e => setItemDraft(d => ({ ...d, purchase_unit: e.target.value }))} placeholder="kg" />
            </Label>
            {itemModal?.mode === 'edit' && categoryDefs.length > 0 && (
              <div className="flex flex-col gap-4">
                {categoryDefs.map(def => {
                  const v = itemDraft.values[def.id] ?? {}
                  if (def.type === 'text') return (
                    <Label key={def.id} className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                      {def.name}
                      <Input className={inputClass} value={v.text ?? ''} onChange={e => setItemDraft(d => ({ ...d, values: { ...d.values, [def.id]: { ...v, text: e.target.value } } }))} />
                    </Label>
                  )
                  if (def.type === 'number') return (
                    <Label key={def.id} className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                      {def.name}
                      <Input className={inputClass} type="number" value={v.number ?? ''} onChange={e => setItemDraft(d => ({ ...d, values: { ...d.values, [def.id]: { ...v, number: e.target.value } } }))} />
                    </Label>
                  )
                  return (
                    <Label key={def.id} className="flex min-h-10 flex-row items-center gap-2 text-[0.875rem] font-semibold">
                      <Checkbox checked={v.boolean ?? false} onCheckedChange={(checked) => setItemDraft(d => ({ ...d, values: { ...d.values, [def.id]: { ...v, boolean: checked === true } } }))} />
                      <span>{def.name}</span>
                    </Label>
                  )
                })}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" className="border-border bg-card font-semibold" onClick={() => setItemModal(null)}>Cancel</Button>
              <Button type="button" className="bg-primary font-semibold" onClick={submitItem}>{itemModal?.mode === 'edit' ? 'Save' : 'Add Item'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIN modal */}
      <Dialog open={pinOpen} onOpenChange={o => { if (!o) setPinOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change PIN</DialogTitle>
            <DialogDescription>Enter your current PIN and choose a new 4-digit PIN.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {pinStatus?.type === 'error' && <StatusLine type="error" text={pinStatus.text} />}
            <div className="flex flex-col gap-4">
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">Current PIN<Input className={pinClass} type="password" inputMode="numeric" maxLength={4} value={oldPin} onChange={e => setOldPin(e.target.value.replace(/\D/g, ''))} /></Label>
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">New PIN<Input className={pinClass} type="password" inputMode="numeric" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} /></Label>
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">Confirm new PIN<Input className={pinClass} type="password" inputMode="numeric" maxLength={4} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))} /></Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="border-border bg-card font-semibold" onClick={() => setPinOpen(false)}>Cancel</Button>
              <Button type="button" className="bg-primary font-semibold" onClick={changePin}>Change PIN</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmState != null}
        onOpenChange={o => { if (!o) setConfirmState(null) }}
        title={confirmState?.title ?? ''}
        description={confirmState?.description}
        destructive={confirmState?.destructive ?? true}
        confirmText={confirmState?.confirmText ?? 'Delete'}
        onConfirm={() => {
          const action = confirmState?.action
          setConfirmState(null)
          action?.()
        }}
      />
    </div>
  )
}