import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { Protein, Starch } from '../../../shared/types'

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

export function SettingsPage() {
  const { userId } = useAuth()

  // Business info
  const [businessName, setBusinessName] = useState('My Restaurant')
  const [bizStatus, setBizStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Proteins
  const [proteins, setProteins] = useState<Protein[]>([])
  const [editingProteinId, setEditingProteinId] = useState<number | null>(null)
  const [proteinDraft, setProteinDraft] = useState({ name: '', category: '', selling: '', cost: '' })
  const [newProtein, setNewProtein] = useState({ name: '', category: '', selling: '', cost: '' })
  const [proteinStatus, setProteinStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Starches
  const [starches, setStarches] = useState<Starch[]>([])
  const [editingStarchId, setEditingStarchId] = useState<number | null>(null)
  const [starchDraft, setStarchDraft] = useState('')
  const [newStarch, setNewStarch] = useState('')
  const [starchStatus, setStarchStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // PIN
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinStatus, setPinStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Backup
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [backupBusy, setBackupBusy] = useState(false)

  useEffect(() => {
    window.api['settings:get']().then(settings => {
      if (settings.business_name) setBusinessName(settings.business_name)
    })
    window.api['proteins:listAll']().then(setProteins)
    window.api['starches:listAll']().then(setStarches)
  }, [])

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

  // === Proteins ===
  const refreshProteins = () => window.api['proteins:listAll']().then(setProteins)

  const startEditProtein = (p: Protein) => {
    setEditingProteinId(p.id)
    setProteinDraft({
      name: p.name,
      category: p.category,
      selling: String(p.selling_price_cents / 100),
      cost: String(p.cost_price_cents / 100),
    })
  }

  const saveProtein = async (p: Protein) => {
    const selling = parseCents(proteinDraft.selling)
    const cost = parseCents(proteinDraft.cost)
    if (!proteinDraft.name.trim()) { setProteinStatus({ type: 'error', text: 'Name is required' }); return }
    if (!proteinDraft.category.trim()) { setProteinStatus({ type: 'error', text: 'Category is required' }); return }
    if (selling === null || cost === null) { setProteinStatus({ type: 'error', text: 'Enter valid prices' }); return }
    await window.api['proteins:upsert']({ id: p.id, name: proteinDraft.name.trim(), category: proteinDraft.category.trim(), selling_price_cents: selling, cost_price_cents: cost, active: p.active })
    setEditingProteinId(null)
    await refreshProteins()
    setProteinStatus({ type: 'success', text: 'Protein saved' })
    setTimeout(() => setProteinStatus(null), 2500)
  }

  const toggleProteinActive = async (p: Protein) => {
    await window.api['proteins:upsert']({ ...p, active: p.active ? 0 : 1 })
    await refreshProteins()
  }

  const addProtein = async () => {
    const selling = parseCents(newProtein.selling)
    const cost = parseCents(newProtein.cost)
    if (!newProtein.name.trim() || !newProtein.category.trim()) { setProteinStatus({ type: 'error', text: 'Name and category are required' }); return }
    if (selling === null || cost === null) { setProteinStatus({ type: 'error', text: 'Enter valid prices' }); return }
    await window.api['proteins:upsert']({ name: newProtein.name.trim(), category: newProtein.category.trim(), selling_price_cents: selling, cost_price_cents: cost, active: 1 })
    setNewProtein({ name: '', category: '', selling: '', cost: '' })
    await refreshProteins()
    setProteinStatus({ type: 'success', text: 'Protein added' })
    setTimeout(() => setProteinStatus(null), 2500)
  }

  // === Starches ===
  const refreshStarches = () => window.api['starches:listAll']().then(setStarches)

  const saveStarch = async (s: Starch) => {
    if (!starchDraft.trim()) { setStarchStatus({ type: 'error', text: 'Name is required' }); return }
    await window.api['starches:upsert']({ id: s.id, name: starchDraft.trim(), active: s.active })
    setEditingStarchId(null)
    await refreshStarches()
    setStarchStatus({ type: 'success', text: 'Starch saved' })
    setTimeout(() => setStarchStatus(null), 2500)
  }

  const deleteStarch = async (s: Starch) => {
    if (!window.confirm(`Delete "${s.name}"? Sales history referencing it will be kept.`)) return
    await window.api['starches:delete'](s.id)
    await refreshStarches()
    setStarchStatus({ type: 'success', text: 'Starch deleted' })
    setTimeout(() => setStarchStatus(null), 2500)
  }

  const addStarch = async () => {
    if (!newStarch.trim()) { setStarchStatus({ type: 'error', text: 'Name is required' }); return }
    await window.api['starches:upsert']({ name: newStarch.trim(), active: 1 })
    setNewStarch('')
    await refreshStarches()
    setStarchStatus({ type: 'success', text: 'Starch added' })
    setTimeout(() => setStarchStatus(null), 2500)
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

      {/* Proteins */}
      <Section title="Manage Proteins" subtitle="Portion prices drive sales and food-cost calculations. Prices in UGX.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {proteins.map(p => (
            editingProteinId === p.id ? (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                <label style={labelStyle}>Name<input style={inputStyle} value={proteinDraft.name} onChange={e => setProteinDraft(d => ({ ...d, name: e.target.value }))} /></label>
                <label style={labelStyle}>Category<input style={inputStyle} value={proteinDraft.category} onChange={e => setProteinDraft(d => ({ ...d, category: e.target.value }))} /></label>
                <label style={labelStyle}>Selling (UGX)<input style={inputStyle} type="number" min="0" value={proteinDraft.selling} onChange={e => setProteinDraft(d => ({ ...d, selling: e.target.value }))} /></label>
                <label style={labelStyle}>Cost (UGX)<input style={inputStyle} type="number" min="0" value={proteinDraft.cost} onChange={e => setProteinDraft(d => ({ ...d, cost: e.target.value }))} /></label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <button style={btnPrimary} onClick={() => saveProtein(p)}>Save</button>
                  <button style={btnGhost} onClick={() => setEditingProteinId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', opacity: p.active ? 1 : 0.55 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0, color: 'var(--color-text-primary)' }}>{p.name}</p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>{p.category}{p.active ? '' : ' · inactive'}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Sell {fmt.format(p.selling_price_cents / 100)}</span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Cost {fmt.format(p.cost_price_cents / 100)}</span>
                  <button style={btnGhost} onClick={() => toggleProteinActive(p)}>{p.active ? 'Deactivate' : 'Activate'}</button>
                  <button style={btnPrimary} onClick={() => startEditProtein(p)}>Edit</button>
                </div>
              </div>
            )
          ))}
          {proteins.length === 0 && <p style={{ color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '0.9375rem' }}>No proteins yet.</p>}
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0, color: 'var(--color-text-primary)' }}>Add new protein</p>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8 }}>
            <input style={inputStyle} placeholder="Name" value={newProtein.name} onChange={e => setNewProtein(p => ({ ...p, name: e.target.value }))} />
            <input style={inputStyle} placeholder="Category" value={newProtein.category} onChange={e => setNewProtein(p => ({ ...p, category: e.target.value }))} />
            <input style={inputStyle} type="number" min="0" placeholder="Selling (UGX)" value={newProtein.selling} onChange={e => setNewProtein(p => ({ ...p, selling: e.target.value }))} />
            <input style={inputStyle} type="number" min="0" placeholder="Cost (UGX)" value={newProtein.cost} onChange={e => setNewProtein(p => ({ ...p, cost: e.target.value }))} />
          </div>
          <div>
            <button style={btnPrimary} onClick={addProtein}>Add Protein</button>
          </div>
        </div>
        {proteinStatus && <StatusLine type={proteinStatus.type} text={proteinStatus.text} />}
      </Section>

      {/* Starches */}
      <Section title="Manage Starches" subtitle="A starch is the base item served with a protein.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {starches.map(s => (
            editingStarchId === s.id ? (
              <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                <label style={{ ...labelStyle, flex: 1 }}>
                  Name
                  <input style={inputStyle} value={starchDraft} onChange={e => setStarchDraft(e.target.value)} />
                </label>
                <button style={btnPrimary} onClick={() => saveStarch(s)}>Save</button>
                <button style={btnGhost} onClick={() => setEditingStarchId(null)}>Cancel</button>
              </div>
            ) : (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', opacity: s.active ? 1 : 0.55 }}>
                <p style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0, color: 'var(--color-text-primary)' }}>{s.name}{s.active ? '' : ' · inactive'}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={btnGhost} onClick={() => { setEditingStarchId(s.id); setStarchDraft(s.name) }}>Edit</button>
                  <button style={btnDanger} onClick={() => deleteStarch(s)}>Delete</button>
                </div>
              </div>
            )
          ))}
          {starches.length === 0 && <p style={{ color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '0.9375rem' }}>No starches yet.</p>}
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <label style={{ ...labelStyle, flex: 1 }}>
            Add new starch
            <input style={inputStyle} value={newStarch} onChange={e => setNewStarch(e.target.value)} placeholder="Name" />
          </label>
          <button style={btnPrimary} onClick={addStarch}>Add Starch</button>
        </div>
        {starchStatus && <StatusLine type={starchStatus.type} text={starchStatus.text} />}
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