# User Roles & Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `admin`/`cashier` roles with a per-module permission model and `canSee`/`hasAccess` hooks, plus a Users & Roles management page.

**Architecture:** A rebuild migration (`008`) repurposes the `users.role` CHECK to `('admin','cashier')` and maps existing `manager`→`admin`. Renderer-only enforcement: a role→permission map in `src/lib/permissions.ts` (admin = `'*'`, cashier = POS/till only) drives a `RequireModule` route guard, sidebar filtering, and action-level gating. New IPC (`users:list/create/update/resetPin`) powers the admin-only `/users` page.

**Tech Stack:** Electron + better-sqlite3, React 18, React Router 6, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-user-roles-permissions-design.md`

## Global Constraints

- Copy/consistent with existing repo style: single quotes, no semicolons, 2-space indent.
- Monetary/IDs unchanged; `users.id` must be preserved across the rebuild (audit columns `created_by`/`voided_by`/etc. reference it).
- No hard user delete — soft deactivate only.
- Guards (repo layer): never drop below 1 active admin.
- All DB access stays in the Electron main process (NFR-9). Renderer only calls `window.api.*`.
- Typecheck gate: `npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.node.json`. Tests: `npm test` (vitest, includes `src/**/*.test.ts`).

## File map

- Modify `shared/types.ts` — `Role`, `User`, `Api` additions
- Create `electron/db/migrations/008_user_roles.ts`
- Modify `electron/db/index.ts` — register migration 8
- Modify `electron/db/repositories/usersRepo.ts` — new methods, guards, seed
- Create `electron/ipc/usersHandlers.ts`; modify `electron/main.ts`
- Modify `electron/preload.ts` — expose new API
- Create `src/lib/permissions.ts` and `src/lib/__tests__/permissions.test.ts`
- Modify `src/context/AuthContext.tsx`
- Create `src/components/RequireModule.tsx`
- Modify `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/Header.tsx`, `electron/ipc/authHandlers.ts`
- Create `src/hooks/useUsers.ts`, `src/pages/Users/UsersPage.tsx`
- Tests: create `electron/db/__tests__/user-roles.test.ts`; modify `electron/db/__tests__/db.test.ts` and `electron/__tests__/integration.test.ts`

---

### Task 1: Role types in `shared/types.ts`

**Files:** Modify `shared/types.ts:2-7` (User + new Role), `:297` (auth:login), `:349` area (new Api entries).

**Interfaces produced:**
```ts
export type Role = 'admin' | 'cashier'
export interface User { id: number; name: string; role: Role; active: number; created_at?: string }
```
Api changes:
```ts
'auth:login': (pin: string) => Promise<{ userId: number; role: Role; name: string } | null>
'users:list': () => Promise<User[]>
'users:create': (payload: { name: string; role: Role; pin: string }) => Promise<User>
'users:update': (payload: { id: number; name?: string; role?: Role; active?: number }) => Promise<User | null>
'users:resetPin': (payload: { id: number; newPin: string }) => Promise<boolean>
```

- [ ] **Step 1:** Add `Role` type; change `User.role` to `Role`; add the four Api entries; change `auth:login` return to include `name: string`.
- [ ] **Step 2:** Run typecheck — no output (only wire changes so far).
- [ ] **Step 3:** Commit `git commit -m "types: add admin/cashier role model and users API"`.

---

### Task 2: Migration `008_user_roles.ts`

**Files:** Create `electron/db/migrations/008_user_roles.ts`; modify `electron/db/index.ts:4-10,29-34` (import + run before `usersRepo.seed()`); modify `electron/db/__tests__/db.test.ts` (import + run migration 8; add tests); modify `electron/__tests__/integration.test.ts` (import + run migration 8 after 007).

- [ ] **Step 1: Write the failing test** — in `db.test.ts`, run `runUserRolesMigration(db)` and assert:
```ts
test('users table rebuilt with admin/cashier roles', () => {
  const cols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[]
  expect(cols.map(c => c.name)).toContain('created_at')
  expect(() => {
    db.prepare("INSERT INTO users (name, role, pin_hash) VALUES ('bad','manager','abcd')").run()
  }).toThrow()
})
```
Plus a manager→admin mapping test: before migration 8 runs, insert a `manager` user; after, assert it reads back as `admin` with the same id.
- [ ] **Step 2: Run it** `npx vitest run electron/db/__tests__/db.test.ts` — FAIL (`Cannot find module '../migrations/008_user_roles'`).
- [ ] **Step 3: Implement** — mirror `007`'s shape:
```ts
import Database from 'better-sqlite3'

