/**
 * BattleSystem - Manages all battle mechanics and combat flow
 * Handles battle initialization, turn management, and battle resolution
 */

import { BaseSystem } from './BaseSystem';
import type { 
  BattleState, 
  BattleParticipant, 
  BattleMove,
  BattleLogEntry,
  BattleConfig 
} from '../models/BattleMove';
import type { Pet } from '../models/Pet';
import { UPDATE_TYPES } from '../models/constants';
import { randomInt } from '../utils/math';

export interface BattleAction {
  type: 'move' | 'item' | 'flee' | 'skip';
  participantId: string;
  moveId?: string;
  itemId?: string;
  targetId?: string;
}

export interface BattleResult {
  winner: 'player' | 'enemy' | 'draw';
  endReason: 'defeat' | 'victory' | 'flee' | 'timeout';
  rewards: {
    experience: number;
    currency: number;
    items: { itemId: string; quantity: number }[];
  };
}

/**
 * BattleSystem manages all battle mechanics
 */
export class BattleSystem extends BaseSystem {
  private currentBattle: BattleState | null = null;

  constructor() {
    super('BattleSystem');
  }

  // Implement abstract methods from BaseSystem
  protected async onInitialize(_options: any): Promise<void> {
    // No special initialization needed for BattleSystem
  }

  protected async onShutdown(): Promise<void> {
    // End any active battle
    if (this.currentBattle) {
      await this.endBattle({
        winner: 'draw',
        endReason: 'timeout',
        rewards: { experience: 0, currency: 0, items: [] }
      });
    }
  }

  protected async onReset(): Promise<void> {
    // Clear current battle
    this.currentBattle = null;
  }

  protected async onTick(_deltaTime: number, _gameState: any): Promise<void> {
    // BattleSystem doesn't need regular tick processing
    // Battle progression is event-driven through actions
  }

  protected async onUpdate(_gameState: any, _prevState?: any): Promise<void> {
    // BattleSystem doesn't need game state update processing
    // It maintains its own battle state
  }

  protected onError(error: any): void {
    console.error(`[BattleSystem] Error:`, error);
    
    // End battle on critical errors
    if (this.currentBattle) {
      this.currentBattle = null;
    }
  }

  /**
   * Initialize a new battle
   */
  public async initializeBattle(
    playerPet: Pet,
    opponentPet: Pet | BattleParticipant,
    config: BattleConfig
  ): Promise<BattleState> {
    if (this.currentBattle) {
      throw new Error('Battle already in progress');
    }

    const battleId = `battle_${Date.now()}_${randomInt(1000, 9999)}`;
    
    // Create battle participants
    const playerParticipant = this.createParticipantFromPet(playerPet, 'player');
    const opponentParticipant = this.isParticipant(opponentPet) 
      ? opponentPet 
      : this.createParticipantFromPet(opponentPet, 'enemy');

    const participants = [playerParticipant, opponentParticipant];

    // Calculate turn order based on speed
    const turnOrder = this.calculateTurnOrder(participants);

    // Initialize battle state
    this.currentBattle = {
      id: battleId,
      type: config.type,
      startTime: Date.now(),
      participants,
      currentTurn: 0,
      turnOrder,
      turnCount: 0,
      allowFlee: config.rules.maxTurns ? config.rules.maxTurns > 0 : true,
      allowItems: !config.rules.noHealing,
      allowSwitch: false, // Not implemented yet
      log: [],
      rewards: this.calculateRewards(config, opponentParticipant)
    };

    // Log battle start
    this.addBattleLogEntry({
      turn: 0,
      timestamp: Date.now(),
      type: 'other',
      message: `Battle started between ${playerParticipant.name} and ${opponentParticipant.name}!`,
      important: true
    });

    // Write battle start update
    if (this.gameUpdateWriter) {
      this.gameUpdateWriter.enqueue({
        type: UPDATE_TYPES.BATTLE_ACTION,
        priority: 1,
        payload: {
          action: 'battle_started',
          data: {
            battleId: battleId,
            participants: participants.map(p => ({ id: p.id, name: p.name, team: p.team }))
          }
        }
      });
    }

    return this.currentBattle;
  }

