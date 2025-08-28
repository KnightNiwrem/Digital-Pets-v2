/**
 * Tests for PetSystem injury mechanics
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { PetSystem } from './PetSystem';
import { ConfigSystem } from './ConfigSystem';
import type { GameState } from '../models/GameState';
import type { Pet } from '../models/Pet';
import { STATUS_TYPES, GROWTH_STAGES, INJURY_TYPES, BODY_PARTS } from '../models/constants';
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

    petSystem = new PetSystem({ enqueue: () => {} });
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
      energy: 80,
    });

    gameState = createMockGameState({
      playerId: 'test-player',
      pet: mockPet,
      coins: 0,
      unlockedSlots: 20,
    });
  });

  describe('applyInjury', () => {
    it('should apply injury to healthy pet', async () => {
      const result = await petSystem.applyInjury(gameState, 30, 'battle');

      expect(result.success).toBe(true);
      expect(mockPet.injuries.length).toBe(1);
      expect(mockPet.injuries[0]?.severity).toBe(30);
      expect(mockPet.injuries[0]?.type).toBe(INJURY_TYPES.SPRAIN);
      expect(mockPet.injuries[0]?.bodyPart).toBe(BODY_PARTS.BODY);
    });

    it('should reduce happiness when injured', async () => {
      const initialHappiness = petSystem.calculateCareValues(mockPet.hiddenCounters).happiness;
      await petSystem.applyInjury(gameState, 50, 'battle');

      const newHappiness = petSystem.calculateCareValues(mockPet.hiddenCounters).happiness;
      expect(newHappiness).toBeLessThan(initialHappiness);
    });

    it('should cap severity at 100', async () => {
      await petSystem.applyInjury(gameState, 150, 'battle');
      expect(mockPet.injuries.length).toBe(1);
      expect(mockPet.injuries[0]?.severity).toBe(100);
    });
  });

  describe('getMovementSpeedModifier', () => {
    it('should return 1.0 for healthy pet', () => {
      const modifier = petSystem.getMovementSpeedModifier(mockPet);
      expect(modifier).toBe(1.0);
    });

    it('should return 0.9 for minor injury (0-25)', () => {
      mockPet.injuries.push({
        type: INJURY_TYPES.BRUISE,
        severity: 20,
        bodyPart: BODY_PARTS.LEG,
        appliedAt: Date.now(),
      });
      const modifier = petSystem.getMovementSpeedModifier(mockPet);
      expect(modifier).toBe(0.9);
    });

    it('should return 0.75 for moderate injury (26-50)', () => {
      mockPet.injuries.push({
        type: INJURY_TYPES.SPRAIN,
        severity: 40,
        bodyPart: BODY_PARTS.LEG,
        appliedAt: Date.now(),
      });
      const modifier = petSystem.getMovementSpeedModifier(mockPet);
      expect(modifier).toBeCloseTo(0.7, 1);
    });

    it('should return 0.5 for severe injury (51-75)', () => {
      mockPet.injuries.push({
        type: INJURY_TYPES.FRACTURE,
        severity: 60,
        bodyPart: BODY_PARTS.LEG,
        appliedAt: Date.now(),
      });
      const modifier = petSystem.getMovementSpeedModifier(mockPet);
      expect(modifier).toBeCloseTo(0.4, 1);
    });

    it('should return 0.25 for critical injury (76-100)', () => {
      mockPet.injuries.push({
        type: INJURY_TYPES.FRACTURE,
        severity: 90,
        bodyPart: BODY_PARTS.LEG,
        appliedAt: Date.now(),
      });
      const modifier = petSystem.getMovementSpeedModifier(mockPet);
      expect(modifier).toBeCloseTo(0.2, 1);
    });
  });

  describe('isActivityBlocked', () => {
    it('should not block activities for healthy pet', () => {
      expect(petSystem.isActivityBlocked(mockPet, 'TRAINING')).toBe(false);
      expect(petSystem.isActivityBlocked(mockPet, 'MINING')).toBe(false);
      expect(petSystem.isActivityBlocked(mockPet, 'ARENA')).toBe(false);
    });

    it('should block training for any injury', () => {
      mockPet.injuries.push({
        type: INJURY_TYPES.BRUISE,
        severity: 10,
        bodyPart: BODY_PARTS.ARM,
        appliedAt: Date.now(),
      });
      expect(petSystem.isActivityBlocked(mockPet, 'TRAINING')).toBe(true);
    });

    it('should block mining for moderate or severe injuries', () => {
      // Minor injury - not blocked
      mockPet.injuries.push({
        type: INJURY_TYPES.BRUISE,
        severity: 20,
        bodyPart: BODY_PARTS.ARM,
        appliedAt: Date.now(),
      });
      expect(petSystem.isActivityBlocked(mockPet, 'MINING')).toBe(false);

      // Moderate injury - blocked
      if (mockPet.injuries[0]) {
        mockPet.injuries[0].severity = 30;
      }
      expect(petSystem.isActivityBlocked(mockPet, 'MINING')).toBe(true);
    });

    it('should block arena/battle for severe injuries', () => {
      // Moderate injury - not blocked
      mockPet.injuries.push({
        type: INJURY_TYPES.SPRAIN,
        severity: 40,
        bodyPart: BODY_PARTS.LEG,
        appliedAt: Date.now(),
      });
      expect(petSystem.isActivityBlocked(mockPet, 'ARENA')).toBe(false);
      expect(petSystem.isActivityBlocked(mockPet, 'BATTLE')).toBe(false);

      // Severe injury - blocked
      if (mockPet.injuries[0]) {
        mockPet.injuries[0].severity = 60;
      }
      expect(petSystem.isActivityBlocked(mockPet, 'ARENA')).toBe(true);
      expect(petSystem.isActivityBlocked(mockPet, 'BATTLE')).toBe(true);
    });

    it('should block long activities for critical injuries', () => {
      // Severe injury - not blocked
      mockPet.injuries.push({
        type: INJURY_TYPES.FRACTURE,
        severity: 70,
        bodyPart: BODY_PARTS.BODY,
        appliedAt: Date.now(),
      });
      expect(petSystem.isActivityBlocked(mockPet, 'LONG_ACTIVITY')).toBe(false);

      // Critical injury - blocked
      if (mockPet.injuries[0]) {
        mockPet.injuries[0].severity = 80;
      }
      expect(petSystem.isActivityBlocked(mockPet, 'LONG_ACTIVITY')).toBe(true);
    });
  });

  describe('getInjuryStatusMessage', () => {
    it('should return undefined for healthy pet', () => {
      const message = petSystem.getInjuryStatusMessage(mockPet);
      expect(message).toBeUndefined();
    });

    it('should return minor injury message', () => {
      mockPet.injuries.push({
        type: INJURY_TYPES.BRUISE,
        severity: 20,
        bodyPart: BODY_PARTS.LEG,
        appliedAt: Date.now(),
      });
      const message = petSystem.getInjuryStatusMessage(mockPet);
      expect(message).toContain('minor');
    });

    it('should return moderate injury message', () => {
      mockPet.injuries.push({
        type: INJURY_TYPES.SPRAIN,
        severity: 40,
        bodyPart: BODY_PARTS.ARM,
        appliedAt: Date.now(),
      });
      const message = petSystem.getInjuryStatusMessage(mockPet);
      expect(message).toContain('moderate');
    });

    it('should return severe injury message', () => {
      mockPet.injuries.push({
        type: INJURY_TYPES.FRACTURE,
        severity: 60,
        bodyPart: BODY_PARTS.BODY,
        appliedAt: Date.now(),
      });
      const message = petSystem.getInjuryStatusMessage(mockPet);
      expect(message).toContain('severe');
    });

    it('should return critical injury message', () => {
      mockPet.injuries.push({
        type: INJURY_TYPES.FRACTURE,
        severity: 90,
        bodyPart: BODY_PARTS.HEAD,
        appliedAt: Date.now(),
      });
      const message = petSystem.getInjuryStatusMessage(mockPet);
      expect(message).toContain('critical');
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
      mockPet.injuries.push({
        type: INJURY_TYPES.FRACTURE,
        severity: 100,
        bodyPart: BODY_PARTS.LEG,
        appliedAt: Date.now(),
      });

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
      // Check if injury severity was reduced or removed
      if (mockPet.injuries.length > 0) {
        expect(mockPet.injuries[0]?.severity).toBeLessThan(100);
      }
    });

    it('should fully heal minor injuries', async () => {
      mockPet.injuries.push({
        type: INJURY_TYPES.BRUISE,
        severity: 50,
        bodyPart: BODY_PARTS.ARM,
        appliedAt: Date.now(),
      });

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
      // Check if injury was healed
      expect(mockPet.injuries.length).toBe(0);
      expect(mockPet.status.primary).toBe(STATUS_TYPES.IDLE);
    });
  });

  describe('processInjuryRecovery', () => {
    it('should not process recovery for healthy pet', async () => {
      await petSystem.processInjuryRecovery(60, gameState);
      expect(mockPet.injuries.length).toBe(0);
      expect(mockPet.status.primary).toBe(STATUS_TYPES.IDLE);
    });

    it('should gradually reduce injury severity', async () => {
      mockPet.injuries.push({
        type: INJURY_TYPES.SPRAIN,
        severity: 50,
        bodyPart: BODY_PARTS.LEG,
        appliedAt: Date.now(),
      });

      // Process 60 ticks (1 hour)
      await petSystem.processInjuryRecovery(60, gameState);

      // Should reduce by approximately 5 points (5 per hour)
      expect(mockPet.injuries[0]?.severity).toBeLessThan(50);
      expect(mockPet.injuries[0]?.severity).toBeGreaterThan(44);
    });

    it('should fully heal when severity reaches 0', async () => {
      mockPet.injuries.push({
        type: INJURY_TYPES.BRUISE,
        severity: 3,
        bodyPart: BODY_PARTS.HEAD,
        appliedAt: Date.now(),
      });

      // Process enough ticks to fully heal
      await petSystem.processInjuryRecovery(60, gameState);

      // Should have removed the injury when healed
      expect(mockPet.injuries.length).toBe(0);
      expect(mockPet.status.primary).toBe(STATUS_TYPES.IDLE);
    });
  });

  describe('getPetSummary with injuries', () => {
    it('should include injury details in summary', () => {
      mockPet.injuries.push({
        type: INJURY_TYPES.SPRAIN,
        severity: 50,
        bodyPart: BODY_PARTS.LEG,
        appliedAt: Date.now(),
      });

      const summary = petSystem.getPetSummary(mockPet);
      expect(summary).toContain('moderate');
      expect(summary).toContain('SPRAIN');
    });

    it('should not include injury details for healthy pet', () => {
      const summary = petSystem.getPetSummary(mockPet);
      expect(summary).toContain('IDLE');
      expect(summary).not.toContain('injured');
      expect(summary).not.toContain('BRUISE');
      expect(summary).not.toContain('SPRAIN');
      expect(summary).not.toContain('FRACTURE');
    });
  });
});