export function runUserRolesMigration(db: Database.Database) {
  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]
  const appliedVersions = new Set(applied.map(r => r.version))
  if (appliedVersions.has(8)) return

  db.pragma('foreign_keys = OFF')
  db.transaction(() => {
    db.exec(`
      ALTER TABLE users RENAME TO users_old;
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin','cashier')),
        pin_hash TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO users (id, name, role, pin_hash, active)
        SELECT id, name, CASE WHEN role = 'manager' THEN 'admin' ELSE role END, pin_hash, active FROM users_old;
      DROP TABLE users_old;
    `)
  })()
  db.pragma('foreign_keys = ON')

  const fkCheck = db.prepare('PRAGMA foreign_key_check').all()
  if (fkCheck.length > 0) {
    throw new Error(`Foreign key check failed after migration 008: ${fkCheck.length} violations`)
  }

  db.exec(`INSERT INTO schema_migrations (version) VALUES (8);`)
}
```
- [ ] **Step 4:** Register in `electron/db/index.ts` (import + call before `usersRepo.seed()`), and in `integration.test.ts` before `usersRepo` use.
- [ ] **Step 5:** `npm test` — PASS. Typecheck — silent.
- [ ] **Step 6:** Commit `git commit -m "db: migration 008 admin/cashier roles"`.

---

### Task 3: `usersRepo` expansion + guards + seed

**Files:** Modify `electron/db/repositories/usersRepo.ts`; create `electron/db/__tests__/user-roles.test.ts`; modify `electron/__tests__/integration.test.ts:47` (`'manager'` → `'admin'`).

**Interfaces produced (consumed by Tasks 4-8):**
```ts
import type { Role, User } from '../../shared/types.js'
get(id: number): User | undefined
list(): User[]                                    // SELECT * FROM users ORDER BY id
countActiveAdmins(): number                       // COUNT WHERE role='admin' AND active=1
create(name: string, role: Role, pin: string): User  // throw on empty name / !/^\d{4}$/
resetPin(id: number, newPin: string): boolean     // validate /^\d{4}$/; UPDATE pin_hash
update(id: number, changes: { name?: string; role?: Role; active?: number }): User | null  // throw on missing row; last-admin guard
setPin(userId: number, oldPin: string, newPin: string): boolean  // unchanged
seed(): void                                      // create('Admin', 'admin', '1234') when table empty
```

- [ ] **Step 1: Write failing tests** (`electron/db/__tests__/user-roles.test.ts`, in-memory db running migrations 1–8):
  - `create` remembers role; `list()` returns it with `created_at`.
  - `create('X','admin','12')` throws (PIN not 4 digits); `create('','admin','1234')` throws (empty name).
  - `resetPin(id, '4321')` true; then `setPin(id, '4321', '9999')` true, `setPin(id, '1111', '0000')` false.
  - last-admin guard: single admin → `update(adminId, { role: 'cashier' })` and `update(adminId, { active: 0 })` both throw `Cannot remove the last admin`; with a second admin present, both succeed.
  - `update` returns `null` for a missing id.
  - `seed()` on empty table creates one `admin` user.
- [ ] **Step 2: Run** `npx vitest run electron/db/__tests__/user-roles.test.ts` — FAIL (module missing / methods missing).
- [ ] **Step 3: Implement** in `usersRepo.ts` (keep `hashPin`, keep existing `findByPin` and `setPin`):
```ts
get(id: number): User | undefined {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined
}
list(): User[] {
  return getDb().prepare('SELECT * FROM users ORDER BY id').all() as User[]
}
countActiveAdmins(): number {
  return (getDb().prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND active = 1").get() as { c: number }).c
}
create(name: string, role: Role, pin: string): User {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name is required')
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits')
  const info = getDb().prepare('INSERT INTO users (name, role, pin_hash) VALUES (?, ?, ?)').run(trimmed, role, hashPin(pin))
  return this.get(Number(info.lastInsertRowid)) as User
}
resetPin(id: number, newPin: string): boolean {
  if (!/^\d{4}$/.test(newPin)) throw new Error('PIN must be 4 digits')
  return getDb().prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(newPin), id).changes > 0
}
update(id: number, changes: { name?: string; role?: Role; active?: number }): User | null {
  const existing = this.get(id)
  if (!existing) return null
  const nextRole = changes.role ?? existing.role
  const nextActive = changes.active ?? existing.active
  const demoteOrDeactivate =
    existing.role === 'admin' && (nextRole !== 'admin' || nextActive === 0)
  if (demoteOrDeactivate && this.countActiveAdmins() <= 1) {
    throw new Error('Cannot remove the last admin')
  }
  getDb().prepare('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?')
    .run(changes.name?.trim() || existing.name, nextRole, nextActive, id)
  return this.get(id) as User
}
seed(): void {
  const count = getDb().prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }
  if (count.c === 0) this.create('Admin', 'admin', '1234')
}
```
- [ ] **Step 4:** Fix `integration.test.ts:47`: `usersRepo.create('Test Manager', 'admin', '1234')`.
- [ ] **Step 5:** `npm test` — PASS (new + existing suites). Typecheck — silent.
- [ ] **Step 6:** Commit `git commit -m "db: expand usersRepo with roles, guards, admin seed"`.

---

### Task 4: Users IPC + preload + main registration

**Files:** Create `electron/ipc/usersHandlers.ts`; modify `electron/main.ts` (import + `registerUsersHandlers()`); modify `electron/preload.ts` (add 4 passthroughs); modify `electron/ipc/authHandlers.ts` (return `user.name`).

- [ ] **Step 1: Implement handlers:**
```ts
import { ipcMain } from 'electron'
import { usersRepo } from '../db/repositories/usersRepo.js'
import type { Role } from '../../shared/types.js'

