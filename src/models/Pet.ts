/**
 * Pet-related data models and interfaces
 */

import type {
  RarityTier,
  GrowthStage,
  StatusType,
  BattleStatusEffect,
  DeathCause,
  SicknessType,
  InjuryType,
  BodyPart,
} from './constants';

/**
 * Battle statistics for a pet
 */
export interface BattleStats {
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  speed: number;
  action: number;
  maxAction: number;
}

/**
 * Visible care values shown to the player
 * These are computed from hidden tick counters
 */
export interface CareValues {
  readonly satiety: number; // 0-100, computed from satietyTicks
  readonly hydration: number; // 0-100, computed from hydrationTicks
  readonly happiness: number; // 0-100, computed from happinessTicks
}

/**
 * Hidden tick counters for care values
 * These are used for precise calculations and offline catch-up
 */
export interface HiddenCounters {
  satietyTicks: number;
  hydrationTicks: number;
  happinessTicks: number;
  lifeTicks: number; // Hidden wellness value
  poopTicks: number; // Ticks until next poop spawns
}

/**
 * Sickness condition object
 */
export interface Sickness {
  type: SicknessType;
  severity: number; // 0-100
  duration?: number; // Remaining ticks or timestamp for auto-recovery
  appliedAt: number; // When the sickness was applied
}

/**
 * Injury condition object
 */
export interface Injury {
  type: InjuryType;
  severity: number; // 0-100
  bodyPart: BodyPart;
  appliedAt: number; // When the injury was applied
}

/**
 * Pet status (exclusive state only)
 */
export interface PetStatus {
  primary: StatusType; // Exclusive state (IDLE, SLEEPING, TRAVELING, etc.)
  battleEffect?: BattleStatusEffect; // Active battle status effect (for battles only)
}

/**
 * Complete Pet model
 */
export interface Pet {
  id: string;
  name: string;
  species: string; // References a Species definition
  rarity: RarityTier;
  stage: GrowthStage;

  // Time tracking
  birthTime: number; // Timestamp when pet was created/hatched
  stageStartTime: number; // Timestamp when current stage began
  lastInteractionTime: number; // Timestamp of last player interaction

  // Stats and values
  stats: BattleStats;
  energy: number; // Current energy (0 to max based on stage)
  maxEnergy: number; // Maximum energy based on stage

  // Care system
  careValues: CareValues;
  hiddenCounters: HiddenCounters;

  // Status and conditions
  status: PetStatus;
  sicknesses: Sickness[]; // Array of active sicknesses
  injuries: Injury[]; // Array of active injuries
  poopCount: number;

  // Battle moves (up to 4)
  moves: string[]; // Array of move IDs

  // Experience and progression
  experiencePoints: number;
  trainingCounts: {
    health: number;
    attack: number;
    defense: number;
    speed: number;
    action: number;
  };

  // Customization (future expansion)
  appearance?: {
    color?: string;
    pattern?: string;
    accessory?: string;
  };
}

/**
 * Pet creation options for new pets
 */
export interface PetCreationOptions {
  name: string;
  species: string;
  fromEgg?: boolean; // Whether this pet was hatched from an egg
  isStarter?: boolean; // Whether this is a starter pet selection
}

/**
 * Pet memorial entry for deceased pets
 */
export interface PetMemorial {
  id: string;
  name: string;
  species: string;
  rarity: RarityTier;
  birthTime: number;
  deathTime: number;
  causeOfDeath: DeathCause; // Battle cannot cause death, only injury
  finalStage: GrowthStage;
  daysLived: number;
}

/**
 * Pet snapshot for save states
 */
export interface PetSnapshot {
  pet: Pet;
  timestamp: number;
  gameVersion: string;
}
