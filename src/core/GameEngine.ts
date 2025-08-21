import type { GameSystem, GameState, GameAction, Unsubscribe } from '../types';
import {
  EventType,
  ActionType,
  SystemType,
  AutosaveReason,
  Species,
  Rarity,
  GrowthStage,
} from '../types';
import { EventManager } from './EventManager';
import { StateManager } from './StateManager';
import { TimeManager } from './TimeManager';

/**
 * GameEngine is the central coordinator that manages the game,
 * orchestrates all subsystems, and ensures proper initialization and shutdown sequences.
 *
 * All user actions flow through the GameEngine for validation and processing.
 * This is a singleton to ensure only one game instance exists.
 */
export class GameEngine implements GameSystem {
  private static instance: GameEngine | null = null;

  private systems: Map<SystemType, GameSystem> = new Map();
  private eventManager: EventManager;
  private stateManager: StateManager;
  private timeManager: TimeManager;

  private isRunning = false;
  private isInitialized = false;
  private isProcessingAction = false;

  private tickUnsubscribe: Unsubscribe | null = null;
  private autosaveDebounceTimer: number | null = null;
  private pendingAutosave = false;

  private constructor(initialState?: Partial<GameState>) {
    // Initialize core systems
    this.eventManager = new EventManager();
    this.stateManager = new StateManager(initialState);
    this.timeManager = new TimeManager();

    // Register core systems
    this.systems.set(SystemType.EVENT_MANAGER, this.eventManager);
    this.systems.set(SystemType.STATE_MANAGER, this.stateManager);
    this.systems.set(SystemType.TIME_MANAGER, this.timeManager);

    // Set up cross-system references
    this.stateManager.setEventManager(this.eventManager);
    this.timeManager.setEventManager(this.eventManager);
    this.timeManager.setStateManager(this.stateManager);
  }

  /**
   * Get the singleton game engine instance
   */
  static getInstance(initialState?: Partial<GameState>): GameEngine {
    if (!GameEngine.instance) {
      GameEngine.instance = new GameEngine(initialState);
    }
    return GameEngine.instance;
  }

  /**
   * Reset the singleton (for testing purposes)
   */
  static reset(): void {
    if (GameEngine.instance) {
      // Ensure proper cleanup before resetting
      if (GameEngine.instance.isInitialized) {
        console.warn('Resetting GameEngine without proper shutdown');
      }
    }
    GameEngine.instance = null;
  }

  /**
   * Initialize the game engine and all systems
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('GameEngine is already initialized');
      return;
    }

    try {
      console.log('GameEngine initialization starting...');

      // Initialize core systems in order
      await this.eventManager.initialize();
      await this.stateManager.initialize();
      await this.timeManager.initialize();

      // Process offline time if any
      await this.handleOfflineTime();

      // Set up event subscriptions
      this.setupEventListeners();

      // Set up tick processing
      this.setupTickProcessing();

      this.isInitialized = true;

      // Emit system initialized event
      this.eventManager.emit({
        type: EventType.SYSTEM_INITIALIZED,
        payload: { system: 'GameEngine' },
        timestamp: Date.now(),
      });

      console.log('GameEngine initialization completed');
    } catch (error) {
      console.error('GameEngine initialization failed:', error);

      this.eventManager.emit({
        type: EventType.SYSTEM_ERROR,
        payload: { system: 'GameEngine', error: String(error) },
        timestamp: Date.now(),
      });

      throw error;
    }
  }

  /**
   * Load game state from persistence
   */
  async loadGameState(): Promise<GameState> {
    // TODO: Implement persistence loading in phase 1.3
    // For now, return current state
    return this.stateManager.getState();
  }

  /**
   * Start the game engine
   */
  start(): void {
    if (!this.isInitialized) {
      throw new Error('GameEngine must be initialized before starting');
    }

    if (this.isRunning) {
      console.warn('Game engine is already running');
      return;
    }

    this.isRunning = true;

    // Start the time manager ticking (60-second intervals)
    this.timeManager.startTicking();

    console.log('Game engine started');
  }

  /**
   * Stop the game engine
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Stop the time manager
    this.timeManager.stopTicking();

    console.log('Game engine stopped');
  }

  /**
   * Pause the game
   */
  pause(): void {
    if (this.isRunning) {
      this.stop();
      console.log('Game paused');
    }
  }

  /**
   * Resume the game
   */
  resume(): void {
    if (this.isInitialized && !this.isRunning) {
      this.start();
      console.log('Game resumed');
    }
  }

