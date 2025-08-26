/**
 * Species definitions and related models
 */

import { GROWTH_STAGES } from './constants';
import type {
  RarityTier,
  GrowthStage,
  PetTemperament,
  PetHabitat,
  ActivityPreference,
  PetAbilityEffect,
} from './constants';

/**
 * Base stats for a species at a given growth stage
 */
export interface SpeciesBaseStats {
  health: number;
  attack: number;
  defense: number;
  speed: number;
  action: number;
}

/**
 * Visual appearance data for a species
 */
export interface SpeciesAppearance {
  spriteSheet: string; // Path to sprite sheet
  animations: {
    idle: number[]; // Frame indices for idle animation
    happy: number[]; // Frame indices for happy animation
    sad: number[]; // Frame indices for sad animation
    sick: number[]; // Frame indices for sick animation
    sleeping: number[]; // Frame indices for sleeping animation
    eating: number[]; // Frame indices for eating animation
    playing: number[]; // Frame indices for playing animation
  };
  defaultColor: string;
  availableColors?: string[];
  size: {
    width: number;
    height: number;
  };
}

/**
 * Species characteristics and personality
 */
export interface SpeciesTraits {
  temperament: PetTemperament;
  favoriteFood?: string[]; // Item IDs of preferred foods
  favoriteToys?: string[]; // Item IDs of preferred toys
  habitat: PetHabitat;
  activityPreference: ActivityPreference; // Active time preference
}

/**
 * Complete Species definition
 */
export interface Species {
  id: string;
  name: string;
  description: string;
  rarity: RarityTier;

  // Base stats by growth stage
  baseStats: {
    [GROWTH_STAGES.HATCHLING]: SpeciesBaseStats;
    [GROWTH_STAGES.JUVENILE]: SpeciesBaseStats;
    [GROWTH_STAGES.ADULT]: SpeciesBaseStats;
  };

  // Visual data
  appearance: SpeciesAppearance;

  // Characteristics
  traits: SpeciesTraits;

  // Learnable moves
  learnableMoves: {
    moveId: string;
    learnStage: GrowthStage;
    learnChance: number; // Percentage chance to learn during training
  }[];

  // Starting moves for newly hatched pets
  startingMoves: string[]; // Array of move IDs

  // Care requirements modifiers (multipliers)
  careModifiers?: {
    satietyDecay?: number; // Default 1.0
    hydrationDecay?: number; // Default 1.0
    happinessDecay?: number; // Default 1.0
    energyUsage?: number; // Default 1.0
  };

  // Special abilities or passive effects
  abilities?: {
    id: string;
    name: string;
    description: string;
    effect: PetAbilityEffect;
    value: number; // Percentage or multiplier
  }[];

  // Egg data
  eggSprite: string; // Path to egg sprite
  incubationTime: number; // Hours required for hatching

  // Metadata
  isStarter: boolean; // Can be selected as a starter
  isEventExclusive: boolean; // Only available during events
  unlockConditions?: string; // Description of how to unlock
}

/**
 * Starter species selection data
 */
export interface StarterSpecies {
  speciesId: string;
  name: string;
  description: string;
  sprite: string;
  traits: string[]; // Simple trait descriptions for UI
}

/**
 * Species collection entry for tracking discovered species
 */
export interface SpeciesCollectionEntry {
  speciesId: string;
  discovered: boolean;
  firstDiscoveredDate?: number;
  totalOwned: number;
  totalHatched: number;
  favoriteIndividual?: {
    petId: string;
    petName: string;
  };
}

/**
 * Egg type definitions
 */
export interface EggType {
  id: string;
  name: string;
  description: string;
  sprite: string;

  // Possible species that can hatch from this egg
  possibleSpecies: {
    speciesId: string;
    weight: number; // Relative weight for random selection
  }[];

  // Rarity distribution override (optional)
  rarityWeights?: {
    [key in RarityTier]?: number;
  };

  baseIncubationTime: number; // Base hours (can be modified by species)
}

/**
 * Egg instance in inventory or incubating
 */
export interface Egg {
  id: string;
  eggType: string; // References EggType
  obtainedTime: number;
  incubationStartTime?: number;
  incubationEndTime?: number;
  isIncubating: boolean;
  determinedSpecies?: string; // Predetermined at egg creation if needed
}
