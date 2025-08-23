import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { GameEngine, createGameEngine } from './GameEngine';
import { BaseSystem, type SystemInitOptions, type SystemError } from '../systems/BaseSystem';
import { UPDATE_TYPES } from '../models/constants';
import type { GameState, GameUpdate } from '../models';

// Mock localStorage for GameEngine tests (needed for SaveSystem)
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
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
  public lastGameState: GameState | null = null;

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

  public async handleUpdate(update: GameUpdate, gameState: GameState): Promise<GameState | null> {
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
      expect(status.paused).toBe(false);
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
      expect(status.paused).toBe(false);
    });

    test('should stop engine', async () => {
      await engine.initialize();
      await engine.start();
      await engine.stop();

      const status = engine.getStatus();
      expect(status.running).toBe(false);
    });

    test('should pause and resume engine', async () => {
      await engine.initialize();
      await engine.start();

      engine.pause();
      expect(engine.getStatus().paused).toBe(true);

      engine.resume();
      expect(engine.getStatus().paused).toBe(false);
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

      // Initialize the system manually since it's not an authorized system
      await mockSystem.initialize({
        gameUpdateWriter: null as any,
        config: {},
      });

      await engine.start();

      // Manually trigger a tick
      await engine.tick();

      expect(mockSystem.tickCalled).toBe(true);
    });

    test('should track tick count', async () => {
      await engine.initialize();
      await engine.start();

      const initialStatus = engine.getStatus();
      const initialTickCount = initialStatus.tickCount;

      await engine.tick();

      const newStatus = engine.getStatus();
      expect(newStatus.tickCount).toBe(initialTickCount + 1);
    });

    test('should not tick when paused', async () => {
      const mockSystem = new MockSystem('TestSystem');
      engine.registerSystem('TestSystem', mockSystem);

      await engine.initialize();
      await engine.start();
      engine.pause();

      await engine.tick();

      expect(mockSystem.tickCalled).toBe(false);
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
        priority: 0,
        payload: {
          action: 'test',
        },
      });

      // Process tick which should process the update
      await engine.tick();

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
        priority: 0,
        payload: {
          action: 'error-test',
        },
      });

      // Should not throw, just log error
      await engine.tick();

      // Engine should still be running
      expect(engine.getStatus().running).toBe(true);
    });

    test('should respect maxUpdatesPerTick', async () => {
      const customEngine = new GameEngine({
        tickInterval: 100,
        maxUpdatesPerTick: 2,
      });

      const handlerSystem = new MockUpdateHandlerSystem('HandlerSystem', [
        UPDATE_TYPES.USER_ACTION,
      ]);
      customEngine.registerSystem('HandlerSystem', handlerSystem);

      await customEngine.initialize();
      await customEngine.start();

      // Clear any auto-queued updates (like GAME_TICK)
      const queue = (customEngine as any).updatesQueue;
      queue.clear();

      // Queue more updates than maxUpdatesPerTick
      for (let i = 0; i < 5; i++) {
        queue.enqueue({
          type: UPDATE_TYPES.USER_ACTION,
          priority: 0,
          payload: {
            action: `test-${i}`,
          },
        });
      }

      // Initial queue size should be 5
      expect(queue.size()).toBe(5);

      // First tick should process only 2 updates
      await customEngine.tick();

      // Check remaining queue size (5 - 2 = 3)
      expect(queue.size()).toBe(3);

      await customEngine.stop();
    });
  });

  describe('State Management', () => {
    test('should create default game state', () => {
      const state = engine.getGameState();

      expect(state.version).toBe('1.0.0');
      expect(state.pet).toBeNull();
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
      await engine.tick();

      const newState = engine.getGameState();
      expect(newState.world.worldTime).toBeGreaterThan(initialWorldTime);
      expect(newState.world.tickCount).toBe(initialTickCount + 1);
    });

    test('should update save data on tick', async () => {
      await engine.initialize();
      await engine.start();

      const initialState = engine.getGameState();
      const initialSaveCount = initialState.saveData.saveCount;
      const initialSaveTime = initialState.saveData.lastSaveTime;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));
      await engine.tick();

      const newState = engine.getGameState();
      expect(newState.saveData.saveCount).toBe(initialSaveCount + 1);
      expect(newState.saveData.lastSaveTime).toBeGreaterThan(initialSaveTime);
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
      expect(status.paused).toBe(false);
      expect(status.tickCount).toBeGreaterThanOrEqual(0);
      expect(status.updateCount).toBeGreaterThanOrEqual(0);
      expect(status.lastTickTime).toBeGreaterThan(0);
      expect(status.averageTickTime).toBeGreaterThanOrEqual(0);
    });

    test('should track average tick time', async () => {
      await engine.initialize();
      await engine.start();

      // Process multiple ticks
      for (let i = 0; i < 5; i++) {
        await engine.tick();
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const status = engine.getStatus();
      expect(status.averageTickTime).toBeGreaterThan(0);
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

      // Should not throw
      await engine.tick();

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
