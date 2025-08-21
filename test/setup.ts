// Test setup file for Digital Pet Game
// This file runs before all tests

// Mock DOM globals that might be needed in tests
const mockLocalStorage = {
  getItem: (key: string) => null,
  setItem: (key: string, value: string) => {},
  removeItem: (key: string) => {},
  clear: () => {},
  length: 0,
  key: (index: number) => null,
};

const mockIndexedDB = {
  open: () =>
    Promise.resolve({
      result: {
        createObjectStore: () => {},
        transaction: () => ({
          objectStore: () => ({
            add: () => Promise.resolve(),
            get: () => Promise.resolve(),
            put: () => Promise.resolve(),
            delete: () => Promise.resolve(),
          }),
        }),
      },
    }),
};

// Set up global mocks
(global as any).localStorage = mockLocalStorage;
(global as any).sessionStorage = mockLocalStorage;
(global as any).indexedDB = mockIndexedDB as any;

// Mock requestAnimationFrame and cancelAnimationFrame
(global as any).requestAnimationFrame = (callback: FrameRequestCallback) => {
  return setTimeout(callback, 16); // ~60fps
};

(global as any).cancelAnimationFrame = (id: number) => {
  clearTimeout(id);
};

// Mock performance.now for consistent timing in tests
(global as any).performance = {
  now: () => Date.now(),
  mark: () => {},
  measure: () => {},
  getEntriesByType: () => [],
  getEntriesByName: () => [],
  clearMarks: () => {},
  clearMeasures: () => {},
} as any;

// Console setup for tests
console.log('🧪 Test environment initialized');
