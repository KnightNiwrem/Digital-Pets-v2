/**
 * Tests for PetSystem
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { PetSystem } from './PetSystem';
import { ConfigSystem } from './ConfigSystem';
import type { GameState } from '../models/GameState';
import { GROWTH_STAGES, STATUS_TYPES, RARITY_TIERS } from '../models/constants';
import { createMockGameState, createMockGameUpdateWriter } from '../testing';

describe('PetSystem', () => {
  let petSystem: PetSystem;
  let configSystem: ConfigSystem;
  let gameState: GameState;

  beforeEach(async () => {
    // Initialize ConfigSystem to get tuning values
    configSystem = new ConfigSystem();
    const tuning = configSystem.getTuningValues();

    // Initialize PetSystem with tuning values
    petSystem = new PetSystem(createMockGameUpdateWriter());
    await petSystem.initialize({
      tuning: tuning,
      config: {},
    });

    // Create empty game state
    gameState = createMockGameState({
      playerId: 'test-player',
      currentLocationId: 'city_central',
      pet: null,
      coins: 0,
      unlockedSlots: 20,
    });
  });

  describe('Pet Creation', () => {
    it('should create a new pet with correct initial values', () => {
      const pet = petSystem.createPet({
        name: 'Fluffy',
        species: 'cat',
        fromEgg: false,
        isStarter: true,
      });

      expect(pet.name).toBe('Fluffy');
      expect(pet.species).toBe('cat');
      expect(pet.stage).toBe(GROWTH_STAGES.HATCHLING);
      expect(pet.rarity).toBe(RARITY_TIERS.COMMON);
      expect(pet.energy).toBe(50);
      expect(pet.maxEnergy).toBe(50);
      expect(pet.poopCount).toBe(0);
      expect(pet.status.primary).toBe(STATUS_TYPES.HEALTHY);
      expect(pet.moves.length).toBeGreaterThan(0);
    });

    it('should use species-specific starter moves when available', () => {
      // Test with a known starter species that has specific moves
      const firePet = petSystem.createPet({
        name: 'Flame',
        species: 'starter_fire',
        fromEgg: false,
        isStarter: true,
      });

      // According to species.ts, starter_fire should have 'tackle' and 'ember'
      expect(firePet.moves).toEqual(['tackle', 'ember']);

      // Test with another starter species
      const waterPet = petSystem.createPet({
        name: 'Splash',
        species: 'starter_water',
        fromEgg: false,
        isStarter: true,
      });

      // According to species.ts, starter_water should have 'tackle' and 'bubble'
      expect(waterPet.moves).toEqual(['tackle', 'bubble']);

      // Test with grass starter
      const grassPet = petSystem.createPet({
        name: 'Leafy',
        species: 'starter_grass',
        fromEgg: false,
        isStarter: true,
      });

      // According to species.ts, starter_grass should have 'tackle' and 'vine_whip'
      expect(grassPet.moves).toEqual(['tackle', 'vine_whip']);
    });

    it('should fallback to default moves for unknown species', () => {
      // Test with an unknown species
      const unknownPet = petSystem.createPet({
        name: 'Mystery',
        species: 'unknown_species',
        fromEgg: false,
        isStarter: false,
      });

      // Should fallback to default moves: 'tackle' and 'growl'
      expect(unknownPet.moves).toEqual(['tackle', 'growl']);
    });

    it('should initialize care values at maximum', () => {
      const pet = petSystem.createPet({
        name: 'Max',
        species: 'dog',
      });

      const careValues = petSystem.calculateCareValues(pet.hiddenCounters);
      expect(careValues.satiety).toBe(100);
      expect(careValues.hydration).toBe(100);
      expect(careValues.happiness).toBe(100);
    });
  });

  describe('Care Value Calculations', () => {
    it('should correctly calculate care values from tick counters', () => {
      const hiddenCounters = {
        satietyTicks: 1000, // 50 satiety (1000/20)
        hydrationTicks: 750, // 50 hydration (750/15)
        happinessTicks: 900, // 30 happiness (900/30)
        lifeTicks: 80,
        poopTicksLeft: 360, // Not used in care calculations but required by interface
      };

      const careValues = petSystem.calculateCareValues(hiddenCounters);
      expect(careValues.satiety).toBe(50);
      expect(careValues.hydration).toBe(50);
      expect(careValues.happiness).toBe(30);
    });

    it('should cap care values at 0 and 100', () => {
      const negativeCounters = {
        satietyTicks: -100,
        hydrationTicks: -50,
        happinessTicks: -200,
        lifeTicks: 50,
        poopTicksLeft: 360,
      };

      const lowValues = petSystem.calculateCareValues(negativeCounters);
      expect(lowValues.satiety).toBe(0);
      expect(lowValues.hydration).toBe(0);
      expect(lowValues.happiness).toBe(0);

      const highCounters = {
        satietyTicks: 5000,
        hydrationTicks: 3000,
        happinessTicks: 6000,
        lifeTicks: 100,
        poopTicksLeft: 360,
      };

      const highValues = petSystem.calculateCareValues(highCounters);
      expect(highValues.satiety).toBe(100);
      expect(highValues.hydration).toBe(100);
      expect(highValues.happiness).toBe(100);
    });
  });

  describe('Care Decay', () => {
    it('should decay care values over time', async () => {
      const pet = petSystem.createPet({
        name: 'Decay Test',
        species: 'test',
      });
      gameState.pet = pet;

      const initialSatiety = pet.hiddenCounters.satietyTicks;
      const initialHydration = pet.hiddenCounters.hydrationTicks;
      const initialHappiness = pet.hiddenCounters.happinessTicks;

      // Process 60 ticks (1 hour)
      await petSystem.processCareDecay(60, gameState);

      expect(pet.hiddenCounters.satietyTicks).toBeLessThan(initialSatiety);
      expect(pet.hiddenCounters.hydrationTicks).toBeLessThan(initialHydration);
      expect(pet.hiddenCounters.happinessTicks).toBeLessThan(initialHappiness);
    });

    it('should decay happiness faster with poop', async () => {
      const pet = petSystem.createPet({
        name: 'Poop Test',
        species: 'test',
      });
      gameState.pet = pet;

      // Add poop
      pet.poopCount = 5;

      const initialHappiness = pet.hiddenCounters.happinessTicks;
      await petSystem.processCareDecay(10, gameState);

      const decayWithPoop = initialHappiness - pet.hiddenCounters.happinessTicks;

      // Reset and test without poop
      pet.hiddenCounters.happinessTicks = initialHappiness;
      pet.poopCount = 0;

      await petSystem.processCareDecay(10, gameState);
      const decayWithoutPoop = initialHappiness - pet.hiddenCounters.happinessTicks;

      expect(decayWithPoop).toBeGreaterThan(decayWithoutPoop);
    });
  });

  describe('Care Actions', () => {
    let pet: any;

    beforeEach(() => {
      pet = petSystem.createPet({
        name: 'Action Test',
        species: 'test',
      });
      gameState.pet = pet;

      // Set care values to 50%
      pet.hiddenCounters.satietyTicks = 1000;
      pet.hiddenCounters.hydrationTicks = 750;
      pet.hiddenCounters.happinessTicks = 1500;
    });

    it('should feed pet and increase satiety', async () => {
      const foodItem = {
        id: 'food-1',
        name: 'Apple',
        category: 'FOOD',
        effectSize: 'MEDIUM',
      } as any;

      const result = await petSystem.feed(gameState, foodItem);

      expect(result.success).toBe(true);
      expect(result.message).toContain('ate');
      expect(result.valueChange).toBeGreaterThan(0);
      expect(pet.hiddenCounters.satietyTicks).toBeGreaterThan(1000);
    });

    it('should give drink and increase hydration', async () => {
      const drinkItem = {
        id: 'drink-1',
        name: 'Water',
        category: 'DRINK',
        effectSize: 'LARGE',
      } as any;

      const result = await petSystem.drink(gameState, drinkItem);

      expect(result.success).toBe(true);
      expect(result.message).toContain('drank');
      expect(result.valueChange).toBeGreaterThan(0);
      expect(pet.hiddenCounters.hydrationTicks).toBeGreaterThan(750);
    });

    it('should play with pet and increase happiness', async () => {
      const result = await petSystem.play(gameState);

      expect(result.success).toBe(true);
      expect(result.message).toContain('played');
      expect(result.valueChange).toBeGreaterThan(0);
      expect(pet.hiddenCounters.happinessTicks).toBeGreaterThan(1500);
    });

    it('should play with toy and consume energy', async () => {
      const toyItem = {
        id: 'toy-1',
        name: 'Ball',
        category: 'TOY',
        effectSize: 'SMALL',
        energyCost: 5,
      } as any;

      pet.energy = 20;
      const initialEnergy = pet.energy;

      const result = await petSystem.play(gameState, toyItem);

      expect(result.success).toBe(true);
      expect(pet.energy).toBe(initialEnergy - 5);
      expect(result.energyCost).toBe(5);
    });

    it('should clean poop', async () => {
      pet.poopCount = 3;

      const result = await petSystem.cleanPoop(gameState);

      expect(result.success).toBe(true);
      expect(result.message).toContain('cleaned');
      expect(pet.poopCount).toBe(0);
    });

    it('should clean specific amount of poop', async () => {
      pet.poopCount = 5;

      const result = await petSystem.cleanPoop(gameState, 2);

      expect(result.success).toBe(true);
      expect(pet.poopCount).toBe(3);
      expect(result.valueChange).toBe(-2);
    });
  });

  describe('Growth Stages', () => {
    it('should check growth stage eligibility', () => {
      const pet = petSystem.createPet({
        name: 'Growth Test',
        species: 'test',
      });
      gameState.pet = pet;

      // Fresh hatchling - cannot advance yet
      let checkResult = petSystem.checkGrowthStage(gameState);
      expect(checkResult.canAdvance).toBe(false);
      expect(checkResult.currentStage).toBe(GROWTH_STAGES.HATCHLING);
      expect(checkResult.timeInStage).toBeLessThan(1);

      // Simulate 25 hours passed with good care
      pet.stageStartTime = Date.now() - 25 * 60 * 60 * 1000;
      pet.hiddenCounters.satietyTicks = 1500;
      pet.hiddenCounters.hydrationTicks = 1200;
      pet.hiddenCounters.happinessTicks = 1800;

      checkResult = petSystem.checkGrowthStage(gameState);
      expect(checkResult.canAdvance).toBe(true);
      expect(checkResult.meetsCareCriteria).toBe(true);
      expect(checkResult.nextStage).toBe(GROWTH_STAGES.JUVENILE);
    });

    it('should advance pet stage with stat bonuses', async () => {
      const pet = petSystem.createPet({
        name: 'Advance Test',
        species: 'test',
      });
      gameState.pet = pet;

      // Make eligible for advancement
      pet.stageStartTime = Date.now() - 25 * 60 * 60 * 1000;
      pet.hiddenCounters.satietyTicks = 1500;
      pet.hiddenCounters.hydrationTicks = 1200;
      pet.hiddenCounters.happinessTicks = 1800;

      const initialHealth = pet.stats.maxHealth;
      const initialAttack = pet.stats.attack;

      const result = await petSystem.advanceStage(gameState);

      expect(result.success).toBe(true);
      expect(pet.stage).toBe(GROWTH_STAGES.JUVENILE);
      expect(pet.stats.maxHealth).toBeGreaterThan(initialHealth);
      expect(pet.stats.attack).toBeGreaterThan(initialAttack);
      expect(pet.maxEnergy).toBe(80); // Juvenile max energy
    });
  });

  describe('Sickness and Injury', () => {
    it('should treat sickness with medicine', async () => {
      const pet = petSystem.createPet({
        name: 'Sick Test',
        species: 'test',
      });
      gameState.pet = pet;

      pet.status.primary = STATUS_TYPES.SICK;
      pet.status.sicknessSeverity = 50;

      const medicineItem = {
        id: 'medicine-1',
        name: 'Medicine',
        category: 'MEDICINE',
        effectiveness: 80,
      } as any;

      const result = await petSystem.treatSickness(gameState, medicineItem);

      expect(result.success).toBe(true);
      expect(pet.status.primary as string).toBe(STATUS_TYPES.HEALTHY);
      expect(pet.status.sicknessSeverity).toBeUndefined();
    });

    it('should treat injury with bandage', async () => {
      const pet = petSystem.createPet({
        name: 'Injured Test',
        species: 'test',
      });
      gameState.pet = pet;

      pet.status.primary = STATUS_TYPES.INJURED;
      pet.status.injurySeverity = 60;

      const bandageItem = {
        id: 'bandage-1',
        name: 'Bandage',
        category: 'BANDAGE',
        effectiveness: 90,
      } as any;

      const result = await petSystem.treatInjury(gameState, bandageItem);

      expect(result.success).toBe(true);
      expect(pet.status.primary as string).toBe(STATUS_TYPES.HEALTHY);
      expect(pet.status.injurySeverity).toBeUndefined();
    });
  });

  describe('Poop Scheduling', () => {
    it('should initialize poopTicksLeft when creating a pet', () => {
      const pet = petSystem.createPet({
        name: 'Poop Schedule Test',
        species: 'test',
      });

      // Should have a valid poopTicksLeft value
      expect(pet.hiddenCounters.poopTicksLeft).toBeGreaterThan(0);

      // Should be within the configured range (6-24 hours in ticks)
      const minTicks = 6 * 60; // 6 hours
      const maxTicks = 24 * 60; // 24 hours
      expect(pet.hiddenCounters.poopTicksLeft).toBeGreaterThanOrEqual(minTicks);
      expect(pet.hiddenCounters.poopTicksLeft).toBeLessThanOrEqual(maxTicks);
    });

    it('should decrement poopTicksLeft on each tick', async () => {
      const pet = petSystem.createPet({
        name: 'Tick Test',
        species: 'test',
      });
      gameState.pet = pet;

      // Set a specific counter value
      pet.hiddenCounters.poopTicksLeft = 100;
      const initialTicks = pet.hiddenCounters.poopTicksLeft;

      // Process one tick
      await petSystem['checkPoopSpawn'](gameState);

      expect(pet.hiddenCounters.poopTicksLeft).toBe(initialTicks - 1);
    });

    it('should spawn poop when counter reaches 0 while awake', async () => {
      const pet = petSystem.createPet({
        name: 'Spawn Test',
        species: 'test',
      });
      gameState.pet = pet;

      // Set counter to 1 so next tick will trigger spawn
      pet.hiddenCounters.poopTicksLeft = 1;
      pet.poopCount = 0;

      // Process tick (pet is awake by default)
      await petSystem['checkPoopSpawn'](gameState);

      expect(pet.poopCount).toBe(1);
      expect(pet.hiddenCounters.poopTicksLeft).toBeGreaterThan(0); // Should reset to new interval
    });

    it('should NOT spawn poop during sleep', async () => {
      const pet = petSystem.createPet({
        name: 'Sleep Test',
        species: 'test',
      });
      gameState.pet = pet;

      // Add a sleep timer to simulate sleeping
      gameState.world.activeTimers = [
        {
          id: 'sleep-1',
          type: 'sleep',
          startTime: Date.now(),
          endTime: Date.now() + 3600000,
          duration: 3600000,
          paused: false,
        },
      ];

      // Set counter to 1
      pet.hiddenCounters.poopTicksLeft = 1;
      pet.poopCount = 0;

      // Process tick while sleeping
      await petSystem['checkPoopSpawn'](gameState);

      expect(pet.poopCount).toBe(0); // No poop spawned
      expect(pet.hiddenCounters.poopTicksLeft).toBe(0); // Counter stays at 0
    });

    it('should spawn poop on first tick after waking', async () => {
      const pet = petSystem.createPet({
        name: 'Wake Test',
        species: 'test',
      });
      gameState.pet = pet;

      // First, simulate sleep with counter at 0
      gameState.world.activeTimers = [
        {
          id: 'sleep-1',
          type: 'sleep',
          startTime: Date.now(),
          endTime: Date.now() + 3600000,
          duration: 3600000,
          paused: false,
        },
      ];

      pet.hiddenCounters.poopTicksLeft = 0;
      pet.poopCount = 0;

      // Tick during sleep - no spawn
      await petSystem['checkPoopSpawn'](gameState);
      expect(pet.poopCount).toBe(0);

      // Remove sleep timer (wake up)
      gameState.world.activeTimers = [];

      // First tick after waking - should spawn
      await petSystem['checkPoopSpawn'](gameState);
      expect(pet.poopCount).toBe(1);
      expect(pet.hiddenCounters.poopTicksLeft).toBeGreaterThan(0);
    });

    it('should handle offline poop spawning correctly', async () => {
      const pet = petSystem.createPet({
        name: 'Offline Test',
        species: 'test',
      });
      gameState.pet = pet;

      // Set up initial state
      pet.hiddenCounters.poopTicksLeft = 100;
      pet.poopCount = 0;

      // Create offline calculation
      const offlineCalc = {
        offlineTime: 7200, // 2 hours
        ticksToProcess: 120, // 120 minutes
        careDecay: {
          satiety: 0,
          hydration: 0,
          happiness: 0,
          life: 0,
        },
        poopSpawned: 0,
        sicknessTriggered: false,
        completedActivities: [],
        travelCompleted: false,
        eggsHatched: [],
        expiredEvents: [],
        energyRecovered: 0, // Not sleeping
        petDied: false,
      };

      await petSystem['processOfflinePoopSpawning'](pet, offlineCalc);

      // Should have decremented by 120 ticks and potentially spawned poop
      // Since counter was 100, it should reach 0 and spawn 1 poop
      expect(pet.poopCount).toBeGreaterThanOrEqual(1);
      expect(offlineCalc.poopSpawned).toBeGreaterThanOrEqual(1);
    });

    it('should NOT spawn poop during offline sleep', async () => {
      const pet = petSystem.createPet({
        name: 'Offline Sleep Test',
        species: 'test',
      });
      gameState.pet = pet;

      // Set up initial state
      pet.hiddenCounters.poopTicksLeft = 50;
      pet.poopCount = 0;

      // Create offline calculation with sleep (energyRecovered > 0)
      const offlineCalc = {
        offlineTime: 7200,
        ticksToProcess: 120,
        careDecay: {
          satiety: 0,
          hydration: 0,
          happiness: 0,
          life: 0,
        },
        poopSpawned: 0,
        sicknessTriggered: false,
        completedActivities: [],
        travelCompleted: false,
        eggsHatched: [],
        expiredEvents: [],
        energyRecovered: 50, // Was sleeping
        petDied: false,
      };

      await petSystem['processOfflinePoopSpawning'](pet, offlineCalc);

      // Counter should decrement to 0 but no poop spawns during sleep
      expect(pet.hiddenCounters.poopTicksLeft).toBe(0);
      expect(pet.poopCount).toBe(0);
      expect(offlineCalc.poopSpawned).toBe(0);
    });

    it('should handle multiple poop spawns during long offline period', async () => {
      const pet = petSystem.createPet({
        name: 'Long Offline Test',
        species: 'test',
      });
      gameState.pet = pet;

      // Set up for multiple spawns (48 hours offline)
      pet.hiddenCounters.poopTicksLeft = 100;
      pet.poopCount = 0;

      const offlineCalc = {
        offlineTime: 172800, // 48 hours
        ticksToProcess: 2880, // 2880 minutes
        careDecay: {
          satiety: 0,
          hydration: 0,
          happiness: 0,
          life: 0,
        },
        poopSpawned: 0,
        sicknessTriggered: false,
        completedActivities: [],
        travelCompleted: false,
        eggsHatched: [],
        expiredEvents: [],
        energyRecovered: 0, // Not sleeping
        petDied: false,
      };

      await petSystem['processOfflinePoopSpawning'](pet, offlineCalc);

      // With average interval of 15 hours (900 ticks), should spawn ~3 poops in 48 hours
      expect(pet.poopCount).toBeGreaterThanOrEqual(2);
      expect(pet.poopCount).toBeLessThanOrEqual(8); // Max possible with 6-hour intervals
      expect(offlineCalc.poopSpawned).toBe(pet.poopCount);
    });

    it('should maintain poopTicksLeft value persistently', () => {
      const pet = petSystem.createPet({
        name: 'Persistence Test',
        species: 'test',
      });

      // Set specific value
      pet.hiddenCounters.poopTicksLeft = 500;

      // Simulate save/load by checking the value is part of hiddenCounters
      const savedCounters = { ...pet.hiddenCounters };

      // Create new pet and restore counters
      const newPet = petSystem.createPet({
        name: 'Restored Pet',
        species: 'test',
      });

      newPet.hiddenCounters = savedCounters;

      expect(newPet.hiddenCounters.poopTicksLeft).toBe(500);
    });
  });

  describe('Pet Summary', () => {
    it('should generate pet summary', () => {
      const pet = petSystem.createPet({
        name: 'Summary Test',
        species: 'cat',
      });

      const summary = petSystem.getPetSummary(pet);

      expect(summary).toContain('Summary Test');
      expect(summary).toContain('cat');
      expect(summary).toContain('HATCHLING');
      expect(summary).toContain('Energy:');
      expect(summary).toContain('Satiety:');
      expect(summary).toContain('✨ Pet is very happy!');
    });
  });

  describe('Sleep Energy Regeneration', () => {
    it('should reduce regeneration rate when pet is sick', () => {
      const pet = petSystem.createPet({
        name: 'Sleeper',
        species: 'cat',
      });

      // Use adult stage for known config values
      pet.stage = GROWTH_STAGES.ADULT;

      const baseRate = configSystem.get('tuning.energy.sleepRegenRatePerHour.ADULT');
      const penalty = configSystem.get('tuning.sickness.energyRegenPenalty');

      pet.status.primary = STATUS_TYPES.HEALTHY;
      const healthyRate = petSystem.getSleepEnergyRegenRate(pet);
      expect(healthyRate).toBe(baseRate);

      pet.status.primary = STATUS_TYPES.SICK;
      const sickRate = petSystem.getSleepEnergyRegenRate(pet);
      expect(sickRate).toBeCloseTo(baseRate * penalty);
    });
  });
});
