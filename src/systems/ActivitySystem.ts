/**
 * ActivitySystem - Manages all pet activities (fishing, foraging, mining, training)
 * Handles activity mechanics, rewards, tool requirements, and completions
 */

import { BaseSystem, type SystemInitOptions, type SystemError } from './BaseSystem';
import type { GameState, Pet, Item } from '../models';
import {
  UPDATE_TYPES,
  ACTIVITY_TYPES,
  ACTIVITY_DURATIONS,
  GROWTH_STAGES,
  TOOL_TYPES,
  STATUS_TYPES,
  ITEM_CATEGORIES,
  RARITY_TIERS,
  type ActivityType,
  type GrowthStage,
  type RarityTier,
  type ItemCategory,
  type StatType,
} from '../models/constants';

/**
 * Activity configuration from tuning
 */
export interface ActivityConfig {
  duration: number; // in minutes
  energyCost: number;
  minRewards: number;
  maxRewards: number;
  requiredStage?: GrowthStage;
  requiredTool?: string;
}

/**
 * Activity reward definition
 */
export interface ActivityReward {
  itemId: string;
  category: ItemCategory;
  quantity: number;
  rarity: RarityTier;
}

/**
 * Active activity tracking
 */
export interface ActiveActivity {
  id: string;
  type: ActivityType;
  startTime: number;
  duration: number; // in milliseconds
  energyCost: number;
  location: string;
  petId?: string;
  timerId?: string;
  paused: boolean;
  pausedAt?: number;
  remainingTime?: number;
  rewards?: ActivityReward[]; // Pre-rolled rewards
}

/**
 * Activity outcome result
 */
export interface ActivityOutcome {
  success: boolean;
  rewards: ActivityReward[];
  experience?: number;
  encounterTriggered?: boolean;
  injuryRisk?: boolean;
  sicknessRisk?: boolean;
  message?: string;
}

/**
 * Training activity specific data
 */
export interface TrainingActivity extends ActiveActivity {
  targetStat: StatType;
  statIncrease: number;
  moveLearnChance: number;
  possibleMove?: string;
}

/**
 * ActivitySystem implementation
 */
export class ActivitySystem extends BaseSystem {
  private activeActivities: Map<string, ActiveActivity>;
  private activityCounter: number;
  private readonly concurrentRestrictions: Set<ActivityType>;

  constructor() {
    super('ActivitySystem');
    this.activeActivities = new Map();
    this.activityCounter = 0;

    // Activities that cannot run concurrently with anything
    this.concurrentRestrictions = new Set([
      ACTIVITY_TYPES.TRAINING,
      ACTIVITY_TYPES.SLEEPING,
      ACTIVITY_TYPES.ARENA_PRACTICE,
    ]);
  }

  /**
   * Initialize the ActivitySystem
   */
  protected async onInitialize(_options: SystemInitOptions): Promise<void> {
    console.log('[ActivitySystem] Initialized');
  }

