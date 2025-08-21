import type { GameSystem, OfflineUpdate, ScheduledEvent, TickHandler, Unsubscribe } from '../types';
import { EventType, TIME_CONSTANTS, CARE_CONSTANTS } from '../types';
import type { EventManager } from './EventManager';
import type { StateManager } from './StateManager';

/**
 * TimeManager handles all time-related operations including real-time tracking,
 * offline catch-up, and tick scheduling.
 */
export class TimeManager implements GameSystem {
  private tickInterval: number | null = null;
  private tickHandlers: Set<TickHandler> = new Set();
  private scheduledEvents: Map<string, ScheduledEvent> = new Map();
  private eventManager: EventManager | null = null;
  private stateManager: StateManager | null = null;
  private lastTickTime: number = 0;
  private isRunning = false;

  constructor() {
    this.lastTickTime = Date.now();
  }

  async initialize(): Promise<void> {
    this.lastTickTime = Date.now();
    this.isRunning = false;

    console.log('TimeManager initialized');
  }

  /**
   * Set the event manager reference
   */
  setEventManager(eventManager: EventManager): void {
    this.eventManager = eventManager;
  }

  /**
   * Set the state manager reference
   */
  setStateManager(stateManager: StateManager): void {
    this.stateManager = stateManager;
  }

  /**
   * Get current time
   */
  getCurrentTime(): Date {
    return new Date();
  }

  /**
   * Get the last save time from state
   */
  getLastSaveTime(): Date {
    if (!this.stateManager) {
      return new Date();
    }

    const state = this.stateManager.getState();
    return new Date(state.meta.lastSaveTime);
  }

  /**
   * Get elapsed time since last save
   */
  getElapsedTime(): number {
    const now = Date.now();
    const lastSave = this.getLastSaveTime().getTime();
    return Math.max(0, now - lastSave);
  }

  /**
   * Calculate offline time in seconds
   */
  getOfflineTime(): number {
    return Math.floor(this.getElapsedTime() / 1000);
  }

  /**
   * Start the tick system
   */
  startTicking(): void {
    if (this.isRunning) {
      console.warn('TimeManager is already running');
      return;
    }

    this.isRunning = true;
    this.lastTickTime = Date.now();

    // Set up the main tick interval (60 seconds)
    this.tickInterval = setInterval(() => {
      this.processTick();
    }, TIME_CONSTANTS.TICK_INTERVAL) as any;

    console.log('TimeManager started ticking');
  }

  /**
   * Stop the tick system
   */
  stopTicking(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    console.log('TimeManager stopped ticking');
  }

  /**
   * Register a tick handler
   */
  registerTickHandler(handler: TickHandler): Unsubscribe {
    this.tickHandlers.add(handler);

    return () => {
      this.tickHandlers.delete(handler);
    };
  }

  /**
   * Process a single tick
   */
  processTick(): void {
    const now = Date.now();

    // Update last tick time
    this.lastTickTime = now;

    // Emit tick event
    if (this.eventManager) {
      this.eventManager.emit({
        type: EventType.TICK,
        timestamp: now,
      });
    }

    // Execute all tick handlers
    this.tickHandlers.forEach((handler) => {
      try {
        handler();
      } catch (error) {
        console.error('Tick handler error:', error);
      }
    });

    // Process scheduled events
    this.processScheduledEvents(now);

    console.log(`Tick processed at ${new Date(now).toLocaleTimeString()}`);
  }

  /**
   * Calculate how many ticks occurred during offline time
   */
  calculateOfflineTicks(offlineSeconds: number): number {
    return Math.floor(offlineSeconds / (TIME_CONSTANTS.TICK_INTERVAL / 1000));
  }

  /**
   * Process offline time and return what happened
   */
  processOfflineTime(offlineSeconds: number): OfflineUpdate {
    if (offlineSeconds <= 0) {
      return {
        ticksProcessed: 0,
        careDecay: { satiety: 0, hydration: 0, happiness: 0 },
        poopSpawned: 0,
        activitiesCompleted: [],
        sleepCompleted: false,
        energyRecovered: 0,
      };
    }

    const ticksProcessed = this.calculateOfflineTicks(offlineSeconds);

    // Calculate care decay based on ticks
    const careDecay = {
      satiety: ticksProcessed * CARE_CONSTANTS.SATIETY_DECAY_RATE,
      hydration: ticksProcessed * CARE_CONSTANTS.HYDRATION_DECAY_RATE,
      happiness: ticksProcessed * CARE_CONSTANTS.HAPPINESS_DECAY_RATE,
    };

    // Calculate poop spawns
    const hoursOffline = offlineSeconds / 3600;
    const poopSpawned = this.calculatePoopSpawns(hoursOffline);

    // Check for completed sleep
    let sleepCompleted = false;
    let energyRecovered = 0;

    if (this.stateManager) {
      const petState = this.stateManager.getPetState();
      if (petState?.isSleeping && petState.sleepStartTime) {
        const sleepDuration = offlineSeconds; // Keep in seconds
        const maxSleepTime = 8 * 60 * 60; // 8 hours in seconds (from ENERGY_CONSTANTS.SLEEP_MAX_DURATION)

        if (sleepDuration >= maxSleepTime) {
          sleepCompleted = true;
          energyRecovered = petState.maxEnergy - petState.energy;
        } else {
          // Calculate partial energy recovery
          const sleepHours = sleepDuration / (60 * 60); // Convert seconds to hours
          const baseRegenRate = CARE_CONSTANTS.LIFE_RECOVERY_RATE * 10; // Base energy regen
          const stageMultiplier = this.getSleepRegenMultiplier(petState.stage);
          energyRecovered = Math.floor(sleepHours * baseRegenRate * stageMultiplier);
          energyRecovered = Math.min(energyRecovered, petState.maxEnergy - petState.energy);
        }
      }
    }

    const result: OfflineUpdate = {
      ticksProcessed,
      careDecay,
      poopSpawned,
      activitiesCompleted: [], // TODO: Implement activity completion in later phases
      sleepCompleted,
      energyRecovered,
    };

    // Emit offline catchup event
    if (this.eventManager) {
      this.eventManager.emit({
        type: EventType.OFFLINE_CATCHUP,
        payload: result,
        timestamp: Date.now(),
      });
    }

    console.log(`Processed offline time: ${offlineSeconds}s (${ticksProcessed} ticks)`);

    return result;
  }

