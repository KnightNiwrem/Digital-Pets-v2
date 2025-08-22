import type { GameSystem, GameState, GameAction, Unsubscribe, GameEvent } from '../types';
import { EventWriter } from './EventWriter';
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
import { PersistenceManager } from './PersistenceManager';

/**
 * GameEngine is the ultimate central orchestrator that manages the game.
 * All control flow goes through GameEngine - systems cannot communicate directly.
 * 
 * Key architectural principles:
 * 1. Systems are pure, isolated entities with no cross-references
 * 2. GameEngine provides write-only event interfaces to systems
 * 3. All events are processed sequentially from the queue
 * 4. GameEngine invokes systems with state and collects results
 * 5. No concurrent event processing to prevent race conditions
 */
export class GameEngine implements GameSystem {
  private static instance: GameEngine | null = null;

  // Core managers owned by GameEngine
  private eventManager: EventManager;
  private stateManager: StateManager;
  private timeManager: TimeManager;
  private persistenceManager: PersistenceManager;

  // Event writer for internal use
  private eventWriter: EventWriter;

  // System registry (for future pure systems)
  private systems: Map<SystemType, GameSystem> = new Map();

  // Engine state
  private isRunning = false;
  private isInitialized = false;
  private isProcessingEvents = false;
  private eventProcessingInterval: number | null = null;

  // Tick management
  private tickUnsubscribe: Unsubscribe | null = null;
  private autosaveDebounceTimer: number | null = null;
  private pendingAutosave = false;

