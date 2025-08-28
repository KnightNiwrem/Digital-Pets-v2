/**
 * Battle moves database
 * Contains all learnable moves in the game
 */

import type { BattleMove } from '../models/BattleMove';
import type { GrowthStage, StatType } from '../models/constants';

/**
 * Move learning requirements by stat focus
 */
export interface MoveLearnRequirement {
  moveId: string;
  statFocus: StatType;
  minStage?: GrowthStage;
  minStatValue?: number;
  learnChance: number; // Percentage chance to learn during training
}

/**
 * All available battle moves
 */
export const BATTLE_MOVES: Record<string, BattleMove> = {
  // Basic moves (starter moves)
  tackle: {
    id: 'tackle',
    name: 'Tackle',
    description: 'A basic physical attack',
    actionCost: 20,
    power: 30,
    accuracy: 95,
    priority: 0,
    moveType: 'damage',
    targetType: 'enemy',
    animation: 'tackle',
    soundEffect: 'hit_normal',
  },

  scratch: {
    id: 'scratch',
    name: 'Scratch',
    description: 'Scratch the opponent with sharp claws',
    actionCost: 15,
    power: 25,
    accuracy: 100,
    priority: 0,
    moveType: 'damage',
    targetType: 'enemy',
    animation: 'scratch',
    soundEffect: 'hit_slash',
  },

  bite: {
    id: 'bite',
    name: 'Bite',
    description: 'Bite the opponent with sharp teeth',
    actionCost: 25,
    power: 35,
    accuracy: 90,
    priority: 0,
    moveType: 'damage',
    targetType: 'enemy',
    animation: 'bite',
    soundEffect: 'hit_bite',
  },

  growl: {
    id: 'growl',
    name: 'Growl',
    description: 'Intimidate the opponent to lower their attack',
    actionCost: 10,
    power: 0,
    accuracy: 100,
    priority: 0,
    moveType: 'status',
    targetType: 'enemy',
    animation: 'growl',
    soundEffect: 'growl_sound',
  },

  // Attack-focused moves
  slash: {
    id: 'slash',
    name: 'Slash',
    description: 'A powerful slashing attack',
    actionCost: 30,
    power: 45,
    accuracy: 90,
    priority: 0,
    moveType: 'damage',
    targetType: 'enemy',
    animation: 'slash',
    soundEffect: 'hit_slash',
    additionalEffects: {
      criticalBonus: 10,
    },
    learnRequirements: {
      minStage: 'JUVENILE',
      minStat: {
        stat: 'attack',
        value: 30,
      },
    },
  },

  pound: {
    id: 'pound',
    name: 'Pound',
    description: 'Strike with full force',
    actionCost: 35,
    power: 50,
    accuracy: 85,
    priority: 0,
    moveType: 'damage',
    targetType: 'enemy',
    animation: 'pound',
    soundEffect: 'hit_heavy',
  },

  fury_swipes: {
    id: 'fury_swipes',
    name: 'Fury Swipes',
    description: 'Attack multiple times in succession',
    actionCost: 40,
    power: 18,
    accuracy: 80,
    priority: 0,
    moveType: 'damage',
    targetType: 'enemy',
    animation: 'fury_swipes',
    soundEffect: 'hit_multi',
    additionalEffects: {
      multiHit: {
        min: 2,
        max: 5,
      },
    },
  },

  mega_punch: {
    id: 'mega_punch',
    name: 'Mega Punch',
    description: 'An incredibly powerful punch',
    actionCost: 50,
    power: 80,
    accuracy: 75,
    priority: 0,
    moveType: 'damage',
    targetType: 'enemy',
    animation: 'mega_punch',
    soundEffect: 'hit_critical',
    learnRequirements: {
      minStage: 'ADULT',
      minStat: {
        stat: 'attack',
        value: 50,
      },
    },
  },

  // Defense-focused moves
  harden: {
    id: 'harden',
    name: 'Harden',
    description: 'Increase defense by hardening the body',
    actionCost: 15,
    power: 0,
    accuracy: 100,
    priority: 0,
    moveType: 'status',
    targetType: 'self',
    animation: 'harden',
    soundEffect: 'buff_defense',
  },

  protect: {
    id: 'protect',
    name: 'Protect',
    description: 'Greatly increase defense for a short time',
    actionCost: 30,
    power: 0,
    accuracy: 100,
    priority: 2,
    moveType: 'status',
    targetType: 'self',
    animation: 'protect',
    soundEffect: 'shield_up',
    learnRequirements: {
      minStage: 'JUVENILE',
      minStat: {
        stat: 'defense',
        value: 35,
      },
    },
  },

  counter: {
    id: 'counter',
    name: 'Counter',
    description: 'Return damage to the attacker',
    actionCost: 35,
    power: 0,
    accuracy: 100,
    priority: -1,
    moveType: 'counter',
    targetType: 'enemy',
    animation: 'counter',
    soundEffect: 'counter_hit',
    conditionalPower: {
      condition: 'LAST_DAMAGE_TAKEN',
      powerModifier: 1.5,
    },
  },

  iron_defense: {
    id: 'iron_defense',
    name: 'Iron Defense',
    description: 'Drastically increase defense',
    actionCost: 40,
    power: 0,
    accuracy: 100,
    priority: 0,
    moveType: 'status',
    targetType: 'self',
    animation: 'iron_defense',
    soundEffect: 'metallic_buff',
    learnRequirements: {
      minStage: 'ADULT',
      minStat: {
        stat: 'defense',
        value: 50,
      },
    },
  },

  // Speed-focused moves
  quick_attack: {
    id: 'quick_attack',
    name: 'Quick Attack',
    description: 'Always strikes first',
    actionCost: 20,
    power: 25,
    accuracy: 100,
    priority: 1,
    moveType: 'damage',
    targetType: 'enemy',
    animation: 'quick_attack',
    soundEffect: 'hit_quick',
  },

  agility: {
    id: 'agility',
    name: 'Agility',
    description: 'Sharply increase speed',
    actionCost: 15,
    power: 0,
    accuracy: 100,
    priority: 0,
    moveType: 'status',
    targetType: 'self',
    animation: 'agility',
    soundEffect: 'speed_up',
  },

  double_team: {
    id: 'double_team',
    name: 'Double Team',
    description: 'Create illusions to increase evasion',
    actionCost: 25,
    power: 0,
    accuracy: 100,
    priority: 0,
    moveType: 'status',
    targetType: 'self',
    animation: 'double_team',
    soundEffect: 'illusion',
    learnRequirements: {
      minStage: 'JUVENILE',
      minStat: {
        stat: 'speed',
        value: 30,
      },
    },
  },

  extreme_speed: {
    id: 'extreme_speed',
    name: 'Extreme Speed',
    description: 'An extremely fast attack that always goes first',
    actionCost: 45,
    power: 60,
    accuracy: 100,
    priority: 2,
    moveType: 'damage',
    targetType: 'enemy',
    animation: 'extreme_speed',
    soundEffect: 'sonic_hit',
    learnRequirements: {
      minStage: 'ADULT',
      minStat: {
        stat: 'speed',
        value: 50,
      },
    },
  },

  // Health-focused moves
  rest: {
    id: 'rest',
    name: 'Rest',
    description: 'Sleep to restore health',
    actionCost: 30,
    power: 0,
    accuracy: 100,
    priority: 0,
    moveType: 'healing',
    targetType: 'self',
    animation: 'rest',
    soundEffect: 'healing',
    statusEffect: {
      type: 'ASLEEP',
      chance: 100,
      duration: 2,
      stackable: false,
    },
  },

  recover: {
    id: 'recover',
    name: 'Recover',
    description: 'Restore a moderate amount of health',
    actionCost: 35,
    power: 0,
    accuracy: 100,
    priority: 0,
    moveType: 'healing',
    targetType: 'self',
    animation: 'recover',
    soundEffect: 'healing',
    learnRequirements: {
      minStage: 'JUVENILE',
      minStat: {
        stat: 'health',
        value: 80,
      },
    },
  },

  drain_bite: {
    id: 'drain_bite',
    name: 'Drain Bite',
    description: 'Damage opponent and restore health',
    actionCost: 35,
    power: 40,
    accuracy: 90,
    priority: 0,
    moveType: 'damage',
    targetType: 'enemy',
    animation: 'drain_bite',
    soundEffect: 'drain',
    additionalEffects: {
      drain: 50, // Heal 50% of damage dealt
    },
  },

  regenerate: {
    id: 'regenerate',
    name: 'Regenerate',
    description: 'Fully restore health over time',
    actionCost: 50,
    power: 0,
    accuracy: 100,
    priority: 0,
    moveType: 'healing',
    targetType: 'self',
    animation: 'regenerate',
    soundEffect: 'regen_start',
    statusEffect: {
      type: 'REGENERATING',
      chance: 100,
      duration: 3,
      stackable: false,
    },
    learnRequirements: {
      minStage: 'ADULT',
      minStat: {
        stat: 'health',
        value: 100,
      },
    },
  },

  // Action-focused moves
  focus: {
    id: 'focus',
    name: 'Focus',
    description: 'Restore action points and increase accuracy',
    actionCost: 0, // Free action
    power: 0,
    accuracy: 100,
    priority: 0,
    moveType: 'status',
    targetType: 'self',
    animation: 'focus',
    soundEffect: 'focus',
  },

  charge: {
    id: 'charge',
    name: 'Charge',
    description: 'Charge up for a powerful next attack',
    actionCost: 20,
    power: 0,
    accuracy: 100,
    priority: 0,
    moveType: 'status',
    targetType: 'self',
    animation: 'charge',
    soundEffect: 'charge_up',
  },

  hyper_beam: {
    id: 'hyper_beam',
    name: 'Hyper Beam',
    description: 'Unleash incredible power but needs recharge',
    actionCost: 80,
    power: 120,
    accuracy: 90,
    priority: 0,
    moveType: 'damage',
    targetType: 'enemy',
    animation: 'hyper_beam',
    soundEffect: 'beam_fire',
    additionalEffects: {
      cooldown: 1, // Must skip next turn
    },
    learnRequirements: {
      minStage: 'ADULT',
      minStat: {
        stat: 'action',
        value: 100,
      },
    },
  },

  // Status effect moves
  poison_sting: {
    id: 'poison_sting',
    name: 'Poison Sting',
    description: 'May poison the opponent',
    actionCost: 25,
    power: 30,
    accuracy: 100,
    priority: 0,
    moveType: 'damage',
    targetType: 'enemy',
    animation: 'poison_sting',
    soundEffect: 'poison_hit',
    statusEffect: {
      type: 'POISONED',
      chance: 30,
      duration: 3,
      stackable: false,
    },
  },

  paralyze: {
    id: 'paralyze',
    name: 'Paralyze',
    description: 'May paralyze the opponent',
    actionCost: 30,
    power: 0,
    accuracy: 85,
    priority: 0,
    moveType: 'status',
    targetType: 'enemy',
    animation: 'paralyze',
    soundEffect: 'electric_shock',
    statusEffect: {
      type: 'PARALYZED',
      chance: 100,
      duration: 2,
      stackable: false,
    },
  },

  confuse: {
    id: 'confuse',
    name: 'Confuse',
    description: 'Confuse the opponent',
    actionCost: 25,
    power: 0,
    accuracy: 90,
    priority: 0,
    moveType: 'status',
    targetType: 'enemy',
    animation: 'confuse',
    soundEffect: 'confusion',
    statusEffect: {
      type: 'CONFUSED',
      chance: 100,
      duration: 2,
      stackable: false,
    },
  },
};

