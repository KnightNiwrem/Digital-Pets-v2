import { describe, it, expect } from 'vitest'

describe('Basic Tests', () => {
  it('should run a basic test', () => {
    expect(1 + 1).toBe(2)
  })

  it('should verify TypeScript compilation', () => {
    const testValue: string = 'hello'
    expect(typeof testValue).toBe('string')
  })
})