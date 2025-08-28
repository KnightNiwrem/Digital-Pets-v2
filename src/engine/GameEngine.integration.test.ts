/**
 * Integration test for GameEngine update processing
 * Tests that updates are processed immediately and sequentially from the queue
 * and that TimeSystem is the sole source of GAME_TICK updates
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { GameEngine } from './GameEngine';
import { UPDATE_TYPES } from '../models/constants';
import type { GameUpdate } from '../models';

// Mock localStorage
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  get length(): number {
    return Object.keys(this.store).length;
  }
}

describe('GameEngine Update Processing', () => {
  let engine: GameEngine;
  let mockLocalStorage: LocalStorageMock;

  beforeEach(() => {
    // Setup mock localStorage
    mockLocalStorage = new LocalStorageMock();
    global.localStorage = mockLocalStorage as any;

    // Create engine with short intervals for testing
    engine = new GameEngine({
      tickInterval: 1, // 1 second for testing
      autoStart: false,
      debugMode: false,
    });
  });

  afterEach(async () => {
    // Clean up
    await engine.stop();
    mockLocalStorage.clear();
  });

  it('should process updates immediately without waiting for ticks', async () => {
    // Initialize engine
    await engine.initialize();

    // Track when updates are processed
    const processedUpdates: string[] = [];

    // Spy on processUpdate to track when updates are processed
    const originalProcessUpdate = (engine as any).processUpdate.bind(engine);
    (engine as any).processUpdate = mock(async (update: GameUpdate) => {
      processedUpdates.push(update.type);
      return originalProcessUpdate(update);
    });

    // Start the engine
    await engine.start();

    // Get the update queue writer
    const writer = (engine as any).updatesQueue.createWriter('TestSystem');

    // Queue several non-tick updates
    writer.enqueue({
      type: UPDATE_TYPES.USER_ACTION,
      payload: { action: 'test1', data: {} },
    });

    writer.enqueue({
      type: UPDATE_TYPES.STATE_TRANSITION,
      payload: { action: 'test2', data: {} },
    });

    // Wait a short time for processing (should be immediate, but allow for async)
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Check that updates were processed immediately
    expect(processedUpdates.length).toBeGreaterThanOrEqual(2);
    expect(processedUpdates).toContain(UPDATE_TYPES.USER_ACTION);
    expect(processedUpdates).toContain(UPDATE_TYPES.STATE_TRANSITION);
  });

  it('should process updates sequentially in FIFO order', async () => {
    await engine.initialize();

    // Track update processing order
    const processingOrder: string[] = [];

    // Spy on processUpdate
    const originalProcessUpdate = (engine as any).processUpdate.bind(engine);
    (engine as any).processUpdate = mock(async (update: GameUpdate) => {
      if (update.payload?.action) {
        processingOrder.push(update.payload.action);
      }
      // Add small delay to ensure sequential processing
      await new Promise((resolve) => setTimeout(resolve, 10));
      return originalProcessUpdate(update);
    });

    await engine.start();

    const writer = (engine as any).updatesQueue.createWriter('TestSystem');

    // Queue updates in specific order
    const expectedOrder = ['first', 'second', 'third', 'fourth'];
    for (const action of expectedOrder) {
      writer.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: { action, data: {} },
      });
    }

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify sequential FIFO processing
    expect(processingOrder.slice(0, 4)).toEqual(expectedOrder);
  });

  it('should receive GAME_TICK updates only from TimeSystem', async () => {
    await engine.initialize();

    // Get TimeSystem and configure it with a shorter interval for testing
    const timeSystem = (engine as any).systems.get('TimeSystem');
    if (timeSystem) {
      // Stop the default timer
      timeSystem.stop();
      // Manually set a shorter tick interval for testing (100ms)
      (timeSystem as any).tickInterval = 100;
    }

    // Track GAME_TICK updates
    const tickUpdates: GameUpdate[] = [];

    // Spy on processUpdate to capture GAME_TICK updates
    const originalProcessUpdate = (engine as any).processUpdate.bind(engine);
    (engine as any).processUpdate = mock(async (update: GameUpdate) => {
      if (update.type === UPDATE_TYPES.GAME_TICK) {
        tickUpdates.push(update);
      }
      return originalProcessUpdate(update);
    });

    // Start engine (which will restart TimeSystem with the new interval)
    await engine.start();

    // Wait for at least one tick (with 100ms interval, waiting 250ms should give us at least 2 ticks)
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Should have received at least one GAME_TICK from TimeSystem
    expect(tickUpdates.length).toBeGreaterThanOrEqual(1);

    // All GAME_TICK updates should have the correct payload structure
    for (const update of tickUpdates) {
      expect(update.type).toBe(UPDATE_TYPES.GAME_TICK);
      expect(update.payload.action).toBe('tick');
      expect(update.payload.data).toHaveProperty('tickNumber');
      expect(update.payload.data).toHaveProperty('timestamp');
      expect(update.payload.data).toHaveProperty('deltaTime');
    }
  });

  it('should not generate its own GAME_TICK updates', async () => {
    await engine.initialize();

    // Track all updates
    const allUpdates: GameUpdate[] = [];

    // Spy on processUpdate
    const originalProcessUpdate = (engine as any).processUpdate.bind(engine);
    (engine as any).processUpdate = mock(async (update: GameUpdate) => {
      allUpdates.push(update);
      return originalProcessUpdate(update);
    });

    // Start the engine (which will start TimeSystem)
    await engine.start();

    // Immediately stop TimeSystem to ensure no ticks come from there
    const timeSystem = (engine as any).systems.get('TimeSystem');
    if (timeSystem) {
      timeSystem.stop();
    }

    // Queue a non-tick update to ensure processing is working
    const writer = (engine as any).updatesQueue.createWriter('TestSystem');
    writer.enqueue({
      type: UPDATE_TYPES.USER_ACTION,
      payload: { action: 'test', data: {} },
    });

    // Wait for a period longer than the old tick interval
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Should have the user action but no GAME_TICK updates (after stopping TimeSystem)
    const userActions = allUpdates.filter((u) => u.type === UPDATE_TYPES.USER_ACTION);
    expect(userActions.length).toBeGreaterThanOrEqual(1);

    // Clear the updates and wait again
    allUpdates.length = 0;
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should not receive any new ticks after TimeSystem was stopped
    const newTickUpdates = allUpdates.filter((u) => u.type === UPDATE_TYPES.GAME_TICK);
    expect(newTickUpdates.length).toBe(0);
  });

  it('should handle high update throughput without blocking', async () => {
    await engine.initialize();
    await engine.start();

    const writer = (engine as any).updatesQueue.createWriter('TestSystem');
    const updateCount = 1000;

    // Track processing
    let processedCount = 0;
    const originalProcessUpdate = (engine as any).processUpdate.bind(engine);
    (engine as any).processUpdate = mock(async (update: GameUpdate) => {
      processedCount++;
      return originalProcessUpdate(update);
    });

    // Queue many updates rapidly
    const startTime = Date.now();
    for (let i = 0; i < updateCount; i++) {
      writer.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: { action: `test-${i}`, data: { index: i } },
      });
    }

    // Wait for processing to complete (with timeout)
    const maxWaitTime = 5000; // 5 seconds max
    const checkInterval = 50;
    let waited = 0;

    while (processedCount < updateCount && waited < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }

    const processingTime = Date.now() - startTime;

    // All updates should be processed
    expect(processedCount).toBeGreaterThanOrEqual(updateCount);

    // Processing should be reasonably fast (less than 5ms per update on average)
    const avgTimePerUpdate = processingTime / updateCount;
    expect(avgTimePerUpdate).toBeLessThan(5);

    console.log(
      `Processed ${updateCount} updates in ${processingTime}ms (${avgTimePerUpdate.toFixed(2)}ms per update)`,
    );
  });

  it('should maintain update processing after errors', async () => {
    await engine.initialize();

    const processedUpdates: string[] = [];

    // Spy on processUpdate to simulate an error on specific update
    const originalProcessUpdate = (engine as any).processUpdate.bind(engine);
    (engine as any).processUpdate = mock(async (update: GameUpdate) => {
      if (update.payload?.action === 'error-update') {
        throw new Error('Test error');
      }
      if (update.payload?.action) {
        processedUpdates.push(update.payload.action);
      }
      return originalProcessUpdate(update);
    });

    await engine.start();

    const writer = (engine as any).updatesQueue.createWriter('TestSystem');

    // Queue updates including one that will error
    writer.enqueue({
      type: UPDATE_TYPES.USER_ACTION,
      payload: { action: 'before-error', data: {} },
    });

    writer.enqueue({
      type: UPDATE_TYPES.USER_ACTION,
      payload: { action: 'error-update', data: {} },
    });

    writer.enqueue({
      type: UPDATE_TYPES.USER_ACTION,
      payload: { action: 'after-error', data: {} },
    });

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should have processed updates before and after the error
    expect(processedUpdates).toContain('before-error');
    expect(processedUpdates).toContain('after-error');
    expect(processedUpdates).not.toContain('error-update');
  });
});
