/**
 * PetSystem - Manages pet state, care values, growth stages, and wellness
 */

import { BaseSystem } from './BaseSystem';
import type { GameUpdateWriter } from '../engine/GameUpdatesQueue';
import type { SystemInitOptions, SystemError } from './BaseSystem';
import type { GameState, GameUpdate, OfflineCalculation } from '../models/GameState';
import type {
  Pet,
  PetCreationOptions,
  PetMemorial,
  HiddenCounters,
  CareValues,
  BattleStats,
  Sickness,
} from '../models/Pet';
import type { Item, FoodItem, DrinkItem, ToyItem } from '../models/Item';
import {
  UPDATE_TYPES,
  GROWTH_STAGES,
  STATUS_TYPES,
  BATTLE_CONSTANTS,
  SICKNESS_TYPES,
  INJURY_TYPES,
  BODY_PARTS,
} from '../models/constants';
import type { GrowthStage, RarityTier, DeathCause, StatType } from '../models/constants';
import { STARTER_MOVES } from '../data/moves';
import { getSpeciesById } from '../data/species';

/**
 * Care action types
 */
export const CareActionType = {
  FEED: 'FEED',
  DRINK: 'DRINK',
  PLAY: 'PLAY',
  CLEAN_POOP: 'CLEAN_POOP',
  USE_MEDICINE: 'USE_MEDICINE',
  USE_BANDAGE: 'USE_BANDAGE',
} as const;

export type CareActionType = (typeof CareActionType)[keyof typeof CareActionType];

/**
 * Care action result
 */
export interface CareActionResult {
  success: boolean;
  message: string;
  valueChange?: number;
  newValue?: number;
  energyCost?: number;
  itemConsumed?: boolean;
}

/**
 * Growth stage check result
 */
export interface GrowthCheckResult {
  canAdvance: boolean;
  currentStage: GrowthStage;
  nextStage?: GrowthStage;
  timeInStage: number;
  requiredTime: number;
  meetsCareCriteria: boolean;
}

/**
 * PetSystem class implementation
 */
export class PetSystem extends BaseSystem {
  private petCache: Pet | null = null;
  private lastDecayTick = 0;

  constructor(gameUpdateWriter: GameUpdateWriter) {
    super('PetSystem', gameUpdateWriter);
  }

  /**
   * System-specific initialization
   */
  protected async onInitialize(_options: SystemInitOptions): Promise<void> {
    // Tuning values are now provided via the base class
    if (!this.tuning) {
      console.warn('[PetSystem] Tuning values not provided, some features may not work correctly');
    }
  }

  /**
   * System-specific shutdown
   */
  protected async onShutdown(): Promise<void> {
    this.petCache = null;
    this.lastDecayTick = 0;
  }

  /**
   * System-specific reset
   */
  protected async onReset(): Promise<void> {
    this.petCache = null;
    this.lastDecayTick = 0;
  }

  /**
   * Process game tick
   */
  protected async onTick(deltaTime: number, gameState: GameState): Promise<void> {
    if (!gameState.pet) {
      return;
    }

    // Update care values decay
    await this.processCareDecay(1, gameState);

    // Check for poop spawning
    await this.checkPoopSpawn(gameState);

    // Check for sickness
    await this.checkSickness(gameState);

    // Process passive injury recovery
    await this.processInjuryRecovery(1, gameState);

    // Check for critical conditions
    await this.checkCriticalConditions(gameState);
  }

  /**
   * Update system based on state changes
   */
  protected async onUpdate(gameState: GameState, prevState?: GameState): Promise<void> {
    // Cache the current pet
    this.petCache = gameState.pet;

    // Check for pet death
    if (prevState?.pet && !gameState.pet) {
      // Pet died, handle memorial
      console.log('Pet has died');
    }
  }

  /**
   * Handle system errors
   */
  protected onError(error: SystemError): void {
    console.error(`[PetSystem] Error occurred:`, error);
  }

  /**
   * Create a new pet
   */
  public createPet(options: PetCreationOptions, speciesData?: any): Pet {
    const now = Date.now();

    // Get initial stats based on species or defaults
    const initialStats = this.getInitialStats(options.species, speciesData);

    const pet: Pet = {
      id: this.generateId(),
      name: options.name,
      species: options.species,
      rarity: speciesData?.rarity || ('COMMON' as RarityTier),
      stage: GROWTH_STAGES.HATCHLING,

      // Time tracking
      birthTime: now,
      stageStartTime: now,
      lastInteractionTime: now,

      // Stats
      stats: initialStats,
      energy: this.tuning?.energy.maxByStage.HATCHLING || 50,
      maxEnergy: this.tuning?.energy.maxByStage.HATCHLING || 50,

      // Care values (computed from hidden counters)
      careValues: {
        satiety: 100,
        hydration: 100,
        happiness: 100,
      },

      // Hidden counters (initialized to max)
      hiddenCounters: {
        satietyTicks: (this.tuning?.careTickMultipliers.satiety || 20) * 100,
        hydrationTicks: (this.tuning?.careTickMultipliers.hydration || 15) * 100,
        happinessTicks: (this.tuning?.careTickMultipliers.happiness || 30) * 100,
        lifeTicks: this.tuning?.life.startingValue || 100,
        poopTicks: this.generatePoopInterval(), // Initialize with random interval
      },

      // Status
      status: {
        primary: STATUS_TYPES.IDLE,
      },
      sicknesses: [], // Start with no sicknesses
      injuries: [], // Start with no injuries
      poopCount: 0,

      // Battle moves
      moves: this.getStarterMoves(options.species),

      // Experience
      experiencePoints: 0,
      trainingCounts: {
        health: 0,
        attack: 0,
        defense: 0,
        speed: 0,
        action: 0,
      },
    };

    return pet;
  }

