// Core types and base domain interfaces for Phase 1.1
// Keep minimal but complete enough to start implementing orchestration & domains.

export enum EventPriority {
  IMMEDIATE = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
}

export interface GameEvent<Payload = any> {
  type: string;
  payload: Payload;
  timestamp: number;
  priority: EventPriority;
}

export type EventHandler<E extends GameEvent = GameEvent> = (event: E) => void;

// Command pattern
export interface Command {
  type: string;
  payload: any;
  validate(state: GameState): boolean;
  execute(state: GameState): StateChange[];
  undo?(state: GameState): StateChange[];
}

// State change: a minimal representation of a change to apply to GameState
export interface StateChange {
  // path describes where to apply the change using dot-notation (e.g. "player.currencies.coins")
  path: string;
  // newValue is the value to set at path (immutable replacement)
  newValue: any;
  // optional descriptive metadata
  meta?: {
    source?: string;
    reason?: string;
  };
}

// State snapshot for save/restore
export interface StateSnapshot {
  state: GameState;
  createdAt: number;
  description?: string;
}

// StateCoordinator interface
export interface StateCoordinator {
  applyChanges(state: GameState, changes: StateChange[]): GameState;
  validateState(state: GameState): boolean;
  createSnapshot(state: GameState): StateSnapshot;
  restoreSnapshot(snapshot: StateSnapshot): GameState;
}

// Minimal domain models (expand later in domains/*)
export type ItemId = string;
export type PetId = string;
export type LocationId = string;
export type NpcId = string;
export type RecipeId = string;

// Item Domain
export enum ItemCategory {
  FOOD = 'FOOD',
  DRINK = 'DRINK',
  TOY = 'TOY',
  MEDICINE = 'MEDICINE',
  GROOMING = 'GROOMING',
  EQUIPMENT = 'EQUIPMENT',
  MATERIAL = 'MATERIAL',
  SPECIAL = 'SPECIAL',
}

export interface ItemEffect {
  key: string;
  magnitude: number;
  // arbitrary payload for extensibility
  meta?: Record<string, any>;
}

export interface ItemDefinition {
  id: ItemId;
  name: string;
  category: ItemCategory;
  rarity?: string;
  baseValue?: number;
  stackable?: boolean;
  maxStack?: number;
  effects?: ItemEffect[];
  recipeId?: RecipeId;
  salvageable?: boolean;
}

// Pet Domain
export interface PetStats {
  hunger: number; // 0-100
  happiness: number; // 0-100
  energy: number; // 0-100
  hygiene: number; // 0-100
  health: number; // 0-100
}

export interface BattleStats {
  level: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

export interface Personality {
  traits: string[]; // names of traits
  mood?: string;
  preferences?: Record<string, any>;
}

export interface Pet {
  id: PetId;
  species: string;
  name: string;
  stats: PetStats;
  battleStats?: BattleStats;
  abilities?: string[];
  age?: number;
  growthStage?: number;
  experience?: number;
  personality?: Personality;
  relationships?: {
    playerId?: string;
    petBonds?: Record<PetId, number>;
  };
}

// Player Domain
export interface InventorySlot {
  itemId: ItemId;
  quantity: number;
}

export interface Inventory {
  items: InventorySlot[];
  maxCapacity: number;
}

export interface Player {
  id: string;
  name: string;
  inventory: Inventory;
  currencies: {
    coins: number;
    gems: number;
  };
  level: number;
  experience: number;
  achievements: string[];
  discovered: {
    pets: string[];
    locations: LocationId[];
    items: ItemId[];
  };
  pets: {
    active: PetId[];
    stored: PetId[];
    graveyard: PetId[];
  };
  settings?: Record<string, any>;
  statistics?: Record<string, any>;
}

// World Domain
export interface Location {
  id: LocationId;
  name: string;
  description?: string;
  availableActivities?: string[];
  npcs?: NpcId[];
  modifiers?: Record<string, any>;
}

export interface MarketPriceRange {
  min: number;
  max: number;
}

export interface World {
  locations: Record<LocationId, Location>;
  currentLocation?: LocationId;
  npcs?: Record<NpcId, any>;
  market?: {
    prices: Record<ItemId, MarketPriceRange>;
    dailyDeals?: ItemId[];
    supplyDemand?: Record<ItemId, number>;
  };
  environment?: {
    timeOfDay?: string;
    weather?: string;
    season?: string;
  };
  activeEvents?: any[];
}

// GameState - top-level immutable state object
export interface GameState {
  player: Player;
  pets: Record<PetId, Pet>;
  world: World;
  items: Record<ItemId, ItemDefinition>;
  activities?: any[]; // active activities / sessions
  ui?: {
    notifications?: any[];
    route?: string;
  };
  metadata?: {
    lastTick?: number;
    version?: string;
  };
}

// Convenience export for referencing filename in logs/tests
export const TYPES_VERSION = 'phase-1.1';