  /**
   * Process a battle action
   */
  public async processBattleAction(action: BattleAction): Promise<void> {
    if (!this.currentBattle) {
      throw new Error('No battle in progress');
    }

    const participant = this.currentBattle.participants.find(p => p.id === action.participantId);
    if (!participant) {
      throw new Error('Participant not found');
    }

    switch (action.type) {
      case 'move':
        await this.executeMove(participant, action.moveId!, action.targetId);
        break;
      case 'item':
        await this.useItem(participant, action.itemId!, action.targetId);
        break;
      case 'flee':
        await this.attemptFlee(participant);
        break;
      case 'skip':
        await this.skipTurn(participant);
        break;
    }

    // Check for battle end conditions
    const battleResult = this.checkBattleEnd();
    if (battleResult) {
      await this.endBattle(battleResult);
    } else {
      this.advanceTurn();
    }
  }

  /**
   * Execute a move in battle
   */
  private async executeMove(participant: BattleParticipant, moveId: string, targetId?: string): Promise<void> {
    if (!this.currentBattle) return;

    // For skip turn (always available)
    if (moveId === 'skip_turn') {
      await this.skipTurn(participant);
      return;
    }

    // Check if participant has the move
    if (!participant.moves.includes(moveId)) {
      throw new Error(`Participant ${participant.name} doesn't know move ${moveId}`);
    }

    // Get move data (in a real implementation, this would come from a moves database)
    const move = this.getMoveById(moveId);
    if (!move) {
      throw new Error(`Move ${moveId} not found`);
    }

    // Check action cost
    if (participant.currentAction < move.actionCost) {
      throw new Error(`Not enough Action points. Need ${move.actionCost}, have ${participant.currentAction}`);
    }

    // Deduct action cost
    participant.currentAction -= move.actionCost;

    // Find target
    const target = targetId 
      ? this.currentBattle.participants.find(p => p.id === targetId)
      : this.getDefaultTarget(participant, move);

    if (!target) {
      throw new Error('No valid target found');
    }

    // Check accuracy
    if (!this.checkAccuracy(participant, move, target)) {
      this.addBattleLogEntry({
        turn: this.currentBattle.turnCount,
        timestamp: Date.now(),
        type: 'move',
        actor: participant.id,
        target: target.id,
        action: moveId,
        message: `${participant.name} used ${move.name}, but it missed!`,
        important: false
      });
      return;
    }

    let damage = 0;
    let healing = 0;

    // Calculate damage for damage moves
    if (move.power > 0) {
      damage = this.calculateDamage(participant, move, target);
      target.currentHealth = Math.max(0, target.currentHealth - damage);
    }

    // Apply status effects
    if (move.statusEffect && Math.random() * 100 < move.statusEffect.chance) {
      this.applyStatusEffect(target, move.statusEffect);
    }

    // Create log entry
    let message = `${participant.name} used ${move.name}`;
    if (damage > 0) {
      message += ` dealing ${damage} damage to ${target.name}`;
      const isCritical = this.wasLastHitCritical(damage, participant, move, target);
      if (isCritical) {
        message += ' (Critical hit!)';
      }
    }
    if (healing > 0) {
      message += ` healing ${target.name} for ${healing} HP`;
    }
    message += '!';

    this.addBattleLogEntry({
      turn: this.currentBattle.turnCount,
      timestamp: Date.now(),
      type: 'move',
      actor: participant.id,
      target: target.id,
      action: moveId,
      damage,
      healing,
      message,
      important: damage > 0 || healing > 0
    });
  }

  /**
   * Skip turn to recover action points
   */
  private async skipTurn(participant: BattleParticipant): Promise<void> {
    if (!this.currentBattle || !this.tuning) return;

    const restoreAmount = this.tuning.battle?.actionRestoreOnSkip || 10;
    const oldAction = participant.currentAction;
    participant.currentAction = Math.min(participant.maxAction, participant.currentAction + restoreAmount);
    const actualRestore = participant.currentAction - oldAction;

    this.addBattleLogEntry({
      turn: this.currentBattle.turnCount,
      timestamp: Date.now(),
      type: 'other',
      actor: participant.id,
      message: `${participant.name} rested and recovered ${actualRestore} Action points!`,
      important: false
    });
  }