  /**
   * Get initial battle stats for a species
   */
  private getInitialStats(species: string, speciesData?: any): BattleStats {
    // Base stats, can be overridden by species data
    const baseStats = {
      health: 20,
      maxHealth: 20,
      attack: 5,
      defense: 5,
      speed: 5,
      action: 10,
      maxAction: 10,
    };

    if (speciesData?.baseStats) {
      return { ...baseStats, ...speciesData.baseStats };
    }

    return baseStats;
  }

  /**
   * Get starter moves for a species
   */
  private getStarterMoves(speciesId: string): string[] {
    // Look up species-specific starter moves from species data
    const species = getSpeciesById(speciesId);

    if (species && species.startingMoves) {
      // Return a copy of the species-specific starter moves
      return [...species.startingMoves];
    }

    // Fallback to default starter moves if species not found or has no starting moves
    console.warn(`[PetSystem] No starter moves found for species '${speciesId}', using defaults`);
    return STARTER_MOVES.default ? [...STARTER_MOVES.default] : ['tackle', 'growl'];
  }

  /**
   * Get sleep energy regeneration rate for a pet, applying sickness penalty
   */
  public getSleepEnergyRegenRate(pet: Pet): number {
    if (!this.tuning) return 0;
    let rate = this.tuning.energy.sleepRegenRatePerHour[pet.stage] || 0;

    // Apply penalty if pet has any sickness
    if (pet.sicknesses.length > 0) {
      // Use the most severe sickness for penalty calculation
      const maxSeverity = Math.max(...pet.sicknesses.map((s) => s.severity));
      const penaltyMultiplier =
        1 - (maxSeverity / 100) * (1 - this.tuning.sickness.energyRegenPenalty);
      rate *= penaltyMultiplier;
    }
    return rate;
  }

  /**
   * Calculate care values from hidden tick counters
   */
  public calculateCareValues(hiddenCounters: HiddenCounters): CareValues {
    if (!this.tuning) {
      return { satiety: 0, hydration: 0, happiness: 0 };
    }

    const satiety = Math.ceil(
      hiddenCounters.satietyTicks / this.tuning.careTickMultipliers.satiety,
    );
    const hydration = Math.ceil(
      hiddenCounters.hydrationTicks / this.tuning.careTickMultipliers.hydration,
    );
    const happiness = Math.ceil(
      hiddenCounters.happinessTicks / this.tuning.careTickMultipliers.happiness,
    );

    return {
      satiety: Math.max(0, Math.min(100, satiety)),
      hydration: Math.max(0, Math.min(100, hydration)),
      happiness: Math.max(0, Math.min(100, happiness)),
    };
  }

  /**
   * Process care value decay over time
   */
  public async processCareDecay(ticks: number, gameState: GameState): Promise<void> {
    if (!gameState.pet) return;

    if (!this.tuning) return;

    const pet = gameState.pet;

    // Decay hidden tick counters
    pet.hiddenCounters.satietyTicks = Math.max(0, pet.hiddenCounters.satietyTicks - ticks);
    pet.hiddenCounters.hydrationTicks = Math.max(0, pet.hiddenCounters.hydrationTicks - ticks);
    pet.hiddenCounters.happinessTicks = Math.max(0, pet.hiddenCounters.happinessTicks - ticks);

    // Additional happiness decay from poop
    if (pet.poopCount > 0) {
      const poopPenalty = pet.poopCount * this.tuning.poop.happinessDecayPerPoop;
      pet.hiddenCounters.happinessTicks = Math.max(
        0,
        pet.hiddenCounters.happinessTicks - poopPenalty,
      );
    }

    // Update Life based on care values
    const careValues = this.calculateCareValues(pet.hiddenCounters);
    pet.careValues = careValues;

    // Update life based on overall care
    const avgCare = (careValues.satiety + careValues.hydration + careValues.happiness) / 3;
    if (avgCare < 30 && this.tuning) {
      // Pet is neglected, decrease life
      pet.hiddenCounters.lifeTicks = Math.max(
        0,
        pet.hiddenCounters.lifeTicks - (this.tuning.life.decayWhenNeglected * ticks) / 60,
      );
    } else if (
      avgCare > 70 &&
      this.tuning &&
      pet.hiddenCounters.lifeTicks < this.tuning.life.startingValue
    ) {
      // Pet is well cared for, recover life
      pet.hiddenCounters.lifeTicks = Math.min(
        this.tuning.life.startingValue,
        pet.hiddenCounters.lifeTicks + (this.tuning.life.recoveryRatePerHour * ticks) / 60,
      );
    }

    // Check if pet has sicknesses and apply life decay
    if (pet.sicknesses.length > 0 && this.tuning) {
      // Life decay based on total sickness severity
      const totalSeverity = pet.sicknesses.reduce((sum, s) => sum + s.severity, 0);
      const decayMultiplier = Math.min(1, totalSeverity / 100);
      pet.hiddenCounters.lifeTicks = Math.max(
        0,
        pet.hiddenCounters.lifeTicks -
          (this.tuning.sickness.lifeDecayPerHour * decayMultiplier * ticks) / 60,
      );
    }
  }