/**
 * Move learning table by training focus
 */
export const MOVE_LEARNING_TABLE: MoveLearnRequirement[] = [
  // Attack training moves
  { moveId: 'slash', statFocus: 'attack', minStage: 'JUVENILE', minStatValue: 30, learnChance: 25 },
  { moveId: 'pound', statFocus: 'attack', minStatValue: 25, learnChance: 30 },
  {
    moveId: 'fury_swipes',
    statFocus: 'attack',
    minStage: 'JUVENILE',
    minStatValue: 35,
    learnChance: 20,
  },
  {
    moveId: 'mega_punch',
    statFocus: 'attack',
    minStage: 'ADULT',
    minStatValue: 50,
    learnChance: 15,
  },
  {
    moveId: 'drain_bite',
    statFocus: 'attack',
    minStage: 'JUVENILE',
    minStatValue: 30,
    learnChance: 20,
  },

  // Defense training moves
  { moveId: 'harden', statFocus: 'defense', learnChance: 35 },
  {
    moveId: 'protect',
    statFocus: 'defense',
    minStage: 'JUVENILE',
    minStatValue: 35,
    learnChance: 25,
  },
  {
    moveId: 'counter',
    statFocus: 'defense',
    minStage: 'JUVENILE',
    minStatValue: 40,
    learnChance: 20,
  },
  {
    moveId: 'iron_defense',
    statFocus: 'defense',
    minStage: 'ADULT',
    minStatValue: 50,
    learnChance: 15,
  },

  // Speed training moves
  { moveId: 'quick_attack', statFocus: 'speed', learnChance: 35 },
  { moveId: 'agility', statFocus: 'speed', minStatValue: 20, learnChance: 30 },
  {
    moveId: 'double_team',
    statFocus: 'speed',
    minStage: 'JUVENILE',
    minStatValue: 30,
    learnChance: 25,
  },
  {
    moveId: 'extreme_speed',
    statFocus: 'speed',
    minStage: 'ADULT',
    minStatValue: 50,
    learnChance: 15,
  },

  // Health training moves
  { moveId: 'rest', statFocus: 'health', learnChance: 30 },
  {
    moveId: 'recover',
    statFocus: 'health',
    minStage: 'JUVENILE',
    minStatValue: 80,
    learnChance: 25,
  },
  {
    moveId: 'regenerate',
    statFocus: 'health',
    minStage: 'ADULT',
    minStatValue: 100,
    learnChance: 15,
  },

  // Action training moves
  { moveId: 'focus', statFocus: 'action', learnChance: 35 },
  { moveId: 'charge', statFocus: 'action', minStatValue: 30, learnChance: 30 },
  {
    moveId: 'hyper_beam',
    statFocus: 'action',
    minStage: 'ADULT',
    minStatValue: 100,
    learnChance: 10,
  },

  // Status moves (can be learned from various training)
  { moveId: 'poison_sting', statFocus: 'attack', minStage: 'JUVENILE', learnChance: 15 },
  { moveId: 'paralyze', statFocus: 'speed', minStage: 'JUVENILE', learnChance: 15 },
  { moveId: 'confuse', statFocus: 'defense', minStage: 'JUVENILE', learnChance: 15 },
  { moveId: 'growl', statFocus: 'defense', learnChance: 25 },
];