  /**
   * Start an activity
   */
  public async startActivity(
    type: ActivityType,
    duration: 'short' | 'medium' | 'long' | 'training',
    gameState: GameState,
    location: string,
    targetStat?: StatType,
  ): Promise<{ success: boolean; activityId?: string; error?: string }> {
    // Validate pet exists and is available
    if (!gameState.pet || gameState.pet.status.primary === STATUS_TYPES.DEAD) {
      return { success: false, error: 'No active pet available' };
    }

    // Check for concurrent restrictions
    const concurrentCheck = this.checkConcurrentRestrictions(type, gameState.pet);
    if (!concurrentCheck.allowed) {
      return { success: false, error: concurrentCheck.reason };
    }

    // Get activity configuration
    const config = this.getActivityConfig(type, duration);
    if (!config) {
      return { success: false, error: 'Invalid activity configuration' };
    }

    // Validate requirements
    const requirementCheck = this.validateRequirements(gameState, type, config);
    if (!requirementCheck.valid) {
      return { success: false, error: requirementCheck.error };
    }

    // Check energy requirements
    if (gameState.pet.energy < config.energyCost) {
      return {
        success: false,
        error: `Insufficient energy. Required: ${config.energyCost}, Available: ${gameState.pet.energy}`,
      };
    }

    // Create activity
    const activityId = this.generateActivityId();
    const durationMs = config.duration * 60 * 1000; // Convert minutes to milliseconds

    const activity: ActiveActivity = {
      id: activityId,
      type,
      startTime: Date.now(),
      duration: durationMs,
      energyCost: config.energyCost,
      location,
      petId: gameState.pet.id,
      paused: false,
      rewards: this.preRollRewards(type, config),
    };

    // Add training-specific data
    if (type === ACTIVITY_TYPES.TRAINING) {
      (activity as TrainingActivity).targetStat = targetStat || 'attack';
      (activity as TrainingActivity).statIncrease =
        this.tuning?.training?.statIncreasePerSession ?? 2;
      (activity as TrainingActivity).moveLearnChance = this.tuning?.training?.moveLearnChance ?? 20;
      // Training doesn't generate item rewards
      activity.rewards = [];
    }

    // Request timer registration through GameUpdates queue
    const timerId = `activity_${activityId}`;
    activity.timerId = timerId;

    if (this.gameUpdateWriter) {
      this.gameUpdateWriter.enqueue({
        type: UPDATE_TYPES.STATE_TRANSITION,
        payload: {
          action: 'register_timer',
          data: {
            timerId,
            duration: durationMs,
            activityId,
            systemCallback: 'ActivitySystem.handleActivityCompletion',
          },
        },
        priority: 1,
      });
    }

    // Store activity
    this.activeActivities.set(activityId, activity);

    // Queue activity start update
    if (this.gameUpdateWriter) {
      this.gameUpdateWriter.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: {
          action: 'activity_started',
          data: {
            activityId,
            type,
            duration: config.duration,
            energyCost: config.energyCost,
            location,
          },
        },
        priority: 0,
      });
    }

    console.log(
      `[ActivitySystem] Started activity ${activityId} - ${type} for ${config.duration} minutes`,
    );

    return { success: true, activityId };
  }

  /**
   * Cancel an activity
   */
  public cancelActivity(
    activityId: string,
    refundEnergy: boolean = true,
  ): { success: boolean; energyRefunded?: number; error?: string } {
    const activity = this.activeActivities.get(activityId);
    if (!activity) {
      return { success: false, error: 'Activity not found' };
    }

    // Request timer cancellation through GameUpdates queue
    if (this.gameUpdateWriter && activity.timerId) {
      this.gameUpdateWriter.enqueue({
        type: UPDATE_TYPES.STATE_TRANSITION,
        payload: {
          action: 'cancel_timer',
          data: {
            timerId: activity.timerId,
          },
        },
        priority: 1,
      });
    }

    // Remove activity
    this.activeActivities.delete(activityId);

    // Queue cancellation update
    if (this.gameUpdateWriter) {
      this.gameUpdateWriter.enqueue({
        type: UPDATE_TYPES.USER_ACTION,
        payload: {
          action: 'activity_cancelled',
          data: {
            activityId,
            type: activity.type,
            energyRefunded: refundEnergy ? activity.energyCost : 0,
          },
        },
        priority: 0,
      });
    }

    console.log(
      `[ActivitySystem] Cancelled activity ${activityId} - Energy refunded: ${refundEnergy ? activity.energyCost : 0}`,
    );

    return {
      success: true,
      energyRefunded: refundEnergy ? activity.energyCost : 0,
    };
  }

  /**
   * Pause an activity
   */
  public pauseActivity(activityId: string): { success: boolean; error?: string } {
    const activity = this.activeActivities.get(activityId);
    if (!activity) {
      return { success: false, error: 'Activity not found' };
    }

    if (activity.paused) {
      return { success: false, error: 'Activity already paused' };
    }

    const now = Date.now();
    const elapsed = now - activity.startTime;
    activity.paused = true;
    activity.pausedAt = now;
    activity.remainingTime = activity.duration - elapsed;

    // Request timer cancellation through GameUpdates queue (will re-register on resume)
    if (this.gameUpdateWriter && activity.timerId) {
      this.gameUpdateWriter.enqueue({
        type: UPDATE_TYPES.STATE_TRANSITION,
        payload: {
          action: 'cancel_timer',
          data: {
            timerId: activity.timerId,
          },
        },
        priority: 1,
      });
    }

    console.log(
      `[ActivitySystem] Paused activity ${activityId} with ${activity.remainingTime}ms remaining`,
    );

    return { success: true };
  }

  /**
   * Resume a paused activity
   */
  public resumeActivity(activityId: string): { success: boolean; error?: string } {
    const activity = this.activeActivities.get(activityId);
    if (!activity) {
      return { success: false, error: 'Activity not found' };
    }

    if (!activity.paused || activity.remainingTime === undefined) {
      return { success: false, error: 'Activity not paused' };
    }

    activity.paused = false;
    activity.startTime = Date.now();
    activity.duration = activity.remainingTime;
    activity.pausedAt = undefined;
    activity.remainingTime = undefined;

    // Request timer re-registration through GameUpdates queue
    const timerId = `activity_${activityId}_resumed`;
    activity.timerId = timerId;

    if (this.gameUpdateWriter) {
      this.gameUpdateWriter.enqueue({
        type: UPDATE_TYPES.STATE_TRANSITION,
        payload: {
          action: 'register_timer',
          data: {
            timerId,
            duration: activity.duration,
            activityId,
            systemCallback: 'ActivitySystem.handleActivityCompletion',
          },
        },
        priority: 1,
      });
    }

    console.log(`[ActivitySystem] Resumed activity ${activityId}`);

    return { success: true };
  }

  /**
   * Handle activity completion (called by GameEngine when timer completes)
   */
  public handleActivityCompletion(activityId: string): void {
    const activity = this.activeActivities.get(activityId);
    if (!activity) {
      console.warn(`[ActivitySystem] Activity ${activityId} not found for completion`);
      return;
    }

    // Process rewards
    const outcome = this.processActivityOutcome(activity);

    // Remove activity
    this.activeActivities.delete(activityId);

    // Queue completion update
    if (this.gameUpdateWriter) {
      this.gameUpdateWriter.enqueue({
        type: UPDATE_TYPES.ACTIVITY_COMPLETE,
        payload: {
          action: 'activity_completed',
          data: {
            activityId,
            type: activity.type,
            success: outcome.success,
            rewards: outcome.rewards,
            experience: outcome.experience,
            encounterTriggered: outcome.encounterTriggered,
            message: outcome.message,
          },
        },
        priority: 1,
      });
    }

    console.log(
      `[ActivitySystem] Activity ${activityId} completed - Success: ${outcome.success}, Rewards: ${outcome.rewards.length}`,
    );
  }

  /**
   * Process activity outcome and determine rewards
   */
  private processActivityOutcome(activity: ActiveActivity): ActivityOutcome {
    // Use pre-rolled rewards if available
    const rewards = activity.rewards || [];

    // Check for random encounters or mishaps
    const encounterChance = Math.random() * 100;
    const encounterTriggered = encounterChance < 10; // 10% chance

    const mishapChance = Math.random() * 100;
    const injuryRisk = mishapChance < 2; // 2% chance
    const sicknessRisk = mishapChance < 5; // 5% chance

    // Calculate experience for training
    let experience = 0;
    if (activity.type === ACTIVITY_TYPES.TRAINING) {
      const training = activity as TrainingActivity;
      experience = training.statIncrease;
    }

    return {
      success: true,
      rewards,
      experience,
      encounterTriggered,
      injuryRisk,
      sicknessRisk,
      message: this.generateCompletionMessage(activity.type, rewards.length),
    };
  }

  /**
   * Pre-roll rewards when activity starts
   */
  private preRollRewards(type: ActivityType, config: ActivityConfig): ActivityReward[] {
    const rewards: ActivityReward[] = [];
    const numRewards =
      Math.floor(Math.random() * (config.maxRewards - config.minRewards + 1)) + config.minRewards;

    for (let i = 0; i < numRewards; i++) {
      const reward = this.rollSingleReward(type);
      if (reward) {
        rewards.push(reward);
      }
    }

    return rewards;
  }

  /**
   * Roll a single reward based on activity type
   */
  private rollSingleReward(type: ActivityType): ActivityReward | null {
    // Define reward pools by activity type
    const rewardPools: Record<
      ActivityType,
      Array<{ itemId: string; category: ItemCategory; rarity: RarityTier; weight: number }>
    > = {
      [ACTIVITY_TYPES.FISHING]: [
        {
          itemId: 'fish_small',
          category: ITEM_CATEGORIES.FOOD,
          rarity: RARITY_TIERS.COMMON,
          weight: 60,
        },
        {
          itemId: 'fish_medium',
          category: ITEM_CATEGORIES.FOOD,
          rarity: RARITY_TIERS.UNCOMMON,
          weight: 30,
        },
        {
          itemId: 'fish_large',
          category: ITEM_CATEGORIES.FOOD,
          rarity: RARITY_TIERS.RARE,
          weight: 8,
        },
        {
          itemId: 'pearl',
          category: ITEM_CATEGORIES.MATERIAL,
          rarity: RARITY_TIERS.RARE,
          weight: 2,
        },
      ],
      [ACTIVITY_TYPES.FORAGING]: [
        {
          itemId: 'berries',
          category: ITEM_CATEGORIES.FOOD,
          rarity: RARITY_TIERS.COMMON,
          weight: 50,
        },
        {
          itemId: 'mushroom',
          category: ITEM_CATEGORIES.FOOD,
          rarity: RARITY_TIERS.UNCOMMON,
          weight: 30,
        },
        {
          itemId: 'herb',
          category: ITEM_CATEGORIES.MATERIAL,
          rarity: RARITY_TIERS.COMMON,
          weight: 15,
        },
        {
          itemId: 'rare_flower',
          category: ITEM_CATEGORIES.MATERIAL,
          rarity: RARITY_TIERS.RARE,
          weight: 5,
        },
      ],
      [ACTIVITY_TYPES.MINING]: [
        {
          itemId: 'stone',
          category: ITEM_CATEGORIES.MATERIAL,
          rarity: RARITY_TIERS.COMMON,
          weight: 50,
        },
        {
          itemId: 'iron_ore',
          category: ITEM_CATEGORIES.MATERIAL,
          rarity: RARITY_TIERS.UNCOMMON,
          weight: 30,
        },
        {
          itemId: 'gold_ore',
          category: ITEM_CATEGORIES.MATERIAL,
          rarity: RARITY_TIERS.RARE,
          weight: 15,
        },
        { itemId: 'gem', category: ITEM_CATEGORIES.MATERIAL, rarity: RARITY_TIERS.EPIC, weight: 5 },
      ],
      [ACTIVITY_TYPES.TRAINING]: [],
      [ACTIVITY_TYPES.ARENA_PRACTICE]: [
        {
          itemId: 'coin',
          category: ITEM_CATEGORIES.CURRENCY,
          rarity: RARITY_TIERS.COMMON,
          weight: 100,
        },
      ],
      [ACTIVITY_TYPES.SLEEPING]: [],
    };

    const pool = rewardPools[type];
    if (!pool || pool.length === 0) {
      return null;
    }

    // Calculate total weight
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);

    // Roll weighted random
    let roll = Math.random() * totalWeight;

    for (const item of pool) {
      roll -= item.weight;
      if (roll <= 0) {
        return {
          itemId: item.itemId,
          category: item.category,
          quantity: 1,
          rarity: item.rarity,
        };
      }
    }

    // Fallback to first item (should never reach here)
    const firstItem = pool[0];
    if (firstItem) {
      return {
        itemId: firstItem.itemId,
        category: firstItem.category,
        quantity: 1,
        rarity: firstItem.rarity,
      };
    }

    return null;
  }

  /**
   * Generate completion message
   */
  private generateCompletionMessage(type: ActivityType, rewardCount: number): string {
    const messages: Record<ActivityType, string> = {
      [ACTIVITY_TYPES.FISHING]: `Caught ${rewardCount} fish!`,
      [ACTIVITY_TYPES.FORAGING]: `Found ${rewardCount} items while foraging!`,
      [ACTIVITY_TYPES.MINING]: `Mined ${rewardCount} resources!`,
      [ACTIVITY_TYPES.TRAINING]: 'Training session completed!',
      [ACTIVITY_TYPES.ARENA_PRACTICE]: 'Arena practice completed!',
      [ACTIVITY_TYPES.SLEEPING]: 'Woke up refreshed!',
    };

    return messages[type] || 'Activity completed!';
  }

  /**
   * Check concurrent restrictions
   */
  private checkConcurrentRestrictions(
    type: ActivityType,
    pet: Pet,
  ): { allowed: boolean; reason?: string } {
    // Check if pet is already in an exclusive activity
    if (pet.status.primary === STATUS_TYPES.SLEEPING) {
      return { allowed: false, reason: 'Pet is sleeping' };
    }

    if (pet.status.primary === STATUS_TYPES.IN_BATTLE) {
      return { allowed: false, reason: 'Pet is in battle' };
    }

    if (pet.status.primary === STATUS_TYPES.DEAD) {
      return { allowed: false, reason: 'Pet is dead' };
    }

    // Check if trying to start a restricted activity while another is active
    if (this.concurrentRestrictions.has(type)) {
      const hasActiveRestricted = Array.from(this.activeActivities.values()).some(
        (activity) => this.concurrentRestrictions.has(activity.type) && activity.petId === pet.id,
      );

      if (hasActiveRestricted) {
        return { allowed: false, reason: 'Another exclusive activity is in progress' };
      }
    }

    // While traveling, only certain activities are allowed
    if (pet.status.primary === STATUS_TYPES.TRAVELING) {
      const allowedWhileTraveling = new Set<ActivityType>([]);
      if (!allowedWhileTraveling.has(type)) {
        return { allowed: false, reason: 'Cannot perform this activity while traveling' };
      }
    }

    // Check if already in an activity (non-exclusive)
    const activeCount = Array.from(this.activeActivities.values()).filter(
      (activity) => activity.petId === pet.id,
    ).length;

    if (activeCount > 0 && this.concurrentRestrictions.has(type)) {
      return { allowed: false, reason: 'Must complete current activity first' };
    }

    return { allowed: true };
  }

  /**
   * Validate activity requirements
   */
  private validateRequirements(
    gameState: GameState,
    type: ActivityType,
    config: ActivityConfig,
  ): { valid: boolean; error?: string } {
    const pet = gameState.pet;
    if (!pet) {
      return { valid: false, error: 'No active pet' };
    }

    // Check growth stage requirement
    if (config.requiredStage) {
      const stageOrder = [GROWTH_STAGES.HATCHLING, GROWTH_STAGES.JUVENILE, GROWTH_STAGES.ADULT];
      const requiredIndex = stageOrder.indexOf(config.requiredStage);
      const currentIndex = stageOrder.indexOf(pet.stage);

      if (currentIndex < requiredIndex) {
        return {
          valid: false,
          error: `Pet must be at least ${config.requiredStage} stage`,
        };
      }
    }

    // Check tool requirement
    if (config.requiredTool) {
      // Check if we have the required tool in inventory
      // We need to check the item definitions (would need ItemSystem or item definitions)
      // For now, we'll just check if we have any tool items
      const hasTool = gameState.inventory.items.some((invItem) => {
        // Tool items would have the tool type in customData
        return invItem.customData?.toolType === config.requiredTool;
      });

      if (!hasTool) {
        return {
          valid: false,
          error: `Required tool not found: ${config.requiredTool}`,
        };
      }
    }

    // Check for injuries that block activities
    if (pet.status.primary === STATUS_TYPES.INJURED) {
      const blockedActivities: ActivityType[] = [
        ACTIVITY_TYPES.TRAINING,
        ACTIVITY_TYPES.ARENA_PRACTICE,
      ];
      if (blockedActivities.includes(type)) {
        return {
          valid: false,
          error: 'Cannot perform this activity while injured',
        };
      }
    }

    return { valid: true };
  }

  /**
   * Get activity configuration
   */
  private getActivityConfig(
    type: ActivityType,
    duration: 'short' | 'medium' | 'long' | 'training',
  ): ActivityConfig | null {
    if (!this.tuning) {
      // Use defaults if tuning not available
      const defaultDurations: Record<string, number> = {
        short: ACTIVITY_DURATIONS.SHORT,
        medium: ACTIVITY_DURATIONS.MEDIUM,
        long: ACTIVITY_DURATIONS.LONG,
        training: ACTIVITY_DURATIONS.TRAINING,
      };

      return {
        duration: defaultDurations[duration] || 5,
        energyCost: 10,
        minRewards: 1,
        maxRewards: 3,
      };
    }

    // Handle training duration separately
    if (type === ACTIVITY_TYPES.TRAINING && duration === 'training') {
      return {
        duration: this.tuning.training?.durationMinutes ?? ACTIVITY_DURATIONS.TRAINING,
        energyCost: this.tuning.training?.energyCost ?? 20,
        minRewards: 0,
        maxRewards: 0,
      };
    }

    // Get from tuning configuration for regular activities
    const activityConfig = this.tuning.activities?.[type.toLowerCase()];
    if (!activityConfig) {
      return null;
    }

    // Get duration config for regular activities
    const durationConfig = activityConfig[duration as 'short' | 'medium' | 'long'];
    if (!durationConfig) {
      return null;
    }

    // Convert the config to our local ActivityConfig type
    return {
      duration: durationConfig.duration,
      energyCost: durationConfig.energyCost,
      minRewards: durationConfig.minRewards,
      maxRewards: durationConfig.maxRewards,
      requiredStage: durationConfig.requiredStage as GrowthStage | undefined,
      requiredTool: durationConfig.requiredTool,
    };
  }

  /**
   * Generate unique activity ID
   */
  private generateActivityId(): string {
    this.activityCounter++;
    return `activity_${Date.now()}_${this.activityCounter}`;
  }

  /**
   * Get active activities
   */
  public getActiveActivities(): ActiveActivity[] {
    return Array.from(this.activeActivities.values());
  }

  /**
   * Get activity by ID
   */
  public getActivity(activityId: string): ActiveActivity | null {
    return this.activeActivities.get(activityId) || null;
  }

  /**
   * Get remaining time for an activity
   */
  public getActivityRemainingTime(activityId: string): number | null {
    const activity = this.activeActivities.get(activityId);
    if (!activity) {
      return null;
    }

    if (activity.paused && activity.remainingTime !== undefined) {
      return activity.remainingTime;
    }

    // Calculate remaining time based on start time and duration
    const now = Date.now();
    const elapsed = now - activity.startTime;
    return Math.max(0, activity.duration - elapsed);
  }

  /**
   * Check if pet has any active activities
   */
  public hasActiveActivities(petId: string): boolean {
    return Array.from(this.activeActivities.values()).some((activity) => activity.petId === petId);
  }

  /**
   * Process tool durability (called after activity completion)
   */
  public processToolDurability(
    _gameState: GameState,
    _toolType: string,
    _usageCount: number = 1,
  ): { toolBroken: boolean; remainingDurability?: number } {
    // Tool durability would need to be tracked in inventory item's currentDurability
    // This would require coordination with InventorySystem
    // For now, return no tool broken

    return { toolBroken: false };
  }

  /**
   * System lifecycle methods
   */
  protected async onShutdown(): Promise<void> {
    // Cancel all active activities
    for (const activityId of this.activeActivities.keys()) {
      this.cancelActivity(activityId, true);
    }
    this.activeActivities.clear();
    console.log('[ActivitySystem] Shutdown complete');
  }

  protected async onReset(): Promise<void> {
    this.activeActivities.clear();
    this.activityCounter = 0;
    console.log('[ActivitySystem] Reset complete');
  }

  protected async onTick(_deltaTime: number, _gameState: GameState): Promise<void> {
    // Check for any activities that need processing
    // Most activity processing is handled by timers
  }

  protected async onUpdate(_gameState: GameState, _prevState?: GameState): Promise<void> {
    // ActivitySystem doesn't need to respond to general state updates
  }

  protected onError(error: SystemError): void {
    console.error(`[ActivitySystem] System error:`, error);
  }

  /**
   * Get system statistics
   */
  public getStatistics(): {
    activeActivities: number;
    completedActivities: number;
    activitiesByType: Record<string, number>;
  } {
    const activitiesByType: Record<string, number> = {};

    for (const activity of this.activeActivities.values()) {
      activitiesByType[activity.type] = (activitiesByType[activity.type] || 0) + 1;
    }

    return {
      activeActivities: this.activeActivities.size,
      completedActivities: this.activityCounter - this.activeActivities.size,
      activitiesByType,
    };
  }
}

/**
 * Factory function to create a new ActivitySystem
 */
export function createActivitySystem(): ActivitySystem {
  return new ActivitySystem();
}
