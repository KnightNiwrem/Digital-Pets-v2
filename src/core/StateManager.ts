import type {
  GameSystem,
  GameState,
  GameAction,
  StateListener,
  StateSnapshot,
  ValidationResult,
  Unsubscribe,
  PetState,
  InventoryState,
  WorldState,
  SettingsState,
  TimeState,
} from '../types';
import { ActionType } from '../types';

/**
 * StateManager maintains the single source of truth for all game state.
 * Only GameEngine can directly modify state through this manager.
 * 
 * This is now a pure state store with no event emission capabilities.
 * All state change notifications are handled by GameEngine.
 */
export class StateManager implements GameSystem {
  private state: GameState;
  private previousState: GameState | null = null;
  private listeners: Set<StateListener> = new Set();
  private pathListeners: Map<string, Set<StateListener>> = new Map();
  private transactionState: GameState | null = null;
  private isInTransaction = false;

  constructor(initialState?: Partial<GameState>) {
    this.state = this.createDefaultState();

    if (initialState) {
      this.state = { ...this.state, ...initialState };
    }
  }

  async initialize(): Promise<void> {
    console.log('StateManager initialized as pure state store');
  }

  /**
   * Get the current game state
   */
  getState(): GameState {
    return this.state;
  }

  /**
   * Get the current pet state
   */
  getPetState(): PetState | null {
    return this.state.pet;
  }

  /**
   * Get the current inventory state
   */
  getInventoryState(): InventoryState {
    return this.state.inventory;
  }

  /**
   * Get the current world state
   */
  getWorldState(): WorldState {
    return this.state.world;
  }

  /**
   * Get the current settings state
   */
  getSettingsState(): SettingsState {
    return this.state.settings;
  }

  /**
   * Get the current time state
   */
  getTimeState(): TimeState {
    return this.state.time;
  }

  /**
   * Dispatch an action to update the state
   * NOTE: This should only be called by GameEngine
   */
  dispatch(action: GameAction): void {
    if (!action.timestamp) {
      action.timestamp = Date.now();
    }

    const newState = this.reduceState(this.state, action);
    this.setState(newState, action);
  }

  /**
   * Dispatch multiple actions as a batch
   * NOTE: This should only be called by GameEngine
   */
  batchDispatch(actions: GameAction[]): void {
    this.beginTransaction();

    try {
      for (const action of actions) {
        this.dispatch(action);
      }
      this.commitTransaction();
    } catch (error) {
      this.rollbackTransaction();
      throw error;
    }
  }

  /**
   * Validate state integrity
   */
  validateState(state: Partial<GameState>): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Basic structure validation
    if (state.pet) {
      if (state.pet.satiety < 0 || state.pet.satiety > 100) {
        result.errors.push('Pet satiety must be between 0 and 100');
        result.isValid = false;
      }
      if (state.pet.hydration < 0 || state.pet.hydration > 100) {
        result.errors.push('Pet hydration must be between 0 and 100');
        result.isValid = false;
      }
      if (state.pet.happiness < 0 || state.pet.happiness > 100) {
        result.errors.push('Pet happiness must be between 0 and 100');
        result.isValid = false;
      }
      if (state.pet.energy < 0 || state.pet.energy > state.pet.maxEnergy) {
        result.errors.push('Pet energy must be between 0 and max energy');
        result.isValid = false;
      }
      if (state.pet.life < 0 || state.pet.life > 100) {
        result.errors.push('Pet life must be between 0 and 100');
        result.isValid = false;
      }

      // Warnings
      if (state.pet.satiety < 20) {
        result.warnings.push('Pet satiety is critically low');
      }
      if (state.pet.hydration < 20) {
        result.warnings.push('Pet hydration is critically low');
      }
      if (state.pet.happiness < 20) {
        result.warnings.push('Pet happiness is critically low');
      }
      if (state.pet.life < 20) {
        result.warnings.push('Pet life is critically low');
      }
    }

