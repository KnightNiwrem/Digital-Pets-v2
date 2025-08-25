/**
 * Core game constants and enumerations
 */

// Game Update Types for the GameUpdates queue
export const UPDATE_TYPES = {
  USER_ACTION: 'USER_ACTION', // UI-initiated actions
  GAME_TICK: 'GAME_TICK', // Time system tick
  ACTIVITY_COMPLETE: 'ACTIVITY_COMPLETE', // Activity completion
  BATTLE_ACTION: 'BATTLE_ACTION', // Battle system updates
  EVENT_TRIGGER: 'EVENT_TRIGGER', // Calendar event triggers
  SAVE_REQUEST: 'SAVE_REQUEST', // Save state request
  STATE_TRANSITION: 'STATE_TRANSITION', // Major state changes
} as const;

export type UpdateType = (typeof UPDATE_TYPES)[keyof typeof UPDATE_TYPES];

// Pet Rarity Tiers
export const RARITY_TIERS = {
  COMMON: 'COMMON',
  UNCOMMON: 'UNCOMMON',
  RARE: 'RARE',
  EPIC: 'EPIC',
  LEGENDARY: 'LEGENDARY',
} as const;

export type RarityTier = (typeof RARITY_TIERS)[keyof typeof RARITY_TIERS];

// Rarity weights for egg hatching (percentages)
export const RARITY_WEIGHTS = {
  [RARITY_TIERS.COMMON]: 60,
  [RARITY_TIERS.UNCOMMON]: 25,
  [RARITY_TIERS.RARE]: 10,
  [RARITY_TIERS.EPIC]: 4,
  [RARITY_TIERS.LEGENDARY]: 1,
} as const;

// Pet Growth Stages
export const GROWTH_STAGES = {
  HATCHLING: 'HATCHLING',
  JUVENILE: 'JUVENILE',
  ADULT: 'ADULT',
} as const;

export type GrowthStage = (typeof GROWTH_STAGES)[keyof typeof GROWTH_STAGES];

// Move learn stages (alias of growth stages)
export const LEARN_STAGES = GROWTH_STAGES;
export type LearnStage = GrowthStage;

// Growth stage requirements (in hours)
export const STAGE_DURATIONS = {
  [GROWTH_STAGES.HATCHLING]: 24,
  [GROWTH_STAGES.JUVENILE]: 72,
} as const;

// Max energy by stage
export const MAX_ENERGY_BY_STAGE = {
  [GROWTH_STAGES.HATCHLING]: 50,
  [GROWTH_STAGES.JUVENILE]: 80,
  [GROWTH_STAGES.ADULT]: 120,
} as const;

// Item Categories
export const ITEM_CATEGORIES = {
  FOOD: 'FOOD',
  DRINK: 'DRINK',
  TOY: 'TOY',
  MEDICINE: 'MEDICINE',
  BANDAGE: 'BANDAGE',
  ENERGY_BOOSTER: 'ENERGY_BOOSTER',
  TOOL: 'TOOL',
  EGG: 'EGG',
  MATERIAL: 'MATERIAL',
  CURRENCY: 'CURRENCY',
} as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[keyof typeof ITEM_CATEGORIES];

// Food/Drink/Toy effect sizes
export const EFFECT_SIZES = {
  SMALL: 'SMALL',
  MEDIUM: 'MEDIUM',
  LARGE: 'LARGE',
} as const;

export type EffectSize = (typeof EFFECT_SIZES)[keyof typeof EFFECT_SIZES];

// Tool Types
export const TOOL_TYPES = {
  FISHING_ROD: 'FISHING_ROD',
  FORAGING_BASKET: 'FORAGING_BASKET',
  PICKAXE: 'PICKAXE',
} as const;

export type ToolType = (typeof TOOL_TYPES)[keyof typeof TOOL_TYPES];

// Activity Types
export const ACTIVITY_TYPES = {
  FISHING: 'FISHING',
  FORAGING: 'FORAGING',
  MINING: 'MINING',
  TRAINING: 'TRAINING',
  ARENA_PRACTICE: 'ARENA_PRACTICE',
  SLEEPING: 'SLEEPING',
} as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[keyof typeof ACTIVITY_TYPES];

