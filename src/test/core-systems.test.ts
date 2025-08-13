import { describe, it, expect, beforeEach } from 'vitest'
import { EventEmitter } from '../engine/events/EventEmitter.ts'
import { EventBus } from '../engine/core/EventBus.ts'
import { EventPriority, type BaseGameEvent } from '../engine/events/types/events.ts'

describe('EventEmitter', () => {
  let emitter: EventEmitter

  beforeEach(() => {
    emitter = new EventEmitter()
  })

  it('should subscribe and emit events', () => {
    const receivedEvents: BaseGameEvent[] = []

    const subscription = emitter.subscribe<BaseGameEvent>('test_event', (event: BaseGameEvent) => {
      receivedEvents.push(event)
    })

    const testEvent: BaseGameEvent = {
      id: 'test_1',
      type: 'test_event',
      priority: EventPriority.NORMAL,
      timestamp: Date.now(),
      source: 'test',
      data: { message: 'Hello World' }
    }

    emitter.emit(testEvent)

    expect(receivedEvents).toHaveLength(1)
    expect(receivedEvents[0]?.type).toBe('test_event')
    expect(receivedEvents[0]?.data.message).toBe('Hello World')
    expect(subscription.eventType).toBe('test_event')
  })

  it('should unsubscribe properly', () => {
    let eventCount = 0

    const subscription = emitter.subscribe('test_event', () => {
      eventCount++
    })

    const testEvent: BaseGameEvent = {
      id: 'test_1',
      type: 'test_event',
      priority: EventPriority.NORMAL,
      timestamp: Date.now(),
      source: 'test',
      data: {}
    }

    emitter.emit(testEvent)
    expect(eventCount).toBe(1)

    subscription.unsubscribe()
    emitter.emit(testEvent)
    expect(eventCount).toBe(1) // Should not increase
  })

  it('should handle multiple subscribers', () => {
    let count1 = 0
    let count2 = 0

    emitter.subscribe('test_event', () => { count1++ })
    emitter.subscribe('test_event', () => { count2++ })

    const testEvent: BaseGameEvent = {
      id: 'test_1',
      type: 'test_event',
      priority: EventPriority.NORMAL,
      timestamp: Date.now(),
      source: 'test',
      data: {}
    }

    emitter.emit(testEvent)

    expect(count1).toBe(1)
    expect(count2).toBe(1)
  })
})

describe('EventBus', () => {
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = new EventBus()
  })

  it('should enqueue and dequeue events', () => {
    const testEvent: BaseGameEvent = {
      id: 'test_1',
      type: 'test_event',
      priority: EventPriority.NORMAL,
      timestamp: Date.now(),
      source: 'test',
      data: {}
    }

    expect(eventBus.isEmpty()).toBe(true)
    
    const success = eventBus.enqueue(testEvent)
    expect(success).toBe(true)
    expect(eventBus.size()).toBe(1)
    
    const dequeuedEvent = eventBus.dequeue()
    expect(dequeuedEvent).toBeTruthy()
    expect(dequeuedEvent?.id).toBe('test_1')
    expect(eventBus.isEmpty()).toBe(true)
  })

  it('should respect priority ordering', () => {
    const lowEvent: BaseGameEvent = {
      id: 'low',
      type: 'test',
      priority: EventPriority.LOW,
      timestamp: Date.now(),
      source: 'test',
      data: {}
    }

    const highEvent: BaseGameEvent = {
      id: 'high',
      type: 'test',
      priority: EventPriority.HIGH,
      timestamp: Date.now(),
      source: 'test',
      data: {}
    }

    const immediateEvent: BaseGameEvent = {
      id: 'immediate',
      type: 'test',
      priority: EventPriority.IMMEDIATE,
      timestamp: Date.now(),
      source: 'test',
      data: {}
    }

    // Add in reverse priority order
    eventBus.enqueue(lowEvent)
    eventBus.enqueue(highEvent)
    eventBus.enqueue(immediateEvent)

    // Should dequeue in priority order
    expect(eventBus.dequeue()?.id).toBe('immediate')
    expect(eventBus.dequeue()?.id).toBe('high')
    expect(eventBus.dequeue()?.id).toBe('low')
  })

  it('should provide accurate statistics', () => {
    const event1: BaseGameEvent = {
      id: 'test_1',
      type: 'test',
      priority: EventPriority.HIGH,
      timestamp: Date.now(),
      source: 'test',
      data: {}
    }

    const event2: BaseGameEvent = {
      id: 'test_2',
      type: 'test',
      priority: EventPriority.LOW,
      timestamp: Date.now(),
      source: 'test',
      data: {}
    }

    eventBus.enqueue(event1)
    eventBus.enqueue(event2)

    const stats = eventBus.getStats()
    expect(stats.totalEvents).toBe(2)
    expect(stats.queueSizes.high).toBe(1)
    expect(stats.queueSizes.low).toBe(1)
  })
})