    if (state.inventory) {
      if (state.inventory.coins < 0) {
        result.errors.push('Coins cannot be negative');
        result.isValid = false;
      }
    }

    return result;
  }

  /**
   * Sanitize state to ensure valid values
   */
  sanitizeState(state: GameState): GameState {
    const sanitized = JSON.parse(JSON.stringify(state));

    if (sanitized.pet) {
      // Clamp care values
      sanitized.pet.satiety = Math.max(0, Math.min(100, sanitized.pet.satiety));
      sanitized.pet.hydration = Math.max(0, Math.min(100, sanitized.pet.hydration));
      sanitized.pet.happiness = Math.max(0, Math.min(100, sanitized.pet.happiness));
      sanitized.pet.life = Math.max(0, Math.min(100, sanitized.pet.life));

      // Clamp energy
      sanitized.pet.energy = Math.max(0, Math.min(sanitized.pet.maxEnergy, sanitized.pet.energy));

      // Ensure non-negative values
      sanitized.pet.poopCount = Math.max(0, sanitized.pet.poopCount);
      sanitized.pet.satietyTicks = Math.max(0, sanitized.pet.satietyTicks);
      sanitized.pet.hydrationTicks = Math.max(0, sanitized.pet.hydrationTicks);
      sanitized.pet.happinessTicks = Math.max(0, sanitized.pet.happinessTicks);
    }

    if (sanitized.inventory) {
      sanitized.inventory.coins = Math.max(0, sanitized.inventory.coins);
    }

    return sanitized;
  }

  /**
   * Subscribe to state changes
   * NOTE: In the pure architecture, only GameEngine should use this
   */
  subscribe(listener: StateListener): Unsubscribe {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Subscribe to changes in a specific state path
   * NOTE: In the pure architecture, only GameEngine should use this
   */
  subscribeToPath(path: string, listener: StateListener): Unsubscribe {
    if (!this.pathListeners.has(path)) {
      this.pathListeners.set(path, new Set());
    }

    const pathListenersSet = this.pathListeners.get(path)!;
    pathListenersSet.add(listener);

    return () => {
      pathListenersSet.delete(listener);
      if (pathListenersSet.size === 0) {
        this.pathListeners.delete(path);
      }
    };
  }

  /**
   * Create a state snapshot for saving
   */
  createSnapshot(): StateSnapshot {
    const state = JSON.parse(JSON.stringify(this.state));
    const timestamp = Date.now();
    const checksum = this.generateChecksum(state);

    return {
      state,
      timestamp,
      checksum,
    };
  }

  /**
   * Restore state from a snapshot
   */
  restoreSnapshot(snapshot: StateSnapshot): void {
    // Verify checksum
    const expectedChecksum = this.generateChecksum(snapshot.state);
    if (expectedChecksum !== snapshot.checksum) {
      throw new Error('Snapshot checksum mismatch - data may be corrupted');
    }

    // Validate the state
    const validation = this.validateState(snapshot.state);
    if (!validation.isValid) {
      console.warn('Snapshot validation failed:', validation.errors);
      // Sanitize the state before restoring
      snapshot.state = this.sanitizeState(snapshot.state);
    }

    this.setState(snapshot.state);
  }

  /**
   * Begin a transaction to batch multiple state updates
   */
  beginTransaction(): void {
    if (this.isInTransaction) {
      throw new Error('Transaction already in progress');
    }

    this.transactionState = JSON.parse(JSON.stringify(this.state));
    this.isInTransaction = true;
  }

  /**
   * Commit the current transaction
   */
  commitTransaction(): void {
    if (!this.isInTransaction) {
      throw new Error('No transaction in progress');
    }

    this.transactionState = null;
    this.isInTransaction = false;

    // Notify listeners of the final state
    this.notifyListeners();
  }

  /**
   * Rollback the current transaction
   */
  rollbackTransaction(): void {
    if (!this.isInTransaction || !this.transactionState) {
      throw new Error('No transaction in progress');
    }

    this.state = this.transactionState;
    this.transactionState = null;
    this.isInTransaction = false;
  }

  /**
   * Internal method to set state and notify listeners
   */
  private setState(newState: GameState, action?: GameAction): void {
    this.previousState = JSON.parse(JSON.stringify(this.state));
    this.state = newState;

    // Update last save time in meta
    this.state.meta.lastSaveTime = Date.now();

    // Don't notify listeners during transactions
    if (!this.isInTransaction) {
      this.notifyListeners();
      
      // No event emission - GameEngine handles all events
      // Previous event emission code has been removed
    }
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(): void {
    // Notify general listeners
    this.listeners.forEach((listener) => {
      try {
        listener(this.state, this.previousState || undefined);
      } catch (error) {
        console.error('State listener error:', error);
      }
    });

    // Notify path-specific listeners
    this.pathListeners.forEach((listeners, path) => {
      const currentValue = this.getValueByPath(this.state, path);
      const previousValue = this.previousState
        ? this.getValueByPath(this.previousState, path)
        : undefined;

      // Only notify if the path value actually changed
      if (currentValue !== previousValue) {
        listeners.forEach((listener) => {
          try {
            listener(this.state, this.previousState || undefined);
          } catch (error) {
            console.error(`Path listener error for ${path}:`, error);
          }
        });
      }
    });
  }

  /**
   * Get value by path (simple dot notation)
   */
  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * State reducer - handles all state transitions
   */
  private reduceState(state: GameState, action: GameAction): GameState {
    const newState = JSON.parse(JSON.stringify(state));

    switch (action.type) {
      case ActionType.SET_STATE:
        return { ...newState, ...action.payload };

      case ActionType.MERGE_STATE:
        return this.mergeDeep(newState, action.payload);

      case ActionType.CREATE_PET:
        newState.pet = action.payload;
        break;

      case ActionType.FEED_PET:
        if (newState.pet) {
          // Convert foodAmount to ticks (foodAmount * SATIETY_MULTIPLIER)
          const ticksToAdd = (action.payload.foodAmount || 0) * 20;
          newState.pet.satietyTicks += ticksToAdd;
          newState.pet.satiety = this.calculateDisplayValue(newState.pet.satietyTicks, 20);
          newState.pet.lastInteractionTime = Date.now();
        }
        break;

      case ActionType.GIVE_DRINK:
        if (newState.pet) {
          // Convert drinkAmount to ticks (drinkAmount * HYDRATION_MULTIPLIER)
          const ticksToAdd = (action.payload.drinkAmount || 0) * 15;
          newState.pet.hydrationTicks += ticksToAdd;
          newState.pet.hydration = this.calculateDisplayValue(newState.pet.hydrationTicks, 15);
          newState.pet.lastInteractionTime = Date.now();
        }
        break;

      case ActionType.PLAY_WITH_PET:
        if (newState.pet) {
          // Convert playAmount to ticks (playAmount * HAPPINESS_MULTIPLIER)
          const ticksToAdd = (action.payload.playAmount || 10) * 30;
          newState.pet.happinessTicks += ticksToAdd;
          newState.pet.happiness = this.calculateDisplayValue(newState.pet.happinessTicks, 30);
          newState.pet.energy = Math.max(0, newState.pet.energy - (action.payload.energyCost || 5));
          newState.pet.lastInteractionTime = Date.now();
        }
        break;

      case ActionType.CLEAN_POOP:
        if (newState.pet) {
          newState.pet.poopCount = Math.max(
            0,
            newState.pet.poopCount - (action.payload.amount || 1),
          );
          newState.pet.lastInteractionTime = Date.now();
        }
        break;

      case ActionType.START_SLEEP:
        if (newState.pet) {
          newState.pet.isSleeping = true;
          newState.pet.sleepStartTime = Date.now();
        }
        break;

      case ActionType.WAKE_PET:
        if (newState.pet) {
          newState.pet.isSleeping = false;
          newState.pet.sleepStartTime = null;
          if (action.payload.energyRecovered) {
            newState.pet.energy = Math.min(
              newState.pet.maxEnergy,
              newState.pet.energy + action.payload.energyRecovered,
            );
          }
          if (action.payload.wasEarlyWake) {
            // Reduce happiness for early wake
            newState.pet.happinessTicks = Math.max(0, newState.pet.happinessTicks - 30);
            newState.pet.happiness = this.calculateDisplayValue(newState.pet.happinessTicks, 30);
          }
        }
        break;

      case ActionType.DECAY_CARE:
        if (newState.pet) {
          newState.pet.satietyTicks = Math.max(
            0,
            newState.pet.satietyTicks - action.payload.satietyDecay,
          );
          newState.pet.hydrationTicks = Math.max(
            0,
            newState.pet.hydrationTicks - action.payload.hydrationDecay,
          );
          newState.pet.happinessTicks = Math.max(
            0,
            newState.pet.happinessTicks - action.payload.happinessDecay,
          );

          // Update display values
          newState.pet.satiety = this.calculateDisplayValue(newState.pet.satietyTicks, 20);
          newState.pet.hydration = this.calculateDisplayValue(newState.pet.hydrationTicks, 15);
          newState.pet.happiness = this.calculateDisplayValue(newState.pet.happinessTicks, 30);
        }
        break;

      case ActionType.ADD_POOP:
        if (newState.pet) {
          newState.pet.poopCount += action.payload.amount || 1;
        }
        break;

      case ActionType.PROCESS_TICK:
        newState.time.lastTickTime = Date.now();
        newState.time.tickCount += 1;
        break;

      default:
        console.warn(`Unhandled action type: ${action.type}`);
        break;
    }

    return this.sanitizeState(newState);
  }

  /**
   * Calculate display value from ticks
   */
  private calculateDisplayValue(ticks: number, multiplier: number): number {
    return Math.min(100, Math.ceil(ticks / multiplier));
  }

  /**
   * Deep merge utility
   */
  private mergeDeep(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.mergeDeep(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Generate checksum for data integrity
   */
  private generateChecksum(data: any): string {
    const jsonString = JSON.stringify(data, Object.keys(data).sort());
    let hash = 0;

    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(36);
  }

  /**
   * Create default game state
   */
  private createDefaultState(): GameState {
    const now = Date.now();

    return {
      meta: {
        version: '1.0.0',
        createdAt: now,
        lastSaveTime: now,
        playerId: this.generatePlayerId(),
      },
      pet: null,
      world: {
        currentLocation: {
          id: 'starter_city',
          name: 'Starter City',
          type: 'city' as any,
          description: 'A peaceful starting location',
          availableActivities: [],
          shops: [],
          distanceTo: {},
        },
        currentActivity: null,
        currentTravel: null,
        currentTraining: null,
        currentBattle: null,
        currentEvent: null,
      },
      inventory: {
        items: {},
        coins: 100,
        eggs: [],
        maxSlots: 50,
      },
      settings: {
        accessibility: {
          colorBlindMode: 'none' as any,
          highContrast: false,
          fontScale: 1.0,
          reducedMotion: false,
          screenReaderEnabled: false,
        },
        notifications: {
          lowCareAlerts: true,
          highPoopAlerts: true,
          activityComplete: true,
          eventReminders: true,
          soundEnabled: true,
        },
        audio: {
          masterVolume: 0.8,
          musicVolume: 0.6,
          effectsVolume: 0.8,
          muted: false,
        },
      },
      time: {
        lastTickTime: now,
        tickCount: 0,
        offlineTime: 0,
        scheduledEvents: [],
      },
    };
  }

  /**
   * Generate unique player ID
   */
  private generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async shutdown(): Promise<void> {
    this.listeners.clear();
    this.pathListeners.clear();
    this.transactionState = null;
    this.isInTransaction = false;

    console.log('StateManager shutdown complete');
  }
}