  /**
   * Feed the pet
   */
  public async feed(gameState: GameState, foodItem: Item): Promise<CareActionResult> {
    if (!gameState.pet) {
      return { success: false, message: 'No active pet' };
    }

    if (!this.tuning) {
      return { success: false, message: 'Configuration not loaded' };
    }

    const pet = gameState.pet;

    // Cast to FoodItem and determine effect based on size
    const food = foodItem as FoodItem;
    let ticksToAdd = 0;
    const effectSize = food.effectSize || 'SMALL';

    if (effectSize === 'SMALL') {
      ticksToAdd =
        ((this.tuning.items.foodEffects?.SMALL || 20) * this.tuning.careTickMultipliers.satiety) /
        100;
    } else if (effectSize === 'MEDIUM') {
      ticksToAdd =
        ((this.tuning.items.foodEffects?.MEDIUM || 40) * this.tuning.careTickMultipliers.satiety) /
        100;
    } else if (effectSize === 'LARGE') {
      ticksToAdd =
        ((this.tuning.items.foodEffects?.LARGE || 60) * this.tuning.careTickMultipliers.satiety) /
        100;
    }

    // Add ticks to satiety
    const oldValue = this.calculateCareValues(pet.hiddenCounters).satiety;
    pet.hiddenCounters.satietyTicks = Math.min(
      this.tuning.careTickMultipliers.satiety * 100,
      pet.hiddenCounters.satietyTicks + ticksToAdd,
    );

    const newValue = this.calculateCareValues(pet.hiddenCounters).satiety;
    pet.careValues = this.calculateCareValues(pet.hiddenCounters);
    pet.lastInteractionTime = Date.now();

    // Queue update for inventory system to consume item
    if (this.gameUpdateWriter) {
      const update: GameUpdate = {
        id: this.generateId(),
        type: UPDATE_TYPES.USER_ACTION,
        timestamp: Date.now(),
        payload: {
          action: 'CONSUME_ITEM',
          data: { itemId: foodItem.id },
          source: 'PetSystem',
          targetSystem: 'InventorySystem',
        },
      };
      this.gameUpdateWriter.enqueue(update);
    }

    return {
      success: true,
      message: `${pet.name} ate the ${foodItem.name}!`,
      valueChange: newValue - oldValue,
      newValue,
      itemConsumed: true,
    };
  }

  /**
   * Give the pet a drink
   */
  public async drink(gameState: GameState, drinkItem: Item): Promise<CareActionResult> {
    if (!gameState.pet) {
      return { success: false, message: 'No active pet' };
    }

    if (!this.tuning) {
      return { success: false, message: 'Configuration not loaded' };
    }

    const pet = gameState.pet;

    // Cast to DrinkItem and determine effect based on size
    const drink = drinkItem as DrinkItem;
    let ticksToAdd = 0;
    const effectSize = drink.effectSize || 'SMALL';

    if (effectSize === 'SMALL') {
      ticksToAdd =
        ((this.tuning.items.drinkEffects?.SMALL || 20) *
          this.tuning.careTickMultipliers.hydration) /
        100;
    } else if (effectSize === 'MEDIUM') {
      ticksToAdd =
        ((this.tuning.items.drinkEffects?.MEDIUM || 40) *
          this.tuning.careTickMultipliers.hydration) /
        100;
    } else if (effectSize === 'LARGE') {
      ticksToAdd =
        ((this.tuning.items.drinkEffects?.LARGE || 60) *
          this.tuning.careTickMultipliers.hydration) /
        100;
    }

    // Add ticks to hydration
    const oldValue = this.calculateCareValues(pet.hiddenCounters).hydration;
    pet.hiddenCounters.hydrationTicks = Math.min(
      this.tuning.careTickMultipliers.hydration * 100,
      pet.hiddenCounters.hydrationTicks + ticksToAdd,
    );

    const newValue = this.calculateCareValues(pet.hiddenCounters).hydration;
    pet.careValues = this.calculateCareValues(pet.hiddenCounters);
    pet.lastInteractionTime = Date.now();

    // Queue update for inventory system to consume item
    if (this.gameUpdateWriter) {
      const update: GameUpdate = {
        id: this.generateId(),
        type: UPDATE_TYPES.USER_ACTION,
        timestamp: Date.now(),
        payload: {
          action: 'CONSUME_ITEM',
          data: { itemId: drinkItem.id },
          source: 'PetSystem',
          targetSystem: 'InventorySystem',
        },
      };
      this.gameUpdateWriter.enqueue(update);
    }

    return {
      success: true,
      message: `${pet.name} drank the ${drinkItem.name}!`,
      valueChange: newValue - oldValue,
      newValue,
      itemConsumed: true,
    };
  }

  /**
   * Play with the pet
   */
  public async play(gameState: GameState, toyItem?: Item): Promise<CareActionResult> {
    if (!gameState.pet) {
      return { success: false, message: 'No active pet' };
    }

    if (!this.tuning) {
      return { success: false, message: 'Configuration not loaded' };
    }

    const pet = gameState.pet;

    // Check energy requirement for playing with toys
    let energyCost = 0;
    let ticksToAdd = 0;

    if (toyItem) {
      // Cast to ToyItem and use its properties
      const toy = toyItem as ToyItem;
      energyCost = toy.energyCost || 5;
      const effectSize = toy.effectSize || 'SMALL';

      if (effectSize === 'SMALL') {
        ticksToAdd =
          ((this.tuning.items.toyEffects?.SMALL || 15) *
            this.tuning.careTickMultipliers.happiness) /
          100;
      } else if (effectSize === 'MEDIUM') {
        ticksToAdd =
          ((this.tuning.items.toyEffects?.MEDIUM || 30) *
            this.tuning.careTickMultipliers.happiness) /
          100;
      } else if (effectSize === 'LARGE') {
        ticksToAdd =
          ((this.tuning.items.toyEffects?.LARGE || 50) *
            this.tuning.careTickMultipliers.happiness) /
          100;
      }

      if (pet.energy < energyCost) {
        return { success: false, message: 'Pet is too tired to play with toys' };
      }
    } else {
      // Simple play without toy - no energy cost, smaller happiness gain
      ticksToAdd = (10 * this.tuning.careTickMultipliers.happiness) / 100;
    }

    // Add ticks to happiness
    const oldValue = this.calculateCareValues(pet.hiddenCounters).happiness;
    pet.hiddenCounters.happinessTicks = Math.min(
      this.tuning.careTickMultipliers.happiness * 100,
      pet.hiddenCounters.happinessTicks + ticksToAdd,
    );

    const newValue = this.calculateCareValues(pet.hiddenCounters).happiness;
    pet.careValues = this.calculateCareValues(pet.hiddenCounters);
    pet.lastInteractionTime = Date.now();

    // Deduct energy if using toy
    if (toyItem && energyCost > 0) {
      pet.energy -= energyCost;

      // Handle toy durability if applicable
      const toy = toyItem as ToyItem;
      if (toy.durability !== undefined && this.gameUpdateWriter) {
        const update: GameUpdate = {
          id: this.generateId(),
          type: UPDATE_TYPES.USER_ACTION,
          timestamp: Date.now(),
          payload: {
            action: 'USE_ITEM_DURABILITY',
            data: { itemId: toyItem.id },
            source: 'PetSystem',
            targetSystem: 'InventorySystem',
          },
        };
        this.gameUpdateWriter.enqueue(update);
      }
    }

    return {
      success: true,
      message: toyItem
        ? `${pet.name} played with the ${toyItem.name}!`
        : `You played with ${pet.name}!`,
      valueChange: newValue - oldValue,
      newValue,
      energyCost,
    };
  }