  /**
   * Attempt to flee from battle
   */
  private async attemptFlee(participant: BattleParticipant): Promise<void> {
    if (!this.currentBattle || !this.tuning) return;

    if (!this.currentBattle.allowFlee) {
      throw new Error('Cannot flee from this battle');
    }

    const fleeChance = this.tuning.battle?.fleeBaseChance || 50;
    const success = Math.random() * 100 < fleeChance;

    if (success) {
      this.addBattleLogEntry({
        turn: this.currentBattle.turnCount,
        timestamp: Date.now(),
        type: 'flee',
        actor: participant.id,
        message: `${participant.name} successfully fled from battle!`,
        important: true
      });

      await this.endBattle({
        winner: participant.team === 'player' ? 'draw' : 'player', // If player flees, it's not a win
        endReason: 'flee',
        rewards: { experience: 0, currency: 0, items: [] }
      });
    } else {
      this.addBattleLogEntry({
        turn: this.currentBattle.turnCount,
        timestamp: Date.now(),
        type: 'flee',
        actor: participant.id,
        message: `${participant.name} couldn't escape!`,
        important: false
      });
    }
  }

  /**
   * Use an item in battle
   */
  private async useItem(participant: BattleParticipant, itemId: string, targetId?: string): Promise<void> {
    if (!this.currentBattle) return;

    // Item usage would be implemented here
    // For now, just log the action
    this.addBattleLogEntry({
      turn: this.currentBattle.turnCount,
      timestamp: Date.now(),
      type: 'item',
      actor: participant.id,
      target: targetId,
      action: itemId,
      message: `${participant.name} used ${itemId}!`,
      important: false
    });
  }

  /**
   * Calculate turn order based on speed stats
   */
  private calculateTurnOrder(participants: BattleParticipant[]): number[] {
    return participants
      .map((participant, index) => ({ index, speed: participant.speed }))
      .sort((a, b) => b.speed - a.speed) // Higher speed goes first
      .map(item => item.index);
  }

  /**
   * Calculate damage for a move
   */
  private calculateDamage(attacker: BattleParticipant, move: BattleMove, defender: BattleParticipant): number {
    if (!this.tuning?.battle?.damageFormula) return 0;

    const formula = this.tuning.battle.damageFormula;
    const baseDamage = formula.base + move.power;
    const attackStat = attacker.attack * attacker.statModifiers.attack;
    const defenseStat = defender.defense * defender.statModifiers.defense;

    let damage = baseDamage + (attackStat * formula.attackMultiplier) - (defenseStat * formula.defenseMultiplier);
    
    // Apply critical hit
    const critChance = this.tuning.battle?.criticalHitChance || 10;
    if (Math.random() * 100 < critChance) {
      const critMultiplier = this.tuning.battle?.criticalHitMultiplier || 1.5;
      damage *= critMultiplier;
    }

    return Math.max(1, Math.round(damage)); // Minimum 1 damage
  }

  /**
   * Check if an attack hits based on accuracy
   */
  private checkAccuracy(attacker: BattleParticipant, move: BattleMove, defender: BattleParticipant): boolean {
    const baseAccuracy = this.tuning?.battle?.baseAccuracy || 100;
    const moveAccuracy = move.accuracy || baseAccuracy;
    const attackerAccuracy = attacker.statModifiers.accuracy;
    const defenderEvasion = defender.statModifiers.evasion;

    const finalAccuracy = (moveAccuracy * attackerAccuracy) / defenderEvasion;
    return Math.random() * 100 < finalAccuracy;
  }

  /**
   * Check if the last hit was critical (for display purposes)
   */
  private wasLastHitCritical(damage: number, attacker: BattleParticipant, move: BattleMove, defender: BattleParticipant): boolean {
    if (!this.tuning?.battle) return false;
    
    const formula = this.tuning.battle.damageFormula;
    const baseDamage = formula.base + move.power;
    const attackStat = attacker.attack * attacker.statModifiers.attack;
    const defenseStat = defender.defense * defender.statModifiers.defense;
    
    const normalDamage = baseDamage + (attackStat * formula.attackMultiplier) - (defenseStat * formula.defenseMultiplier);
    const critMultiplier = this.tuning.battle.criticalHitMultiplier || 1.5;
    
    return damage >= Math.round(normalDamage * critMultiplier);
  }

