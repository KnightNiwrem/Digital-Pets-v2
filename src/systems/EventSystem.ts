/**
 * EventSystem - Manages calendar events and time-based content
 * Handles event scheduling, participation, rewards, and graceful closure
 */

import { BaseSystem } from './BaseSystem';
import type { SystemInitOptions, SystemError } from './BaseSystem';
import type { GameUpdateWriter } from '../engine/GameUpdatesQueue';
import type { GameState } from '../models';
import { UPDATE_TYPES, EVENT_TYPES, STATUS_TYPES } from '../models/constants';
import type { EventType } from '../models/constants';

/**
 * Event definition structure
 */
export interface EventDefinition {
  id: string;
  name: string;
  description: string;
  type: EventType;

  // Scheduling
  schedule: EventSchedule;
  duration: number; // Duration in hours

  // Requirements
  minPetStage?: string;
  requiredItems?: string[];
  entryCost?: number;

  // Activities and content
  activities: EventActivity[];
  battles?: EventBattle[];
  specialShopItems?: string[];

  // Rewards
  rewards: EventRewards;
  tokenRewardRate: number; // Tokens per activity/battle
  completionBonus?: EventReward[];
}

/**
 * Event scheduling configuration
 */
export interface EventSchedule {
  type: 'weekly' | 'daily' | 'seasonal' | 'specific';

  // For weekly events
  daysOfWeek?: number[]; // 0 = Sunday, 6 = Saturday

  // For daily events
  startHour?: number; // 0-23
  endHour?: number;

  // For seasonal events
  season?: 'spring' | 'summer' | 'fall' | 'winter';

  // For specific date events
  specificDates?: Array<{
    month: number;
    day: number;
    startHour: number;
    endHour: number;
  }>;

  // Timezone handling
  useLocalTime: boolean;
}

/**
 * Event activity definition
 */
export interface EventActivity {
  id: string;
  name: string;
  duration: number; // In minutes
  energyCost: number;
  tokenReward: number;
  specialRewards?: EventReward[];
  successRate: number; // 0-100
}

/**
 * Event battle configuration
 */
export interface EventBattle {
  id: string;
  name: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  opponentId: string;
  tokenReward: number;
  specialRewards?: EventReward[];
}

/**
 * Event reward structure
 */
export interface EventReward {
  type: 'item' | 'currency' | 'egg' | 'experience';
  id: string;
  quantity: number;
  chance: number; // 0-100
}

/**
 * Event rewards configuration
 */
export interface EventRewards {
  participation: EventReward[];
  milestone: Array<{
    tokensRequired: number;
    rewards: EventReward[];
  }>;
  completion: EventReward[];
}

/**
 * Active event instance
 */
export interface ActiveEvent {
  eventId: string;
  startTime: number;
  endTime: number;
  tokensEarned: number;
  activitiesCompleted: string[];
  battlesWon: string[];
  milestonesReached: number[];
  isCompleted: boolean;
}

/**
 * Event participation state
 */
export interface EventParticipation {
  eventId: string;
  joinedAt: number;
  currentActivity?: {
    activityId: string;
    startedAt: number;
    completesAt: number;
  };
  currentBattle?: {
    battleId: string;
    startedAt: number;
  };
}

/**
 * EventSystem implementation
 */
export class EventSystem extends BaseSystem {
  private eventDefinitions: Map<string, EventDefinition> = new Map();
  private activeEvents: Map<string, ActiveEvent> = new Map();
  private eventCheckInterval: NodeJS.Timeout | null = null;
  private lastEventCheck: number = 0;
  private eventCheckFrequency = 60000; // Check every minute

  constructor(gameUpdateWriter: GameUpdateWriter) {
    super('EventSystem', gameUpdateWriter);
    this.loadEventDefinitions();
  }

  /**
   * Initialize the event system
   */
  protected async onInitialize(_options: SystemInitOptions): Promise<void> {
    // Start event checking
    this.startEventChecking();
  }

  /**
   * Shutdown the event system
   */
  protected async onShutdown(): Promise<void> {
    this.stopEventChecking();
    this.activeEvents.clear();
  }

