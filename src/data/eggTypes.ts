/**
 * Egg types database
 * Contains all egg types available in the game
 */

import type { EggType } from '../models/Species';

/**
 * All available egg types
 */
export const EGG_TYPES_DATA: Record<string, EggType> = {
  starter_egg: {
    id: 'starter_egg',
    name: 'Starter Egg',
    description: 'An egg containing a starter pet. Perfect for beginning your journey!',
    sprite: 'sprites/eggs/starter_egg.png',
    possibleSpecies: [
      { speciesId: 'starter_fire', weight: 33 },
      { speciesId: 'starter_water', weight: 33 },
      { speciesId: 'starter_grass', weight: 34 },
    ],
    rarityWeights: {
      COMMON: 100,
      UNCOMMON: 0,
      RARE: 0,
      EPIC: 0,
      LEGENDARY: 0,
    },
    baseIncubationTime: 6,
  },

  generic_egg: {
    id: 'generic_egg',
    name: 'Mystery Egg',
    description: 'A mysterious egg. What could be inside?',
    sprite: 'sprites/eggs/generic_egg.png',
    possibleSpecies: [
      { speciesId: 'starter_fire', weight: 15 },
      { speciesId: 'starter_water', weight: 15 },
      { speciesId: 'starter_grass', weight: 15 },
      { speciesId: 'sky_wing', weight: 25 },
      { speciesId: 'rock_golem', weight: 20 },
      { speciesId: 'thunder_cat', weight: 8 },
      { speciesId: 'dragon_lord', weight: 2 },
    ],
    baseIncubationTime: 12,
  },

  common_egg: {
    id: 'common_egg',
    name: 'Common Egg',
    description: 'A standard egg likely containing a common pet.',
    sprite: 'sprites/eggs/common_egg.png',
    possibleSpecies: [
      { speciesId: 'starter_fire', weight: 30 },
      { speciesId: 'starter_water', weight: 30 },
      { speciesId: 'starter_grass', weight: 30 },
      { speciesId: 'sky_wing', weight: 10 },
    ],
    rarityWeights: {
      COMMON: 85,
      UNCOMMON: 15,
      RARE: 0,
      EPIC: 0,
      LEGENDARY: 0,
    },
    baseIncubationTime: 8,
  },

  rare_egg: {
    id: 'rare_egg',
    name: 'Rare Egg',
    description: 'A special egg with higher chances of rare pets.',
    sprite: 'sprites/eggs/rare_egg.png',
    possibleSpecies: [
      { speciesId: 'sky_wing', weight: 35 },
      { speciesId: 'rock_golem', weight: 40 },
      { speciesId: 'thunder_cat', weight: 20 },
      { speciesId: 'dragon_lord', weight: 5 },
    ],
    rarityWeights: {
      COMMON: 10,
      UNCOMMON: 35,
      RARE: 40,
      EPIC: 12,
      LEGENDARY: 3,
    },
    baseIncubationTime: 18,
  },

  epic_egg: {
    id: 'epic_egg',
    name: 'Epic Egg',
    description: 'A magnificent egg containing powerful pets.',
    sprite: 'sprites/eggs/epic_egg.png',
    possibleSpecies: [
      { speciesId: 'rock_golem', weight: 25 },
      { speciesId: 'thunder_cat', weight: 50 },
      { speciesId: 'dragon_lord', weight: 25 },
    ],
    rarityWeights: {
      COMMON: 0,
      UNCOMMON: 10,
      RARE: 30,
      EPIC: 50,
      LEGENDARY: 10,
    },
    baseIncubationTime: 24,
  },

  legendary_egg: {
    id: 'legendary_egg',
    name: 'Legendary Egg',
    description: 'An extremely rare egg containing legendary pets!',
    sprite: 'sprites/eggs/legendary_egg.png',
    possibleSpecies: [
      { speciesId: 'thunder_cat', weight: 30 },
      { speciesId: 'dragon_lord', weight: 70 },
    ],
    rarityWeights: {
      COMMON: 0,
      UNCOMMON: 0,
      RARE: 5,
      EPIC: 25,
      LEGENDARY: 70,
    },
    baseIncubationTime: 36,
  },

  fire_egg: {
    id: 'fire_egg',
    name: 'Fire Egg',
    description: 'An egg warm to the touch, containing fire-type pets.',
    sprite: 'sprites/eggs/fire_egg.png',
    possibleSpecies: [
      { speciesId: 'starter_fire', weight: 60 },
      { speciesId: 'dragon_lord', weight: 40 },
    ],
    baseIncubationTime: 14,
  },

  water_egg: {
    id: 'water_egg',
    name: 'Water Egg',
    description: 'An egg with a cool, smooth surface, containing water-type pets.',
    sprite: 'sprites/eggs/water_egg.png',
    possibleSpecies: [{ speciesId: 'starter_water', weight: 100 }],
    baseIncubationTime: 14,
  },

  grass_egg: {
    id: 'grass_egg',
    name: 'Grass Egg',
    description: 'An egg with tiny leaves sprouting from it, containing grass-type pets.',
    sprite: 'sprites/eggs/grass_egg.png',
    possibleSpecies: [{ speciesId: 'starter_grass', weight: 100 }],
    baseIncubationTime: 14,
  },

  sky_egg: {
    id: 'sky_egg',
    name: 'Sky Egg',
    description: 'A light egg that seems to float, containing flying-type pets.',
    sprite: 'sprites/eggs/sky_egg.png',
    possibleSpecies: [
      { speciesId: 'sky_wing', weight: 80 },
      { speciesId: 'dragon_lord', weight: 20 },
    ],
    baseIncubationTime: 16,
  },

  stone_egg: {
    id: 'stone_egg',
    name: 'Stone Egg',
    description: 'A heavy, rough egg containing earth-type pets.',
    sprite: 'sprites/eggs/stone_egg.png',
    possibleSpecies: [{ speciesId: 'rock_golem', weight: 100 }],
    baseIncubationTime: 20,
  },

  storm_egg: {
    id: 'storm_egg',
    name: 'Storm Egg',
    description: 'An egg that sparks with electricity, containing electric-type pets.',
    sprite: 'sprites/eggs/storm_egg.png',
    possibleSpecies: [{ speciesId: 'thunder_cat', weight: 100 }],
    baseIncubationTime: 22,
  },

  event_spring_egg: {
    id: 'event_spring_egg',
    name: 'Spring Festival Egg',
    description: 'A special egg available during the Spring Festival event.',
    sprite: 'sprites/eggs/spring_egg.png',
    possibleSpecies: [
      { speciesId: 'starter_grass', weight: 40 },
      { speciesId: 'sky_wing', weight: 30 },
      { speciesId: 'starter_water', weight: 20 },
      { speciesId: 'thunder_cat', weight: 10 },
    ],
    baseIncubationTime: 10,
  },

  event_halloween_egg: {
    id: 'event_halloween_egg',
    name: 'Spooky Egg',
    description: 'A mysterious egg that only appears during Halloween.',
    sprite: 'sprites/eggs/halloween_egg.png',
    possibleSpecies: [
      { speciesId: 'rock_golem', weight: 35 },
      { speciesId: 'dragon_lord', weight: 15 },
      { speciesId: 'thunder_cat', weight: 50 },
    ],
    rarityWeights: {
      COMMON: 5,
      UNCOMMON: 20,
      RARE: 35,
      EPIC: 30,
      LEGENDARY: 10,
    },
    baseIncubationTime: 13,
  },
};

/**
 * Get an egg type by ID
 */
export function getEggTypeById(eggTypeId: string): EggType | undefined {
  return EGG_TYPES_DATA[eggTypeId] || undefined;
}

/**
 * Get all egg types as an array
 */
export function getAllEggTypes(): EggType[] {
  return Object.values(EGG_TYPES_DATA);
}

/**
 * Get event egg types
 */
export function getEventEggTypes(): EggType[] {
  return Object.values(EGG_TYPES_DATA).filter((eggType) => eggType.id.startsWith('event_'));
}

/**
 * Get egg types by rarity focus
 */
export function getEggTypesByRarityFocus(minLegendaryWeight: number = 0): EggType[] {
  return Object.values(EGG_TYPES_DATA).filter(
    (eggType) =>
      eggType.rarityWeights && (eggType.rarityWeights.LEGENDARY || 0) >= minLegendaryWeight,
  );
}