  /**
   * Apply status effect to a participant
   */
  private applyStatusEffect(participant: BattleParticipant, statusEffect: { type: any, duration: number, stackable: boolean }): void {
    // Check if effect already exists
    const existingEffect = participant.statusEffects.find(effect => effect.type === statusEffect.type);
    
    if (existingEffect && statusEffect.stackable) {
      existingEffect.intensity += 1;
      existingEffect.turnsRemaining = Math.max(existingEffect.turnsRemaining, statusEffect.duration);
    } else if (!existingEffect) {
      participant.statusEffects.push({
        type: statusEffect.type,
        turnsRemaining: statusEffect.duration,
        intensity: 1
      });
    }
  }

  /**
   * Check for battle end conditions
   */
  private checkBattleEnd(): BattleResult | null {
    if (!this.currentBattle) return null;

    // Check if any participant is defeated
    const playerParticipant = this.currentBattle.participants.find(p => p.team === 'player');
    const enemyParticipant = this.currentBattle.participants.find(p => p.team === 'enemy');

    if (playerParticipant && playerParticipant.currentHealth <= 0) {
      return {
        winner: 'enemy',
        endReason: 'defeat',
        rewards: { experience: 0, currency: 0, items: [] }
      };
    }

    if (enemyParticipant && enemyParticipant.currentHealth <= 0) {
      return {
        winner: 'player',
        endReason: 'victory',
        rewards: this.currentBattle.rewards || { experience: 0, currency: 0, items: [] }
      };
    }

    // Check for timeout - use a reasonable default if tuning is not available
    const maxTurns = 100; // Default max turns
    if (this.currentBattle.turnCount >= maxTurns) {
      return {
        winner: 'draw',
        endReason: 'timeout',
        rewards: { experience: 0, currency: 0, items: [] }
      };
    }

    return null;
  }

  /**
   * End the current battle
   */
  private async endBattle(result: BattleResult): Promise<void> {
    if (!this.currentBattle) return;

    // Update battle result
    this.currentBattle.result = {
      winner: result.winner === 'draw' ? 'draw' : result.winner,
      endReason: result.endReason,
      turnsElapsed: this.currentBattle.turnCount,
      damageDealt: 0, // Would be calculated from battle log
      damageTaken: 0, // Would be calculated from battle log
      experienceGained: result.rewards.experience,
      itemsReceived: result.rewards.items
    };

    // Log battle end
    let message = '';
    switch (result.endReason) {
      case 'victory':
        message = 'Victory! You won the battle!';
        break;
      case 'defeat':
        message = 'Defeat! You lost the battle.';
        break;
      case 'flee':
        message = 'You fled from the battle.';
        break;
      case 'timeout':
        message = 'The battle ended in a draw due to time limit.';
        break;
    }

    this.addBattleLogEntry({
      turn: this.currentBattle.turnCount,
      timestamp: Date.now(),
      type: 'other',
      message,
      important: true
    });

    // Write battle end update
    if (this.gameUpdateWriter) {
      this.gameUpdateWriter.enqueue({
        type: UPDATE_TYPES.BATTLE_ACTION,
        priority: 1,
        payload: {
          action: 'battle_ended',
          data: {
            battleId: this.currentBattle.id,
            result: this.currentBattle.result
          }
        }
      });
    }

    // Clear current battle
    this.currentBattle = null;
  }

  /**
   * Advance to the next turn
   */
  private advanceTurn(): void {
    if (!this.currentBattle) return;

    this.currentBattle.currentTurn = (this.currentBattle.currentTurn + 1) % this.currentBattle.turnOrder.length;
    
    // If we're back to the first participant, increment turn count
    if (this.currentBattle.currentTurn === 0) {
      this.currentBattle.turnCount++;
    }

    // Process status effects at turn start
    this.processStatusEffects();
  }

