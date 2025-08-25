/**
 * TimeSystem - Manages game time, ticks, and offline catch-up calculations
 * Generates game ticks every 60 seconds and manages timers for various game activities
 */

import { BaseSystem, type SystemInitOptions, type SystemError } from './BaseSystem';
import type { GameUpdateWriter } from '../engine/GameUpdatesQueue';
import type { GameState } from '../models';
import { UPDATE_TYPES, GAME_TICK_INTERVAL } from '../models/constants';

/**
 * Timer configuration for registered timers
 */
export interface Timer {
  id: string;
  duration: number; // in milliseconds
  startTime: number;
  callback: () => void;
  recurring?: boolean;
  paused?: boolean;
  pausedAt?: number;
  remainingTime?: number; // for paused timers
}

/**
 * TimeSystem configuration
 */
export interface TimeSystemConfig {
  tickInterval?: number; // Override default tick interval (in seconds)
  maxOfflineTicks?: number; // Maximum ticks to process when catching up
}

/**
 * TimeSystem implementation
 * Handles game ticks, real-time synchronization, and timer management
 */
export class TimeSystem extends BaseSystem {
  private tickInterval: number;
  private tickCounter: number;
  private lastTickTime: number;
  private tickTimerId: NodeJS.Timeout | null;
  private timers: Map<string, Timer>;
  private timerCheckInterval: NodeJS.Timeout | null;
  private maxOfflineTicks: number;
  private isPaused: boolean;

  constructor(gameUpdateWriter: GameUpdateWriter, config?: TimeSystemConfig) {
    super('TimeSystem', gameUpdateWriter);
    this.tickInterval = (config?.tickInterval ?? GAME_TICK_INTERVAL) * 1000; // Convert to milliseconds
    this.maxOfflineTicks = config?.maxOfflineTicks ?? 10080; // Default: 1 week worth of ticks
    this.tickCounter = 0;
    this.lastTickTime = Date.now();
    this.tickTimerId = null;
    this.timers = new Map();
    this.timerCheckInterval = null;
    this.isPaused = false;
  }

  /**
   * Initialize the TimeSystem
   */
  protected async onInitialize(_options: SystemInitOptions): Promise<void> {
    // Initialize with the game update writer from options
    // The writer is already set in the base class
    console.log('[TimeSystem] Initialized');
  }

  /**
   * Start the tick timer
   */
  public start(): void {
    if (this.tickTimerId) {
      console.warn('[TimeSystem] Already started');
      return;
    }

    this.isPaused = false;
    this.lastTickTime = Date.now();

    // Start the main tick timer
    this.tickTimerId = setInterval(() => {
      if (!this.isPaused) {
        this.processTick();
      }
    }, this.tickInterval);

    // Start timer check interval (check every 100ms for better accuracy)
    this.timerCheckInterval = setInterval(() => {
      if (!this.isPaused) {
        this.checkTimers();
      }
    }, 100);

    console.log('[TimeSystem] Started with tick interval:', this.tickInterval / 1000, 'seconds');
  }

  /**
   * Stop the tick timer
   */
  public stop(): void {
    if (this.tickTimerId) {
      clearInterval(this.tickTimerId);
      this.tickTimerId = null;
    }

    if (this.timerCheckInterval) {
      clearInterval(this.timerCheckInterval);
      this.timerCheckInterval = null;
    }

    this.isPaused = true;
    console.log('[TimeSystem] Stopped');
  }

  /**
   * Pause the time system
   */
  public pause(): void {
    this.isPaused = true;

    // Pause all active timers
    const now = Date.now();
    this.timers.forEach((timer) => {
      if (!timer.paused) {
        timer.paused = true;
        timer.pausedAt = now;
        timer.remainingTime = timer.duration - (now - timer.startTime);
      }
    });

    console.log('[TimeSystem] Paused');
  }

  /**
   * Resume the time system
   */
  public resume(): void {
    this.isPaused = false;
    this.lastTickTime = Date.now();

    // Resume all paused timers
    const now = Date.now();
    this.timers.forEach((timer) => {
      if (timer.paused && timer.remainingTime !== undefined) {
        timer.paused = false;
        timer.startTime = now;
        timer.duration = timer.remainingTime;
        timer.remainingTime = undefined;
        timer.pausedAt = undefined;
      }
    });

    console.log('[TimeSystem] Resumed');
  }