export function registerUsersHandlers() {
  ipcMain.handle('users:list', () => usersRepo.list())
  ipcMain.handle('users:create', (_e, p: { name: string; role: Role; pin: string }) => usersRepo.create(p.name, p.role, p.pin))
  ipcMain.handle('users:update', (_e, p: { id: number; name?: string; role?: Role; active?: number }) => usersRepo.update(p.id, p))
  ipcMain.handle('users:resetPin', (_e, p: { id: number; newPin: string }) => usersRepo.resetPin(p.id, p.newPin))
}
```
- [ ] **Step 2:** Register in `electron/main.ts` next to the other handler registrations.
- [ ] **Step 3:** Add preload passthroughs matching the existing invoke pattern:
```ts
'users:list': () => ipcRenderer.invoke('users:list'),
'users:create': (payload) => ipcRenderer.invoke('users:create', payload),
'users:update': (payload) => ipcRenderer.invoke('users:update', payload),
'users:resetPin': (payload) => ipcRenderer.invoke('users:resetPin', payload),
```
- [ ] **Step 4:** `authHandlers.ts` line 8 → return `{ userId: user.id, role: user.role, name: user.name }`.
- [ ] **Step 5:** Typecheck — silent; `npm test` — still green.
- [ ] **Step 6:** Commit `git commit -m "ipc: users CRUD handlers + authLogin name"`.

---

### Task 5: Permission vocabulary + hooks backend

**Files:** Create `src/lib/permissions.ts` + `src/lib/__tests__/permissions.test.ts`.

- [ ] **Step 1: Write failing tests** (`src/lib/__tests__/permissions.test.ts`):
```ts
import { describe, test, expect } from 'vitest'
import { permissionsFor, hasPermission, canSeeRole, ALL_PERMISSIONS, ROLE_PERMISSIONS } from '../permissions'

