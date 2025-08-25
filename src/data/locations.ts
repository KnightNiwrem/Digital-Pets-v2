/**
 * Locations database
 * Contains all locations in the game
 */

import type { CityLocation, WildLocation } from '../models/Location';
import { LOCATION_TYPES, CITY_AREAS, WILD_BIOMES } from '../models/constants';

/**
 * City locations
 */
export const CITY_LOCATIONS: Record<string, CityLocation> = {
  main_city: {
    id: 'main_city',
    name: 'Main City',
    description: 'The bustling central hub of the region',
    type: LOCATION_TYPES.CITY,
    sprite: 'sprites/locations/main_city.png',
    lightingType: 'day',
    areas: {
      [CITY_AREAS.SQUARE]: {
        available: true,
        name: 'Town Square',
        description: 'The heart of the city where pets gather',
        sprite: 'sprites/locations/town_square.png',
        npcCount: 5,
      },
      [CITY_AREAS.SHOP]: {
        available: true,
        name: 'General Store',
        description: 'Buy and sell various items',
        sprite: 'sprites/locations/shop.png',
        npcCount: 1,
      },
      [CITY_AREAS.GYM]: {
        available: true,
        name: 'Training Gym',
        description: 'Train your pet to become stronger',
        sprite: 'sprites/locations/gym.png',
        npcCount: 3,
      },
      [CITY_AREAS.ARENA]: {
        available: true,
        name: 'Battle Arena',
        description: 'Test your skills in battle',
        sprite: 'sprites/locations/arena.png',
        npcCount: 2,
      },
    },
    population: 'large',
    prosperityLevel: 8,
    hasShop: true,
    hasArena: true,
    hasGym: true,
    hasInn: true,
  },

  forest_town: {
    id: 'forest_town',
    name: 'Forest Town',
    description: 'A peaceful town surrounded by trees',
    type: LOCATION_TYPES.CITY,
    sprite: 'sprites/locations/forest_town.png',
    lightingType: 'day',
    areas: {
      [CITY_AREAS.SQUARE]: {
        available: true,
        name: 'Village Center',
        description: 'A quiet meeting place',
        sprite: 'sprites/locations/village_center.png',
        npcCount: 3,
      },
      [CITY_AREAS.SHOP]: {
        available: true,
        name: 'Forest Shop',
        description: 'Specializes in nature items',
        sprite: 'sprites/locations/forest_shop.png',
        npcCount: 1,
      },
    },
    population: 'small',
    prosperityLevel: 5,
    hasShop: true,
    hasArena: false,
    hasGym: false,
    hasInn: true,
  },

  mountain_village: {
    id: 'mountain_village',
    name: 'Mountain Village',
    description: 'A hardy village high in the mountains',
    type: LOCATION_TYPES.CITY,
    sprite: 'sprites/locations/mountain_village.png',
    lightingType: 'day',
    areas: {
      [CITY_AREAS.SQUARE]: {
        available: true,
        name: 'Mountain Plaza',
        description: 'A stone plaza with mountain views',
        sprite: 'sprites/locations/mountain_plaza.png',
        npcCount: 4,
      },
      [CITY_AREAS.SHOP]: {
        available: true,
        name: 'Mining Supplies',
        description: 'Tools and minerals',
        sprite: 'sprites/locations/mining_shop.png',
        npcCount: 1,
      },
      [CITY_AREAS.GYM]: {
        available: true,
        name: 'Mountain Gym',
        description: 'Train in harsh conditions',
        sprite: 'sprites/locations/mountain_gym.png',
        npcCount: 2,
      },
    },
    population: 'medium',
    prosperityLevel: 6,
    hasShop: true,
    hasArena: false,
    hasGym: true,
    hasInn: true,
  },
};

/**
 * Wild locations
 */