  /**
   * Create a starter pet (convenience method for initial setup)
   */
  async createStarterPet(
    species: Species = Species.FLUFFY_PUP,
    name: string = 'Buddy',
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isInitialized) {
      return { success: false, error: 'Game must be initialized before creating a pet' };
    }

    const now = Date.now();

    const starterPet = {
      id: `pet_${now}_${Math.random().toString(36).substr(2, 9)}`,
      species,
      rarity: Rarity.COMMON,
      name,
      stage: GrowthStage.HATCHLING,
      createdAt: now,
      lastInteractionTime: now,

      // Care values (start at 80)
      satiety: 80,
      hydration: 80,
      happiness: 80,

      // Hidden care ticks (80 * multiplier)
      satietyTicks: 80 * 20, // 1600 ticks
      hydrationTicks: 80 * 15, // 1200 ticks
      happinessTicks: 80 * 30, // 2400 ticks

      // Hidden life stat (start at 100)
      life: 100,

      // Energy (start at max for hatchling)
      energy: 50,
      maxEnergy: 50,

      // Status
      isSleeping: false,
      sleepStartTime: null,
      poopCount: 0,
      statuses: [],

      // Battle stats (basic starter values)
      battleStats: {
        health: 50,
        maxHealth: 50,
        attack: 10,
        defense: 8,
        speed: 12,
        action: 20,
        maxAction: 20,
      },
      knownMoves: [],

      // Stage progression
      stageStartTime: now,
      canAdvanceStage: false,
    };

    // Use the processUserAction method for proper orchestration
    const result = await this.processUserAction({
      type: ActionType.CREATE_PET,
      payload: starterPet,
      timestamp: now,
    });

    if (result.success) {
      console.log(`Created starter pet: ${name} (${species})`);
    }

