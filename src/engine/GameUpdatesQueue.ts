/**
 * GameUpdatesQueue - FIFO queue for game updates with validation
 * Provides write-only access to systems and read-only access to GameEngine.
 *
 * Note: Updates are processed strictly in the order received. Priority-based
 * scheduling may be reintroduced only with an explicit design approval.
 */

import type { GameUpdate, UpdateType } from '../models';
import { UPDATE_TYPES } from '../models/constants';

/**
 * Interface for write-only access to the queue (for systems)
 */
export interface GameUpdateWriter {
  enqueue(update: Omit<GameUpdate, 'id' | 'timestamp'>): void;
}

/**
 * Interface for read-only access to the queue (for GameEngine)
 */
export interface GameUpdateReader {
  dequeue(): GameUpdate | undefined;
  peek(): GameUpdate | undefined;
  size(): number;
  isEmpty(): boolean;
  clear(): void;
}

/**
 * GameUpdatesQueue implementation
 * Uses a simple array-based FIFO queue
 */
export class GameUpdatesQueue implements GameUpdateWriter, GameUpdateReader {
  private queue: GameUpdate[] = [];
  private updateCounter = 0;
  private onEnqueueCallback: (() => void) | undefined = undefined;

  /**
   * Create a writer interface for a specific system
   * @param systemName The name of the system requesting write access
   * @returns A write-only interface to the queue
   */
  public createWriter(systemName: string): GameUpdateWriter {
    return {
      enqueue: (update: Omit<GameUpdate, 'id' | 'timestamp'>) => {
        this.enqueue({
          ...update,
          payload: {
            ...update.payload,
            source: systemName,
          },
        });
      },
    };
  }

  /**
   * Create a reader interface (for GameEngine only)
   * @returns A read-only interface to the queue
   */
  public createReader(): GameUpdateReader {
    return {
      dequeue: () => this.dequeue(),
      peek: () => this.peek(),
      size: () => this.size(),
      isEmpty: () => this.isEmpty(),
      clear: () => this.clear(),
    };
  }

  /**
   * Enqueue a new update with validation
   * @param update The update to enqueue (without id and timestamp)
   */
  public enqueue(update: Omit<GameUpdate, 'id' | 'timestamp'>): void {
    // Validate update type
    if (!this.isValidUpdateType(update.type)) {
      throw new Error(`Invalid update type: ${update.type}`);
    }

    // Validate payload
    if (!this.isValidPayload(update.payload)) {
      throw new Error('Invalid update payload: payload must be an object');
    }

    // Generate unique ID and timestamp
    const completeUpdate: GameUpdate = {
      ...update,
      id: this.generateUpdateId(),
      timestamp: Date.now(),
      retryCount: update.retryCount ?? 0,
    };

    // Simple FIFO insertion
    this.queue.push(completeUpdate);

    // Notify the GameEngine that a new update is available
    if (this.onEnqueueCallback) {
      try {
        this.onEnqueueCallback();
      } catch (error) {
        console.error('[GameUpdatesQueue] Error notifying GameEngine:', error);
      }
    }
  }

  /**
   * Dequeue the next update
   * @returns The next update or undefined if queue is empty
   */
  public dequeue(): GameUpdate | undefined {
    return this.queue.shift() ?? undefined;
  }

  /**
   * Peek at the next update without removing it
   * @returns The next update or undefined if queue is empty
   */
  public peek(): GameUpdate | undefined {
    return this.queue[0] ?? undefined;
  }

  /**
   * Get the current size of the queue
   * @returns The number of updates in the queue
   */
  public size(): number {
    return this.queue.length;
  }

  /**
   * Check if the queue is empty
   * @returns True if the queue has no updates
   */
  public isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Clear all updates from the queue
   */
  public clear(): void {
    this.queue = [];
  }

  /**
   * Get all updates in the queue (for debugging/testing)
   * @returns A copy of all updates in the queue
   */
  public getAllUpdates(): GameUpdate[] {
    return [...this.queue];
  }

  /**
   * Generate a unique ID for an update
   * @returns A unique update ID
   */
  private generateUpdateId(): string {
    this.updateCounter++;
    return `update_${Date.now()}_${this.updateCounter}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate that the update type is valid
   * @param type The update type to validate
   * @returns True if the type is valid
   */
  private isValidUpdateType(type: UpdateType): boolean {
    return Object.values(UPDATE_TYPES).includes(type);
  }

  /**
   * Validate the update payload
   * @param payload The payload to validate
   * @returns True if the payload is valid
   */
  private isValidPayload(payload: any): boolean {
    return payload !== undefined && payload !== null && typeof payload === 'object';
  }

  /**
   * Get queue statistics for monitoring
   * @returns Queue statistics
   */
  public getStatistics(): {
    size: number;
    oldestUpdate: GameUpdate | undefined;
    averageAge: number;
  } {
    const now = Date.now();
    const oldestUpdate = this.queue[0] ?? undefined;

    let totalAge = 0;
    for (const update of this.queue) {
      totalAge += now - update.timestamp;
    }
    const averageAge = this.queue.length > 0 ? totalAge / this.queue.length : 0;

    return {
      size: this.queue.length,
      oldestUpdate,
      averageAge,
    };
  }

  /**
   * Remove updates matching a predicate (for error recovery)
   * @param predicate Function to test each update
   * @returns The number of updates removed
   */
  public removeWhere(predicate: (update: GameUpdate) => boolean): number {
    const initialSize = this.queue.length;
    this.queue = this.queue.filter((update) => !predicate(update));
    return initialSize - this.queue.length;
  }

  /**
   * Get updates by type (for debugging)
   * @param type The update type to filter by
   * @returns Updates of the specified type
   */
  public getUpdatesByType(type: UpdateType): GameUpdate[] {
    return this.queue.filter((update) => update.type === type);
  }

  /**
   * Requeue an update with retry logic
   * @param update The update to retry
   * @returns True if the update was requeued, false if max retries exceeded
   */
  public requeueForRetry(update: GameUpdate): boolean {
    if (!update.retryable) {
      return false;
    }

    const maxRetries = update.maxRetries ?? 3;
    const currentRetries = update.retryCount ?? 0;

    if (currentRetries >= maxRetries) {
      return false;
    }

    // Re-enqueue with incremented retry count
    const { id, timestamp, ...rest } = update;
    this.enqueue({
      ...rest,
      retryCount: currentRetries + 1,
    });

    return true;
  }

  /**
   * Set callback to be notified when updates are enqueued
   * Only GameEngine should use this since it has exclusive read access
   * @param callback Function to call when an update is enqueued
   */
  public setOnEnqueueCallback(callback: (() => void) | undefined): void {
    this.onEnqueueCallback = callback;
  }
}

/**
 * Factory function to create a new GameUpdatesQueue
 */
export function createGameUpdatesQueue(): GameUpdatesQueue {
  return new GameUpdatesQueue();
}
