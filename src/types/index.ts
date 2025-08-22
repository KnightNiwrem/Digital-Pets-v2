// Core System Types
export interface GameSystem {
  initialize(): Promise<void> | void;
  update?(deltaTime: number): void;
  tick?(): void;
  shutdown?(): Promise<void> | void;
}

export enum SystemType {
  TIME_MANAGER = 'timeManager',
  STATE_MANAGER = 'stateManager',
  EVENT_MANAGER = 'eventManager',
  PET_SYSTEM = 'petSystem',
  CARE_SYSTEM = 'careSystem',
  GROWTH_SYSTEM = 'growthSystem',
  STATUS_SYSTEM = 'statusSystem',
  ACTIVITY_SYSTEM = 'activitySystem',
  TRAVEL_SYSTEM = 'travelSystem',
  TRAINING_SYSTEM = 'trainingSystem',
  BATTLE_SYSTEM = 'battleSystem',
  LOCATION_SYSTEM = 'locationSystem',
  EVENT_SYSTEM = 'eventSystem',
  ITEM_SYSTEM = 'itemSystem',
  SHOP_SYSTEM = 'shopSystem',
  UI_MANAGER = 'uiManager',
  PERSISTENCE_MANAGER = 'persistenceManager',
  SAVE_MANAGER = 'saveManager',
  BACKUP_MANAGER = 'backupManager',
}

export enum AutosaveReason {
  TICK = 'tick',
  USER_ACTION = 'user_action',
  SYSTEM_CHANGE = 'system_change',
  PERIODIC = 'periodic',
  SHUTDOWN = 'shutdown',
}

// Event System Types
export interface GameEvent {
  type: EventType;
  payload?: any;
  timestamp: number;
  source?: string;
}

export enum EventType {
  // Time events
  TICK = 'tick',
  OFFLINE_CATCHUP = 'offline_catchup',

  // User action events
  USER_ACTION = 'user_action',

  // Pet events
  PET_CREATED = 'pet_created',
  PET_DIED = 'pet_died',
  PET_FED = 'pet_fed',
  PET_DRANK = 'pet_drank',
  PET_PLAYED = 'pet_played',
  PET_SLEPT = 'pet_slept',
  PET_AWAKENED = 'pet_awakened',

  // Care events
  CARE_DECAY = 'care_decay',
  SATIETY_LOW = 'satiety_low',
  HYDRATION_LOW = 'hydration_low',
  HAPPINESS_LOW = 'happiness_low',
  LIFE_CRITICAL = 'life_critical',

  // State events
  STATE_UPDATED = 'state_updated',
  SAVE_COMPLETED = 'save_completed',
  LOAD_COMPLETED = 'load_completed',

  // System events
  SYSTEM_INITIALIZED = 'system_initialized',
  SYSTEM_ERROR = 'system_error',
}

export type EventHandler = (event: GameEvent) => void | Promise<void>;
export type Unsubscribe = () => void;

// State Management Types
export interface GameState {
  meta: GameMeta;
  pet: PetState | null;
  world: WorldState;
  inventory: InventoryState;
  settings: SettingsState;
  time: TimeState;
}

export interface GameMeta {
  version: string;
  createdAt: number;
  lastSaveTime: number;
  playerId: string;
}

export interface PetState {
  id: string;
  species: Species;
  rarity: Rarity;
  name: string;
  stage: GrowthStage;
  createdAt: number;
  lastInteractionTime: number;

  // Care values (displayed 0-100)
  satiety: number;
  hydration: number;
  happiness: number;

  // Hidden care ticks
  satietyTicks: number;
  hydrationTicks: number;
  happinessTicks: number;

  // Hidden life stat
  life: number;

  // Energy
  energy: number;
  maxEnergy: number;

  // Status
  isSleeping: boolean;
  sleepStartTime: number | null;
  poopCount: number;
  statuses: StatusEffect[];

  // Battle stats
  battleStats: BattleStats;
  knownMoves: Move[];

  // Stage progression
  stageStartTime: number;
  canAdvanceStage: boolean;
}

export interface BattleStats {
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  speed: number;
  action: number;
  maxAction: number;
}

export interface WorldState {
  currentLocation: Location;
  currentActivity: Activity | null;
  currentTravel: Travel | null;
  currentTraining: Training | null;
  currentBattle: Battle | null;
  currentEvent: CalendarEvent | null;
}

export interface InventoryState {
  items: { [itemId: string]: number };
  coins: number;
  eggs: Egg[];
  maxSlots: number;
}

