import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useCategories } from '../../hooks/useCategories'
import { useAttributes } from '../../hooks/useAttributes'
import { useItems } from '../../hooks/useItems'
import type { Category, MenuItemWithCategory, AttributeDef } from '../../../shared/types'

const fmt = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 })
const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg)',
  color: 'var(--color-text-primary)',
  fontSize: '0.875rem',
  minHeight: 40,
}
const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'var(--color-text-primary)',
}
const btnPrimary: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: 'var(--color-primary)',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.875rem',
  cursor: 'pointer',
  minHeight: 40,
}
const btnGhost: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  fontWeight: 600,
  fontSize: '0.875rem',
  cursor: 'pointer',
  minHeight: 40,
}
const btnDanger: React.CSSProperties = {
  ...btnGhost,
  color: 'var(--color-danger)',
  borderColor: 'var(--color-danger)',
}
const btnDangerSolid: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: 'var(--color-danger)',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.875rem',
  cursor: 'pointer',
  minHeight: 40,
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 24, border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>{title}</h2>
        {subtitle && <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function StatusLine({ type, text }: { type: 'success' | 'error' | 'info'; text: string }) {
  const color = type === 'success' ? 'var(--color-success)' : type === 'error' ? 'var(--color-danger)' : 'var(--color-text-secondary)'
  return <p style={{ color, fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>{text}</p>
}

function KindBadge({ kind }: { kind: 'priced' | 'free' }) {
  return (
    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: kind === 'priced' ? 'var(--color-primary)' : 'var(--color-success)', color: '#fff', fontWeight: 700 }}>
      {kind === 'priced' ? 'Priced' : 'Free'}
    </span>
  )
}

export function SettingsPage() {
  const { userId } = useAuth()

  // Business info
  const [businessName, setBusinessName] = useState('My Restaurant')
  const [bizStatus, setBizStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Categories
  const { categories, loading: categoriesLoading, error: categoriesError, retry: retryCategories } = useCategories(false)
  const [newCategory, setNewCategory] = useState({ name: '', kind: 'priced', sort_order: '0' })
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [categoryDraft, setCategoryDraft] = useState({ name: '', kind: 'priced', sort_order: '0' })
  const [categoryStatus, setCategoryStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Attributes
  const { attributes, loading: attributesLoading, error: attributesError, retry: retryAttributes } = useAttributes(null)
  const [newAttr, setNewAttr] = useState({ name: '', type: 'text', scope: '' })
  const [editingAttrId, setEditingAttrId] = useState<number | null>(null)
  const [attrDraft, setAttrDraft] = useState({ name: '', type: 'text', scope: '' })
  const [attrStatus, setAttrStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Menu items
  const { items, loading: itemsLoading, error: itemsError, retry: retryItems } = useItems()
  const [menuCatId, setMenuCatId] = useState<number | null>(null)
  const { attributes: categoryDefs, retry: retryCategoryDefs } = useAttributes(menuCatId)
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [itemDraft, setItemDraft] = useState<{ name: string; selling: string; cost: string; values: Record<number, { text?: string; number?: string; boolean?: boolean }> }>({ name: '', selling: '', cost: '', values: {} })
  const [newItem, setNewItem] = useState({ name: '', selling: '', cost: '' })
  const [itemStatus, setItemStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // PIN
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinStatus, setPinStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Backup
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [backupBusy, setBackupBusy] = useState(false)

  const parseCents = (s: string) => {
    const n = parseFloat(s)
    if (isNaN(n) || n < 0) return null
    return Math.round(n * 100)
  }

  // === Business info ===
  const saveBusinessName = async () => {
    const name = businessName.trim()
    if (!name) { setBizStatus({ type: 'error', text: 'Business name cannot be empty' }); return }
    await window.api['settings:update']({ business_name: name })
    setBizStatus({ type: 'success', text: 'Business name saved' })
    setTimeout(() => setBizStatus(null), 2500)
  }

  // === Categories ===
  const startEditCategory = (c: Category) => {
    setEditingCategoryId(c.id)
    setCategoryDraft({ name: c.name, kind: c.kind, sort_order: String(c.sort_order) })
  }

  const saveCategory = async (c: Category) => {
    if (!categoryDraft.name.trim()) { setCategoryStatus({ type: 'error', text: 'Name is required' }); return }
    await window.api['categories:upsert']({ id: c.id, name: categoryDraft.name.trim(), kind: categoryDraft.kind as 'priced' | 'free', sort_order: parseInt(categoryDraft.sort_order, 10) || 0, active: c.active })
    setEditingCategoryId(null)
    await retryCategories()
    await retryItems()
    setCategoryStatus({ type: 'success', text: 'Category saved' })
    setTimeout(() => setCategoryStatus(null), 2500)
  }

  const toggleCategoryActive = async (c: Category) => {
    await window.api['categories:upsert']({ ...c, active: c.active ? 0 : 1 })
    await retryCategories()
  }

  const deleteCategory = async (c: Category) => {
    if (!window.confirm(`Delete category "${c.name}"? Only allowed if it has no items.`)) return
    await window.api['categories:delete'](c.id)
    if (menuCatId === c.id) setMenuCatId(null)
    await retryCategories()
    await retryAttributes()
    await retryItems()
    setCategoryStatus({ type: 'success', text: 'Category deleted' })
    setTimeout(() => setCategoryStatus(null), 2500)
  }

  const addCategory = async () => {
    if (!newCategory.name.trim()) { setCategoryStatus({ type: 'error', text: 'Name is required' }); return }
    await window.api['categories:upsert']({ name: newCategory.name.trim(), kind: newCategory.kind as 'priced' | 'free', sort_order: parseInt(newCategory.sort_order, 10) || 0, active: 1 })
    setNewCategory({ name: '', kind: 'priced', sort_order: '0' })
    await retryCategories()
    await retryItems()
    setCategoryStatus({ type: 'success', text: 'Category added' })
    setTimeout(() => setCategoryStatus(null), 2500)
  }

  // === Attributes ===
  const scopeName = (a: AttributeDef) => {
    if (a.category_id == null) return 'All categories'
    return categories.find(c => c.id === a.category_id)?.name ?? 'All categories'
  }

  const startEditAttr = (a: AttributeDef) => {
    setEditingAttrId(a.id)
    setAttrDraft({ name: a.name, type: a.type, scope: a.category_id == null ? '' : String(a.category_id) })
  }

  const saveAttr = async (a: AttributeDef) => {
    if (!attrDraft.name.trim()) { setAttrStatus({ type: 'error', text: 'Name is required' }); return }
    await window.api['attributes:upsert']({ id: a.id, name: attrDraft.name.trim(), type: attrDraft.type as 'text' | 'number' | 'boolean', category_id: attrDraft.scope === '' ? null : Number(attrDraft.scope), sort_order: a.sort_order })
    setEditingAttrId(null)
    await retryAttributes()
    setAttrStatus({ type: 'success', text: 'Attribute saved' })
    setTimeout(() => setAttrStatus(null), 2500)
  }

  const deleteAttr = async (a: AttributeDef) => {
    if (!window.confirm('Delete attribute? Its saved values will also be removed.')) return
    await window.api['attributes:delete'](a.id)
    await retryAttributes()
    await retryItems()
    setAttrStatus({ type: 'success', text: 'Attribute deleted' })
    setTimeout(() => setAttrStatus(null), 2500)
  }

  const addAttr = async () => {
    if (!newAttr.name.trim()) { setAttrStatus({ type: 'error', text: 'Name is required' }); return }
    await window.api['attributes:upsert']({ name: newAttr.name.trim(), type: newAttr.type as 'text' | 'number' | 'boolean', category_id: newAttr.scope === '' ? null : Number(newAttr.scope), sort_order: 0 })
    setNewAttr({ name: '', type: 'text', scope: '' })
    await retryAttributes()
    setAttrStatus({ type: 'success', text: 'Attribute added' })
    setTimeout(() => setAttrStatus(null), 2500)
  }

  // === Menu items ===
  const menuItems = menuCatId == null ? [] : items.filter(i => i.category_id === menuCatId)

  const startEditItem = (item: MenuItemWithCategory) => {
    setEditingItemId(item.id)
    const values: Record<number, { text?: string; number?: string; boolean?: boolean }> = {}
    for (const def of categoryDefs) {
      const val = item.attribute_values?.find(v => v.attr_def_id === def.id)
      if (def.type === 'text') values[def.id] = { text: val?.value_text ?? '' }
      else if (def.type === 'number') values[def.id] = { number: val?.value_number != null ? String(val.value_number) : '' }
      else values[def.id] = { boolean: val?.value_boolean === 1 }
    }
    setItemDraft({ name: item.name, selling: String(item.selling_price_cents / 100), cost: String(item.cost_price_cents / 100), values })
  }

  const saveItem = async (item: MenuItemWithCategory) => {
    if (!itemDraft.name.trim()) { setItemStatus({ type: 'error', text: 'Name is required' }); return }
    const selling = parseCents(itemDraft.selling)
    const cost = parseCents(itemDraft.cost)
    if (selling === null || cost === null) { setItemStatus({ type: 'error', text: 'Enter valid prices' }); return }
    await window.api['items:upsert']({ id: item.id, name: itemDraft.name.trim(), selling_price_cents: selling, cost_price_cents: cost })
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
    setEditingItemId(null)
    await retryItems()
    await retryCategoryDefs()
    setItemStatus({ type: 'success', text: 'Item saved' })
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
    if (!window.confirm(`Delete "${item.name}"? Sales history referencing it will be kept (item deactivated).`)) return
    await window.api['items:delete'](item.id)
    await retryItems()
    await retryCategoryDefs()
    setItemStatus({ type: 'success', text: 'Item deleted' })
    setTimeout(() => setItemStatus(null), 2500)
  }

  const addItem = async () => {
    if (menuCatId == null) { setItemStatus({ type: 'error', text: 'Select a category first' }); return }
    if (!newItem.name.trim()) { setItemStatus({ type: 'error', text: 'Name is required' }); return }
    const selling = parseCents(newItem.selling)
    const cost = parseCents(newItem.cost)
    if (selling === null || cost === null) { setItemStatus({ type: 'error', text: 'Enter valid prices' }); return }
    await window.api['items:upsert']({ category_id: menuCatId, name: newItem.name.trim(), selling_price_cents: selling, cost_price_cents: cost, active: 1 })
    setNewItem({ name: '', selling: '', cost: '' })
    await retryItems()
    setItemStatus({ type: 'success', text: 'Item added' })
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
    if (!window.confirm('Importing a backup will REPLACE all current data in this app. Continue?')) return
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

  const pinInput: React.CSSProperties = { ...inputStyle, textAlign: 'center', letterSpacing: 8, fontWeight: 700, maxWidth: 120, fontSize: '1rem' }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>Settings</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>Manage your business details, menu items, and backups.</p>
      </div>

      {/* Business Info */}
      <Section title="Business Info" subtitle="Shown across the app and reports.">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ ...labelStyle, flex: 1, minWidth: 240 }}>
            Business name
            <input style={inputStyle} value={businessName} onChange={e => setBusinessName(e.target.value)} />
          </label>
          <button style={btnPrimary} onClick={saveBusinessName}>Save</button>
        </div>
        {bizStatus && <StatusLine type={bizStatus.type} text={bizStatus.text} />}
      </Section>

      {/* Categories */}
      <Section title="Categories" subtitle="Organize menu items into priced (mains) and free (add-on) categories.">
        {categoriesError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StatusLine type="error" text={categoriesError} />
            <button style={btnGhost} onClick={retryCategories}>Retry</button>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {categories.map(c => (
            editingCategoryId === c.id ? (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                <label style={labelStyle}>Name<input style={inputStyle} value={categoryDraft.name} onChange={e => setCategoryDraft(d => ({ ...d, name: e.target.value }))} /></label>
                <label style={labelStyle}>Kind
                  <select style={inputStyle} value={categoryDraft.kind} onChange={e => setCategoryDraft(d => ({ ...d, kind: e.target.value }))}>
                    <option value="priced">Priced</option>
                    <option value="free">Free</option>
                  </select>
                </label>
                <label style={labelStyle}>Sort order<input style={inputStyle} type="number" value={categoryDraft.sort_order} onChange={e => setCategoryDraft(d => ({ ...d, sort_order: e.target.value }))} /></label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <button style={btnPrimary} onClick={() => saveCategory(c)}>Save</button>
                  <button style={btnGhost} onClick={() => setEditingCategoryId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', opacity: c.active ? 1 : 0.55 }}>
                <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <p style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0, color: 'var(--color-text-primary)' }}>{c.name}</p>
                  <KindBadge kind={c.kind} />
                  {!c.active && <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>inactive</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button style={btnGhost} onClick={() => toggleCategoryActive(c)}>{c.active ? 'Deactivate' : 'Activate'}</button>
                  <button style={btnPrimary} onClick={() => startEditCategory(c)}>Edit</button>
                  <button style={btnDanger} onClick={() => deleteCategory(c)}>Delete</button>
                </div>
              </div>
            )
          ))}
          {!categoriesLoading && categories.length === 0 && <p style={{ color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '0.9375rem' }}>No categories yet.</p>}
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0, color: 'var(--color-text-primary)' }}>Add category</p>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
            <input style={inputStyle} placeholder="Name" value={newCategory.name} onChange={e => setNewCategory(c => ({ ...c, name: e.target.value }))} />
            <select style={inputStyle} value={newCategory.kind} onChange={e => setNewCategory(c => ({ ...c, kind: e.target.value }))}>
              <option value="priced">Priced</option>
              <option value="free">Free</option>
            </select>
            <input style={inputStyle} type="number" placeholder="Order" value={newCategory.sort_order} onChange={e => setNewCategory(c => ({ ...c, sort_order: e.target.value }))} />
          </div>
          <div>
            <button style={btnPrimary} onClick={addCategory}>Add Category</button>
          </div>
        </div>
        {categoryStatus && <StatusLine type={categoryStatus.type} text={categoryStatus.text} />}
      </Section>

      {/* Attributes */}
      <Section title="Attributes" subtitle="Track text, number, or boolean details per menu item.">
        {attributesError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StatusLine type="error" text={attributesError} />
            <button style={btnGhost} onClick={retryAttributes}>Retry</button>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {attributes.map(a => (
            editingAttrId === a.id ? (
              <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                <label style={labelStyle}>Name<input style={inputStyle} value={attrDraft.name} onChange={e => setAttrDraft(d => ({ ...d, name: e.target.value }))} /></label>
                <label style={labelStyle}>Type
                  <select style={inputStyle} value={attrDraft.type} onChange={e => setAttrDraft(d => ({ ...d, type: e.target.value }))}>
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                  </select>
                </label>
                <label style={labelStyle}>Scope
                  <select style={inputStyle} value={attrDraft.scope} onChange={e => setAttrDraft(d => ({ ...d, scope: e.target.value }))}>
                    <option value="">All categories</option>
                    {categories.filter(c => c.active).map(c => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <button style={btnPrimary} onClick={() => saveAttr(a)}>Save</button>
                  <button style={btnGhost} onClick={() => setEditingAttrId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0, color: 'var(--color-text-primary)' }}>{a.name}</p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                    {a.type} · {scopeName(a)}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={btnPrimary} onClick={() => startEditAttr(a)}>Edit</button>
                  <button style={btnDanger} onClick={() => deleteAttr(a)}>Delete</button>
                </div>
              </div>
            )
          ))}
          {!attributesLoading && attributes.length === 0 && <p style={{ color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '0.9375rem' }}>No attributes yet.</p>}
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0, color: 'var(--color-text-primary)' }}>Add attribute</p>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
            <input style={inputStyle} placeholder="Name" value={newAttr.name} onChange={e => setNewAttr(a => ({ ...a, name: e.target.value }))} />
            <select style={inputStyle} value={newAttr.type} onChange={e => setNewAttr(a => ({ ...a, type: e.target.value }))}>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
            </select>
            <select style={inputStyle} value={newAttr.scope} onChange={e => setNewAttr(a => ({ ...a, scope: e.target.value }))}>
              <option value="">All categories</option>
              {categories.filter(c => c.active).map(c => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <button style={btnPrimary} onClick={addAttr}>Add Attribute</button>
          </div>
        </div>
        {attrStatus && <StatusLine type={attrStatus.type} text={attrStatus.text} />}
      </Section>

      {/* Menu Items */}
      <Section title="Menu Items" subtitle="Manage items per category, including prices, out-of-stock state, and attribute values.">
        {itemsError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StatusLine type="error" text={itemsError} />
            <button style={btnGhost} onClick={retryItems}>Retry</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ ...labelStyle, flex: 1, minWidth: 200 }}>
            Category
            <select style={inputStyle} value={menuCatId == null ? '' : String(menuCatId)} onChange={e => { setMenuCatId(e.target.value === '' ? null : Number(e.target.value)); setEditingItemId(null) }}>
              <option value="">Select category...</option>
              {categories.map(c => (
                <option key={c.id} value={String(c.id)}>{c.name} ({c.kind})</option>
              ))}
            </select>
          </label>
        </div>

        {menuCatId != null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {menuItems.map(item => (
              editingItemId === item.id ? (
                <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8 }}>
                    <label style={labelStyle}>Name<input style={inputStyle} value={itemDraft.name} onChange={e => setItemDraft(d => ({ ...d, name: e.target.value }))} /></label>
                    <label style={labelStyle}>Selling (UGX)<input style={inputStyle} type="number" min="0" value={itemDraft.selling} onChange={e => setItemDraft(d => ({ ...d, selling: e.target.value }))} /></label>
                    <label style={labelStyle}>Cost (UGX)<input style={inputStyle} type="number" min="0" value={itemDraft.cost} onChange={e => setItemDraft(d => ({ ...d, cost: e.target.value }))} /></label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <button style={btnPrimary} onClick={() => saveItem(item)}>Save</button>
                      <button style={btnGhost} onClick={() => setEditingItemId(null)}>Cancel</button>
                    </div>
                  </div>
                  {categoryDefs.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {categoryDefs.map(def => {
                        const v = itemDraft.values[def.id] ?? {}
                        if (def.type === 'text') return (
                          <label key={def.id} style={{ ...labelStyle, flex: 1, minWidth: 160 }}>
                            {def.name}
                            <input style={inputStyle} value={v.text ?? ''} onChange={e => setItemDraft(d => ({ ...d, values: { ...d.values, [def.id]: { ...v, text: e.target.value } } }))} />
                          </label>
                        )
                        if (def.type === 'number') return (
                          <label key={def.id} style={{ ...labelStyle, flex: 1, minWidth: 160 }}>
                            {def.name}
                            <input style={inputStyle} type="number" value={v.number ?? ''} onChange={e => setItemDraft(d => ({ ...d, values: { ...d.values, [def.id]: { ...v, number: e.target.value } } }))} />
                          </label>
                        )
                        return (
                          <label key={def.id} style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 }}>
                            <input type="checkbox" checked={v.boolean ?? false} onChange={e => setItemDraft(d => ({ ...d, values: { ...d.values, [def.id]: { ...v, boolean: e.target.checked } } }))} style={{ width: 20, height: 20 }} />
                            <span>{def.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', opacity: item.active ? 1 : 0.55 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0, color: 'var(--color-text-primary)' }}>
                      {item.name}
                      {item.out_of_stock === 1 && <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}> · out of stock</span>}
                      {item.active ? '' : ' · inactive'}
                    </p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                      Sell {fmt.format(item.selling_price_cents / 100)} · Cost {fmt.format(item.cost_price_cents / 100)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button style={btnGhost} onClick={() => toggleOutOfStock(item)}>{item.out_of_stock === 1 ? 'In Stock' : 'Out of Stock'}</button>
                    <button style={btnGhost} onClick={() => toggleItemActive(item)}>{item.active ? 'Deactivate' : 'Activate'}</button>
                    <button style={btnPrimary} onClick={() => startEditItem(item)}>Edit</button>
                    <button style={btnDanger} onClick={() => deleteItem(item)}>Delete</button>
                  </div>
                </div>
              )
            ))}
            {!itemsLoading && menuItems.length === 0 && <p style={{ color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '0.9375rem' }}>No items in this category yet.</p>}
          </div>
        )}

        {menuCatId != null && (
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0, color: 'var(--color-text-primary)' }}>Add item</p>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
              <input style={inputStyle} placeholder="Name" value={newItem.name} onChange={e => setNewItem(i => ({ ...i, name: e.target.value }))} />
              <input style={inputStyle} type="number" min="0" placeholder="Selling (UGX)" value={newItem.selling} onChange={e => setNewItem(i => ({ ...i, selling: e.target.value }))} />
              <input style={inputStyle} type="number" min="0" placeholder="Cost (UGX)" value={newItem.cost} onChange={e => setNewItem(i => ({ ...i, cost: e.target.value }))} />
            </div>
            <div>
              <button style={btnPrimary} onClick={addItem}>Add Item</button>
            </div>
          </div>
        )}
        {itemStatus && <StatusLine type={itemStatus.type} text={itemStatus.text} />}
      </Section>

      {/* Change PIN */}
      <Section title="Change PIN" subtitle="Your 4-digit security PIN for logging in.">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={labelStyle}>Current PIN<input style={pinInput} type="password" inputMode="numeric" maxLength={4} value={oldPin} onChange={e => setOldPin(e.target.value.replace(/\D/g, ''))} /></label>
          <label style={labelStyle}>New PIN<input style={pinInput} type="password" inputMode="numeric" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} /></label>
          <label style={labelStyle}>Confirm new PIN<input style={pinInput} type="password" inputMode="numeric" maxLength={4} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))} /></label>
          <button style={btnPrimary} onClick={changePin}>Change PIN</button>
        </div>
        {pinStatus && <StatusLine type={pinStatus.type} text={pinStatus.text} />}
      </Section>

      {/* Backup */}
      <Section title="Backup" subtitle="Export a full copy of your database or restore from a previous backup.">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button style={{ ...btnPrimary, minWidth: 140 }} onClick={exportBackup} disabled={backupBusy}>Export Backup</button>
          <button style={btnDangerSolid} onClick={importBackup} disabled={backupBusy}>Import Backup</button>
        </div>
        {backupBusy && <StatusLine type="info" text="Working..." />}
        {backupStatus && <StatusLine type={backupStatus.type} text={backupStatus.text} />}
      </Section>
    </div>
  )
}