// Activity Durations (in minutes)
export const ACTIVITY_DURATIONS = {
  SHORT: 2,
  MEDIUM: 5,
  LONG: 10,
  TRAINING: 8,
} as const;

// Location Types
export const LOCATION_TYPES = {
  CITY: 'CITY',
  WILD: 'WILD',
} as const;

export type LocationType = (typeof LOCATION_TYPES)[keyof typeof LOCATION_TYPES];

// City Areas
export const CITY_AREAS = {
  SQUARE: 'SQUARE',
  GYM: 'GYM',
  SHOP: 'SHOP',
  ARENA: 'ARENA',
} as const;

export type CityArea = (typeof CITY_AREAS)[keyof typeof CITY_AREAS];

// Wild Biomes
export const WILD_BIOMES = {
  FOREST: 'FOREST',
  MOUNTAINS: 'MOUNTAINS',
  LAKE: 'LAKE',
  DESERT: 'DESERT',
  PLAINS: 'PLAINS',
} as const;

export type WildBiome = (typeof WILD_BIOMES)[keyof typeof WILD_BIOMES];

// Travel Distance Tiers (in minutes)
export const TRAVEL_TIERS = {
  INSTANT: 0, // Intra-city
  SHORT: 3, // Near locations
  MEDIUM: 6, // Medium distance
  LONG: 10, // Far locations
} as const;

export type TravelDistance = 'instant' | 'short' | 'medium' | 'long';

// Pet Status Types
export const STATUS_TYPES = {
  HEALTHY: 'HEALTHY',
  SICK: 'SICK',
  INJURED: 'INJURED',
  SLEEPING: 'SLEEPING',
  TRAVELING: 'TRAVELING',
  IN_ACTIVITY: 'IN_ACTIVITY',
  IN_BATTLE: 'IN_BATTLE',
  DEAD: 'DEAD',
} as const;

export type StatusType = (typeof STATUS_TYPES)[keyof typeof STATUS_TYPES];

// Battle Move Priority Levels
export const MOVE_PRIORITY = {
  LOWEST: -2,
  LOW: -1,
  NORMAL: 0,
  HIGH: 1,
  HIGHEST: 2,
} as const;

export type MovePriority = (typeof MOVE_PRIORITY)[keyof typeof MOVE_PRIORITY];

// Battle Status Effects
export const BATTLE_STATUS_EFFECTS = {
  NONE: 'NONE',
  POISONED: 'POISONED',
  STUNNED: 'STUNNED',
  WEAKENED: 'WEAKENED',
  BUFFED: 'BUFFED',
  ASLEEP: 'ASLEEP',
  PARALYZED: 'PARALYZED',
  CONFUSED: 'CONFUSED',
  REGENERATING: 'REGENERATING',
} as const;

export type BattleStatusEffect = (typeof BATTLE_STATUS_EFFECTS)[keyof typeof BATTLE_STATUS_EFFECTS];

// Care Value Ranges
export const CARE_VALUE_RANGE = {
  MIN: 0,
  MAX: 100,
} as const;

// Care Decay Rates (per hour)
export const CARE_DECAY_RATES = {
  SATIETY: 3,
  HYDRATION: 4,
  HAPPINESS: 2,
} as const;

// Tick-based multipliers (ticks per unit of care value)
export const CARE_TICK_MULTIPLIERS = {
  SATIETY: 20, // 20 ticks = 1 satiety unit (20 minutes)
  HYDRATION: 15, // 15 ticks = 1 hydration unit (15 minutes)
  HAPPINESS: 30, // 30 ticks = 1 happiness unit (30 minutes)
} as const;

// Game Tick Interval (in seconds)
export const GAME_TICK_INTERVAL = 60;

// Poop Spawn Time Range (in hours)
export const POOP_SPAWN_RANGE = {
  MIN: 6,
  MAX: 24,
} as const;

