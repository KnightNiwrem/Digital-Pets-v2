/**
 * Mock factories for testing
 * Centralized creation of mock objects to reduce code duplication across test files
 */

import type { GameState, Pet } from '../models';
import type { EggItem, Item, InventoryItem } from '../models/Item';
import type { GameUpdateWriter } from '../engine/GameUpdatesQueue';
import type { Egg } from '../models/Species';
import { RARITY_TIERS, STATUS_TYPES, GROWTH_STAGES, ITEM_CATEGORIES } from '../models/constants';

// Options for customizing mock objects
export interface MockGameStateOptions {
  playerId?: string;
  pet?: Pet | null;
  coins?: number;
  maxSlots?: number;
  unlockedSlots?: number;
  currentLocationId?: string;
  version?: string;
  includeTestItems?: boolean;
}

export interface MockPetOptions {
  id?: string;
  name?: string;
  species?: string;
  rarity?: string;
  stage?: string;
  health?: number;
  currentHealth?: number;
  maxHealth?: number;
  attack?: number;
  defense?: number;
  speed?: number;
  maxAction?: number;
  energy?: number;
  satiety?: number;
  hydration?: number;
  happiness?: number;
  knownMoves?: string[];
}

/**
 * Create a mock GameState with sensible defaults and customization options
 */
export function createMockGameState(options: MockGameStateOptions = {}): GameState {
  const {
    playerId = 'test-player',
    pet = null,
    coins = 100,
    maxSlots = 100,
    unlockedSlots = 50,
    currentLocationId = 'main_city',
    version = '1.0.0',
    includeTestItems = false,
  } = options;

  const now = Date.now();

  const testItems = includeTestItems
    ? [
        createMockInventoryItem('food-basic', 5, now - 7200000),
        createMockInventoryItem('water-basic', 3, now - 3600000),
      ]
    : [];

  return {
    version,
    timestamp: now,
    playerId,
    pet,
    inventory: {
      items: testItems,
      currency: { coins },
      maxSlots,
      unlockedSlots,
    },
    world: {
      currentLocation: {
        currentLocationId,
        currentArea: undefined,
        traveling: false,
        travelRoute: undefined,
        inActivity: false,
        currentActivity: undefined,
        visitedLocations: [currentLocationId],
        lastVisitTimes: {
          [currentLocationId]: now,
        },
        discoveredSecrets: undefined,
      },
      activeTimers: [],
      eventParticipation: [],
      currentEvents: [],
      worldTime: now,
      lastTickTime: now,
      tickCount: 0,
    },
    collections: {
      eggs: [],
      species: {},
      memorials: [],
    },
    meta: {
      settings: {
        masterVolume: 100,
        musicVolume: 80,
        sfxVolume: 80,
        textSize: 'medium',
        colorBlindMode: 'off',
        highContrast: false,
        reducedMotion: false,
        showParticles: true,
        autoSave: true,
        autoSaveInterval: 1,
        confirmActions: true,
        showTutorialHints: true,
        enableNotifications: true,
        lowCareWarning: true,
        activityComplete: true,
        eventReminders: true,
        touchControls: true,
        keyboardShortcuts: true,
        swipeGestures: true,
      },
      tutorialProgress: {
        completed: [],
        skipped: false,
        milestones: {
          firstFeed: false,
          firstDrink: false,
          firstPlay: false,
          firstClean: false,
          firstSleep: false,
          firstActivity: false,
          firstBattle: false,
          firstShop: false,
          firstTravel: false,
          firstTraining: false,
        },
      },
      statistics: {
        firstPlayTime: now,
        totalPlayTime: 3600, // 1 hour in seconds
        lastPlayTime: now,
        consecutiveDays: 0,
        totalPetsOwned: 1,
        totalPetsLost: 0,
        currentPetAge: 1,
        longestPetLife: 1,
        totalFeedings: 5,
        totalDrinks: 3,
        totalPlays: 2,
        totalCleanings: 1,
        activitiesCompleted: {},
        totalItemsCollected: 10,
        totalCurrencyEarned: 150,
        totalCurrencySpent: 50,
        battleStats: {
          totalBattles: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          flees: 0,
          totalDamageDealt: 0,
          totalDamageTaken: 0,
          totalHealing: 0,
          criticalHits: 0,
          movesUsed: {},
          longestBattle: 0,
          shortestVictory: 0,
          highestDamage: 0,
          mostConsecutiveWins: 0,
          byType: {},
        },
        speciesDiscovered: 1,
        totalSpecies: 50,
        itemsDiscovered: 2,
        totalItems: 100,
        locationsVisited: 1,
        totalTravelDistance: 0,
      },
    },
    saveData: {
      lastSaveTime: now,
      autoSaveEnabled: true,
      saveCount: 0,
      backupSlots: {},
    },
  };
}

/**
 * Create a mock Pet with sensible defaults and customization options
 */
