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
test('assets module exists; admin sees it, cashier does not', () => {
  expect(ALL_PERMISSIONS).toContain('assets.view')
  expect(hasPermission('admin', 'assets.manage')).toBe(true)
  expect(hasPermission('cashier', 'assets.view')).toBe(false)
  expect(canSeeRole('admin', 'assets')).toBe(true)
  expect(canSeeRole('cashier', 'assets')).toBe(false)
})