// Sleep Constants
export const SLEEP_CONSTANTS = {
  MAX_DURATION_HOURS: 8,
  FORCE_WAKE_PENALTY: 0.5, // Energy recovery multiplier when forced awake
} as const;

// Save System Constants
export const SAVE_CONSTANTS = {
  MAX_SAVES: 3,
  SAVE_VERSION: '1.0.0',
  STORAGE_KEY: 'digital_pet_save',
  BACKUP_KEY_PREFIX: 'digital_pet_backup_',
} as const;

// Event Types
export const EVENT_TYPES = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  SEASONAL: 'SEASONAL',
  SPECIAL: 'SPECIAL',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

// Currency Types
export const CURRENCY_TYPES = {
  COINS: 'COINS',
  EVENT_TOKENS: 'EVENT_TOKENS',
} as const;

export type CurrencyType = (typeof CURRENCY_TYPES)[keyof typeof CURRENCY_TYPES];

// Stack Limits
export const STACK_LIMITS = {
  DEFAULT: 99,
  MATERIALS: 999,
  CURRENCY: 999999,
  NON_STACKABLE: 1,
} as const;

// Battle Constants
export const BATTLE_CONSTANTS = {
  MAX_MOVES: 4,
  BASE_ACCURACY: 100,
  CRITICAL_HIT_CHANCE: 10, // percentage
  CRITICAL_HIT_MULTIPLIER: 1.5,
  FLEE_BASE_CHANCE: 50, // percentage
} as const;

// Training Constants
export const TRAINING_CONSTANTS = {
  STAT_INCREASE_PER_SESSION: 2,
  MOVE_LEARN_CHANCE: 20, // percentage
  ACTION_STAT_INCREASE: 1,
} as const;

// Stage Advancement Stat Bonuses
export const STAGE_ADVANCEMENT_BONUSES = {
  HEALTH: 10,
  ATTACK: 3,
  DEFENSE: 3,
  SPEED: 2,
  ACTION: 5,
} as const;

// Tool Tiers
export type ToolTier = 'basic' | 'advanced' | 'master';

// Battle Types
export type BattleType = 'wild' | 'trainer' | 'arena' | 'event';

// Difficulty Levels
export type DifficultyLevel = 'easy' | 'normal' | 'medium' | 'hard' | 'extreme';

// Weather Types
export type WeatherType =
  | 'sunny'
  | 'rainy'
  | 'sandstorm'
  | 'foggy'
  | 'clear'
  | 'rain'
  | 'snow'
  | 'fog'
  | 'wind';

// Terrain Types
export type TerrainType = 'normal' | 'grassy' | 'rocky' | 'water';

// Team Types
export type TeamType = 'player' | 'enemy' | 'ally';

// Battle End Reasons
export type BattleEndReason = 'defeat' | 'victory' | 'flee' | 'capture' | 'timeout';

// Battle Log Types
export type BattleLogType =
  | 'move'
  | 'damage'
  | 'status'
  | 'item'
  | 'flee'
  | 'switch'
  | 'weather'
  | 'other';

// AI Strategy Types
export type AIStrategy = 'random' | 'aggressive' | 'defensive' | 'balanced' | 'smart';

// Move Types
export type MoveType = 'damage' | 'status' | 'healing' | 'buff' | 'debuff' | 'special' | 'counter';

// Target Types
export type TargetType = 'self' | 'enemy' | 'all_enemies' | 'all_allies';

// Stats for training/battle
export type StatType = 'health' | 'attack' | 'defense' | 'speed' | 'action';

// Condition Types
export type ConditionType =
  | 'low_health'
  | 'high_health'
  | 'status_effect'
  | 'weather'
  | 'LAST_DAMAGE_TAKEN';

// Lighting Types
export type LightingType = 'day' | 'night' | 'dawn' | 'dusk' | 'indoor';

// Population Sizes
export type PopulationSize = 'small' | 'medium' | 'large';

// Safety Levels
export type SafetyLevel = 'safe' | 'moderate' | 'dangerous';

