/**
 * Tests for PetSystem injury mechanics
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { PetSystem } from './PetSystem';
import { ConfigSystem } from './ConfigSystem';
import type { GameState } from '../models/GameState';
import type { Pet } from '../models/Pet';
import { STATUS_TYPES, GROWTH_STAGES } from '../models/constants';
import type { SystemInitOptions } from './BaseSystem';
import { createMockGameState, createMockPet } from '../testing';

describe('PetSystem - Injury Mechanics', () => {
  let petSystem: PetSystem;
  let configSystem: ConfigSystem;
  let gameState: GameState;
  let mockPet: Pet;

  beforeEach(async () => {
    // Initialize systems
    configSystem = new ConfigSystem();
    await configSystem.load();
    const tuning = configSystem.getTuningValues();

    petSystem = new PetSystem();
    await petSystem.initialize({
      tuning: tuning,
      config: {},
    } as SystemInitOptions);

    // Create mock pet and game state
    mockPet = createMockPet({
      id: 'test-pet',
      name: 'TestPet',
      species: 'TestSpecies',
      rarity: 'COMMON',
      stage: GROWTH_STAGES.JUVENILE,
      health: 50,
      energy: 80
    });

    gameState = createMockGameState({
      playerId: 'test-player',
      pet: mockPet,
      coins: 0,
      unlockedSlots: 20
    });
  });

  describe('applyInjury', () => {
    it('should apply injury to healthy pet', async () => {
      const result = await petSystem.applyInjury(gameState, 30, 'battle');

      expect(result.success).toBe(true);
      expect(mockPet.status.primary).toBe(STATUS_TYPES.INJURED);
      expect(mockPet.status.injurySeverity).toBe(30);
    });

    it('should reduce happiness when injured', async () => {
      const initialHappiness = petSystem.calculateCareValues(mockPet.hiddenCounters).happiness;
      await petSystem.applyInjury(gameState, 50, 'battle');

      const newHappiness = petSystem.calculateCareValues(mockPet.hiddenCounters).happiness;
      expect(newHappiness).toBeLessThan(initialHappiness);
    });

    it('should cap severity at 100', async () => {
      await petSystem.applyInjury(gameState, 150, 'battle');
      expect(mockPet.status.injurySeverity).toBe(100);
    });
  });

  describe('getMovementSpeedModifier', () => {
    it('should return 1.0 for healthy pet', () => {
      const modifier = petSystem.getMovementSpeedModifier(mockPet);
      expect(modifier).toBe(1.0);
    });

    it('should return 0.9 for minor injury (0-25)', () => {
      mockPet.status.primary = STATUS_TYPES.INJURED;
      mockPet.status.injurySeverity = 20;
      const modifier = petSystem.getMovementSpeedModifier(mockPet);
      expect(modifier).toBe(0.9);
    });

    it('should return 0.75 for moderate injury (26-50)', () => {
      mockPet.status.primary = STATUS_TYPES.INJURED;
      mockPet.status.injurySeverity = 40;
      const modifier = petSystem.getMovementSpeedModifier(mockPet);
      expect(modifier).toBe(0.75);
    });

    it('should return 0.5 for severe injury (51-75)', () => {
      mockPet.status.primary = STATUS_TYPES.INJURED;
      mockPet.status.injurySeverity = 60;
      const modifier = petSystem.getMovementSpeedModifier(mockPet);
      expect(modifier).toBe(0.5);
    });

    it('should return 0.25 for critical injury (76-100)', () => {
      mockPet.status.primary = STATUS_TYPES.INJURED;
      mockPet.status.injurySeverity = 90;
      const modifier = petSystem.getMovementSpeedModifier(mockPet);
      expect(modifier).toBe(0.25);
    });
  });

  describe('isActivityBlocked', () => {
    it('should not block activities for healthy pet', () => {
      expect(petSystem.isActivityBlocked(mockPet, 'TRAINING')).toBe(false);
      expect(petSystem.isActivityBlocked(mockPet, 'MINING')).toBe(false);
      expect(petSystem.isActivityBlocked(mockPet, 'ARENA')).toBe(false);
    });

    it('should block training for any injury', () => {
      mockPet.status.primary = STATUS_TYPES.INJURED;
      mockPet.status.injurySeverity = 10;
      expect(petSystem.isActivityBlocked(mockPet, 'TRAINING')).toBe(true);
    });

    it('should block mining for moderate or severe injuries', () => {
      mockPet.status.primary = STATUS_TYPES.INJURED;

      // Minor injury - not blocked
      mockPet.status.injurySeverity = 20;
      expect(petSystem.isActivityBlocked(mockPet, 'MINING')).toBe(false);

      // Moderate injury - blocked
      mockPet.status.injurySeverity = 30;
      expect(petSystem.isActivityBlocked(mockPet, 'MINING')).toBe(true);
    });

    it('should block arena/battle for severe injuries', () => {
      mockPet.status.primary = STATUS_TYPES.INJURED;

      // Moderate injury - not blocked
      mockPet.status.injurySeverity = 40;
      expect(petSystem.isActivityBlocked(mockPet, 'ARENA')).toBe(false);
      expect(petSystem.isActivityBlocked(mockPet, 'BATTLE')).toBe(false);

      // Severe injury - blocked
      mockPet.status.injurySeverity = 60;
      expect(petSystem.isActivityBlocked(mockPet, 'ARENA')).toBe(true);
      expect(petSystem.isActivityBlocked(mockPet, 'BATTLE')).toBe(true);
    });

    it('should block long activities for critical injuries', () => {
      mockPet.status.primary = STATUS_TYPES.INJURED;

      // Severe injury - not blocked
      mockPet.status.injurySeverity = 70;
      expect(petSystem.isActivityBlocked(mockPet, 'LONG_ACTIVITY')).toBe(false);

      // Critical injury - blocked
      mockPet.status.injurySeverity = 80;
      expect(petSystem.isActivityBlocked(mockPet, 'LONG_ACTIVITY')).toBe(true);
    });
  });

  describe('getInjuryStatusMessage', () => {
    it('should return null for healthy pet', () => {
      const message = petSystem.getInjuryStatusMessage(mockPet);
      expect(message).toBeNull();
    });

    it('should return minor injury message', () => {
      mockPet.status.primary = STATUS_TYPES.INJURED;
      mockPet.status.injurySeverity = 20;
      const message = petSystem.getInjuryStatusMessage(mockPet);
      expect(message).toContain('minor injuries');
    });

    it('should return moderate injury message', () => {
      mockPet.status.primary = STATUS_TYPES.INJURED;
      mockPet.status.injurySeverity = 40;
      const message = petSystem.getInjuryStatusMessage(mockPet);
      expect(message).toContain('moderately injured');
    });

    it('should return severe injury message', () => {
      mockPet.status.primary = STATUS_TYPES.INJURED;
      mockPet.status.injurySeverity = 60;
      const message = petSystem.getInjuryStatusMessage(mockPet);
      expect(message).toContain('severely injured');
    });

    it('should return critical injury message', () => {
      mockPet.status.primary = STATUS_TYPES.INJURED;
      mockPet.status.injurySeverity = 90;
      const message = petSystem.getInjuryStatusMessage(mockPet);
      expect(message).toContain('critically injured');
    });
  });

  describe('treatInjury', () => {
    it('should not treat healthy pet', async () => {
      const bandageItem = {
        id: 'bandage-1',
        name: 'Bandage',
        category: 'MEDICINE' as const,
        rarity: 'COMMON' as const,
        value: 50,
        description: 'Heals injuries',
        sprite: 'bandage.png',
        stackable: true,
        maxStack: 99,
        sellPrice: 25,
        buyPrice: 50,
        consumable: true,
        usable: true,
      };

      const result = await petSystem.treatInjury(gameState, bandageItem);
      expect(result.success).toBe(false);
      expect(result.message).toContain('not injured');
    });

    it('should reduce injury severity', async () => {
      mockPet.status.primary = STATUS_TYPES.INJURED;
      mockPet.status.injurySeverity = 100;

      const bandageItem = {
        id: 'bandage-1',
        name: 'Bandage',
        category: 'MEDICINE' as const,
        rarity: 'COMMON' as const,
        value: 50,
        description: 'Heals injuries',
        sprite: 'bandage.png',
        stackable: true,
        maxStack: 99,
        sellPrice: 25,
        buyPrice: 50,
        consumable: true,
        usable: true,
      };

      const result = await petSystem.treatInjury(gameState, bandageItem);
      expect(result.success).toBe(true);
      expect(mockPet.status.injurySeverity).toBeLessThan(100);
    });

    it('should fully heal minor injuries', async () => {
      mockPet.status.primary = STATUS_TYPES.INJURED;
      mockPet.status.injurySeverity = 50;

      const bandageItem = {
        id: 'bandage-1',
        name: 'Bandage',
        category: 'MEDICINE' as const,
        rarity: 'COMMON' as const,
        value: 50,
        description: 'Heals injuries',
        sprite: 'bandage.png',
        stackable: true,
        maxStack: 99,
        sellPrice: 25,
        buyPrice: 50,
        consumable: true,
        usable: true,
      };

      const result = await petSystem.treatInjury(gameState, bandageItem);
      expect(result.success).toBe(true);
      // Check if pet is now healthy after full treatment
      const isHealthy = (mockPet.status.primary as any) === 'HEALTHY';
      expect(isHealthy).toBe(true);
      expect(mockPet.status.injurySeverity).toBeUndefined();
    });
  });

  describe('processInjuryRecovery', () => {
    it('should not process recovery for healthy pet', async () => {
      mockPet.status.primary = STATUS_TYPES.HEALTHY;
      await petSystem.processInjuryRecovery(60, gameState);
      // Check if pet is now healthy after recovery
      const isHealthy = mockPet.status.primary === STATUS_TYPES.HEALTHY;
      expect(isHealthy).toBe(true);
    });

    it('should gradually reduce injury severity', async () => {
      mockPet.status.primary = STATUS_TYPES.INJURED;
      mockPet.status.injurySeverity = 50;

      // Process 60 ticks (1 hour)
      await petSystem.processInjuryRecovery(60, gameState);

      // Should reduce by approximately 5 points (5 per hour)
      expect(mockPet.status.injurySeverity).toBeLessThan(50);
      expect(mockPet.status.injurySeverity).toBeGreaterThan(44);
    });

    it('should fully heal when severity reaches 0', async () => {
      mockPet.status.primary = STATUS_TYPES.INJURED;
      mockPet.status.injurySeverity = 3;

      // Process enough ticks to fully heal
      await petSystem.processInjuryRecovery(60, gameState);

      // Check if pet is now healthy after recovery
      const isHealthy = (mockPet.status.primary as any) === 'HEALTHY';
      expect(isHealthy).toBe(true);
      expect(mockPet.status.injurySeverity).toBeUndefined();
    });
  });

  describe('getPetSummary with injuries', () => {
    it('should include injury details in summary', () => {
      mockPet.status.primary = STATUS_TYPES.INJURED;
      mockPet.status.injurySeverity = 50;

      const summary = petSystem.getPetSummary(mockPet);
      expect(summary).toContain('moderately injured');
      expect(summary).toContain('INJURED');
    });

    it('should not include injury details for healthy pet', () => {
      mockPet.status.primary = STATUS_TYPES.HEALTHY;

      const summary = petSystem.getPetSummary(mockPet);
      expect(summary).toContain('HEALTHY');
      expect(summary).not.toContain('injured');
    });
  });
});
