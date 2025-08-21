import { describe, it, expect } from 'bun:test';
import { randomInt } from './math';

describe('Math utilities', () => {
  describe('randomInt function', () => {
    it('should return a number within the specified range', () => {
      const result = randomInt(1, 10);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(10);
      expect(Number.isInteger(result)).toBe(true);
    });

    it('should handle single value range', () => {
      const result = randomInt(5, 5);
      expect(result).toBe(5);
    });

    it('should swap min and max if min > max', () => {
      const result = randomInt(10, 1);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(10);
    });

    it('should handle negative numbers', () => {
      const result = randomInt(-10, -1);
      expect(result).toBeGreaterThanOrEqual(-10);
      expect(result).toBeLessThanOrEqual(-1);
    });

    it('should handle zero in range', () => {
      const result = randomInt(-5, 5);
      expect(result).toBeGreaterThanOrEqual(-5);
      expect(result).toBeLessThanOrEqual(5);
    });

    it('should throw TypeError for non-safe integers', () => {
      expect(() => randomInt(1.5, 5)).toThrow(TypeError);
      expect(() => randomInt(1, 5.5)).toThrow(TypeError);
      expect(() => randomInt(Number.MAX_SAFE_INTEGER + 1, 10)).toThrow(TypeError);
    });

    it('should produce different results over multiple calls', () => {
      const results = new Set();
      for (let i = 0; i < 100; i++) {
        results.add(randomInt(1, 100));
      }
      // Should have produced multiple different values (very likely)
      expect(results.size).toBeGreaterThan(10);
    });
  });
});
