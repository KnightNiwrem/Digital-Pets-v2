/**
 * Tests for EggSystem
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { EggSystem } from './EggSystem';
import { ConfigSystem } from './ConfigSystem';
import type { GameState } from '../models/GameState';
import type { EggItem } from '../models/Item';
import { RARITY_TIERS } from '../models/constants';

describe('EggSystem', () => {
  let eggSystem: EggSystem;
  let configSystem: ConfigSystem;
  let mockGameUpdateWriter: any;
  let gameState: GameState;
  let tuningValues: any;

  beforeEach(async () => {
    // Create config system and get tuning values
    configSystem = new ConfigSystem();
    tuningValues = configSystem.getTuningValues();

    // Create mock game update writer
    mockGameUpdateWriter = {
      enqueue: mock(() => {}),
    };

    // Initialize egg system
    eggSystem = new EggSystem();

    // Initialize with tuning values
    await eggSystem.initialize({
      gameUpdateWriter: mockGameUpdateWriter,
      tuning: tuningValues,
    });

    // Create a basic game state
    gameState = createMockGameState();
  });

  afterEach(async () => {
    await eggSystem.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully with tuning values', async () => {
      const system = new EggSystem();
      await system.initialize({
        gameUpdateWriter: mockGameUpdateWriter,
        tuning: tuningValues,
      });

      expect(system.isInitialized()).toBe(true);
      expect(system.isActive()).toBe(true);
      await system.shutdown();
    });

    it('should initialize with warning when tuning values are not provided', async () => {
      const system = new EggSystem();
      // Should not throw, just log a warning
      await system.initialize({
        gameUpdateWriter: mockGameUpdateWriter,
      });

      expect(system.isInitialized()).toBe(true);
      expect(system.isActive()).toBe(true);
      await system.shutdown();
    });
  });

  describe('Starter Selection', () => {
    it('should provide starter options when no pet and no eggs', () => {
      gameState.pet = null;
      gameState.collections.eggs = [];

      const starterOptions = eggSystem.getStarterOptions(gameState);

      expect(starterOptions.available).toBe(true);
      expect(starterOptions.species.length).toBe(3);
      expect(starterOptions.species[0]?.name).toBeTruthy();
    });

    it('should not provide starters when pet exists', () => {
      gameState.pet = createMockPet();

      const starterOptions = eggSystem.getStarterOptions(gameState);

      expect(starterOptions.available).toBe(false);
      expect(starterOptions.reason).toContain('already have a pet');
    });

    it('should not provide starters when eggs exist', () => {
      gameState.pet = null;
      gameState.collections.eggs = [createMockEgg()];

      const starterOptions = eggSystem.getStarterOptions(gameState);

      expect(starterOptions.available).toBe(false);
      expect(starterOptions.reason).toContain('eggs to hatch');
    });

    it('should select a valid starter species', async () => {
      gameState.pet = null;
      gameState.collections.eggs = [];

      const result = await eggSystem.selectStarter(gameState, 'starter_fire');

      expect(result.success).toBe(true);
      expect(result.message).toContain('chose');
      expect(mockGameUpdateWriter.enqueue).toHaveBeenCalled();
    });

    it('should reject invalid starter species', async () => {
      gameState.pet = null;
      gameState.collections.eggs = [];

      const result = await eggSystem.selectStarter(gameState, 'invalid_species');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid');
    });
  });

  describe('Incubation', () => {
    it('should start incubation for an egg item', async () => {
      const eggItem: EggItem = {
        id: 'egg_item_1',
        name: 'Mystery Egg',
        description: 'A mysterious egg',
        category: 'EGG',
        sprite: 'egg.png',
        stackable: false,
        maxStack: 1,
        sellPrice: 100,
        buyPrice: 500,
        rarity: RARITY_TIERS.COMMON,
        consumable: true,
        eggType: 'generic_egg',
        obtainedFrom: 'shop',
        incubationDuration: 12,
      };

      const result = await eggSystem.startIncubation(gameState, eggItem);

      expect(result).toBe(true);
      expect(gameState.collections.eggs.length).toBe(1);
      expect(gameState.collections.eggs[0]?.isIncubating).toBe(true);
      expect(gameState.collections.eggs[0]?.incubationStartTime).toBeTruthy();
      expect(gameState.collections.eggs[0]?.incubationEndTime).toBeTruthy();
    });

    it('should check incubation status correctly', async () => {
      const eggItem: EggItem = createMockEggItem();
      await eggSystem.startIncubation(gameState, eggItem);

      const egg = gameState.collections.eggs[0];
      if (!egg) {
        throw new Error('No egg found');
      }

      const status = eggSystem.checkIncubationStatus(egg.id);

      expect(status.isIncubating).toBe(true);
      expect(status.progress).toBeGreaterThanOrEqual(0);
      expect(status.progress).toBeLessThanOrEqual(100);
      expect(status.remainingTime).toBeGreaterThan(0);
    });

    it('should return not incubating for unknown egg', () => {
      const status = eggSystem.checkIncubationStatus('unknown_egg');

      expect(status.isIncubating).toBe(false);
      expect(status.progress).toBe(0);
    });
  });

  describe('Hatching', () => {
    it('should hatch egg that has completed incubation', async () => {
      const egg = createMockEgg();
      egg.isIncubating = true;
      egg.incubationEndTime = Date.now() - 1000; // Completed 1 second ago
      gameState.collections.eggs = [egg];

      const result = await eggSystem.hatchEgg(gameState, egg.id);

      expect(result.success).toBe(true);
      expect(result.message).toContain('hatched');
      expect(gameState.collections.eggs.length).toBe(0);
      expect(mockGameUpdateWriter.enqueue).toHaveBeenCalled();
    });

    it('should not hatch egg that is still incubating', async () => {
      const egg = createMockEgg();
      egg.isIncubating = true;
      egg.incubationEndTime = Date.now() + 3600000; // 1 hour from now
      gameState.collections.eggs = [egg];

      const result = await eggSystem.hatchEgg(gameState, egg.id);

      expect(result.success).toBe(false);
      expect(result.message).toContain('more hours');
      expect(gameState.collections.eggs.length).toBe(1);
    });

    it('should not hatch non-incubating egg', async () => {
      const egg = createMockEgg();
      egg.isIncubating = false;
      gameState.collections.eggs = [egg];

      const result = await eggSystem.hatchEgg(gameState, egg.id);

      expect(result.success).toBe(false);
      expect(result.message).toContain('not incubating');
    });

    it('should handle guaranteed species in egg', async () => {
      const egg = createMockEgg();
      egg.isIncubating = true;
      egg.incubationEndTime = Date.now() - 1000;
      egg.determinedSpecies = 'starter_water';
      gameState.collections.eggs = [egg];

      const result = await eggSystem.hatchEgg(gameState, egg.id);

      expect(result.success).toBe(true);
      expect(result.species?.id).toBe('starter_water');
    });
  });

  describe('Offline Incubation', () => {
    it('should process offline incubation correctly', async () => {
      const egg1 = createMockEgg();
      egg1.isIncubating = true;
      egg1.incubationEndTime = Date.now() - 3600000; // Completed 1 hour ago

      const egg2 = createMockEgg();
      egg2.id = 'egg_2';
      egg2.isIncubating = true;
      egg2.incubationEndTime = Date.now() + 3600000; // 1 hour from now

      gameState.collections.eggs = [egg1, egg2];

      const offlineCalculation = {
        offlineTime: 7200, // 2 hours offline
        ticksToProcess: 120,
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

      await eggSystem.processOfflineIncubation(offlineCalculation, gameState);

      expect(offlineCalculation.eggsHatched.length).toBe(1);
      expect(offlineCalculation.eggsHatched[0]).toBe(egg1.id);
      expect(egg1.isIncubating).toBe(false);
      expect(egg2.isIncubating).toBe(true);
    });
  });

  describe('Adding Eggs', () => {
    it('should add egg to inventory', async () => {
      const egg = await eggSystem.addEgg(gameState, 'generic_egg');

      expect(egg.eggType).toBe('generic_egg');
      expect(egg.isIncubating).toBe(false);
      expect(gameState.collections.eggs.length).toBe(1);
    });

    it('should add egg with guaranteed species', async () => {
      const egg = await eggSystem.addEgg(gameState, 'generic_egg', {
        guaranteedSpecies: 'starter_grass',
        guaranteedRarity: RARITY_TIERS.COMMON,
      });

      expect(egg.determinedSpecies).toBe('starter_grass');
    });
  });

  describe('Species Management', () => {
    it('should get species by ID', () => {
      const species = eggSystem.getSpecies('starter_fire');

      expect(species).not.toBeNull();
      expect(species?.name).toBe('Flamepup');
      expect(species?.rarity).toBe(RARITY_TIERS.COMMON);
    });

    it('should return null for unknown species', () => {
      const species = eggSystem.getSpecies('unknown_species');

      expect(species).toBeNull();
    });
  });

  describe('Egg Management', () => {
    it('should get egg by ID', () => {
      const egg = createMockEgg();
      gameState.collections.eggs = [egg];

      const retrieved = eggSystem.getEgg(gameState, egg.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(egg.id);
    });

    it('should return null for unknown egg', () => {
      const retrieved = eggSystem.getEgg(gameState, 'unknown_egg');

      expect(retrieved).toBeNull();
    });

    it('should get all incubating eggs', async () => {
      const egg1 = createMockEgg();
      egg1.isIncubating = true;

      const egg2 = createMockEgg();
      egg2.id = 'egg_2';
      egg2.isIncubating = false;

      gameState.collections.eggs = [egg1, egg2];

      // Sync eggs to system
      await eggSystem.update(gameState);

      const incubating = eggSystem.getIncubatingEggs();

      expect(incubating.length).toBe(1);
      expect(incubating[0]?.id).toBe(egg1.id);
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown egg type gracefully', async () => {
      const eggItem: EggItem = createMockEggItem();
      eggItem.eggType = 'unknown_type';

      const result = await eggSystem.startIncubation(gameState, eggItem);

      expect(result).toBe(false);
    });

    it('should handle egg not found in hatching', async () => {
      const result = await eggSystem.hatchEgg(gameState, 'non_existent_egg');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });
});

// Helper functions for creating mock data
function createMockGameState(): GameState {
  return {
    version: '1.0.0',
    timestamp: Date.now(),
    playerId: 'test_player',
    pet: null,
    inventory: {
      items: [],
      currency: { coins: 100 },
      maxSlots: 100,
      unlockedSlots: 50,
    },
    world: {
      currentLocation: {
        currentLocationId: 'city_square',
        currentArea: undefined,
        traveling: false,
        travelRoute: undefined,
        inActivity: false,
        currentActivity: undefined,
        visitedLocations: ['city_square'],
        lastVisitTimes: {
          city_square: Date.now(),
        },
        discoveredSecrets: undefined,
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
      settings: {} as any,
      tutorialProgress: {} as any,
      statistics: {} as any,
    },
    saveData: {
      lastSaveTime: Date.now(),
      autoSaveEnabled: true,
      saveCount: 0,
      backupSlots: {},
    },
  };
}

function createMockPet(): any {
  return {
    id: 'pet_1',
    name: 'Test Pet',
    species: 'starter_fire',
    rarity: RARITY_TIERS.COMMON,
    stage: 'HATCHLING',
    birthTime: Date.now(),
    stageStartTime: Date.now(),
    lastInteractionTime: Date.now(),
    stats: {
      health: 20,
      maxHealth: 20,
      attack: 5,
      defense: 5,
      speed: 5,
      action: 10,
      maxAction: 10,
    },
    energy: 50,
    maxEnergy: 50,
    careValues: { satiety: 100, hydration: 100, happiness: 100 },
    hiddenCounters: {
      satietyTicks: 2000,
      hydrationTicks: 1500,
      happinessTicks: 3000,
      lifeTicks: 100,
    },
    status: { primary: 'HEALTHY' },
    poopCount: 0,
    moves: ['tackle'],
    experiencePoints: 0,
    trainingCounts: {
      health: 0,
      attack: 0,
      defense: 0,
      speed: 0,
      action: 0,
    },
  };
}

function createMockEgg(): any {
  return {
    id: 'egg_1',
    eggType: 'generic_egg',
    obtainedTime: Date.now(),
    incubationStartTime: Date.now(),
    incubationEndTime: Date.now() + 3600000,
    isIncubating: false,
  };
}

function createMockEggItem(): EggItem {
  return {
    id: 'egg_item_1',
    name: 'Mystery Egg',
    description: 'A mysterious egg',
    category: 'EGG',
    sprite: 'egg.png',
    stackable: false,
    maxStack: 1,
    sellPrice: 100,
    buyPrice: 500,
    rarity: RARITY_TIERS.COMMON,
    consumable: true,
    eggType: 'generic_egg',
    obtainedFrom: 'shop',
    incubationDuration: 12,
  };
}
