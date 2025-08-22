import type { GameSystem, Unsubscribe, TimeState } from '../types';

/**
 * TimeManager manages all time-related operations as a pure calculation service.
 * It tracks real-time, calculates offline time, and manages tick scheduling.
 *
 * This is now a pure system with no dependencies on other systems.
 * It returns time calculations to GameEngine instead of emitting events.
 */
export class TimeManager implements GameSystem {
  private lastSaveTime: number = Date.now();
  private tickHandlers: Set<() => void> = new Set();
  private tickInterval: number | null = null;
  private tickDuration = 60000; // 60 seconds in milliseconds

  async initialize(): Promise<void> {
    this.lastSaveTime = Date.now();
    console.log('TimeManager initialized as pure time service');
  }

  /**
   * Get the current time
   */
  getCurrentTime(): Date {
    return new Date();
  }

  /**
   * Get the last save time
   */
  getLastSaveTime(): Date {
    return new Date(this.lastSaveTime);
  }

  /**
   * Update the last save time (called by GameEngine after successful save)
   */
  updateLastSaveTime(timestamp?: number): void {
    this.lastSaveTime = timestamp || Date.now();
  }

  /**
   * Get elapsed time since last save in seconds
   */
  getElapsedTime(): number {
    return Math.floor((Date.now() - this.lastSaveTime) / 1000);
  }

  /**
   * Get offline time in seconds (time since last save)
   */
  getOfflineTime(): number {
    return this.getElapsedTime();
  }

  /**
   * Calculate the number of ticks that occurred during offline time
   */
  calculateOfflineTicks(offlineSeconds: number): number {
    const ticksPerSecond = 1 / 60; // 1 tick per 60 seconds
    return Math.floor(offlineSeconds * ticksPerSecond);
  }

  /**
   * Process offline time and return what needs to be updated
   * This is now a pure function that returns calculations
   */
  processOfflineTime(offlineSeconds: number): {
    ticksProcessed: number;
    careDecay: {
      satietyDecay: number;
      hydrationDecay: number;
      happinessDecay: number;
    };
    poopSpawned: number;
    sleepCompleted: boolean;
    energyRecovered: number;
  } {
    const ticks = this.calculateOfflineTicks(offlineSeconds);

    // Calculate care decay (1 tick per care value per game tick)
    const careDecay = {
      satietyDecay: ticks,
      hydrationDecay: ticks,
      happinessDecay: ticks,
    };

    // Calculate poop spawns (average 1 every 6 hours = 360 ticks)
    // Use simple approximation for offline calculation
    const avgPoopPerTick = 1 / 360;
    const poopSpawned = Math.floor(ticks * avgPoopPerTick);

    // Sleep calculations (these would be based on pet state in real implementation)
    const maxSleepDuration = 8 * 60 * 60; // 8 hours in seconds
    const sleepCompleted = offlineSeconds >= maxSleepDuration;
    const energyRecovered = sleepCompleted
      ? 100
      : Math.floor((offlineSeconds / maxSleepDuration) * 100);

    return {
      ticksProcessed: ticks,
      careDecay,
      poopSpawned,
      sleepCompleted,
      energyRecovered,
    };
  }

  /**
   * Start the tick timer
   * Returns true if started successfully, false if already running
   */
  startTicking(): boolean {
    if (this.tickInterval !== null) {
      console.warn('Tick timer is already running');
      return false;
    }

    this.tickInterval = setInterval(() => {
      this.processTick();
    }, this.tickDuration) as any;

    console.log('Tick timer started (60-second intervals)');
    return true;
  }

  /**
   * Stop the tick timer
   */
  stopTicking(): void {
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
      console.log('Tick timer stopped');
    }
  }

  /**
   * Process a tick by notifying all registered handlers
   * GameEngine should be the only handler
   */
  private processTick(): void {
    // Notify all tick handlers
    this.tickHandlers.forEach((handler) => {
      try {
        handler();
      } catch (error) {
        console.error('Tick handler error:', error);
      }
    });
  }

  /**
   * Register a tick handler
   * GameEngine uses this to be notified of ticks
   */
  registerTickHandler(handler: () => void): Unsubscribe {
    this.tickHandlers.add(handler);

    return () => {
      this.tickHandlers.delete(handler);
    };
  }

  /**
   * Format time remaining in a human-readable format
   */
  formatTimeRemaining(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 24) {
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
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
   * Check if tick timer is running
   */
  isTickingActive(): boolean {
    return this.tickInterval !== null;
  }

  /**
   * Get tick duration in milliseconds
   */
  getTickDuration(): number {
    return this.tickDuration;
  }

  /**
   * Get time state for persistence
   */
  getTimeState(): TimeState {
    return {
      lastTickTime: this.lastSaveTime,
      tickCount: 0, // This would be tracked if needed
      offlineTime: 0,
      scheduledEvents: [],
    };
  }

  /**
   * Restore time state from persistence
   */
  restoreTimeState(state: TimeState): void {
    this.lastSaveTime = state.lastTickTime;
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    this.stopTicking();
    this.tickHandlers.clear();
    console.log('TimeManager shutdown complete');
  }
}
