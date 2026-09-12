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