  /**
   * Reset the event system
   */
  protected async onReset(): Promise<void> {
    this.activeEvents.clear();
    this.lastEventCheck = 0;
  }

  /**
   * Process a game tick
   */
  protected async onTick(_deltaTime: number, gameState: GameState): Promise<void> {
    // Check for event changes on tick
    this.checkEventAvailability(gameState);

    // Process ongoing event activities
    this.processOngoingActivities(gameState);
  }

  /**
   * Update the system based on game state changes
   */
  protected async onUpdate(_gameState: GameState, _prevState?: GameState): Promise<void> {
    // Event system primarily responds to time and user actions
  }

  /**
   * Handle system errors
   */
  protected onError(error: SystemError): void {
    console.error(`[EventSystem] Error occurred:`, error);

    // For critical errors, stop event checking
    if (!error.recoverable) {
      this.stopEventChecking();
    }
  }

  /**
   * Load event definitions from configuration
   */
  private loadEventDefinitions(): void {
    // Load predefined events
    const events = this.getDefaultEvents();

    for (const event of events) {
      this.eventDefinitions.set(event.id, event);
    }
  }

  /**
   * Get default event definitions
   */
  private getDefaultEvents(): EventDefinition[] {
    return [
      // Daily Arena Event
      {
        id: 'daily_arena',
        name: 'Daily Arena Challenge',
        description: 'Test your pet in daily arena battles!',
        type: EVENT_TYPES.DAILY,
        schedule: {
          type: 'daily',
          startHour: 14, // 2 PM
          endHour: 18, // 6 PM
          useLocalTime: true,
        },
        duration: 4,
        activities: [],
        battles: [
          {
            id: 'arena_easy',
            name: 'Arena - Easy',
            difficulty: 'easy',
            opponentId: 'arena_opponent_easy',
            tokenReward: 10,
            specialRewards: [{ type: 'currency', id: 'coins', quantity: 50, chance: 100 }],
          },
          {
            id: 'arena_medium',
            name: 'Arena - Medium',
            difficulty: 'medium',
            opponentId: 'arena_opponent_medium',
            tokenReward: 20,
            specialRewards: [{ type: 'currency', id: 'coins', quantity: 100, chance: 100 }],
          },
          {
            id: 'arena_hard',
            name: 'Arena - Hard',
            difficulty: 'hard',
            opponentId: 'arena_opponent_hard',
            tokenReward: 35,
            specialRewards: [
              { type: 'currency', id: 'coins', quantity: 200, chance: 100 },
              { type: 'item', id: 'rare_food', quantity: 1, chance: 50 },
            ],
          },
        ],
        rewards: {
          participation: [{ type: 'currency', id: 'coins', quantity: 25, chance: 100 }],
          milestone: [
            {
              tokensRequired: 50,
              rewards: [{ type: 'item', id: 'energy_booster', quantity: 1, chance: 100 }],
            },
            {
              tokensRequired: 100,
              rewards: [{ type: 'egg', id: 'uncommon_egg', quantity: 1, chance: 100 }],
            },
          ],
          completion: [{ type: 'currency', id: 'coins', quantity: 500, chance: 100 }],
        },
        tokenRewardRate: 1,
      },

      // Weekend Tournament
      {
        id: 'weekend_tournament',
        name: 'Weekend Tournament',
        description: 'Compete in the weekend tournament for amazing rewards!',
        type: EVENT_TYPES.WEEKLY,
        schedule: {
          type: 'weekly',
          daysOfWeek: [5, 6, 0], // Friday, Saturday, Sunday
          startHour: 10,
          endHour: 22,
          useLocalTime: true,
        },
        duration: 12,
        minPetStage: 'JUVENILE',
        activities: [
          {
            id: 'tournament_training',
            name: 'Tournament Training',
            duration: 10,
            energyCost: 15,
            tokenReward: 5,
            successRate: 90,
            specialRewards: [{ type: 'experience', id: 'battle_exp', quantity: 10, chance: 100 }],
          },
        ],
        battles: [
          {
            id: 'tournament_round1',
            name: 'Tournament Round 1',
            difficulty: 'medium',
            opponentId: 'tournament_opponent_1',
            tokenReward: 25,
            specialRewards: [{ type: 'currency', id: 'coins', quantity: 150, chance: 100 }],
          },
          {
            id: 'tournament_round2',
            name: 'Tournament Round 2',
            difficulty: 'hard',
            opponentId: 'tournament_opponent_2',
            tokenReward: 40,
            specialRewards: [{ type: 'currency', id: 'coins', quantity: 300, chance: 100 }],
          },
          {
            id: 'tournament_finals',
            name: 'Tournament Finals',
            difficulty: 'extreme',
            opponentId: 'tournament_champion',
            tokenReward: 75,
            specialRewards: [
              { type: 'currency', id: 'coins', quantity: 1000, chance: 100 },
              { type: 'egg', id: 'rare_egg', quantity: 1, chance: 75 },
            ],
          },
        ],
        rewards: {
          participation: [
            { type: 'currency', id: 'coins', quantity: 100, chance: 100 },
            { type: 'item', id: 'tournament_badge', quantity: 1, chance: 100 },
          ],
          milestone: [
            {
              tokensRequired: 100,
              rewards: [{ type: 'item', id: 'rare_toy', quantity: 1, chance: 100 }],
            },
            {
              tokensRequired: 200,
              rewards: [{ type: 'egg', id: 'rare_egg', quantity: 1, chance: 100 }],
            },
            {
              tokensRequired: 300,
              rewards: [{ type: 'egg', id: 'epic_egg', quantity: 1, chance: 100 }],
            },
          ],
          completion: [
            { type: 'currency', id: 'coins', quantity: 2000, chance: 100 },
            { type: 'item', id: 'champion_trophy', quantity: 1, chance: 100 },
          ],
        },
        tokenRewardRate: 2,
      },

      // Seasonal Festival (Example: Spring Festival)
      {
        id: 'spring_festival',
        name: 'Spring Festival',
        description: 'Celebrate spring with special activities and rewards!',
        type: EVENT_TYPES.SEASONAL,
        schedule: {
          type: 'seasonal',
          season: 'spring',
          useLocalTime: true,
        },
        duration: 168, // 1 week
        activities: [
          {
            id: 'flower_picking',
            name: 'Flower Picking',
            duration: 5,
            energyCost: 10,
            tokenReward: 8,
            successRate: 95,
            specialRewards: [{ type: 'item', id: 'spring_flower', quantity: 1, chance: 80 }],
          },
          {
            id: 'egg_hunting',
            name: 'Egg Hunting',
            duration: 15,
            energyCost: 20,
            tokenReward: 15,
            successRate: 85,
            specialRewards: [{ type: 'egg', id: 'spring_egg', quantity: 1, chance: 30 }],
          },
          {
            id: 'spring_cleaning',
            name: 'Spring Cleaning',
            duration: 8,
            energyCost: 12,
            tokenReward: 10,
            successRate: 100,
            specialRewards: [{ type: 'item', id: 'cleaning_supplies', quantity: 3, chance: 100 }],
          },
        ],
        specialShopItems: ['spring_outfit', 'flower_crown', 'spring_toy'],
        rewards: {
          participation: [
            { type: 'item', id: 'spring_badge', quantity: 1, chance: 100 },
            { type: 'currency', id: 'coins', quantity: 200, chance: 100 },
          ],
          milestone: [
            {
              tokensRequired: 150,
              rewards: [{ type: 'item', id: 'spring_decoration', quantity: 1, chance: 100 }],
            },
            {
              tokensRequired: 300,
              rewards: [{ type: 'egg', id: 'spring_special_egg', quantity: 1, chance: 100 }],
            },
            {
              tokensRequired: 500,
              rewards: [{ type: 'egg', id: 'legendary_spring_egg', quantity: 1, chance: 100 }],
            },
          ],
          completion: [
            { type: 'currency', id: 'coins', quantity: 5000, chance: 100 },
            { type: 'item', id: 'spring_crown', quantity: 1, chance: 100 },
          ],
        },
        tokenRewardRate: 3,
      },
    ];
  }

