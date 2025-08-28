/**
 * Item-related data models and interfaces
 */

import type {
  ItemCategory,
  EffectSize,
  ToolType,
  RarityTier,
  GrowthStage,
  ToolTier,
  MaterialType,
  QualityLevel,
  ItemObtainSource,
  ExtendedCurrencyType,
  CureStatusType,
  FoodEffectType,
  DrinkEffectType,
  EnergySideEffectType,
} from './constants';

/**
 * Base item interface
 */
export interface Item {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  sprite: string; // Path to item sprite

  // Stack and inventory properties
  stackable: boolean;
  maxStack: number;
  sellPrice: number;
  buyPrice: number;

  // Rarity for drop rates and shop generation
  rarity: RarityTier;

  // Usage restrictions
  minStageRequired?: GrowthStage;
  usableInBattle?: boolean;
  consumable: boolean;
}

/**
 * Food item that restores satiety
 */
export interface FoodItem extends Item {
  category: 'FOOD';
  effectSize: EffectSize;
  satietyRestore: number; // Amount of satiety to restore
  happinessBonus?: number; // Optional happiness bonus
  specialEffect?: {
    type: FoodEffectType;
    value: number;
    duration?: number; // Duration in minutes if applicable
  };
}

/**
 * Drink item that restores hydration
 */
export interface DrinkItem extends Item {
  category: 'DRINK';
  effectSize: EffectSize;
  hydrationRestore: number; // Amount of hydration to restore
  energyBonus?: number; // Optional energy bonus
  specialEffect?: {
    type: DrinkEffectType;
    value: number;
    duration?: number;
  };
}

/**
 * Toy item that increases happiness
 */
export interface ToyItem extends Item {
  category: 'TOY';
  effectSize: EffectSize;
  happinessIncrease: number; // Amount of happiness to increase
  energyCost: number; // Energy required to play
  durability?: number; // Number of uses before breaking (undefined = infinite)
  currentDurability?: number; // Current durability if applicable
  interactionTime: number; // Time in seconds for play animation
}

/**
 * Medicine item for treating sickness
 */
export interface MedicineItem extends Item {
  category: 'MEDICINE';
  effectiveness: number; // 0-100, how effective at curing
  curesStatus: CureStatusType;
  healingAmount?: number; // Optional health restoration
  preventionDuration?: number; // Hours of sickness immunity
}

/**
 * Bandage item for treating injuries
 */
export interface BandageItem extends Item {
  category: 'BANDAGE';
  effectiveness: number; // 0-100, how effective at healing
  healingSeverityReduction: number; // Amount to reduce injury severity
  instantHeal: boolean; // Whether healing is instant or over time
  movementSpeedRestore?: number; // Percentage of movement speed restored
}

/**
 * Hygiene item for cleaning poop
 */
export interface HygieneItem extends Item {
  category: 'HYGIENE';
  cleaningPower: number; // Amount of poop to clean (0 = all)
  happinessBonus?: number; // Optional happiness bonus from cleaning
  preventionDuration?: number; // Hours of reduced poop spawn rate
  scentType?: 'floral' | 'fresh' | 'citrus' | 'herbal' | 'neutral';
}

/**
 * Energy booster item
 */
export interface EnergyBoosterItem extends Item {
  category: 'ENERGY_BOOSTER';
  energyRestore: number; // Amount of energy to restore
  instantRestore: boolean; // Instant or gradual restoration
  cooldownMinutes?: number; // Cooldown before next use
  sideEffect?: {
    type: EnergySideEffectType;
    delay: number; // Minutes before side effect
    duration: number; // Duration of side effect
  };
}

/**
 * Tool item for activities
 */
export interface ToolItem extends Item {
  category: 'TOOL';
  toolType: ToolType;
  tier: ToolTier;
  durability: number; // Total uses before breaking
  currentDurability: number; // Remaining uses

  // Activity modifiers
  efficiencyBonus: number; // Percentage bonus to activity rewards
  speedBonus: number; // Percentage reduction in activity time
  rareFindBonus: number; // Percentage bonus to rare item finds

  // Tool-specific bonuses
  bonuses?: {
    [activityType: string]: number; // Activity-specific bonuses
  };

  // Repair requirements
  repairCost?: number;
  repairMaterials?: {
    itemId: string;
    quantity: number;
  }[];
}

/**
 * Material item for crafting/trading
 */
export interface MaterialItem extends Item {
  category: 'MATERIAL';
  materialType: MaterialType;
  quality: QualityLevel;

  // Used in crafting recipes
  craftingIngredient: boolean;

  // Can be refined into other materials
  refinable?: {
    outputItemId: string;
    outputQuantity: number;
    requiredQuantity: number;
    requiresTool?: string; // Tool ID required for refining
  };
}

/**
 * Egg item that can be incubated
 */
export interface EggItem extends Item {
  category: 'EGG';
  eggType: string; // References EggType definition
  obtainedFrom: ItemObtainSource;

  // Incubation data (if started)
  incubationStarted?: boolean;
  incubationStartTime?: number;
  incubationDuration: number; // Hours required

  // Pre-determined species (optional, for special eggs)
  guaranteedSpecies?: string;
  guaranteedRarity?: RarityTier;
}

/**
 * Currency item (special category)
 */
export interface CurrencyItem extends Item {
  category: 'CURRENCY';
  currencyType: ExtendedCurrencyType;
  exchangeRate?: {
    toCurrency: string;
    rate: number;
  }[];
}

/**
 * Item instance in inventory
 */
export interface InventoryItem {
  itemId: string; // References Item definition
  quantity: number;
  obtainedTime: number;

  // For items with durability
  currentDurability?: number;

  // For items with special properties
  enchantments?: {
    type: string;
    value: number;
  }[];

  // Binding (can't be sold/traded)
  soulbound?: boolean;

  // Item-specific data
  customData?: Record<string, any>;
}

/**
 * Item drop table for activities and battles
 */
export interface ItemDropTable {
  id: string;
  name: string;

  // Guaranteed drops
  guaranteedDrops?: {
    itemId: string;
    quantity: number;
  }[];

  // Chance-based drops
  possibleDrops: {
    itemId: string;
    minQuantity: number;
    maxQuantity: number;
    dropChance: number; // Percentage
    requiresToolTier?: ToolTier;
  }[];

  // Rare drops with special conditions
  rareDrops?: {
    itemId: string;
    quantity: number;
    baseChance: number; // Base percentage
    luckModifier?: number; // Bonus from luck stats
    requiresPerfectExecution?: boolean;
  }[];

  // Currency rewards
  currencyRewards?: {
    min: number;
    max: number;
  };
}

/**
 * Shop inventory item
 */
export interface ShopItem {
  itemId: string;
  quantity: number; // -1 for unlimited
  price: number;
  discount?: number; // Percentage discount
  requiresUnlock?: string; // Condition to unlock
  limitPerDay?: number; // Purchase limit
  eventExclusive?: string; // Event ID if exclusive
}

/**
 * Item effect application result
 */
export interface ItemEffectResult {
  success: boolean;
  message: string;

  // Changes applied
  changes?: {
    satiety?: number;
    hydration?: number;
    happiness?: number;
    energy?: number;
    health?: number;
    curedStatus?: string[];
  };

  // Side effects triggered
  sideEffects?: {
    type: string;
    description: string;
    duration?: number;
  }[];
}
