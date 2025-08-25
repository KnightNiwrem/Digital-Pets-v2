/**
 * EggSystem - Manages egg incubation, hatching mechanics, and species determination
 */

import { BaseSystem } from './BaseSystem';
import type { GameUpdateWriter } from '../engine/GameUpdatesQueue';
import type { SystemInitOptions, SystemError } from './BaseSystem';
import type { GameState, GameUpdate, OfflineCalculation } from '../models/GameState';
import type { Egg, EggType, Species, StarterSpecies } from '../models/Species';
import type { Pet, PetCreationOptions } from '../models/Pet';
import type { EggItem } from '../models/Item';
import { UPDATE_TYPES, RARITY_TIERS } from '../models/constants';
import type { RarityTier } from '../models/constants';
import { getAllSpecies } from '../data/species';
import { getAllEggTypes } from '../data/eggTypes';

/**
 * Incubation status for an egg
 */
export interface IncubationStatus {
  eggId: string;
  isIncubating: boolean;
  startTime?: number;
  endTime?: number;
  remainingTime?: number; // in milliseconds
  progress: number; // 0 to 100
}

/**
 * Egg hatching result
 */
export interface HatchResult {
  success: boolean;
  pet?: Pet;
  species?: Species;
  message: string;
}

/**
 * Starter selection options
 */
export interface StarterOptions {
  available: boolean;
  species: StarterSpecies[];
  reason?: string;
}

/**
 * EggSystem class implementation
 */
export class EggSystem extends BaseSystem {
  private incubatingEggs: Map<string, Egg> = new Map();
  private speciesDatabase: Map<string, Species> = new Map();
  private eggTypeDatabase: Map<string, EggType> = new Map();

  // Common starter species IDs
  private readonly STARTER_SPECIES_IDS = ['starter_fire', 'starter_water', 'starter_grass'];

  constructor(gameUpdateWriter: GameUpdateWriter) {
    super('EggSystem', gameUpdateWriter);
  }

  /**
   * System-specific initialization
   */
  protected async onInitialize(_options: SystemInitOptions): Promise<void> {
    // Tuning values are now provided via the base class
    if (!this.tuning) {
      console.warn('[EggSystem] Tuning values not provided, some features may not work correctly');
    }

    // Load species and egg type data from TypeScript files
    await this.loadSpeciesData();
    await this.loadEggTypes();
  }

  /**
   * System-specific shutdown
   */
  protected async onShutdown(): Promise<void> {
    this.incubatingEggs.clear();
    this.speciesDatabase.clear();
    this.eggTypeDatabase.clear();
  }

  /**
   * System-specific reset
   */
  protected async onReset(): Promise<void> {
    this.incubatingEggs.clear();
  }

  /**
   * Process game tick
   */
  protected async onTick(_deltaTime: number, gameState: GameState): Promise<void> {
    // Check for completed incubations
    await this.checkIncubationCompletions(gameState);
  }

  /**
   * Update system based on state changes
   */
  protected async onUpdate(gameState: GameState, _prevState?: GameState): Promise<void> {
    // Sync incubating eggs from game state
    this.syncIncubatingEggs(gameState);
  }

  /**
   * Handle system errors
   */
  protected onError(error: SystemError): void {
    console.error(`[EggSystem] Error occurred:`, error);
  }