  /**
   * Start periodic event checking
   */
  private startEventChecking(): void {
    if (this.eventCheckInterval) {
      return;
    }

    // Initial check
    this.checkAllEvents();

    // Set up periodic checking
    this.eventCheckInterval = setInterval(() => {
      this.checkAllEvents();
    }, this.eventCheckFrequency);
  }

  /**
   * Stop event checking
   */
  private stopEventChecking(): void {
    if (this.eventCheckInterval) {
      clearInterval(this.eventCheckInterval);
      this.eventCheckInterval = null;
    }
  }

  /**
   * Check all events for availability
   */
  private checkAllEvents(): void {
    const now = Date.now();

    // Check each event definition
    for (const [eventId, eventDef] of this.eventDefinitions) {
      const isAvailable = this.isEventAvailable(eventDef, now);
      const activeEvent = this.activeEvents.get(eventId);

      if (isAvailable && !activeEvent) {
        // Start new event
        this.startEvent(eventDef, now);
      } else if (!isAvailable && activeEvent && !activeEvent.isCompleted) {
        // End active event
        this.endEvent(eventId, now);
      } else if (activeEvent && activeEvent.endTime <= now) {
        // Event time expired
        this.endEvent(eventId, now);
      }
    }

    this.lastEventCheck = now;
  }