  /**
   * Process a game tick
   */
  private processTick(): void {
    const now = Date.now();
    this.tickCounter++;
    this.lastTickTime = now;

    // Queue a GAME_TICK update
    if (this.gameUpdateWriter) {
      this.gameUpdateWriter.enqueue({
        type: UPDATE_TYPES.GAME_TICK,
        payload: {
          action: 'tick',
          data: {
            tickNumber: this.tickCounter,
            timestamp: now,
            deltaTime: this.tickInterval,
          },
        },
        priority: 1, // Higher priority for tick updates
      });
    }

    console.log(
      `[TimeSystem] Tick #${this.tickCounter} processed at ${new Date(now).toISOString()}`,
    );
  }

  /**
   * Get the current tick count
   */
  public getCurrentTick(): number {
    return this.tickCounter;
  }

  /**
   * Get the last tick timestamp
   */
  public getLastTickTime(): number {
    return this.lastTickTime;
  }

  /**
   * Calculate the number of offline ticks based on last save time
   * @param lastSaveTime Timestamp of the last save
   * @returns Number of ticks that occurred while offline
   */
  public calculateOfflineTicks(lastSaveTime: number): number {
    const now = Date.now();
    const offlineTime = now - lastSaveTime;

    // Return 0 for negative offline time (future timestamps)
    if (offlineTime < 0) {
      console.warn('[TimeSystem] Negative offline time detected, returning 0 ticks');
      return 0;
    }

    // Calculate number of ticks that should have occurred
    const offlineTicks = Math.floor(offlineTime / this.tickInterval);

    // Cap at maximum offline ticks to prevent excessive processing
    const cappedTicks = Math.min(offlineTicks, this.maxOfflineTicks);

    if (cappedTicks !== offlineTicks) {
      console.warn(
        `[TimeSystem] Capped offline ticks from ${offlineTicks} to ${cappedTicks} (max: ${this.maxOfflineTicks})`,
      );
    }

    console.log(
      `[TimeSystem] Calculated ${cappedTicks} offline ticks (${(offlineTime / 1000 / 60).toFixed(1)} minutes offline)`,
    );

    return cappedTicks;
  }

