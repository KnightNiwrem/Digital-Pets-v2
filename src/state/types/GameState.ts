/**
 * Core game state types for the Digital Pet Game
 */

/**
 * Pet rarity levels
 */
export type PetRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * Pet health states
 */
export interface HealthState {
  current: number;
  maximum: number;
  conditions: string[]; // ['sick', 'injured', 'healthy']
  immunities: string[];
}

/**
 * Pet personality traits
 */
export interface Personality {
  traits: {
    friendliness: number;   // 0-100
    energy: number;         // 0-100
    curiosity: number;      // 0-100
    independence: number;   // 0-100
    playfulness: number;    // 0-100
  };
  preferences: {
    favoriteFood: string[];
    favoriteActivities: string[];
    preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  };
  mood: number; // 0-100, calculated from stats and interactions
}

/**
 * Relationship between pets or pets and NPCs
 */
export interface Relationship {
  targetId: string;
  targetType: 'pet' | 'npc';
  level: number; // 0-100
  type: 'friendship' | 'rivalry' | 'family' | 'neutral';
  history: {
    firstMet: number;
    lastInteraction: number;
    positiveInteractions: number;
    negativeInteractions: number;
  };
}

/**
 * Pet statistics (displayed to user)
 */
export interface PetStats {
  satiety: number;    // 0-100
  hydration: number;  // 0-100
  happiness: number;  // 0-100
  energy: number;     // 0-100
  hygiene: number;    // 0-100
  health: HealthState;
}

/**
 * Main pet entity
 */
export interface Pet {
  id: string;
  name: string;
  species: string;
  rarity: PetRarity;
  stats: PetStats;
  personality: Personality;
  relationships: Relationship[];
  growthStage: number;
  lifespan: number; // Current lifespan remaining
  maxLifespan: number; // Maximum possible lifespan (1,000,000 ticks)
  experience: number;
  level: number;
  
  // Timestamps
  birthTime: number;
  lastCared: number;
  lastFed: number;
  lastPlayed: number;
  
  // State
  isActive: boolean;
  currentActivity?: string;
  location: string;
}

/**
 * Item types in the game
 */
export type ItemType = 'food' | 'drink' | 'medicine' | 'toy' | 'equipment' | 'material' | 'special';

/**
 * Individual item in inventory
 */
export interface Item {
  id: string;
  type: ItemType;
  name: string;
  description: string;
  rarity: PetRarity;
  quantity: number;
  stackLimit: number;
  value: number;
  
  // Effects when used
  effects: {
    satiety?: number;
    hydration?: number;
    happiness?: number;
    energy?: number;
    hygiene?: number;
    health?: number;
  };
  
  // Usage restrictions
  cooldown?: number;
  lastUsed?: number;
  targetSpecies?: string[];
}

/**
 * Currency wallet
 */
export interface CurrencyWallet {
  coins: number;        // Standard currency
  gems?: number;        // Premium currency (future)
  [currencyType: string]: number | undefined;
}

/**
 * Player inventory
 */
export interface Inventory {
  items: Item[];
  capacity: number;
  currency: CurrencyWallet;
}

/**
 * World event (dynamic world changes)
 */
export interface WorldEvent {
  id: string;
  type: string;
  startTime: number;
  endTime?: number;
  effects: Record<string, any>;
  description: string;
}

/**
 * Current world state
 */
export interface WorldState {
  currentLocation: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  weather: 'sunny' | 'rainy' | 'cloudy' | 'stormy' | 'snowy';
  worldEvents: WorldEvent[];
  discoveredLocations: string[];
  unlockedFeatures: string[];
}

/**
 * Active timed activity
 */
export interface ActiveActivity {
  id: string;
  type: string;
  petId: string;
  startTime: number;
  duration: number;
  progress: number; // 0-1
  rewards?: any[];
  canCancel: boolean;
}

/**
 * Player profile
 */
export interface PlayerProfile {
  id: string;
  name: string;
  level: number;
  experience: number;
  
  // Statistics
  stats: {
    totalPlayTime: number;
    petsRaised: number;
    achievementsUnlocked: number;
    itemsCrafted: number;
    battlesWon: number;
  };
  
  // Settings
  preferences: {
    notifications: boolean;
    soundEnabled: boolean;
    musicEnabled: boolean;
    autoSave: boolean;
  };
}

/**
 * Pets container (organized by status)
 */
export interface PetsState {
  active: Pet[];     // Currently being cared for
  stored: Pet[];     // In storage/daycare
  graveyard: Pet[];  // Deceased pets (for memories)
}

/**
 * UI state for the game interface
 */
export interface UIState {
  currentScreen: string;
  modalStack: string[];
  tutorialProgress: {
    completed: boolean;
    currentStep: string;
    stepsCompleted: string[];
  };
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    accessibility: {
      reducedMotion: boolean;
      highContrast: boolean;
      fontSize: 'small' | 'medium' | 'large';
    };
  };
}

/**
 * Game statistics for analytics
 */
export interface GameStatistics {
  sessions: {
    totalSessions: number;
    totalPlayTime: number;
    averageSessionLength: number;
    lastSession: number;
  };
  
  gameplay: {
    petsCreated: number;
    itemsUsed: number;
    activitiesCompleted: number;
    locationsVisited: number;
  };
  
  progression: {
    highestLevel: number;
    rareItemsFound: number;
    achievementsEarned: number;
  };
}

/**
 * Achievement definition
 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: PetRarity;
  unlocked: boolean;
  unlockedAt?: number;
  progress: number;
  maxProgress: number;
  rewards?: {
    experience?: number;
    items?: string[];
    currency?: Record<string, number>;
  };
}

/**
 * Main game state structure
 */
export interface GameState {
  // Metadata
  version: string;
  timestamp: number;
  sessionId: string;
  
  // Core data
  player: PlayerProfile;
  pets: PetsState;
  inventory: Inventory;
  world: WorldState;
  
  // Active states
  activities: ActiveActivity[];
  
  // UI state
  ui: UIState;
  
  // System data
  statistics: GameStatistics;
  achievements: Achievement[];
  
  // Game settings
  settings: {
    gameSpeed: number;
    autoSave: boolean;
    tickInterval: number;
  };
}