// Route Types
export type RouteType = 'road' | 'path' | 'wilderness' | 'sea' | 'air';

// Encounter Types
export type EncounterType = 'battle' | 'event' | 'discovery';

// Hazard Types
export type HazardType = 'quicksand' | 'thorns' | 'poison_gas' | 'extreme_heat' | 'extreme_cold';

// NPC Roles
export type NPCRole = 'shopkeeper' | 'trainer' | 'quest_giver' | 'informant' | 'challenger';

// NPC Personalities
export type NPCPersonality = 'friendly' | 'neutral' | 'grumpy' | 'mysterious';

// Material Types
export type MaterialType = 'ore' | 'wood' | 'fabric' | 'gem' | 'ingredient';

// Quality Levels
export type QualityLevel = 'poor' | 'normal' | 'fine' | 'exceptional';

// Item Obtain Sources
export type ItemObtainSource = 'shop' | 'activity' | 'event' | 'gift' | 'wild';

// Currency Type Extended
export type ExtendedCurrencyType = 'coins' | 'event_tokens' | 'premium';

// Cure Status Types
export type CureStatusType = 'sickness' | 'poison' | 'all';

// Food Effect Types
export type FoodEffectType = 'energy_boost' | 'cure_sickness' | 'growth_boost';

// Drink Effect Types
export type DrinkEffectType = 'speed_boost' | 'cure_fatigue' | 'happiness_boost';

// Energy Side Effects
export type EnergySideEffectType = 'crash' | 'hyperactive';

// Timer Types
export type TimerType = 'travel' | 'activity' | 'sleep' | 'training' | 'incubation' | 'event';

// Event Frequency
export type EventFrequency = 'daily' | 'weekly' | 'monthly';

// Text Sizes
export type TextSize = 'small' | 'medium' | 'large';

// Color Blind Modes
export type ColorBlindMode = 'off' | 'protanopia' | 'deuteranopia' | 'tritanopia';

// Pet Temperaments
export const TEMPERAMENT_TYPES = {
  PLAYFUL: 'playful',
  CALM: 'calm',
  ENERGETIC: 'energetic',
  LAZY: 'lazy',
  AGGRESSIVE: 'aggressive',
  TIMID: 'timid',
  ADVENTUROUS: 'adventurous',
  STOIC: 'stoic',
  HYPERACTIVE: 'hyperactive',
  PROUD: 'proud',
} as const;
export type PetTemperament =
  (typeof TEMPERAMENT_TYPES)[keyof typeof TEMPERAMENT_TYPES];

// Pet Habitats
export const HABITAT_TYPES = {
  FOREST: 'forest',
  MOUNTAIN: 'mountain',
  LAKE: 'lake',
  DESERT: 'desert',
  PLAINS: 'plains',
  URBAN: 'urban',
  CAVE: 'cave',
  STORM: 'storm',
  VOLCANO: 'volcano',
} as const;
export type PetHabitat = (typeof HABITAT_TYPES)[keyof typeof HABITAT_TYPES];

// Activity Preferences
export const ACTIVITY_PREFERENCE_TYPES = {
  DIURNAL: 'diurnal',
  NOCTURNAL: 'nocturnal',
  CREPUSCULAR: 'crepuscular',
  CATHEMERAL: 'cathemeral',
} as const;
export type ActivityPreference =
  (typeof ACTIVITY_PREFERENCE_TYPES)[keyof typeof ACTIVITY_PREFERENCE_TYPES];

// Pet Ability Effects
export const EFFECT_TYPES = {
  DAMAGE_REDUCTION: 'DAMAGE_REDUCTION',
  STATUS_IMMUNITY: 'STATUS_IMMUNITY',
  HEALTH_REGEN: 'HEALTH_REGEN',
  CONTACT_STATUS: 'CONTACT_STATUS',
  BATTLE_START_DEBUFF: 'BATTLE_START_DEBUFF',
} as const;
export type PetAbilityEffect = (typeof EFFECT_TYPES)[keyof typeof EFFECT_TYPES];

// Death Causes
export type DeathCause = 'neglect' | 'old_age';
