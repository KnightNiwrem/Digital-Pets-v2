/**
 * Battle move and combat-related data models
 */

import type {
  MovePriority,
  BattleStatusEffect,
  GrowthStage,
  MoveType,
  TargetType,
  StatType,
  ConditionType,
  TeamType,
  BattleType,
  WeatherType,
  TerrainType,
  BattleEndReason,
  BattleLogType,
  DifficultyLevel,
  AIStrategy,
} from './constants';

/**
 * Base battle move definition
 */
export interface BattleMove {
  id: string;
  name: string;
  description: string;

  // Move properties
  actionCost: number; // Action points required to use
  power: number; // Base damage (0 for status moves)
  accuracy: number; // Hit chance percentage (0-100)
  priority: MovePriority; // Determines turn order for same-speed pets

  // Move type and category
  moveType: MoveType;
  targetType: TargetType;

  // Visual and audio
  animation: string; // Animation ID or sprite sheet reference
  soundEffect: string; // Sound file reference

  // Status effects
  statusEffect?: {
    type: BattleStatusEffect;
    chance: number; // Percentage chance to apply
    duration: number; // Number of turns
    stackable: boolean; // Can be applied multiple times
  };

  // Additional effects
  additionalEffects?: {
    drain?: number; // Percentage of damage healed
    recoil?: number; // Percentage of damage taken by user
    multiHit?: {
      min: number;
      max: number;
    };
    chargeTime?: number; // Turns needed to charge before use
    cooldown?: number; // Turns before can use again
    criticalBonus?: number; // Additional critical hit chance
  };

  // Learning requirements
  learnRequirements?: {
    minStage?: GrowthStage;
    minLevel?: number;
    minStat?: {
      stat: StatType;
      value: number;
    };
  };

  // Move variations based on conditions
  conditionalPower?: {
    condition: ConditionType;
    threshold?: number;
    powerModifier: number; // Multiplier
  };
}

/**
 * Special skip turn move (always available)
 */
export interface SkipTurnMove {
  id: 'skip_turn';
  name: 'Rest';
  description: 'Skip turn to recover Action points';
  actionRestore: number; // Amount of Action to restore
  healingPercent?: number; // Optional health recovery
}

/**
 * Battle participant (pet or NPC)
 */
export interface BattleParticipant {
  id: string;
  name: string;
  sprite: string;

  // Current battle stats
  currentHealth: number;
  maxHealth: number;
  currentAction: number;
  maxAction: number;

  // Battle stats
  attack: number;
  defense: number;
  speed: number;

  // Known moves
  moves: string[]; // Move IDs

  // Status effects
  statusEffects: {
    type: BattleStatusEffect;
    turnsRemaining: number;
    intensity: number; // Stacks or severity
  }[];

  // Battle modifiers
  statModifiers: {
    attack: number; // Multiplier
    defense: number;
    speed: number;
    accuracy: number;
    evasion: number;
  };

  // Team information
  team: TeamType;
  isWild: boolean;
  level?: number; // For wild encounters
}

/**
 * Battle state
 */
export interface BattleState {
  id: string;
  type: BattleType;
  startTime: number;

  // Participants
  participants: BattleParticipant[];
  currentTurn: number; // Index of current participant
  turnOrder: number[]; // Participant indices in turn order

  // Battle properties
  turnCount: number;
  allowFlee: boolean;
  allowItems: boolean;
  allowSwitch: boolean; // For future multi-pet battles

  // Environmental factors
  weather?: WeatherType;
  terrain?: TerrainType;

  // Battle log
  log: BattleLogEntry[];

  // Rewards (determined at battle start)
  rewards?: {
    experience: number;
    currency: number;
    items: {
      itemId: string;
      quantity: number;
      chance: number;
    }[];
  };

  // Battle result (when completed)
  result?: {
    winner: TeamType | 'draw';
    endReason: BattleEndReason;
    turnsElapsed: number;
    damageDealt: number;
    damageTaken: number;
    experienceGained: number;
    itemsReceived: {
      itemId: string;
      quantity: number;
    }[];
  };
}

/**
 * Battle log entry
 */
export interface BattleLogEntry {
  turn: number;
  timestamp: number;
  type: BattleLogType;

  // Action details
  actor?: string; // Participant ID
  target?: string; // Participant ID
  action?: string; // Move or item ID

  // Results
  damage?: number;
  healing?: number;
  statusApplied?: BattleStatusEffect;
  statusRemoved?: BattleStatusEffect;
  statChange?: {
    stat: string;
    change: number;
  };

  // Message for display
  message: string;
  important: boolean; // Highlight important messages
}

/**
 * Battle configuration for different battle types
 */
export interface BattleConfig {
  type: BattleType;

  // Difficulty settings
  difficulty: DifficultyLevel;
  levelScaling: boolean; // Scale to player pet level

  // AI behavior
  aiStrategy: AIStrategy;
  aiPredictability: number; // 0-1, how predictable the AI is

  // Battle rules
  rules: {
    maxTurns?: number; // Battle timeout
    suddenDeath?: boolean; // Instant KO at low health
    noHealing?: boolean; // Disable healing moves/items
    noStatus?: boolean; // Disable status effects
    speedMode?: boolean; // Double speed for all
  };

  // Reward modifiers
  rewardModifiers: {
    experienceMultiplier: number;
    currencyMultiplier: number;
    itemDropMultiplier: number;
  };

  // Special conditions
  specialConditions?: {
    weatherLocked?: string; // Fixed weather
    terrainLocked?: string; // Fixed terrain
    mustUseMove?: string; // Required move to win
    surviveXTurns?: number; // Survival challenge
  };
}

/**
 * Move effectiveness (type matchups - simplified for this game)
 */
export interface MoveEffectiveness {
  moveType: string;
  targetType: string;
  multiplier: number; // 0.5 for not very effective, 2 for super effective
}

/**
 * Battle formulas configuration
 */
export interface BattleFormulas {
  // Damage calculation
  damageFormula: {
    basePower: number;
    attackMultiplier: number;
    defenseMultiplier: number;
    randomRange: { min: number; max: number }; // Random factor
    criticalMultiplier: number;
  };

  // Speed and turn order
  speedFormula: {
    baseSpeed: number;
    statusPenalty: number; // Speed reduction when affected by status
    priorityBonus: number; // Bonus per priority level
  };

  // Accuracy and evasion
  accuracyFormula: {
    baseAccuracy: number;
    evasionPenalty: number;
    statusBonus: number; // Accuracy bonus/penalty from status
  };

  // Experience calculation
  experienceFormula: {
    baseExperience: number;
    levelDifference: number; // Multiplier based on level difference
    participationBonus: number; // Bonus for participating
    victoryBonus: number; // Bonus for winning
  };
}

/**
 * Battle statistics tracking
 */
export interface BattleStatistics {
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  flees: number;

  // Detailed stats
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalHealing: number;
  criticalHits: number;
  movesUsed: {
    [moveId: string]: number;
  };

  // Records
  longestBattle: number; // In turns
  shortestVictory: number; // In turns
  highestDamage: number; // Single hit
  mostConsecutiveWins: number;

  // By battle type
  byType: {
    [key: string]: {
      battles: number;
      wins: number;
    };
  };
}
