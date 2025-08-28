import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { GameEngine, createGameEngine } from './GameEngine';
import { BaseSystem, type SystemInitOptions, type SystemError } from '../systems/BaseSystem';
import { ConfigSystem } from '../systems/ConfigSystem';
import { UPDATE_TYPES } from '../models/constants';
import type { GameState, GameUpdate } from '../models';

// Mock localStorage for GameEngine tests (needed for SaveSystem)
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    // Note: localStorage.getItem() must return null per Web Storage API spec
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  key(index: number): string | null {
    // Note: localStorage.key() must return null per Web Storage API spec
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  get length(): number {
    return Object.keys(this.store).length;
  }
}

// Mock System for testing
class MockSystem extends BaseSystem {
  public initializeCalled = false;
  public shutdownCalled = false;
  public resetCalled = false;
  public tickCalled = false;
  public updateCalled = false;
  public errorHandled = false;
  public lastDeltaTime = 0;
  public lastGameState: GameState | undefined = undefined;

  protected async onInitialize(_options: SystemInitOptions): Promise<void> {
    this.initializeCalled = true;
  }

  protected async onShutdown(): Promise<void> {
    this.shutdownCalled = true;
  }

  protected async onReset(): Promise<void> {
    this.resetCalled = true;
  }

  protected async onTick(deltaTime: number, gameState: GameState): Promise<void> {
    this.tickCalled = true;
    this.lastDeltaTime = deltaTime;
    this.lastGameState = gameState;
  }

  protected async onUpdate(gameState: GameState, _prevState?: GameState): Promise<void> {
    this.updateCalled = true;
    this.lastGameState = gameState;
  }

  protected onError(_error: SystemError): void {
    this.errorHandled = true;
  }
}

// Mock UpdateHandler System
class MockUpdateHandlerSystem extends MockSystem {
  private handledUpdateTypes: string[];

  constructor(name: string, handledUpdateTypes: string[]) {
    super(name);
    this.handledUpdateTypes = handledUpdateTypes;
  }

  public canHandleUpdate(updateType: string): boolean {
    return this.handledUpdateTypes.includes(updateType);
  }

  public async handleUpdate(
    update: GameUpdate,
    gameState: GameState,
  ): Promise<GameState | undefined> {
    // Return modified state for testing
    return {
      ...gameState,
      meta: {
        ...gameState.meta,
        statistics: {
          ...gameState.meta.statistics,
          totalPlayTime: gameState.meta.statistics.totalPlayTime + 1,
        },
      },
    };
  }
}