  /**
   * Load species data from TypeScript file
   */
  private async loadSpeciesData(): Promise<void> {
    try {
      // Load all species from the data file
      const allSpecies = getAllSpecies();

      for (const species of allSpecies) {
        this.speciesDatabase.set(species.id, species);
      }

      console.log(`[EggSystem] Loaded ${this.speciesDatabase.size} species from data file`);
    } catch (error) {
      console.error('[EggSystem] CRITICAL: Failed to load species data:', error);
      throw new Error(
        `Failed to load species data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Load egg type data from TypeScript file
   */
  private async loadEggTypes(): Promise<void> {
    try {
      // Load all egg types from the data file
      const allEggTypes = getAllEggTypes();

      for (const eggType of allEggTypes) {
        this.eggTypeDatabase.set(eggType.id, eggType);
      }

      console.log(`[EggSystem] Loaded ${this.eggTypeDatabase.size} egg types from data file`);
    } catch (error) {
      console.error('[EggSystem] CRITICAL: Failed to load egg type data:', error);
      throw new Error(
        `Failed to load egg type data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Start incubating an egg
   */
  public async startIncubation(gameState: GameState, eggItem: EggItem): Promise<boolean> {
    if (!gameState.collections) {
      gameState.collections = { eggs: [], species: {}, memorials: [] };
    }

    const eggType = this.eggTypeDatabase.get(eggItem.eggType);
    if (!eggType) {
      console.error(`Unknown egg type: ${eggItem.eggType}`);
      return false;
    }

    const now = Date.now();
    // Get incubation time from tuning values based on rarity
    const rarity = eggItem.guaranteedRarity || 'COMMON';
    const incubationHoursMap = this.tuning?.eggs?.incubationHours || {
      COMMON: 12,
      UNCOMMON: 18,
      RARE: 24,
      EPIC: 36,
      LEGENDARY: 48,
    };
    const incubationHours = eggType.baseIncubationTime || incubationHoursMap[rarity] || 12;

    const egg: Egg = {
      id: this.generateId(),
      eggType: eggItem.eggType,
      obtainedTime: now, // EggItem doesn't have obtainedTime, use current time
      incubationStartTime: now,
      incubationEndTime: now + incubationHours * 60 * 60 * 1000,
      isIncubating: true,
      determinedSpecies: eggItem.guaranteedSpecies,
    };

    // Add to collections
    gameState.collections.eggs.push(egg);
    this.incubatingEggs.set(egg.id, egg);

    // Queue update for inventory to remove egg item
    if (this.gameUpdateWriter) {
      const update: GameUpdate = {
        id: this.generateId(),
        type: UPDATE_TYPES.USER_ACTION,
        timestamp: now,
        payload: {
          action: 'CONSUME_ITEM',
          data: { itemId: eggItem.id },
          source: 'EggSystem',
          targetSystem: 'InventorySystem',
        },
      };
      this.gameUpdateWriter.enqueue(update);
    }

    console.log(
      `Started incubating egg ${egg.id}, will hatch at ${new Date(egg.incubationEndTime || now)}`,
    );
    return true;
  }

  /**
   * Check incubation status of an egg
   */
  public checkIncubationStatus(eggId: string): IncubationStatus {
    const egg = this.incubatingEggs.get(eggId);

    if (!egg) {
      return {
        eggId,
        isIncubating: false,
        progress: 0,
      };
    }

    const now = Date.now();
    const startTime = egg.incubationStartTime || now;
    const endTime = egg.incubationEndTime || now;
    const totalTime = endTime - startTime;
    const elapsedTime = now - startTime;
    const remainingTime = Math.max(0, endTime - now);
    const progress = totalTime > 0 ? Math.min(100, (elapsedTime / totalTime) * 100) : 0;

    return {
      eggId,
      isIncubating: egg.isIncubating,
      startTime,
      endTime,
      remainingTime,
      progress,
    };
  }

  /**
   * Hatch an egg that has completed incubation
   */
  public async hatchEgg(gameState: GameState, eggId: string): Promise<HatchResult> {
    const egg = gameState.collections?.eggs?.find((e) => e.id === eggId);

    if (!egg) {
      return { success: false, message: 'Egg not found' };
    }

    if (!egg.isIncubating) {
      return { success: false, message: 'Egg is not incubating' };
    }

    const now = Date.now();
    if (egg.incubationEndTime && now < egg.incubationEndTime) {
      const remaining = egg.incubationEndTime - now;
      const hours = Math.ceil(remaining / (1000 * 60 * 60));
      return { success: false, message: `Egg needs ${hours} more hours to hatch` };
    }

    // Roll for species
    const species = await this.rollSpecies(egg.eggType, egg.determinedSpecies);
    if (!species) {
      return { success: false, message: 'Failed to determine species' };
    }

    // Create the new pet
    const petCreationOptions: PetCreationOptions = {
      name: species.name, // Default name, can be changed later
      species: species.id,
      fromEgg: true,
    };

    // Remove egg from collections
    if (gameState.collections?.eggs) {
      gameState.collections.eggs = gameState.collections.eggs.filter((e) => e.id !== eggId);
    }
    this.incubatingEggs.delete(eggId);

    // Queue pet creation through PetSystem
    if (this.gameUpdateWriter) {
      const update: GameUpdate = {
        id: this.generateId(),
        type: UPDATE_TYPES.STATE_TRANSITION,
        timestamp: now,
        payload: {
          action: 'CREATE_PET_FROM_EGG',
          data: {
            petOptions: petCreationOptions,
            speciesData: species,
          },
          source: 'EggSystem',
          targetSystem: 'PetSystem',
        },
      };
      this.gameUpdateWriter.enqueue(update);
    }

    return {
      success: true,
      species,
      message: `A ${species.name} hatched from the egg!`,
    };
  }

  /**
   * Roll for species based on egg type
   */
  private async rollSpecies(
    eggTypeId: string,
    guaranteedSpecies?: string,
  ): Promise<Species | null> {
    // If species is predetermined, return it
    if (guaranteedSpecies) {
      return this.speciesDatabase.get(guaranteedSpecies) || null;
    }

    const eggType = this.eggTypeDatabase.get(eggTypeId);
    if (!eggType) {
      console.error(`Unknown egg type: ${eggTypeId}`);
      return null;
    }

    // First roll for rarity if custom weights are provided
    let targetRarity: RarityTier | null = null;
    if (eggType.rarityWeights) {
      targetRarity = this.rollRarity(eggType.rarityWeights);
    }

    // Then roll for species within that rarity
    const possibleSpecies = eggType.possibleSpecies;
    if (possibleSpecies.length === 0) {
      return null;
    }

    // Filter by rarity if specified
    let filteredSpecies = possibleSpecies;
    if (targetRarity) {
      filteredSpecies = possibleSpecies.filter((ps) => {
        const species = this.speciesDatabase.get(ps.speciesId);
        return species?.rarity === targetRarity;
      });
    }

    // If no species match the rarity, use all species
    if (filteredSpecies.length === 0) {
      filteredSpecies = possibleSpecies;
    }

    // Calculate total weight
    const totalWeight = filteredSpecies.reduce((sum, ps) => sum + ps.weight, 0);
    if (totalWeight === 0) {
      return null;
    }

    // Roll for species
    const roll = Math.random() * totalWeight;
    let currentWeight = 0;

    for (const ps of filteredSpecies) {
      currentWeight += ps.weight;
      if (roll <= currentWeight) {
        return this.speciesDatabase.get(ps.speciesId) || null;
      }
    }

    // Fallback to first species
    return this.speciesDatabase.get(filteredSpecies[0]?.speciesId || '') || null;
  }

  /**
   * Roll for rarity based on weights
   */
  private rollRarity(weights: Partial<Record<RarityTier, number>>): RarityTier {
    const defaultWeights = this.tuning?.eggs?.rarityWeights || {
      COMMON: 60,
      UNCOMMON: 25,
      RARE: 10,
      EPIC: 4,
      LEGENDARY: 1,
    };

    // Use provided weights or defaults
    const finalWeights = {
      ...defaultWeights,
      ...weights,
    };

    const totalWeight = Object.values(finalWeights).reduce((sum, w) => sum + w, 0);
    const roll = Math.random() * totalWeight;
    let currentWeight = 0;

    for (const [rarity, weight] of Object.entries(finalWeights)) {
      currentWeight += weight;
      if (roll <= currentWeight) {
        return rarity as RarityTier;
      }
    }

    return RARITY_TIERS.COMMON; // Fallback
  }

  /**
   * Get starter species options
   */
  public getStarterOptions(gameState: GameState): StarterOptions {
    // Check if player has no pet and no eggs
    const hasPet = gameState.pet !== null && gameState.pet !== undefined;
    const hasEggs = (gameState.collections?.eggs?.length || 0) > 0;

    if (hasPet || hasEggs) {
      return {
        available: false,
        species: [],
        reason: hasPet ? 'You already have a pet' : 'You have eggs to hatch',
      };
    }

    // Get starter species
    const starters: StarterSpecies[] = [];
    for (const speciesId of this.STARTER_SPECIES_IDS) {
      const species = this.speciesDatabase.get(speciesId);
      if (species && species.isStarter) {
        starters.push({
          speciesId: species.id,
          name: species.name,
          description: species.description,
          sprite: species.appearance.spriteSheet,
          traits: [
            species.traits.temperament,
            species.traits.habitat,
            species.traits.activityPreference,
          ],
        });
      }
    }

    return {
      available: true,
      species: starters,
    };
  }

  /**
   * Select a starter species and create a pet
   */
  public async selectStarter(gameState: GameState, speciesId: string): Promise<HatchResult> {
    const starterOptions = this.getStarterOptions(gameState);

    if (!starterOptions.available) {
      return {
        success: false,
        message: starterOptions.reason || 'Cannot select starter',
      };
    }

    const species = this.speciesDatabase.get(speciesId);
    if (!species || !species.isStarter) {
      return {
        success: false,
        message: 'Invalid starter species',
      };
    }

    // Create the pet
    const petCreationOptions: PetCreationOptions = {
      name: species.name, // Default name
      species: species.id,
      isStarter: true,
    };

    // Queue pet creation
    if (this.gameUpdateWriter) {
      const update: GameUpdate = {
        id: this.generateId(),
        type: UPDATE_TYPES.STATE_TRANSITION,
        timestamp: Date.now(),
        payload: {
          action: 'CREATE_STARTER_PET',
          data: {
            petOptions: petCreationOptions,
            speciesData: species,
          },
          source: 'EggSystem',
          targetSystem: 'PetSystem',
        },
      };
      this.gameUpdateWriter.enqueue(update);
    }

    return {
      success: true,
      species,
      message: `You chose ${species.name} as your starter!`,
    };
  }

  /**
   * Process offline incubation
   */
  public async processOfflineIncubation(
    offlineCalculation: OfflineCalculation,
    gameState: GameState,
  ): Promise<void> {
    if (!gameState.collections?.eggs) {
      return;
    }

    const completedEggs: string[] = [];
    const now = Date.now();
    // offlineEndTime was unused, removing it

    for (const egg of gameState.collections.eggs) {
      if (!egg.isIncubating) continue;

      // Check if egg completed during offline time
      if (egg.incubationEndTime && egg.incubationEndTime <= now) {
        completedEggs.push(egg.id);
        egg.isIncubating = false;
      }
    }

    // Add completed eggs to offline calculation result
    offlineCalculation.eggsHatched = completedEggs;

    if (completedEggs.length > 0) {
      console.log(`${completedEggs.length} egg(s) completed incubation while offline`);
    }
  }

  /**
   * Check for eggs that have completed incubation
   */
  private async checkIncubationCompletions(gameState: GameState): Promise<void> {
    if (!gameState.collections?.eggs) return;

    const now = Date.now();
    const completedEggs: Egg[] = [];

    for (const egg of gameState.collections.eggs) {
      if (egg.isIncubating && egg.incubationEndTime && egg.incubationEndTime <= now) {
        completedEggs.push(egg);
      }
    }

    // Queue notifications for completed eggs
    for (const egg of completedEggs) {
      if (this.gameUpdateWriter) {
        const update: GameUpdate = {
          id: this.generateId(),
          type: UPDATE_TYPES.STATE_TRANSITION,
          timestamp: now,
          payload: {
            action: 'EGG_READY_TO_HATCH',
            data: { eggId: egg.id },
            source: 'EggSystem',
          },
        };
        this.gameUpdateWriter.enqueue(update);
      }

      // Mark as not incubating (but don't remove - player must manually hatch)
      egg.isIncubating = false;
      this.incubatingEggs.delete(egg.id);
    }
  }

  /**
   * Sync incubating eggs from game state
   */
  private syncIncubatingEggs(gameState: GameState): void {
    this.incubatingEggs.clear();

    if (!gameState.collections?.eggs) return;

    for (const egg of gameState.collections.eggs) {
      if (egg.isIncubating) {
        this.incubatingEggs.set(egg.id, egg);
      }
    }
  }

  /**
   * Get all incubating eggs
   */
  public getIncubatingEggs(): Egg[] {
    return Array.from(this.incubatingEggs.values());
  }

  /**
   * Get egg by ID
   */
  public getEgg(gameState: GameState, eggId: string): Egg | null {
    return gameState.collections?.eggs?.find((e) => e.id === eggId) || null;
  }

  /**
   * Get species data by ID
   */
  public getSpecies(speciesId: string): Species | null {
    return this.speciesDatabase.get(speciesId) || null;
  }

  /**
   * Add an egg to inventory (from rewards, shop, etc.)
   */
  public async addEgg(
    gameState: GameState,
    eggTypeId: string,
    options?: {
      guaranteedSpecies?: string;
      guaranteedRarity?: RarityTier;
    },
  ): Promise<Egg> {
    if (!gameState.collections) {
      gameState.collections = { eggs: [], species: {}, memorials: [] };
    }

    const egg: Egg = {
      id: this.generateId(),
      eggType: eggTypeId,
      obtainedTime: Date.now(),
      isIncubating: false,
      determinedSpecies: options?.guaranteedSpecies,
    };

    gameState.collections.eggs.push(egg);

    console.log(`Added egg ${egg.id} of type ${eggTypeId} to inventory`);
    return egg;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
