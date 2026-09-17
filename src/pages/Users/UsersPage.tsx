import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useUsers } from '../../hooks/useUsers'
import { ROLE_LABELS } from '../../lib/permissions'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Badge } from '../../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { PaginationFooter } from '../../components/PaginationFooter'
import { usePagination } from '../../hooks/usePagination'
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
import type { User } from '../../../shared/types'

const inputClass = 'min-h-10 rounded-[var(--radius-md)] border-border bg-background text-[0.875rem]'
const selectClass = 'h-11 w-full rounded-[var(--radius-md)]'
const pinClass = `${inputClass} max-w-[120px] text-center text-base font-bold tracking-[8px]`

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-card p-6">
      <div>
        <h2 className="m-0 text-lg font-bold text-foreground">{title}</h2>
        {subtitle && <p className="m-0 mt-1 text-[0.875rem] text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function StatusLine({ type, text }: { type: 'success' | 'error' | 'info'; text: string }) {
  const cls = type === 'success' ? 'text-success' : type === 'error' ? 'text-destructive' : 'text-muted-foreground'
  return <p className={`m-0 text-[0.875rem] font-semibold ${cls}`}>{text}</p>
}

type AddDraft = { name: string; role: string; pin: string }
type EditDraft = { name: string; role: string }
type UserModal = { mode: 'add' } | { mode: 'edit'; user: User }
type PinModal = { user: User }