  /**
   * Process status effects for all participants
   */
  private processStatusEffects(): void {
    if (!this.currentBattle) return;

    for (const participant of this.currentBattle.participants) {
      for (let i = participant.statusEffects.length - 1; i >= 0; i--) {
        const effect = participant.statusEffects[i];
        if (!effect) continue;
        
        // Apply effect
        switch (effect.type) {
          case 'POISONED':
            const poisonDamage = Math.max(1, Math.round(participant.maxHealth * 0.1));
            participant.currentHealth = Math.max(0, participant.currentHealth - poisonDamage);
            this.addBattleLogEntry({
              turn: this.currentBattle.turnCount,
              timestamp: Date.now(),
              type: 'status',
              actor: participant.id,
              damage: poisonDamage,
              message: `${participant.name} took ${poisonDamage} poison damage!`,
              important: false
            });
            break;
        }
        
        // Reduce duration
        effect.turnsRemaining--;
        if (effect.turnsRemaining <= 0) {
          participant.statusEffects.splice(i, 1);
        }
      }
    }
  }

  /**
   * Get the current battle state
   */
  public getCurrentBattle(): BattleState | null {
    return this.currentBattle;
  }

  /**
   * Get the current turn participant
   */
  public getCurrentTurnParticipant(): BattleParticipant | null {
    if (!this.currentBattle) return null;
    
    const currentTurnIndex = this.currentBattle.turnOrder[this.currentBattle.currentTurn];
    if (currentTurnIndex === undefined) return null;
    
    return this.currentBattle.participants[currentTurnIndex] || null;
  }

  /**
   * Check if it's the player's turn
   */
  public isPlayerTurn(): boolean {
    const currentParticipant = this.getCurrentTurnParticipant();
    return currentParticipant?.team === 'player' || false;
  }

  // Helper methods

  private createParticipantFromPet(pet: Pet, team: 'player' | 'enemy'): BattleParticipant {
    return {
      id: pet.id,
      name: pet.name,
      sprite: `${pet.species}.png`, // Use species string to create sprite path
      currentHealth: pet.stats.health,
      maxHealth: pet.stats.maxHealth,
      currentAction: pet.stats.maxAction, // Start with full action
      maxAction: pet.stats.maxAction,
      attack: pet.stats.attack,
      defense: pet.stats.defense,
      speed: pet.stats.speed,
      moves: pet.moves || [], // Pet should have known moves
      statusEffects: [],
      statModifiers: {
        attack: 1.0,
        defense: 1.0,
        speed: 1.0,
        accuracy: 1.0,
        evasion: 1.0
      },
      team: team,
      isWild: false
    };
  }

  private isParticipant(obj: any): obj is BattleParticipant {
    return obj && typeof obj === 'object' && 'currentHealth' in obj && 'team' in obj;
  }

  private getMoveById(moveId: string): BattleMove | null {
    // In a real implementation, this would fetch from a moves database
    // For now, return a basic move
    return {
      id: moveId,
      name: moveId.replace('_', ' '),
      description: `A basic move`,
      actionCost: 20,
      power: 30,
      accuracy: 90,
      priority: 0,
      moveType: 'damage',
      targetType: 'enemy',
      animation: 'basic_attack',
      soundEffect: 'hit'
    };
  }

  private getDefaultTarget(participant: BattleParticipant, move: BattleMove): BattleParticipant | null {
    if (!this.currentBattle) return null;

    switch (move.targetType) {
      case 'enemy':
        return this.currentBattle.participants.find(p => p.team !== participant.team) || null;
      case 'self':
        return participant;
      default:
        return this.currentBattle.participants.find(p => p.team !== participant.team) || null;
    }
  }

  private calculateRewards(config: BattleConfig, _opponent: BattleParticipant): { experience: number; currency: number; items: { itemId: string; quantity: number; chance: number }[] } {
    const baseExp = 50;
    const baseCurrency = 25;
    
    return {
      experience: Math.round(baseExp * config.rewardModifiers.experienceMultiplier),
      currency: Math.round(baseCurrency * config.rewardModifiers.currencyMultiplier),
      items: [] // Would be populated based on opponent type and drop tables
    };
  }

  private addBattleLogEntry(entry: Omit<BattleLogEntry, 'turn' | 'timestamp'> & { turn?: number; timestamp?: number }): void {
    if (!this.currentBattle) return;

    const logEntry: BattleLogEntry = {
      turn: entry.turn ?? this.currentBattle.turnCount,
      timestamp: entry.timestamp ?? Date.now(),
      ...entry
    };

    this.currentBattle.log.push(logEntry);
  }
}