test('admin resolves to every module permission', () => {
  expect(ROLE_PERMISSIONS.admin).toBe('*')
  expect([...permissionsFor('admin')].sort()).toEqual([...ALL_PERMISSIONS].sort())
})
test('cashier has only pos.view, till.view, till.manage', () => {
  expect(permissionsFor('cashier')).toEqual(['pos.view', 'till.view', 'till.manage'])
})
test('hasPermission truth table', () => {
  expect(hasPermission('admin', 'users.manage')).toBe(true)
  expect(hasPermission('admin', 'reports.view')).toBe(true)
  expect(hasPermission('cashier', 'reports.view')).toBe(false)
  expect(hasPermission('cashier', 'pos.view')).toBe(true)
  expect(hasPermission('cashier', 'till.manage')).toBe(true)
})
test('canSeeRole', () => {
  expect(canSeeRole('cashier', 'pos')).toBe(true)
  expect(canSeeRole('cashier', 'users')).toBe(false)
  expect(canSeeRole('admin', 'users')).toBe(true)
})
```
- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/permissions.test.ts` — FAIL (module missing).
- [ ] **Step 3: Implement:**
```ts
import type { Role } from '../../shared/types'

export const MODULES = ['pos', 'till', 'expenses', 'debts', 'reimbursements', 'inventory', 'waste', 'reports', 'settings', 'users'] as const
export type Module = typeof MODULES[number]
export type Permission = `${Module}.view` | `${Module}.manage`

export const ALL_PERMISSIONS: Permission[] = MODULES.flatMap((m) => [`${m}.view`, `${m}.manage`] as Permission[])

export const ROLE_PERMISSIONS: Record<Role, Permission[] | '*'> = {
  admin: '*',
  cashier: ['pos.view', 'till.view', 'till.manage'],
}

export const ROLE_LABELS: Record<Role, string> = { admin: 'Admin', cashier: 'Cashier' }

export function permissionsFor(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] === '*' ? ALL_PERMISSIONS : (ROLE_PERMISSIONS[role] as Permission[])
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return permissionsFor(role).includes(permission)
}

export function canSeeRole(role: Role, module: Module): boolean {
  return hasPermission(role, `${module}.view`)
}
```
- [ ] **Step 4:** `npm test` — PASS; typecheck — silent.
- [ ] **Step 5:** Commit `git commit -m "feat: role->permission vocabulary with helpers"`.

---

### Task 6: AuthContext — name, role, permissions, hooks

**Files:** Modify `src/context/AuthContext.tsx`.

- [ ] **Step 1: Implement** — update `AuthState` to `{ userId, name, role, permissions, isAuthenticated }`; import `canSeeRole`, `hasPermission`, `permissionsFor`, and types; `login` maps `result.name`.
```ts
interface AuthState {
  userId: number | null
  name: string | null
  role: Role | null
  permissions: Permission[]
  isAuthenticated: boolean
}

interface AuthContextType extends AuthState {
  login: (pin: string) => Promise<boolean>
  logout: () => void
  hasAccess: (permission: Permission) => boolean
  canSee: (module: Module) => boolean
}

const hasAccess = useCallback(
  (permission: Permission) => auth.role != null && hasPermission(auth.role, permission),
  [auth.role]
)
const canSee = useCallback(
  (module: Module) => auth.role != null && canSeeRole(auth.role, module),
  [auth.role]
)
```
- [ ] **Step 2:** Typecheck — silent; `npm test` — green.
- [ ] **Step 3:** Commit `git commit -m "auth: expose canSee/hasAccess + store name/permissions"`.

---

### Task 7: Route guard, sidebar, header

**Files:** Create `src/components/RequireModule.tsx`; modify `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/Header.tsx`.

