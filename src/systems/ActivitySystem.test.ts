/**
 * Tests for ActivitySystem
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { ActivitySystem } from './ActivitySystem';
import type { GameState } from '../models';
import { ACTIVITY_TYPES, STATUS_TYPES, GROWTH_STAGES } from '../models/constants';
import { createMockGameState, createMockPet } from '../testing/mocks';
import type { OfflineCalculation } from '../models';

describe('ActivitySystem', () => {
  let activitySystem: ActivitySystem;
  let gameState: GameState;
  let queuedUpdates: any[] = [];

  beforeEach(() => {
    queuedUpdates = [];

    const writer = {
      enqueue: (update: any) => {
        queuedUpdates.push(update);
      },
    };

    activitySystem = new ActivitySystem(writer);

    // Initialize activity system with tuning
    activitySystem.initialize({
      tuning: {
        activities: {
          fishing: {
            short: { duration: 2, energyCost: 5, minRewards: 1, maxRewards: 2 },
            medium: { duration: 5, energyCost: 10, minRewards: 2, maxRewards: 4 },
            long: { duration: 10, energyCost: 20, minRewards: 3, maxRewards: 6 },
          },
          foraging: {
            short: { duration: 2, energyCost: 5, minRewards: 1, maxRewards: 2 },
            medium: { duration: 5, energyCost: 10, minRewards: 2, maxRewards: 4 },
            long: { duration: 10, energyCost: 20, minRewards: 3, maxRewards: 6 },
          },
          mining: {
            medium: {
              duration: 5,
              energyCost: 15,
              minRewards: 1,
              maxRewards: 3,
              requiredStage: 'JUVENILE',
              requiredTool: 'PICKAXE',
            },
            long: {
              duration: 10,
              energyCost: 30,
              minRewards: 2,
              maxRewards: 5,
              requiredStage: 'JUVENILE',
              requiredTool: 'PICKAXE',
            },
          },
        },
        training: {
          durationMinutes: 8,
          energyCost: 20,
          statIncreasePerSession: 2,
          moveLearnChance: 20,
          actionStatIncrease: 1,
        },
      } as any,
    });

    // Create mock game state
    gameState = createMockGameState();
    gameState.pet = createMockPet();
    gameState.pet.energy = 100;
    gameState.pet.status.primary = STATUS_TYPES.IDLE;
  });

  afterEach(() => {
    mock.restore();
  });

  describe('startActivity', () => {
    it('should start a fishing activity successfully', async () => {
      const result = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );

      expect(result.success).toBe(true);
      expect(result.activityId).toBeDefined();
      expect(result.error).toBeUndefined();

      const activities = activitySystem.getActiveActivities();
      expect(activities).toHaveLength(1);
      expect(activities[0]?.type).toBe(ACTIVITY_TYPES.FISHING);
    });

    it('should fail to start activity when pet has insufficient energy', async () => {
      gameState.pet!.energy = 2;

      const result = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient energy');
    });

    it('should fail to start activity when pet is dead', async () => {
      gameState.pet!.status.primary = STATUS_TYPES.DEAD;

      const result = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('No active pet available');
    });

    it('should fail to start training while pet is sleeping', async () => {
      gameState.pet!.status.primary = STATUS_TYPES.SLEEPING;

      const result = await activitySystem.startActivity(
        ACTIVITY_TYPES.TRAINING,
        'training',
        gameState,
        'gym',
        'attack',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pet is sleeping');
    });

    it('should fail to start mining without required tool', async () => {
      gameState.pet!.stage = GROWTH_STAGES.JUVENILE;

      const result = await activitySystem.startActivity(
        ACTIVITY_TYPES.MINING,
        'medium',
        gameState,
        'mountains',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Required tool not found: PICKAXE');
    });

    it('should fail to start mining with wrong growth stage', async () => {
      gameState.pet!.stage = GROWTH_STAGES.HATCHLING;
      // Add pickaxe to inventory
      gameState.inventory.items.push({
        itemId: 'pickaxe_basic',
        quantity: 1,
        obtainedTime: Date.now(),
        customData: { toolType: 'PICKAXE' },
      });

      const result = await activitySystem.startActivity(
        ACTIVITY_TYPES.MINING,
        'medium',
        gameState,
        'mountains',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pet must be at least JUVENILE stage');
    });

    it('should successfully start mining with all requirements met', async () => {
      gameState.pet!.stage = GROWTH_STAGES.JUVENILE;
      gameState.pet!.energy = 50;
      // Add pickaxe to inventory
      gameState.inventory.items.push({
        itemId: 'pickaxe_basic',
        quantity: 1,
        obtainedTime: Date.now(),
        customData: { toolType: 'PICKAXE' },
      });

      const result = await activitySystem.startActivity(
        ACTIVITY_TYPES.MINING,
        'medium',
        gameState,
        'mountains',
      );

      expect(result.success).toBe(true);
      expect(result.activityId).toBeDefined();
    });

    it('should fail to start training while injured', async () => {
      // Add injury to the pet using the new architecture
      gameState.pet!.injuries.push({
        type: 'BRUISE' as any,
        severity: 50,
        bodyPart: 'BODY' as any,
        appliedAt: Date.now(),
      });

      const result = await activitySystem.startActivity(
        ACTIVITY_TYPES.TRAINING,
        'training',
        gameState,
        'gym',
        'attack',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot train while injured');
    });

    it('should fail to start concurrent restricted activities', async () => {
      // Start training
      const firstResult = await activitySystem.startActivity(
        ACTIVITY_TYPES.TRAINING,
        'training',
        gameState,
        'gym',
        'attack',
      );
      expect(firstResult.success).toBe(true);

      // Try to start another training
      const secondResult = await activitySystem.startActivity(
        ACTIVITY_TYPES.TRAINING,
        'training',
        gameState,
        'gym',
        'defense',
      );

      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toBe('Another exclusive activity is in progress');
    });

    it('should pre-roll rewards when starting activity', async () => {
      const result = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'medium',
        gameState,
        'lake',
      );

      expect(result.success).toBe(true);

      const activity = activitySystem.getActivity(result.activityId!);
      expect(activity).toBeDefined();
      expect(activity?.rewards).toBeDefined();
      expect(activity?.rewards?.length).toBeGreaterThanOrEqual(2);
      expect(activity?.rewards?.length).toBeLessThanOrEqual(4);
    });
  });

  describe('Offline Activity Processing', () => {
    it('should complete activity that finished while offline', async () => {
      const now = Date.now();
      const result = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );
      const activityId = result.activityId!;
      const activity = activitySystem.getActivity(activityId)!;

      // Simulate timer that finished during offline
      activity.startTime = now - 10 * 60 * 1000;
      activity.duration = 2 * 60 * 1000;
      const timerId = activity.timerId!;
      gameState.world.activeTimers.push({
        id: timerId,
        type: 'activity',
        startTime: activity.startTime,
        endTime: activity.startTime + activity.duration,
        duration: activity.duration,
        paused: false,
        data: { activityId },
      });

      const offlineCalc: OfflineCalculation = {
        offlineTime: 600,
        ticksToProcess: 0,
        careDecay: { satiety: 0, hydration: 0, happiness: 0, life: 0 },
        poopSpawned: 0,
        sicknessTriggered: false,
        completedActivities: [],
        travelCompleted: false,
        eggsHatched: [],
        expiredEvents: [],
        energyRecovered: 0,
        petDied: false,
      };

      await activitySystem.processOfflineActivities(offlineCalc, gameState);

      expect(offlineCalc.completedActivities.length).toBe(1);
      expect(offlineCalc.completedActivities[0]?.activityId).toBe(activityId);
      expect(activitySystem.getActivity(activityId)).toBeUndefined();
      expect(gameState.world.activeTimers.find((t) => t.id === timerId)).toBeUndefined();
    });
  });

  describe('cancelActivity', () => {
    it('should cancel activity and refund energy', async () => {
      const startResult = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );
      expect(startResult.success).toBe(true);

      const cancelResult = activitySystem.cancelActivity(startResult.activityId!, true);
      expect(cancelResult.success).toBe(true);
      expect(cancelResult.energyRefunded).toBe(5);

      const activities = activitySystem.getActiveActivities();
      expect(activities).toHaveLength(0);
    });

    it('should cancel activity without refunding energy', async () => {
      const startResult = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );
      expect(startResult.success).toBe(true);

      const cancelResult = activitySystem.cancelActivity(startResult.activityId!, false);
      expect(cancelResult.success).toBe(true);
      expect(cancelResult.energyRefunded).toBe(0);
    });

    it('should fail to cancel non-existent activity', () => {
      const result = activitySystem.cancelActivity('invalid_id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Activity not found');
    });

    it('should cancel timer when canceling activity', async () => {
      const startResult = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );
      expect(startResult.success).toBe(true);

      activitySystem.cancelActivity(startResult.activityId!);
      // Check that timer cancel was requested
      const cancelUpdate = queuedUpdates.find((u) => u.payload.action === 'cancel_timer');
      expect(cancelUpdate).toBeDefined();
    });
  });

  describe('pauseActivity', () => {
    it('should pause an active activity', async () => {
      const startResult = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );
      expect(startResult.success).toBe(true);

      const pauseResult = activitySystem.pauseActivity(startResult.activityId!);
      expect(pauseResult.success).toBe(true);

      const activity = activitySystem.getActivity(startResult.activityId!);
      expect(activity?.paused).toBe(true);
      expect(activity?.pausedAt).toBeDefined();
      expect(activity?.remainingTime).toBeDefined();
    });

    it('should fail to pause already paused activity', async () => {
      const startResult = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );

      activitySystem.pauseActivity(startResult.activityId!);
      const secondPause = activitySystem.pauseActivity(startResult.activityId!);

      expect(secondPause.success).toBe(false);
      expect(secondPause.error).toBe('Activity already paused');
    });

    it('should fail to pause non-existent activity', () => {
      const result = activitySystem.pauseActivity('invalid_id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Activity not found');
    });
  });

  describe('resumeActivity', () => {
    it('should resume a paused activity', async () => {
      const startResult = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );

      activitySystem.pauseActivity(startResult.activityId!);
      const resumeResult = activitySystem.resumeActivity(startResult.activityId!);

      expect(resumeResult.success).toBe(true);

      const activity = activitySystem.getActivity(startResult.activityId!);
      expect(activity?.paused).toBe(false);
      expect(activity?.pausedAt).toBeUndefined();
      expect(activity?.remainingTime).toBeUndefined();
    });

    it('should fail to resume non-paused activity', async () => {
      const startResult = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );

      const resumeResult = activitySystem.resumeActivity(startResult.activityId!);
      expect(resumeResult.success).toBe(false);
      expect(resumeResult.error).toBe('Activity not paused');
    });

    it('should re-register timer when resuming', async () => {
      const startResult = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );

      activitySystem.pauseActivity(startResult.activityId!);

      // Clear previous updates
      queuedUpdates = [];

      activitySystem.resumeActivity(startResult.activityId!);

      // Check that timer registration was requested
      const registerUpdate = queuedUpdates.find((u) => u.payload.action === 'register_timer');
      expect(registerUpdate).toBeDefined();
    });
  });

  describe('getActivityRemainingTime', () => {
    it('should return remaining time for active activity', async () => {
      const startResult = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );

      const remaining = activitySystem.getActivityRemainingTime(startResult.activityId!);
      expect(remaining).toBeGreaterThanOrEqual(119000); // Close to full duration (2 minutes)
      expect(remaining).toBeLessThanOrEqual(120000);
    });

    it('should return remaining time for paused activity', async () => {
      const startResult = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );

      // Set up mock to track remaining time
      const activity = activitySystem.getActivity(startResult.activityId!);
      activity!.remainingTime = 3000;

      activitySystem.pauseActivity(startResult.activityId!);

      const remaining = activitySystem.getActivityRemainingTime(startResult.activityId!);
      expect(remaining).toBeGreaterThan(0);
    });

    it('should return undefined for non-existent activity', () => {
      const remaining = activitySystem.getActivityRemainingTime('invalid_id');
      expect(remaining).toBeUndefined();
    });
  });

  describe('hasActiveActivities', () => {
    it('should return true when pet has active activities', async () => {
      const startResult = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );
      expect(startResult.success).toBe(true);

      const hasActive = activitySystem.hasActiveActivities(gameState.pet!.id);
      expect(hasActive).toBe(true);
    });

    it('should return false when pet has no active activities', () => {
      const hasActive = activitySystem.hasActiveActivities(gameState.pet!.id);
      expect(hasActive).toBe(false);
    });

    it('should return false for non-existent pet', () => {
      const hasActive = activitySystem.hasActiveActivities('invalid_pet_id');
      expect(hasActive).toBe(false);
    });
  });

  describe('processToolDurability', () => {
    it('should return tool not broken when no durability tracking', () => {
      const result = activitySystem.processToolDurability(gameState, 'PICKAXE', 1);
      expect(result.toolBroken).toBe(false);
      expect(result.remainingDurability).toBeUndefined();
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', async () => {
      // Start multiple activities
      await activitySystem.startActivity(ACTIVITY_TYPES.FISHING, 'short', gameState, 'lake');
      await activitySystem.startActivity(ACTIVITY_TYPES.FORAGING, 'short', gameState, 'forest');

      const stats = activitySystem.getStatistics();
      expect(stats.activeActivities).toBe(2);
      expect(stats.activitiesByType[ACTIVITY_TYPES.FISHING]).toBe(1);
      expect(stats.activitiesByType[ACTIVITY_TYPES.FORAGING]).toBe(1);
    });

    it('should track completed activities', async () => {
      const result = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );

      activitySystem.cancelActivity(result.activityId!);

      const stats = activitySystem.getStatistics();
      expect(stats.activeActivities).toBe(0);
      expect(stats.completedActivities).toBe(1);
    });
  });

  describe('system lifecycle', () => {
    it('should cancel all activities on shutdown', async () => {
      await activitySystem.startActivity(ACTIVITY_TYPES.FISHING, 'short', gameState, 'lake');
      await activitySystem.startActivity(ACTIVITY_TYPES.FORAGING, 'short', gameState, 'forest');

      await activitySystem.shutdown();

      const activities = activitySystem.getActiveActivities();
      expect(activities).toHaveLength(0);
    });

    it('should reset activity counter on reset', async () => {
      await activitySystem.startActivity(ACTIVITY_TYPES.FISHING, 'short', gameState, 'lake');

      await activitySystem.reset();

      const activities = activitySystem.getActiveActivities();
      expect(activities).toHaveLength(0);

      const stats = activitySystem.getStatistics();
      expect(stats.completedActivities).toBe(0);
    });
  });

  describe('activity rewards', () => {
    it('should generate appropriate rewards for fishing', async () => {
      const result = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'medium',
        gameState,
        'lake',
      );

      const activity = activitySystem.getActivity(result.activityId!);
      const rewards = activity?.rewards || [];

      expect(rewards.length).toBeGreaterThanOrEqual(2);
      expect(rewards.length).toBeLessThanOrEqual(4);

      // Check that rewards are appropriate for fishing
      rewards.forEach((reward) => {
        expect(['fish_small', 'fish_medium', 'fish_large', 'pearl']).toContain(reward.itemId);
      });
    });

    it('should generate appropriate rewards for foraging', async () => {
      const result = await activitySystem.startActivity(
        ACTIVITY_TYPES.FORAGING,
        'short',
        gameState,
        'forest',
      );

      const activity = activitySystem.getActivity(result.activityId!);
      const rewards = activity?.rewards || [];

      expect(rewards.length).toBeGreaterThanOrEqual(1);
      expect(rewards.length).toBeLessThanOrEqual(2);

      // Check that rewards are appropriate for foraging
      rewards.forEach((reward) => {
        expect(['berries', 'mushroom', 'herb', 'rare_flower']).toContain(reward.itemId);
      });
    });

    it('should not generate rewards for training', async () => {
      const result = await activitySystem.startActivity(
        ACTIVITY_TYPES.TRAINING,
        'training',
        gameState,
        'gym',
        'attack',
      );

      const activity = activitySystem.getActivity(result.activityId!);
      expect(activity?.rewards).toEqual([]);
    });
  });

  describe('concurrent activity restrictions', () => {
    it('should allow non-restricted activities to run concurrently', async () => {
      const fishing = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );
      expect(fishing.success).toBe(true);

      const foraging = await activitySystem.startActivity(
        ACTIVITY_TYPES.FORAGING,
        'short',
        gameState,
        'forest',
      );
      expect(foraging.success).toBe(true);

      const activities = activitySystem.getActiveActivities();
      expect(activities).toHaveLength(2);
    });

    it('should prevent restricted activities from running with others', async () => {
      const fishing = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );
      expect(fishing.success).toBe(true);

      const training = await activitySystem.startActivity(
        ACTIVITY_TYPES.TRAINING,
        'training',
        gameState,
        'gym',
        'attack',
      );
      expect(training.success).toBe(false);
      expect(training.error).toBe('Must complete current activity first');
    });

    it('should prevent activities while pet is in battle', async () => {
      gameState.pet!.status.primary = STATUS_TYPES.IN_BATTLE;

      const result = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pet is in battle');
    });

    it('should prevent certain activities while traveling', async () => {
      gameState.pet!.status.primary = STATUS_TYPES.TRAVELING;

      const result = await activitySystem.startActivity(
        ACTIVITY_TYPES.FISHING,
        'short',
        gameState,
        'lake',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot perform this activity while traveling');
    });
  });
});