export function UsersPage() {
  const { userId, hasAccess } = useAuth()
  const { users, loading, error, retry } = useUsers()

  const [modal, setModal] = useState<UserModal | null>(null)
  const [addDraft, setAddDraft] = useState<AddDraft>({ name: '', role: 'cashier', pin: '' })
  const [editDraft, setEditDraft] = useState<EditDraft>({ name: '', role: 'cashier' })
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [pinModal, setPinModal] = useState<PinModal | null>(null)
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinStatus, setPinStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const usersPager = usePagination(users)

  if (!hasAccess('users.manage')) {
    return (
      <div className="flex max-w-900 flex-col gap-5 p-6">
        <h1 className="m-0 text-2xl font-bold text-foreground">Users & Roles</h1>
        <Section title="Access Restricted" subtitle="Admin access required to manage users.">
          <p className="m-0 text-[0.9375rem] font-semibold text-muted-foreground">Admin access required to manage users.</p>
        </Section>
      </div>
    )
  }

  const openAdd = () => {
    setAddDraft({ name: '', role: 'cashier', pin: '' })
    setStatus(null)
    setModal({ mode: 'add' })
  }

  const openEdit = (u: User) => {
    setEditDraft({ name: u.name, role: u.role })
    setStatus(null)
    setModal({ mode: 'edit', user: u })
  }

  const submitAdd = async () => {
    const name = addDraft.name.trim()
    if (!name) { setStatus({ type: 'error', text: 'Name is required' }); return }
    if (!/^\d{4}$/.test(addDraft.pin)) { setStatus({ type: 'error', text: 'PIN must be 4 digits' }); return }
    try {
      await window.api['users:create']({ name, role: addDraft.role as 'admin' | 'cashier', pin: addDraft.pin })
      setModal(null)
      await retry()
      setStatus({ type: 'success', text: 'User created' })
      setTimeout(() => setStatus(null), 2500)
    } catch (err) {
      setStatus({ type: 'error', text: (err as Error).message || 'Failed to create user' })
    }
  }

  const submitEdit = async () => {
    if (!modal || modal.mode !== 'edit') return
    const name = editDraft.name.trim()
    if (!name) { setStatus({ type: 'error', text: 'Name is required' }); return }
    try {
      await window.api['users:update']({ id: modal.user.id, name, role: editDraft.role as 'admin' | 'cashier' })
      setModal(null)
      await retry()
      setStatus({ type: 'success', text: 'User updated' })
      setTimeout(() => setStatus(null), 2500)
    } catch (err) {
      setStatus({ type: 'error', text: (err as Error).message || 'Failed to update user' })
    }
  }

  const toggleActive = async (u: User) => {
    try {
      await window.api['users:update']({ id: u.id, active: u.active ? 0 : 1 })
      await retry()
      setStatus({ type: 'success', text: u.active ? 'User deactivated' : 'User activated' })
      setTimeout(() => setStatus(null), 2500)
    } catch (err) {
      setStatus({ type: 'error', text: (err as Error).message || 'Failed to update user' })
    }
  }

  const openResetPin = (u: User) => {
    setPinModal({ user: u })
    setNewPin('')
    setConfirmPin('')
    setPinStatus(null)
  }

  const submitResetPin = async () => {
    if (!pinModal) return
    if (!/^\d{4}$/.test(newPin)) { setPinStatus({ type: 'error', text: 'PIN must be 4 digits' }); return }
    if (newPin !== confirmPin) { setPinStatus({ type: 'error', text: 'PINs do not match' }); return }
    try {
      await window.api['users:resetPin']({ id: pinModal.user.id, newPin: newPin })
      setPinModal(null)
      setStatus({ type: 'success', text: 'PIN reset' })
      setTimeout(() => setStatus(null), 2500)
    } catch (err) {
      setPinStatus({ type: 'error', text: (err as Error).message || 'Failed to reset PIN' })
    }
  }

  return (
    <div className="flex max-w-900 flex-col gap-5 p-6">
      <div>
        <h1 className="m-0 text-2xl font-bold text-foreground">Users & Roles</h1>
        <p className="m-0 mt-1 text-[0.875rem] text-muted-foreground">Manage staff accounts and roles.</p>
      </div>

      <Section title="Users" subtitle="All registered staff accounts.">
        {error && (
          <div className="flex items-center gap-3">
            <StatusLine type="error" text={error} />
            <Button variant="outline" className="h-11 border-border bg-card font-semibold" onClick={retry}>Retry</Button>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {loading ? (
            <p className="text-[0.9375rem] text-muted-foreground">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="text-[0.9375rem] font-semibold text-muted-foreground">No users yet.</p>
          ) : (
            <>
              <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
                <Table className="table-zebra">
                  <TableHeader>
                    <TableRow className="bg-card hover:bg-card">
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersPager.slice.map(u => (
                      <TableRow key={u.id} className={u.active ? '' : 'opacity-55'}>
                        <TableCell className="font-semibold">{u.name}</TableCell>
                        <TableCell><Badge variant="outline">{ROLE_LABELS[u.role]}</Badge></TableCell>
                        <TableCell>
                          <span className="text-[0.875rem] font-semibold text-muted-foreground">{u.active === 1 ? 'Active' : 'Deactivated'}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button className="h-9 bg-primary px-3 font-semibold" onClick={() => openEdit(u)}>Edit</Button>
                            {u.id !== userId && (
                              <Button variant="outline" className="h-9 border-border bg-card px-3 font-semibold" onClick={() => toggleActive(u)}>
                                {u.active ? 'Deactivate' : 'Activate'}
                              </Button>
                            )}
                            <Button variant="outline" className="h-9 border-border bg-card px-3 font-semibold" onClick={() => openResetPin(u)}>Reset PIN</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <PaginationFooter pager={usersPager} />
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <Button className="h-11 w-fit bg-primary font-semibold" onClick={openAdd}>+ Add User</Button>
        </div>
        {status && <StatusLine type={status.type} text={status.text} />}
      </Section>

      {/* Add / Edit dialog */}
      <Dialog open={modal != null} onOpenChange={o => { if (!o) setModal(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{modal?.mode === 'edit' ? 'Edit User' : 'Add User'}</DialogTitle>
            <DialogDescription>
              {modal?.mode === 'edit' ? 'Update user details.' : 'Create a new staff account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {status?.type === 'error' && <StatusLine type="error" text={status.text} />}
            {modal?.mode === 'add' && (
              <>
                <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                  Name
                  <Input className={inputClass} value={addDraft.name} onChange={e => setAddDraft(d => ({ ...d, name: e.target.value }))} />
                </Label>
                <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                  Role
                  <Select value={addDraft.role} onValueChange={v => setAddDraft(d => ({ ...d, role: v }))}>
                    <SelectTrigger className={selectClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="cashier">Cashier</SelectItem>
                    </SelectContent>
                  </Select>
                </Label>
                <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                  PIN
                  <Input className={pinClass} type="password" inputMode="numeric" maxLength={4} value={addDraft.pin} onChange={e => setAddDraft(d => ({ ...d, pin: e.target.value.replace(/\D/g, '') }))} />
                </Label>
              </>
            )}
            {modal?.mode === 'edit' && (
              <>
                <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                  Name
                  <Input className={inputClass} value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))} />
                </Label>
                {modal.user.id !== userId && (
                  <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                    Role
                    <Select value={editDraft.role} onValueChange={v => setEditDraft(d => ({ ...d, role: v }))}>
                      <SelectTrigger className={selectClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="cashier">Cashier</SelectItem>
                      </SelectContent>
                    </Select>
                  </Label>
                )}
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" className="border-border bg-card font-semibold" onClick={() => setModal(null)}>Cancel</Button>
              <Button type="button" className="bg-primary font-semibold" onClick={modal?.mode === 'edit' ? submitEdit : submitAdd}>
                {modal?.mode === 'edit' ? 'Save' : 'Add User'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset PIN dialog */}
      <Dialog open={pinModal != null} onOpenChange={o => { if (!o) setPinModal(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset PIN</DialogTitle>
            <DialogDescription>Set a new 4-digit PIN for {pinModal?.user.name}.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {pinStatus?.type === 'error' && <StatusLine type="error" text={pinStatus.text} />}
            <div className="flex flex-wrap items-end gap-4">
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                New PIN
                <Input className={pinClass} type="password" inputMode="numeric" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} />
              </Label>
              <Label className="flex flex-col gap-1 text-[0.875rem] font-semibold">
                Confirm PIN
                <Input className={pinClass} type="password" inputMode="numeric" maxLength={4} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))} />
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="border-border bg-card font-semibold" onClick={() => setPinModal(null)}>Cancel</Button>
              <Button type="button" className="bg-primary font-semibold" onClick={submitResetPin}>Reset PIN</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
