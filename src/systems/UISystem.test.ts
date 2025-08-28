/**
 * UISystem tests - verifies UI state management and pessimistic saving
 */

import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { UISystem } from './UISystem';
import { UI_ACTIONS, UI_NOTIFICATIONS } from './UISystem';
import type { GameUpdateWriter } from '../engine/GameUpdatesQueue';
import type { GameState } from '../models';
import { UPDATE_TYPES } from '../models/constants';
import { createMockGameState as createBaseMockState, createMockGameUpdateWriter } from '../testing';

// Create mock GameState with our specific needs
const createMockGameState = (): GameState => ({
  ...createBaseMockState({
    playerId: 'test-player',
    currentLocationId: 'main_city',
    pet: null,
    coins: 100,
    unlockedSlots: 20,
  }),
  version: '1.0.0',
  timestamp: Date.now(),
  playerId: 'test-player',
  pet: {
    id: 'test-pet',
    name: 'Test Pet',
    species: 'test-species',
    rarity: 'COMMON',
    stage: 'JUVENILE',
    birthTime: Date.now(),
    stageStartTime: Date.now(),
    lastInteractionTime: Date.now(),
    stats: {
      health: 100,
      maxHealth: 100,
      attack: 10,
      defense: 10,
      speed: 10,
      action: 20,
      maxAction: 20,
    },
    energy: 50,
    maxEnergy: 80,
    careValues: {
      satiety: 75,
      hydration: 60,
      happiness: 80,
    },
    hiddenCounters: {
      satietyTicks: 1500,
      hydrationTicks: 900,
      happinessTicks: 2400,
      lifeTicks: 1000,
      poopTicks: 360,
    },
    status: {
      primary: 'IDLE',
    },
    sicknesses: [],
    injuries: [],
    poopCount: 0,
    moves: ['tackle', 'growl'],
    experiencePoints: 0,
    trainingCounts: {
      health: 0,
      attack: 0,
      defense: 0,
      speed: 0,
      action: 0,
    },
  },
  inventory: {
    items: [],
    currency: { coins: 100 },
    maxSlots: 50,
    unlockedSlots: 20,
  },
  world: {
    currentLocation: {
      currentLocationId: 'main_city',
      traveling: false,
      inActivity: false,
      visitedLocations: ['main_city'],
      lastVisitTimes: { main_city: Date.now() },
    },
    activeTimers: [],
    eventParticipation: [],
    currentEvents: [],
    worldTime: Date.now(),
    lastTickTime: Date.now(),
    tickCount: 0,
  },
  collections: {
    eggs: [],
    species: {},
    memorials: [],
  },
  meta: {
    settings: {
      masterVolume: 100,
      musicVolume: 80,
      sfxVolume: 100,
      textSize: 'medium',
      colorBlindMode: 'off',
      highContrast: false,
      reducedMotion: false,
      showParticles: true,
      autoSave: true,
      autoSaveInterval: 5,
      confirmActions: true,
      showTutorialHints: true,
      enableNotifications: true,
      lowCareWarning: true,
      activityComplete: true,
      eventReminders: true,
      touchControls: false,
      keyboardShortcuts: true,
      swipeGestures: false,
    },
    tutorialProgress: {
      completed: [],
      skipped: false,
      milestones: {
        firstFeed: false,
        firstDrink: false,
        firstPlay: false,
        firstClean: false,
        firstSleep: false,
        firstActivity: false,
        firstBattle: false,
        firstShop: false,
        firstTravel: false,
        firstTraining: false,
      },
    },
    statistics: {
      firstPlayTime: Date.now(),
      totalPlayTime: 0,
      lastPlayTime: Date.now(),
      consecutiveDays: 0,
      totalPetsOwned: 1,
      totalPetsLost: 0,
      currentPetAge: 0,
      longestPetLife: 0,
      totalFeedings: 0,
      totalDrinks: 0,
      totalPlays: 0,
      totalCleanings: 0,
      activitiesCompleted: {},
      totalItemsCollected: 0,
      totalCurrencyEarned: 0,
      totalCurrencySpent: 0,
      battleStats: {
        totalBattles: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        flees: 0,
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        totalHealing: 0,
        criticalHits: 0,
        movesUsed: {},
        longestBattle: 0,
        shortestVictory: 0,
        highestDamage: 0,
        mostConsecutiveWins: 0,
        byType: {},
      },
      speciesDiscovered: 1,
      totalSpecies: 10,
      itemsDiscovered: 0,
      totalItems: 50,
      locationsVisited: 1,
      totalTravelDistance: 0,
    },
  },
  saveData: {
    lastSaveTime: Date.now(),
    autoSaveEnabled: true,
    saveCount: 0,
    backupSlots: {},
  },
});

