# User Roles & Permissions Design

Date: 2026-09-12
Status: Approved

## Purpose

Introduce a proper user role and permission model to BusinessPOS so that an
**admin** sees the entire system while a **cashier** sees only the POS (Sell)
screen, backed by an explicit permission vocabulary and two React hooks —
`canSee` (page/navigation gating) and `hasAccess` (action gating). Admin
users additionally get a dedicated **Users & Roles** management page.

## Roles

| Role | Description | Permissions |
|---|---|---|
| `admin` | Full access to the entire system including user management. | `'*'` (everything) |
| `cashier` | POS only: Sell screen and till open/close. | `pos.view`, `till.view`, `till.manage` |

Existing `manager` role is removed and migrated to `admin`.

## Permission vocabulary

Single source of truth in `src/lib/permissions.ts`:

- `Module` = `pos | till | expenses | debts | reimbursements | inventory | waste | reports | settings | users`
- `Permission` = `` `${Module}.view` | `${Module}.manage` ``
- `ROLE_PERMISSIONS: Record<Role, Permission[] | '*'>`
- Pure helpers (unit-testable, no React):
  - `permissionsFor(role)` — resolves `'*'` to the full list
  - `hasPermission(role, permission)` — membership check
  - `canSeeRole(role, module)` — `hasPermission(role, \`${module}.view\`)`
  - `ROLE_LABELS` — display names `Admin` / `Cashier`

## Hooks (AuthContext)

- `hasAccess(permission: Permission): boolean` — raw grant check; gates
  actions (e.g. `users.manage` on user-mutation buttons, `expenses.manage`).
- `canSee(module: Module): boolean` — page-level convenience,
  `canSee(m) === hasAccess(\`${m}.view\`)`; drives sidebar entries and the
  `RequireModule` route guard.
- Auth state stores `userId`, `name`, `role`, and the resolved permissions
  list, set on login.

## Route gating

- New `RequireModule` guard component: renders children when
  `canSee(module)` is true, otherwise `<Navigate to="/sell" replace />`.
- `App.tsx`: all non-POS pages (`/expenses`, `/debts`, `/reimbursements`,
  `/inventory`, `/waste`, `/reports`, `/settings`, `/users`) are wrapped in
  their module guard. `/sell` stays open to every authenticated user.
- `/` still redirects to `/sell`.
- `Sidebar` filters `navItems` by `canSee(item.module)`; cashier sees only
  `Sell`.
- `Header` shows the logged-in user's `name` plus a role `Badge`.

Enforcement is renderer-side only (approved decision — single local machine,
context-isolated renderer; no main-process session added).

## Data model & migration

New migration `008_user_roles.ts` (SQLite cannot alter a CHECK):

- `ALTER TABLE users RENAME TO users_old`
- recreate `users` with `role TEXT NOT NULL CHECK(role IN ('admin','cashier'))`
  and a new `created_at TEXT NOT NULL DEFAULT (datetime('now'))` column
- copy rows preserving `id`, `name`, `pin_hash`, `active`, mapping
  `role = 'manager'` → `'admin'`
- drop `users_old`; re-enable FKs; assert `PRAGMA foreign_key_check` is clean
- `users.id` must be preserved: audit columns reference it

`usersRepo.seed()` creates the initial `Admin` user (role `admin`, PIN `1234`)
only when the table is empty.

## Backend (IPC / repository)

Extend `usersRepo` and add `electron/ipc/usersHandlers.ts`:

- `users:list` → all users
- `users:create` (`{name, role, pin}`) — validates non-empty name and
  `/^\d{4}$/` PIN, hashes
- `users:update` (`{id, name?, role?, active?}`)
- `users:resetPin` (`{id, newPin}`) — admin sets a new PIN without the old
- `users:setPin` (user changes own PIN) remains unchanged in settingsHandlers

No hard user delete — soft deactivate (`active = 0`) only, preserving the
audit trail via `created_by` / `voided_by` / etc.

All DB access lives in the Electron main process (NFR-9). Handlers registered
in `main.ts`; exposed via `preload.ts`; typed in `shared/types.ts`
(`Role`, updated `User`, `Api` additions, `auth:login` now returns `name`).

## Safety guards (repo layer)

- Throw `Cannot remove the last admin` when an `update` would demote the
  only active admin to `cashier` or set `active = 0`.
- UI masks self-demotion/self-deactivation (`user.id === userId`) on the
  Users page.

## Users & Roles page (`/users`, admin only)

Follows existing Settings page patterns (`Section`, dialogs, `StatusLine`,
`ConfirmDialog`, `Badge`, `Select`):

- Rows: name, role `Badge`, active state, `created_at`
- Add user (name, role Select, 4-digit PIN)
- Edit (rename, change role)
- Reset PIN (new PIN only, no old PIN needed)
- Activate / Deactivate
- Route gated by `canSee('users')`; every mutation gated by
  `hasAccess('users.manage')`; mutations wrapped in try/catch surfacing repo
  errors (e.g. the last-admin error) via `StatusLine`.

## Testing

- `electron/db/__tests__/db.test.ts` and `electron/__tests__/integration.test.ts`
  run migration 008; integration test's user created with role `admin`.
- New `electron/db/__tests__/user-roles.test.ts`:
  - migration maps `manager`→`admin`, preserves ids, CHECK rejects `manager`,
    `created_at` present
  - repo CRUD, PIN validation, resetPin, unchanged setPin behavior
  - last-admin guard (role demote and deactivate)
  - seed creates a single `admin`
- New `src/lib/__tests__/permissions.test.ts`:
  - admin resolves to every module permission
  - cashier has only `pos.view`, `till.view`, `till.manage`
  - `hasPermission` / `canSeeRole` truth-table spot checks

## Non-goals

- Main-process (IPC-level) authorization enforcement.
- Hard user deletion, login history, or audit log UI for user actions.
- Manager-PIN escalation prompts for void/refund/expense-delete (separate feature).