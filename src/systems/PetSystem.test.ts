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