describe('UISystem', () => {
  let uiSystem: UISystem;
  let mockWriter: GameUpdateWriter;
  let mockGameState: GameState;
  let enqueueSpy: any;

  beforeEach(() => {
    mockWriter = createMockGameUpdateWriter();
    enqueueSpy = jest.fn();
    mockWriter.enqueue = enqueueSpy;
    uiSystem = new UISystem(mockWriter);
    mockGameState = createMockGameState();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await uiSystem.initialize();
      expect(uiSystem.isInitialized()).toBe(true);
      expect(uiSystem.isActive()).toBe(true);
    });

    it('should start with no rendered state', () => {
      expect(uiSystem.getLastRenderedState()).toBeNull();
    });
  });

  describe('renderState (pessimistic saving)', () => {
    it('should render state only when called by GameEngine after save', async () => {
      await uiSystem.initialize();
      const renderCallback = jest.fn();
      uiSystem.registerRenderCallback(renderCallback);

      // Simulate GameEngine calling render after successful save
      uiSystem.renderState(mockGameState);

      expect(renderCallback).toHaveBeenCalledWith(mockGameState);
      expect(uiSystem.getLastRenderedState()).toEqual(mockGameState);
    });

    it('should not re-render if state timestamp has not changed', async () => {
      await uiSystem.initialize();
      const renderCallback = jest.fn();
      uiSystem.registerRenderCallback(renderCallback);

      // First render
      uiSystem.renderState(mockGameState);
      expect(renderCallback).toHaveBeenCalledTimes(1);

      // Second render with same state
      uiSystem.renderState(mockGameState);
      expect(renderCallback).toHaveBeenCalledTimes(1); // Still 1

      // Force render
      uiSystem.renderState(mockGameState, true);
      expect(renderCallback).toHaveBeenCalledTimes(2);
    });

    it('should trigger notifications for low care values', async () => {
      await uiSystem.initialize();
      const notificationCallback = jest.fn();
      uiSystem.registerNotificationCallback(notificationCallback);

      // Create state with low care values
      const lowCareState = createMockGameState();
      if (lowCareState.pet) {
        lowCareState.pet.careValues = {
          satiety: 20, // Low
          hydration: 25, // Low
          happiness: 15, // Low
        };
      }

      uiSystem.renderState(lowCareState);

      // Should have triggered 3 notifications
      expect(notificationCallback).toHaveBeenCalledTimes(3);
    });

    it('should trigger notification for high poop count', async () => {
      await uiSystem.initialize();
      const notificationCallback = jest.fn();
      uiSystem.registerNotificationCallback(notificationCallback);

      // Create state with high poop count
      const dirtyState = createMockGameState();
      if (dirtyState.pet) {
        dirtyState.pet.poopCount = 5;
      }

      uiSystem.renderState(dirtyState);

      expect(notificationCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: UI_NOTIFICATIONS.HIGH_POOP_COUNT,
        }),
      );
    });
  });

  describe('handleUserAction', () => {
    it('should queue user actions to GameUpdates', async () => {
      await uiSystem.initialize();

      uiSystem.handleUserAction({
        action: UI_ACTIONS.FEED_PET,
        data: { itemId: 'food-1' },
      });

      expect(enqueueSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: UPDATE_TYPES.USER_ACTION,
          payload: expect.objectContaining({
            action: UI_ACTIONS.FEED_PET,
          }),
        }),
      );
    });

    it('should translate battle actions to BATTLE_ACTION update type', async () => {
      await uiSystem.initialize();

      uiSystem.handleUserAction({
        action: UI_ACTIONS.BATTLE_MOVE,
        data: { moveId: 'tackle' },
      });

      expect(enqueueSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: UPDATE_TYPES.BATTLE_ACTION,
        }),
      );
    });

    it('should translate event actions to EVENT_TRIGGER update type', async () => {
      await uiSystem.initialize();

      uiSystem.handleUserAction({
        action: UI_ACTIONS.JOIN_EVENT,
        data: { eventId: 'summer-festival' },
      });

      expect(enqueueSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: UPDATE_TYPES.EVENT_TRIGGER,
        }),
      );
    });

    it('should validate actions before queuing', async () => {
      await uiSystem.initialize();

      // Invalid action without required data
      uiSystem.handleUserAction({
        action: UI_ACTIONS.USE_ITEM,
        // Missing itemId
      });

      expect(enqueueSpy).not.toHaveBeenCalled();
    });

    it('should queue pending actions if already processing', async () => {
      await uiSystem.initialize();

      // Simulate processing state
      uiSystem.handleUserAction({
        action: UI_ACTIONS.FEED_PET,
        data: { itemId: 'food-1' },
      });

      // This should be queued
      uiSystem.handleUserAction({
        action: UI_ACTIONS.GIVE_DRINK,
        data: { itemId: 'water-1' },
      });

      // Both should eventually be processed
      expect(enqueueSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('notifications', () => {
    it('should queue notifications', async () => {
      await uiSystem.initialize();

      uiSystem.showNotification({
        type: UI_NOTIFICATIONS.SAVE_SUCCESS,
        title: 'Game Saved',
        message: 'Your progress has been saved',
        severity: 'success',
        timestamp: Date.now(),
      });

      // Notification should be queued
      expect(uiSystem['notificationQueue'].length).toBe(1);
    });

    it('should process notification queue when callback is registered', async () => {
      await uiSystem.initialize();
      const notificationCallback = jest.fn();

      // Add notifications before registering callback
      uiSystem.showNotification({
        type: UI_NOTIFICATIONS.SAVE_SUCCESS,
        title: 'Test 1',
        message: 'Message 1',
        severity: 'info',
        timestamp: Date.now(),
      });

      uiSystem.showNotification({
        type: UI_NOTIFICATIONS.SAVE_SUCCESS,
        title: 'Test 2',
        message: 'Message 2',
        severity: 'info',
        timestamp: Date.now(),
      });

      // Register callback - should process queue
      uiSystem.registerNotificationCallback(notificationCallback);
      uiSystem['processNotificationQueue']();

      expect(notificationCallback).toHaveBeenCalledTimes(2);
    });

    it('should respect notification settings', async () => {
      const disabledSystem = new UISystem(mockWriter, {
        enableNotifications: false,
      });
      await disabledSystem.initialize();

      const notificationCallback = jest.fn();
      disabledSystem.registerNotificationCallback(notificationCallback);

      disabledSystem.showNotification({
        type: UI_NOTIFICATIONS.SAVE_SUCCESS,
        title: 'Test',
        message: 'Message',
        severity: 'info',
        timestamp: Date.now(),
      });

      expect(notificationCallback).not.toHaveBeenCalled();
    });
  });

  describe('modals', () => {
    it('should show and hide modals', async () => {
      await uiSystem.initialize();
      const modalCallback = jest.fn();
      uiSystem.registerModalCallback(modalCallback);

      const modal = {
        type: 'STARTER_SELECTION' as const,
        title: 'Choose Your Starter',
        data: { species: ['bulbasaur', 'charmander', 'squirtle'] },
      };

      uiSystem.showModal(modal);
      expect(modalCallback).toHaveBeenCalledWith(modal);
      expect(uiSystem.getCurrentModal()).toEqual(modal);

      uiSystem.hideModal();
      expect(modalCallback).toHaveBeenCalledWith(null);
      expect(uiSystem.getCurrentModal()).toBeNull();
    });
  });

  describe('accessibility', () => {
    it('should apply accessibility settings', async () => {
      const accessibleSystem = new UISystem(mockWriter, {
        enableAccessibility: true,
      });
      await accessibleSystem.initialize();

      // Update config with accessibility enabled
      accessibleSystem.updateConfig({
        enableAccessibility: false,
      });

      // Should trigger accessibility changes (check console logs in implementation)
      expect(accessibleSystem['config'].enableAccessibility).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle render errors gracefully', async () => {
      await uiSystem.initialize();
      const errorCallback = jest.fn(() => {
        throw new Error('Render error');
      });
      uiSystem.registerRenderCallback(errorCallback);

      // Should not throw
      expect(() => uiSystem.renderState(mockGameState)).not.toThrow();
    });

    it('should show error notification on system error', async () => {
      await uiSystem.initialize();
      const notificationCallback = jest.fn();
      uiSystem.registerNotificationCallback(notificationCallback);

      uiSystem['onError']({
        system: 'UISystem',
        error: new Error('Test error'),
        timestamp: Date.now(),
        recoverable: true,
      });

      uiSystem['processNotificationQueue']();

      expect(notificationCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: UI_NOTIFICATIONS.ERROR,
          severity: 'error',
        }),
      );
    });
  });

  describe('action history', () => {
    it('should track action history for debugging', async () => {
      await uiSystem.initialize();

      const action = {
        action: UI_ACTIONS.FEED_PET,
        data: { itemId: 'food-1' },
      };

      // Simulate queuing an action
      uiSystem['pendingActions'].push(action);

      const history = uiSystem.getActionHistory();
      expect(history).toContainEqual(action);
    });

    it('should clear action queue', async () => {
      await uiSystem.initialize();

      uiSystem['pendingActions'].push({
        action: UI_ACTIONS.FEED_PET,
        data: { itemId: 'food-1' },
      });

      uiSystem.clearActionQueue();
      expect(uiSystem.getActionHistory()).toHaveLength(0);
    });
  });
});