export const WILD_LOCATIONS: Record<string, WildLocation> = {
  forest: {
    id: 'forest',
    name: 'Dense Forest',
    description: 'A thick forest full of life',
    type: LOCATION_TYPES.WILD,
    sprite: 'sprites/locations/forest.png',
    lightingType: 'day',
    biome: WILD_BIOMES.FOREST,
    dangerLevel: 3,
    explorationDifficulty: 'easy',
    availableActivities: ['FISHING', 'FORAGING'],
    resources: {
      abundant: ['wood', 'berries', 'mushrooms'],
      rare: ['rare_flower', 'ancient_seed'],
      exclusive: ['forest_gem'],
    },
    wildPetSpecies: [
      {
        speciesId: 'forest_sprite',
        encounterRate: 30,
        level: { min: 5, max: 15 },
      },
      {
        speciesId: 'tree_guardian',
        encounterRate: 10,
        level: { min: 10, max: 20 },
      },
    ],
  },

  mountains: {
    id: 'mountains',
    name: 'Rocky Mountains',
    description: 'Towering peaks with valuable minerals',
    type: LOCATION_TYPES.WILD,
    sprite: 'sprites/locations/mountains.png',
    lightingType: 'day',
    biome: WILD_BIOMES.MOUNTAINS,
    dangerLevel: 6,
    explorationDifficulty: 'hard',
    availableActivities: ['MINING', 'FORAGING'],
    resources: {
      abundant: ['stone', 'iron_ore'],
      rare: ['gold_ore', 'crystal'],
      exclusive: ['mountain_ruby'],
    },
    wildPetSpecies: [
      {
        speciesId: 'rock_golem',
        encounterRate: 25,
        level: { min: 15, max: 30 },
      },
      {
        speciesId: 'sky_eagle',
        encounterRate: 15,
        level: { min: 20, max: 35 },
      },
    ],
    hazards: [
      {
        type: 'extreme_cold',
        chance: 20,
        effect: 'Reduces energy regeneration',
      },
    ],
  },

  lake: {
    id: 'lake',
    name: 'Crystal Lake',
    description: 'A pristine lake with abundant fish',
    type: LOCATION_TYPES.WILD,
    sprite: 'sprites/locations/lake.png',
    lightingType: 'day',
    biome: WILD_BIOMES.LAKE,
    dangerLevel: 2,
    explorationDifficulty: 'easy',
    availableActivities: ['FISHING', 'FORAGING'],
    resources: {
      abundant: ['fish', 'water_plants'],
      rare: ['pearl', 'rare_fish'],
      exclusive: ['lake_crystal'],
    },
    wildPetSpecies: [
      {
        speciesId: 'water_sprite',
        encounterRate: 35,
        level: { min: 5, max: 15 },
      },
    ],
  },
};

/**
 * All locations combined
 */
export const LOCATIONS_DATA: Readonly<Record<string, CityLocation | WildLocation>> = Object.freeze({
  ...CITY_LOCATIONS,
  ...WILD_LOCATIONS,
});

/**
 * Get a location by ID
 */
export function getLocationById(locationId: string): CityLocation | WildLocation | null {
  return LOCATIONS_DATA[locationId] || null;
}

/**
 * Get all locations as an array
 */
export function getAllLocations(): (CityLocation | WildLocation)[] {
  return Object.values(LOCATIONS_DATA);
}

/**
 * Get all city locations
 */
export function getCityLocations(): CityLocation[] {
  return Object.values(CITY_LOCATIONS);
}

/**
 * Get all wild locations
 */
export function getWildLocations(): WildLocation[] {
  return Object.values(WILD_LOCATIONS);
}

/**
 * Get locations by type
 */
export function getLocationsByType(type: string): (CityLocation | WildLocation)[] {
  return Object.values(LOCATIONS_DATA).filter((location) => location.type === type);
}

/**
 * Get wild locations by biome
 */
export function getWildLocationsByBiome(biome: string): WildLocation[] {
  return Object.values(WILD_LOCATIONS).filter((location) => location.biome === biome);
}

/**
 * Get wild locations by danger level
 */
export function getWildLocationsByDangerLevel(minLevel: number, maxLevel?: number): WildLocation[] {
  return Object.values(WILD_LOCATIONS).filter((location) => {
    if (maxLevel !== undefined) {
      return location.dangerLevel >= minLevel && location.dangerLevel <= maxLevel;
    }
    return location.dangerLevel >= minLevel;
  });
}
