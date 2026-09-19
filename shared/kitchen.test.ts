// shared/kitchen.test.ts
import { describe, test, expect } from 'vitest'
import { isValidKitchenTransition } from './kitchen'
describe('isValidKitchenTransition', () => {
  test('allows linear flow', () => {
    expect(isValidKitchenTransition('new','preparing')).toBe(true)
    expect(isValidKitchenTransition('preparing','completed')).toBe(true)
    expect(isValidKitchenTransition('completed','served')).toBe(true)
  })
  test('rejects backwards and foo', () => {
    expect(isValidKitchenTransition('completed','new')).toBe(false)
    expect(isValidKitchenTransition('new','served')).toBe(false)
    expect(isValidKitchenTransition('new','foo' as any)).toBe(false)
  })
})