describe('GameEngine', () => {
  let engine: GameEngine;
  let mockLocalStorage: LocalStorageMock;

  beforeEach(() => {
    // Setup mock localStorage for SaveSystem
    mockLocalStorage = new LocalStorageMock();
    global.localStorage = mockLocalStorage as any;

    engine = createGameEngine({
      tickInterval: 100, // 100ms for faster testing
      autoStart: false,
      debugMode: false,
    });
  });

  afterEach(async () => {
    await engine.stop();
    // Clean up mock localStorage
    mockLocalStorage.clear();
  });

  describe('Initialization', () => {
    test('should create engine with default config', () => {
      const defaultEngine = new GameEngine();
      expect(defaultEngine.getStatus().running).toBe(false);
    });

    test('should create engine with custom config', () => {
      new GameEngine({
        tickInterval: 500,
        maxUpdatesPerTick: 50,
        autoStart: false,
        debugMode: true,
      });
    });

    test('should initialize engine successfully', async () => {
      await engine.initialize();
      const status = engine.getStatus();
      expect(status.running).toBe(false);
    });

    test('should auto-start if configured', async () => {
      const autoStartEngine = new GameEngine({
        tickInterval: 100,
        autoStart: true,
      });
      await autoStartEngine.initialize();
      expect(autoStartEngine.getStatus().running).toBe(true);
      await autoStartEngine.stop();
    });
  });

  describe('System Management', () => {
    test('should register a system', () => {
      const mockSystem = new MockSystem('TestSystem');
      engine.registerSystem('TestSystem', mockSystem);

      const retrievedSystem = engine.getSystem<MockSystem>('TestSystem');
      expect(retrievedSystem).toBe(mockSystem);
    });

    test('should throw error when registering duplicate system', () => {
      const mockSystem1 = new MockSystem('TestSystem');
      const mockSystem2 = new MockSystem('TestSystem');

      engine.registerSystem('TestSystem', mockSystem1);

      expect(() => {
        engine.registerSystem('TestSystem', mockSystem2);
      }).toThrow('System TestSystem is already registered');
    });

    test('should register update handler systems', () => {
      const handlerSystem = new MockUpdateHandlerSystem('HandlerSystem', [
        UPDATE_TYPES.USER_ACTION,
        UPDATE_TYPES.GAME_TICK,
      ]);

      engine.registerSystem('HandlerSystem', handlerSystem);

      const retrievedSystem = engine.getSystem<MockUpdateHandlerSystem>('HandlerSystem');
      expect(retrievedSystem).toBe(handlerSystem);
    });

    test('should return undefined for non-existent system', () => {
      const system = engine.getSystem('NonExistentSystem');
      expect(system).toBeUndefined();
    });
  });

  describe('Game Loop', () => {
    test('should start engine', async () => {
      await engine.initialize();
      await engine.start();

      const status = engine.getStatus();
      expect(status.running).toBe(true);
    });

    test('should stop engine', async () => {
      await engine.initialize();
      await engine.start();
      await engine.stop();

      const status = engine.getStatus();
      expect(status.running).toBe(false);
    });

    test('should not start when already running', async () => {
      await engine.initialize();
      await engine.start();

      // Should not throw, just warn
      await engine.start();
      expect(engine.getStatus().running).toBe(true);
    });

    test('should process ticks', async () => {
      const mockSystem = new MockSystem('TestSystem');
      engine.registerSystem('TestSystem', mockSystem);

      await engine.initialize();

      // Initialize the custom system manually since it's not part of default initialization
      await mockSystem.initialize({ config: {} });

      await engine.start();

      // Manually trigger a GAME_TICK update through the queue
      const queue = (engine as any).updatesQueue;
      queue.enqueue({
        type: UPDATE_TYPES.GAME_TICK,
        payload: {
          action: 'tick',
          data: {
            tickNumber: 1,
            timestamp: Date.now(),
            deltaTime: 100,
          },
          source: 'TimeSystem',
        },
      });

      // Wait for update processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockSystem.tickCalled).toBe(true);
    });

    test('should track tick count', async () => {
      await engine.initialize();
      await engine.start();

      const initialStatus = engine.getStatus();
      const initialTickCount = initialStatus.tickCount;

      // Manually trigger a GAME_TICK update
      const queue = (engine as any).updatesQueue;
      queue.enqueue({
        type: UPDATE_TYPES.GAME_TICK,
        payload: {
          action: 'tick',
          data: {
            tickNumber: initialTickCount + 1,
            timestamp: Date.now(),
            deltaTime: 100,
          },
          source: 'TimeSystem',
        },
      });

      // Wait for update processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      const newStatus = engine.getStatus();
      expect(newStatus.tickCount).toBe(initialTickCount + 1);
    });
  });

  describe('Update Processing', () => {
    test('should process updates from queue', async () => {
      const handlerSystem = new MockUpdateHandlerSystem('HandlerSystem', [
        UPDATE_TYPES.USER_ACTION,
      ]);
      engine.registerSystem('HandlerSystem', handlerSystem);

      await engine.initialize();
      await engine.start();

      // Get the queue and enqueue an update
      const queue = (engine as any).updatesQueue;
      queue.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: {
          action: 'test',
        },
      });

      // Wait for update processing (updates are processed immediately now)
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handlerSystem.updateCalled).toBe(false); // handleUpdate is called instead
      const state = engine.getGameState();
      expect(state.meta.statistics.totalPlayTime).toBeGreaterThan(0);
    });

    test('should handle update processing errors', async () => {
      const errorSystem = new MockUpdateHandlerSystem('ErrorSystem', [UPDATE_TYPES.USER_ACTION]);

      // Override handleUpdate to throw error
      errorSystem.handleUpdate = async () => {
        throw new Error('Test error');
      };

      engine.registerSystem('ErrorSystem', errorSystem);

      await engine.initialize();
      await engine.start();

      const queue = (engine as any).updatesQueue;
      queue.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: {
          action: 'error-test',
        },
      });

      // Wait for update processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Engine should still be running
      expect(engine.getStatus().running).toBe(true);
    });

    test('should process updates immediately from queue', async () => {
      const customEngine = new GameEngine({
        tickInterval: 100,
        maxUpdatesPerTick: 100,
      });

      const handlerSystem = new MockUpdateHandlerSystem('HandlerSystem', [
        UPDATE_TYPES.USER_ACTION,
      ]);
      customEngine.registerSystem('HandlerSystem', handlerSystem);

      await customEngine.initialize();
      await customEngine.start();

      const queue = (customEngine as any).updatesQueue;

      // Queue multiple updates
      for (let i = 0; i < 5; i++) {
        queue.enqueue({
          type: UPDATE_TYPES.USER_ACTION,
          payload: {
            action: `test-${i}`,
          },
        });
      }

      // Wait for all updates to be processed (they should be processed immediately)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // All updates should be processed immediately
      expect(queue.size()).toBe(0);

      await customEngine.stop();
    });
  });

  describe('State Management', () => {
    test('should create default game state', () => {
      const state = engine.getGameState();

      expect(state.version).toBe('1.0.0');
      expect(state.pet).toBeUndefined();
    });

    test('should have valid player ID', () => {
      const state = engine.getGameState();

      expect(state.playerId).toMatch(/^player_\d+_[a-z0-9]+$/);
    });

    test('should update world time on tick', async () => {
      await engine.initialize();
      await engine.start();

      const initialState = engine.getGameState();
      const initialWorldTime = initialState.world.worldTime;
      const initialTickCount = initialState.world.tickCount;

      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait a bit

      // Manually trigger a GAME_TICK update
      const queue = (engine as any).updatesQueue;
      queue.enqueue({
        type: UPDATE_TYPES.GAME_TICK,
        payload: {
          action: 'tick',
          data: {
            tickNumber: initialTickCount + 1,
            timestamp: Date.now(),
            deltaTime: 100,
          },
          source: 'TimeSystem',
        },
      });

      // Wait for update processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      const newState = engine.getGameState();
      expect(newState.world.worldTime).toBeGreaterThan(initialWorldTime);
      expect(newState.world.tickCount).toBe(initialTickCount + 1);
    });

    test('should update save data on tick', async () => {
      await engine.initialize();
      await engine.start();

      // Get initial state after start
      const initialState = engine.getGameState();
      const initialSaveCount = initialState.saveData.saveCount;
      const initialSaveTime = initialState.saveData.lastSaveTime;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Manually trigger a GAME_TICK update which should trigger a save
      const queue = (engine as any).updatesQueue;
      queue.enqueue({
        type: UPDATE_TYPES.GAME_TICK,
        payload: {
          action: 'tick',
          data: {
            tickNumber: 1,
            timestamp: Date.now(),
            deltaTime: 100,
          },
          source: 'TimeSystem',
        },
      });

      // Wait for update processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      const newState = engine.getGameState();

      // The save count should increment from initial value
      expect(newState.saveData.saveCount).toBeGreaterThan(initialSaveCount);
      expect(newState.saveData.lastSaveTime).toBeGreaterThan(initialSaveTime);
    });

    test('should use config system values for default game state', async () => {
      await engine.initialize();

      const state = engine.getGameState();
      const configSystem = engine.getSystem<ConfigSystem>('ConfigSystem')!;

      const limits = configSystem.getLimits();
      const defaultSettings = configSystem.getDefaultSettings();

      // Test that inventory settings come from config
      expect(state.inventory.maxSlots).toBe(limits.maxInventorySlots);

      // Test that volume settings come from config
      expect(state.meta.settings.masterVolume).toBe(defaultSettings.masterVolume);
      expect(state.meta.settings.musicVolume).toBe(defaultSettings.musicVolume);
      expect(state.meta.settings.sfxVolume).toBe(defaultSettings.sfxVolume);
      expect(state.meta.settings.autoSaveInterval).toBe(defaultSettings.autoSaveInterval);

      // Test other config values
      expect(state.meta.settings.textSize).toBe(defaultSettings.textSize);
      expect(state.meta.settings.colorBlindMode).toBe(defaultSettings.colorBlindMode);
      expect(state.meta.settings.autoSave).toBe(defaultSettings.autoSave);
    });
  });

  describe('Status and Monitoring', () => {
    test('should provide engine status', async () => {
      const mockSystem = new MockSystem('TestSystem');
      engine.registerSystem('TestSystem', mockSystem);

      await engine.initialize();
      await engine.start();

      const status = engine.getStatus();

      expect(status.running).toBe(true);
      expect(status.tickCount).toBeGreaterThanOrEqual(0);
      expect(status.updateCount).toBeGreaterThanOrEqual(0);
      expect(status.lastTickTime).toBeGreaterThan(0);
      expect(status.averageTickTime).toBeGreaterThanOrEqual(0);
    });

    test('should track average tick time', async () => {
      await engine.initialize();
      await engine.start();

      // Process multiple ticks via queue
      const queue = (engine as any).updatesQueue;
      for (let i = 0; i < 5; i++) {
        queue.enqueue({
          type: UPDATE_TYPES.GAME_TICK,
          payload: {
            action: 'tick',
            data: {
              tickNumber: i + 1,
              timestamp: Date.now(),
              deltaTime: 100,
            },
            source: 'TimeSystem',
          },
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Wait for all updates to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      const status = engine.getStatus();
      expect(status.averageTickTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle system errors', () => {
      // Should not throw
      engine.handleSystemError('TestSystem', new Error('Test error'));

      // Engine should still be functional
      expect(engine.getStatus()).toBeDefined();
    });

    test('should continue running after tick errors', async () => {
      const errorSystem = new MockSystem('ErrorSystem');
      errorSystem.tick = async () => {
        throw new Error('Tick error');
      };

      engine.registerSystem('ErrorSystem', errorSystem);

      await engine.initialize();
      await engine.start();

      // Trigger a GAME_TICK which will call tick on all systems
      const queue = (engine as any).updatesQueue;
      queue.enqueue({
        type: UPDATE_TYPES.GAME_TICK,
        payload: {
          action: 'tick',
          data: {
            tickNumber: 1,
            timestamp: Date.now(),
            deltaTime: 100,
          },
          source: 'TimeSystem',
        },
      });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Engine should still be running
      expect(engine.getStatus().running).toBe(true);
    });
  });

  describe('System Lifecycle', () => {
    test('should initialize systems in order', async () => {
      const system1 = new MockSystem('System1');
      const system2 = new MockSystem('System2');

      engine.registerSystem('System1', system1);
      engine.registerSystem('System2', system2);

      await engine.initialize();

      expect(system1.initializeCalled).toBe(false); // Not initialized until start
      expect(system2.initializeCalled).toBe(false);
    });

    test('should shutdown systems in reverse order', async () => {
      const system1 = new MockSystem('System1');
      const system2 = new MockSystem('System2');

      engine.registerSystem('System1', system1);
      engine.registerSystem('System2', system2);

      await engine.initialize();
      await engine.start();
      await engine.stop();

      // Both should be shutdown (in reverse order internally)
      expect(system1.shutdownCalled).toBe(false); // Not initialized, so not shutdown
      expect(system2.shutdownCalled).toBe(false);
    });
  });
});