  /**
   * Clean poop
   */
  public async cleanPoop(gameState: GameState, amount?: number): Promise<CareActionResult> {
    if (!gameState.pet) {
      return { success: false, message: 'No active pet' };
    }

    const pet = gameState.pet;

    if (pet.poopCount === 0) {
      return { success: false, message: 'No poop to clean' };
    }

    const oldCount = pet.poopCount;

    if (amount !== undefined) {
      // Clean specific amount (e.g., from hygiene items)
      pet.poopCount = Math.max(0, pet.poopCount - amount);
    } else {
      // Clean all poop instantly
      pet.poopCount = 0;
    }

    const cleaned = oldCount - pet.poopCount;
    pet.lastInteractionTime = Date.now();

    return {
      success: true,
      message: cleaned === oldCount ? 'All poop has been cleaned!' : `Cleaned ${cleaned} poop!`,
      valueChange: -cleaned,
      newValue: pet.poopCount,
    };
  }

  /**
   * Generate a random poop spawn interval
   */
  private generatePoopInterval(): number {
    if (!this.tuning) {
      // Default to 12 hours if tuning not available
      return 12 * 60;
    }
    const minTicks = this.tuning.poop.spawnRangeHours.min * 60;
    const maxTicks = this.tuning.poop.spawnRangeHours.max * 60;
    return Math.floor(minTicks + Math.random() * (maxTicks - minTicks));
  }

  /**
   * Check and spawn poop
   */
  private async checkPoopSpawn(gameState: GameState): Promise<void> {
    if (!gameState.pet) return;

    if (!this.tuning) return;

    const pet = gameState.pet;

    // Check if pet is sleeping (check for active sleep timer)
    const isAsleep = gameState.world.activeTimers.some(
      (timer) => timer.type === 'sleep' && !timer.paused,
    );

    // Decrement the counter
    if (pet.hiddenCounters.poopTicks > 0) {
      pet.hiddenCounters.poopTicks--;
    }

    // If counter reaches 0 and pet is awake, spawn poop and reset counter
    if (pet.hiddenCounters.poopTicks <= 0) {
      if (!isAsleep) {
        pet.poopCount++;
        pet.hiddenCounters.poopTicks = this.generatePoopInterval();
        console.log(
          `Poop spawned! Count: ${pet.poopCount}, Next in ${pet.hiddenCounters.poopTicks} ticks`,
        );
      }
      // If asleep, counter stays at 0 and will spawn on next tick after waking
    }
  }

  /**
   * Check for sickness
   */
  private async checkSickness(gameState: GameState): Promise<void> {
    if (!gameState.pet) return;

    if (!this.tuning) return;

    const pet = gameState.pet;

    // Calculate sickness chance
    let sicknessChance = this.tuning.sickness.baseChancePerHour / 60; // Per tick chance

    // Increase chance based on poop
    if (pet.poopCount >= this.tuning.poop.sicknessThreshold) {
      sicknessChance *= this.tuning.sickness.poopMultiplier;
    }

    // Roll for sickness
    if (Math.random() * 100 < sicknessChance) {
      // Determine sickness type
      const sicknessType =
        pet.poopCount >= this.tuning.poop.sicknessThreshold
          ? SICKNESS_TYPES.POOP_SICKNESS
          : SICKNESS_TYPES.COMMON_COLD;

      // Check if pet already has this sickness
      const existingSickness = pet.sicknesses.find((s) => s.type === sicknessType);

      if (!existingSickness) {
        const newSickness: Sickness = {
          type: sicknessType,
          severity: 20 + Math.random() * 30, // 20-50 severity
          appliedAt: Date.now(),
        };

        pet.sicknesses.push(newSickness);
        console.log(`${pet.name} got ${sicknessType}! Severity: ${newSickness.severity}`);
      }
    }
  }

  /**
   * Treat sickness with medicine
   */
  public async treatSickness(gameState: GameState, medicineItem: Item): Promise<CareActionResult> {
    if (!gameState.pet) {
      return { success: false, message: 'No active pet' };
    }

    const pet = gameState.pet;

    if (pet.sicknesses.length === 0) {
      return { success: false, message: `${pet.name} is not sick` };
    }

    if (!this.tuning) {
      return { success: false, message: 'Configuration not loaded' };
    }

    // Medicine treats all sicknesses
    const effectiveness = this.tuning.items.medicineEffectiveness;

    // Reduce severity of all sicknesses
    pet.sicknesses = pet.sicknesses
      .map((sickness) => ({
        ...sickness,
        severity: Math.max(0, sickness.severity - effectiveness),
      }))
      .filter((sickness) => sickness.severity > 0); // Remove cured sicknesses

    // Queue update to consume medicine
    if (this.gameUpdateWriter) {
      const update: GameUpdate = {
        id: this.generateId(),
        type: UPDATE_TYPES.USER_ACTION,
        timestamp: Date.now(),
        payload: {
          action: 'CONSUME_ITEM',
          data: { itemId: medicineItem.id },
          source: 'PetSystem',
          targetSystem: 'InventorySystem',
        },
      };
      this.gameUpdateWriter.enqueue(update);
    }

    return {
      success: true,
      message:
        pet.sicknesses.length === 0
          ? `${pet.name} has been cured!`
          : `${pet.name}'s condition improved!`,
      itemConsumed: true,
    };
  }

