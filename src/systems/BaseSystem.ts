/**
 * BaseSystem - Abstract base class for all game systems
 * Provides common functionality and interface that all systems must implement
 */

import type { GameUpdateWriter } from '../engine/GameUpdatesQueue';
import type { GameState } from '../models';
import type { TuningConfig } from './ConfigSystem';

/**
 * System initialization options
 */
export interface SystemInitOptions {
  gameUpdateWriter: GameUpdateWriter;
  config?: any;
  tuning?: TuningConfig; // Tuning values passed by GameEngine
}

/**
 * System error information
 */
export interface SystemError {
  system: string;
  error: Error;
  timestamp: number;
  recoverable: boolean;
}

/**
 * System status information
 */
export interface SystemStatus {
  name: string;
  initialized: boolean;
  active: boolean;
  lastUpdate: number;
  errorCount: number;
  version: string;
}

/**
 * Abstract base class for all game systems
 */
export abstract class BaseSystem {
  protected readonly name: string;
  protected gameUpdateWriter: GameUpdateWriter | null = null;
  protected initialized = false;
  protected active = false;
  protected lastUpdate = 0;
  protected errorCount = 0;
  protected readonly version = '1.0.0';
  protected tuning: TuningConfig | null = null; // Store tuning values locally

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Initialize the system with required dependencies
   * @param options Initialization options including GameUpdateWriter
   */
  public async initialize(options: SystemInitOptions): Promise<void> {
    if (this.initialized) {
      throw new Error(`System ${this.name} is already initialized`);
    }

    this.gameUpdateWriter = options.gameUpdateWriter;
    this.tuning = options.tuning || null; // Store tuning values

    // Call system-specific initialization
    await this.onInitialize(options);

    this.initialized = true;
    this.active = true;
    this.lastUpdate = Date.now();
  }

  /**
   * Shutdown the system and cleanup resources
   */
  public async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.active = false;

    // Call system-specific shutdown
    await this.onShutdown();

    this.initialized = false;
    this.gameUpdateWriter = null;
  }

  /**
   * Reset the system to initial state
   */
  public async reset(): Promise<void> {
    if (!this.initialized) {
      throw new Error(`System ${this.name} is not initialized`);
    }

    // Call system-specific reset
    await this.onReset();

    this.errorCount = 0;
    this.lastUpdate = Date.now();
  }

  /**
   * Process a game tick
   * @param deltaTime Time since last tick in milliseconds
   * @param gameState Current game state
   */
  public async tick(deltaTime: number, gameState: GameState): Promise<void> {
    if (!this.active) {
      return;
    }

    try {
      await this.onTick(deltaTime, gameState);
      this.lastUpdate = Date.now();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Update the system based on game state changes
   * @param gameState Current game state
   * @param prevState Previous game state (for diff)
   */
  public async update(gameState: GameState, prevState?: GameState): Promise<void> {
    if (!this.active) {
      return;
    }

    try {
      await this.onUpdate(gameState, prevState);
      this.lastUpdate = Date.now();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Handle an error that occurred in the system
   * @param error The error to handle
   */
  protected handleError(error: Error): void {
    this.errorCount++;

    const systemError: SystemError = {
      system: this.name,
      error,
      timestamp: Date.now(),
      recoverable: this.isRecoverableError(error),
    };

    // Log the error
    console.error(`[${this.name}] Error:`, error);

    // Call system-specific error handling
    this.onError(systemError);

    // If too many errors, deactivate the system
    if (this.errorCount > 10) {
      console.error(`[${this.name}] Too many errors, deactivating system`);
      this.active = false;
    }
  }

  /**
   * Check if an error is recoverable
   * @param error The error to check
   * @returns True if the error is recoverable
   */
  protected isRecoverableError(_error: Error): boolean {
    // Override in derived classes for specific error handling
    return true;
  }

  /**
   * Get the current status of the system
   * @returns System status information
   */
  public getStatus(): SystemStatus {
    return {
      name: this.name,
      initialized: this.initialized,
      active: this.active,
      lastUpdate: this.lastUpdate,
      errorCount: this.errorCount,
      version: this.version,
    };
  }

  /**
   * Get the system name
   * @returns The name of the system
   */
  public getName(): string {
    return this.name;
  }

  /**
   * Check if the system is initialized
   * @returns True if the system is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if the system is active
   * @returns True if the system is active
   */
  public isActive(): boolean {
    return this.active;
  }

  /**
   * Set the active state of the system
   * @param active Whether the system should be active
   */
  public setActive(active: boolean): void {
    if (!this.initialized) {
      throw new Error(`Cannot set active state on uninitialized system ${this.name}`);
    }
    this.active = active;
  }

  /**
   * Update tuning values (called by GameEngine when config changes)
   * @param tuning New tuning configuration
   */
  public updateTuning(tuning: TuningConfig): void {
    this.tuning = tuning;
    this.onTuningUpdated(tuning);
  }

  /**
   * Hook for systems to respond to tuning updates
   * Override in derived classes if needed
   * @param tuning New tuning configuration
   */
  protected onTuningUpdated(_tuning: TuningConfig): void {
    // Default implementation does nothing
    // Override in derived classes to handle tuning changes
  }

  // Abstract methods that must be implemented by derived classes

  /**
   * System-specific initialization logic
   * @param options Initialization options
   */
  protected abstract onInitialize(options: SystemInitOptions): Promise<void>;

  /**
   * System-specific shutdown logic
   */
  protected abstract onShutdown(): Promise<void>;

  /**
   * System-specific reset logic
   */
  protected abstract onReset(): Promise<void>;

  /**
   * System-specific tick processing
   * @param deltaTime Time since last tick in milliseconds
   * @param gameState Current game state
   */
  protected abstract onTick(deltaTime: number, gameState: GameState): Promise<void>;

  /**
   * System-specific update processing
   * @param gameState Current game state
   * @param prevState Previous game state
   */
  protected abstract onUpdate(gameState: GameState, prevState?: GameState): Promise<void>;

  /**
   * System-specific error handling
   * @param error System error information
   */
  protected abstract onError(error: SystemError): void;
}

/**
 * Interface for systems that can handle specific update types
 */
export interface UpdateHandler {
  /**
   * Check if this system can handle a specific update type
   * @param updateType The update type to check
   * @returns True if the system can handle this update type
   */
  canHandleUpdate(updateType: string): boolean;

  /**
   * Handle a specific update
   * @param update The update to handle
   * @param gameState Current game state
   * @returns Updated game state or null if no changes
   */
  handleUpdate(update: any, gameState: GameState): Promise<GameState | null>;
}

/**
 * Type guard to check if a system implements UpdateHandler
 */
export function isUpdateHandler(system: any): system is UpdateHandler {
  return typeof system.canHandleUpdate === 'function' && typeof system.handleUpdate === 'function';
}
