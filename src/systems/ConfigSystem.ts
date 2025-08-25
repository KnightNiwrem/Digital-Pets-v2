/**
 * ConfigSystem - Centralized configuration and tuning value management
 *
 * This system is responsible for:
 * - Loading game configuration from static sources
 * - Providing tuning values for all systems
 * - Managing feature flags
 * - Handling configuration versioning
 * - Caching frequently accessed values
 */

import gameConfig from '../config/gameConfig.json';
import { BaseSystem, type SystemInitOptions, type SystemError } from './BaseSystem';
import type { GameState } from '../models';
import type { GameUpdateWriter } from '../engine/GameUpdatesQueue';

// Configuration type definitions
export interface CareDecayConfig {
  satietyPerHour: number;
  hydrationPerHour: number;
  happinessPerHour: number;
}

export interface CareTickMultipliers {
  satiety: number;
  hydration: number;
  happiness: number;
}

export interface EnergyConfig {
  maxByStage: Record<string, number>;
  sleepRegenRatePerHour: Record<string, number>;
  boosterRestoreAmount: number;
  boosterCooldownMinutes: number;
}

export interface ActivityConfig {
  duration: number; // in minutes
  energyCost: number;
  minRewards: number;
  maxRewards: number;
  requiredStage?: string;
  requiredTool?: string;
}

export interface ActivityDurationConfig {
  short?: ActivityConfig;
  medium?: ActivityConfig;
  long?: ActivityConfig;
}

export interface TravelConfig {
  instant: { duration: number; energyCost: number };
  short: { duration: number; energyCost: number };
  medium: { duration: number; energyCost: number };
  long: { duration: number; energyCost: number };
}

export interface BattleConfig {
  maxMoves: number;
  baseAccuracy: number;
  criticalHitChance: number;
  criticalHitMultiplier: number;
  fleeBaseChance: number;
  actionRestoreOnSkip: number;
  damageFormula: {
    base: number;
    attackMultiplier: number;
    defenseMultiplier: number;
  };
}

export interface ShopConfig {
  dailyRotationSeed: boolean;
  itemCountByRarity: Record<string, number>;
  priceMultiplierByRarity: Record<string, number>;
  eventDiscountPercent: number;
  sellValuePercent: number;
}

export interface ItemEffectsConfig {
  stackLimits: {
    default: number;
    materials: number;
    currency: number;
    nonStackable: number;
  };
  foodEffects: Record<string, number>;
  drinkEffects: Record<string, number>;
  toyEffects: Record<string, number>;
  medicineEffectiveness: number;
  bandageEffectiveness: number;
}

export interface TuningConfig {
  careDecay: CareDecayConfig;
  careTickMultipliers: CareTickMultipliers;
  careValueRange: { min: number; max: number };
  energy: EnergyConfig;
  growth: {
    stageDurations: Record<string, number>;
    stageAdvancementBonuses: {
      health: number;
      attack: number;
      defense: number;
      speed: number;
      action: number;
    };
  };
  poop: {
    spawnRangeHours: { min: number; max: number };
    sicknessThreshold: number;
    happinessDecayPerPoop: number;
  };
  sickness: {
    baseChancePerHour: number;
    poopMultiplier: number;
    activityRiskChance: number;
    lifeDecayPerHour: number;
    energyRegenPenalty: number;
  };
  injury: {
    battleLossChance: number;
    heavyHitChance: number;
    activityMishapChance: number;
    travelSpeedPenalty: number;
    happinessDecayPerHour: number;
    recoveryRatePerHour: number;
  };
  sleep: {
    maxDurationHours: number;
    forceWakePenalty: number;
    happinessPenaltyForceWake: number;
  };
  life: {
    startingValue: number;
    criticalThreshold: number;
    deathThreshold: number;
    recoveryRatePerHour: number;
    decayWhenNeglected: number;
  };
  battle: BattleConfig;
  training: {
    durationMinutes: number;
    energyCost: number;
    statIncreasePerSession: number;
    moveLearnChance: number;
    actionStatIncrease: number;
  };
  activities: Record<string, ActivityDurationConfig>;
  travel: TravelConfig;
  shop: ShopConfig;
  eggs: {
    incubationHours: Record<string, number>;
    rarityWeights: Record<string, number>;
  };
  items: ItemEffectsConfig;
  events: {
    tokenToCoinsRate: number;
    participationRewardChance: number;
    completionBonusMultiplier: number;
    gracefulClosurePartialRewardPercent: number;
  };
}