  /**
   * Treat injury with bandage
   */
  public async treatInjury(gameState: GameState, bandageItem: Item): Promise<CareActionResult> {
    if (!gameState.pet) {
      return { success: false, message: 'No active pet' };
    }

    const pet = gameState.pet;

    if (pet.injuries.length === 0) {
      return { success: false, message: `${pet.name} is not injured` };
    }

    if (!this.tuning) {
      return { success: false, message: 'Configuration not loaded' };
    }

    // Bandage treats all injuries
    const effectiveness = this.tuning.items.bandageEffectiveness;

    // Reduce severity of all injuries
    pet.injuries = pet.injuries
      .map((injury) => ({
        ...injury,
        severity: Math.max(0, injury.severity - effectiveness),
      }))
      .filter((injury) => injury.severity > 0); // Remove healed injuries

    // Queue update to consume bandage
    if (this.gameUpdateWriter) {
      const update: GameUpdate = {
        id: this.generateId(),
        type: UPDATE_TYPES.USER_ACTION,
        timestamp: Date.now(),
        payload: {
          action: 'CONSUME_ITEM',
          data: { itemId: bandageItem.id },
          source: 'PetSystem',
          targetSystem: 'InventorySystem',
        },
      };
      this.gameUpdateWriter.enqueue(update);
    }

    return {
      success: true,
      message:
        pet.injuries.length === 0
          ? `${pet.name}'s injury has been healed!`
          : `${pet.name}'s injury is healing!`,
      itemConsumed: true,
    };
  }

  /**
   * Check growth stage advancement eligibility
   */
  public checkGrowthStage(gameState: GameState): GrowthCheckResult {
    const result: GrowthCheckResult = {
      canAdvance: false,
      currentStage: GROWTH_STAGES.HATCHLING,
      timeInStage: 0,
      requiredTime: 0,
      meetsCareCriteria: false,
    };

    if (!gameState.pet) {
      return result;
    }

    if (!this.tuning) {
      return result;
    }

    const pet = gameState.pet;
    const now = Date.now();

    result.currentStage = pet.stage;
    result.timeInStage = (now - pet.stageStartTime) / (1000 * 60 * 60); // Hours

    // Check if can advance
    if (pet.stage === GROWTH_STAGES.HATCHLING) {
      result.requiredTime = this.tuning.growth.stageDurations?.HATCHLING || 24;
      result.nextStage = GROWTH_STAGES.JUVENILE;
    } else if (pet.stage === GROWTH_STAGES.JUVENILE) {
      result.requiredTime = this.tuning.growth.stageDurations?.JUVENILE || 72;
      result.nextStage = GROWTH_STAGES.ADULT;
    } else {
      // Already adult
      return result;
    }

    // Check time requirement
    const meetsTimeReq = result.timeInStage >= result.requiredTime;

    // Check care criteria (basic care maintained)
    const careValues = this.calculateCareValues(pet.hiddenCounters);
    const avgCare = (careValues.satiety + careValues.hydration + careValues.happiness) / 3;
    result.meetsCareCriteria = avgCare >= 50; // At least 50% average care

    result.canAdvance = meetsTimeReq && result.meetsCareCriteria;

    return result;
  }

  /**
   * Advance pet to next growth stage
   */
  public async advanceStage(gameState: GameState): Promise<CareActionResult> {
    if (!gameState.pet) {
      return { success: false, message: 'No active pet' };
    }

    const checkResult = this.checkGrowthStage(gameState);

    if (!checkResult.canAdvance || !checkResult.nextStage) {
      return {
        success: false,
        message: checkResult.meetsCareCriteria
          ? `Not enough time in current stage (${checkResult.timeInStage.toFixed(1)}/${checkResult.requiredTime} hours)`
          : 'Pet needs better care before advancing',
      };
    }

    if (!this.tuning) {
      return { success: false, message: 'Configuration not loaded' };
    }

    const pet = gameState.pet;
    const oldStage = pet.stage;

    // Advance stage
    pet.stage = checkResult.nextStage;
    pet.stageStartTime = Date.now();

    // Apply stat bonuses
    const bonuses = this.tuning.growth.stageAdvancementBonuses;
    pet.stats.maxHealth += bonuses.health;
    pet.stats.health = pet.stats.maxHealth; // Full heal on advancement
    pet.stats.attack += bonuses.attack;
    pet.stats.defense += bonuses.defense;
    pet.stats.speed += bonuses.speed;
    pet.stats.maxAction += bonuses.action;
    pet.stats.action = pet.stats.maxAction; // Full action on advancement

    // Update max energy
    pet.maxEnergy = this.tuning.energy.maxByStage[pet.stage] || 120;
    pet.energy = pet.maxEnergy; // Full energy on advancement

    return {
      success: true,
      message: `${pet.name} has grown from ${oldStage} to ${pet.stage}! Stats increased!`,
    };
  }

  /**
   * Check critical conditions (life threshold check)
   */
  private async checkCriticalConditions(gameState: GameState): Promise<void> {
    if (!gameState.pet) return;

    if (!this.tuning) return;

    const pet = gameState.pet;

    // Check if pet should die from neglect
    if (pet.hiddenCounters.lifeTicks <= 0) {
      await this.handlePetDeath(gameState, 'neglect');
    } else if (pet.hiddenCounters.lifeTicks < this.tuning.life.criticalThreshold) {
      // Pet is in critical condition, send warning
      console.warn(`${pet.name} is in critical condition! Life: ${pet.hiddenCounters.lifeTicks}`);
    }
  }

