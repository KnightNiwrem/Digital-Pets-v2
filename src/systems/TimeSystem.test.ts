/**
 * Tests for TimeSystem
 */

import { describe, it, expect, beforeEach, afterEach, jest } from 'bun:test';
import { TimeSystem, createTimeSystem } from './TimeSystem';
import { UPDATE_TYPES } from '../models/constants';

describe('TimeSystem', () => {
  let timeSystem: TimeSystem;
  let gameUpdateWriter: any;
  let enqueuedUpdates: any[] = [];

  beforeEach(() => {
    // Reset state
    enqueuedUpdates = [];

    // Create mock writer that captures enqueued updates
    gameUpdateWriter = {
      enqueue: jest.fn((update: any) => {
        enqueuedUpdates.push(update);
      }),
    };

    // Create TimeSystem with shorter tick interval for testing
    timeSystem = createTimeSystem(gameUpdateWriter, { tickInterval: 1 }); // 1 second for testing
  });

  afterEach(() => {
    // Clean up timers
    timeSystem.stop();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultSystem = new TimeSystem(gameUpdateWriter);
      expect(defaultSystem.getName()).toBe('TimeSystem');
      expect(defaultSystem.isInitialized()).toBe(false);
      expect(defaultSystem.getCurrentTick()).toBe(0);
    });

    it('should initialize with custom configuration', () => {
      const customSystem = new TimeSystem(gameUpdateWriter, {
        tickInterval: 30,
        maxOfflineTicks: 5000,
      });
      expect(customSystem.getName()).toBe('TimeSystem');
      const stats = customSystem.getStatistics();
      expect(stats.tickInterval).toBe(30000); // Converted to milliseconds
    });

    it('should initialize with game update writer', async () => {
      await timeSystem.initialize({});
      expect(timeSystem.isInitialized()).toBe(true);
      expect(timeSystem.isActive()).toBe(true);
    });
  });

  describe('Tick Management', () => {
    it('should start and stop tick timer', async () => {
      await timeSystem.initialize({});

      timeSystem.start();
      const initialTick = timeSystem.getCurrentTick();

      // Wait for a tick
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(timeSystem.getCurrentTick()).toBeGreaterThan(initialTick);

      timeSystem.stop();
    });

    it('should increment tick counter on each tick', async () => {
      await timeSystem.initialize({});

      timeSystem.start();
      const initialTick = timeSystem.getCurrentTick();

      // Wait for 2 ticks
      await new Promise((resolve) => setTimeout(resolve, 2100));

      expect(timeSystem.getCurrentTick()).toBe(initialTick + 2);

      timeSystem.stop();
    });

    it('should queue GAME_TICK updates', async () => {
      await timeSystem.initialize({});

      timeSystem.start();

      // Wait for a tick
      await new Promise((resolve) => setTimeout(resolve, 1100));

      timeSystem.stop();

      // Check that tick update was enqueued
      expect(enqueuedUpdates.length).toBeGreaterThan(0);
      const tickUpdate = enqueuedUpdates.find((u) => u.type === UPDATE_TYPES.GAME_TICK);
      expect(tickUpdate).toBeTruthy();
      expect(tickUpdate!.payload.action).toBe('tick');
    });

    it('should pause and resume correctly', async () => {
      await timeSystem.initialize({});

      timeSystem.start();

      // Wait for a tick
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const ticksBeforePause = timeSystem.getCurrentTick();

      timeSystem.pause();

      // Wait while paused
      await new Promise((resolve) => setTimeout(resolve, 2000));
      expect(timeSystem.getCurrentTick()).toBe(ticksBeforePause);

      timeSystem.resume();

      // Wait for another tick after resume
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect(timeSystem.getCurrentTick()).toBeGreaterThan(ticksBeforePause);

      timeSystem.stop();
    });

    it('should set tick counter correctly', () => {
      timeSystem.setTickCounter(100);
      expect(timeSystem.getCurrentTick()).toBe(100);
    });
  });

  describe('Offline Tick Calculation', () => {
    it('should calculate offline ticks correctly', () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000; // 1 hour ago

      // With 1 second tick interval, 1 hour = 3600 ticks
      const offlineTicks = timeSystem.calculateOfflineTicks(oneHourAgo);
      expect(offlineTicks).toBe(3600);
    });

    it('should cap offline ticks at maximum', () => {
      const customSystem = new TimeSystem(gameUpdateWriter, {
        tickInterval: 1,
        maxOfflineTicks: 100,
      });

      const now = Date.now();
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000; // 1 week ago

      const offlineTicks = customSystem.calculateOfflineTicks(oneWeekAgo);
      expect(offlineTicks).toBe(100); // Capped at max
    });

    it('should process offline ticks in batches', async () => {
      await timeSystem.initialize({});

      await timeSystem.processOfflineTicks(250, 100);

      // Should have 3 batches: 100, 100, 50
      const offlineUpdates = enqueuedUpdates.filter((u) => u.payload.data?.offline === true);
      expect(offlineUpdates.length).toBe(3);
      expect(offlineUpdates[0].payload.data.batchSize).toBe(100);
      expect(offlineUpdates[1].payload.data.batchSize).toBe(100);
      expect(offlineUpdates[2].payload.data.batchSize).toBe(50);

      // Tick counter should be updated
      expect(timeSystem.getCurrentTick()).toBe(250);
    });
  });

  describe('Timer Management', () => {
    it('should register and trigger timers', async () => {
      timeSystem.start();
      timeSystem.registerTimer(
        'test-timer',
        500,
        'activity',
        UPDATE_TYPES.ACTIVITY_COMPLETE,
        { value: 1 },
      );

      // Wait for timer to trigger
      await new Promise((resolve) => setTimeout(resolve, 600));

      const update = enqueuedUpdates.find(
        (u) => u.type === UPDATE_TYPES.ACTIVITY_COMPLETE && u.payload.timerId === 'test-timer',
      );
      expect(update).toBeTruthy();

      timeSystem.stop();
    });

    it('should handle recurring timers', async () => {
      timeSystem.start();
      timeSystem.registerTimer(
        'recurring-timer',
        300,
        'event',
        UPDATE_TYPES.EVENT_TRIGGER,
        { count: 0 },
        true,
      );

      // Wait for multiple triggers - ensure at least 3
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const updates = enqueuedUpdates.filter((u) => u.payload.timerId === 'recurring-timer');
      expect(updates.length).toBeGreaterThanOrEqual(3);

      timeSystem.stop();
    });

    it('should cancel timers', async () => {
      timeSystem.start();
      timeSystem.registerTimer(
        'cancel-timer',
        300,
        'activity',
        UPDATE_TYPES.ACTIVITY_COMPLETE,
        {},
      );

      const cancelled = timeSystem.cancelTimer('cancel-timer');
      expect(cancelled).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 400));
      const update = enqueuedUpdates.find((u) => u.payload.timerId === 'cancel-timer');
      expect(update).toBeUndefined();

      timeSystem.stop();
    });

    it('should get remaining time for timers', async () => {
      timeSystem.start();
      timeSystem.registerTimer(
        'remaining-timer',
        1000,
        'activity',
        UPDATE_TYPES.ACTIVITY_COMPLETE,
        {},
      );

      // Check immediately
      const remaining1 = timeSystem.getTimerRemaining('remaining-timer');
      expect(remaining1).toBeLessThanOrEqual(1000);
      expect(remaining1).toBeGreaterThan(900);

      // Check after some time - allow for timing variations
      await new Promise((resolve) => setTimeout(resolve, 500));
      const remaining2 = timeSystem.getTimerRemaining('remaining-timer');
      expect(remaining2).toBeLessThanOrEqual(510);
      expect(remaining2).toBeGreaterThan(390);

      // Check non-existent timer
      const noRemaining = timeSystem.getTimerRemaining('non-existent');
      expect(noRemaining).toBeNull();

      timeSystem.stop();
    });

    it('should pause and resume timers', async () => {
      timeSystem.start();
      timeSystem.registerTimer(
        'pause-timer',
        600,
        'activity',
        UPDATE_TYPES.ACTIVITY_COMPLETE,
        {},
      );

      // Pause after 200ms
      await new Promise((resolve) => setTimeout(resolve, 200));
      timeSystem.pause();

      // Wait while paused
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(enqueuedUpdates.some((u) => u.payload.timerId === 'pause-timer')).toBe(false);

      // Resume and wait for completion
      timeSystem.resume();
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(enqueuedUpdates.some((u) => u.payload.timerId === 'pause-timer')).toBe(true);

      timeSystem.stop();
    });

    it('should get active timers', () => {
      timeSystem.start();
      timeSystem.registerTimer('timer1', 1000, 'activity', UPDATE_TYPES.ACTIVITY_COMPLETE, {});
      timeSystem.registerTimer('timer2', 2000, 'activity', UPDATE_TYPES.ACTIVITY_COMPLETE, {});

      const activeTimers = timeSystem.getActiveTimers();
      expect(activeTimers.length).toBe(2);
      expect(activeTimers.some((t) => t.id === 'timer1')).toBe(true);
      expect(activeTimers.some((t) => t.id === 'timer2')).toBe(true);

      timeSystem.stop();
    });

    it('should clear all timers', () => {
      timeSystem.start();
      timeSystem.registerTimer('timer1', 1000, 'activity', UPDATE_TYPES.ACTIVITY_COMPLETE, {});
      timeSystem.registerTimer('timer2', 2000, 'activity', UPDATE_TYPES.ACTIVITY_COMPLETE, {});

      timeSystem.clearAllTimers();

      const activeTimers = timeSystem.getActiveTimers();
      expect(activeTimers.length).toBe(0);

      timeSystem.stop();
    });
  });

  describe('Timer Persistence', () => {
    it('should export and load timers', async () => {
      timeSystem.start();
      timeSystem.registerTimer('persist', 300, 'activity', UPDATE_TYPES.ACTIVITY_COMPLETE, {});
      const saved = timeSystem.exportTimers();
      expect(saved.length).toBe(1);

      timeSystem.clearAllTimers();

      // Wait past original duration
      await new Promise((resolve) => setTimeout(resolve, 400));

      timeSystem.loadTimers(saved);

      const update = enqueuedUpdates.find((u) => u.payload.timerId === 'persist');
      expect(update).toBeTruthy();
    });

    it('should load paused timers with remaining time', async () => {
      timeSystem.start();
      timeSystem.registerTimer('paused-load', 600, 'activity', UPDATE_TYPES.ACTIVITY_COMPLETE, {});

      // Pause after some time to capture remaining duration
      await new Promise((resolve) => setTimeout(resolve, 200));
      timeSystem.pause();

      const saved = timeSystem.exportTimers();
      timeSystem.clearAllTimers();

      timeSystem.loadTimers(saved);
      timeSystem.resume();

      // Should complete after remaining ~400ms rather than full 600ms
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(
        enqueuedUpdates.some((u) => u.payload.timerId === 'paused-load'),
      ).toBe(true);
    });
  });

  describe('Real-Time Clock', () => {
    it('should get real-time clock information', () => {
      const clock = timeSystem.getRealTimeClock();

      const now = Date.now();
      expect(Math.abs(clock.timestamp - now)).toBeLessThan(100);
    });

    it('should synchronize with real-time clock', () => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const drift = timeSystem.synchronizeWithRealTime(oneHourAgo);

      // Drift should be approximately 1 hour
      expect(drift).toBeGreaterThan(59 * 60 * 1000);
      expect(drift).toBeLessThan(61 * 60 * 1000);
    });
  });

  describe('System Lifecycle', () => {
    it('should handle shutdown correctly', async () => {
      await timeSystem.initialize({});
      timeSystem.start();

      timeSystem.registerTimer(
        'shutdown-timer',
        1000,
        'activity',
        UPDATE_TYPES.ACTIVITY_COMPLETE,
        {},
      );

      await timeSystem.shutdown();

      expect(timeSystem.isInitialized()).toBe(false);
      expect(timeSystem.getActiveTimers().length).toBe(0);
    });

    it('should handle reset correctly', async () => {
      await timeSystem.initialize({});

      timeSystem.setTickCounter(100);
      timeSystem.registerTimer('reset-timer', 1000, 'activity', UPDATE_TYPES.ACTIVITY_COMPLETE, {});

      await timeSystem.reset();

      expect(timeSystem.getCurrentTick()).toBe(0);
      expect(timeSystem.getActiveTimers().length).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      await timeSystem.initialize({});

      // Writer that throws on enqueue
      gameUpdateWriter.enqueue.mockImplementationOnce(() => {
        throw new Error('Timer enqueue error');
      });

      timeSystem.start();
      timeSystem.registerTimer('error-timer', 100, 'activity', UPDATE_TYPES.ACTIVITY_COMPLETE, {});

      // Wait for timer to trigger - should not crash
      await new Promise((resolve) => setTimeout(resolve, 200));

      // System should still be running
      expect(timeSystem.isActive()).toBe(true);

      timeSystem.stop();
    });
  });

  describe('Statistics', () => {
    it('should provide system statistics', async () => {
      await timeSystem.initialize({});
      timeSystem.start();

      timeSystem.registerTimer('stats-timer', 1000, 'activity', UPDATE_TYPES.ACTIVITY_COMPLETE, {});

      const stats = timeSystem.getStatistics();

      expect(stats.activeTimers).toBe(1);
      expect(stats.isPaused).toBe(false);
      expect(stats.tickInterval).toBe(1000); // 1 second in milliseconds

      timeSystem.stop();
    });

    it('should provide accurate uptime', async () => {
      await timeSystem.initialize({});
      timeSystem.start();

      await new Promise((resolve) => setTimeout(resolve, 2100));

      const stats = timeSystem.getStatistics();
      // Uptime should be at least 2 seconds
      expect(stats.uptime).toBeGreaterThanOrEqual(2000);

      timeSystem.stop();
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple start calls', () => {
      timeSystem.start();
      // Should not throw
      timeSystem.start();

      timeSystem.stop();
    });

    it('should handle stop without start', () => {
      // Should not throw
      timeSystem.stop();
    });

    it('should handle timer with same id', () => {
      timeSystem.start();

      timeSystem.registerTimer('duplicate', 500, 'activity', UPDATE_TYPES.ACTIVITY_COMPLETE, {});
      // Should replace the first timer
      timeSystem.registerTimer('duplicate', 500, 'activity', UPDATE_TYPES.ACTIVITY_COMPLETE, {});

      const activeTimers = timeSystem.getActiveTimers();
      expect(activeTimers.length).toBe(1);

      timeSystem.stop();
    });

    it('should handle zero offline ticks', async () => {
      await timeSystem.initialize({});

      await timeSystem.processOfflineTicks(0);

      // Should not queue any updates
      const offlineUpdates = enqueuedUpdates.filter((u) => u.payload.data?.offline === true);
      expect(offlineUpdates.length).toBe(0);
    });

    it('should handle negative offline time', () => {
      const futureTime = Date.now() + 10000;
      const offlineTicks = timeSystem.calculateOfflineTicks(futureTime);

      // Should return 0 for future times
      expect(offlineTicks).toBe(0);
    });
  });
});