export function createMockPet(options: MockPetOptions = {}): Pet {
  const {
    id = 'test-pet',
    name = 'Test Pet',
    species = 'starter_fire',
    rarity = RARITY_TIERS.COMMON,
    stage = GROWTH_STAGES.HATCHLING,
    health = 20,
    currentHealth,
    maxHealth,
    attack = 5,
    defense = 5,
    speed = 5,
    maxAction = 10,
    energy = 50,
    satiety = 100,
    hydration = 100,
    happiness = 100,
    knownMoves = ['tackle'],
  } = options;

  const now = Date.now();
  const finalHealth = currentHealth ?? health;
  const finalMaxHealth = maxHealth ?? health;

  return {
    id,
    name,
    species: species, // Just use the string ID
    rarity: rarity as any,
    stage: stage as any,
    birthTime: now,
    stageStartTime: now,
    lastInteractionTime: now,
    stats: {
      health: finalHealth,
      maxHealth: finalMaxHealth,
      attack,
      defense,
      speed,
      action: maxAction,
      maxAction: maxAction,
    },
    energy,
    maxEnergy: energy,
    careValues: {
      satiety,
      hydration,
      happiness,
    },
    hiddenCounters: {
      satietyTicks: satiety * 20, // Conversion factor from existing code
      hydrationTicks: hydration * 15,
      happinessTicks: happiness * 30,
      lifeTicks: 100,
    },
    status: { primary: STATUS_TYPES.HEALTHY },
    poopCount: 0,
    moves: knownMoves,
    experiencePoints: 0,
    trainingCounts: {
      health: 0,
      attack: 0,
      defense: 0,
      speed: 0,
      action: 0,
    },
  };
}

/**
 * Create a mock GameUpdateWriter for testing
 */
export function createMockGameUpdateWriter(): GameUpdateWriter {
  return {
    enqueue: () => {},
  };
}

/**
 * Create a mock Egg object
 */
export function createMockEgg(options: Partial<Egg> = {}): Egg {
  const now = Date.now();

  return {
    id: 'egg_1',
    eggType: 'generic_egg',
    obtainedTime: now,
    incubationStartTime: now,
    incubationEndTime: now + 3600000, // 1 hour from now
    isIncubating: false,
    ...options,
  };
}

/**
 * Create a mock EggItem
 */
export function createMockEggItem(options: Partial<EggItem> = {}): EggItem {
  return {
    id: 'egg_item_1',
    name: 'Mystery Egg',
    description: 'A mysterious egg',
    category: 'EGG',
    sprite: 'egg.png',
    stackable: false,
    maxStack: 1,
    sellPrice: 100,
    buyPrice: 500,
    rarity: RARITY_TIERS.COMMON,
    consumable: true,
    eggType: 'generic_egg',
    obtainedFrom: 'shop',
    incubationDuration: 12,
    ...options,
  } as EggItem;
}

/**
 * Common mock items for testing
 */
export const mockItems: Record<string, Item> = {
  apple: {
    id: 'apple',
    name: 'Apple',
    description: 'A fresh apple',
    category: ITEM_CATEGORIES.FOOD,
    sprite: 'apple.png',
    stackable: true,
    maxStack: 99,
    sellPrice: 5,
    buyPrice: 10,
    rarity: RARITY_TIERS.COMMON,
    consumable: true,
  },
  water: {
    id: 'water',
    name: 'Water',
    description: 'Fresh water',
    category: ITEM_CATEGORIES.DRINK,
    sprite: 'water.png',
    stackable: true,
    maxStack: 99,
    sellPrice: 3,
    buyPrice: 5,
    rarity: RARITY_TIERS.COMMON,
    consumable: true,
  },
  pickaxe: {
    id: 'pickaxe',
    name: 'Pickaxe',
    description: 'A mining tool',
    category: ITEM_CATEGORIES.TOOL,
    sprite: 'pickaxe.png',
    stackable: false,
    maxStack: 1,
    sellPrice: 50,
    buyPrice: 100,
    rarity: RARITY_TIERS.COMMON,
    consumable: false,
  },
  ball: {
    id: 'ball',
    name: 'Ball',
    description: 'A bouncy ball',
    category: ITEM_CATEGORIES.TOY,
    sprite: 'ball.png',
    stackable: true,
    maxStack: 10,
    sellPrice: 10,
    buyPrice: 20,
    rarity: RARITY_TIERS.COMMON,
    consumable: false,
  },
};

/**
 * Create a mock inventory item
 */
export function createMockInventoryItem(
  itemId: string,
  quantity: number = 1,
  obtainedTime?: number,
): InventoryItem {
  return {
    itemId,
    quantity,
    obtainedTime: obtainedTime || Date.now(),
  };
}

/**
 * Create mock tuning config for testing
 */
export function createMockTuningConfig() {
  return {
    battle: {
      maxMoves: 4,
      baseAccuracy: 100,
      criticalHitChance: 10,
      criticalHitMultiplier: 1.5,
      fleeBaseChance: 50,
      actionRestoreOnSkip: 10,
      damageFormula: {
        base: 10,
        attackMultiplier: 1.5,
        defenseMultiplier: 0.8,
      },
    },
    limits: {
      maxBattleTurns: 100,
    },
  };
}