export interface FeatureFlags {
  enableBattles: boolean;
  enableEvents: boolean;
  enableTrading: boolean;
  enableMultiplePets: boolean;
  enableAchievements: boolean;
  enableDailyQuests: boolean;
  enablePvP: boolean;
  debugMode: boolean;
  showAdvancedStats: boolean;
  allowCheatCodes: boolean;
}

export interface GameLimits {
  maxInventorySlots: number;
  maxPetNameLength: number;
  maxSaveFileSize: number;
  maxOfflineHours: number;
  maxBattleTurns: number;
  maxEventTokens: number;
  maxQuestObjectives: number;
}

export interface DefaultSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  textSize: string;
  colorBlindMode: string;
  highContrast: boolean;
  reducedMotion: boolean;
  showParticles: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
  confirmActions: boolean;
  showTutorialHints: boolean;
  enableNotifications: boolean;
  lowCareWarning: boolean;
  activityComplete: boolean;
  eventReminders: boolean;
  touchControls: boolean;
  keyboardShortcuts: boolean;
  swipeGestures: boolean;
}

export interface GameConfig {
  version: string;
  gameTitle: string;
  tickInterval: number;
  saveSettings: {
    maxSaves: number;
    autoSaveInterval: number;
    storageKey: string;
    backupKeyPrefix: string;
  };
  tuning: TuningConfig;
  featureFlags: FeatureFlags;
  limits: GameLimits;
  defaultSettings: DefaultSettings;
}

/**
 * Configuration validation error
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly key: string,
  ) {
    super(`Configuration validation failed for '${key}': ${message}`);
    this.name = 'ConfigValidationError';
  }
}

/**
 * ConfigSystem class - manages all game configuration
 */
export class ConfigSystem extends BaseSystem {
  private config: GameConfig;
  private cache: Map<string, any> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute cache TTL
  private cacheTimestamps: Map<string, number> = new Map();

  constructor(gameUpdateWriter?: GameUpdateWriter) {
    super('ConfigSystem', gameUpdateWriter);
    this.config = this.loadConfig();
    this.validateConfig();
  }

  /**
   * System initialization
   */
  protected async onInitialize(_options: SystemInitOptions): Promise<void> {
    // Config is loaded in the constructor; nothing additional to do here
  }

  /**
   * System shutdown
   */
  protected async onShutdown(): Promise<void> {
    this.clearCache();
  }

  /**
   * System reset
   */
  protected async onReset(): Promise<void> {
    this.reload();
  }

  /**
   * System tick
   */
  protected async onTick(_deltaTime: number, _gameState: GameState): Promise<void> {
    // No periodic processing required for configuration
  }

  /**
   * System update
   */
  protected async onUpdate(_gameState: GameState, _prevState?: GameState): Promise<void> {
    // ConfigSystem does not react to state updates
  }

  /**
   * Handle system errors
   */
  protected onError(error: SystemError): void {
    console.error(`[ConfigSystem] Error:`, error);
  }

  /**
   * Load configuration from static sources
   */
  private loadConfig(): GameConfig {
    try {
      // In a real implementation, this might load from multiple sources
      // and merge them together
      return gameConfig as GameConfig;
    } catch (error) {
      console.error('Failed to load game configuration:', error);
      throw new Error('Failed to initialize ConfigSystem: configuration could not be loaded');
    }
  }