  /**
   * Check if an event is currently available
   */
  private isEventAvailable(event: EventDefinition, currentTime: number): boolean {
    const date = new Date(currentTime);
    const schedule = event.schedule;

    if (schedule.useLocalTime) {
      // Use local time for scheduling
      date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    }

    switch (schedule.type) {
      case 'daily':
        return this.checkDailySchedule(date, schedule);

      case 'weekly':
        return this.checkWeeklySchedule(date, schedule);

      case 'seasonal':
        return this.checkSeasonalSchedule(date, schedule);

      case 'specific':
        return this.checkSpecificSchedule(date, schedule);

      default:
        return false;
    }
  }

  /**
   * Check daily event schedule
   */
  private checkDailySchedule(date: Date, schedule: EventSchedule): boolean {
    if (schedule.startHour === undefined || schedule.endHour === undefined) {
      return false;
    }

    const currentHour = date.getHours();

    if (schedule.startHour <= schedule.endHour) {
      // Same day event
      return currentHour >= schedule.startHour && currentHour < schedule.endHour;
    } else {
      // Overnight event
      return currentHour >= schedule.startHour || currentHour < schedule.endHour;
    }
  }

  /**
   * Check weekly event schedule
   */
  private checkWeeklySchedule(date: Date, schedule: EventSchedule): boolean {
    if (!schedule.daysOfWeek || schedule.daysOfWeek.length === 0) {
      return false;
    }

    const dayOfWeek = date.getDay();
    const isCorrectDay = schedule.daysOfWeek.includes(dayOfWeek);

    if (!isCorrectDay) {
      return false;
    }

    // Check hour range if specified
    if (schedule.startHour !== undefined && schedule.endHour !== undefined) {
      return this.checkDailySchedule(date, schedule);
    }

    return true;
  }

  /**
   * Check seasonal event schedule
   */
  private checkSeasonalSchedule(date: Date, schedule: EventSchedule): boolean {
    if (!schedule.season) {
      return false;
    }

    const month = date.getMonth();
    const season = this.getSeasonFromMonth(month);

    return season === schedule.season;
  }

