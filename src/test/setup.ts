// Test setup file for Vitest
import { beforeAll } from 'vitest'

// Configure test environment
beforeAll(() => {
  // Set up global test configurations
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})