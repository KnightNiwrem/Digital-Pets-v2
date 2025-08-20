import { test, expect } from 'bun:test';
import { randomInt } from './math';

test('randomInt returns deterministic values when Math.random is stubbed and handles swapped bounds and validation', () => {
  const originalRandom = Math.random;
  try {
    // Middle of the range -> should pick the middle integer
    Math.random = () => 0.5;
    expect(randomInt(1, 3)).toBe(2);

    // Near 1.0 -> should pick the max
    Math.random = () => 0.9999999;
    expect(randomInt(1, 3)).toBe(3);

    // Zero -> should pick the low value; also test swapping bounds (min > max)
    Math.random = () => 0;
    expect(randomInt(3, 1)).toBe(1);

    // Non-integer inputs should throw
    expect(() => randomInt(1.5, 3)).toThrow(TypeError);
    expect(() => randomInt(1, NaN)).toThrow(TypeError);
  } finally {
    Math.random = originalRandom;
  }
});