  /**
   * Validate configuration values
   */
  private validateConfig(): void {
    // Validate version
    if (!this.config.version || typeof this.config.version !== 'string') {
      throw new ConfigValidationError('Invalid or missing version', 'version');
    }

    // Validate tick interval
    if (this.config.tickInterval < 1 || this.config.tickInterval > 3600) {
      throw new ConfigValidationError(
        'Tick interval must be between 1 and 3600 seconds',
        'tickInterval',
      );
    }

    // Validate care decay rates
    const careDecay = this.config.tuning.careDecay;
    if (careDecay.satietyPerHour < 0 || careDecay.satietyPerHour > 100) {
      throw new ConfigValidationError(
        'Satiety decay rate must be between 0 and 100',
        'tuning.careDecay.satietyPerHour',
      );
    }
    if (careDecay.hydrationPerHour < 0 || careDecay.hydrationPerHour > 100) {
      throw new ConfigValidationError(
        'Hydration decay rate must be between 0 and 100',
        'tuning.careDecay.hydrationPerHour',
      );
    }
    if (careDecay.happinessPerHour < 0 || careDecay.happinessPerHour > 100) {
      throw new ConfigValidationError(
        'Happiness decay rate must be between 0 and 100',
        'tuning.careDecay.happinessPerHour',
      );
    }

    // Validate tick multipliers
    const tickMultipliers = this.config.tuning.careTickMultipliers;
    Object.entries(tickMultipliers).forEach(([key, value]) => {
      if (value < 1 || value > 1000) {
        throw new ConfigValidationError(
          `Tick multiplier for ${key} must be between 1 and 1000`,
          `tuning.careTickMultipliers.${key}`,
        );
      }
    });

    // Validate energy values
    const energy = this.config.tuning.energy;
    Object.entries(energy.maxByStage).forEach(([stage, value]) => {
      if (value < 1 || value > 1000) {
        throw new ConfigValidationError(
          `Max energy for ${stage} must be between 1 and 1000`,
          `tuning.energy.maxByStage.${stage}`,
        );
      }
    });

    // Validate battle configuration
    const battle = this.config.tuning.battle;
    if (battle.maxMoves < 1 || battle.maxMoves > 10) {
      throw new ConfigValidationError(
        'Max moves must be between 1 and 10',
        'tuning.battle.maxMoves',
      );
    }
    if (battle.criticalHitChance < 0 || battle.criticalHitChance > 100) {
      throw new ConfigValidationError(
        'Critical hit chance must be between 0 and 100',
        'tuning.battle.criticalHitChance',
      );
    }

    // Validate rarity weights sum to 100
    const rarityWeights = this.config.tuning.eggs.rarityWeights;
    const totalWeight = Object.values(rarityWeights).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new ConfigValidationError(
        `Rarity weights must sum to 100, got ${totalWeight}`,
        'tuning.eggs.rarityWeights',
      );
    }

    // Validate limits
    const limits = this.config.limits;
    if (limits.maxInventorySlots < 10 || limits.maxInventorySlots > 1000) {
      throw new ConfigValidationError(
        'Max inventory slots must be between 10 and 1000',
        'limits.maxInventorySlots',
      );
    }
    if (limits.maxOfflineHours < 1 || limits.maxOfflineHours > 8760) {
      throw new ConfigValidationError(
        'Max offline hours must be between 1 and 8760 (1 year)',
        'limits.maxOfflineHours',
      );
    }