  /**
   * Check specific date event schedule
   */
  private checkSpecificSchedule(date: Date, schedule: EventSchedule): boolean {
    if (!schedule.specificDates || schedule.specificDates.length === 0) {
      return false;
    }

    const month = date.getMonth() + 1; // JavaScript months are 0-indexed
    const day = date.getDate();
    const hour = date.getHours();

    for (const specificDate of schedule.specificDates) {
      if (specificDate.month === month && specificDate.day === day) {
        if (hour >= specificDate.startHour && hour < specificDate.endHour) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get season from month
   */
  private getSeasonFromMonth(month: number): 'spring' | 'summer' | 'fall' | 'winter' {
    // Northern hemisphere seasons
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  /**
   * Start a new event
   */
  private startEvent(eventDef: EventDefinition, currentTime: number): void {
    const endTime = currentTime + eventDef.duration * 60 * 60 * 1000;

    const activeEvent: ActiveEvent = {
      eventId: eventDef.id,
      startTime: currentTime,
      endTime,
      tokensEarned: 0,
      activitiesCompleted: [],
      battlesWon: [],
      milestonesReached: [],
      isCompleted: false,
    };

    this.activeEvents.set(eventDef.id, activeEvent);

    // Queue event start update
    if (this.gameUpdateWriter) {
      this.gameUpdateWriter.enqueue({
        type: UPDATE_TYPES.EVENT_TRIGGER,
        payload: {
          action: 'event_start',
          data: {
            eventId: eventDef.id,
            eventName: eventDef.name,
            endTime,
          },
        },
      });
    }

    console.log(`[EventSystem] Started event: ${eventDef.name}`);
  }

  /**
   * End an active event
   */
  private endEvent(eventId: string, currentTime: number): void {
    const activeEvent = this.activeEvents.get(eventId);
    const eventDef = this.eventDefinitions.get(eventId);

    if (!activeEvent || !eventDef) {
      return;
    }

    // Calculate final rewards
    const finalRewards = this.calculateFinalRewards(activeEvent, eventDef);

    // Convert remaining tokens to currency
    const tokenConversion = this.convertTokensToCurrency(activeEvent.tokensEarned);

    // Mark as completed
    activeEvent.isCompleted = true;

    // Queue event end update
    if (this.gameUpdateWriter) {
      this.gameUpdateWriter.enqueue({
        type: UPDATE_TYPES.EVENT_TRIGGER,
        payload: {
          action: 'event_end',
          data: {
            eventId,
            eventName: eventDef.name,
            finalRewards,
            tokenConversion,
            gracefulClosure: currentTime < activeEvent.endTime,
          },
        },
      });
    }

    // Remove from active events
    this.activeEvents.delete(eventId);

    console.log(`[EventSystem] Ended event: ${eventDef.name}`);
  }

  /**
   * Check event availability for a game state
   */
  private checkEventAvailability(gameState: GameState): void {
    // Check if pet meets requirements for events
    if (!gameState.pet) {
      return;
    }

    const now = Date.now();

    // Check for events that should be active
    for (const [eventId, eventDef] of this.eventDefinitions) {
      const activeEvent = this.activeEvents.get(eventId);

      // Check minimum pet stage requirement
      if (
        eventDef.minPetStage &&
        !this.meetsStageRequirement(gameState.pet.stage, eventDef.minPetStage)
      ) {
        continue;
      }

      // Check if event should be active but isn't
      if (this.isEventAvailable(eventDef, now) && !activeEvent) {
        this.startEvent(eventDef, now);
      }
    }
  }

  /**
   * Check if pet meets stage requirement
   */
  private meetsStageRequirement(petStage: string, requiredStage: string): boolean {
    const stageOrder = ['HATCHLING', 'JUVENILE', 'ADULT'];
    const petStageIndex = stageOrder.indexOf(petStage);
    const requiredStageIndex = stageOrder.indexOf(requiredStage);

    return petStageIndex >= requiredStageIndex;
  }

  /**
   * Process ongoing event activities
   */
  private processOngoingActivities(gameState: GameState): void {
    const participation = gameState.world?.eventParticipation;

    if (!participation || participation.length === 0) {
      return;
    }

    // TODO: Process ongoing activities based on EventRef structure
    // This will need to be implemented based on how EventRef is structured
  }

  /**
   * Calculate final rewards for an event
   */
  private calculateFinalRewards(
    activeEvent: ActiveEvent,
    eventDef: EventDefinition,
  ): EventReward[] {
    const rewards: EventReward[] = [];

    // Add participation rewards
    if (activeEvent.activitiesCompleted.length > 0 || activeEvent.battlesWon.length > 0) {
      rewards.push(...eventDef.rewards.participation);
    }

    // Add milestone rewards
    for (const milestoneIndex of activeEvent.milestonesReached) {
      const milestone = eventDef.rewards.milestone[milestoneIndex];
      if (milestone) {
        rewards.push(...milestone.rewards);
      }
    }

    // Add completion rewards if all activities/battles completed
    const totalActivities = eventDef.activities.length;
    const totalBattles = eventDef.battles?.length || 0;
    const totalCompleted = activeEvent.activitiesCompleted.length + activeEvent.battlesWon.length;
    const totalPossible = totalActivities + totalBattles;

    if (totalPossible > 0 && totalCompleted >= totalPossible) {
      activeEvent.isCompleted = true;
      rewards.push(...eventDef.rewards.completion);
    }

    return rewards;
  }

  /**
   * Convert event tokens to currency
   */
  private convertTokensToCurrency(tokens: number): { coins: number; remainingTokens: number } {
    const conversionRate = this.tuning?.events?.tokenToCoinsRate || 10;
    const coins = Math.floor(tokens * conversionRate);

    return {
      coins,
      remainingTokens: 0, // All tokens are converted
    };
  }

  /**
   * Roll for rewards based on chance
   */
  private rollRewards(rewards: EventReward[]): EventReward[] {
    const earnedRewards: EventReward[] = [];

    for (const reward of rewards) {
      if (Math.random() * 100 < reward.chance) {
        earnedRewards.push(reward);
      }
    }

    return earnedRewards;
  }

  /**
   * Check for milestone completion
   */
  private checkMilestones(activeEvent: ActiveEvent, eventDef: EventDefinition): number[] {
    const newMilestones: number[] = [];
    const milestones = eventDef.rewards.milestone;

    for (let i = 0; i < milestones.length; i++) {
      const milestone = milestones[i];

      if (
        milestone &&
        activeEvent.tokensEarned >= milestone.tokensRequired &&
        !activeEvent.milestonesReached.includes(i)
      ) {
        activeEvent.milestonesReached.push(i);
        newMilestones.push(i);
      }
    }

    return newMilestones;
  }

  /**
   * Join an event
   */
  public joinEvent(eventId: string, gameState: GameState): boolean {
    const activeEvent = this.activeEvents.get(eventId);
    const eventDef = this.eventDefinitions.get(eventId);

    if (!activeEvent || !eventDef || activeEvent.isCompleted) {
      return false;
    }

    // Check requirements
    if (!gameState.pet) {
      return false;
    }

    if (
      eventDef.minPetStage &&
      !this.meetsStageRequirement(gameState.pet.stage, eventDef.minPetStage)
    ) {
      return false;
    }

    // Check entry cost
    if (eventDef.entryCost && gameState.inventory.currency.coins < eventDef.entryCost) {
      return false;
    }

    // Queue join event update
    if (this.gameUpdateWriter) {
      this.gameUpdateWriter.enqueue({
        type: UPDATE_TYPES.EVENT_TRIGGER,
        payload: {
          action: 'join_event',
          data: {
            eventId,
            eventName: eventDef.name,
            entryCost: eventDef.entryCost || 0,
          },
        },
      });
    }

    return true;
  }

  /**
   * Start an event activity
   */
  public startActivity(eventId: string, activityId: string, gameState: GameState): boolean {
    const activeEvent = this.activeEvents.get(eventId);
    const eventDef = this.eventDefinitions.get(eventId);

    if (!activeEvent || !eventDef || activeEvent.isCompleted) {
      return false;
    }

    const activity = eventDef.activities.find((a) => a.id === activityId);

    if (!activity) {
      return false;
    }

    // Check energy requirement
    if (!gameState.pet || gameState.pet.energy < activity.energyCost) {
      return false;
    }

    const now = Date.now();
    const completesAt = now + activity.duration * 60 * 1000;

    // Queue activity start update
    if (this.gameUpdateWriter) {
      this.gameUpdateWriter.enqueue({
        type: UPDATE_TYPES.EVENT_TRIGGER,
        payload: {
          action: 'start_activity',
          data: {
            eventId,
            activityId,
            activityName: activity.name,
            energyCost: activity.energyCost,
            completesAt,
          },
        },
      });
    }

    return true;
  }

  /**
   * Complete an event activity
   */
  private completeActivity(eventId: string, activityId: string, gameState?: GameState): void {
    const activeEvent = this.activeEvents.get(eventId);
    const eventDef = this.eventDefinitions.get(eventId);

    if (!activeEvent || !eventDef) {
      return;
    }

    const activity = eventDef.activities.find((a) => a.id === activityId);

    if (!activity) {
      return;
    }

    // Roll for success with sickness penalty
    let successRate = activity.successRate;
    if (
      gameState?.pet?.status?.primary === STATUS_TYPES.SICK &&
      this.tuning?.sickness.activitySuccessPenalty !== undefined
    ) {
      successRate *= this.tuning.sickness.activitySuccessPenalty;
    }
    const success = Math.random() * 100 < successRate;

    if (success) {
      // Award tokens
      activeEvent.tokensEarned += activity.tokenReward * eventDef.tokenRewardRate;
      activeEvent.activitiesCompleted.push(activityId);

      // Roll for special rewards
      const specialRewards = this.rollRewards(activity.specialRewards || []);

      // Check for milestone completion
      const newMilestones = this.checkMilestones(activeEvent, eventDef);

      // Queue activity complete update
      if (this.gameUpdateWriter) {
        this.gameUpdateWriter.enqueue({
          type: UPDATE_TYPES.EVENT_TRIGGER,
          payload: {
            action: 'activity_complete',
            data: {
              eventId,
              activityId,
              success: true,
              tokensEarned: activity.tokenReward * eventDef.tokenRewardRate,
              specialRewards,
              newMilestones,
            },
          },
        });
      }
    } else {
      // Activity failed
      if (this.gameUpdateWriter) {
        this.gameUpdateWriter.enqueue({
          type: UPDATE_TYPES.EVENT_TRIGGER,
          payload: {
            action: 'activity_complete',
            data: {
              eventId,
              activityId,
              success: false,
              tokensEarned: 0,
              specialRewards: [],
              newMilestones: [],
            },
          },
        });
      }
    }
  }

  /**
   * Start an event battle
   */
  public startBattle(eventId: string, battleId: string, _gameState: GameState): boolean {
    const activeEvent = this.activeEvents.get(eventId);
    const eventDef = this.eventDefinitions.get(eventId);

    if (!activeEvent || !eventDef || activeEvent.isCompleted || !eventDef.battles) {
      return false;
    }

    const battle = eventDef.battles.find((b) => b.id === battleId);

    if (!battle) {
      return false;
    }

    // Queue battle start update
    if (this.gameUpdateWriter) {
      this.gameUpdateWriter.enqueue({
        type: UPDATE_TYPES.EVENT_TRIGGER,
        payload: {
          action: 'start_battle',
          data: {
            eventId,
            battleId,
            battleName: battle.name,
            difficulty: battle.difficulty,
            opponentId: battle.opponentId,
          },
        },
      });
    }

    return true;
  }

  /**
   * Complete an event battle
   */
  public completeBattle(eventId: string, battleId: string, won: boolean): void {
    const activeEvent = this.activeEvents.get(eventId);
    const eventDef = this.eventDefinitions.get(eventId);

    if (!activeEvent || !eventDef || !eventDef.battles) {
      return;
    }

    const battle = eventDef.battles.find((b) => b.id === battleId);

    if (!battle) {
      return;
    }

    if (won) {
      // Award tokens
      activeEvent.tokensEarned += battle.tokenReward * eventDef.tokenRewardRate;
      activeEvent.battlesWon.push(battleId);

      // Roll for special rewards
      const specialRewards = this.rollRewards(battle.specialRewards || []);

      // Check for milestone completion
      const newMilestones = this.checkMilestones(activeEvent, eventDef);

      // Queue battle complete update
      if (this.gameUpdateWriter) {
        this.gameUpdateWriter.enqueue({
          type: UPDATE_TYPES.EVENT_TRIGGER,
          payload: {
            action: 'battle_complete',
            data: {
              eventId,
              battleId,
              won: true,
              tokensEarned: battle.tokenReward * eventDef.tokenRewardRate,
              specialRewards,
              newMilestones,
            },
          },
        });
      }
    } else {
      // Battle lost
      if (this.gameUpdateWriter) {
        this.gameUpdateWriter.enqueue({
          type: UPDATE_TYPES.EVENT_TRIGGER,
          payload: {
            action: 'battle_complete',
            data: {
              eventId,
              battleId,
              won: false,
              tokensEarned: 0,
              specialRewards: [],
              newMilestones: [],
            },
          },
        });
      }
    }
  }

  /**
   * Get currently active events
   */
  public getActiveEvents(): ActiveEvent[] {
    return Array.from(this.activeEvents.values());
  }

  /**
   * Get event definition by ID
   */
  public getEventDefinition(eventId: string): EventDefinition | undefined {
    return this.eventDefinitions.get(eventId);
  }

  /**
   * Check if an event is currently active
   */
  public isEventActive(eventId: string): boolean {
    const activeEvent = this.activeEvents.get(eventId);
    return activeEvent !== undefined && !activeEvent.isCompleted;
  }

  /**
   * Get event progress
   */
  public getEventProgress(eventId: string): {
    tokensEarned: number;
    activitiesCompleted: number;
    battlesWon: number;
    milestonesReached: number;
    percentComplete: number;
  } | null {
    const activeEvent = this.activeEvents.get(eventId);
    const eventDef = this.eventDefinitions.get(eventId);

    if (!activeEvent || !eventDef) {
      return null;
    }

    const totalActivities = eventDef.activities.length;
    const totalBattles = eventDef.battles?.length || 0;
    const totalPossible = totalActivities + totalBattles;
    const totalCompleted = activeEvent.activitiesCompleted.length + activeEvent.battlesWon.length;

    return {
      tokensEarned: activeEvent.tokensEarned,
      activitiesCompleted: activeEvent.activitiesCompleted.length,
      battlesWon: activeEvent.battlesWon.length,
      milestonesReached: activeEvent.milestonesReached.length,
      percentComplete: totalPossible > 0 ? (totalCompleted / totalPossible) * 100 : 0,
    };
  }

  /**
   * Get upcoming events
   */
  public getUpcomingEvents(hoursAhead: number = 24): Array<{
    eventId: string;
    eventName: string;
    startsIn: number; // minutes
  }> {
    const upcoming: Array<{ eventId: string; eventName: string; startsIn: number }> = [];
    const now = Date.now();
    const futureTime = now + hoursAhead * 60 * 60 * 1000;

    for (const [eventId, eventDef] of this.eventDefinitions) {
      // Skip already active events
      if (this.activeEvents.has(eventId)) {
        continue;
      }

      // Check if event will become available within the time window
      for (let checkTime = now; checkTime <= futureTime; checkTime += 60 * 60 * 1000) {
        if (this.isEventAvailable(eventDef, checkTime)) {
          const startsIn = Math.floor((checkTime - now) / (60 * 1000));
          upcoming.push({
            eventId,
            eventName: eventDef.name,
            startsIn,
          });
          break;
        }
      }
    }

    return upcoming;
  }

  /**
   * Force end all active events (for testing/admin)
   */
  public forceEndAllEvents(): void {
    const now = Date.now();
    const eventIds = Array.from(this.activeEvents.keys());

    for (const eventId of eventIds) {
      this.endEvent(eventId, now);
    }
  }

  /**
   * Get event leaderboard (placeholder for future implementation)
   */
  public getEventLeaderboard(_eventId: string): Array<{
    rank: number;
    playerName: string;
    score: number;
  }> {
    // Placeholder for future multiplayer implementation
    return [];
  }
}
