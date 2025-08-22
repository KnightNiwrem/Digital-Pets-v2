import type { GameSystem, GameEvent } from '../types';
import { EventWriter } from './EventWriter';

/**
 * EventManager maintains the event queue for sequential processing by GameEngine.
 * Systems write events through EventWriter interfaces, GameEngine processes them.
 * 
 * This is a pure queue manager with no event processing or subscription capabilities.
 * All event processing is handled sequentially by GameEngine to prevent race conditions.
 */
export class EventManager implements GameSystem {
  private eventQueue: GameEvent[] = [];
  private eventHistory: GameEvent[] = [];
  private isProcessing = false;
  private maxHistorySize = 1000;
  private maxQueueSize = 10000;

  async initialize(): Promise<void> {
    // Clear any existing state
    this.eventQueue = [];
    this.eventHistory = [];
    this.isProcessing = false;

    console.log('EventManager initialized as pure queue manager');
  }

  /**
   * Enqueue an event for processing by GameEngine
   * This is called by EventWriter instances
   */
  enqueueEvent(event: GameEvent): void {
    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }

    // Check queue size limit
    if (this.eventQueue.length >= this.maxQueueSize) {
      console.error(`Event queue overflow! Max size: ${this.maxQueueSize}`);
      // Remove oldest events to make room (FIFO)
      this.eventQueue.splice(0, 100);
    }

    // Add to queue
    this.eventQueue.push(event);

    // Add to history for debugging
    this.addToHistory(event);
  }

  /**
   * Dequeue the next event for processing
   * Only GameEngine should call this method
   */
  dequeueEvent(): GameEvent | null {
    if (this.eventQueue.length === 0) {
      return null;
    }
    return this.eventQueue.shift() || null;
  }

  /**
   * Peek at the next event without removing it
   * Only GameEngine should call this method
   */
  peekEvent(): GameEvent | null {
    if (this.eventQueue.length === 0) {
      return null;
    }
    return this.eventQueue[0] || null;
  }

  /**
   * Check if there are events in the queue
   */
  hasEvents(): boolean {
    return this.eventQueue.length > 0;
  }

  /**
   * Get the current queue length
   */
  getQueueLength(): number {
    return this.eventQueue.length;
  }

  /**
   * Clear all events from the queue
   * Use with caution - only for shutdown or reset
   */
  clearQueue(): void {
    this.eventQueue = [];
  }

  /**
   * Create a write-only event interface for a system
   * Systems use this to write events to the queue
   */
  createEventWriter(): EventWriter {
    return new EventWriter((event: GameEvent) => {
      this.enqueueEvent(event);
    });
  }

  /**
   * Get processing state (used by GameEngine to prevent concurrent processing)
   */
  isEventProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Set processing state (only GameEngine should call this)
   */
  setProcessing(processing: boolean): void {
    this.isProcessing = processing;
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
   * Get queue statistics for monitoring
   */
  getQueueStats(): {
    queueLength: number;
    historyLength: number;
    isProcessing: boolean;
    oldestEventAge: number | null;
  } {
    const oldestEvent = this.eventQueue[0];
    const oldestEventAge = oldestEvent ? Date.now() - oldestEvent.timestamp : null;

    return {
      queueLength: this.eventQueue.length,
      historyLength: this.eventHistory.length,
      isProcessing: this.isProcessing,
      oldestEventAge,
    };
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
    this.clearQueue();
    this.clearEventHistory();
    this.isProcessing = false;

    console.log('EventManager shutdown complete');
  }
}