  /**
   * Handle pet death
   */
  private async handlePetDeath(gameState: GameState, cause: DeathCause): Promise<void> {
    if (!gameState.pet) return;

    const pet = gameState.pet;
    const now = Date.now();

    // Create memorial
    const memorial: PetMemorial = {
      id: pet.id,
      name: pet.name,
      species: pet.species,
      rarity: pet.rarity,
      birthTime: pet.birthTime,
      deathTime: now,
      causeOfDeath: cause,
      finalStage: pet.stage,
      daysLived: Math.floor((now - pet.birthTime) / (1000 * 60 * 60 * 24)),
    };

    // Add to memorials
    if (!gameState.collections.memorials) {
      gameState.collections.memorials = [];
    }
    gameState.collections.memorials.push(memorial);

    // Set pet status to dead
    pet.status.primary = STATUS_TYPES.DEAD;

    // Queue death notification
    if (this.gameUpdateWriter) {
      const update: GameUpdate = {
        id: this.generateId(),
        type: UPDATE_TYPES.STATE_TRANSITION,
        timestamp: Date.now(),
        payload: {
          action: 'PET_DEATH',
          data: {
            petId: pet.id,
            cause,
            memorial,
          },
          source: 'PetSystem',
        },
      };
      this.gameUpdateWriter.enqueue(update);
    }

    console.log(`${pet.name} has died from ${cause}`);
  }

  /**
   * Revive pet with an egg
   */
  public async revivePet(gameState: GameState, eggId: string): Promise<CareActionResult> {
    if (gameState.pet && gameState.pet.status.primary !== STATUS_TYPES.DEAD) {
      return { success: false, message: 'Pet is not dead' };
    }

    // Check if egg exists
    const egg = gameState.collections.eggs?.find((e) => e.id === eggId);
    if (!egg) {
      return { success: false, message: 'Egg not found' };
    }

    // Queue egg hatching through EggSystem
    if (this.gameUpdateWriter) {
      const update: GameUpdate = {
        id: this.generateId(),
        type: UPDATE_TYPES.USER_ACTION,
        timestamp: Date.now(),
        payload: {
          action: 'HATCH_EGG_FOR_REVIVAL',
          data: { eggId },
          source: 'PetSystem',
          targetSystem: 'EggSystem',
        },
      };
      this.gameUpdateWriter.enqueue(update);
    }

    return {
      success: true,
      message: 'Starting egg hatching for revival...',
    };
  }

  /**
   * Process offline care decay
   */
  public async processOfflineCareDecay(
    offlineCalculation: OfflineCalculation,
    gameState: GameState,
  ): Promise<void> {
    if (!gameState.pet) return;

    const pet = gameState.pet;

    // Apply care decay from offline calculation
    pet.hiddenCounters.satietyTicks = Math.max(
      0,
      pet.hiddenCounters.satietyTicks - offlineCalculation.ticksToProcess,
    );
    pet.hiddenCounters.hydrationTicks = Math.max(
      0,
      pet.hiddenCounters.hydrationTicks - offlineCalculation.ticksToProcess,
    );
    pet.hiddenCounters.happinessTicks = Math.max(
      0,
      pet.hiddenCounters.happinessTicks - offlineCalculation.ticksToProcess,
    );

    // Apply life changes
    if (offlineCalculation.careDecay.life) {
      pet.hiddenCounters.lifeTicks = Math.max(
        0,
        pet.hiddenCounters.lifeTicks - offlineCalculation.careDecay.life,
      );
    }

    // Process poop spawning during offline time
    if (offlineCalculation.ticksToProcess > 0) {
      await this.processOfflinePoopSpawning(pet, offlineCalculation);
    }

    // Update sickness if triggered
    if (offlineCalculation.sicknessTriggered) {
      // Add a common cold from offline time
      const existingSickness = pet.sicknesses.find((s) => s.type === SICKNESS_TYPES.COMMON_COLD);
      if (!existingSickness) {
        pet.sicknesses.push({
          type: SICKNESS_TYPES.COMMON_COLD,
          severity: 30, // Medium severity for offline sickness
          appliedAt: Date.now(),
        });
      }
    }

    // Update care values from counters
    pet.careValues = this.calculateCareValues(pet.hiddenCounters);

    // Check if pet died during offline
    if (offlineCalculation.petDied) {
      await this.handlePetDeath(gameState, 'neglect');
    }
  }

  /**
   * Apply injury to pet (from battle or activity mishap)
   */
  public async applyInjury(
    gameState: GameState,
    severity: number,
    source: string,
  ): Promise<CareActionResult> {
    if (!gameState.pet) {
      return { success: false, message: 'No active pet' };
    }

    const pet = gameState.pet;

    // Add injury based on source
    const injuryType =
      severity > 50
        ? INJURY_TYPES.FRACTURE
        : severity > 25
          ? INJURY_TYPES.SPRAIN
          : INJURY_TYPES.BRUISE;

    const bodyPart = source === 'battle' ? BODY_PARTS.BODY : BODY_PARTS.LEG;

    // Check if similar injury exists
    const existingInjury = pet.injuries.find(
      (i) => i.type === injuryType && i.bodyPart === bodyPart,
    );

    if (existingInjury) {
      // Increase severity of existing injury
      existingInjury.severity = Math.min(100, existingInjury.severity + severity / 2);
    } else {
      // Add new injury
      pet.injuries.push({
        type: injuryType,
        severity: Math.min(100, severity),
        bodyPart,
        appliedAt: Date.now(),
      });
    }

    // Reduce happiness from injury
    if (this.tuning) {
      const happinessPenalty = (severity / 2) * this.tuning.careTickMultipliers.happiness;
      pet.hiddenCounters.happinessTicks = Math.max(
        0,
        pet.hiddenCounters.happinessTicks - happinessPenalty,
      );
      pet.careValues = this.calculateCareValues(pet.hiddenCounters);
    }

    console.log(`${pet.name} was injured! Severity: ${severity} from ${source}`);

    return {
      success: true,
      message: `${pet.name} has been injured!`,
      valueChange: severity,
    };
  }

