/**
 * GameEngine - Central orchestrator for the Digital Pet Game
 * Manages all systems, processes updates, and maintains game state
 */

import { GameUpdatesQueue, type GameUpdateReader } from './GameUpdatesQueue';
import { BaseSystem, isUpdateHandler, type SystemInitOptions } from '../systems/BaseSystem';
import { ConfigSystem } from '../systems/ConfigSystem';
import type { GameState, GameUpdate, OfflineCalculation } from '../models';
import { UPDATE_TYPES, GAME_TICK_INTERVAL } from '../models/constants';

// Import systems
import { PetSystem } from '../systems/PetSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { TimeSystem } from '../systems/TimeSystem';
import { EggSystem } from '../systems/EggSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { LocationSystem } from '../systems/LocationSystem';
import { ActivitySystem } from '../systems/ActivitySystem';
import { BattleSystem } from '../systems/BattleSystem';
import { EventSystem } from '../systems/EventSystem';
import { ShopSystem } from '../systems/ShopSystem';
import { UISystem } from '../systems/UISystem';

/**
 * Engine configuration options
 */
export interface EngineConfig {
  tickInterval?: number; // Milliseconds between ticks (default: 60000 - 60 seconds)
  maxUpdatesPerTick?: number; // Maximum updates to process per tick
  autoStart?: boolean; // Whether to auto-start the game loop
  debugMode?: boolean; // Enable debug logging
}

/**
 * Engine status information
 */
export interface EngineStatus {
  running: boolean;
  tickCount: number;
  updateCount: number;
  lastTickTime: number;
  averageTickTime: number;
  systemStatuses: Record<string, any>;
}

/**
 * Update handler mapping
 */
interface UpdateHandlerMap {
  [updateType: string]: string[]; // Map update type to system names that handle it
}

/**
 * Main GameEngine class
 */
export class GameEngine {
  // Core components
  private readonly updatesQueue: GameUpdatesQueue;
  private readonly updateReader: GameUpdateReader;

  // Systems registry
  private readonly systems: Map<string, BaseSystem>;
  private readonly systemInitOrder: string[];
  private readonly updateHandlers: UpdateHandlerMap;

  // Game state
  private gameState: GameState;
  private previousState: GameState | null = null;

  // Engine state
  private running = false;
  private tickCount = 0;
  private updateCount = 0;
  private lastTickTime = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  // Configuration
  private readonly config: Required<EngineConfig>;
  private readonly configSystem: ConfigSystem;

  // Performance tracking
  private tickTimes: number[] = [];
  private readonly maxTickTimeSamples = 10;

  constructor(config?: EngineConfig) {
    // Initialize configuration with defaults
    this.config = {
      tickInterval: config?.tickInterval ?? GAME_TICK_INTERVAL * 1000, // Convert to ms
      maxUpdatesPerTick: config?.maxUpdatesPerTick ?? 100,
      autoStart: config?.autoStart ?? false,
      debugMode: config?.debugMode ?? false,
    };

    // Initialize core components
    this.updatesQueue = new GameUpdatesQueue();
    this.updateReader = this.updatesQueue.createReader();

    // Initialize systems registry
    this.systems = new Map();
    this.systemInitOrder = [];
    this.updateHandlers = this.createUpdateHandlerMap();

    // Initialize config system
    this.configSystem = new ConfigSystem(this.updatesQueue.createWriter('ConfigSystem'));

    // Initialize default game state
    this.gameState = this.createDefaultGameState();

    if (this.config.debugMode) {
      console.log('[GameEngine] Initialized with config:', this.config);
    }
  }

