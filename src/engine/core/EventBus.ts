import { EventPriority, type BaseGameEvent } from '../events/types/events.ts';

/**
 * Priority-based event queue system for the game engine
 * Events are processed in priority order with higher priority events processed first
 */
export class EventBus {
  private queues: Map<EventPriority, BaseGameEvent[]> = new Map();
  private totalEvents = 0;
  private processedEvents = 0;
  private droppedEvents = 0;
  private readonly maxQueueSize: number;

  constructor(maxQueueSize = 1000) {
    this.maxQueueSize = maxQueueSize;
    
    // Initialize priority queues
    this.queues.set(EventPriority.IMMEDIATE, []);
    this.queues.set(EventPriority.HIGH, []);
    this.queues.set(EventPriority.NORMAL, []);
    this.queues.set(EventPriority.LOW, []);
  }

  /**
   * Add an event to the appropriate priority queue
   */
  enqueue(event: BaseGameEvent): boolean {
    // Check if we're at capacity
    if (this.totalEvents >= this.maxQueueSize) {
      // Try to make room by dropping low priority events
      if (!this.makeRoom()) {
        this.droppedEvents++;
        console.warn(`EventBus: Dropped event ${event.type} due to queue overflow`);
        return false;
      }
    }

    const queue = this.queues.get(event.priority);
    if (!queue) {
      console.error(`EventBus: Invalid priority ${event.priority} for event ${event.type}`);
      return false;
    }

    queue.push(event);
    this.totalEvents++;
    
    return true;
  }

  /**
   * Get the next highest priority event from the queue
   */
  dequeue(): BaseGameEvent | null {
    // Check queues in priority order (lower number = higher priority)
    for (let priority = 0; priority <= 3; priority++) {
      const queue = this.queues.get(priority as EventPriority);
      if (queue && queue.length > 0) {
        const event = queue.shift()!;
        this.totalEvents--;
        this.processedEvents++;
        return event;
      }
    }
    
    return null;
  }

  /**
   * Peek at the next event without removing it
   */
  peek(): BaseGameEvent | null {
    for (let priority = 0; priority <= 3; priority++) {
      const queue = this.queues.get(priority as EventPriority);
      if (queue && queue.length > 0) {
        return queue[0] || null;
      }
    }
    
    return null;
  }

  /**
   * Get the total number of events in all queues
   */
  size(): number {
    return this.totalEvents;
  }

  /**
   * Get the number of events in a specific priority queue
   */
  getQueueSize(priority: EventPriority): number {
    const queue = this.queues.get(priority);
    return queue ? queue.length : 0;
  }

  /**
   * Check if all queues are empty
   */
  isEmpty(): boolean {
    return this.totalEvents === 0;
  }

  /**
   * Clear all events from all queues
   */
  clear(): void {
    for (const queue of this.queues.values()) {
      queue.length = 0;
    }
    this.totalEvents = 0;
  }

  /**
   * Clear events from a specific priority queue
   */
  clearQueue(priority: EventPriority): number {
    const queue = this.queues.get(priority);
    if (!queue) {
      return 0;
    }
    
    const cleared = queue.length;
    queue.length = 0;
    this.totalEvents -= cleared;
    
    return cleared;
  }

  /**
   * Drain all events from a specific priority queue
   */
  drainQueue(priority: EventPriority): BaseGameEvent[] {
    const queue = this.queues.get(priority);
    if (!queue) {
      return [];
    }
    
    const events = [...queue];
    queue.length = 0;
    this.totalEvents -= events.length;
    
    return events;
  }

  /**
   * Get events of a specific type from all queues (without removing them)
   */
  getEventsByType(eventType: string): BaseGameEvent[] {
    const events: BaseGameEvent[] = [];
    
    for (const queue of this.queues.values()) {
      events.push(...queue.filter(event => event.type === eventType));
    }
    
    return events;
  }

  /**
   * Remove all events of a specific type from all queues
   */
  removeEventsByType(eventType: string): number {
    let removed = 0;
    
    for (const queue of this.queues.values()) {
      const originalLength = queue.length;
      const filtered = queue.filter(event => event.type !== eventType);
      queue.length = 0;
      queue.push(...filtered);
      removed += originalLength - filtered.length;
    }
    
    this.totalEvents -= removed;
    return removed;
  }

  /**
   * Make room in the queue by dropping low priority events
   */
  private makeRoom(): boolean {
    // Try to drop low priority events first
    const lowQueue = this.queues.get(EventPriority.LOW);
    if (lowQueue && lowQueue.length > 0) {
      lowQueue.shift();
      this.totalEvents--;
      this.droppedEvents++;
      return true;
    }
    
    // If no low priority events, try normal priority
    const normalQueue = this.queues.get(EventPriority.NORMAL);
    if (normalQueue && normalQueue.length > 0) {
      normalQueue.shift();
      this.totalEvents--;
      this.droppedEvents++;
      return true;
    }
    
    return false; // Cannot make room
  }

  /**
   * Get queue statistics for monitoring and debugging
   */
  getStats() {
    return {
      totalEvents: this.totalEvents,
      processedEvents: this.processedEvents,
      droppedEvents: this.droppedEvents,
      maxQueueSize: this.maxQueueSize,
      queueSizes: {
        immediate: this.getQueueSize(EventPriority.IMMEDIATE),
        high: this.getQueueSize(EventPriority.HIGH),
        normal: this.getQueueSize(EventPriority.NORMAL),
        low: this.getQueueSize(EventPriority.LOW),
      },
      utilizationPercent: (this.totalEvents / this.maxQueueSize) * 100,
    };
  }

  /**
   * Reset statistics counters
   */
  resetStats(): void {
    this.processedEvents = 0;
    this.droppedEvents = 0;
  }

  /**
   * Get debug information about current queue state
   */
  getDebugInfo() {
    const stats = this.getStats();
    return {
      ...stats,
      eventsByType: this.getEventTypeDistribution(),
      oldestEvent: this.getOldestEvent(),
    };
  }

  /**
   * Get distribution of event types in the queue
   */
  private getEventTypeDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const queue of this.queues.values()) {
      for (const event of queue) {
        distribution[event.type] = (distribution[event.type] || 0) + 1;
      }
    }
    
    return distribution;
  }

  /**
   * Get the oldest event in the queue
   */
  private getOldestEvent(): BaseGameEvent | null {
    let oldest: BaseGameEvent | null = null;
    
    for (const queue of this.queues.values()) {
      for (const event of queue) {
        if (!oldest || event.timestamp < oldest.timestamp) {
          oldest = event;
        }
      }
    }
    
    return oldest;
  }
}