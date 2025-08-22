/**
 * GameEngine - Central orchestrator for the Digital Pet Game
 * Manages all systems, processes updates, and maintains game state
 */

import { GameUpdatesQueue, type GameUpdateReader } from './GameUpdatesQueue';
import { BaseSystem, isUpdateHandler, type SystemInitOptions } from '../systems/BaseSystem';
import { ConfigSystem } from '../systems/ConfigSystem';
import type { GameState, GameUpdate } from '../models';
import { UPDATE_TYPES, GAME_TICK_INTERVAL } from '../models/constants';

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
  paused: boolean;
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
  private paused = false;
  private tickCount = 0;
  private updateCount = 0;
  private lastTickTime = 0;
  private tickTimer: NodeJS.Timeout | null = null;

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

    // Initialize config system (special case - always first)
    this.configSystem = new ConfigSystem();

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
      // Initialize config system first (special case - doesn't extend BaseSystem yet)
      // We'll handle ConfigSystem initialization separately for now

      // Initialize other systems in order
      // This will be expanded as systems are implemented
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
    this.paused = false;
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
   * Pause the game engine
   */
  public pause(): void {
    if (!this.running || this.paused) {
      return;
    }

    if (this.config.debugMode) {
      console.log('[GameEngine] Pausing engine');
    }

    this.paused = true;
    this.stopGameLoop();
  }

  /**
   * Resume the game engine
   */
  public resume(): void {
    if (!this.running || !this.paused) {
      return;
    }

    if (this.config.debugMode) {
      console.log('[GameEngine] Resuming engine');
    }

    this.paused = false;
    this.lastTickTime = Date.now();
    this.startGameLoop();
  }

  /**
   * Process one game tick
   */
  public async tick(): Promise<void> {
    if (!this.running || this.paused) {
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
      paused: this.paused,
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
        maxSlots: 50,
        unlockedSlots: 20,
      },
      world: {
        currentLocation: {
          currentLocationId: 'city_square',
          traveling: false,
          inActivity: false,
          visitedLocations: ['city_square'],
          lastVisitTimes: {
            city_square: Date.now(),
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
          masterVolume: 100,
          musicVolume: 80,
          sfxVolume: 80,
          textSize: 'medium',
          colorBlindMode: 'off',
          highContrast: false,
          reducedMotion: false,
          showParticles: true,
          autoSave: true,
          autoSaveInterval: 1,
          confirmActions: true,
          showTutorialHints: true,
          enableNotifications: true,
          lowCareWarning: true,
          activityComplete: true,
          eventReminders: true,
          touchControls: true,
          keyboardShortcuts: true,
          swipeGestures: true,
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
      [UPDATE_TYPES.USER_ACTION]: ['PetSystem', 'InventorySystem', 'LocationSystem'],
      [UPDATE_TYPES.GAME_TICK]: ['TimeSystem', 'PetSystem'],
      [UPDATE_TYPES.ACTIVITY_COMPLETE]: ['ActivitySystem', 'InventorySystem'],
      [UPDATE_TYPES.BATTLE_ACTION]: ['BattleSystem'],
      [UPDATE_TYPES.EVENT_TRIGGER]: ['EventSystem'],
      [UPDATE_TYPES.SAVE_REQUEST]: ['SaveSystem'],
      [UPDATE_TYPES.STATE_TRANSITION]: ['GameEngine'],
    };
  }

  /**
   * Initialize a system
   */
  private async initializeSystem(name: string, system: BaseSystem): Promise<void> {
    // Only create writer for authorized systems
    let writer: any = null;
    const authorizedSystems = [
      'UISystem',
      'TimeSystem',
      'ActivitySystem',
      'BattleSystem',
      'EventSystem',
      'LocationSystem',
    ];

    if (authorizedSystems.includes(name)) {
      writer = this.updatesQueue.createWriter(name);
    }

    const initOptions: SystemInitOptions = {
      gameUpdateWriter: writer,
      config: await this.configSystem.get(name.toLowerCase()),
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
    // This will be expanded as systems are implemented
    // For now, just log
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
      priority: 1,
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
    // This will be implemented when SaveSystem is available
    if (this.config.debugMode) {
      console.log('[GameEngine] Loading game state...');
    }
    // For now, use default state
  }

  /**
   * Save current game state
   */
  private async saveGameState(): Promise<void> {
    // This will be implemented when SaveSystem is available
    if (this.config.debugMode && this.tickCount % 10 === 0) {
      console.log('[GameEngine] Saving game state...');
    }

    // Update save data
    this.gameState.saveData.lastSaveTime = Date.now();
    this.gameState.saveData.saveCount++;
  }

  /**
   * Process offline time
   */
  private async processOfflineTime(): Promise<void> {
    // This will be implemented when TimeSystem is available
    if (this.config.debugMode) {
      console.log('[GameEngine] Processing offline time...');
    }
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
}

/**
 * Factory function to create a new GameEngine
 */
export function createGameEngine(config?: EngineConfig): GameEngine {
  return new GameEngine(config);
}