  /**
   * Initialize the game engine and all systems
   */
  public async initialize(): Promise<void> {
    if (this.config.debugMode) {
      console.log('[GameEngine] Starting initialization...');
    }

    try {
      // Initialize all systems
      await this.initializeAllSystems();

      // Load saved game state if available
      await this.loadGameState();

      // Process any offline time
      await this.processOfflineTime();

      if (this.config.autoStart) {
        await this.start();
      }

      if (this.config.debugMode) {
        console.log('[GameEngine] Initialization complete');
      }
    } catch (error) {
      console.error('[GameEngine] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start the game engine
   */
  public async start(): Promise<void> {
    if (this.running) {
      console.warn('[GameEngine] Already running');
      return;
    }

    if (this.config.debugMode) {
      console.log('[GameEngine] Starting engine...');
    }

    this.running = true;
    this.lastTickTime = Date.now();

    // Start the game loop
    this.startGameLoop();

    // Queue initial game tick
    this.queueGameTick();
  }

  /**
   * Stop the game engine
   */
  public async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    if (this.config.debugMode) {
      console.log('[GameEngine] Stopping engine...');
    }

    this.running = false;

    // Stop the game loop
    this.stopGameLoop();

    // Save game state
    await this.saveGameState();

    // Shutdown all systems
    await this.shutdownAllSystems();
  }

  /**
   * Process one game tick
   */
  public async tick(): Promise<void> {
    if (!this.running) {
      return;
    }

    const tickStartTime = performance.now();
    const currentTime = Date.now();
    const deltaTime = currentTime - this.lastTickTime;

    try {
      // Increment tick count first
      this.tickCount++;

      // Process queued updates
      await this.processUpdates();

      // Tick all active systems
      await this.tickAllSystems(deltaTime);

      // Update game state
      this.updateGameState();

      // Auto-save if needed
      if (this.tickCount % 1 === 0) {
        // Save every tick
        await this.saveGameState();
      }

      this.lastTickTime = currentTime;

      // Track performance
      const tickTime = performance.now() - tickStartTime;
      this.trackTickTime(tickTime);

      if (this.config.debugMode && this.tickCount % 10 === 0) {
        console.log(`[GameEngine] Tick ${this.tickCount} completed in ${tickTime.toFixed(2)}ms`);
      }
    } catch (error) {
      console.error('[GameEngine] Error during tick:', error);
      // Don't stop the engine on tick errors
    }
  }

  /**
   * Register a system with the engine
   */
  public registerSystem(name: string, system: BaseSystem): void {
    if (this.systems.has(name)) {
      throw new Error(`System ${name} is already registered`);
    }

    this.systems.set(name, system);
    this.systemInitOrder.push(name);

    // Check if system handles updates
    if (isUpdateHandler(system)) {
      this.registerUpdateHandler(name, system);
    }

    if (this.config.debugMode) {
      console.log(`[GameEngine] Registered system: ${name}`);
    }
  }

  /**
   * Get a system by name
   */
  public getSystem<T extends BaseSystem>(name: string): T | undefined {
    return this.systems.get(name) as T | undefined;
  }

  /**
   * Get the current game state
   */
  public getGameState(): GameState {
    return this.gameState;
  }

  /**
   * Get engine status
   */
  public getStatus(): EngineStatus {
    const systemStatuses: Record<string, any> = {};

    for (const [name, system] of this.systems) {
      systemStatuses[name] = system.getStatus();
    }

    return {
      running: this.running,
      tickCount: this.tickCount,
      updateCount: this.updateCount,
      lastTickTime: this.lastTickTime,
      averageTickTime: this.getAverageTickTime(),
      systemStatuses,
    };
  }

  // Private methods

  /**
   * Create the default game state
   */
  private createDefaultGameState(): GameState {
    // Get config values for inventory and settings
    const limits = this.configSystem.getLimits();
    const defaultSettings = this.configSystem.getDefaultSettings();

    return {
      version: '1.0.0',
      timestamp: Date.now(),
      playerId: this.generatePlayerId(),
      pet: null,
      inventory: {
        items: [],
        currency: {
          coins: 0,
        },
        maxSlots: limits.maxInventorySlots,
        unlockedSlots: 20, // Keep this hard-coded as it's user progression, not config
      },
      world: {
        currentLocation: {
          currentLocationId: 'main_city',
          traveling: false,
          inActivity: false,
          visitedLocations: ['main_city'],
          lastVisitTimes: {
            main_city: Date.now(),
          },
        },
        activeTimers: [],
        eventParticipation: [],
        currentEvents: [],
        worldTime: Date.now(),
        lastTickTime: Date.now(),
        tickCount: 0,
      },
      collections: {
        eggs: [],
        species: {},
        memorials: [],
      },
      meta: {
        settings: {
          ...defaultSettings,
        },
        tutorialProgress: {
          completed: [],
          skipped: false,
          milestones: {
            firstFeed: false,
            firstDrink: false,
            firstPlay: false,
            firstClean: false,
            firstSleep: false,
            firstActivity: false,
            firstBattle: false,
            firstShop: false,
            firstTravel: false,
            firstTraining: false,
          },
        },
        statistics: {
          firstPlayTime: Date.now(),
          totalPlayTime: 0,
          lastPlayTime: Date.now(),
          consecutiveDays: 0,
          totalPetsOwned: 0,
          totalPetsLost: 0,
          currentPetAge: 0,
          longestPetLife: 0,
          totalFeedings: 0,
          totalDrinks: 0,
          totalPlays: 0,
          totalCleanings: 0,
          activitiesCompleted: {},
          totalItemsCollected: 0,
          totalCurrencyEarned: 0,
          totalCurrencySpent: 0,
          battleStats: {
            totalBattles: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            flees: 0,
            totalDamageDealt: 0,
            totalDamageTaken: 0,
            totalHealing: 0,
            criticalHits: 0,
            movesUsed: {},
            longestBattle: 0,
            shortestVictory: 0,
            highestDamage: 0,
            mostConsecutiveWins: 0,
            byType: {},
          },
          speciesDiscovered: 0,
          totalSpecies: 0,
          itemsDiscovered: 0,
          totalItems: 0,
          locationsVisited: 0,
          totalTravelDistance: 0,
        },
      },
      saveData: {
        lastSaveTime: Date.now(),
        autoSaveEnabled: true,
        saveCount: 0,
        backupSlots: {},
      },
    };
  }

  /**
   * Generate a unique player ID
   */
  private generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create the update handler map
   */
  private createUpdateHandlerMap(): UpdateHandlerMap {
    return {
      [UPDATE_TYPES.USER_ACTION]: [
        'PetSystem',
        'InventorySystem',
        'LocationSystem',
        'EggSystem',
        'ShopSystem',
        'ActivitySystem',
      ],
      [UPDATE_TYPES.GAME_TICK]: [
        'TimeSystem',
        'PetSystem',
        'EggSystem',
        'EventSystem',
        'ActivitySystem',
      ],
      [UPDATE_TYPES.ACTIVITY_COMPLETE]: ['ActivitySystem', 'InventorySystem', 'PetSystem'],
      [UPDATE_TYPES.BATTLE_ACTION]: ['BattleSystem', 'PetSystem'],
      [UPDATE_TYPES.EVENT_TRIGGER]: ['EventSystem', 'ActivitySystem'],
      [UPDATE_TYPES.STATE_TRANSITION]: ['GameEngine', 'PetSystem', 'EggSystem', 'LocationSystem'],
    };
  }

  /**
   * Initialize a system
   */
  private async initializeSystem(name: string, system: BaseSystem): Promise<void> {
    // Get tuning values from ConfigSystem
    const tuningValues = this.configSystem.getTuningValues();

    const initOptions: SystemInitOptions = {
      tuning: tuningValues,
      config: {
        // Pass any system-specific config
        [name.toLowerCase()]: await this.configSystem.get(name.toLowerCase()),
      },
    };

    await system.initialize(initOptions);

    if (this.config.debugMode) {
      console.log(`[GameEngine] Initialized system: ${name}`);
    }
  }

  /**
   * Initialize all systems
   */
  private async initializeAllSystems(): Promise<void> {
    // Initialize systems in dependency order

    // 0. ConfigSystem (no dependencies)
    this.registerSystem('ConfigSystem', this.configSystem);
    await this.initializeSystem('ConfigSystem', this.configSystem);

    // 1. SaveSystem (no dependencies)
    const saveSystem = new SaveSystem();
    this.registerSystem('SaveSystem', saveSystem);
    await this.initializeSystem('SaveSystem', saveSystem);

    // 2. TimeSystem (depends on ConfigSystem)
    const timeSystem = new TimeSystem(this.updatesQueue.createWriter('TimeSystem'));
    this.registerSystem('TimeSystem', timeSystem);
    await this.initializeSystem('TimeSystem', timeSystem);

    // 3. PetSystem (depends on ConfigSystem)
    const petSystem = new PetSystem(this.updatesQueue.createWriter('PetSystem'));
    this.registerSystem('PetSystem', petSystem);
    await this.initializeSystem('PetSystem', petSystem);

    // 4. EggSystem (depends on ConfigSystem and PetSystem)
    const eggSystem = new EggSystem(this.updatesQueue.createWriter('EggSystem'));
    this.registerSystem('EggSystem', eggSystem);
    await this.initializeSystem('EggSystem', eggSystem);

    // 5. InventorySystem (depends on ConfigSystem)
    const inventorySystem = new InventorySystem(this.updatesQueue.createWriter('InventorySystem'));
    this.registerSystem('InventorySystem', inventorySystem);
    await this.initializeSystem('InventorySystem', inventorySystem);

    // 6. LocationSystem (depends on ConfigSystem)
    const locationSystem = new LocationSystem(this.updatesQueue.createWriter('LocationSystem'));
    this.registerSystem('LocationSystem', locationSystem);
    await this.initializeSystem('LocationSystem', locationSystem);

    // 7. ActivitySystem (depends on ConfigSystem, LocationSystem, InventorySystem)
    const activitySystem = new ActivitySystem(this.updatesQueue.createWriter('ActivitySystem'));
    this.registerSystem('ActivitySystem', activitySystem);
    await this.initializeSystem('ActivitySystem', activitySystem);

    // 8. BattleSystem (depends on ConfigSystem, PetSystem)
    const battleSystem = new BattleSystem(this.updatesQueue.createWriter('BattleSystem'));
    this.registerSystem('BattleSystem', battleSystem);
    await this.initializeSystem('BattleSystem', battleSystem);

    // 9. EventSystem (depends on ConfigSystem)
    const eventSystem = new EventSystem(this.updatesQueue.createWriter('EventSystem'));
    this.registerSystem('EventSystem', eventSystem);
    await this.initializeSystem('EventSystem', eventSystem);

    // 10. ShopSystem (depends on ConfigSystem, InventorySystem)
    const shopSystem = new ShopSystem(this.updatesQueue.createWriter('ShopSystem'));
    this.registerSystem('ShopSystem', shopSystem);
    await this.initializeSystem('ShopSystem', shopSystem);

    // 11. UISystem (depends on ConfigSystem)
    const uiSystem = new UISystem(this.updatesQueue.createWriter('UISystem'));
    this.registerSystem('UISystem', uiSystem);
    await this.initializeSystem('UISystem', uiSystem);

    if (this.config.debugMode) {
      console.log('[GameEngine] All systems initialized');
    }
  }

  /**
   * Shutdown all systems
   */
  private async shutdownAllSystems(): Promise<void> {
    // Shutdown in reverse order
    const shutdownOrder = [...this.systemInitOrder].reverse();

    for (const name of shutdownOrder) {
      const system = this.systems.get(name);
      if (system) {
        await system.shutdown();
        if (this.config.debugMode) {
          console.log(`[GameEngine] Shutdown system: ${name}`);
        }
      }
    }
  }

  /**
   * Register a system as an update handler
   */
  private registerUpdateHandler(name: string, system: any): void {
    // Add to relevant update type handlers
    for (const updateType of Object.values(UPDATE_TYPES)) {
      if (system.canHandleUpdate(updateType)) {
        if (!this.updateHandlers[updateType]) {
          this.updateHandlers[updateType] = [];
        }
        if (!this.updateHandlers[updateType].includes(name)) {
          this.updateHandlers[updateType].push(name);
        }
      }
    }
  }

  /**
   * Start the game loop
   */
  private startGameLoop(): void {
    if (this.tickTimer) {
      return;
    }

    this.tickTimer = setInterval(() => {
      this.tick().catch((error) => {
        console.error('[GameEngine] Game loop error:', error);
      });
    }, this.config.tickInterval);
  }

  /**
   * Stop the game loop
   */
  private stopGameLoop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  /**
   * Queue a game tick update
   */
  private queueGameTick(): void {
    this.updatesQueue.enqueue({
      type: UPDATE_TYPES.GAME_TICK,
      payload: {
        data: {
          tick: this.tickCount,
          timestamp: Date.now(),
        },
      },
    });
  }

  /**
   * Process queued updates
   */
  private async processUpdates(): Promise<void> {
    let processedCount = 0;

    while (!this.updateReader.isEmpty() && processedCount < this.config.maxUpdatesPerTick) {
      const update = this.updateReader.dequeue();

      if (update) {
        await this.processUpdate(update);
        processedCount++;
        this.updateCount++;
      }
    }

    if (this.config.debugMode && processedCount > 0) {
      console.log(`[GameEngine] Processed ${processedCount} updates`);
    }
  }

  /**
   * Process a single update
   */
  private async processUpdate(update: GameUpdate): Promise<void> {
    try {
      // Get systems that handle this update type
      const handlers = this.updateHandlers[update.type] || [];

      for (const systemName of handlers) {
        const system = this.systems.get(systemName);

        if (system && isUpdateHandler(system)) {
          const newState = await system.handleUpdate(update, this.gameState);

          if (newState) {
            this.previousState = this.gameState;
            this.gameState = newState;
          }
        }
      }
    } catch (error) {
      console.error(`[GameEngine] Error processing update:`, error, update);

      // Try to requeue if retryable
      if (update.retryable) {
        this.updatesQueue.requeueForRetry(update);
      }
    }
  }

  /**
   * Tick all active systems
   */
  private async tickAllSystems(deltaTime: number): Promise<void> {
    for (const system of this.systems.values()) {
      if (system.isInitialized() && system.isActive()) {
        await system.tick(deltaTime, this.gameState);
      }
    }
  }

  /**
   * Update the game state
   */
  private updateGameState(): void {
    // Update world time
    this.gameState.world.worldTime = Date.now();
    this.gameState.world.lastTickTime = this.lastTickTime;
    this.gameState.world.tickCount = this.tickCount;

    // Update timestamp
    this.gameState.timestamp = Date.now();
  }

  /**
   * Load saved game state
   */
  private async loadGameState(): Promise<void> {
    const saveSystem = this.systems.get('SaveSystem') as SaveSystem | undefined;
    const uiSystem = this.systems.get('UISystem') as UISystem | undefined;

    if (!saveSystem) {
      console.warn('[GameEngine] SaveSystem not available, using default state');
      return;
    }

    try {
      if (this.config.debugMode) {
        console.log('[GameEngine] Loading game state...');
      }

      const loadedState = await saveSystem.load();

      if (loadedState) {
        this.gameState = loadedState;

        if (this.config.debugMode) {
          console.log('[GameEngine] Game state loaded successfully');
        }

        // Render the loaded state to UI
        if (uiSystem && uiSystem.isInitialized()) {
          uiSystem.renderState(this.gameState, true); // Force render on load
        }
      } else {
        if (this.config.debugMode) {
          console.log('[GameEngine] No save found, using default state');
        }

        // Also render the default state to UI so it can show starter selection
        if (uiSystem && uiSystem.isInitialized()) {
          uiSystem.renderState(this.gameState, true); // Force render default state
        }
      }
    } catch (error) {
      console.error('[GameEngine] Failed to load game state:', error);
      // Use default state on load failure
    }
  }

  /**
   * Save current game state
   * Implements pessimistic saving - UI is only updated after successful save
   */
  private async saveGameState(): Promise<void> {
    const saveSystem = this.systems.get('SaveSystem') as SaveSystem | undefined;
    const uiSystem = this.systems.get('UISystem') as UISystem | undefined;

    if (!saveSystem) {
      console.error('[GameEngine] SaveSystem not available');
      return;
    }

    try {
      // Update save data before saving
      this.gameState.saveData.lastSaveTime = Date.now();
      this.gameState.saveData.saveCount++;

      // Attempt to save the game state
      await saveSystem.save(this.gameState);

      if (this.config.debugMode && this.tickCount % 10 === 0) {
        console.log('[GameEngine] Game state saved successfully');
      }

      // PESSIMISTIC SAVING: Only render to UI after successful save
      if (uiSystem && uiSystem.isInitialized()) {
        uiSystem.renderState(this.gameState);
      }
    } catch (error) {
      console.error('[GameEngine] Failed to save game state:', error);

      // Notify UI of save failure if available
      if (uiSystem && uiSystem.isInitialized()) {
        uiSystem.showNotification({
          type: 'SAVE_FAILURE',
          title: 'Save Failed',
          message: 'Failed to save game. Your progress may be lost.',
          severity: 'error',
          timestamp: Date.now(),
        });
      }

      // Don't throw - allow game to continue but log the error
      this.handleSystemError('SaveSystem', error as Error);
    }
  }

  /**
   * Process offline time
   */
  private async processOfflineTime(): Promise<void> {
    if (this.config.debugMode) {
      console.log('[GameEngine] Processing offline time...');
    }

    // Get last save timestamp
    const lastSave = this.gameState.saveData.lastSaveTime;
    const timeSystem = this.systems.get('TimeSystem') as TimeSystem | undefined;

    if (!timeSystem) {
      return;
    }

    // Calculate how many ticks occurred while the game was offline
    const offlineTicks = timeSystem.calculateOfflineTicks(lastSave);

    if (offlineTicks <= 0) {
      return;
    }

    // Let TimeSystem process the offline ticks to advance its counters
    await timeSystem.processOfflineTicks(offlineTicks);

    const offlineTimeSeconds = Math.floor((Date.now() - lastSave) / 1000);

    const offlineCalc: OfflineCalculation = {
      offlineTime: offlineTimeSeconds,
      ticksToProcess: offlineTicks,
      careDecay: { satiety: 0, hydration: 0, happiness: 0, life: 0 },
      poopSpawned: 0,
      sicknessTriggered: false,
      completedActivities: [],
      travelCompleted: false,
      eggsHatched: [],
      expiredEvents: [],
      energyRecovered: 0,
      petDied: false,
    };

    // Process offline effects for each system
    const petSystem = this.systems.get('PetSystem') as PetSystem | undefined;
    if (petSystem) {
      await petSystem.processOfflineSleep(offlineCalc, this.gameState);
      await petSystem.processOfflineCareDecay(offlineCalc, this.gameState);
    }

    const locationSystem = this.systems.get('LocationSystem') as LocationSystem | undefined;
    if (locationSystem) {
      await locationSystem.processOfflineTravel(offlineCalc, this.gameState);
    }

    const activitySystem = this.systems.get('ActivitySystem') as ActivitySystem | undefined;
    if (activitySystem) {
      await activitySystem.processOfflineActivities(offlineCalc, this.gameState);
    }

    const eggSystem = this.systems.get('EggSystem') as EggSystem | undefined;
    if (eggSystem) {
      await eggSystem.processOfflineIncubation(offlineCalc, this.gameState);
    }

    // Save after applying offline progress
    await this.saveGameState();
  }

  /**
   * Track tick execution time
   */
  private trackTickTime(time: number): void {
    this.tickTimes.push(time);

    if (this.tickTimes.length > this.maxTickTimeSamples) {
      this.tickTimes.shift();
    }
  }

  /**
   * Get average tick time
   */
  private getAverageTickTime(): number {
    if (this.tickTimes.length === 0) {
      return 0;
    }

    const sum = this.tickTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.tickTimes.length;
  }

  /**
   * Handle a system error
   */
  public handleSystemError(systemName: string, error: Error): void {
    console.error(`[GameEngine] System error in ${systemName}:`, error);

    // Could implement recovery strategies here
    // For now, just log
  }

  /**
   * Update tuning values for all systems
   * Called when configuration changes
   */
  public updateSystemTuning(): void {
    const newTuning = this.configSystem.getTuningValues();

    // Update all systems with new tuning values
    for (const [name, system] of this.systems) {
      system.updateTuning(newTuning);

      if (this.config.debugMode) {
        console.log(`[GameEngine] Updated tuning for system: ${name}`);
      }
    }
  }

  /**
   * Handle configuration changes
   * Called by ConfigSystem when configuration is updated
   */
  public onConfigurationChanged(): void {
    if (this.config.debugMode) {
      console.log('[GameEngine] Configuration changed, updating systems...');
    }

    // Update all systems with new tuning values
    this.updateSystemTuning();

    // Queue a configuration change update
    if (this.updatesQueue) {
      const update = {
        id: `config-change-${Date.now()}`,
        type: UPDATE_TYPES.STATE_TRANSITION,
        timestamp: Date.now(),
        payload: {
          action: 'CONFIG_CHANGED',
          data: {
            timestamp: Date.now(),
          },
        },
      };
      // Use the queue's internal method to add update
      this.updatesQueue.enqueue(update);
    }
  }
}

/**
 * Factory function to create a new GameEngine
 */
export function createGameEngine(config?: EngineConfig): GameEngine {
  return new GameEngine(config);
}