export interface SettingsState {
  accessibility: AccessibilitySettings;
  notifications: NotificationSettings;
  audio: AudioSettings;
}

export interface TimeState {
  lastTickTime: number;
  tickCount: number;
  offlineTime: number;
  scheduledEvents: ScheduledEvent[];
}

// Game Action Types
export interface GameAction {
  type: ActionType;
  payload?: any;
  timestamp?: number;
}

export enum ActionType {
  // Pet actions
  CREATE_PET = 'create_pet',
  FEED_PET = 'feed_pet',
  GIVE_DRINK = 'give_drink',
  PLAY_WITH_PET = 'play_with_pet',
  CLEAN_POOP = 'clean_poop',
  START_SLEEP = 'start_sleep',
  WAKE_PET = 'wake_pet',

  // Care updates
  UPDATE_CARE_VALUES = 'update_care_values',
  DECAY_CARE = 'decay_care',
  ADD_POOP = 'add_poop',

  // State management
  SET_STATE = 'set_state',
  MERGE_STATE = 'merge_state',
  RESET_STATE = 'reset_state',

  // Time actions
  PROCESS_TICK = 'process_tick',
  PROCESS_OFFLINE_TIME = 'process_offline_time',

  // System actions
  INITIALIZE_SYSTEM = 'initialize_system',
  SHUTDOWN_SYSTEM = 'shutdown_system',
}

export type StateListener = (state: GameState, previousState?: GameState) => void;

export interface StateSnapshot {
  state: GameState;
  timestamp: number;
  checksum: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Time Management Types
export interface OfflineUpdate {
  ticksProcessed: number;
  careDecay: {
    satiety: number;
    hydration: number;
    happiness: number;
  };
  poopSpawned: number;
  activitiesCompleted: Activity[];
  sleepCompleted: boolean;
  energyRecovered: number;
}

export interface ScheduledEvent {
  id: string;
  triggerTime: number;
  callback: () => void;
  recurring?: boolean;
  interval?: number;
}

export type TickHandler = () => void;

// Pet Related Types
export enum Species {
  // Common starters
  FLUFFY_PUP = 'fluffy_pup',
  BUBBLE_CAT = 'bubble_cat',
  LEAF_SPRITE = 'leaf_sprite',

  // More species to be added in later phases
}

export enum Rarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

export enum GrowthStage {
  HATCHLING = 'hatchling',
  JUVENILE = 'juvenile',
  ADULT = 'adult',
}

export interface StatusEffect {
  type: StatusType;
  severity: number;
  startTime: number;
  duration?: number; // null for permanent until treated
}

export enum StatusType {
  SICK = 'sick',
  INJURED = 'injured',
  POISONED = 'poisoned',
  ENERGIZED = 'energized',
}

// Item Types
export interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  rarity: Rarity;
  stackable: boolean;
  maxStack?: number;
  durability?: number;
  description: string;
  effects: ItemEffect[];
}

export enum ItemCategory {
  FOOD = 'food',
  DRINK = 'drink',
  TOY = 'toy',
  MEDICINE = 'medicine',
  BANDAGE = 'bandage',
  ENERGY_BOOSTER = 'energy_booster',
  TOOL = 'tool',
  MISC = 'misc',
}

export interface ItemEffect {
  type: ItemEffectType;
  value: number;
  duration?: number;
}

export enum ItemEffectType {
  RESTORE_SATIETY = 'restore_satiety',
  RESTORE_HYDRATION = 'restore_hydration',
  RESTORE_HAPPINESS = 'restore_happiness',
  RESTORE_ENERGY = 'restore_energy',
  RESTORE_HEALTH = 'restore_health',
  CURE_SICKNESS = 'cure_sickness',
  CURE_INJURY = 'cure_injury',
  BOOST_STATS = 'boost_stats',
}

// Activity Types
export interface Activity {
  id: string;
  type: ActivityType;
  name: string;
  location: Location;
  duration: number; // in seconds
  energyCost: number;
  startTime: number;
  progress: number; // 0-1
  rewards: Reward[];
  risks: Risk[];
}

export enum ActivityType {
  FISHING = 'fishing',
  FORAGING = 'foraging',
  MINING = 'mining',
  EXPLORING = 'exploring',
  TRAINING = 'training',
  SLEEPING = 'sleeping',
}

export interface Training extends Activity {
  stat: keyof BattleStats;
  moveLearnChance: number;
}

export interface Travel {
  id: string;
  from: Location;
  to: Location;
  startTime: number;
  duration: number;
  energyCost: number;
  progress: number; // 0-1
}

