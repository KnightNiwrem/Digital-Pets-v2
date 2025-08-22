import type { GameEvent } from '../types';

/**
 * Write-only event interface provided to systems by GameEngine.
 * Systems can only write events to the queue, not read or process them.
 * This ensures unidirectional data flow and prevents race conditions.
 */
export class EventWriter {
  constructor(private enqueueFunc: (event: GameEvent) => void) {}

  /**
   * Write an event to the queue for processing by GameEngine
   */
  writeEvent(event: GameEvent): void {
    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }

    // Enqueue the event for sequential processing
    this.enqueueFunc(event);
  }
}