  /**
   * Get movement speed modifier based on injury status
   * Returns a multiplier (1.0 = normal speed, 0.5 = half speed)
   */
  public getMovementSpeedModifier(pet: Pet): number {
    if (pet.injuries.length === 0) {
      return 1.0;
    }

    // Calculate speed penalty based on leg injuries
    const legInjuries = pet.injuries.filter((i) => i.bodyPart === BODY_PARTS.LEG);
    const otherInjuries = pet.injuries.filter((i) => i.bodyPart !== BODY_PARTS.LEG);

    let speedModifier = 1.0;

    // Leg injuries have more impact on movement
    if (legInjuries.length > 0) {
      const maxLegSeverity = Math.max(...legInjuries.map((i) => i.severity));
      if (maxLegSeverity <= 25) {
        speedModifier *= 0.9;
      } else if (maxLegSeverity <= 50) {
        speedModifier *= 0.7;
      } else if (maxLegSeverity <= 75) {
        speedModifier *= 0.4;
      } else {
        speedModifier *= 0.2;
      }
    }

    // Other injuries have less impact
    if (otherInjuries.length > 0) {
      const maxOtherSeverity = Math.max(...otherInjuries.map((i) => i.severity));
      speedModifier *= 1 - maxOtherSeverity / 200; // Max 50% penalty from non-leg injuries
    }

    return Math.max(0.1, speedModifier); // Never go below 10% speed
  }

  /**
   * Check if an activity is blocked due to injury
   * Returns true if the activity is blocked
   */
  public isActivityBlocked(pet: Pet, activityType: string): boolean {
    if (pet.injuries.length === 0) {
      return false;
    }

    // Get the most severe injury
    const maxSeverity = Math.max(...pet.injuries.map((i) => i.severity));
    const hasFracture = pet.injuries.some((i) => i.type === INJURY_TYPES.FRACTURE);

    // Training is blocked for any injury
    if (activityType === 'TRAINING') {
      return true;
    }

    // Mining is blocked for moderate or severe injuries, or any fracture
    if (activityType === 'MINING' && (maxSeverity > 25 || hasFracture)) {
      return true;
    }

    // Arena/Battle activities are blocked for severe injuries
    if ((activityType === 'ARENA' || activityType === 'BATTLE') && maxSeverity > 50) {
      return true;
    }

    // Long duration activities blocked for severe injuries
    if (activityType === 'LONG_ACTIVITY' && maxSeverity > 75) {
      return true;
    }

    return false;
  }

  /**
   * Get injury status message
   */
  public getInjuryStatusMessage(pet: Pet): string | null {
    if (pet.injuries.length === 0) {
      return null;
    }

    // Build a message based on all injuries
    const messages: string[] = [];

    for (const injury of pet.injuries) {
      let severityText = '';
      if (injury.severity <= 25) {
        severityText = 'minor';
      } else if (injury.severity <= 50) {
        severityText = 'moderate';
      } else if (injury.severity <= 75) {
        severityText = 'severe';
      } else {
        severityText = 'critical';
      }

      messages.push(`${severityText} ${injury.type} on ${injury.bodyPart}`);
    }

    const speedModifier = this.getMovementSpeedModifier(pet);
    let movementText = '';
    if (speedModifier >= 0.9) {
      movementText = 'movement slightly reduced';
    } else if (speedModifier >= 0.7) {
      movementText = 'movement reduced';
    } else if (speedModifier >= 0.4) {
      movementText = 'movement greatly reduced';
    } else {
      movementText = 'movement minimal';
    }

    return `${pet.name} has ${messages.join(', ')} (${movementText})`;
  }

  /**
   * Process injury recovery over time (passive healing)
   */
  public async processInjuryRecovery(ticks: number, gameState: GameState): Promise<void> {
    if (!gameState.pet) return;

    const pet = gameState.pet;

    if (pet.injuries.length === 0) return;

    if (!this.tuning) return;

    // Passive recovery rate from tuning
    const recoveryRate = this.tuning.injury?.recoveryRatePerHour || 5;
    const recoveryAmount = (recoveryRate * ticks) / 60;

    // Apply recovery to all injuries
    pet.injuries = pet.injuries
      .map((injury) => ({
        ...injury,
        severity: Math.max(0, injury.severity - recoveryAmount),
      }))
      .filter((injury) => injury.severity > 0); // Remove healed injuries

    // Check if fully recovered
    if (pet.injuries.length === 0) {
      console.log(`${pet.name} has fully recovered from all injuries!`);
    }
  }