    console.log('Configuration validation passed');
  }

  /**
   * Get the full configuration object
   */
  load(): GameConfig {
    return this.config;
  }

  /**
   * Get a configuration value by key path
   * @param key Dot-notation path to config value (e.g., "tuning.careDecay.satietyPerHour")
   */
  get(key: string): any {
    // Handle empty string - return the root config
    if (key === '') {
      return this.config;
    }

    // Check cache first
    if (this.cache.has(key)) {
      const timestamp = this.cacheTimestamps.get(key);
      if (timestamp && Date.now() - timestamp < this.CACHE_TTL) {
        return this.cache.get(key);
      }
    }

    // Parse the key path and traverse the config object
    const keys = key.split('.');
    let value: any = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Configuration key not found: ${key}`);
        return undefined;
      }
    }

    // Cache the result
    this.cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());

    return value;
  }

  /**
   * Get all tuning values
   */
  getTuningValues(): TuningConfig {
    return this.config.tuning;
  }

  /**
   * Get all feature flags
   */
  getFeatureFlags(): FeatureFlags {
    return this.config.featureFlags;
  }

  /**
   * Get care decay rates
   */
  getCareDecayRates(): CareDecayConfig {
    return this.config.tuning.careDecay;
  }

  /**
   * Get activity rewards configuration for a specific activity type
   */
  getActivityConfig(
    activityType: string,
    duration: 'short' | 'medium' | 'long',
  ): ActivityConfig | undefined {
    const activityConfig = this.config.tuning.activities[activityType.toLowerCase()];
    if (!activityConfig) {
      console.warn(`Activity configuration not found for: ${activityType}`);
      return undefined;
    }
    return activityConfig[duration];
  }

  /**
   * Get battle formulas and configuration
   */
  getBattleFormulas(): BattleConfig {
    return this.config.tuning.battle;
  }

  /**
   * Get shop configuration
   */
  getShopConfig(): ShopConfig {
    return this.config.tuning.shop;
  }

  /**
   * Get item effects configuration
   */
  getItemEffects(): ItemEffectsConfig {
    return this.config.tuning.items;
  }

  /**
   * Get travel configuration for a specific distance tier
   */
  getTravelConfig(tier: 'instant' | 'short' | 'medium' | 'long') {
    return this.config.tuning.travel[tier];
  }

  /**
   * Get egg incubation time for a rarity tier
   */
  getIncubationTime(rarity: string): number {
    return this.config.tuning.eggs.incubationHours[rarity] || 24;
  }

  /**
   * Get max energy for a growth stage
   */
  getMaxEnergy(stage: string): number {
    return this.config.tuning.energy.maxByStage[stage] || 50;
  }

  /**
   * Get sleep regeneration rate for a growth stage
   */
  getSleepRegenRate(stage: string): number {
    return this.config.tuning.energy.sleepRegenRatePerHour[stage] || 10;
  }

  /**
   * Get game limits
   */
  getLimits(): GameLimits {
    return this.config.limits;
  }

  /**
   * Get default settings for new players
   */
  getDefaultSettings(): DefaultSettings {
    return this.config.defaultSettings;
  }

  /**
   * Get save settings
   */
  getSaveSettings() {
    return this.config.saveSettings;
  }

  /**
   * Get tick interval in seconds
   */
  getTickInterval(): number {
    return this.config.tickInterval;
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: keyof FeatureFlags): boolean {
    return this.config.featureFlags[feature] || false;
  }

  /**
   * Get configuration version
   */
  getVersion(): string {
    return this.config.version;
  }

  /**
   * Clear the configuration cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Reload configuration (useful for development/testing)
   */
  reload(): void {
    this.clearCache();
    this.config = this.loadConfig();
    this.validateConfig();
  }

  /**
   * Get a safe copy of the configuration (deep clone)
   */
  getConfigCopy(): GameConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Override a configuration value (for testing purposes only)
   * @param key Dot-notation path to config value
   * @param value New value to set
   */
  override(key: string, value: any): void {
    if (!this.isFeatureEnabled('debugMode')) {
      console.warn('Configuration override is only available in debug mode');
      return;
    }

    const keys = key.split('.');
    let target: any = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (k && (!target[k] || typeof target[k] !== 'object')) {
        target[k] = {};
      }
      if (k) {
        target = target[k];
      }
    }

    const lastKey = keys[keys.length - 1];
    if (lastKey) {
      target[lastKey] = value;
    }

    // Clear cache for this key and any parent keys
    for (let i = 0; i <= keys.length; i++) {
      const partialKey = keys.slice(0, i).join('.');
      this.cache.delete(partialKey);
      this.cacheTimestamps.delete(partialKey);
    }
  }
}

// Export singleton instance
let configSystemInstance: ConfigSystem | null = null;

export function getConfigSystem(gameUpdateWriter?: GameUpdateWriter): ConfigSystem {
  if (!configSystemInstance) {
    configSystemInstance = new ConfigSystem(gameUpdateWriter);
  }
  return configSystemInstance;
}

export default ConfigSystem;
