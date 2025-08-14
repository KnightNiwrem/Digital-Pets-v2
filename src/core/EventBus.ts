import { EventPriority, type GameEvent, type EventHandler } from './types';

/**
 * EventBus - Core event system for domain communication
 * Implements priority-based event queue with pub/sub pattern
 */
export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private eventQueue: GameEvent[] = [];
  private isProcessing = false;

  /**
   * Subscribe to events of a specific type
   */
  subscribe<T extends GameEvent>(eventType: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const handlersSet = this.handlers.get(eventType)!;
    handlersSet.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      const currentHandlers = this.handlers.get(eventType);
      if (currentHandlers) {
        currentHandlers.delete(handler as EventHandler);
        if (currentHandlers.size === 0) {
          this.handlers.delete(eventType);
        }
      }
    };
  }

  /**
   * Emit an event - queues it for processing based on priority
   */
  emit(event: GameEvent): void {
    // Add to priority queue
    this.eventQueue.push(event);

    // Sort queue by priority (lower numbers = higher priority)
    this.eventQueue.sort((a, b) => a.priority - b.priority);

    // Schedule processing if not already scheduled
    if (!this.isProcessing) {
      // Use setTimeout to ensure async processing
      void setTimeout(() => {
        void this.processQueue();
      }, 0);
    }
  }

  /**
   * Process the event queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        if (!event) continue;
        await this.processEvent(event);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single event by calling all registered handlers
   */
  private async processEvent(event: GameEvent): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) return;

    // Call all handlers for this event type
    const promises = Array.from(handlers).map((handler) => {
      try {
        return Promise.resolve(handler(event));
      } catch (error) {
        // Log error in development, but don't break processing
        if (process.env.NODE_ENV === 'development') {
          console.error(`Error in event handler for ${event.type}:`, error);
        }
        return Promise.resolve();
      }
    });

    await Promise.all(promises);
  }

  /**
   * Create a properly formatted event
   */
  createEvent<T = unknown>(
    type: string,
    payload: T,
    priority: EventPriority = EventPriority.NORMAL
  ): GameEvent<T> {
    return {
      type,
      payload,
      timestamp: Date.now(),
      priority,
    };
  }

  /**
   * Get current queue size (for debugging)
   */
  getQueueSize(): number {
    return this.eventQueue.length;
  }

  /**
   * Clear all handlers (for testing)
   */
  clear(): void {
    this.handlers.clear();
    this.eventQueue.length = 0;
    this.isProcessing = false;
  }
}

// Export singleton instance
export const eventBus = new EventBus();
