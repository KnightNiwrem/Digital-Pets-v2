/**
 * Return a uniformly-distributed random integer N such that min <= N <= max.
 *
 * Requirements:
 * - `min` and `max` must be safe integers (Number.isSafeInteger).
 * - Floats are not supported; this function will throw for non-integer inputs.
 * - If `min` > `max` the values are swapped to be forgiving of ordering.
 *
 * @param min - lower bound (inclusive), must be a safe integer
 * @param max - upper bound (inclusive), must be a safe integer
 * @returns a random integer between [min, max]
 */
export function randomInt(min: number, max: number): number {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
    throw new TypeError('randomInt: min and max must be safe integers');
  }
  const [low, high] = min > max ? [max, min] : [min, max];
  const range = high - low + 1;
  return Math.floor(Math.random() * range) + low;
}