  private constructor(initialState?: Partial<GameState>) {
    // Initialize core systems - these are owned by GameEngine
    this.eventManager = new EventManager();
    this.stateManager = new StateManager(initialState);
    this.timeManager = new TimeManager();
    this.persistenceManager = new PersistenceManager();

    // Set state manager reference for persistence
    this.persistenceManager.setStateManager(this.stateManager);

    // Create event writer for internal use
    this.eventWriter = this.eventManager.createEventWriter();

    // Register core systems (for compatibility during refactoring)
    this.systems.set(SystemType.EVENT_MANAGER, this.eventManager);
    this.systems.set(SystemType.STATE_MANAGER, this.stateManager);
    this.systems.set(SystemType.TIME_MANAGER, this.timeManager);
    this.systems.set(SystemType.PERSISTENCE_MANAGER, this.persistenceManager);

    // NO CROSS-SYSTEM REFERENCES! Systems are isolated
    // Previous problematic lines 49-52 have been removed
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
      await this.persistenceManager.initialize();

      // Try to load existing save data
      try {
        const savedState = await this.loadGameState();
        // If we have a saved state, restore it
        if (savedState) {
          this.stateManager.restoreSnapshot({
            state: savedState,
            timestamp: Date.now(),
            checksum: this.persistenceManager['saveManager'].generateChecksum(savedState),
          });
          console.log('Game state restored from save');
        }
      } catch (error) {
        console.log('No existing save data found or load failed:', error);
      }

      // Process offline time if any
      await this.handleOfflineTime();

      // Set up tick processing
      this.setupTickProcessing();

      // Start event processing loop
      this.startEventProcessing();

      this.isInitialized = true;

      // Write system initialized event
      this.eventWriter.writeEvent({
        type: EventType.SYSTEM_INITIALIZED,
        payload: { system: 'GameEngine' },
        timestamp: Date.now(),
      });

      console.log('GameEngine initialization completed');
    } catch (error) {
      console.error('GameEngine initialization failed:', error);

      this.eventWriter.writeEvent({
        type: EventType.SYSTEM_ERROR,
        payload: { system: 'GameEngine', error: String(error) },
        timestamp: Date.now(),
      });

      throw error;
    }
  }

  /**
   * Start the sequential event processing loop
   */
  private startEventProcessing(): void {
    if (this.eventProcessingInterval !== null) {
      return;
    }

    // Process events every 10ms (100 times per second max)
    // This is still efficient as it only processes if there are events
    this.eventProcessingInterval = setInterval(() => {
      this.processEventQueue();
    }, 10) as any;

    console.log('Event processing loop started');
  }

  /**
   * Stop the event processing loop
   */
  private stopEventProcessing(): void {
    if (this.eventProcessingInterval !== null) {
      clearInterval(this.eventProcessingInterval);
      this.eventProcessingInterval = null;
      console.log('Event processing loop stopped');
    }
  }

  /**
   * Process events from the queue sequentially
   */
  private processEventQueue(): void {
    // Prevent concurrent processing
    if (this.isProcessingEvents || !this.eventManager.hasEvents()) {
      return;
    }

    this.isProcessingEvents = true;

    try {
      // Process up to 10 events per cycle to prevent blocking
      let eventsProcessed = 0;
      const maxEventsPerCycle = 10;

      while (this.eventManager.hasEvents() && eventsProcessed < maxEventsPerCycle) {
        const event = this.eventManager.dequeueEvent();
        if (!event) break;

        this.processEvent(event);
        eventsProcessed++;
      }
    } finally {
      this.isProcessingEvents = false;
    }
  }

  /**
   * Process a single event
   */
  private processEvent(event: GameEvent): void {
    try {
      // Handle different event types
      switch (event.type) {
        case EventType.TICK:
          this.handleTickEvent();
          break;
        
        case EventType.USER_ACTION:
          this.handleUserActionEvent(event.payload);
          break;

        case EventType.SYSTEM_INITIALIZED:
        case EventType.SYSTEM_ERROR:
        case EventType.STATE_UPDATED:
        case EventType.SAVE_COMPLETED:
          // System events - log for debugging
          console.log(`System event: ${event.type}`, event.payload);
          break;

        case EventType.PET_CREATED:
        case EventType.PET_FED:
        case EventType.PET_DRANK:
        case EventType.PET_PLAYED:
        case EventType.PET_SLEPT:
        case EventType.PET_AWAKENED:
          // Pet events - these might trigger UI updates
          this.handlePetEvent(event);
          break;

        case EventType.SATIETY_LOW:
        case EventType.HYDRATION_LOW:
        case EventType.HAPPINESS_LOW:
        case EventType.LIFE_CRITICAL:
          // Warning events - might trigger notifications
          this.handleWarningEvent(event);
          break;

        default:
          console.warn(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error(`Error processing event ${event.type}:`, error);
    }
  }

  /**
   * Handle tick events
   */
  private handleTickEvent(): void {
    // Tick events are now processed synchronously in the tick() method
    // This handler is kept for future use when we might process tick events asynchronously
    console.log('Tick event received (already processed synchronously)');
  }

  /**
   * Handle user action events
   */
  private handleUserActionEvent(action: GameAction): void {
    // Process the action through the existing processUserAction method
    this.processUserAction(action).then(result => {
      if (!result.success) {
        console.error('User action failed:', result.error);
      }
    });
  }

  /**
   * Handle pet-related events
   */
  private handlePetEvent(event: GameEvent): void {
    // These events are informational - they've already affected state
    // Could trigger UI updates or notifications here
    console.log(`Pet event: ${event.type}`, event.payload);
  }

  /**
   * Handle warning events
   */
  private handleWarningEvent(event: GameEvent): void {
    // Could trigger UI notifications here
    console.warn(`Warning: ${event.type}`, event.payload);
  }

  /**
   * Get a write-only event interface for systems
   */
  getEventWriter(): EventWriter {
    return this.eventManager.createEventWriter();
  }

  /**
   * Load game state from persistence
   */
  async loadGameState(): Promise<GameState> {
    try {
      return await this.persistenceManager.load();
    } catch (error) {
      console.error('Failed to load game state:', error);
      // Return current state as fallback
      return this.stateManager.getState();
    }
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
   * Process a game tick (called every 60 seconds)
   */
  tick(): void {
    // For ticks, we process synchronously to maintain compatibility with tests
    // and ensure immediate state updates
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
   * Force immediate processing of all queued events
   * This is primarily for testing purposes
   */
  flushEventQueue(): void {
    while (this.eventManager.hasEvents()) {
      this.processEventQueue();
    }
  }

  /**
   * Central entry point for all user actions
   */
  async processUserAction(action: GameAction): Promise<{ success: boolean; error?: string }> {
    // Write user action event to queue
    this.eventWriter.writeEvent({
      type: EventType.USER_ACTION,
      payload: action,
      timestamp: Date.now(),
    });

    // For now, process synchronously for compatibility
    // In future, this could return immediately and process async
    return this.executeAction(action);
  }

  /**
   * Execute an action synchronously
   */
  private async executeAction(action: GameAction): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate the action
      const validation = this.validateAction(action);
      if (!validation.valid) {
        return { success: false, error: validation.error || 'Validation failed' };
      }

      // Process through appropriate handlers
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
    } catch (error) {
      console.error('Action execution error:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Create a starter pet (convenience method)
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
      satiety: 80,
      hydration: 80,
      happiness: 80,
      satietyTicks: 80 * 20,
      hydrationTicks: 80 * 15,
      happinessTicks: 80 * 30,
      life: 100,
      energy: 50,
      maxEnergy: 50,
      isSleeping: false,
      sleepStartTime: null,
      poopCount: 0,
      statuses: [],
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
      stageStartTime: now,
      canAdvanceStage: false,
    };

    return this.executeAction({
      type: ActionType.CREATE_PET,
      payload: starterPet,
      timestamp: now,
    });
  }

  /**
   * Validate an action before processing
   */
  private validateAction(action: GameAction): { valid: boolean; error?: string } {
    if (!action.type) {
      return { valid: false, error: 'Action type is required' };
    }

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

    // Write event
    this.eventWriter.writeEvent({
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

    // Update state
    this.stateManager.dispatch(action);

    // Write event
    this.eventWriter.writeEvent({
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

    // Write event
    this.eventWriter.writeEvent({
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
  private async handlePlayWithPet(action: GameAction): Promise<{ success: boolean; error?: string }> {
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

    // Write event
    this.eventWriter.writeEvent({
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
  private async handleStartSleep(action: GameAction): Promise<{ success: boolean; error?: string }> {
    const petState = this.stateManager.getPetState();
    if (!petState) {
      return { success: false, error: 'No active pet' };
    }

    if (petState.isSleeping) {
      return { success: false, error: 'Pet is already sleeping' };
    }

    // Update state
    this.stateManager.dispatch(action);

    // Write event
    this.eventWriter.writeEvent({
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

    // Calculate energy recovery
    const now = Date.now();
    const sleepDuration = petState.sleepStartTime ? now - petState.sleepStartTime : 0;
    const maxSleepTime = 8 * 60 * 60 * 1000; // 8 hours
    const wasEarlyWake = sleepDuration < maxSleepTime;

    let energyRecovered = 0;
    if (wasEarlyWake) {
      const percentSlept = sleepDuration / maxSleepTime;
      energyRecovered = Math.floor((petState.maxEnergy - petState.energy) * percentSlept * 0.5);
    } else {
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

    // Write event
    this.eventWriter.writeEvent({
      type: EventType.PET_AWAKENED,
      payload: action.payload,
      timestamp: Date.now(),
    });

    // Trigger autosave
    this.scheduleAutosave(AutosaveReason.USER_ACTION);

    return { success: true };
  }

  /**
   * Process care decay during ticks
   */
  private processCareDecay(): void {
    const petState = this.stateManager.getPetState();
    if (!petState) {
      return;
    }

    // Calculate decay amounts
    const careDecay = {
      satietyDecay: 1,
      hydrationDecay: 1,
      happinessDecay: 1,
    };

    // Apply decay
    this.stateManager.dispatch({
      type: ActionType.DECAY_CARE,
      payload: careDecay,
      timestamp: Date.now(),
    });

    // Check for low care values and write warning events
    if (petState.satiety <= 20) {
      this.eventWriter.writeEvent({
        type: EventType.SATIETY_LOW,
        payload: { value: petState.satiety },
        timestamp: Date.now(),
      });
    }

    if (petState.hydration <= 20) {
      this.eventWriter.writeEvent({
        type: EventType.HYDRATION_LOW,
        payload: { value: petState.hydration },
        timestamp: Date.now(),
      });
    }

    if (petState.happiness <= 20) {
      this.eventWriter.writeEvent({
        type: EventType.HAPPINESS_LOW,
        payload: { value: petState.happiness },
        timestamp: Date.now(),
      });
    }

    if (petState.life <= 20) {
      this.eventWriter.writeEvent({
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
    const petState = this.stateManager.getPetState();
    if (petState && !petState.isSleeping) {
      // Random poop spawn check
      if (Math.random() < 1 / 360) {
        this.stateManager.dispatch({
          type: ActionType.ADD_POOP,
          payload: { amount: 1 },
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * Handle offline time when the game loads
   */
  private async handleOfflineTime(): Promise<void> {
    const offlineSeconds = this.timeManager.getOfflineTime();

    if (offlineSeconds > 60) {
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
   * Schedule an autosave with debouncing for user actions
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
      // Perform autosave through persistence manager
      await this.persistenceManager.autosave(reason);

      // Write the save completed event
      this.eventWriter.writeEvent({
        type: EventType.SAVE_COMPLETED,
        payload: { reason },
        timestamp: Date.now(),
      });

      console.log(`Autosave triggered: ${reason}`);
    } catch (error) {
      console.error('Autosave failed:', error);
      this.eventWriter.writeEvent({
        type: EventType.SYSTEM_ERROR,
        payload: { system: 'GameEngine', error: 'Autosave failed' },
        timestamp: Date.now(),
      });
    }
  }

  // Compatibility methods (will be removed in future)

  /**
   * @deprecated Use systems through invocation methods instead
   */
  registerSystem(systemType: SystemType, system: GameSystem): void {
    console.warn('registerSystem is deprecated - systems should be invoked through GameEngine');
    this.systems.set(systemType, system);
  }

  /**
   * @deprecated Systems should not directly access each other
   */
  getSystem<T extends GameSystem>(systemType: SystemType): T {
    console.warn('getSystem is deprecated - systems should not directly access each other');
    const system = this.systems.get(systemType);
    if (!system) {
      throw new Error(`System not found: ${systemType}`);
    }
    return system as T;
  }

  // Public getters for current refactoring phase

  isGameRunning(): boolean {
    return this.isRunning;
  }

  isGameInitialized(): boolean {
    return this.isInitialized;
  }

  getGameState(): GameState {
    return this.stateManager.getState();
  }

  getEventManager(): EventManager {
    return this.eventManager;
  }

  getStateManager(): StateManager {
    return this.stateManager;
  }

  getTimeManager(): TimeManager {
    return this.timeManager;
  }

  pause(): void {
    if (this.isRunning) {
      this.stop();
      console.log('Game paused');
    }
  }

  resume(): void {
    if (this.isInitialized && !this.isRunning) {
      this.start();
      console.log('Game resumed');
    }
  }

  /**
   * Shutdown the game engine and all systems
   */
  async shutdown(): Promise<void> {
    console.log('GameEngine shutdown starting...');

    try {
      // Stop the game engine
      this.stop();

      // Stop event processing
      this.stopEventProcessing();

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
      await this.persistenceManager.shutdown();
      await this.timeManager.shutdown();
      await this.stateManager.shutdown();
      await this.eventManager.shutdown();

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
