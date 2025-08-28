/**
 * Main game state interface and related models
 */

import type { Pet, PetMemorial } from './Pet';
import type { InventoryItem } from './Item';
import type { LocationState } from './Location';
import type { Egg, SpeciesCollectionEntry } from './Species';
import type { BattleState, BattleStatistics } from './BattleMove';
import type {
  UpdateType,
  EventType,
  TimerType,
  EventFrequency,
  TextSize,
  ColorBlindMode,
} from './constants';

/**
 * Timer for timed activities
 */
export interface Timer {
  id: string;
  type: TimerType;
  startTime: number;
  endTime: number;
  duration: number; // In milliseconds
  paused: boolean;
  pausedAt?: number;

  // Associated data
  data?: {
    routeId?: string;
    activityId?: string;
    eggId?: string;
    eventId?: string;
    [key: string]: any;
  };
}

/**
 * Event participation reference
 */
export interface EventRef {
  eventId: string;
  joinedAt: number;
  progress: number;
  tokensEarned: number;
  completed: boolean;
}

/**
 * Calendar event
 */
export interface CalendarEvent {
  id: string;
  name: string;
  description: string;
  type: EventType;

  // Schedule
  startTime: number;
  endTime: number;
  timezone: string;
  recurring?: {
    frequency: EventFrequency;
    daysOfWeek?: number[]; // 0-6 for weekly
    dayOfMonth?: number; // For monthly
  };

  // Event content
  activities?: string[]; // Special activity IDs
  battles?: string[]; // Special battle configs
  shop?: string[]; // Special shop items

  // Rewards
  rewards: {
    participation: {
      itemId: string;
      quantity: number;
    }[];
    completion: {
      itemId: string;
      quantity: number;
    }[];
    milestones?: {
      requirement: string;
      rewards: {
        itemId: string;
        quantity: number;
      }[];
    }[];
  };

  // Token system
  tokenExchange?: {
    tokenItemId: string;
    exchangeRate: number; // Tokens to currency
    specialExchanges?: {
      itemId: string;
      tokenCost: number;
      limit?: number;
    }[];
  };
}

/**
 * Game settings
 */
export interface Settings {
  // Audio
  masterVolume: number; // 0-100
  musicVolume: number; // 0-100
  sfxVolume: number; // 0-100

  // Visual
  textSize: TextSize;
  colorBlindMode: ColorBlindMode;
  highContrast: boolean;
  reducedMotion: boolean;
  showParticles: boolean;

  // Gameplay
  autoSave: boolean;
  autoSaveInterval: number; // Minutes
  confirmActions: boolean;
  showTutorialHints: boolean;

  // Notifications
  enableNotifications: boolean;
  lowCareWarning: boolean;
  activityComplete: boolean;
  eventReminders: boolean;

  // Controls
  touchControls: boolean;
  keyboardShortcuts: boolean;
  swipeGestures: boolean;
}

/**
 * Tutorial progress tracking
 */
export interface TutorialProgress {
  completed: string[]; // Tutorial step IDs
  currentStep?: string;
  skipped: boolean;

  // Onboarding milestones
  milestones: {
    firstFeed: boolean;
    firstDrink: boolean;
    firstPlay: boolean;
    firstClean: boolean;
    firstSleep: boolean;
    firstActivity: boolean;
    firstBattle: boolean;
    firstShop: boolean;
    firstTravel: boolean;
    firstTraining: boolean;
  };
}

/**
 * Quest/achievement tracking (future feature)
 */
export interface Quest {
  id: string;
  name: string;
  description: string;

  // Progress
  started: boolean;
  startTime?: number;
  completed: boolean;
  completionTime?: number;

  // Requirements
  objectives: {
    id: string;
    description: string;
    current: number;
    required: number;
    completed: boolean;
  }[];

  // Rewards
  rewards: {
    itemId: string;
    quantity: number;
  }[];
}

/**
 * Game statistics and analytics
 */
export interface GameStatistics {
  // Time tracking
  firstPlayTime: number;
  totalPlayTime: number; // In seconds
  lastPlayTime: number;
  consecutiveDays: number;

  // Pet statistics
  totalPetsOwned: number;
  totalPetsLost: number;
  currentPetAge: number; // In days
  longestPetLife: number; // In days

