import { test, expect, describe, beforeEach } from 'bun:test';
import { GameUpdatesQueue, createGameUpdatesQueue } from './GameUpdatesQueue';
import { UPDATE_TYPES } from '../models/constants';
import type { GameUpdate } from '../models';

describe('GameUpdatesQueue', () => {
  let queue: GameUpdatesQueue;

  beforeEach(() => {
    queue = createGameUpdatesQueue();
  });

  describe('Basic Queue Operations', () => {
    test('should start with an empty queue', () => {
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
      expect(queue.dequeue()).toBeNull();
      expect(queue.peek()).toBeNull();
    });

    test('should enqueue and dequeue updates in FIFO order', () => {
      const update1 = {
        type: UPDATE_TYPES.USER_ACTION,
        payload: { action: 'feed' },
        priority: 0,
      };
      const update2 = {
        type: UPDATE_TYPES.GAME_TICK,
        payload: { data: { tick: 1 } },
        priority: 0,
      };

      queue.enqueue(update1);
      queue.enqueue(update2);

      expect(queue.size()).toBe(2);
      expect(queue.isEmpty()).toBe(false);

      const dequeued1 = queue.dequeue();
      expect(dequeued1?.payload.action).toBe('feed');
      expect(queue.size()).toBe(1);

      const dequeued2 = queue.dequeue();
      expect(dequeued2?.payload.data?.tick).toBe(1);
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });

    test('should peek without removing the update', () => {
      const update = {
        type: UPDATE_TYPES.USER_ACTION,
        payload: { action: 'play' },
        priority: 0,
      };

      queue.enqueue(update);

      const peeked = queue.peek();
      expect(peeked?.payload.action).toBe('play');
      expect(queue.size()).toBe(1);

      const dequeued = queue.dequeue();
      expect(dequeued?.payload.action).toBe('play');
      expect(queue.size()).toBe(0);
    });

    test('should clear all updates', () => {
      queue.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: { action: 'feed' },
        priority: 0,
      });
      queue.enqueue({
        type: UPDATE_TYPES.GAME_TICK,
        payload: { data: { tick: 1 } },
        priority: 0,
      });

      expect(queue.size()).toBe(2);

      queue.clear();

      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.dequeue()).toBeNull();
    });
  });

  describe('Priority Queue Behavior', () => {
    test('should prioritize higher priority updates', () => {
      queue.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: { action: 'normal' },
        priority: 0,
      });
      queue.enqueue({
        type: UPDATE_TYPES.BATTLE_ACTION,
        payload: { action: 'critical' },
        priority: 2,
      });
      queue.enqueue({
        type: UPDATE_TYPES.EVENT_TRIGGER,
        payload: { action: 'important' },
        priority: 1,
      });

      const first = queue.dequeue();
      expect(first?.payload.action).toBe('critical');
      expect(first?.priority).toBe(2);

      const second = queue.dequeue();
      expect(second?.payload.action).toBe('important');
      expect(second?.priority).toBe(1);

      const third = queue.dequeue();
      expect(third?.payload.action).toBe('normal');
      expect(third?.priority).toBe(0);
    });

    test('should maintain FIFO order for same priority', () => {
      queue.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: { action: 'first' },
        priority: 1,
      });
      queue.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: { action: 'second' },
        priority: 1,
      });
      queue.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: { action: 'third' },
        priority: 1,
      });

      expect(queue.dequeue()?.payload.action).toBe('first');
      expect(queue.dequeue()?.payload.action).toBe('second');
      expect(queue.dequeue()?.payload.action).toBe('third');
    });

    test('should handle mixed priorities correctly', () => {
      // Add updates with various priorities
      for (let i = 0; i < 10; i++) {
        queue.enqueue({
          type: UPDATE_TYPES.USER_ACTION,
          payload: { data: { id: i } },
          priority: i % 3, // 0, 1, 2, 0, 1, 2...
        });
      }

      expect(queue.size()).toBe(10);

      // Should dequeue in priority order, then FIFO within same priority
      const dequeued = [];
      while (!queue.isEmpty()) {
        const update = queue.dequeue();
        if (update) dequeued.push(update);
      }

      // Check that higher priorities come first
      for (let i = 1; i < dequeued.length; i++) {
        const current = dequeued[i];
        const previous = dequeued[i - 1];
        if (current && previous) {
          expect(current.priority).toBeLessThanOrEqual(previous.priority);
        }
      }
    });
  });

  describe('Update Validation', () => {
    test('should validate update types', () => {
      expect(() => {
        queue.enqueue({
          type: 'INVALID_TYPE' as any,
          payload: {},
          priority: 0,
        });
      }).toThrow('Invalid update type');
    });

    test('should validate payload is an object', () => {
      expect(() => {
        queue.enqueue({
          type: UPDATE_TYPES.USER_ACTION,
          payload: null as any,
          priority: 0,
        });
      }).toThrow('Invalid update payload');

      expect(() => {
        queue.enqueue({
          type: UPDATE_TYPES.USER_ACTION,
          payload: 'string' as any,
          priority: 0,
        });
      }).toThrow('Invalid update payload');
    });

    test('should validate priority is non-negative', () => {
      expect(() => {
        queue.enqueue({
          type: UPDATE_TYPES.USER_ACTION,
          payload: {},
          priority: -1,
        });
      }).toThrow('Update priority must be non-negative');
    });

    test('should set default priority to 0', () => {
      queue.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: { action: 'test' },
        priority: undefined as any,
      });

      const update = queue.dequeue();
      expect(update?.priority).toBe(0);
    });
  });

  describe('Unique ID Generation', () => {
    test('should generate unique IDs for each update', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 100; i++) {
        queue.enqueue({
          type: UPDATE_TYPES.USER_ACTION,
          payload: { data: { index: i } },
          priority: 0,
        });
      }

      while (!queue.isEmpty()) {
        const update = queue.dequeue();
        if (update) {
          expect(ids.has(update.id)).toBe(false);
          ids.add(update.id);
        }
      }

      expect(ids.size).toBe(100);
    });

    test('should include timestamp in updates', () => {
      const before = Date.now();

      queue.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: {},
        priority: 0,
      });

      const after = Date.now();
      const update = queue.dequeue();

      expect(update?.timestamp).toBeGreaterThanOrEqual(before);
      expect(update?.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('Writer/Reader Interfaces', () => {
    test('should create writer for authorized systems', () => {
      const writer = queue.createWriter('UISystem');

      writer.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: { action: 'click' },
        priority: 0,
      });

      const update = queue.dequeue();
      expect(update?.payload.source).toBe('UISystem');
      expect(update?.payload.action).toBe('click');
    });

    test('should reject writer for unauthorized systems', () => {
      expect(() => {
        queue.createWriter('UnauthorizedSystem');
      }).toThrow('not authorized');
    });

    test('should create reader interface', () => {
      const reader = queue.createReader();

      queue.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: { data: { test: true } },
        priority: 0,
      });

      expect(reader.size()).toBe(1);
      expect(reader.isEmpty()).toBe(false);

      const peeked = reader.peek();
      expect(peeked?.payload.data?.test).toBe(true);
      expect(reader.size()).toBe(1);

      const dequeued = reader.dequeue();
      expect(dequeued?.payload.data?.test).toBe(true);
      expect(reader.size()).toBe(0);
      expect(reader.isEmpty()).toBe(true);

      reader.clear();
      expect(queue.size()).toBe(0);
    });

    test('should allow multiple writers', () => {
      const uiWriter = queue.createWriter('UISystem');
      const timeWriter = queue.createWriter('TimeSystem');

      uiWriter.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: { data: { from: 'ui' } },
        priority: 0,
      });

      timeWriter.enqueue({
        type: UPDATE_TYPES.GAME_TICK,
        payload: { data: { from: 'time' } },
        priority: 0,
      });

      expect(queue.size()).toBe(2);

      const first = queue.dequeue();
      expect(first?.payload.source).toBe('UISystem');

      const second = queue.dequeue();
      expect(second?.payload.source).toBe('TimeSystem');
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should provide queue statistics', () => {
      queue.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: {},
        priority: 0,
      });
      queue.enqueue({
        type: UPDATE_TYPES.BATTLE_ACTION,
        payload: {},
        priority: 2,
      });
      queue.enqueue({
        type: UPDATE_TYPES.EVENT_TRIGGER,
        payload: {},
        priority: 1,
      });

      const stats = queue.getStatistics();

      expect(stats.size).toBe(3);
      expect(stats.highPriorityCount).toBe(2);
      expect(stats.normalPriorityCount).toBe(1);
      expect(stats.oldestUpdate).toBeDefined();
      expect(stats.averageAge).toBeGreaterThanOrEqual(0);
    });

    test('should get all updates for debugging', () => {
      queue.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: { data: { id: 1 } },
        priority: 0,
      });
      queue.enqueue({
        type: UPDATE_TYPES.GAME_TICK,
        payload: { data: { id: 2 } },
        priority: 0,
      });

      const allUpdates = queue.getAllUpdates();

      expect(allUpdates.length).toBe(2);
      expect(allUpdates[0]?.payload.data?.id).toBe(1);
      expect(allUpdates[1]?.payload.data?.id).toBe(2);

      // Should not affect the queue
      expect(queue.size()).toBe(2);
    });

    test('should get updates by type', () => {
      queue.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: { data: { id: 1 } },
        priority: 0,
      });
      queue.enqueue({
        type: UPDATE_TYPES.GAME_TICK,
        payload: { data: { id: 2 } },
        priority: 0,
      });
      queue.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: { data: { id: 3 } },
        priority: 0,
      });

      const userActions = queue.getUpdatesByType(UPDATE_TYPES.USER_ACTION);

      expect(userActions.length).toBe(2);
      expect(userActions[0]?.payload.data?.id).toBe(1);
      expect(userActions[1]?.payload.data?.id).toBe(3);
    });

    test('should remove updates matching predicate', () => {
      for (let i = 0; i < 10; i++) {
        queue.enqueue({
          type: UPDATE_TYPES.USER_ACTION,
          payload: { data: { value: i } },
          priority: 0,
        });
      }

      const removed = queue.removeWhere((update) => {
        return update.payload.data?.value % 2 === 0; // Remove even values
      });

      expect(removed).toBe(5);
      expect(queue.size()).toBe(5);

      // Check remaining updates are odd
      const remaining = queue.getAllUpdates();
      for (const update of remaining) {
        expect(update.payload.data?.value % 2).toBe(1);
      }
    });
  });

  describe('Retry Logic', () => {
    test('should requeue retryable updates', () => {
      const update: GameUpdate = {
        id: 'test-id',
        type: UPDATE_TYPES.USER_ACTION,
        timestamp: Date.now(),
        priority: 2,
        payload: { action: 'retry-test' },
        retryable: true,
        maxRetries: 3,
        retryCount: 0,
      };

      const result = queue.requeueForRetry(update);

      expect(result).toBe(true);
      expect(queue.size()).toBe(1);

      const requeued = queue.dequeue();
      expect(requeued?.retryCount).toBe(1);
      expect(requeued?.priority).toBe(1); // Priority reduced
      expect(requeued?.payload.action).toBe('retry-test');
    });

    test('should not requeue non-retryable updates', () => {
      const update: GameUpdate = {
        id: 'test-id',
        type: UPDATE_TYPES.USER_ACTION,
        timestamp: Date.now(),
        priority: 0,
        payload: {},
        retryable: false,
      };

      const result = queue.requeueForRetry(update);

      expect(result).toBe(false);
      expect(queue.size()).toBe(0);
    });

    test('should respect max retry limit', () => {
      const update: GameUpdate = {
        id: 'test-id',
        type: UPDATE_TYPES.USER_ACTION,
        timestamp: Date.now(),
        priority: 0,
        payload: {},
        retryable: true,
        maxRetries: 2,
        retryCount: 2, // Already at max
      };

      const result = queue.requeueForRetry(update);

      expect(result).toBe(false);
      expect(queue.size()).toBe(0);
    });

    test('should use default max retries if not specified', () => {
      const update: GameUpdate = {
        id: 'test-id',
        type: UPDATE_TYPES.USER_ACTION,
        timestamp: Date.now(),
        priority: 0,
        payload: {},
        retryable: true,
        retryCount: 3, // Default max is 3
      };

      const result = queue.requeueForRetry(update);

      expect(result).toBe(false);
    });

    test('should not reduce priority below 0', () => {
      const update: GameUpdate = {
        id: 'test-id',
        type: UPDATE_TYPES.USER_ACTION,
        timestamp: Date.now(),
        priority: 0,
        payload: {},
        retryable: true,
        maxRetries: 3,
        retryCount: 0,
      };

      queue.requeueForRetry(update);

      const requeued = queue.dequeue();
      expect(requeued?.priority).toBe(0); // Should stay at 0, not go negative
    });
  });

  describe('Edge Cases', () => {
    test('should handle rapid enqueue/dequeue cycles', () => {
      for (let i = 0; i < 1000; i++) {
        queue.enqueue({
          type: UPDATE_TYPES.USER_ACTION,
          payload: { data: { index: i } },
          priority: i % 5,
        });

        if (i % 3 === 0) {
          queue.dequeue();
        }
      }

      // Queue should still be functional
      expect(queue.size()).toBeGreaterThan(0);
      expect(queue.isEmpty()).toBe(false);

      // Should be able to drain the queue
      while (!queue.isEmpty()) {
        queue.dequeue();
      }

      expect(queue.isEmpty()).toBe(true);
    });

    test('should handle empty payload objects', () => {
      queue.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: {},
        priority: 0,
      });

      const update = queue.dequeue();
      expect(update?.payload).toEqual({});
    });

    test('should handle complex payload objects', () => {
      const complexPayload = {
        action: 'complex',
        nested: {
          deep: {
            value: 42,
            array: [1, 2, 3],
          },
        },
        date: new Date(),
        nullValue: null,
        undefinedValue: undefined,
      };

      queue.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: complexPayload,
        priority: 0,
      });

      const update = queue.dequeue();
      expect(update?.payload).toEqual(complexPayload);
    });

    test('should handle concurrent access patterns', () => {
      const writers = [
        queue.createWriter('UISystem'),
        queue.createWriter('TimeSystem'),
        queue.createWriter('ActivitySystem'),
      ];
      const reader = queue.createReader();

      // Simulate concurrent writes
      for (let i = 0; i < 30; i++) {
        const writer = writers[i % 3];
        if (writer) {
          writer.enqueue({
            type: UPDATE_TYPES.USER_ACTION,
            payload: { data: { writerId: i % 3, index: i } },
            priority: i % 4,
          });
        }
      }

      expect(reader.size()).toBe(30);

      // Verify all updates are accounted for
      const updates = [];
      while (!reader.isEmpty()) {
        updates.push(reader.dequeue());
      }

      expect(updates.length).toBe(30);
    });
  });
});
