/**
 * Tests for BattleSystem
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { BattleSystem } from './BattleSystem';
import { createMockPet, createMockTuningConfig } from '../testing/mocks';
import { GameUpdatesQueue } from '../engine/GameUpdatesQueue';
import type { BattleConfig } from '../models/BattleMove';
import type { Pet } from '../models/Pet';

describe('BattleSystem', () => {
  let battleSystem: BattleSystem;
  let mockUpdatesQueue: GameUpdatesQueue;
  let mockPlayerPet: Pet;
  let mockOpponentPet: Pet;
  let mockBattleConfig: BattleConfig;

  beforeEach(async () => {
    battleSystem = new BattleSystem();
    mockUpdatesQueue = new GameUpdatesQueue();

    // Create mock pets
    mockPlayerPet = createMockPet({
      id: 'player-pet-1',
      name: 'PlayerPet',
      currentHealth: 100,
      maxHealth: 100,
      attack: 30,
      defense: 20,
      speed: 25,
      maxAction: 100,
      knownMoves: ['tackle', 'scratch'],
    });

    mockOpponentPet = createMockPet({
      id: 'opponent-pet-1',
      name: 'OpponentPet',
      currentHealth: 80,
      maxHealth: 80,
      attack: 25,
      defense: 15,
      speed: 20,
      maxAction: 80,
      knownMoves: ['bite', 'growl'],
    });

    mockBattleConfig = {
      type: 'wild',
      difficulty: 'normal',
      levelScaling: false,
      aiStrategy: 'balanced',
      aiPredictability: 0.5,
      rules: {
        maxTurns: 50,
        suddenDeath: false,
        noHealing: false,
        noStatus: false,
        speedMode: false,
      },
      rewardModifiers: {
        experienceMultiplier: 1.0,
        currencyMultiplier: 1.0,
        itemDropMultiplier: 1.0,
      },
    };

    // Initialize system
    await battleSystem.initialize({
      gameUpdateWriter: mockUpdatesQueue.createWriter('BattleSystem'),
      tuning: createMockTuningConfig() as any, // Type cast to bypass full config requirement
    });
  });

  afterEach(async () => {
    await battleSystem.shutdown();
  });

  describe('Battle Initialization', () => {
    test('should initialize battle successfully', async () => {
      const battleState = await battleSystem.initializeBattle(
        mockPlayerPet,
        mockOpponentPet,
        mockBattleConfig,
      );

      expect(battleState).toBeDefined();
      expect(battleState.participants).toHaveLength(2);
      expect(battleState.turnOrder).toHaveLength(2);
      expect(battleState.turnCount).toBe(0);
      expect(battleState.type).toBe('wild');
      expect(battleState.log).toHaveLength(1); // Battle start message
    });

    test('should calculate turn order based on speed', async () => {
      // Player pet has higher speed (25 > 20)
      const battleState = await battleSystem.initializeBattle(
        mockPlayerPet,
        mockOpponentPet,
        mockBattleConfig,
      );

      const firstParticipant = battleState.participants[battleState.turnOrder[0]!]!;
      expect(firstParticipant.speed).toBe(25); // Player pet goes first
      expect(firstParticipant.name).toBe('PlayerPet');
    });

    test('should reject battle initialization if battle already in progress', async () => {
      await battleSystem.initializeBattle(mockPlayerPet, mockOpponentPet, mockBattleConfig);

      await expect(
        battleSystem.initializeBattle(mockPlayerPet, mockOpponentPet, mockBattleConfig),
      ).rejects.toThrow('Battle already in progress');
    });

    test('should create proper battle participants', async () => {
      const battleState = await battleSystem.initializeBattle(
        mockPlayerPet,
        mockOpponentPet,
        mockBattleConfig,
      );

      const playerParticipant = battleState.participants.find((p) => p.team === 'player');
      const opponentParticipant = battleState.participants.find((p) => p.team === 'enemy');

      expect(playerParticipant).toBeDefined();
      expect(opponentParticipant).toBeDefined();

      expect(playerParticipant!.currentHealth).toBe(100);
      expect(playerParticipant!.currentAction).toBe(100);
      expect(opponentParticipant!.currentHealth).toBe(80);
      expect(opponentParticipant!.currentAction).toBe(80);
    });
  });

  describe('Move Execution', () => {
    beforeEach(async () => {
      await battleSystem.initializeBattle(mockPlayerPet, mockOpponentPet, mockBattleConfig);
    });

    test('should execute move successfully', async () => {
      const originalRandom = Math.random;
      Math.random = () => 0.1; // Low number to guarantee accuracy hit

      try {
        const battleState = battleSystem.getCurrentBattle()!;
        const currentParticipant = battleSystem.getCurrentTurnParticipant()!;

        await battleSystem.processBattleAction({
          type: 'move',
          participantId: currentParticipant.id,
          moveId: 'tackle',
          targetId: undefined, // Will auto-target opponent
        });

        // Check that action was consumed
        expect(currentParticipant.currentAction).toBeLessThan(100);

        // Check battle log
        expect(battleState.log.length).toBeGreaterThan(1);
        const lastLog = battleState.log[battleState.log.length - 1]!;
        expect(lastLog.type).toBe('move');
        expect(lastLog.actor).toBe(currentParticipant.id);
      } finally {
        Math.random = originalRandom;
      }
    });

    test('should reject move if participant does not know it', async () => {
      const currentParticipant = battleSystem.getCurrentTurnParticipant()!;

      await expect(
        battleSystem.processBattleAction({
          type: 'move',
          participantId: currentParticipant.id,
          moveId: 'unknown_move',
        }),
      ).rejects.toThrow("doesn't know move");
    });

    test('should reject move if not enough action points', async () => {
      const currentParticipant = battleSystem.getCurrentTurnParticipant()!;
      currentParticipant.currentAction = 5; // Very low action

      await expect(
        battleSystem.processBattleAction({
          type: 'move',
          participantId: currentParticipant.id,
          moveId: 'tackle', // Costs 20 action by default
        }),
      ).rejects.toThrow('Not enough Action points');
    });

    test('should handle accuracy misses', async () => {
      const battleState = battleSystem.getCurrentBattle()!;
      const currentParticipant = battleSystem.getCurrentTurnParticipant()!;

      // Mock random to always miss (accuracy check fails)
      const originalRandom = Math.random;
      Math.random = () => 0.99; // Very high number to fail accuracy

      try {
        await battleSystem.processBattleAction({
          type: 'move',
          participantId: currentParticipant.id,
          moveId: 'tackle',
        });

        const lastLog = battleState.log[battleState.log.length - 1]!;
        expect(lastLog.message).toContain('missed');
      } finally {
        Math.random = originalRandom;
      }
    });
  });

  describe('Skip Turn', () => {
    beforeEach(async () => {
      await battleSystem.initializeBattle(mockPlayerPet, mockOpponentPet, mockBattleConfig);
    });

    test('should restore action points when skipping turn', async () => {
      const battleState = battleSystem.getCurrentBattle()!;
      const currentParticipant = battleSystem.getCurrentTurnParticipant()!;
      currentParticipant.currentAction = 50; // Reduce action

      await battleSystem.processBattleAction({
        type: 'skip',
        participantId: currentParticipant.id,
      });

      expect(currentParticipant.currentAction).toBe(60); // 50 + 10 restore

      const lastLog = battleState.log[battleState.log.length - 1]!;
      expect(lastLog.message).toContain('rested and recovered');
      expect(lastLog.message).toContain('10 Action points');
    });

    test('should not exceed max action when skipping', async () => {
      const currentParticipant = battleSystem.getCurrentTurnParticipant()!;
      currentParticipant.currentAction = 95; // Almost full

      await battleSystem.processBattleAction({
        type: 'skip',
        participantId: currentParticipant.id,
      });

      expect(currentParticipant.currentAction).toBe(100); // Capped at max
    });
  });

  describe('Flee Mechanics', () => {
    beforeEach(async () => {
      await battleSystem.initializeBattle(mockPlayerPet, mockOpponentPet, mockBattleConfig);
    });

    test('should successfully flee when flee succeeds', async () => {
      const currentParticipant = battleSystem.getCurrentTurnParticipant()!;

      // Mock random to always succeed flee
      const originalRandom = Math.random;
      Math.random = () => 0.1; // Low number for success

      try {
        await battleSystem.processBattleAction({
          type: 'flee',
          participantId: currentParticipant.id,
        });

        expect(battleSystem.getCurrentBattle()).toBeNull(); // Battle ended
      } finally {
        Math.random = originalRandom;
      }
    });

    test('should fail to flee when flee fails', async () => {
      const battleState = battleSystem.getCurrentBattle()!;
      const currentParticipant = battleSystem.getCurrentTurnParticipant()!;

      // Mock random to always fail flee
      const originalRandom = Math.random;
      Math.random = () => 0.9; // High number for failure

      try {
        await battleSystem.processBattleAction({
          type: 'flee',
          participantId: currentParticipant.id,
        });

        expect(battleSystem.getCurrentBattle()).not.toBeNull(); // Battle continues
        const lastLog = battleState.log[battleState.log.length - 1]!;
        expect(lastLog.message).toContain("couldn't escape");
      } finally {
        Math.random = originalRandom;
      }
    });

    test('should reject flee when not allowed', async () => {
      const battleState = battleSystem.getCurrentBattle()!;
      battleState.allowFlee = false;
      const currentParticipant = battleSystem.getCurrentTurnParticipant()!;

      await expect(
        battleSystem.processBattleAction({
          type: 'flee',
          participantId: currentParticipant.id,
        }),
      ).rejects.toThrow('Cannot flee from this battle');
    });
  });

  describe('Battle End Conditions', () => {
    test('should end battle when player pet is defeated', async () => {
      await battleSystem.initializeBattle(mockPlayerPet, mockOpponentPet, mockBattleConfig);
      const battleState = battleSystem.getCurrentBattle()!;
      const playerParticipant = battleState.participants.find((p) => p.team === 'player')!;
      const currentParticipant = battleSystem.getCurrentTurnParticipant()!;

      // Reduce player health to 0
      playerParticipant.currentHealth = 0;

      await battleSystem.processBattleAction({
        type: 'skip',
        participantId: currentParticipant.id,
      });

      expect(battleSystem.getCurrentBattle()).toBeNull(); // Battle ended
    });

    test('should end battle when opponent pet is defeated', async () => {
      await battleSystem.initializeBattle(mockPlayerPet, mockOpponentPet, mockBattleConfig);
      const battleState = battleSystem.getCurrentBattle()!;
      const opponentParticipant = battleState.participants.find((p) => p.team === 'enemy')!;
      const currentParticipant = battleSystem.getCurrentTurnParticipant()!;

      // Reduce opponent health to 0
      opponentParticipant.currentHealth = 0;

      await battleSystem.processBattleAction({
        type: 'skip',
        participantId: currentParticipant.id,
      });

      expect(battleSystem.getCurrentBattle()).toBeNull(); // Battle ended
    });

    test('should end battle on timeout', async () => {
      await battleSystem.initializeBattle(mockPlayerPet, mockOpponentPet, mockBattleConfig);
      const battleState = battleSystem.getCurrentBattle()!;
      const currentParticipant = battleSystem.getCurrentTurnParticipant()!;

      // Set turn count to max from config
      battleState.turnCount = mockBattleConfig.rules.maxTurns!;

      await battleSystem.processBattleAction({
        type: 'skip',
        participantId: currentParticipant.id,
      });

      expect(battleSystem.getCurrentBattle()).toBeNull(); // Battle ended
    });

    test('should end battle on timeout with custom max turns', async () => {
      const customConfig = {
        ...mockBattleConfig,
        rules: { ...mockBattleConfig.rules, maxTurns: 10 },
      };

      await battleSystem.initializeBattle(mockPlayerPet, mockOpponentPet, customConfig);
      const battleState = battleSystem.getCurrentBattle()!;
      const currentParticipant = battleSystem.getCurrentTurnParticipant()!;

      // Set turn count to custom max
      battleState.turnCount = customConfig.rules.maxTurns!;

      await battleSystem.processBattleAction({
        type: 'skip',
        participantId: currentParticipant.id,
      });

      expect(battleSystem.getCurrentBattle()).toBeNull(); // Battle ended
    });
  });

  describe('Turn Management', () => {
    beforeEach(async () => {
      await battleSystem.initializeBattle(mockPlayerPet, mockOpponentPet, mockBattleConfig);
    });

    test('should advance turn after action', async () => {
      const battleState = battleSystem.getCurrentBattle()!;
      const initialTurn = battleState.currentTurn;
      const currentParticipant = battleSystem.getCurrentTurnParticipant()!;

      await battleSystem.processBattleAction({
        type: 'skip',
        participantId: currentParticipant.id,
      });

      const newTurn = battleState.currentTurn;
      expect(newTurn).not.toBe(initialTurn);
    });

    test('should correctly identify player turn', async () => {
      const battleState = battleSystem.getCurrentBattle()!;

      // Find which participant is the player
      const playerIndex = battleState.participants.findIndex((p) => p.team === 'player');
      const turnOrderIndex = battleState.turnOrder.indexOf(playerIndex);

      // Set current turn to player
      battleState.currentTurn = turnOrderIndex;

      expect(battleSystem.isPlayerTurn()).toBe(true);
    });

    test('should increment turn count when cycling through all participants', async () => {
      const battleState = battleSystem.getCurrentBattle()!;
      const initialTurnCount = battleState.turnCount;

      // Process actions for both participants
      let currentParticipant = battleSystem.getCurrentTurnParticipant()!;
      await battleSystem.processBattleAction({
        type: 'skip',
        participantId: currentParticipant.id,
      });

      currentParticipant = battleSystem.getCurrentTurnParticipant()!;
      await battleSystem.processBattleAction({
        type: 'skip',
        participantId: currentParticipant.id,
      });

      expect(battleState.turnCount).toBe(initialTurnCount + 1);
    });
  });

  describe('Status Effects', () => {
    beforeEach(async () => {
      await battleSystem.initializeBattle(mockPlayerPet, mockOpponentPet, mockBattleConfig);
    });

    test('should apply poison damage during status effect processing', async () => {
      const battleState = battleSystem.getCurrentBattle()!;
      const participant1 = battleState.participants[0]!;

      // Manually apply poison status
      participant1.statusEffects.push({
        type: 'POISONED',
        turnsRemaining: 2,
        intensity: 1,
      });

      const initialHealth = participant1.currentHealth;

      // Process a turn to trigger status effects
      const currentParticipant = battleSystem.getCurrentTurnParticipant()!;
      await battleSystem.processBattleAction({
        type: 'skip',
        participantId: currentParticipant.id,
      });

      // Advance to next turn to trigger status processing
      const nextParticipant = battleSystem.getCurrentTurnParticipant()!;
      await battleSystem.processBattleAction({
        type: 'skip',
        participantId: nextParticipant.id,
      });

      // Check that poison damage was applied
      expect(participant1.currentHealth).toBeLessThan(initialHealth);

      // Check battle log for poison message
      const poisonLog = battleState.log.find((log) => log.message.includes('poison damage'));
      expect(poisonLog).toBeDefined();
    });

    test('should remove status effects when duration expires', async () => {
      const battleState = battleSystem.getCurrentBattle()!;
      const participant2 = battleState.participants[0]!;

      // Apply poison with 1 turn remaining
      participant2.statusEffects.push({
        type: 'POISONED',
        turnsRemaining: 1,
        intensity: 1,
      });

      // Process enough turns to expire the effect
      for (let i = 0; i < 3; i++) {
        const currentParticipant = battleSystem.getCurrentTurnParticipant()!;
        await battleSystem.processBattleAction({
          type: 'skip',
          participantId: currentParticipant.id,
        });
      }

      expect(participant2.statusEffects).toHaveLength(0);
    });
  });

  describe('Damage Calculation', () => {
    beforeEach(async () => {
      await battleSystem.initializeBattle(mockPlayerPet, mockOpponentPet, mockBattleConfig);
    });

    test('should deal damage based on stats and move power', async () => {
      const battleState = battleSystem.getCurrentBattle()!;
      const currentParticipant = battleSystem.getCurrentTurnParticipant()!;
      const opponent = battleState.participants.find((p) => p.id !== currentParticipant.id)!;
      const initialHealth = opponent.currentHealth;

      // Mock random to ensure hit
      const originalRandom = Math.random;
      Math.random = () => 0.1; // Low number to guarantee hit

      try {
        await battleSystem.processBattleAction({
          type: 'move',
          participantId: currentParticipant.id,
          moveId: 'tackle',
        });

        expect(opponent.currentHealth).toBeLessThan(initialHealth);
      } finally {
        Math.random = originalRandom;
      }
    });

    test('should ensure minimum damage of 1', async () => {
      const battleState = battleSystem.getCurrentBattle()!;
      const currentParticipant = battleSystem.getCurrentTurnParticipant()!;
      const opponent = battleState.participants.find((p) => p.id !== currentParticipant.id)!;

      // Set very low attack and high defense to test minimum damage
      currentParticipant.attack = 1;
      opponent.defense = 1000;

      const initialHealth = opponent.currentHealth;

      await battleSystem.processBattleAction({
        type: 'move',
        participantId: currentParticipant.id,
        moveId: 'tackle',
      });

      expect(opponent.currentHealth).toBe(initialHealth - 1); // Minimum 1 damage
    });
  });

  describe('Battle State Queries', () => {
    test('should return null when no battle is active', () => {
      expect(battleSystem.getCurrentBattle()).toBeNull();
      expect(battleSystem.getCurrentTurnParticipant()).toBeNull();
      expect(battleSystem.isPlayerTurn()).toBe(false);
    });

    test('should return current battle state when battle is active', async () => {
      await battleSystem.initializeBattle(mockPlayerPet, mockOpponentPet, mockBattleConfig);

      expect(battleSystem.getCurrentBattle()).not.toBeNull();
      expect(battleSystem.getCurrentTurnParticipant()).not.toBeNull();
    });
  });

  describe('Integration with GameUpdates', () => {
    test('should write battle start update', async () => {
      await battleSystem.initializeBattle(mockPlayerPet, mockOpponentPet, mockBattleConfig);

      const update = mockUpdatesQueue.dequeue();
      expect(update).not.toBeNull();
      expect(update!.type).toBe('BATTLE_ACTION');
      expect(update!.payload.action).toBe('battle_started');
    });

    test('should write battle end update', async () => {
      await battleSystem.initializeBattle(mockPlayerPet, mockOpponentPet, mockBattleConfig);

      // Clear the battle start update
      mockUpdatesQueue.dequeue();

      const battleState = battleSystem.getCurrentBattle()!;
      const opponentParticipant = battleState.participants.find((p) => p.team === 'enemy')!;

      // End battle by defeating opponent
      opponentParticipant.currentHealth = 0;

      const currentParticipant = battleSystem.getCurrentTurnParticipant()!;
      await battleSystem.processBattleAction({
        type: 'skip',
        participantId: currentParticipant.id,
      });

      const update = mockUpdatesQueue.dequeue();
      expect(update).not.toBeNull();
      expect(update!.type).toBe('BATTLE_ACTION');
      expect(update!.payload.action).toBe('battle_ended');
    });
  });
});