  /**
   * Get pet status summary
   */
  public getPetSummary(pet: Pet): string {
    const careValues = this.calculateCareValues(pet.hiddenCounters);
    const avgCare = (careValues.satiety + careValues.hydration + careValues.happiness) / 3;

    let status = `${pet.name} (${pet.species}, ${pet.stage})\n`;
    status += `Energy: ${pet.energy}/${pet.maxEnergy}\n`;
    status += `Satiety: ${careValues.satiety}%\n`;
    status += `Hydration: ${careValues.hydration}%\n`;
    status += `Happiness: ${careValues.happiness}%\n`;
    status += `Status: ${pet.status.primary}\n`;

    // Add injury details if injured
    if (pet.injuries.length > 0) {
      const injuryMsg = this.getInjuryStatusMessage(pet);
      if (injuryMsg) {
        status += `${injuryMsg}\n`;
      }
    }

    // Add sickness details if sick
    if (pet.sicknesses.length > 0) {
      const sicknesses = pet.sicknesses
        .map((s) => `${s.type} (severity: ${s.severity.toFixed(0)})`)
        .join(', ');
      status += `Sicknesses: ${sicknesses}\n`;
    }

    status += `Poop: ${pet.poopCount}\n`;

    if (avgCare < 30) {
      status += '⚠️ Pet needs immediate care!';
    } else if (avgCare < 50) {
      status += '⚠️ Pet needs attention';
    } else if (avgCare > 80) {
      status += '✨ Pet is very happy!';
    }

    return status;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Apply training stat increase
   */
  public applyTrainingStatIncrease(
    gameState: GameState,
    targetStat: StatType,
    increaseAmount: number,
  ): CareActionResult {
    if (!gameState.pet) {
      return { success: false, message: 'No active pet' };
    }

    const pet = gameState.pet;
    const oldValue = pet.stats[targetStat as keyof BattleStats] as number;

    // Apply stat increase based on target stat
    switch (targetStat) {
      case 'health':
        pet.stats.maxHealth += increaseAmount;
        pet.stats.health += increaseAmount; // Also increase current health
        break;
      case 'attack':
        pet.stats.attack += increaseAmount;
        break;
      case 'defense':
        pet.stats.defense += increaseAmount;
        break;
      case 'speed':
        pet.stats.speed += increaseAmount;
        break;
      case 'action':
        pet.stats.maxAction += increaseAmount;
        pet.stats.action += increaseAmount; // Also increase current action
        break;
    }

    // Update training count
    pet.trainingCounts[targetStat] += 1;

    const newValue = pet.stats[targetStat as keyof BattleStats] as number;

    return {
      success: true,
      message: `${pet.name}'s ${targetStat} increased by ${increaseAmount}!`,
      valueChange: newValue - oldValue,
      newValue,
    };
  }

  /**
   * Learn a new move
   */
  public learnMove(gameState: GameState, moveId: string, replaceIndex?: number): CareActionResult {
    if (!gameState.pet) {
      return { success: false, message: 'No active pet' };
    }

    const pet = gameState.pet;

    // Check if pet already knows the move
    if (pet.moves.includes(moveId)) {
      return { success: false, message: `${pet.name} already knows this move!` };
    }

    // Check move limit
    if (pet.moves.length >= BATTLE_CONSTANTS.MAX_MOVES) {
      if (replaceIndex === undefined || replaceIndex < 0 || replaceIndex >= pet.moves.length) {
        return {
          success: false,
          message: `${pet.name} already knows ${BATTLE_CONSTANTS.MAX_MOVES} moves. Choose a move to replace.`,
        };
      }

      // Replace the move at the specified index
      const oldMove = pet.moves[replaceIndex];
      pet.moves[replaceIndex] = moveId;

      return {
        success: true,
        message: `${pet.name} forgot ${oldMove} and learned ${moveId}!`,
      };
    }

    // Add the new move
    pet.moves.push(moveId);

    return {
      success: true,
      message: `${pet.name} learned ${moveId}!`,
    };
  }

  /**
   * Get the pet's known moves
   */
  public getKnownMoves(pet: Pet): string[] {
    return [...pet.moves];
  }

  /**
   * Check if pet can learn more moves
   */
  public canLearnMoreMoves(pet: Pet): boolean {
    return pet.moves.length < BATTLE_CONSTANTS.MAX_MOVES;
  }

  /**
   * Process offline poop spawning
   */
  private async processOfflinePoopSpawning(
    pet: Pet,
    offlineCalc: OfflineCalculation,
  ): Promise<void> {
    if (!this.tuning) return;

    let ticksToProcess = offlineCalc.ticksToProcess;
    let poopSpawned = 0;

    // Check if pet was sleeping (check energy recovery)
    const wasAsleep = offlineCalc.energyRecovered > 0;

    // Process ticks
    while (ticksToProcess > 0 && pet.hiddenCounters.poopTicks > 0) {
      pet.hiddenCounters.poopTicks--;
      ticksToProcess--;

      // If counter reaches 0
      if (pet.hiddenCounters.poopTicks <= 0) {
        if (wasAsleep) {
          // If pet was sleeping, counter stays at 0
          // The poop will spawn on the next tick after waking
          break;
        } else {
          // Pet was awake, spawn poop and reset counter
          poopSpawned++;
          pet.hiddenCounters.poopTicks = this.generatePoopInterval();
        }
      }
    }

    // Handle any remaining ticks if pet was awake and counter was already 0
    if (!wasAsleep && ticksToProcess > 0 && pet.hiddenCounters.poopTicks <= 0) {
      // Calculate how many full intervals passed
      const minTicks = this.tuning.poop.spawnRangeHours.min * 60;
      const maxTicks = this.tuning.poop.spawnRangeHours.max * 60;
      const avgInterval = (minTicks + maxTicks) / 2;

      const additionalPoops = Math.floor(ticksToProcess / avgInterval);
      poopSpawned += additionalPoops;

      // Set counter for remaining time
      const remainingTicks = ticksToProcess % avgInterval;
      pet.hiddenCounters.poopTicks = this.generatePoopInterval() - remainingTicks;
    }

    // Apply spawned poops
    if (poopSpawned > 0) {
      pet.poopCount += poopSpawned;
      offlineCalc.poopSpawned = poopSpawned;
      console.log(`Offline: ${poopSpawned} poop(s) spawned. Total: ${pet.poopCount}`);
    }
  }

  /**
   * Process training completion (called by GameEngine when activity completes)
   */
  public processTrainingCompletion(
    gameState: GameState,
    trainingResult: {
      targetStat: StatType;
      statIncrease: number;
      newMove?: string;
      moveReplaced?: string;
    },
  ): CareActionResult {
    if (!gameState.pet) {
      return { success: false, message: 'No active pet' };
    }

    // Apply stat increase
    const statResult = this.applyTrainingStatIncrease(
      gameState,
      trainingResult.targetStat,
      trainingResult.statIncrease,
    );

    let message = statResult.message;

    // Handle move learning if applicable
    if (trainingResult.newMove) {
      if (trainingResult.moveReplaced) {
        // Find the index of the move to replace
        const replaceIndex = gameState.pet.moves.indexOf(trainingResult.moveReplaced);
        if (replaceIndex >= 0) {
          const moveResult = this.learnMove(gameState, trainingResult.newMove, replaceIndex);
          message += ` ${moveResult.message}`;
        }
      } else {
        // Just add the new move
        const moveResult = this.learnMove(gameState, trainingResult.newMove);
        message += ` ${moveResult.message}`;
      }
    }

    return {
      success: true,
      message,
    };
  }
}