- [ ] **Step 1: Implement `RequireModule`:**
```tsx
import { Navigate } from 'react-router-dom'
import React from 'react'
import { useAuth } from '../context/AuthContext'
import type { Module } from '../lib/permissions'

export function RequireModule({ module, children }: { module: Module; children: React.ReactNode }) {
  const { canSee } = useAuth()
  if (!canSee(module)) return <Navigate to="/sell" replace />
  return <>{children}</>
}
```
- [ ] **Step 2: App.tsx** — wrap non-POS pages in their module guards and add `/users`:
```tsx
<Route path="/sell" element={<SellPage />} />
<Route path="/expenses" element={<RequireModule module="expenses"><ExpensesPage /></RequireModule>} />
<Route path="/debts" element={<RequireModule module="debts"><DebtsPage /></RequireModule>} />
<Route path="/reimbursements" element={<RequireModule module="reimbursements"><ReimbursementsPage /></RequireModule>} />
<Route path="/inventory" element={<RequireModule module="inventory"><InventoryPage /></RequireModule>} />
<Route path="/waste" element={<RequireModule module="waste"><WastePage /></RequireModule>} />
<Route path="/reports" element={<RequireModule module="reports"><ReportsPage /></RequireModule>} />
<Route path="/settings" element={<RequireModule module="settings"><SettingsPage /></RequireModule>} />
<Route path="/users" element={<RequireModule module="users"><UsersPage /></RequireModule>} />
```
Import `UsersPage`. Create a stub `src/pages/Users/UsersPage.tsx` exporting `UsersPage` (real implementation lands in Task 8) so the compile gate stays green.
- [ ] **Step 3: Sidebar** — add `module: Module` to each nav entry and filter:
```tsx
const navItems: { to: string; label: string; icon: string; module: Module }[] = [
  { to: '/sell', label: 'Sell', icon: '\u25B6', module: 'pos' },
  { to: '/expenses', label: 'Expenses', icon: '\u25BC', module: 'expenses' },
  { to: '/debts', label: 'Debts', icon: '\u25C0', module: 'debts' },
  { to: '/reimbursements', label: 'Reimbursements', icon: '\u25B2', module: 'reimbursements' },
  { to: '/inventory', label: 'Inventory', icon: '\u25A0', module: 'inventory' },
  { to: '/waste', label: 'Waste', icon: '\u2716', module: 'waste' },
  { to: '/reports', label: 'Reports', icon: '\u2630', module: 'reports' },
  { to: '/settings', label: 'Settings', icon: '\u2699', module: 'settings' },
  { to: '/users', label: 'Users', icon: '\u25C6', module: 'users' },
]
// inside component:
const { canSee } = useAuth()
const items = navItems.filter((i) => canSee(i.module))
```
- [ ] **Step 4: Header** — show `name` + role Badge:
```tsx
import { Badge } from './ui/badge'
import { ROLE_LABELS } from '../lib/permissions'
// in component:
const { logout, name, role } = useAuth()
// before the Logout button:
{name && (
  <div className="flex items-center gap-2">
    <span className="text-sm font-semibold text-foreground">{name}</span>
    {role && <Badge variant="outline">{ROLE_LABELS[role]}</Badge>}
  </div>
)}
```
- [ ] **Step 5:** Typecheck — silent; `npm test` — green.
- [ ] **Step 6:** Commit `git commit -m "feat: role-gate routes, sidebar, header"`.

---

### Task 8: Users & Roles page

**Files:** Create `src/hooks/useUsers.ts`, `src/pages/Users/UsersPage.tsx` (replace stub).

- [ ] **Step 1: `useUsers`** mirrors `useCategories` (`useState`/`useEffect`/`useCallback`; calls `window.api['users:list']()`; returns `{ users, loading, error, retry }`).
- [ ] **Step 2: UsersPage** — inherits the `Section`/`StatusLine`/dialog patterns from `SettingsPage` (which is fine to copy from, not import — it has no exports of these helpers). Structure:
```tsx
export function UsersPage() {
  const { hasAccess } = useAuth()
  const { userId } = useAuth()
  const { users, loading, error, retry } = useUsers()
  // local modal state: add/edit/reset-pin dialogs, status line, confirm state
}
```
  - Rows: name, role Badge (`ROLE_LABELS[role]`), active state (`active === 1 ? 'Active' : 'Deactivated'`), `created_at`.
  - Cells only meaningful when `hasAccess('users.manage')`; otherwise render a muted notice ("Admin access required to manage users").
  - **Add dialog**: name Input, role `Select` (admin/cashier), PIN `Input type=password inputMode=numeric maxLength=4` (pattern from SettingsPage PIN modal).
  - **Edit dialog**: name Input + role `Select` (prefilled). Hide role `Select` (or disable demote) when `user.id === userId`.
  - **Reset PIN dialog**: new PIN + confirm (both `type=password`, numeric, maxLength 4); calls `users:resetPin`.
  - **Activate/Deactivate**: `users:update({ id, active })`; hide the Deactivate button when `user.id === userId`.
  - All mutations in try/catch; on error `setStatus({ type: 'error', text: err.message })`; on success close dialog, `await retry()`, `setStatus({ type: 'success', ... })`. Use a `StatusLine` copy identical to SettingsPage's.
  - Buffers: show `error` from the hook with a Retry button (pattern from SettingsPage categories section).
- [ ] **Step 3:** Typecheck — silent; `npm test` — green.
- [ ] **Step 4:** Commit `git commit -m "feat: Users & Roles management page"`.

---

### Final review

- Run `npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.node.json` and `npm test` on the full branch.
- Whole-branch code review (most capable model): spec compliance + quality; triage any parked/deferred findings.