  /**
   * Process offline ticks in batches for performance
   * @param offlineTicks Number of ticks to process
   * @param batchSize Size of each batch (default: 100)
   */
  public async processOfflineTicks(offlineTicks: number, batchSize: number = 100): Promise<void> {
    if (offlineTicks <= 0) {
      return;
    }

    console.log(`[TimeSystem] Processing ${offlineTicks} offline ticks in batches of ${batchSize}`);

    let processed = 0;
    while (processed < offlineTicks) {
      const currentBatch = Math.min(batchSize, offlineTicks - processed);

      // Queue an offline tick update batch
      if (this.gameUpdateWriter) {
        this.gameUpdateWriter.enqueue({
          type: UPDATE_TYPES.GAME_TICK,
          payload: {
            action: 'offline_tick_batch',
            data: {
              tickNumber: this.tickCounter + processed,
              timestamp: this.lastTickTime,
              deltaTime: this.tickInterval * currentBatch,
              offline: true,
              batchSize: currentBatch,
            },
          },
          priority: 2, // Higher priority for offline catch-up
        });
      }

      processed += currentBatch;

      // Yield to prevent blocking the main thread
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Update tick counter after processing all offline ticks
    this.tickCounter += offlineTicks;
    this.lastTickTime = Date.now();

    console.log(`[TimeSystem] Completed processing ${offlineTicks} offline ticks`);
  }

  /**
   * Register a new timer
   * @param id Unique identifier for the timer
   * @param duration Duration in milliseconds
   * @param callback Function to call when timer completes
   * @param recurring Whether the timer should repeat
   */
  public registerTimer(
    id: string,
    duration: number,
    callback: () => void,
    recurring: boolean = false,
  ): void {
    if (this.timers.has(id)) {
      console.warn(`[TimeSystem] Timer ${id} already exists, replacing...`);
    }

    const timer: Timer = {
      id,
      duration,
      startTime: Date.now(),
      callback,
      recurring,
      paused: this.isPaused,
    };

    this.timers.set(id, timer);
    console.log(`[TimeSystem] Registered timer ${id} for ${duration}ms (recurring: ${recurring})`);
  }

  /**
   * Cancel a timer
   * @param id Timer identifier to cancel
   * @returns True if timer was cancelled, false if not found
   */
  public cancelTimer(id: string): boolean {
    if (!this.timers.has(id)) {
      console.warn(`[TimeSystem] Timer ${id} not found`);
      return false;
    }

    this.timers.delete(id);
    console.log(`[TimeSystem] Cancelled timer ${id}`);
    return true;
  }

  /**
   * Get remaining time for a timer
   * @param id Timer identifier
   * @returns Remaining time in milliseconds, or null if timer not found
   */
  public getTimerRemaining(id: string): number | null {
    const timer = this.timers.get(id);
    if (!timer) {
      return null;
    }

    if (timer.paused && timer.remainingTime !== undefined) {
      return timer.remainingTime;
    }

    const now = Date.now();
    const elapsed = now - timer.startTime;
    const remaining = Math.max(0, timer.duration - elapsed);

    return remaining;
  }

  /**
   * Check all timers and trigger callbacks for completed ones
   */
  private checkTimers(): void {
    const now = Date.now();
    const completedTimers: string[] = [];

    this.timers.forEach((timer) => {
      if (timer.paused) {
        return;
      }

      const elapsed = now - timer.startTime;
      if (elapsed >= timer.duration) {
        completedTimers.push(timer.id);
      }
    });

    // Process completed timers
    completedTimers.forEach((id) => {
      const timer = this.timers.get(id);
      if (!timer) return;

      console.log(`[TimeSystem] Timer ${id} completed`);

      try {
        timer.callback();
      } catch (error) {
        console.error(`[TimeSystem] Error in timer ${id} callback:`, error);
      }

      if (timer.recurring) {
        // Reset the timer for next iteration
        timer.startTime = now;
      } else {
        // Remove one-time timer
        this.timers.delete(id);
      }
    });
  }

  /**
   * Get all active timers
   * @returns Array of timer information
   */
  public getActiveTimers(): Array<{ id: string; remaining: number; paused: boolean }> {
    const activeTimers: Array<{ id: string; remaining: number; paused: boolean }> = [];

    this.timers.forEach((timer) => {
      const remaining = this.getTimerRemaining(timer.id);
      if (remaining !== null) {
        activeTimers.push({
          id: timer.id,
          remaining,
          paused: timer.paused ?? false,
        });
      }
    });

    return activeTimers;
  }

  /**
   * Clear all timers
   */
  public clearAllTimers(): void {
    this.timers.clear();
    console.log('[TimeSystem] All timers cleared');
  }

  /**
   * Set the tick counter (used for save/load)
   * @param count New tick count
   */
  public setTickCounter(count: number): void {
    this.tickCounter = count;
    console.log(`[TimeSystem] Tick counter set to ${count}`);
  }

  /**
   * Get real-time clock information
   */
  public getRealTimeClock(): {
    timestamp: number;
    timezone: string;
    offset: number;
  } {
    const now = new Date();
    return {
      timestamp: now.getTime(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset: now.getTimezoneOffset(),
    };
  }

  /**
   * Synchronize with real-time clock
   * @param savedTime Last saved timestamp
   * @returns Drift in milliseconds
   */
  public synchronizeWithRealTime(savedTime: number): number {
    const now = Date.now();
    const drift = now - savedTime;

    console.log(
      `[TimeSystem] Clock synchronization - Drift: ${drift}ms (${(drift / 1000).toFixed(1)}s)`,
    );

    return drift;
  }

  /**
   * System lifecycle methods
   */
  protected async onShutdown(): Promise<void> {
    this.stop();
    this.clearAllTimers();
    console.log('[TimeSystem] Shutdown complete');
  }

  protected async onReset(): Promise<void> {
    this.tickCounter = 0;
    this.lastTickTime = Date.now();
    this.clearAllTimers();
    console.log('[TimeSystem] Reset complete');
  }

  protected async onTick(_deltaTime: number, _gameState: GameState): Promise<void> {
    // TimeSystem manages its own ticks, so this is not used
  }

  protected async onUpdate(_gameState: GameState, _prevState?: GameState): Promise<void> {
    // TimeSystem doesn't need to respond to state updates
  }

  protected onError(error: SystemError): void {
    console.error(`[TimeSystem] System error:`, error);

    // If critical error, stop the tick timer to prevent cascading failures
    if (!error.recoverable) {
      this.stop();
    }
  }

  /**
   * Get system statistics
   */
  public getStatistics(): {
    tickCount: number;
    uptime: number;
    activeTimers: number;
    isPaused: boolean;
    tickInterval: number;
  } {
    const uptime = Date.now() - (this.lastTickTime - this.tickCounter * this.tickInterval);

    return {
      tickCount: this.tickCounter,
      uptime,
      activeTimers: this.timers.size,
      isPaused: this.isPaused,
      tickInterval: this.tickInterval,
    };
  }
}

/**
 * Factory function to create a new TimeSystem
 */
export function createTimeSystem(gameUpdateWriter: GameUpdateWriter, config?: TimeSystemConfig): TimeSystem {
  return new TimeSystem(gameUpdateWriter, config);
}