// Location Types
export interface Location {
  id: string;
  name: string;
  type: LocationType;
  description: string;
  availableActivities: ActivityType[];
  shops: Shop[];
  distanceTo: { [locationId: string]: DistanceTier };
}

export enum LocationType {
  CITY = 'city',
  CITY_AREA = 'city_area',
  WILD_BIOME = 'wild_biome',
}

export enum DistanceTier {
  SAME_AREA = 'same_area', // Instant, free
  SAME_CITY = 'same_city', // Instant, free
  NEARBY = 'nearby', // 3 minutes
  MEDIUM = 'medium', // 6 minutes
  FAR = 'far', // 10 minutes
}

// Shop Types
export interface Shop {
  id: string;
  name: string;
  type: ShopType;
  inventory: ShopItem[];
  lastRestockTime: number;
  nextRestockTime: number;
}

export enum ShopType {
  GENERAL = 'general',
  FOOD = 'food',
  TOOLS = 'tools',
  MEDICINE = 'medicine',
  EGG_SHOP = 'egg_shop',
}

export interface ShopItem {
  item: Item;
  price: number;
  stock: number;
  restockAmount: number;
}

// Battle Types
export interface Battle {
  id: string;
  playerPet: Combatant;
  opponent: Combatant;
  turnOrder: string[];
  currentTurn: number;
  battleLog: BattleLogEntry[];
  status: BattleStatus;
}

export enum BattleStatus {
  STARTING = 'starting',
  IN_PROGRESS = 'in_progress',
  VICTORY = 'victory',
  DEFEAT = 'defeat',
  FLED = 'fled',
  INTERRUPTED = 'interrupted',
}

export interface Combatant {
  id: string;
  name: string;
  species: Species;
  battleStats: BattleStats;
  currentHealth: number;
  currentAction: number;
  moves: Move[];
  statusEffects: StatusEffect[];
  isPlayer: boolean;
}

export interface Move {
  id: string;
  name: string;
  power: number;
  accuracy: number;
  actionCost: number;
  priority: number;
  effects: MoveEffect[];
  description: string;
}

export interface MoveEffect {
  type: MoveEffectType;
  value: number;
  target: EffectTarget;
  chance: number;
}

export enum MoveEffectType {
  DAMAGE = 'damage',
  HEAL = 'heal',
  STATUS = 'status',
  STAT_BOOST = 'stat_boost',
  STAT_REDUCTION = 'stat_reduction',
}

export enum EffectTarget {
  SELF = 'self',
  OPPONENT = 'opponent',
  ALL = 'all',
}

export interface BattleLogEntry {
  turn: number;
  actor: string;
  action: string;
  target?: string;
  result: string;
  timestamp: number;
}

// Event Types
export interface CalendarEvent {
  id: string;
  name: string;
  type: CalendarEventType;
  startTime: number;
  endTime: number;
  description: string;
  rewards: Reward[];
  requirements: Requirement[];
  isActive: boolean;
  participants: string[];
}

export enum CalendarEventType {
  ARENA_BATTLE = 'arena_battle',
  TOURNAMENT = 'tournament',
  SEASONAL_EVENT = 'seasonal_event',
  COMMUNITY_CHALLENGE = 'community_challenge',
}

// Reward and Risk Types
export interface Reward {
  type: RewardType;
  item?: Item;
  amount: number;
  rarity?: Rarity;
}

export enum RewardType {
  COINS = 'coins',
  ITEM = 'item',
  EGG = 'egg',
  EXPERIENCE = 'experience',
}

export interface Risk {
  type: RiskType;
  chance: number;
  severity: number;
}

export enum RiskType {
  INJURY = 'injury',
  SICKNESS = 'sickness',
  ENERGY_LOSS = 'energy_loss',
  BATTLE_ENCOUNTER = 'battle_encounter',
}

export interface Requirement {
  type: RequirementType;
  value: any;
  description: string;
}

export enum RequirementType {
  MIN_STAGE = 'min_stage',
  HAS_ITEM = 'has_item',
  MIN_STAT = 'min_stat',
  LOCATION = 'location',
  TIME_WINDOW = 'time_window',
}

// Egg Types
export interface Egg {
  id: string;
  type: EggType;
  rarity: Rarity;
  incubationTime: number; // in seconds
  startedIncubation?: number;
  isIncubating: boolean;
  hatchTime?: number;
  rarityWeights: { [key in Rarity]: number };
}

export enum EggType {
  BASIC = 'basic',
  RARE = 'rare',
  LEGENDARY = 'legendary',
  EVENT = 'event',
}

