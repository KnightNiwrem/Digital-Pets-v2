import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from './EventBus';
import { EventPriority, type GameEvent } from './types';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('subscription and emission', () => {
    it('should subscribe and emit events', async () => {
      const receivedEvents: GameEvent[] = [];

      eventBus.subscribe('test.event', (event) => {
        receivedEvents.push(event);
      });

      const testEvent = eventBus.createEvent('test.event', { message: 'hello' });
      eventBus.emit(testEvent);

      // Allow async processing
      await new Promise((resolve) => setTimeout(resolve, 1));

      expect(receivedEvents).toHaveLength(1);
      expect((receivedEvents[0]!.payload as { message: string }).message).toBe('hello');
    });

    it('should handle multiple subscribers', async () => {
      let handler1Called = false;
      let handler2Called = false;

      eventBus.subscribe('multi.test', () => {
        handler1Called = true;
      });
      eventBus.subscribe('multi.test', () => {
        handler2Called = true;
      });

      eventBus.emit(eventBus.createEvent('multi.test', {}));
      await new Promise((resolve) => setTimeout(resolve, 1));

      expect(handler1Called).toBe(true);
      expect(handler2Called).toBe(true);
    });

    it('should unsubscribe correctly', async () => {
      let called = false;
      const unsubscribe = eventBus.subscribe('unsub.test', () => {
        called = true;
      });

      unsubscribe();
      eventBus.emit(eventBus.createEvent('unsub.test', {}));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(called).toBe(false);
    });
  });

  describe('priority handling', () => {
    it('should process events by priority', async () => {
      const processedOrder: string[] = [];

      eventBus.subscribe('priority.test', (event) => {
        processedOrder.push((event.payload as { priority: string }).priority);
      });

      // Emit in reverse priority order
      eventBus.emit(eventBus.createEvent('priority.test', { priority: 'LOW' }, EventPriority.LOW));
      eventBus.emit(
        eventBus.createEvent('priority.test', { priority: 'HIGH' }, EventPriority.HIGH)
      );
      eventBus.emit(
        eventBus.createEvent('priority.test', { priority: 'IMMEDIATE' }, EventPriority.IMMEDIATE)
      );
      eventBus.emit(
        eventBus.createEvent('priority.test', { priority: 'NORMAL' }, EventPriority.NORMAL)
      );

      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(processedOrder).toEqual(['IMMEDIATE', 'HIGH', 'NORMAL', 'LOW']);
    });
  });

  describe('error handling', () => {
    it('should handle handler errors gracefully', async () => {
      let goodHandlerCalled = false;

      eventBus.subscribe('error.test', () => {
        throw new Error('Handler error');
      });

      eventBus.subscribe('error.test', () => {
        goodHandlerCalled = true;
      });

      // Should not throw
      expect(() => {
        eventBus.emit(eventBus.createEvent('error.test', {}));
      }).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 1));

      // Good handler should still be called
      expect(goodHandlerCalled).toBe(true);
    });
  });

  describe('utility methods', () => {
    it('should track queue size', async () => {
      expect(eventBus.getQueueSize()).toBe(0);

      eventBus.emit(eventBus.createEvent('queue.test', {}));
      // Check queue size immediately after emission (before processing)
      expect(eventBus.getQueueSize()).toBeGreaterThan(0);

      // Wait for processing to complete
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(eventBus.getQueueSize()).toBe(0);
    });

    it('should clear all handlers and queue', () => {
      eventBus.subscribe('clear.test', () => {});
      eventBus.emit(eventBus.createEvent('clear.test', {}));

      eventBus.clear();

      expect(eventBus.getQueueSize()).toBe(0);
    });
  });

  describe('createEvent helper', () => {
    it('should create properly formatted events', () => {
      const event = eventBus.createEvent('helper.test', { data: 'test' }, EventPriority.HIGH);

      expect(event.type).toBe('helper.test');
      expect(event.payload.data).toBe('test');
      expect(event.priority).toBe(EventPriority.HIGH);
      expect(typeof event.timestamp).toBe('number');
    });

    it('should default to NORMAL priority', () => {
      const event = eventBus.createEvent('default.test', {});
      expect(event.priority).toBe(EventPriority.NORMAL);
    });
  });
});
