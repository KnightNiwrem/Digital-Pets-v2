/**
 * Tests for ConfigSystem
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ConfigSystem } from './ConfigSystem';

describe('ConfigSystem', () => {
  let configSystem: ConfigSystem;

  beforeEach(() => {
    // Create a fresh instance for each test
    configSystem = new ConfigSystem();
  });

  afterEach(() => {
    // Clear any cached values
    configSystem.clearCache();
  });

  describe('initialization', () => {
    it('should load configuration successfully', () => {
      const config = configSystem.load();
      expect(config.version).toBe('1.0.0');
      expect(config.gameTitle).toBe('Digital Pet Game');
    });

    it('should validate configuration on initialization', () => {
      // The constructor validates automatically, so if it doesn't throw, validation passed
      expect(() => new ConfigSystem()).not.toThrow();
    });

    it('should have correct tick interval', () => {
      expect(configSystem.getTickInterval()).toBe(60);
    });
  });

  describe('get() method', () => {
    it('should retrieve top-level values', () => {
      expect(configSystem.get('version')).toBe('1.0.0');
      expect(configSystem.get('gameTitle')).toBe('Digital Pet Game');
      expect(configSystem.get('tickInterval')).toBe(60);
    });

    it('should retrieve nested values using dot notation', () => {
      expect(configSystem.get('tuning.careDecay.satietyPerHour')).toBe(3);
      expect(configSystem.get('tuning.careDecay.hydrationPerHour')).toBe(4);
      expect(configSystem.get('tuning.careDecay.happinessPerHour')).toBe(2);
    });

    it('should retrieve deeply nested values', () => {
      expect(configSystem.get('tuning.energy.maxByStage.HATCHLING')).toBe(50);
      expect(configSystem.get('tuning.battle.damageFormula.attackMultiplier')).toBe(1.5);
    });

    it('should return undefined for non-existent keys', () => {
      expect(configSystem.get('nonexistent.key')).toBeUndefined();
      expect(configSystem.get('tuning.invalid.path')).toBeUndefined();
    });

    it('should cache frequently accessed values', () => {
      // First access - not cached
      const value1 = configSystem.get('tuning.careDecay.satietyPerHour');
      // Second access - should be from cache
      const value2 = configSystem.get('tuning.careDecay.satietyPerHour');

      expect(value1).toBe(value2);
      expect(value1).toBe(3);
    });
  });

  describe('getTuningValues()', () => {
    it('should return all tuning values', () => {
      const tuning = configSystem.getTuningValues();

      expect(tuning.careDecay.satietyPerHour).toBe(3);
      expect(tuning.careDecay.hydrationPerHour).toBe(4);
      expect(tuning.careDecay.happinessPerHour).toBe(2);
    });

    it('should have correct care decay values', () => {
      const tuning = configSystem.getTuningValues();

      expect(tuning.careDecay.satietyPerHour).toBe(3);
      expect(tuning.careDecay.hydrationPerHour).toBe(4);
      expect(tuning.careDecay.happinessPerHour).toBe(2);
    });

    it('should have correct care tick multipliers', () => {
      const tuning = configSystem.getTuningValues();

      expect(tuning.careTickMultipliers.satiety).toBe(20);
      expect(tuning.careTickMultipliers.hydration).toBe(15);
      expect(tuning.careTickMultipliers.happiness).toBe(30);
    });
  });

  describe('getFeatureFlags()', () => {
    it('should return feature flags', () => {
      const flags = configSystem.getFeatureFlags();

      expect(flags.enableBattles).toBe(true);
      expect(flags.enableEvents).toBe(true);
      expect(flags.debugMode).toBe(false);
    });
  });

  describe('isFeatureEnabled()', () => {
    it('should return correct feature flag status', () => {
      expect(configSystem.isFeatureEnabled('enableBattles')).toBe(true);
      expect(configSystem.isFeatureEnabled('enableEvents')).toBe(true);
      expect(configSystem.isFeatureEnabled('debugMode')).toBe(false);
    });
  });

  describe('getCareDecayRates()', () => {
    it('should return care decay configuration', () => {
      const careDecay = configSystem.getCareDecayRates();

      expect(careDecay.satietyPerHour).toBe(3);
      expect(careDecay.hydrationPerHour).toBe(4);
      expect(careDecay.happinessPerHour).toBe(2);
    });
  });

  describe('getActivityConfig()', () => {
    it('should return activity configuration for valid activity and duration', () => {
      const fishingShort = configSystem.getActivityConfig('fishing', 'short');
      expect(fishingShort?.duration).toBe(2);
      expect(fishingShort?.energyCost).toBe(5);
      expect(fishingShort?.minRewards).toBe(1);
      expect(fishingShort?.maxRewards).toBe(2);
    });

    it('should return activity configuration for mining with requirements', () => {
      const miningMedium = configSystem.getActivityConfig('mining', 'medium');
      expect(miningMedium?.duration).toBe(5);
      expect(miningMedium?.energyCost).toBe(15);
      expect(miningMedium?.requiredStage).toBe('JUVENILE');
      expect(miningMedium?.requiredTool).toBe('PICKAXE');
    });

    it('should return undefined for invalid activity type', () => {
      const invalid = configSystem.getActivityConfig('invalid', 'short');
      expect(invalid).toBeUndefined();
    });

    it('should return undefined for invalid duration', () => {
      const fishing = configSystem.getActivityConfig('fishing', 'invalid' as any);
      expect(fishing).toBeUndefined();
    });
  });

  describe('getBattleFormulas()', () => {
    it('should return battle configuration', () => {
      const battle = configSystem.getBattleFormulas();

      expect(battle.maxMoves).toBe(4);
      expect(battle.baseAccuracy).toBe(100);
      expect(battle.criticalHitChance).toBe(10);
      expect(battle.criticalHitMultiplier).toBe(1.5);
      expect(battle.fleeBaseChance).toBe(50);
      expect(battle.actionRestoreOnSkip).toBe(10);
    });

    it('should have damage formula configuration', () => {
      const battle = configSystem.getBattleFormulas();

      expect(battle.damageFormula.base).toBe(10);
      expect(battle.damageFormula.attackMultiplier).toBe(1.5);
      expect(battle.damageFormula.defenseMultiplier).toBe(0.8);
    });
  });

  describe('getShopConfig()', () => {
    it('should return shop configuration', () => {
      const shop = configSystem.getShopConfig();

      expect(shop.dailyRotationSeed).toBe(true);
      expect(shop.eventDiscountPercent).toBe(20);
      expect(shop.sellValuePercent).toBe(50);
    });

    it('should have rarity-based configurations', () => {
      const shop = configSystem.getShopConfig();

      expect(shop.itemCountByRarity.COMMON).toBe(5);
      expect(shop.itemCountByRarity.RARE).toBe(2);
      expect(shop.priceMultiplierByRarity.COMMON).toBe(1);
      expect(shop.priceMultiplierByRarity.LEGENDARY).toBe(25);
    });
  });

  describe('getItemEffects()', () => {
    it('should return item effects configuration', () => {
      const items = configSystem.getItemEffects();

      expect(items.stackLimits.default).toBe(99);
      expect(items.stackLimits.materials).toBe(999);
      expect(items.stackLimits.currency).toBe(999999);
      expect(items.stackLimits.nonStackable).toBe(1);
    });

    it('should have effect values for consumables', () => {
      const items = configSystem.getItemEffects();

      expect(items.foodEffects.SMALL).toBe(20);
      expect(items.foodEffects.MEDIUM).toBe(40);
      expect(items.foodEffects.LARGE).toBe(60);

      expect(items.drinkEffects.SMALL).toBe(20);
      expect(items.drinkEffects.MEDIUM).toBe(40);
      expect(items.drinkEffects.LARGE).toBe(60);

      expect(items.toyEffects.SMALL).toBe(15);
      expect(items.toyEffects.MEDIUM).toBe(30);
      expect(items.toyEffects.LARGE).toBe(50);
    });

    it('should have medicine and bandage effectiveness', () => {
      const items = configSystem.getItemEffects();

      expect(items.medicineEffectiveness).toBe(80);
      expect(items.bandageEffectiveness).toBe(90);
    });
  });

  describe('getTravelConfig()', () => {
    it('should return travel configuration for instant tier', () => {
      const instant = configSystem.getTravelConfig('instant');
      expect(instant.duration).toBe(0);
      expect(instant.energyCost).toBe(0);
    });

    it('should return travel configuration for short tier', () => {
      const short = configSystem.getTravelConfig('short');
      expect(short.duration).toBe(3);
      expect(short.energyCost).toBe(10);
    });

    it('should return travel configuration for long tier', () => {
      const long = configSystem.getTravelConfig('long');
      expect(long.duration).toBe(10);
      expect(long.energyCost).toBe(35);
    });
  });

  describe('getIncubationTime()', () => {
    it('should return incubation time for valid rarity', () => {
      expect(configSystem.getIncubationTime('COMMON')).toBe(12);
      expect(configSystem.getIncubationTime('RARE')).toBe(24);
      expect(configSystem.getIncubationTime('LEGENDARY')).toBe(48);
    });

    it('should return default incubation time for invalid rarity', () => {
      expect(configSystem.getIncubationTime('INVALID')).toBe(24);
    });
  });

  describe('getMaxEnergy()', () => {
    it('should return max energy for valid stage', () => {
      expect(configSystem.getMaxEnergy('HATCHLING')).toBe(50);
      expect(configSystem.getMaxEnergy('JUVENILE')).toBe(80);
      expect(configSystem.getMaxEnergy('ADULT')).toBe(120);
    });

    it('should return default max energy for invalid stage', () => {
      expect(configSystem.getMaxEnergy('INVALID')).toBe(50);
    });
  });

  describe('getSleepRegenRate()', () => {
    it('should return sleep regen rate for valid stage', () => {
      expect(configSystem.getSleepRegenRate('HATCHLING')).toBe(12);
      expect(configSystem.getSleepRegenRate('JUVENILE')).toBe(16);
      expect(configSystem.getSleepRegenRate('ADULT')).toBe(20);
    });

    it('should return default regen rate for invalid stage', () => {
      expect(configSystem.getSleepRegenRate('INVALID')).toBe(10);
    });
  });

  describe('getLimits()', () => {
    it('should return game limits', () => {
      const limits = configSystem.getLimits();

      expect(limits.maxInventorySlots).toBe(100);
      expect(limits.maxPetNameLength).toBe(20);
      expect(limits.maxSaveFileSize).toBe(5242880);
      expect(limits.maxOfflineHours).toBe(720);
      expect(limits.maxBattleTurns).toBe(100);
      expect(limits.maxEventTokens).toBe(9999);
      expect(limits.maxQuestObjectives).toBe(10);
    });
  });

  describe('getDefaultSettings()', () => {
    it('should return default settings', () => {
      const settings = configSystem.getDefaultSettings();

      expect(settings.masterVolume).toBe(70);
      expect(settings.musicVolume).toBe(60);
      expect(settings.sfxVolume).toBe(80);
      expect(settings.textSize).toBe('medium');
      expect(settings.colorBlindMode).toBe('off');
      expect(settings.autoSave).toBe(true);
      expect(settings.autoSaveInterval).toBe(5);
    });
  });

  describe('getSaveSettings()', () => {
    it('should return save settings', () => {
      const saveSettings = configSystem.getSaveSettings();

      expect(saveSettings.maxSaves).toBe(3);
      expect(saveSettings.autoSaveInterval).toBe(60);
      expect(saveSettings.storageKey).toBe('digital_pet_save');
      expect(saveSettings.backupKeyPrefix).toBe('digital_pet_backup_');
    });
  });

  describe('getVersion()', () => {
    it('should return configuration version', () => {
      expect(configSystem.getVersion()).toBe('1.0.0');
    });
  });

  describe('cache management', () => {
    it('should clear cache when clearCache() is called', () => {
      // Access a value to populate cache
      const value1 = configSystem.get('tuning.careDecay.satietyPerHour');
      expect(value1).toBe(3);

      // Clear cache
      configSystem.clearCache();

      // Value should still be accessible after cache clear
      const value2 = configSystem.get('tuning.careDecay.satietyPerHour');
      expect(value2).toBe(3);
    });
  });

  describe('reload()', () => {
    it('should reload configuration', () => {
      // Get initial value
      const value1 = configSystem.get('version');

      // Reload
      configSystem.reload();

      // Value should still be the same after reload
      const value2 = configSystem.get('version');
      expect(value1).toBe(value2);
    });
  });

  describe('getConfigCopy()', () => {
    it('should return a deep copy of configuration', () => {
      const copy = configSystem.getConfigCopy();
      const original = configSystem.load();

      // Should be equal in value
      expect(copy).toEqual(original);

      // But not the same reference
      expect(copy).not.toBe(original);

      // Modifying copy should not affect original
      copy.version = 'modified';
      expect(configSystem.getVersion()).toBe('1.0.0');
    });
  });

  describe('egg configuration', () => {
    it('should have valid rarity weights that sum to 100', () => {
      const tuning = configSystem.getTuningValues();
      const weights = tuning.eggs.rarityWeights;

      const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
      expect(totalWeight).toBe(100);
    });

    it('should have incubation times for all rarities', () => {
      const tuning = configSystem.getTuningValues();
      const incubation = tuning.eggs.incubationHours;

      expect(incubation.COMMON).toBeGreaterThan(0);
      expect(incubation.UNCOMMON).toBeGreaterThan(0);
      expect(incubation.RARE).toBeGreaterThan(0);
      expect(incubation.EPIC).toBeGreaterThan(0);
      expect(incubation.LEGENDARY).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string key in get()', () => {
      const result = configSystem.get('');
      // Should return the root config object
      expect(result.version).toBe('1.0.0');
    });

    it('should handle single-level key in get()', () => {
      const result = configSystem.get('tuning');
      expect(result).not.toBeUndefined();
    });

    it('should handle very deep nesting in get()', () => {
      const result = configSystem.get('tuning.activities.fishing.short.duration');
      expect(result).toBe(2);
    });
  });

  describe('training configuration', () => {
    it('should have training configuration', () => {
      const training = configSystem.get('tuning.training');

      expect(training.durationMinutes).toBe(8);
      expect(training.energyCost).toBe(20);
      expect(training.statIncreasePerSession).toBe(2);
      expect(training.moveLearnChance).toBe(20);
      expect(training.actionStatIncrease).toBe(1);
    });
  });

  describe('event configuration', () => {
    it('should have event configuration', () => {
      const events = configSystem.get('tuning.events');

      expect(events.tokenToCoinsRate).toBe(10);
      expect(events.participationRewardChance).toBe(100);
      expect(events.completionBonusMultiplier).toBe(2);
      expect(events.gracefulClosurePartialRewardPercent).toBe(50);
    });
  });

  describe('poop configuration', () => {
    it('should have poop spawn configuration', () => {
      const poop = configSystem.get('tuning.poop');

      expect(poop.spawnRangeHours.min).toBe(6);
      expect(poop.spawnRangeHours.max).toBe(24);
      expect(poop.sicknessThreshold).toBe(5);
      expect(poop.happinessDecayPerPoop).toBe(2);
    });
  });

  describe('sickness and injury configuration', () => {
    it('should have sickness configuration', () => {
      const sickness = configSystem.get('tuning.sickness');

      expect(sickness.baseChancePerHour).toBe(0.5);
      expect(sickness.poopMultiplier).toBe(2);
      expect(sickness.activityRiskChance).toBe(5);
      expect(sickness.lifeDecayPerHour).toBe(2);
      expect(sickness.energyRegenPenalty).toBe(0.5);
      expect(sickness.activitySuccessPenalty).toBe(0.8);
    });

    it('should have injury configuration', () => {
      const injury = configSystem.get('tuning.injury');

      expect(injury.battleLossChance).toBe(30);
      expect(injury.heavyHitChance).toBe(10);
      expect(injury.activityMishapChance).toBe(2);
      expect(injury.travelSpeedPenalty).toBe(0.5);
      expect(injury.happinessDecayPerHour).toBe(1);
    });
  });

  describe('life configuration', () => {
    it('should have life/wellness configuration', () => {
      const life = configSystem.get('tuning.life');

      expect(life.startingValue).toBe(100);
      expect(life.criticalThreshold).toBe(20);
      expect(life.deathThreshold).toBe(0);
      expect(life.recoveryRatePerHour).toBe(1);
      expect(life.decayWhenNeglected).toBe(3);
    });
  });
});
