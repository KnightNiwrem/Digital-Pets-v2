import type { BaseGameEvent, EventHandler, EventSubscription } from './types/events.ts';

/**
 * Basic event emitter for the game event system
 * Provides subscription-based event handling with type safety
 */
export class EventEmitter {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private subscriptions: Map<string, EventSubscription> = new Map();
  private nextSubscriptionId = 1;

  /**
   * Subscribe to a specific event type
   */
  subscribe<T extends BaseGameEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): EventSubscription {
    const subscriptionId = `sub_${this.nextSubscriptionId++}`;
    
    // Get or create handler set for this event type
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    
    const handlerSet = this.handlers.get(eventType)!;
    handlerSet.add(handler as EventHandler);
    
    // Create subscription object
    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType,
      handler: handler as EventHandler,
      unsubscribe: () => this.unsubscribe(subscriptionId)
    };
    
    this.subscriptions.set(subscriptionId, subscription);
    
    return subscription;
  }

  /**
   * Unsubscribe from events using subscription ID
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (!subscription) {
      return false;
    }
    
    const handlerSet = this.handlers.get(subscription.eventType);
    if (handlerSet) {
      handlerSet.delete(subscription.handler);
      
      // Clean up empty handler sets
      if (handlerSet.size === 0) {
        this.handlers.delete(subscription.eventType);
      }
    }
    
    this.subscriptions.delete(subscriptionId);
    return true;
  }

  /**
   * Emit an event to all subscribers
   */
  emit(event: BaseGameEvent): void {
    const handlerSet = this.handlers.get(event.type);
    
    if (!handlerSet) {
      return; // No handlers for this event type
    }
    
    // Call all handlers for this event type
    for (const handler of handlerSet) {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in event handler for ${event.type}:`, error);
        // Continue processing other handlers even if one fails
      }
    }
  }

  /**
   * Add a one-time event handler that automatically unsubscribes after first use
   */
  once<T extends BaseGameEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): EventSubscription {
    const onceHandler = (event: T) => {
      handler(event);
      subscription.unsubscribe();
    };
    
    const subscription = this.subscribe(eventType, onceHandler);
    return subscription;
  }

  /**
   * Get all active subscriptions for a specific event type
   */
  getSubscriptions(eventType?: string): EventSubscription[] {
    if (eventType) {
      return Array.from(this.subscriptions.values())
        .filter(sub => sub.eventType === eventType);
    }
    
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get list of all event types that have active handlers
   */
  getEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get number of handlers for a specific event type
   */
  getHandlerCount(eventType: string): number {
    const handlerSet = this.handlers.get(eventType);
    return handlerSet ? handlerSet.size : 0;
  }

  /**
   * Clear all handlers and subscriptions
   */
  clear(): void {
    this.handlers.clear();
    this.subscriptions.clear();
    this.nextSubscriptionId = 1;
  }

  /**
   * Clear handlers for a specific event type
   */
  clearEventType(eventType: string): boolean {
    // Remove all subscriptions for this event type
    const subscriptionsToRemove = Array.from(this.subscriptions.values())
      .filter(sub => sub.eventType === eventType);
    
    for (const subscription of subscriptionsToRemove) {
      this.subscriptions.delete(subscription.id);
    }
    
    // Remove handlers
    return this.handlers.delete(eventType);
  }

  /**
   * Get debug information about the event emitter state
   */
  getDebugInfo() {
    return {
      totalSubscriptions: this.subscriptions.size,
      eventTypes: this.getEventTypes(),
      handlerCounts: Object.fromEntries(
        this.getEventTypes().map(type => [type, this.getHandlerCount(type)])
      )
    };
  }
}