  // Care statistics
  totalFeedings: number;
  totalDrinks: number;
  totalPlays: number;
  totalCleanings: number;

  // Activity statistics
  activitiesCompleted: {
    [activityType: string]: number;
  };
  totalItemsCollected: number;
  totalCurrencyEarned: number;
  totalCurrencySpent: number;

  // Battle statistics (reference to detailed stats)
  battleStats: BattleStatistics;

  // Collection progress
  speciesDiscovered: number;
  totalSpecies: number;
  itemsDiscovered: number;
  totalItems: number;

  // Travel statistics
  locationsVisited: number;
  totalTravelDistance: number; // In abstract units
  favoriteLocation?: string;
}

/**
 * Main game state structure
 */
export interface GameState {
  // Version and metadata
  version: string;
  timestamp: number;
  playerId: string; // Generated UUID for this save

  // Core game state
  pet: Pet | undefined; // Current active pet

  // Inventory and resources
  inventory: {
    items: InventoryItem[];
    currency: {
      coins: number;
      eventTokens?: { [eventId: string]: number };
    };
    maxSlots: number;
    unlockedSlots: number;
  };

  // World state
  world: {
    currentLocation: LocationState;
    activeTimers: Timer[];
    eventParticipation: EventRef[];
    currentEvents: CalendarEvent[];
    worldTime: number; // Current world time for events
    lastTickTime: number; // Last game tick timestamp
    tickCount: number; // Total ticks since game start
  };

  // Collections
  collections: {
    eggs: Egg[]; // Eggs in inventory
    species: { [speciesId: string]: SpeciesCollectionEntry };
    memorials: PetMemorial[]; // Past pets
  };

  // Battle state (if in battle)
  activeBattle?: BattleState;

  // Meta information
  meta: {
    settings: Settings;
    tutorialProgress: TutorialProgress;
    quests?: Quest[]; // Future feature
    statistics: GameStatistics;
  };

  // Save management
  saveData: {
    lastSaveTime: number;
    autoSaveEnabled: boolean;
    saveCount: number;
    backupSlots: {
      slot1?: SaveSnapshot;
      slot2?: SaveSnapshot;
      slot3?: SaveSnapshot;
    };
  };
}

/**
 * Save snapshot for backup
 */
export interface SaveSnapshot {
  timestamp: number;
  version: string;
  checksum: string;
  compressed: boolean;
  data: string; // JSON string of GameState
}

/**
 * Game update for the queue system
 */
export interface GameUpdate {
  id: string;
  type: UpdateType;
  timestamp: number;

  // Update payload
  payload: {
    action?: string;
    data?: any;
    source?: string; // Which system generated this
    targetSystem?: string; // Which system should handle this
  };

  // Validation
  requiresValidation?: boolean;
  validationRules?: string[];

  // Error handling
  retryable?: boolean;
  maxRetries?: number;
  retryCount?: number;
}

/**
 * Save state for localStorage
 */
export interface SaveState {
  version: string;
  timestamp: number;
  checksum: string;
  data: GameState;
}

/**
 * Game initialization options
 */
export interface GameInitOptions {
  loadFromSave?: boolean;
  saveSlot?: number;
  debugMode?: boolean;
  skipTutorial?: boolean;
  startingLocation?: string;
  startingPet?: {
    species: string;
    name: string;
  };
}

/**
 * Offline calculation result
 */
export interface OfflineCalculation {
  offlineTime: number; // Total seconds offline
  ticksToProcess: number;

  // Care changes
  careDecay: {
    satiety: number;
    hydration: number;
    happiness: number;
    life: number;
  };

  // Poop spawns
  poopSpawned: number;

  // Sickness checks
  sicknessTriggered: boolean;
  sicknessReason?: string;

  // Activity completions
  completedActivities: {
    activityId: string;
    rewards: any;
  }[];

  // Travel completions
  travelCompleted: boolean;
  newLocation?: string;

  // Incubation progress
  eggsHatched: string[];

  // Event expirations
  expiredEvents: string[];

  // Energy regeneration (if sleeping)
  energyRecovered: number;

  // Death check
  petDied: boolean;
  deathReason?: string;
}

/**
 * System initialization state
 */
export interface SystemState {
  initialized: boolean;
  systems: {
    [systemName: string]: {
      initialized: boolean;
      version: string;
      lastUpdate: number;
      errorCount: number;
    };
  };
}