// Settings Types
export interface AccessibilitySettings {
  colorBlindMode: ColorBlindMode;
  highContrast: boolean;
  fontScale: number;
  reducedMotion: boolean;
  screenReaderEnabled: boolean;
}

export enum ColorBlindMode {
  NONE = 'none',
  PROTANOPIA = 'protanopia',
  DEUTERANOPIA = 'deuteranopia',
  TRITANOPIA = 'tritanopia',
}

export interface NotificationSettings {
  lowCareAlerts: boolean;
  highPoopAlerts: boolean;
  activityComplete: boolean;
  eventReminders: boolean;
  soundEnabled: boolean;
}

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  muted: boolean;
}

// UI Types
export interface UIState {
  currentScreen: Screen;
  modalStack: Modal[];
  notifications: Notification[];
  isLoading: boolean;
}

export enum Screen {
  GAME = 'game',
  INVENTORY = 'inventory',
  SHOP = 'shop',
  BATTLE = 'battle',
  SETTINGS = 'settings',
  STARTER_SELECTION = 'starter_selection',
}

export interface Modal {
  id: string;
  type: ModalType;
  title: string;
  content: any;
  actions: ModalAction[];
}

export enum ModalType {
  CONFIRMATION = 'confirmation',
  INFO = 'info',
  ERROR = 'error',
  REWARD = 'reward',
  BATTLE_SUMMARY = 'battle_summary',
}

export interface ModalAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  duration?: number;
  actions?: NotificationAction[];
}

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

export interface NotificationAction {
  label: string;
  action: () => void;
}

// Constants for game balance
export const CARE_CONSTANTS = {
  // Multipliers for converting ticks to display values
  SATIETY_MULTIPLIER: 20, // 1 satiety = 20 ticks (20 minutes)
  HYDRATION_MULTIPLIER: 15, // 1 hydration = 15 ticks (15 minutes)
  HAPPINESS_MULTIPLIER: 30, // 1 happiness = 30 ticks (30 minutes)

  // Decay rates (ticks lost per game tick - every 60 seconds)
  SATIETY_DECAY_RATE: 1, // Lose 1 tick per minute = 3 per hour
  HYDRATION_DECAY_RATE: 1, // Lose 1 tick per minute = 4 per hour
  HAPPINESS_DECAY_RATE: 1, // Lose 1 tick per minute = 2 per hour

  // Life stat constants
  LIFE_MAX: 100,
  LIFE_CRITICAL_THRESHOLD: 20,
  LIFE_DECAY_RATE: 0.1, // Slow decay when care is neglected
  LIFE_RECOVERY_RATE: 0.5, // Faster recovery when care is maintained
};

export const ENERGY_CONSTANTS = {
  // Max energy by stage
  HATCHLING_MAX_ENERGY: 50,
  JUVENILE_MAX_ENERGY: 80,
  ADULT_MAX_ENERGY: 120,

  // Sleep constants
  SLEEP_REGEN_BASE_RATE: 10, // Energy per hour while sleeping
  SLEEP_MAX_DURATION: 8 * 60 * 60, // 8 hours in seconds
  EARLY_WAKE_PENALTY: 0.5, // Halve recovered energy if woken early

  // Activity energy costs
  TRAVEL_ENERGY_COSTS: {
    [DistanceTier.SAME_AREA]: 0,
    [DistanceTier.SAME_CITY]: 0,
    [DistanceTier.NEARBY]: 10,
    [DistanceTier.MEDIUM]: 20,
    [DistanceTier.FAR]: 35,
  },
};

export const TIME_CONSTANTS = {
  TICK_INTERVAL: 60 * 1000, // 60 seconds in milliseconds
  POOP_SPAWN_MIN_HOURS: 6,
  POOP_SPAWN_MAX_HOURS: 24,

  // Activity durations (in seconds)
  ACTIVITY_DURATIONS: {
    SHORT: 2 * 60, // 2 minutes
    MEDIUM: 5 * 60, // 5 minutes
    LONG: 10 * 60, // 10 minutes
    TRAINING: 8 * 60, // 8 minutes
  },

  // Travel durations (in seconds)
  TRAVEL_DURATIONS: {
    [DistanceTier.NEARBY]: 3 * 60, // 3 minutes
    [DistanceTier.MEDIUM]: 6 * 60, // 6 minutes
    [DistanceTier.FAR]: 10 * 60, // 10 minutes
  },

  // Stage advancement minimum times
  STAGE_MIN_TIMES: {
    [GrowthStage.HATCHLING]: 24 * 60 * 60, // 24 hours
    [GrowthStage.JUVENILE]: 72 * 60 * 60, // 72 hours
  },
};