/**
 * Get a move by ID
 */
export function getMoveById(moveId: string): BattleMove | undefined {
  return BATTLE_MOVES[moveId] || undefined;
}

/**
 * Get possible moves to learn based on training focus and pet stats
 */
export function getPossibleMovesToLearn(
  statFocus: StatType,
  petStage: GrowthStage,
  petStats: Record<StatType, number>,
  knownMoves: string[],
): MoveLearnRequirement[] {
  return MOVE_LEARNING_TABLE.filter((req) => {
    // Must match stat focus
    if (req.statFocus !== statFocus) return false;

    // Must not already know the move
    if (knownMoves.includes(req.moveId)) return false;

    // Check stage requirement
    if (req.minStage) {
      const stageOrder = ['HATCHLING', 'JUVENILE', 'ADULT'];
      const requiredIndex = stageOrder.indexOf(req.minStage);
      const currentIndex = stageOrder.indexOf(petStage);
      if (currentIndex < requiredIndex) return false;
    }

    // Check stat requirement
    if (req.minStatValue) {
      const statValue = petStats[req.statFocus];
      if (statValue < req.minStatValue) return false;
    }

    return true;
  });
}

/**
 * Starter moves for new pets
 */
export const STARTER_MOVES: Record<string, string[]> = {
  default: ['tackle', 'growl'],
  aggressive: ['scratch', 'bite'],
  defensive: ['tackle', 'harden'],
  speedy: ['quick_attack', 'agility'],
};
