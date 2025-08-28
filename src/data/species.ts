/**
 * Species database
 * Contains all pet species in the game
 */

import type { Species } from '../models/Species';
import {
  RARITY_TIERS,
  TEMPERAMENT_TYPES,
  HABITAT_TYPES,
  ACTIVITY_PREFERENCE_TYPES,
  LEARN_STAGES,
  EFFECT_TYPES,
} from '../models/constants';

/**
 * All available pet species
 */
export const SPECIES_DATA: Record<string, Species> = {
  starter_fire: {
    id: 'starter_fire',
    name: 'Flamepup',
    description: 'A playful fire-type pet that loves warm places.',
    rarity: RARITY_TIERS.COMMON,
    baseStats: {
      HATCHLING: { health: 20, attack: 7, defense: 4, speed: 5, action: 10 },
      JUVENILE: { health: 35, attack: 12, defense: 8, speed: 8, action: 15 },
      ADULT: { health: 50, attack: 18, defense: 12, speed: 12, action: 20 },
    },
    appearance: {
      spriteSheet: 'sprites/flamepup.png',
      animations: {
        idle: [0, 1, 2, 3],
        happy: [4, 5, 6, 7],
        sad: [8, 9],
        sick: [10, 11],
        sleeping: [12, 13],
        eating: [14, 15],
        playing: [16, 17, 18],
      },
      defaultColor: '#FF6B35',
      availableColors: ['#FF6B35', '#FFA500', '#DC143C'],
      size: { width: 64, height: 64 },
    },
    traits: {
      temperament: TEMPERAMENT_TYPES.ENERGETIC,
      favoriteFood: ['spicy_berries', 'flame_fruit'],
      favoriteToys: ['fire_ball', 'lava_lamp'],
      habitat: HABITAT_TYPES.DESERT,
      activityPreference: ACTIVITY_PREFERENCE_TYPES.DIURNAL,
    },
    learnableMoves: [
      { moveId: 'ember', learnStage: LEARN_STAGES.HATCHLING, learnChance: 100 },
      { moveId: 'flame_burst', learnStage: LEARN_STAGES.JUVENILE, learnChance: 50 },
      { moveId: 'fire_spin', learnStage: LEARN_STAGES.ADULT, learnChance: 30 },
    ],
    startingMoves: ['tackle', 'ember'],
    careModifiers: {
      satietyDecay: 1.2,
      hydrationDecay: 1.3,
      happinessDecay: 0.9,
      energyUsage: 1.1,
    },
    abilities: [
      {
        id: 'heat_absorb',
        name: 'Heat Absorb',
        description: 'Reduces damage from fire attacks',
        effect: EFFECT_TYPES.DAMAGE_REDUCTION,
        value: 25,
      },
    ],
    eggSprite: 'sprites/eggs/fire_egg.png',
    incubationTime: 12,
    isStarter: true,
    isEventExclusive: false,
  },

  starter_water: {
    id: 'starter_water',
    name: 'Aquapaw',
    description: 'A calm water-type pet that enjoys swimming.',
    rarity: RARITY_TIERS.COMMON,
    baseStats: {
      HATCHLING: { health: 22, attack: 5, defense: 6, speed: 4, action: 10 },
      JUVENILE: { health: 38, attack: 9, defense: 11, speed: 7, action: 15 },
      ADULT: { health: 55, attack: 14, defense: 16, speed: 10, action: 20 },
    },
    appearance: {
      spriteSheet: 'sprites/aquapaw.png',
      animations: {
        idle: [0, 1, 2, 3],
        happy: [4, 5, 6, 7],
        sad: [8, 9],
        sick: [10, 11],
        sleeping: [12, 13],
        eating: [14, 15],
        playing: [16, 17, 18],
      },
      defaultColor: '#4A90E2',
      availableColors: ['#4A90E2', '#00CED1', '#1E90FF'],
      size: { width: 64, height: 64 },
    },
    traits: {
      temperament: TEMPERAMENT_TYPES.CALM,
      favoriteFood: ['seaweed_snack', 'fish_treat'],
      favoriteToys: ['water_ball', 'bubble_wand'],
      habitat: HABITAT_TYPES.LAKE,
      activityPreference: ACTIVITY_PREFERENCE_TYPES.CREPUSCULAR,
    },
    learnableMoves: [
      { moveId: 'bubble', learnStage: LEARN_STAGES.HATCHLING, learnChance: 100 },
      { moveId: 'water_pulse', learnStage: LEARN_STAGES.JUVENILE, learnChance: 50 },
      { moveId: 'aqua_jet', learnStage: LEARN_STAGES.ADULT, learnChance: 30 },
    ],
    startingMoves: ['tackle', 'bubble'],
    careModifiers: {
      satietyDecay: 0.9,
      hydrationDecay: 0.8,
      happinessDecay: 1.0,
      energyUsage: 0.9,
    },
    abilities: [
      {
        id: 'water_veil',
        name: 'Water Veil',
        description: 'Prevents burn status',
        effect: EFFECT_TYPES.STATUS_IMMUNITY,
        value: 100,
      },
    ],
    eggSprite: 'sprites/eggs/water_egg.png',
    incubationTime: 12,
    isStarter: true,
    isEventExclusive: false,
  },

  starter_grass: {
    id: 'starter_grass',
    name: 'Leafkit',
    description: 'A gentle grass-type pet that loves nature.',
    rarity: RARITY_TIERS.COMMON,
    baseStats: {
      HATCHLING: { health: 21, attack: 6, defense: 5, speed: 6, action: 10 },
      JUVENILE: { health: 36, attack: 10, defense: 10, speed: 9, action: 15 },
      ADULT: { health: 52, attack: 15, defense: 15, speed: 13, action: 20 },
    },
    appearance: {
      spriteSheet: 'sprites/leafkit.png',
      animations: {
        idle: [0, 1, 2, 3],
        happy: [4, 5, 6, 7],
        sad: [8, 9],
        sick: [10, 11],
        sleeping: [12, 13],
        eating: [14, 15],
        playing: [16, 17, 18],
      },
      defaultColor: '#7CB342',
      availableColors: ['#7CB342', '#228B22', '#9ACD32'],
      size: { width: 64, height: 64 },
    },
    traits: {
      temperament: TEMPERAMENT_TYPES.PLAYFUL,
      favoriteFood: ['fresh_leaves', 'sweet_berries'],
      favoriteToys: ['vine_rope', 'leaf_ball'],
      habitat: HABITAT_TYPES.FOREST,
      activityPreference: ACTIVITY_PREFERENCE_TYPES.DIURNAL,
    },
    learnableMoves: [
      { moveId: 'vine_whip', learnStage: LEARN_STAGES.HATCHLING, learnChance: 100 },
      { moveId: 'leaf_storm', learnStage: LEARN_STAGES.JUVENILE, learnChance: 50 },
      { moveId: 'solar_beam', learnStage: LEARN_STAGES.ADULT, learnChance: 30 },
    ],
    startingMoves: ['tackle', 'vine_whip'],
    careModifiers: {
      satietyDecay: 1.0,
      hydrationDecay: 1.1,
      happinessDecay: 0.8,
      energyUsage: 1.0,
    },
    abilities: [
      {
        id: 'photosynthesis',
        name: 'Photosynthesis',
        description: 'Slowly regenerates health in sunlight',
        effect: EFFECT_TYPES.HEALTH_REGEN,
        value: 5,
      },
    ],
    eggSprite: 'sprites/eggs/grass_egg.png',
    incubationTime: 12,
    isStarter: true,
    isEventExclusive: false,
  },

  sky_wing: {
    id: 'sky_wing',
    name: 'Skywing',
    description: 'A majestic flying pet that soars through clouds.',
    rarity: RARITY_TIERS.UNCOMMON,
    baseStats: {
      HATCHLING: { health: 18, attack: 6, defense: 4, speed: 8, action: 12 },
      JUVENILE: { health: 32, attack: 11, defense: 7, speed: 14, action: 18 },
      ADULT: { health: 48, attack: 16, defense: 11, speed: 20, action: 25 },
    },
    appearance: {
      spriteSheet: 'sprites/skywing.png',
      animations: {
        idle: [0, 1, 2, 3],
        happy: [4, 5, 6, 7],
        sad: [8, 9],
        sick: [10, 11],
        sleeping: [12, 13],
        eating: [14, 15],
        playing: [16, 17, 18],
      },
      defaultColor: '#87CEEB',
      availableColors: ['#87CEEB'],
      size: { width: 64, height: 64 },
    },
    traits: {
      temperament: TEMPERAMENT_TYPES.ADVENTUROUS,
      habitat: HABITAT_TYPES.MOUNTAIN,
      activityPreference: ACTIVITY_PREFERENCE_TYPES.DIURNAL,
    },
    learnableMoves: [
      { moveId: 'gust', learnStage: LEARN_STAGES.HATCHLING, learnChance: 100 },
      { moveId: 'wing_attack', learnStage: LEARN_STAGES.JUVENILE, learnChance: 60 },
      { moveId: 'air_slash', learnStage: LEARN_STAGES.ADULT, learnChance: 40 },
    ],
    startingMoves: ['tackle', 'gust'],
    eggSprite: 'sprites/eggs/sky_egg.png',
    incubationTime: 18,
    isStarter: false,
    isEventExclusive: false,
  },

  rock_golem: {
    id: 'rock_golem',
    name: 'Rockgolem',
    description: 'A sturdy earth-type pet with incredible defense.',
    rarity: RARITY_TIERS.RARE,
    baseStats: {
      HATCHLING: { health: 25, attack: 5, defense: 8, speed: 2, action: 8 },
      JUVENILE: { health: 45, attack: 9, defense: 15, speed: 4, action: 12 },
      ADULT: { health: 70, attack: 14, defense: 22, speed: 6, action: 16 },
    },
    appearance: {
      spriteSheet: 'sprites/rockgolem.png',
      animations: {
        idle: [0, 1, 2, 3],
        happy: [4, 5, 6, 7],
        sad: [8, 9],
        sick: [10, 11],
        sleeping: [12, 13],
        eating: [14, 15],
        playing: [16, 17, 18],
      },
      defaultColor: '#8B7355',
      availableColors: ['#8B7355'],
      size: { width: 64, height: 64 },
    },
    traits: {
      temperament: TEMPERAMENT_TYPES.STOIC,
      habitat: HABITAT_TYPES.CAVE,
      activityPreference: ACTIVITY_PREFERENCE_TYPES.NOCTURNAL,
    },
    learnableMoves: [
      { moveId: 'rock_throw', learnStage: LEARN_STAGES.HATCHLING, learnChance: 100 },
      { moveId: 'stone_edge', learnStage: LEARN_STAGES.JUVENILE, learnChance: 50 },
      { moveId: 'earthquake', learnStage: LEARN_STAGES.ADULT, learnChance: 25 },
    ],
    startingMoves: ['tackle', 'harden'],
    careModifiers: {
      satietyDecay: 0.7,
      hydrationDecay: 0.6,
      happinessDecay: 1.2,
      energyUsage: 0.8,
    },
    eggSprite: 'sprites/eggs/rock_egg.png',
    incubationTime: 24,
    isStarter: false,
    isEventExclusive: false,
  },

  thunder_cat: {
    id: 'thunder_cat',
    name: 'Thundercat',
    description: 'An electric-type pet that crackles with energy.',
    rarity: RARITY_TIERS.EPIC,
    baseStats: {
      HATCHLING: { health: 19, attack: 8, defense: 5, speed: 9, action: 15 },
      JUVENILE: { health: 34, attack: 14, defense: 9, speed: 15, action: 22 },
      ADULT: { health: 50, attack: 20, defense: 13, speed: 22, action: 30 },
    },
    appearance: {
      spriteSheet: 'sprites/thundercat.png',
      animations: {
        idle: [0, 1, 2, 3],
        happy: [4, 5, 6, 7],
        sad: [8, 9],
        sick: [10, 11],
        sleeping: [12, 13],
        eating: [14, 15],
        playing: [16, 17, 18],
      },
      defaultColor: '#FFD700',
      availableColors: ['#FFD700'],
      size: { width: 64, height: 64 },
    },
    traits: {
      temperament: TEMPERAMENT_TYPES.HYPERACTIVE,
      habitat: HABITAT_TYPES.STORM,
      activityPreference: ACTIVITY_PREFERENCE_TYPES.CATHEMERAL,
    },
    learnableMoves: [
      { moveId: 'thunder_shock', learnStage: LEARN_STAGES.HATCHLING, learnChance: 100 },
      { moveId: 'thunderbolt', learnStage: LEARN_STAGES.JUVENILE, learnChance: 40 },
      { moveId: 'thunder', learnStage: LEARN_STAGES.ADULT, learnChance: 20 },
    ],
    startingMoves: ['quick_attack', 'thunder_shock'],
    abilities: [
      {
        id: 'static',
        name: 'Static',
        description: 'May paralyze attackers on contact',
        effect: EFFECT_TYPES.CONTACT_STATUS,
        value: 30,
      },
    ],
    eggSprite: 'sprites/eggs/thunder_egg.png',
    incubationTime: 36,
    isStarter: false,
    isEventExclusive: false,
  },

  dragon_lord: {
    id: 'dragon_lord',
    name: 'Dragonlord',
    description: 'A legendary dragon pet of immense power.',
    rarity: RARITY_TIERS.LEGENDARY,
    baseStats: {
      HATCHLING: { health: 30, attack: 10, defense: 8, speed: 8, action: 20 },
      JUVENILE: { health: 50, attack: 18, defense: 14, speed: 14, action: 30 },
      ADULT: { health: 80, attack: 28, defense: 20, speed: 20, action: 40 },
    },
    appearance: {
      spriteSheet: 'sprites/dragonlord.png',
      animations: {
        idle: [0, 1, 2, 3],
        happy: [4, 5, 6, 7],
        sad: [8, 9],
        sick: [10, 11],
        sleeping: [12, 13],
        eating: [14, 15],
        playing: [16, 17, 18],
      },
      defaultColor: '#8B0000',
      availableColors: ['#8B0000'],
      size: { width: 96, height: 96 },
    },
    traits: {
      temperament: TEMPERAMENT_TYPES.PROUD,
      habitat: HABITAT_TYPES.VOLCANO,
      activityPreference: ACTIVITY_PREFERENCE_TYPES.NOCTURNAL,
    },
    learnableMoves: [
      {
        moveId: 'dragon_breath',
        learnStage: LEARN_STAGES.HATCHLING,
        learnChance: 100,
      },
      { moveId: 'dragon_claw', learnStage: LEARN_STAGES.JUVENILE, learnChance: 60 },
      { moveId: 'dragon_pulse', learnStage: LEARN_STAGES.ADULT, learnChance: 40 },
      { moveId: 'hyper_beam', learnStage: LEARN_STAGES.ADULT, learnChance: 20 },
    ],
    startingMoves: ['slash', 'dragon_breath'],
    abilities: [
      {
        id: 'dragon_scale',
        name: 'Dragon Scale',
        description: 'Reduces all damage taken',
        effect: EFFECT_TYPES.DAMAGE_REDUCTION,
        value: 15,
      },
      {
        id: 'intimidate',
        name: 'Intimidate',
        description: "Lowers opponent's attack at battle start",
        effect: EFFECT_TYPES.BATTLE_START_DEBUFF,
        value: 20,
      },
    ],
    careModifiers: {
      satietyDecay: 1.5,
      hydrationDecay: 1.2,
      happinessDecay: 1.3,
      energyUsage: 1.4,
    },
    eggSprite: 'sprites/eggs/dragon_egg.png',
    incubationTime: 48,
    isStarter: false,
    isEventExclusive: false,
    unlockConditions: "Complete Dragon's Trial event or find in legendary egg",
  },
};

/**
 * Get a species by ID
 */
export function getSpeciesById(speciesId: string): Species | undefined {
  return SPECIES_DATA[speciesId] || undefined;
}

/**
 * Get all species as an array
 */
export function getAllSpecies(): Species[] {
  return Object.values(SPECIES_DATA);
}

/**
 * Get all starter species
 */
export function getStarterSpecies(): Species[] {
  return Object.values(SPECIES_DATA).filter((species) => species.isStarter);
}

/**
 * Get species by rarity
 */
export function getSpeciesByRarity(rarity: string): Species[] {
  return Object.values(SPECIES_DATA).filter((species) => species.rarity === rarity);
}
