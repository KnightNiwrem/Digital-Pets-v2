/**
 * Location-related data models and interfaces
 */

import type {
  LocationType,
  CityArea,
  WildBiome,
  ActivityType,
  GrowthStage,
  TravelDistance,
  LightingType,
  WeatherType,
  PopulationSize,
  DifficultyLevel,
  HazardType,
  RouteType,
  SafetyLevel,
  EncounterType,
  ToolTier,
  NPCRole,
  NPCPersonality,
} from './constants';

/**
 * Base location interface
 */
export interface Location {
  id: string;
  name: string;
  description: string;
  type: LocationType;
  sprite: string;  // Background sprite for location
  
  // Ambient properties
  ambientMusic?: string;
  ambientSounds?: string[];
  lightingType: LightingType;
  weatherEffects?: WeatherType;
}

/**
 * City location with specific areas
 */
export interface CityLocation extends Location {
  type: 'CITY';
  
  // Available areas within the city
  areas: {
    [key in CityArea]?: {
      available: boolean;
      name: string;
      description: string;
      sprite: string;
      npcCount?: number;
      specialFeatures?: string[];
    };
  };
  
  // City-specific properties
  population: PopulationSize;
  prosperityLevel: number;  // 1-10, affects shop prices and variety
  
  // Services available
  hasShop: boolean;
  hasArena: boolean;
  hasGym: boolean;
  hasInn: boolean;
  
  // Special city features
  specialEvents?: string[];  // Event IDs that can occur here
  uniqueNPCs?: string[];  // Special NPC IDs
}

/**
 * Wild location for exploration
 */
export interface WildLocation extends Location {
  type: 'WILD';
  biome: WildBiome;
  
  // Exploration properties
  dangerLevel: number;  // 1-10, affects encounter rates
  explorationDifficulty: DifficultyLevel;
  
  // Available activities
  availableActivities: ActivityType[];
  
  // Resource availability
  resources: {
    abundant: string[];  // Item IDs that are common here
    rare: string[];  // Item IDs that are rare but possible
    exclusive: string[];  // Item IDs only found here
  };
  
  // Wildlife
  wildPetSpecies: {
    speciesId: string;
    encounterRate: number;  // Percentage
    level: { min: number; max: number };
  }[];
  
  // Environmental hazards
  hazards?: {
    type: HazardType;
    chance: number;  // Percentage per activity
    effect: string;  // Description of effect
  }[];
  
  // Weather patterns
  weatherPatterns?: {
    type: string;
    frequency: number;  // How often it occurs
    duration: number;  // Average duration in hours
    effects: {
      visibilityModifier?: number;
      encounterRateModifier?: number;
      activitySuccessModifier?: number;
    };
  }[];
}

/**
 * Travel route between locations
 */
export interface TravelRoute {
  id: string;
  from: string;  // Location ID
  to: string;  // Location ID
  
  // Travel properties
  distance: TravelDistance;
  baseTravelTime: number;  // In minutes
  energyCost: number;
  
  // Route characteristics
  routeType: RouteType;
  safety: SafetyLevel;
  
  // Requirements
  requirements?: {
    minStage?: GrowthStage;
    requiredItem?: string;  // Item ID needed for travel
    requiredQuest?: string;  // Quest ID that must be completed
  };
  
  // Random encounters during travel
  encounters?: {
    type: EncounterType;
    chance: number;  // Percentage
    pool: string[];  // IDs of possible encounters
  }[];
  
  // Scenic points (for future features)
  scenicPoints?: {
    name: string;
    description: string;
    position: number;  // 0-1, position along route
  }[];
}

/**
 * Activity available at a location
 */
export interface LocationActivity {
  id: string;
  type: ActivityType;
  location: string;  // Location ID
  
  // Activity properties
  name: string;
  description: string;
  duration: {
    min: number;  // Minutes
    max: number;
  };
  energyCost: number;
  
  // Requirements
  requirements: {
    minStage?: GrowthStage;
    requiredTool?: string;  // Tool ID
    requiredToolTier?: ToolTier;
    requiredStats?: {
      stat: string;
      minValue: number;
    }[];
  };
  
  // Rewards
  rewards: {
    guaranteed: {
      itemId: string;
      quantity: number;
    }[];
    possible: {
      itemId: string;
      chance: number;
      minQuantity: number;
      maxQuantity: number;
    }[];
    experience: number;
    currency?: {
      min: number;
      max: number;
    };
  };
  
  // Success factors
  successFactors?: {
    baseSuccessRate: number;
    toolBonus: number;  // Per tool tier
    statBonus: {
      stat: string;
      bonusPerPoint: number;
    }[];
    weatherPenalty?: {
      weather: string;
      penalty: number;
    }[];
  };
}

/**
 * Map data for the game world
 */
export interface WorldMap {
  id: string;
  name: string;
  
  // All locations
  locations: {
    [locationId: string]: Location | CityLocation | WildLocation;
  };
  
  // Travel routes between locations
  routes: TravelRoute[];
  
  // Starting location for new players
  startingLocation: string;
  
  // Region groupings
  regions?: {
    id: string;
    name: string;
    description: string;
    locationIds: string[];
    unlockRequirement?: string;
  }[];
  
  // World events that affect all locations
  globalEvents?: {
    id: string;
    name: string;
    active: boolean;
    effects: {
      travelTimeModifier?: number;
      activityRewardModifier?: number;
      encounterRateModifier?: number;
    };
  }[];
}

/**
 * Current location state for a pet
 */
export interface LocationState {
  currentLocationId: string;
  currentArea?: CityArea;  // If in a city
  
  // Travel state
  traveling: boolean;
  travelRoute?: {
    routeId: string;
    startTime: number;
    endTime: number;
    progress: number;  // 0-1
    paused: boolean;
    pausedAt?: number;
  };
  
  // Activity state
  inActivity: boolean;
  currentActivity?: {
    activityId: string;
    startTime: number;
    endTime: number;
    progress: number;  // 0-1
    paused: boolean;
    toolUsed?: string;
  };
  
  // Location history
  visitedLocations: string[];
  lastVisitTimes: {
    [locationId: string]: number;
  };
  
  // Discovery tracking
  discoveredSecrets?: {
    [locationId: string]: string[];  // Secret IDs discovered
  };
}

/**
 * NPC at a location
 */
export interface LocationNPC {
  id: string;
  name: string;
  sprite: string;
  locationId: string;
  area?: CityArea;
  
  // NPC properties
  role: NPCRole;
  personality: NPCPersonality;
  
  // Dialogue
  dialogues: {
    greeting: string[];
    idle: string[];
    farewell: string[];
    special?: {
      [condition: string]: string[];
    };
  };
  
  // Interactions
  interactions?: {
    trade?: {
      offers: ShopItem[];
      refreshDaily: boolean;
    };
    battle?: {
      team: string[];  // Pet IDs for NPC team
      difficulty: DifficultyLevel;
      rewards: {
        itemId: string;
        quantity: number;
      }[];
    };
    quest?: {
      questId: string;
      repeatable: boolean;
    };
  };
}

// Import needed type
import type { ShopItem } from './Item';