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
} from '../models/Pet';
import type { Item, FoodItem, DrinkItem, ToyItem } from '../models/Item';
import { UPDATE_TYPES, GROWTH_STAGES, STATUS_TYPES, BATTLE_CONSTANTS } from '../models/constants';
import type { GrowthStage, RarityTier, DeathCause, StatType } from '../models/constants';
import { STARTER_MOVES } from '../data/moves';

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
  private poopSpawnTimer = 0;

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
    this.poopSpawnTimer = 0;
  }

  /**
   * System-specific reset
   */
  protected async onReset(): Promise<void> {
    this.petCache = null;
    this.lastDecayTick = 0;
    this.poopSpawnTimer = 0;
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
      },

      // Status
      status: {
        primary: STATUS_TYPES.HEALTHY,
      },
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
  private getStarterMoves(_species: string): string[] {
    // Look up species-specific starter moves, or use default
    // For now, using a default set
    // TODO: In future, use _species to look up specific starter moves
    return STARTER_MOVES.default ? [...STARTER_MOVES.default] : ['tackle', 'growl'];
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

    // Check if pet is sick and apply life decay
    if (pet.status.primary === STATUS_TYPES.SICK && this.tuning) {
      pet.hiddenCounters.lifeTicks = Math.max(
        0,
        pet.hiddenCounters.lifeTicks - (this.tuning.sickness.lifeDecayPerHour * ticks) / 60,
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
        priority: 0,
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
        priority: 0,
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
          priority: 0,
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
   * Check and spawn poop
   */
  private async checkPoopSpawn(gameState: GameState): Promise<void> {
    if (!gameState.pet) return;

    if (!this.tuning) return;

    const pet = gameState.pet;

    // Only spawn poop when awake
    // TODO: Check if pet is sleeping when sleep system is implemented

    // Increment spawn timer
    this.poopSpawnTimer++;

    // Calculate spawn interval (in ticks/minutes)
    const minTicks = this.tuning.poop.spawnRangeHours.min * 60;
    const maxTicks = this.tuning.poop.spawnRangeHours.max * 60;
    const spawnInterval = minTicks + Math.random() * (maxTicks - minTicks);

    if (this.poopSpawnTimer >= spawnInterval) {
      pet.poopCount++;
      this.poopSpawnTimer = 0;

      console.log(`Poop spawned! Count: ${pet.poopCount}`);
    }
  }

  /**
   * Check for sickness
   */
  private async checkSickness(gameState: GameState): Promise<void> {
    if (!gameState.pet) return;

    if (!this.tuning) return;

    const pet = gameState.pet;

    // Skip if already sick
    if (pet.status.primary === STATUS_TYPES.SICK) return;

    // Calculate sickness chance
    let sicknessChance = this.tuning.sickness.baseChancePerHour / 60; // Per tick chance

    // Increase chance based on poop
    if (pet.poopCount >= this.tuning.poop.sicknessThreshold) {
      sicknessChance *= this.tuning.sickness.poopMultiplier;
    }

    // Roll for sickness
    if (Math.random() * 100 < sicknessChance) {
      pet.status.primary = STATUS_TYPES.SICK;
      pet.status.sicknessSeverity = 20 + Math.random() * 30; // 20-50 severity

      console.log(`${pet.name} got sick! Severity: ${pet.status.sicknessSeverity}`);
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

    if (pet.status.primary !== STATUS_TYPES.SICK) {
      return { success: false, message: `${pet.name} is not sick` };
    }

    if (!this.tuning) {
      return { success: false, message: 'Configuration not loaded' };
    }

    // Reduce sickness severity
    const effectiveness = this.tuning.items.medicineEffectiveness;
    pet.status.sicknessSeverity = Math.max(0, (pet.status.sicknessSeverity || 0) - effectiveness);

    // Cure if severity is 0
    if (pet.status.sicknessSeverity <= 0) {
      pet.status.primary = STATUS_TYPES.HEALTHY;
      pet.status.sicknessSeverity = undefined;
    }

    // Queue update to consume medicine
    if (this.gameUpdateWriter) {
      const update: GameUpdate = {
        id: this.generateId(),
        type: UPDATE_TYPES.USER_ACTION,
        timestamp: Date.now(),
        priority: 0,
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
        pet.status.primary === STATUS_TYPES.HEALTHY
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

    if (pet.status.primary !== STATUS_TYPES.INJURED) {
      return { success: false, message: `${pet.name} is not injured` };
    }

    if (!this.tuning) {
      return { success: false, message: 'Configuration not loaded' };
    }

    // Reduce injury severity
    const effectiveness = this.tuning.items.bandageEffectiveness;
    pet.status.injurySeverity = Math.max(0, (pet.status.injurySeverity || 0) - effectiveness);

    // Heal if severity is 0
    if (pet.status.injurySeverity <= 0) {
      pet.status.primary = STATUS_TYPES.HEALTHY;
      pet.status.injurySeverity = undefined;
    }

    // Queue update to consume bandage
    if (this.gameUpdateWriter) {
      const update: GameUpdate = {
        id: this.generateId(),
        type: UPDATE_TYPES.USER_ACTION,
        timestamp: Date.now(),
        priority: 0,
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
        pet.status.primary === STATUS_TYPES.HEALTHY
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
        priority: 1,
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
        priority: 1,
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

    // Update poop count
    if (offlineCalculation.poopSpawned) {
      pet.poopCount += offlineCalculation.poopSpawned;
    }

    // Update sickness if triggered
    if (offlineCalculation.sicknessTriggered && pet.status.primary === STATUS_TYPES.HEALTHY) {
      pet.status.primary = STATUS_TYPES.SICK;
      pet.status.sicknessSeverity = 30; // Medium severity for offline sickness
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

    // Set injured status
    pet.status.primary = STATUS_TYPES.INJURED;
    pet.status.injurySeverity = Math.min(100, severity);

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
    if (pet.status.primary !== STATUS_TYPES.INJURED) {
      return 1.0;
    }

    const severity = pet.status.injurySeverity || 0;

    // Injury slows movement based on severity
    // Severity 0-25: 90% speed
    // Severity 26-50: 75% speed
    // Severity 51-75: 50% speed
    // Severity 76-100: 25% speed
    if (severity <= 25) {
      return 0.9;
    } else if (severity <= 50) {
      return 0.75;
    } else if (severity <= 75) {
      return 0.5;
    } else {
      return 0.25;
    }
  }

  /**
   * Check if an activity is blocked due to injury
   * Returns true if the activity is blocked
   */
  public isActivityBlocked(pet: Pet, activityType: string): boolean {
    if (pet.status.primary !== STATUS_TYPES.INJURED) {
      return false;
    }

    const severity = pet.status.injurySeverity || 0;

    // Training is blocked for any injury
    if (activityType === 'TRAINING') {
      return true;
    }

    // Mining is blocked for moderate or severe injuries
    if (activityType === 'MINING' && severity > 25) {
      return true;
    }

    // Arena/Battle activities are blocked for severe injuries
    if ((activityType === 'ARENA' || activityType === 'BATTLE') && severity > 50) {
      return true;
    }

    // Long duration activities blocked for severe injuries
    if (activityType === 'LONG_ACTIVITY' && severity > 75) {
      return true;
    }

    return false;
  }

  /**
   * Get injury status message
   */
  public getInjuryStatusMessage(pet: Pet): string | null {
    if (pet.status.primary !== STATUS_TYPES.INJURED) {
      return null;
    }

    const severity = pet.status.injurySeverity || 0;

    if (severity <= 25) {
      return `${pet.name} has minor injuries (movement slightly reduced)`;
    } else if (severity <= 50) {
      return `${pet.name} is moderately injured (movement reduced, cannot train or mine)`;
    } else if (severity <= 75) {
      return `${pet.name} is severely injured (movement greatly reduced, many activities blocked)`;
    } else {
      return `${pet.name} is critically injured (movement minimal, most activities blocked)`;
    }
  }

  /**
   * Process injury recovery over time (passive healing)
   */
  public async processInjuryRecovery(ticks: number, gameState: GameState): Promise<void> {
    if (!gameState.pet) return;

    const pet = gameState.pet;

    if (pet.status.primary !== STATUS_TYPES.INJURED) return;

    if (!this.tuning) return;

    // Passive recovery rate from tuning
    const recoveryRate = this.tuning.injury?.recoveryRatePerHour || 5;
    const recoveryAmount = (recoveryRate * ticks) / 60;

    pet.status.injurySeverity = Math.max(0, (pet.status.injurySeverity || 0) - recoveryAmount);

    // Fully recovered
    if (pet.status.injurySeverity <= 0) {
      pet.status.primary = STATUS_TYPES.HEALTHY;
      pet.status.injurySeverity = undefined;
      console.log(`${pet.name} has fully recovered from injuries!`);
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
    if (pet.status.primary === STATUS_TYPES.INJURED) {
      const injuryMsg = this.getInjuryStatusMessage(pet);
      if (injuryMsg) {
        status += `${injuryMsg}\n`;
      }
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
