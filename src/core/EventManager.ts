import type { GameSystem, GameEvent, EventHandler, Unsubscribe } from '../types';
import { EventType } from '../types';

/**
 * EventManager handles event-driven communication between systems
 * using a publish-subscribe pattern.
 */
export class EventManager implements GameSystem {
  private listeners: Map<EventType, Set<EventHandler>> = new Map();
  private eventQueue: GameEvent[] = [];
  private eventHistory: GameEvent[] = [];
  private priorityHandlers: Map<EventType, Set<EventHandler>> = new Map();
  private isProcessing = false;
  private maxHistorySize = 1000;

  async initialize(): Promise<void> {
    // Clear any existing state
    this.listeners.clear();
    this.eventQueue = [];
    this.eventHistory = [];
    this.priorityHandlers.clear();
    this.isProcessing = false;

    console.log('EventManager initialized');
  }

  /**
   * Emit an event synchronously to all listeners
   */
  emit(event: GameEvent): void {
    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }

    // Add to history
    this.addToHistory(event);

    // Process priority handlers first
    const priorityHandlers = this.priorityHandlers.get(event.type);
    if (priorityHandlers) {
      priorityHandlers.forEach((handler) => {
        try {
          const result = handler(event);
          // Handle promise-based handlers synchronously
          if (result instanceof Promise) {
            result.catch((error) => {
              console.error(`Priority handler error for event ${event.type}:`, error);
            });
          }
        } catch (error) {
          console.error(`Priority handler error for event ${event.type}:`, error);
        }
      });
    }

    // Process regular listeners
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach((handler) => {
        try {
          const result = handler(event);
          // Handle promise-based handlers synchronously
          if (result instanceof Promise) {
            result.catch((error) => {
              console.error(`Handler error for event ${event.type}:`, error);
            });
          }
        } catch (error) {
          console.error(`Handler error for event ${event.type}:`, error);
        }
      });
    }
  }

  /**
   * Emit an event asynchronously
   */
  async emitAsync(event: GameEvent): Promise<void> {
    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }

    // Add to history
    this.addToHistory(event);

    const promises: Promise<void>[] = [];

    // Process priority handlers first
    const priorityHandlers = this.priorityHandlers.get(event.type);
    if (priorityHandlers) {
      priorityHandlers.forEach((handler) => {
        const result = handler(event);
        if (result instanceof Promise) {
          promises.push(
            result.catch((error) => {
              console.error(`Priority handler error for event ${event.type}:`, error);
            }),
          );
        }
      });
    }

    // Wait for priority handlers to complete before processing regular handlers
    if (promises.length > 0) {
      await Promise.all(promises);
      promises.length = 0; // Clear the array
    }

    // Process regular listeners
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach((handler) => {
        const result = handler(event);
        if (result instanceof Promise) {
          promises.push(
            result.catch((error) => {
              console.error(`Handler error for event ${event.type}:`, error);
            }),
          );
        }
      });
    }

    // Wait for all handlers to complete
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * Emit an event after a delay
   */
  emitDelayed(event: GameEvent, delayMs: number): void {
    setTimeout(() => {
      this.emit(event);
    }, delayMs);
  }

  /**
   * Subscribe to events of a specific type
   */
  on(eventType: EventType, handler: EventHandler): Unsubscribe {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const listeners = this.listeners.get(eventType)!;
    listeners.add(handler);

    // Return unsubscribe function
    return () => {
      listeners.delete(handler);
      if (listeners.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  /**
   * Subscribe to events of a specific type, but only handle once
   */
  once(eventType: EventType, handler: EventHandler): Unsubscribe {
    const onceHandler: EventHandler = (event: GameEvent) => {
      // Remove the handler after first execution
      unsubscribe();
      return handler(event);
    };

    const unsubscribe = this.on(eventType, onceHandler);
    return unsubscribe;
  }

  /**
   * Unsubscribe from events
   */
  off(eventType: EventType, handler: EventHandler): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(handler);
      if (listeners.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  /**
   * Queue an event for later processing
   */
  queueEvent(event: GameEvent): void {
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }
    this.eventQueue.push(event);
  }

  /**
   * Process all queued events
   */
  processEventQueue(): void {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Process events in order
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        this.emit(event);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Clear the event queue without processing
   */
  clearEventQueue(): void {
    this.eventQueue = [];
  }

  /**
   * Register a priority handler that executes before regular handlers
   */
  registerPriorityHandler(eventType: EventType, handler: EventHandler): Unsubscribe {
    if (!this.priorityHandlers.has(eventType)) {
      this.priorityHandlers.set(eventType, new Set());
    }

    const handlers = this.priorityHandlers.get(eventType)!;
    handlers.add(handler);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.priorityHandlers.delete(eventType);
      }
    };
  }

  /**
   * Get recent event history for debugging
   */
  getEventHistory(limit: number = 100): GameEvent[] {
    const startIndex = Math.max(0, this.eventHistory.length - limit);
    return this.eventHistory.slice(startIndex);
  }

  /**
   * Clear event history
   */
  clearEventHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get current queue size (for monitoring)
   */
  getQueueSize(): number {
    return this.eventQueue.length;
  }

  /**
   * Get listener count for a specific event type
   */
  getListenerCount(eventType: EventType): number {
    const listeners = this.listeners.get(eventType);
    const priorityListeners = this.priorityHandlers.get(eventType);

    return (listeners?.size || 0) + (priorityListeners?.size || 0);
  }

  /**
   * Check if there are any listeners for an event type
   */
  hasListeners(eventType: EventType): boolean {
    return this.getListenerCount(eventType) > 0;
  }

  /**
   * Add event to history with size management
   */
  private addToHistory(event: GameEvent): void {
    this.eventHistory.push({ ...event });

    // Trim history if it gets too large
    if (this.eventHistory.length > this.maxHistorySize) {
      const trimAmount = Math.floor(this.maxHistorySize * 0.2); // Remove 20%
      this.eventHistory.splice(0, trimAmount);
    }
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    this.listeners.clear();
    this.priorityHandlers.clear();
    this.clearEventQueue();
    this.clearEventHistory();
    this.isProcessing = false;

    console.log('EventManager shutdown complete');
  }
}