  /**
   * Schedule an event to fire at a specific time
   */
  scheduleEvent(time: Date, callback: Function): string {
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const scheduledEvent: ScheduledEvent = {
      id: eventId,
      triggerTime: time.getTime(),
      callback: callback as () => void,
      recurring: false,
    };

    this.scheduledEvents.set(eventId, scheduledEvent);

    return eventId;
  }

  /**
   * Schedule a recurring event
   */
  scheduleRecurringEvent(firstTime: Date, interval: number, callback: Function): string {
    const eventId = `recurring_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const scheduledEvent: ScheduledEvent = {
      id: eventId,
      triggerTime: firstTime.getTime(),
      callback: callback as () => void,
      recurring: true,
      interval,
    };

    this.scheduledEvents.set(eventId, scheduledEvent);

    return eventId;
  }

  /**
   * Cancel a scheduled event
   */
  cancelScheduledEvent(eventId: string): void {
    this.scheduledEvents.delete(eventId);
  }

  /**
   * Format time remaining in a human-readable format
   */
  formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) {
      return '0s';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    const parts: string[] = [];

    if (hours > 0) {
      parts.push(`${hours}h`);
    }
    if (minutes > 0) {
      parts.push(`${minutes}m`);
    }
    if (remainingSeconds > 0 || parts.length === 0) {
      parts.push(`${remainingSeconds}s`);
    }

    return parts.join(' ');
  }

  /**
   * Get the local timezone
   */
  getLocalTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  /**
   * Convert UTC time to local time
   */
  convertToLocalTime(utcTime: Date): Date {
    return new Date(utcTime.toLocaleString());
  }

  /**
   * Get time until next tick
   */
  getTimeUntilNextTick(): number {
    const now = Date.now();
    const timeSinceLastTick = now - this.lastTickTime;
    const timeUntilNext = TIME_CONSTANTS.TICK_INTERVAL - timeSinceLastTick;
    return Math.max(0, timeUntilNext);
  }

  /**
   * Force a tick (for testing purposes)
   */
  forceTick(): void {
    this.processTick();
  }

  /**
   * Check if time manager is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get current tick count from state
   */
  getCurrentTickCount(): number {
    if (!this.stateManager) {
      return 0;
    }

    return this.stateManager.getTimeState().tickCount;
  }

  /**
   * Process scheduled events
   */
  private processScheduledEvents(currentTime: number): void {
    const toRemove: string[] = [];

    this.scheduledEvents.forEach((event, eventId) => {
      if (currentTime >= event.triggerTime) {
        try {
          event.callback();

          if (event.recurring && event.interval) {
            // Reschedule recurring event
            event.triggerTime = currentTime + event.interval;
          } else {
            // Mark one-time event for removal
            toRemove.push(eventId);
          }
        } catch (error) {
          console.error(`Scheduled event ${eventId} error:`, error);
          toRemove.push(eventId);
        }
      }
    });

    // Remove completed one-time events
    toRemove.forEach((eventId) => {
      this.scheduledEvents.delete(eventId);
    });
  }

  /**
   * Calculate how many poops spawn during offline hours
   */
  private calculatePoopSpawns(hoursOffline: number): number {
    if (hoursOffline < TIME_CONSTANTS.POOP_SPAWN_MIN_HOURS) {
      return 0;
    }

    // Average spawn rate: once every 15 hours (midpoint between 6-24)
    const averageSpawnRate =
      (TIME_CONSTANTS.POOP_SPAWN_MIN_HOURS + TIME_CONSTANTS.POOP_SPAWN_MAX_HOURS) / 2;
    const expectedPoops = Math.floor(hoursOffline / averageSpawnRate);

    // Add some randomness
    const randomFactor = Math.random() * 0.5 + 0.75; // 0.75 to 1.25 multiplier

    return Math.max(0, Math.floor(expectedPoops * randomFactor));
  }

  /**
   * Get sleep regeneration multiplier based on growth stage
   */
  private getSleepRegenMultiplier(stage: string): number {
    switch (stage) {
      case 'hatchling':
        return 1.0;
      case 'juvenile':
        return 1.2;
      case 'adult':
        return 1.5;
      default:
        return 1.0;
    }
  }

  async shutdown(): Promise<void> {
    this.stopTicking();
    this.tickHandlers.clear();
    this.scheduledEvents.clear();
    this.eventManager = null;
    this.stateManager = null;

    console.log('TimeManager shutdown complete');
  }
}
