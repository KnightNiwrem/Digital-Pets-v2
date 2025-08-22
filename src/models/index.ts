/**
 * Central export point for all data models and types
 */

// Export all constants
export * from './constants';

// Export Pet models
export type {
  BattleStats,
  CareValues,
  HiddenCounters,
  PetStatus,
  Pet,
  PetCreationOptions,
  PetMemorial,
  PetSnapshot,
} from './Pet';

// Export Species models
export type {
  SpeciesBaseStats,
  SpeciesAppearance,
  SpeciesTraits,
  Species,
  StarterSpecies,
  SpeciesCollectionEntry,
  EggType,
  Egg,
} from './Species';

// Export Item models
export type {
  Item,
  FoodItem,
  DrinkItem,
  ToyItem,
  MedicineItem,
  BandageItem,
  EnergyBoosterItem,
  ToolItem,
  MaterialItem,
  EggItem,
  CurrencyItem,
  InventoryItem,
  ItemDropTable,
  ShopItem,
  ItemEffectResult,
} from './Item';

// Export Location models
export type {
  Location,
  CityLocation,
  WildLocation,
  TravelRoute,
  LocationActivity,
  WorldMap,
  LocationState,
  LocationNPC,
} from './Location';

// Export BattleMove models
export type {
  BattleMove,
  SkipTurnMove,
  BattleParticipant,
  BattleState,
  BattleLogEntry,
  BattleConfig,
  MoveEffectiveness,
  BattleFormulas,
  BattleStatistics,
} from './BattleMove';

// Export GameState models
export type {
  Timer,
  EventRef,
  CalendarEvent,
  Settings,
  TutorialProgress,
  Quest,
  GameStatistics,
  GameState,
  SaveSnapshot,
  GameUpdate,
  SaveState,
  GameInitOptions,
  OfflineCalculation,
  SystemState,
} from './GameState';