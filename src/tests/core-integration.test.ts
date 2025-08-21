import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { GameEngine } from '../core/GameEngine';
import { Species, ActionType } from '../types';

describe('Core Systems Integration', () => {
  let gameEngine: GameEngine;

  beforeEach(() => {
    // Reset game engine for each test
    GameEngine.reset();
    gameEngine = GameEngine.getInstance();
  });

  afterEach(async () => {
    // Clean up after each test
    if (gameEngine.isGameInitialized()) {
      gameEngine.stop();
      await gameEngine.shutdown();
    }
  });

  test('should initialize game engine successfully', async () => {
    await gameEngine.initialize();

    expect(gameEngine.isGameInitialized()).toBe(true);
    expect(gameEngine.isGameRunning()).toBe(false);

    // Verify all systems are initialized
    const eventManager = gameEngine.getEventManager();
    const stateManager = gameEngine.getStateManager();
    const timeManager = gameEngine.getTimeManager();

    expect(eventManager).toBeDefined();
    expect(stateManager).toBeDefined();
    expect(timeManager).toBeDefined();
  });

  test('should start and stop game loop', async () => {
    await gameEngine.initialize();

    gameEngine.start();
    expect(gameEngine.isGameRunning()).toBe(true);

    gameEngine.stop();
    expect(gameEngine.isGameRunning()).toBe(false);
  });

  test('should have default game state after initialization', async () => {
    await gameEngine.initialize();

    const state = gameEngine.getGameState();

    expect(state.meta).toBeDefined();
    expect(state.meta.version).toBe('1.0.0');
    expect(state.pet).toBeNull();
    expect(state.inventory).toBeDefined();
    expect(state.inventory.coins).toBe(100);
    expect(state.world).toBeDefined();
    expect(state.time).toBeDefined();
    expect(state.settings).toBeDefined();
  });

  test('should create starter pet successfully', async () => {
    await gameEngine.initialize();

    const petName = 'TestPet';
    const result = await gameEngine.createStarterPet(Species.FLUFFY_PUP, petName);

    expect(result.success).toBe(true);

    const state = gameEngine.getGameState();

    expect(state.pet).not.toBeNull();
    expect(state.pet!.name).toBe(petName);
    expect(state.pet!.species).toBe(Species.FLUFFY_PUP);
    expect(state.pet!.satiety).toBe(80);
    expect(state.pet!.hydration).toBe(80);
    expect(state.pet!.happiness).toBe(80);
    expect(state.pet!.energy).toBe(50);
    expect(state.pet!.maxEnergy).toBe(50);
  });

  test('should process care decay over time', async () => {
    await gameEngine.initialize();
    const result = await gameEngine.createStarterPet(Species.BUBBLE_CAT, 'BubbleCat');
    expect(result.success).toBe(true);

    const initialState = gameEngine.getGameState();
    const initialSatietyTicks = initialState.pet!.satietyTicks;
    const initialHydrationTicks = initialState.pet!.hydrationTicks;
    const initialHappinessTicks = initialState.pet!.happinessTicks;

    // Manually trigger a tick
    gameEngine.tick();

    const afterTickState = gameEngine.getGameState();

    // Hidden ticks should have decreased by 1
    expect(afterTickState.pet!.satietyTicks).toBe(initialSatietyTicks - 1);
    expect(afterTickState.pet!.hydrationTicks).toBe(initialHydrationTicks - 1);
    expect(afterTickState.pet!.happinessTicks).toBe(initialHappinessTicks - 1);
  });

  test('should handle pause and resume', async () => {
    await gameEngine.initialize();
    gameEngine.start();

    expect(gameEngine.isGameRunning()).toBe(true);

    gameEngine.pause();
    expect(gameEngine.isGameRunning()).toBe(false);

    gameEngine.resume();
    expect(gameEngine.isGameRunning()).toBe(true);
  });

  test('should shutdown cleanly', async () => {
    await gameEngine.initialize();
    gameEngine.start();

    expect(gameEngine.isGameInitialized()).toBe(true);
    expect(gameEngine.isGameRunning()).toBe(true);

    await gameEngine.shutdown();

    expect(gameEngine.isGameInitialized()).toBe(false);
    expect(gameEngine.isGameRunning()).toBe(false);
  });

  test('should handle multiple starter pet species', async () => {
    await gameEngine.initialize();

    // Test each starter species
    const species = [Species.FLUFFY_PUP, Species.BUBBLE_CAT, Species.LEAF_SPRITE];

    for (const speciesType of species) {
      GameEngine.reset();
      const testEngine = GameEngine.getInstance();
      await testEngine.initialize();

      const result = await testEngine.createStarterPet(speciesType, `Pet-${speciesType}`);
      expect(result.success).toBe(true);

      const state = testEngine.getGameState();

      expect(state.pet!.species).toBe(speciesType);
      expect(state.pet!.name).toBe(`Pet-${speciesType}`);

      await testEngine.shutdown();
    }
  });

  test('should maintain state consistency after multiple operations', async () => {
    await gameEngine.initialize();
    const result = await gameEngine.createStarterPet(Species.LEAF_SPRITE, 'LeafSprite');
    expect(result.success).toBe(true);

    // Simulate multiple ticks
    for (let i = 0; i < 5; i++) {
      gameEngine.tick();
    }

    const state = gameEngine.getGameState();

    // State should remain valid
    expect(state.pet).not.toBeNull();
    expect(state.pet!.satiety).toBeGreaterThanOrEqual(0);
    expect(state.pet!.satiety).toBeLessThanOrEqual(100);
    expect(state.pet!.hydration).toBeGreaterThanOrEqual(0);
    expect(state.pet!.hydration).toBeLessThanOrEqual(100);
    expect(state.pet!.happiness).toBeGreaterThanOrEqual(0);
    expect(state.pet!.happiness).toBeLessThanOrEqual(100);
    expect(state.pet!.energy).toBeGreaterThanOrEqual(0);
    expect(state.pet!.energy).toBeLessThanOrEqual(state.pet!.maxEnergy);
    expect(state.time.tickCount).toBe(5);
  });

  test('should process user actions through GameEngine', async () => {
    await gameEngine.initialize();
    await gameEngine.createStarterPet(Species.FLUFFY_PUP, 'TestPet');

    // Test feeding action
    const feedResult = await gameEngine.processUserAction({
      type: ActionType.FEED_PET,
      payload: { foodAmount: 10 },
      timestamp: Date.now(),
    });

    expect(feedResult.success).toBe(true);

    const state = gameEngine.getGameState();
    expect(state.pet!.satiety).toBeGreaterThan(80); // Should have increased from base 80

    // Test invalid action (no pet)
    GameEngine.reset();
    const testEngine = GameEngine.getInstance();
    await testEngine.initialize();

    const invalidResult = await testEngine.processUserAction({
      type: ActionType.FEED_PET,
      payload: { foodAmount: 10 },
      timestamp: Date.now(),
    });

    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error).toBeDefined();

    await testEngine.shutdown();
  });
});