    return result;
  }

  /**
   * Central entry point for all user actions
   * This is where the orchestration happens
   */
  async processUserAction(action: GameAction): Promise<{ success: boolean; error?: string }> {
    // Prevent concurrent action processing (race condition protection)
    if (this.isProcessingAction) {
      return { success: false, error: 'Another action is being processed' };
    }

    this.isProcessingAction = true;

    try {
      // 1. Validate the action
      const validation = this.validateAction(action);
      if (!validation.valid) {
        return { success: false, error: validation.error || 'Validation failed' };
      }

      // 2. Process through appropriate systems based on action type
      switch (action.type) {
        case ActionType.CREATE_PET:
          return await this.handleCreatePet(action);
        case ActionType.FEED_PET:
          return await this.handleFeedPet(action);
        case ActionType.GIVE_DRINK:
          return await this.handleGiveDrink(action);
        case ActionType.PLAY_WITH_PET:
          return await this.handlePlayWithPet(action);
        case ActionType.CLEAN_POOP:
          return await this.handleCleanPoop(action);
        case ActionType.START_SLEEP:
          return await this.handleStartSleep(action);
        case ActionType.WAKE_PET:
          return await this.handleWakePet(action);
        default:
          return { success: false, error: `Unknown action type: ${action.type}` };
      }
    } finally {
      this.isProcessingAction = false;
    }
  }

  /**
   * Validate an action before processing
   */
  private validateAction(action: GameAction): { valid: boolean; error?: string } {
    if (!action.type) {
      return { valid: false, error: 'Action type is required' };
    }

    // Action-specific validation
    const petState = this.stateManager.getPetState();

    switch (action.type) {
      case ActionType.CREATE_PET:
        if (petState) {
          return { valid: false, error: 'A pet already exists' };
        }
        break;

      case ActionType.FEED_PET:
      case ActionType.GIVE_DRINK:
      case ActionType.PLAY_WITH_PET:
      case ActionType.CLEAN_POOP:
      case ActionType.START_SLEEP:
      case ActionType.WAKE_PET:
        if (!petState) {
          return { valid: false, error: 'No active pet' };
        }
        break;
    }

    return { valid: true };
  }

  /**
   * Handle pet creation
   */
  private async handleCreatePet(action: GameAction): Promise<{ success: boolean; error?: string }> {
    // Update state
    this.stateManager.dispatch(action);

    // Emit event
    this.eventManager.emit({
      type: EventType.PET_CREATED,
      payload: action.payload,
      timestamp: Date.now(),
    });

    // Trigger autosave
    this.scheduleAutosave(AutosaveReason.USER_ACTION);

    return { success: true };
  }

  /**
   * Handle feeding pet
   */
  private async handleFeedPet(action: GameAction): Promise<{ success: boolean; error?: string }> {
    const petState = this.stateManager.getPetState();
    if (!petState) {
      return { success: false, error: 'No active pet' };
    }

    // Check if pet can eat (e.g., not in battle, not traveling in restricted mode)
    // TODO: Add activity checks when those systems are implemented

    // Update state
    this.stateManager.dispatch(action);

    // Emit event
    this.eventManager.emit({
      type: EventType.PET_FED,
      payload: action.payload,
      timestamp: Date.now(),
    });

    // Trigger autosave
    this.scheduleAutosave(AutosaveReason.USER_ACTION);

    return { success: true };
  }

  /**
   * Handle giving drink to pet
   */
  private async handleGiveDrink(action: GameAction): Promise<{ success: boolean; error?: string }> {
    const petState = this.stateManager.getPetState();
    if (!petState) {
      return { success: false, error: 'No active pet' };
    }

    // Update state
    this.stateManager.dispatch(action);

    // Emit event
    this.eventManager.emit({
      type: EventType.PET_DRANK,
      payload: action.payload,
      timestamp: Date.now(),
    });

    // Trigger autosave
    this.scheduleAutosave(AutosaveReason.USER_ACTION);

    return { success: true };
  }

  /**
   * Handle playing with pet
   */
  private async handlePlayWithPet(
    action: GameAction,
  ): Promise<{ success: boolean; error?: string }> {
    const petState = this.stateManager.getPetState();
    if (!petState) {
      return { success: false, error: 'No active pet' };
    }

    // Check energy requirement
    const energyCost = action.payload?.energyCost || 5;
    if (petState.energy < energyCost) {
      return { success: false, error: 'Not enough energy to play' };
    }

    // Update state
    this.stateManager.dispatch(action);

    // Emit event
    this.eventManager.emit({
      type: EventType.PET_PLAYED,
      payload: action.payload,
      timestamp: Date.now(),
    });

    // Trigger autosave
    this.scheduleAutosave(AutosaveReason.USER_ACTION);

    return { success: true };
  }

  /**
   * Handle cleaning poop
   */
  private async handleCleanPoop(action: GameAction): Promise<{ success: boolean; error?: string }> {
    const petState = this.stateManager.getPetState();
    if (!petState) {
      return { success: false, error: 'No active pet' };
    }

    if (petState.poopCount <= 0) {
      return { success: false, error: 'No poop to clean' };
    }

    // Update state
    this.stateManager.dispatch(action);

    // Trigger autosave
    this.scheduleAutosave(AutosaveReason.USER_ACTION);

    return { success: true };
  }

  /**
   * Handle starting sleep
   */
  private async handleStartSleep(
    action: GameAction,
  ): Promise<{ success: boolean; error?: string }> {
    const petState = this.stateManager.getPetState();
    if (!petState) {
      return { success: false, error: 'No active pet' };
    }

    if (petState.isSleeping) {
      return { success: false, error: 'Pet is already sleeping' };
    }

    // Update state
    this.stateManager.dispatch(action);

    // Emit event
    this.eventManager.emit({
      type: EventType.PET_SLEPT,
      payload: action.payload,
      timestamp: Date.now(),
    });

    // Trigger autosave
    this.scheduleAutosave(AutosaveReason.USER_ACTION);

    return { success: true };
  }

  /**
   * Handle waking pet
   */
  private async handleWakePet(action: GameAction): Promise<{ success: boolean; error?: string }> {
    const petState = this.stateManager.getPetState();
    if (!petState) {
      return { success: false, error: 'No active pet' };
    }

    if (!petState.isSleeping) {
      return { success: false, error: 'Pet is not sleeping' };
    }

    // Calculate energy recovery if waking naturally or early
    const now = Date.now();
    const sleepDuration = petState.sleepStartTime ? now - petState.sleepStartTime : 0;
    const maxSleepTime = 8 * 60 * 60 * 1000; // 8 hours in ms
    const wasEarlyWake = sleepDuration < maxSleepTime;

    let energyRecovered = 0;
    if (wasEarlyWake) {
      // Early wake - half energy recovery
      const percentSlept = sleepDuration / maxSleepTime;
      energyRecovered = Math.floor((petState.maxEnergy - petState.energy) * percentSlept * 0.5);
    } else {
      // Full sleep - full energy recovery
      energyRecovered = petState.maxEnergy - petState.energy;
    }

    // Add calculated values to action payload
    action.payload = {
      ...action.payload,
      energyRecovered,
      wasEarlyWake,
    };

    // Update state
    this.stateManager.dispatch(action);

    // Emit event
    this.eventManager.emit({
      type: EventType.PET_AWAKENED,
      payload: action.payload,
      timestamp: Date.now(),
    });

    // Trigger autosave
    this.scheduleAutosave(AutosaveReason.USER_ACTION);

    return { success: true };
  }

  /**
   * Process a game tick (called every 60 seconds)
   */
  tick(): void {
    console.log('Processing game tick...');

    // Dispatch tick action to state
    this.stateManager.dispatch({
      type: ActionType.PROCESS_TICK,
      timestamp: Date.now(),
    });

    // Process care decay if pet exists
    const petState = this.stateManager.getPetState();
    if (petState && !petState.isSleeping) {
      this.processCareDecay();
    }

    // Process other tick-based updates
    this.processTickUpdates();

    // Trigger autosave (immediate for ticks)
    this.triggerAutosave(AutosaveReason.TICK);

    console.log('Game tick processed');
  }

  /**
   * Register a system with the engine
   */
  registerSystem(systemType: SystemType, system: GameSystem): void {
    this.systems.set(systemType, system);
    console.log(`System registered: ${systemType}`);
  }

  /**
   * Get a system by type
   */
  getSystem<T extends GameSystem>(systemType: SystemType): T {
    const system = this.systems.get(systemType);
    if (!system) {
      throw new Error(`System not found: ${systemType}`);
    }
    return system as T;
  }

  /**
   * Schedule an autosave with debouncing for user actions
   * This prevents multiple rapid saves from quick successive actions
   */
  private scheduleAutosave(reason: AutosaveReason): void {
    if (reason === AutosaveReason.TICK || reason === AutosaveReason.SHUTDOWN) {
      // Immediate save for ticks and shutdown
      this.triggerAutosave(reason);
    } else {
      // Debounced save for user actions
      this.pendingAutosave = true;

      if (this.autosaveDebounceTimer) {
        clearTimeout(this.autosaveDebounceTimer);
      }

      this.autosaveDebounceTimer = setTimeout(() => {
        if (this.pendingAutosave) {
          this.triggerAutosave(reason);
          this.pendingAutosave = false;
        }
        this.autosaveDebounceTimer = null;
      }, 1000) as any; // 1 second debounce
    }
  }

  /**
   * Trigger an autosave
   */
  async triggerAutosave(reason: AutosaveReason): Promise<void> {
    try {
      // TODO: Implement actual persistence in phase 1.3
      // For now, just emit the save completed event
      this.eventManager.emit({
        type: EventType.SAVE_COMPLETED,
        payload: { reason },
        timestamp: Date.now(),
      });

      console.log(`Autosave triggered: ${reason}`);
    } catch (error) {
      console.error('Autosave failed:', error);
      this.eventManager.emit({
        type: EventType.SYSTEM_ERROR,
        payload: { system: 'GameEngine', error: 'Autosave failed' },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Check if the game engine is running
   */
  isGameRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Check if the game engine is initialized
   */
  isGameInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get current game state
   */
  getGameState(): GameState {
    return this.stateManager.getState();
  }

  /**
   * Get the EventManager instance
   */
  getEventManager(): EventManager {
    return this.eventManager;
  }

  /**
   * Get the StateManager instance
   */
  getStateManager(): StateManager {
    return this.stateManager;
  }

  /**
   * Get the TimeManager instance
   */
  getTimeManager(): TimeManager {
    return this.timeManager;
  }

  /**
   * Set up event listeners for system coordination
   */
  private setupEventListeners(): void {
    // GameEngine is the orchestrator, not a listener for user actions
    // It only needs to listen for system-level events if needed
    console.log('Event listeners set up');
  }

  /**
   * Set up tick processing
   */
  private setupTickProcessing(): void {
    // Register with time manager to process ticks
    this.tickUnsubscribe = this.timeManager.registerTickHandler(() => {
      this.tick();
    });

    console.log('Tick processing set up');
  }

  /**
   * Handle offline time when the game loads
   */
  private async handleOfflineTime(): Promise<void> {
    const offlineSeconds = this.timeManager.getOfflineTime();

    if (offlineSeconds > 60) {
      // Only process if offline for more than 1 minute
      console.log(`Processing offline time: ${offlineSeconds} seconds`);

      const offlineUpdate = this.timeManager.processOfflineTime(offlineSeconds);

      // Apply offline updates to state
      if (offlineUpdate.ticksProcessed > 0) {
        // Process care decay
        this.stateManager.dispatch({
          type: ActionType.DECAY_CARE,
          payload: offlineUpdate.careDecay,
          timestamp: Date.now(),
        });

        // Add poop spawns
        if (offlineUpdate.poopSpawned > 0) {
          this.stateManager.dispatch({
            type: ActionType.ADD_POOP,
            payload: { amount: offlineUpdate.poopSpawned },
            timestamp: Date.now(),
          });
        }

        // Handle completed sleep
        if (offlineUpdate.sleepCompleted && offlineUpdate.energyRecovered > 0) {
          this.stateManager.dispatch({
            type: ActionType.WAKE_PET,
            payload: { energyRecovered: offlineUpdate.energyRecovered, wasEarlyWake: false },
            timestamp: Date.now(),
          });
        }

        console.log('Offline updates applied:', offlineUpdate);
      }
    }
  }

  /**
   * Process care decay during ticks
   */
  private processCareDecay(): void {
    const petState = this.stateManager.getPetState();
    if (!petState) {
      return;
    }

    // Calculate decay amounts (1 tick per care type per game tick)
    const careDecay = {
      satietyDecay: 1, // 1 tick lost per game tick
      hydrationDecay: 1, // 1 tick lost per game tick
      happinessDecay: 1, // 1 tick lost per game tick
    };

    // Apply decay
    this.stateManager.dispatch({
      type: ActionType.DECAY_CARE,
      payload: careDecay,
      timestamp: Date.now(),
    });

    // Check for low care values and emit warnings
    if (petState.satiety <= 20) {
      this.eventManager.emit({
        type: EventType.SATIETY_LOW,
        payload: { value: petState.satiety },
        timestamp: Date.now(),
      });
    }

    if (petState.hydration <= 20) {
      this.eventManager.emit({
        type: EventType.HYDRATION_LOW,
        payload: { value: petState.hydration },
        timestamp: Date.now(),
      });
    }

    if (petState.happiness <= 20) {
      this.eventManager.emit({
        type: EventType.HAPPINESS_LOW,
        payload: { value: petState.happiness },
        timestamp: Date.now(),
      });
    }

    if (petState.life <= 20) {
      this.eventManager.emit({
        type: EventType.LIFE_CRITICAL,
        payload: { value: petState.life },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Process other tick-based updates
   */
  private processTickUpdates(): void {
    // Random poop spawn check
    const petState = this.stateManager.getPetState();
    if (petState && !petState.isSleeping) {
      // Simple random chance: 1 in 360 chance per tick (roughly once every 6 hours on average)
      if (Math.random() < 1 / 360) {
        this.stateManager.dispatch({
          type: ActionType.ADD_POOP,
          payload: { amount: 1 },
          timestamp: Date.now(),
        });
      }
    }

    // TODO: Add more tick-based processing as needed
  }

  /**
   * Shutdown the game engine and all systems
   */
  async shutdown(): Promise<void> {
    console.log('GameEngine shutdown starting...');

    try {
      // Stop the game engine
      this.stop();

      // Clean up subscriptions
      if (this.tickUnsubscribe) {
        this.tickUnsubscribe();
        this.tickUnsubscribe = null;
      }

      // Clear any pending autosave
      if (this.autosaveDebounceTimer) {
        clearTimeout(this.autosaveDebounceTimer);
        this.autosaveDebounceTimer = null;
      }

      // Trigger final autosave
      await this.triggerAutosave(AutosaveReason.SHUTDOWN);

      // Shutdown all systems in reverse order
      const systemsToShutdown = [
        SystemType.TIME_MANAGER,
        SystemType.STATE_MANAGER,
        SystemType.EVENT_MANAGER,
      ];

      for (const systemType of systemsToShutdown) {
        const system = this.systems.get(systemType);
        if (system && system.shutdown) {
          await system.shutdown();
        }
      }

      // Clear systems map
      this.systems.clear();

      this.isInitialized = false;
      this.isRunning = false;

      // Clear singleton instance
      GameEngine.instance = null;

      console.log('GameEngine shutdown completed');
    } catch (error) {
      console.error('GameEngine shutdown error:', error);
      throw error;
    }
  }
}

// Export convenience functions
export function getGameEngine(): GameEngine {
  return GameEngine.getInstance();
}

// Export the game engine instance for immediate use
export const gameEngine = GameEngine.getInstance();
